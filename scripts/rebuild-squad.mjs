/*
 * Rebuild the squad from OCR'd passports.
 *
 * Reads players.json, produced by extract-passports.py. That script reads each
 * document several times - the whole page, the machine-readable zone banded
 * and upscaled, and, when the check digits do not all agree, a sweep of
 * overlapping strips - and keeps the reading with the most validated check
 * digits. A field is only reported clean when all three MRZ check digits
 * agree; anything less is flagged for a human.
 *
 * Only the fields a squad page needs are written: name, date of birth,
 * nationality and the passport scan itself. Position, height, club, foot and
 * squad number are left NULL for a human to fill in - a blank is honest, a
 * guessed height is not. A date of birth is still required, because the app
 * derives AGE from it.
 *
 * The passport NUMBER is deliberately not stored, even though the extractor
 * reads it and validates it against the MRZ check digits. Nothing on a squad
 * page needs it, and an identity document number in a table the whole staff
 * can query is a liability with no upside.
 *
 * Each scan is uploaded to the private storage bucket under passports/ and the
 * card records the path. Only the path is stored - never a signed URL, which
 * would expire - and the app resolves it to a short-lived signed URL per
 * viewer through /api/image. Uploads obey the same 5 MB cap and MIME
 * allowlist as the /api/upload route, and happen as the caller, so the storage
 * RLS policy is what authorises them.
 *
 * Files classified as photographs are not players and are not uploaded.
 *
 * Rows are written through PostgREST with the caller's own access token,
 * exactly as syncMembers() does in the browser, so the RLS policies and the
 * has_permission() grants are what actually authorise the write. No privileged
 * key is involved and nothing bypasses the database.
 *
 * Dry run by default. Pass --write to insert.
 *
 *   node scripts/rebuild-squad.mjs <scansDir> [--write]
 *
 * The Supabase URL and key are read from .env.local. The write token belongs to
 * a signed-in account, so it is read from %TEMP%\squad_token.txt, or SQUAD_TOKEN.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const USAGE = 'usage: node scripts/rebuild-squad.mjs <scansDir> [--write]'

const [, , scansDir, ...flags] = process.argv
const WRITE = flags.includes('--write')

// A date of birth is the one thing the loader insists on: the app derives AGE
// from it, and the MRZ is the only source for it that is check-digit
// protected. Everything else a passport cannot state stays NULL.
const REQUIRED = ['birthdate']

// The MRZ carries an ISO 3166-1 alpha-3 code, which is the document's own
// wording. flagCodeFor() in lib/country-flags.ts looks countries up by full
// name, so a bare "TUN" would resolve to null and render a broken flag image.
// Codes are translated to the names the app already knows; anything unmapped
// is dropped rather than written as a code the UI cannot use.
const NATIONALITY = {
  TUN: 'Tunisia', FRA: 'France', DZA: 'Algeria', MAR: 'Morocco', LBY: 'Libya',
  ITA: 'Italy', ESP: 'Spain', DEU: 'Germany', GBR: 'United Kingdom', USA: 'United States',
  BEL: 'Belgium', NLD: 'Netherlands', CHE: 'Switzerland', CAN: 'Canada',
  EGY: 'Egypt', JPN: 'Japan', BRA: 'Brazil', TUR: 'Turkiye', RUS: 'Russia',
}
const nationality = (code) => NATIONALITY[code] || ''

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of (await readFile(path.join(REPO, '.env.local'), 'utf8')).split('\n')) {
  const i = line.indexOf('=')
  if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

const url = process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// The write token belongs to a signed-in account, so it cannot be baked in.
// Sign in through the app, then drop the access token in this file:
//   %TEMP%\squad_token.txt
const tokenFile = process.env.SQUAD_TOKEN_FILE
  || path.join(process.env.TEMP || REPO, 'squad_token.txt')
const token = process.env.SQUAD_TOKEN
  || (existsSync(tokenFile) ? (await readFile(tokenFile, 'utf8')).trim() : '')

const headers = () => ({
  apikey: key,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

// ── passport scans → private storage ────────────────────────────────────────
// The bucket is private, which is the point: an identity document must never be
// publicly fetchable. Only the path is persisted; the app mints a short-lived
// signed URL per viewer through /api/image. These are the same limits the
// /api/upload route enforces, so a batch import cannot become a wider door.
const BUCKET = 'members'
const MAX_BYTES = 5 * 1024 * 1024
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
}
const UPLOADABLE = new Set(Object.keys(MIME))

/**
 * Storage path for one scan. Deterministic rather than timestamped, so
 * re-running the loader replaces the same object instead of filling the bucket
 * with a fresh copy of every document on every pass.
 *
 * Named after the original scan, not the prepared copy, so a PDF that was
 * rasterised still lands under a name a human can match to the player.
 */
