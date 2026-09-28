/**
 * Applies supabase-setup.sql to the Supabase project and then verifies the
 * security posture with the PUBLIC anon key.
 *
 * Requires DATABASE_URL in .env.local, e.g.
 *   DATABASE_URL=postgresql://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
 *
 * Usage: node scripts/apply-sql.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Load .env.local
const envFile = resolve(root, '.env.local')
const env = {}
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add it to .env.local (see README).')
  process.exit(1)
}

const sql = readFileSync(resolve(root, 'supabase-setup.sql'), 'utf8')

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('→ connected')
  await client.query(sql)
  console.log('→ supabase-setup.sql applied')
} catch (e) {
  console.error('→ FAILED:', e.message)
  await client.end().catch(() => {})
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}

// ---- verify with the PUBLIC anon key (what an attacker has) ----
if (SUPABASE_URL && ANON_KEY) {
  console.log('\n--- verifying with the public anon key ---')
  const rest = async (table, qs = '') => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    })
    if (!r.ok) return { status: r.status, rows: [] }
    const rows = await r.json()
    return { status: r.status, rows: Array.isArray(rows) ? rows : [] }
  }

  const checks = [
    ['members', 'select=id,name&limit=3', 'squad data'],
    ['matches', 'select=id,opponent&limit=3', 'match data'],
    ['profiles', 'select=id,username,role&limit=3', 'roles'],
  ]
  let leaks = 0
  for (const [table, qs, label] of checks) {
    const { status, rows } = await rest(table, qs)
    if (rows.length > 0) {
      console.log(`  ✗ ${table} (${label}) LEAKS ${rows.length} row(s) to anon`)
      leaks++
    } else {
      console.log(`  ✓ ${table} (${label}) blocked for anon [HTTP ${status}]`)
    }
  }

  const bucket = await fetch(`${SUPABASE_URL}/storage/v1/bucket/members`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  })
  console.log(`  ${bucket.ok ? '✗' : '✓'} members bucket not publicly readable [HTTP ${bucket.status}]`)

  console.log(leaks ? '\nRESULT: still leaking' : '\nRESULT: anon access closed')
} else {
  console.log('\n(anon verification skipped: missing Supabase URL/key)')
}
