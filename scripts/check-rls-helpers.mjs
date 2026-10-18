/**
 * Static check for a class of RLS bug that is invisible until a policy silently
 * fails to be created: a policy calling public.some_helper() when no migration
 * ever defines that function.
 *
 * Postgres resolves a function call inside CREATE POLICY at creation time. If the
 * function does not exist, the statement errors, the migration's transaction rolls
 * back, and db:migrate stops. When a migration is applied by hand in the Supabase
 * SQL editor instead, the failure is quieter: the editor reports it, but a
 * developer moving on leaves the table with NO policy at all.
 *
 * This walks every migrations/*.sql, collects the public.<fn>() calls used in RLS
 * positions (policies, triggers, CHECK constraints and grants), and compares them
 * against the functions the migrations actually create. Anything a policy needs
 * that only exists in supabase-setup.sql is reported, because that file is applied
 * by hand rather than by db:migrate.
 *
 * Usage: node scripts/check-rls-helpers.mjs
 * Exit code 1 if any helper is missing from the migrations.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = resolve(root, 'migrations')

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
const setupSql = readFileSync(resolve(root, 'supabase-setup.sql'), 'utf8')

const sql = { setup: setupSql }
for (const f of files) sql[f] = readFileSync(resolve(migrationsDir, f), 'utf8')

const DEFINED = /\bcreate\s+(or\s+replace\s+)?function\s+(public\.)?([a-z0-9_]+)\s*\(/gi

/** Functions the migrations create themselves. */
const definedInMigrations = new Set()
for (const [name, text] of Object.entries(sql)) {
  if (name === 'setup') continue
  for (const m of text.matchAll(DEFINED)) definedInMigrations.add(m[3].toLowerCase())
}
/** Functions that only the hand-applied baseline provides. */
const definedInSetup = new Set()
for (const m of setupSql.matchAll(DEFINED)) definedInSetup.add(m[3].toLowerCase())

// Helper calls that appear in an RLS decision. Restricted to the statements where
// an unresolvable name aborts the CREATE, rather than every public.* call.
const RLS_CONTEXT =
  /\b(create\s+policy|alter\s+table[\s\S]*?\b(enable|force)\s+row\s+level\s+security|revoke\s+all\s+on\s+function|grant\s+execute\s+on\s+function)([\s\S]*?);/gi

const CALL = /public\.([a-z0-9_]+)\s*\(/gi

/** fn -> Set of files that need it in an RLS position */
const needed = new Map()
for (const [name, text] of Object.entries(sql)) {
  if (name === 'setup') continue
  for (const stmt of text.matchAll(RLS_CONTEXT)) {
    for (const c of stmt[3].matchAll(CALL)) {
      const fn = c[1].toLowerCase()
      if (!needed.has(fn)) needed.set(fn, new Set())
      needed.get(fn).add(name)
    }
  }
}

const missing = [...needed.entries()]
  .filter(([fn]) => !definedInMigrations.has(fn))
  .sort()

if (!missing.length) {
  console.log(`✓ Every RLS helper called by the migrations is defined by the migrations (${needed.size} checked).`)
  process.exit(0)
}

console.log(`✗ ${missing.length} RLS helper(s) called by policies but never defined in migrations/:\n`)
for (const [fn, usedBy] of missing) {
  const inSetup = definedInSetup.has(fn)
  console.log(`  public.${fn}()`)
  console.log(`    used by : ${[...usedBy].join(', ')}`)
  console.log(`    status  : ${inSetup ? 'defined only in supabase-setup.sql (applied by hand)' : 'NOT DEFINED ANYWHERE'}`)
  console.log('')
}
console.log('A policy whose helper is missing fails to be created. Apply the migration that')
console.log('defines it, then re-check. If it is only in supabase-setup.sql, add a migration so')
console.log('the schema is reproducible from migrations alone.')

process.exit(1)