function storagePath(scanName, uploadName) {
  const ext = path.extname(uploadName).toLowerCase()
  if (!UPLOADABLE.has(ext)) return ''
  const base = path.basename(scanName, path.extname(scanName))
  // Matches safeKey() in app/api/image/route.ts: no spaces, no traversal.
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
  return `passports/${safe}${ext}`
}

async function uploadPassport(rec) {
  // The extractor prepares a displayable copy: a PDF is rasterised to JPEG
  // and anything over the 5 MB cap is re-encoded. upload_file points at it.
  const file = rec.upload_file || rec.file
  const target = storagePath(rec.file, file)
  if (!target) return { ok: false, reason: `unsupported type ${path.extname(file) || '(none)'}` }
  const bytes = await readFile(path.join(scansDir, file))
  if (!bytes.length) return { ok: false, reason: 'empty file' }
  if (bytes.length > MAX_BYTES) {
    return { ok: false, reason: `${Math.round(bytes.length / 1024)} KB, over the 5 MB cap` }
  }

  // Uploaded as the CALLER, so the storage RLS policy
  // (has_permission('addPlayer')) is what authorises the write. There is no
  // privileged key here and no policy is bypassed.
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${target}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': MIME[path.extname(file).toLowerCase()], 'x-upsert': 'true' },
    body: bytes,
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, reason: `upload ${res.status}: ${text}` }
  return { ok: true, target, bytes: bytes.length }
}

