// Which migrations are actually applied to the LIVE database?
//
// This exists because `0014_camp_stay_fields.sql` sat unapplied for weeks and
// broke saving a camp, with nothing to point at the cause: the app writes every
// camp column on every save, so one missing column rejects the whole write, and
// the only symptom was an alert quoting a raw Postgres message.
//
// No database connection is needed. PostgREST distinguishes the cases for us:
//
//   missing column  400 / 42703  "column X does not exist"
//   missing table   404 / PGRST205
//   not granted     401 / 403    the object EXISTS; `anon` simply has no grant
//
// That last one matters: the league tables are granted to `authenticated` only,
// so anonymous being refused is evidence the migration ran, not that it did not.
// Treating 401 as "missing" would report five false alarms for every league table.
//
// Run with:  node scripts/check-migrations-live.mjs
//
// Limitation, stated rather than hidden: PostgREST only exposes tables and
// columns, so a migration that defines functions and nothing else is invisible
// here. Those cannot be probed safely either — calling an RPC to test whether it
// exists can have side effects, and a missing argument makes PostgREST report
// "no such function", which is the same answer as a function that is absent.
// So such migrations are reported as "presumed missing" whenever an earlier one
// is missing, since migrations are applied in order.
import fs from 'node:fs'

const fromEnvFile = (k) => {
  try {
    const env = fs.readFileSync('.env.local', 'utf8')
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null
  } catch { return null }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fromEnvFile('NEXT_PUBLIC_SUPABASE_URL')
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fromEnvFile('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if (!url || !key) {
  console.log('· skipped: needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(0)
}

const auth = { apikey: key, Authorization: `Bearer ${key}` }

/** present | missing | unknown — never guess from the status code alone. */
const verdict = (status, body) => {
  if (status === 200 || status === 206) return 'present'
  if (status === 401 || status === 403) return 'present'         // exists, `anon` not granted
  if (/does not exist/.test(body)) return 'missing'              // 42703
  if (status === 404 || /PGRST205/.test(body)) return 'missing'   // table absent
  return `unknown(${status})`
}

const probeTable = async (t) => {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=0`, { headers: auth })
  return { body: (await r.text()).slice(0, 160), status: r.status }
}
const probeColumn = async (t, c) => {
  const r = await fetch(`${url}/rest/v1/${t}?select=${encodeURIComponent(c)}&limit=1`, { headers: auth })
  return { body: (await r.text()).slice(0, 160), status: r.status }
}

const files = fs.readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()
const problems = []
const functionOnly = []

for (const file of files) {
  const sql = fs.readFileSync(`migrations/${file}`, 'utf8')
  const tables = [...new Set(
    [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi)].map((m) => m[1]),
  )]
  const columns = [...sql.matchAll(
    /alter\s+table\s+(?:public\.)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi,
  )]

  const found = []
  for (const t of tables) {
    const { status, body } = await probeTable(t)
    const v = verdict(status, body)
    if (v !== 'present') found.push([`table ${t}`, v, `${status} ${body}`])
  }
  for (const [, t, c] of columns) {
    const { status, body } = await probeColumn(t, c)
    const v = verdict(status, body)
    if (v !== 'present') found.push([`${t}.${c}`, v, `${status} ${body}`])
  }

  if (found.length) {
    problems.push({ file, visible: true })
    console.log(`\n${file}`)
    for (const [what, v, why] of found) console.log(`  ${v.toUpperCase().padEnd(8)} ${what.padEnd(40)} ${why}`)
  } else if (!tables.length && !columns.length) {
    // Nothing PostgREST can see. Recorded so it can be reported if it turns out
    // to sit after a migration that is definitely missing.
    functionOnly.push(file)
  }
}

// A missing migration means everything scheduled after it is missing too: they
// are applied in order, and the later files assume the earlier ones.
const firstMissing = problems.length ? problems[0].file : null
const presumed = firstMissing ? functionOnly.filter((f) => f > firstMissing) : []

if (presumed.length) {
  console.log('\nCannot be checked directly (functions only), presumed missing:')
  for (const f of presumed) console.log(`  ${f}`)
  problems.push(...presumed.map((file) => ({ file, visible: false })))
}

if (problems.length) {
  console.log(`\n✗ ${problems.length} migration(s) not applied to this database:`)
  for (const p of problems) {
    console.log(`    migrations/${p.file}${p.visible ? '' : '   (presumed, run it in order)'}`)
  }
  console.log('\n  Paste them, in order, into the Supabase SQL editor. They are written to be safe to re-run.')
  process.exit(1)
}

console.log(`✓ Every migration (${files.length} files) is applied to the live database.`)
