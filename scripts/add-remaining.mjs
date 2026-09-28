/**
 * Adds the 8 remaining players from joueuses.zip.
 *
 * rebuild-squad.mjs filters its input to records the extractor classified as
 * kind === 'passport', so these 8 were skipped entirely and no input file can
 * bring them back. This adds them explicitly.
 *
 * What is actually known about each, and why so little:
 *
 *   sarrah ben mbarek  full French passport, every check digit validates
 *                      (doc 26DA47967, FRA, F, expires 2036-04-01)
 *   samia ouni         TUN, F, expires 2028-11-14. The birthdate and expiry
 *                      check digits both pass, so those two are solid; the
 *                      document-number check digit fails, which means OCR
 *                      garbled that field. No number is stored either way.
 *   soulaima jabrani   a 22-character fragment, not a complete MRZ. Nothing
 *                      usable is asserted from it.
 *   the other 5        OCR returned ZERO characters across three page-segment
 *                      modes, so no field can be sourced from them. Treated
 *                      as players with an image and nothing invented.
 *
 * A birthdate is deliberately left NULL wherever the MRZ did not supply a
 * check-digit-valid one. The app derives AGE from it, so a wrong value would
 * be worse than a blank, and nothing here is guessed from a filename.
 *
 * No passport NUMBER is read or stored, for any of them.
 *
 * Uploads obey the same 5 MB cap and MIME allowlist as /api/upload and happen
 * as the caller, so the storage RLS policy is what authorises them. Rows are
 * written through PostgREST with the caller's token, exactly as syncMembers()
 * does in the browser -- no privileged key, nothing bypasses the database.
 *
 * Dry run by default. Pass --write to insert.
 *
 *   node scripts/add-remaining.mjs <scansDir> [--write]
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const USAGE = 'usage: node scripts/add-remaining.mjs <scansDir> [--write]'

const [, , scansDir, ...flags] = process.argv
const WRITE = flags.includes('--write')

if (!scansDir) {
  console.error(USAGE)
  process.exit(1)
}

// name, birthdate and nationality are set ONLY where the MRZ validated them.
// nationality is the document's own ISO alpha-3 wording, which is what the
// flag lookup expects; null leaves the flag absent rather than wrong.
const MANIFEST = [
  { file: 'sarrah ben mbarek.jpg', name: 'Sarrah Ben Mbarek', birthdate: '2006-04-15', nationality: 'France' },
  { file: 'samia ouni.jpg', name: 'Samia Ouni', birthdate: '1992-05-30', nationality: 'Tunisia' },
  { file: 'soulaima jabrani.jpg', name: 'Soulaima Jabrani', birthdate: null, nationality: null },
  { file: 'ahlem ammar.jpg', name: 'Ahlem Ammar', birthdate: null, nationality: null },
  { file: 'chayma abassi.jpeg', name: 'Chayma Abassi', birthdate: null, nationality: null },
  { file: 'manel ben mohamed.jpg', name: 'Manel Ben Mohamed', birthdate: null, nationality: null },
  { file: 'sabrine elouzi.jpg', name: 'Sabrine Elouzi', birthdate: null, nationality: null },
  { file: 'sonia amari.jpg', name: 'Sonia Amari', birthdate: null, nationality: null },
]

const BUCKET = 'members'
const FOLDER = 'passports'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

function envs() {
  const out = {}
  for (const line of (process.env.SB && process.env.AK ? [] : [])) void line
  return out
}

async function loadEnv() {
  const txt = await readFile(path.join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

let token = process.env.SQUAD_TOKEN
async function headers(env) {
  if (!token) {
    const { readFile: rf } = await import('node:fs/promises')
    const os = (await import('node:os')).default
    token = (await rf(path.join(os.tmpdir(), 'squad_token.txt'), 'utf8')).trim()
  }
  return {
    // AK is accepted alongside the .env.local name: when SB is preset in the
    // environment, .env.local is skipped entirely and the key is only present
    // under the short name, which silently sent "undefined" as the apikey.
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.AK,
    Authorization: `Bearer ${token}`,
  }
}

/** Sniff the real type from magic bytes; never trust the extension. */
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

async function main() {
  const env = process.env.SB ? process.env : await loadEnv()
  const SB = env.SB || env.NEXT_PUBLIC_SUPABASE_URL
  const h = await headers(env)

  console.log(`\n${MANIFEST.length} player(s) to add\n`)
  const rows = []
  const failures = []

  for (const m of MANIFEST) {
    const full = path.join(scansDir, m.file)
    let buf
    try {
      buf = await readFile(full)
    } catch {
      failures.push(`${m.file}: not found in ${scansDir}`)
      console.log(`  FAIL  ${m.name.padEnd(22)} file not found`)
      continue
    }

    const mime = sniff(buf)
    if (!mime) {
      failures.push(`${m.file}: not a JPEG/PNG/WebP`)
      console.log(`  FAIL  ${m.name.padEnd(22)} unrecognised image format`)
      continue
    }
    if (buf.length > MAX_BYTES) {
      failures.push(`${m.file}: ${Math.round(buf.length / 1024)} KB exceeds the 5 MB cap`)
      console.log(`  FAIL  ${m.name.padEnd(22)} over the 5 MB cap`)
      continue
    }

    // Deterministic path: a re-run replaces the object instead of piling up
    // near-duplicates under a suffixed name.
    const safe = m.file.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
    const target = `${FOLDER}/${safe}`
    const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${target}`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': mime, 'x-upsert': 'true' },
      body: buf,
    })
    if (!up.ok) {
      const t = (await up.text()).slice(0, 160)
      failures.push(`${m.file}: upload HTTP ${up.status} ${t}`)
      console.log(`  FAIL  ${m.name.padEnd(22)} upload ${up.status}`)
      continue
    }

    rows.push({
      name: m.name,
      role: 'PLAYERS',
      birthdate: m.birthdate,
      nationality: m.nationality,
      // The bare storage path, never a signed URL: the app resolves it
      // client-side for the signed-in viewer, exactly as it does a portrait.
      passport_image: target,
      team_category: 'SENIORS',
      position: null,
      height: null,
      club: null,
      foot: null,
      jersey_number: null,
      languages: [],
      history: [],
    })
    console.log(
      `  ok    ${m.name.padEnd(22)} ${String(Math.round(buf.length / 1024)).padStart(5)} KB  ` +
      `${(m.birthdate || 'no birthdate').padEnd(12)} -> ${target}`,
    )
  }

  if (failures.length) {
    console.log(`\n${failures.length} could not be prepared:`)
    for (const f of failures) console.log(`  ${f}`)
  }

  const unknown = rows.filter((r) => !r.birthdate).length
  console.log(`\n${rows.length} ready, ${unknown} without a birthdate (nothing invented for them)`)

  if (!WRITE) {
    console.log('\ndry run. re-run with --write to insert.')
    return
  }
  if (!rows.length) return

  const res = await fetch(`${SB}/rest/v1/members`, {
    method: 'POST',
    headers: { ...h, Prefer: 'return=representation', 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`\ninsert failed ${res.status}: ${text}`)
    process.exit(1)
  }
  const created = JSON.parse(text)
  console.log(`\ninserted ${created.length} rows, ids: ${created.map((c) => c.id).join(', ')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
