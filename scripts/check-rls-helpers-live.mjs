/**
 * Live check: do the RLS helpers actually exist on the connected Supabase project?
 *
 * PostgREST exposes the public schema's functions as RPC endpoints, so calling a
 * function that does not exist answers 404, while one that does answers normally.
 * That makes it possible to confirm function existence against the real database
 * without a direct postgres connection, and without printing any secret: this
 * script reads .env.local itself and only prints status codes.
 *
 * A known-bogus function name is probed first as a control: if that does NOT 404,
 * the check is not measuring what we think and the other results mean nothing.
 *
 * Usage: node scripts/check-rls-helpers-live.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const base = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!base || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local')
  process.exit(2)
}

const PROBES = [
  { name: '__control_missing_fn_xyz', args: {}, note: 'control: must NOT exist' },
  { name: 'is_admin', args: {}, note: 'admin gate for the league policies' },
  { name: 'current_active_admin', args: {}, note: 'is_admin depends on this' },
  { name: 'has_permission', args: { perm: 'addPlayer' }, note: 'staff/player permission checks' },
  { name: 'my_league_team_id', args: {}, note: 'scopes a club account to its own rows' },
]

const call = async (name, args) => {
  const r = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  return { status: r.status, body: (await r.text()).slice(0, 120) }
}

let controlOk = false
const rows = []

for (const p of PROBES) {
  const { status, body } = await call(p.name, p.args)
  const exists = status !== 404
  if (p.name.startsWith('__control')) {
    controlOk = !exists
    rows.push({ fn: p.name, exists, status, note: p.note })
  } else {
    rows.push({ fn: p.name, exists, status, note: p.note, value: body })
  }
}

for (const r of rows) {
  const mark = r.exists ? 'present' : 'MISSING'
  console.log(`${mark.padEnd(8)} ${r.fn.padEnd(28)} HTTP ${String(r.status).padEnd(4)} ${r.value !== undefined ? `value=${r.value}` : ''}`)
}

if (!controlOk) {
  console.error('\nControl probe did not 404, so existence cannot be inferred here. Treat as inconclusive.')
  process.exit(2)
}

const missing = rows.filter((r) => !r.exists && !r.fn.startsWith('__control'))
if (missing.length) {
  console.error(`\n${missing.length} helper(s) missing on the live project: ${missing.map((r) => r.fn).join(', ')}`)
  console.error('Apply migrations/0017_define_rls_helpers.sql to create them.')
  process.exit(1)
}

console.log('\nAll RLS helpers are present on the live project.')