async function main() {
  if (!scansDir) {
    console.error(USAGE)
    process.exit(2)
  }
  if (WRITE && (!url || !key || !token)) {
    console.error(
      `set SUPABASE_URL and SUPABASE_ANON_KEY, and put an access token in\n  ${tokenFile}\n` +
      '(sign in through the app first, then copy the token there)',
    )
    process.exit(1)
  }
  const dataPath = path.join(scansDir, 'players.json')
  if (!existsSync(dataPath)) {
    console.error(`no players.json in ${scansDir} - run extract-passports.py first`)
    process.exit(1)
  }
  const recs = JSON.parse(await readFile(dataPath, 'utf8'))

  let manual = {}
  const manualPath = path.join(scansDir, 'squad-input.json')
  if (existsSync(manualPath)) manual = JSON.parse(await readFile(manualPath, 'utf8'))

  const photos = recs.filter((r) => r.kind === 'photo')
  const broken = recs.filter((r) => r.kind === 'error')
  const passports = recs
    .filter((r) => r.kind === 'passport')
    .sort((a, b) => (a.name || '?').localeCompare(b.name || '?'))

  console.log(`\n${passports.length} passports, ${photos.length} photographs, ${broken.length} unreadable\n`)

  const w = Math.max(24, ...passports.map((r) => (r.name || '?').length + 2))
  const head = `${'name'.padEnd(w)} ${'born'.padEnd(11)} ${'nat'.padEnd(4)} ${'expires'.padEnd(11)} issues`
  console.log(head)
  console.log('-'.repeat(head.length))

  const rows = []
  const incomplete = []
  for (const r of passports) {
    const extra = manual[r.file] || {}

    const row = {
      file: r.file,
      // Carried through so the write phase knows which prepared file to
      // upload and what to call the stored object.
      uploadFile: r.upload_file || r.file,
      role: 'PLAYERS',
      // An override always wins, so a name can be corrected by hand without
      // re-running the OCR.
      name: extra.name || r.name || null,
      birthdate: r.birthdate || null,
      nationality: nationality(r.nationality) || null,
      // Filled in during the write phase, once the scan is actually in storage.
      passport_image: null,
      position: extra.position ?? null,
      team_category: extra.team_category ?? null,
      height: extra.height ?? null,
      club: extra.club ?? null,
      foot: extra.foot ?? null,
      jersey_number: extra.jersey_number ?? null,
      languages: [],
      history: [],
    }
    const missing = REQUIRED.filter((k) => row[k] == null)
    if (missing.length) incomplete.push({ file: r.file, name: row.name, missing })
    rows.push(row)
    console.log(
      `${(row.name || '?').padEnd(w)} ${(row.birthdate || '????-??-??').padEnd(11)} ` +
      `${(row.nationality || '?').padEnd(4)} ${(r.expiry || '-').padEnd(11)} ${(r.flags || []).join('; ') || 'clean'}`,
    )
  }

  if (photos.length) {
    console.log('\nnot documents - skipped entirely, nothing uploaded:')
    for (const p of photos) console.log(`  ${p.file}`)
  }
  for (const b of broken) console.log(`unreadable: ${b.file} (${(b.flags || []).join('; ')})`)

  if (incomplete.length) {
    console.log(`\n${incomplete.length} player(s) need details a passport cannot supply:`)
    for (const i of incomplete) console.log(`  ${i.file}  (${i.name || '?'})  missing: ${i.missing.join(', ')}`)
    console.log(`\nfill them in here and re-run:\n  ${manualPath}`)
  }

  if (!WRITE) {
    console.log('\ndry run - nothing written. re-run with --write to insert.')
    return
  }
  if (incomplete.length) {
    console.error('\nrefusing to write: the rows above are incomplete')
    process.exit(1)
  }

  // Upload the scans before inserting, so a card never points at a document
  // that is not there. A failed upload is reported and the card is still
  // created - a player with no scan attached is recoverable, a card that
  // 404s on its passport is a bug.
  console.log(`\nuploading ${rows.length} passport scan(s) to the private bucket...`)
  let uploaded = 0
  const failedUploads = []
  for (const row of rows) {
    const r = await uploadPassport({ file: row.file, upload_file: row.uploadFile })
    if (r.ok) {
      // Store the BARE STORAGE PATH, not an /api/image?path= URL. That route
      // authenticates with an Authorization header, which an <img> tag cannot
      // send -- the browser would get a 401 and the passport would never show.
      // The app resolves a plain path to a signed URL client-side, exactly as
      // it does for portraits.
      row.passport_image = r.target
      uploaded++
      console.log(`  ok    ${row.file}  ->  ${r.target}  (${Math.round(r.bytes / 1024)} KB)`)
    } else {
      failedUploads.push({ file: row.file, reason: r.reason })
      console.log(`  FAIL  ${row.file}  (${r.reason})`)
    }
  }
  if (failedUploads.length) {
    console.log(`\n${failedUploads.length} scan(s) not uploaded:`)
    for (const f of failedUploads) console.log(`  ${f.file}: ${f.reason}`)
  }

  console.log(`\ninserting ${rows.length} rows...`)
  const payload = rows.map(({ file, uploadFile, ...db }) => db)
  const res = await fetch(url + '/rest/v1/members', {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`insert failed ${res.status}: ${text}`)
    process.exit(1)
  }
  const created = JSON.parse(text)
  console.log(`inserted ${created.length} rows, ids: ${created.map((c) => c.id).join(', ')}`)
  await writeFile(path.join(scansDir, 'inserted.json'), JSON.stringify(created, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
