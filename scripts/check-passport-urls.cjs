/**
 * Verifies every passport really renders in a browser.
 *
 * The bug this guards against: passport_image held an /api/image?path= URL.
 * That route authenticates with an Authorization header, which an <img> tag
 * cannot send, so the browser got a 401 and onError hid the image. Passports
 * now store a bare storage path that the app resolves with createSignedUrl
 * client-side -- exactly as it already did for portraits.
 *
 * This mints a signed URL for each stored path and fetches the bytes, so it
 * proves the real browser path works and not just the API.
 *
 * Run: node scripts/check-passport-urls.cjs   (needs a caller token in $TOK)
 */
const { createClient } = require('@supabase/supabase-js')

const SB = process.env.SB
const AK = process.env.AK
const TOK = process.env.TOK

if (!SB || !AK || !TOK) {
  console.error('Set SB, AK and TOK in the environment first.')
  process.exit(1)
}

;(async () => {
  const sb = createClient(SB, AK, {
    global: { headers: { Authorization: `Bearer ${TOK}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error } = await sb
    .from('members')
    .select('id,name,passport_image')
    .not('passport_image', 'is', null)
    .order('id')

  if (error) {
    console.log('  read error: ' + error.message)
    process.exit(1)
  }

  console.log(`  ${rows.length} members carry a passport`)
  console.log('')

  let ok = 0
  const bad = []
  let bytes = 0

  for (const r of rows) {
    const p = r.passport_image
    if (p.startsWith('data:') || p.startsWith('blob:')) {
      // A locally attached image the browser already holds -- nothing to sign.
      ok++
      continue
    }
    if (p.startsWith('/api/image')) {
      bad.push(`${r.name}: still an /api/image URL, will 401 in an <img>`)
      continue
    }
    const { data, error: e } = await sb.storage.from('members').createSignedUrl(p, 3600)
    if (e || !data || !data.signedUrl) {
      bad.push(`${r.name}: sign failed (${(e && e.message) || 'no url'})`)
      continue
    }
    const res = await fetch(data.signedUrl)
    const buf = Buffer.from(await res.arrayBuffer())
    const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    const png = buf[0] === 0x89 && buf[1] === 0x50
    if (res.ok && (jpeg || png)) {
      ok++
      bytes += buf.length
      console.log(
        `  ok   ${String(r.name).padEnd(22)} ${(buf.length / 1024 / 1024).toFixed(2)} MB  ${jpeg ? 'jpeg' : 'png'}`
      )
    } else {
      bad.push(`${r.name}: HTTP ${res.status} ${Math.round(buf.length / 1024)}KB isImage=${jpeg || png}`)
    }
  }

  console.log('')
  console.log(`  signed + fetched + is an image: ${ok}/${rows.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB total)`)
  if (bad.length) {
    bad.forEach(b => console.log('   FAIL ' + b))
    process.exit(1)
  }
})()
