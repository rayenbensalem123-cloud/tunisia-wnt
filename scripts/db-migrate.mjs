/**
 * Applies supabase-setup.sql (the baseline) and every file in migrations/
 * (the numbered incremental fixes/features) to the Supabase project,
 * tracking what has already been applied in a `_migrations_applied` table
 * so this is safe to run repeatedly — only files not yet recorded there
 * actually get executed.
 *
 * This replaces the old apply-sql.mjs's "what has actually been applied to
 * prod?" blind spot: that script only ever applied supabase-setup.sql, and
 * nothing recorded whether any of the loose supabase-*.sql fix files in the
 * repo root had ever been run against the live database, which is exactly
 * how the live policy drifted from supabase-setup.sql in the first place.
 *
 * Requires DATABASE_URL in .env.local, e.g.
 *   DATABASE_URL=postgresql://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
 *
 * Usage: node scripts/db-migrate.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Load .env.local
const envFile = resolve(root, '.env.local')
const env = {}
try {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // .env.local is optional if DATABASE_URL is already in the environment
}

const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add it to .env.local (see README).')
  process.exit(1)
}

const migrationsDir = resolve(root, 'migrations')
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort() // numeric-prefix order, since they're zero-padded to the same width

// The baseline is applied through the same tracking table, under its own
// filename, so "has this been applied" has one answer for everything.
const filesToConsider = ['supabase-setup.sql', ...migrationFiles]

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('→ connected')

  await client.query(`
    create table if not exists public._migrations_applied (
      filename   text primary key,
      applied_at timestamptz not null default now()
    );
  `)

  const { rows: appliedRows } = await client.query('select filename from public._migrations_applied')
  const applied = new Set(appliedRows.map((r) => r.filename))

  let appliedCount = 0
  let skippedCount = 0

  for (const filename of filesToConsider) {
    if (applied.has(filename)) {
      console.log(`→ skip ${filename} (already applied)`)
      skippedCount++
      continue
    }

    const filePath = filename === 'supabase-setup.sql' ? resolve(root, filename) : resolve(migrationsDir, filename)
    const sql = readFileSync(filePath, 'utf8')

    console.log(`→ applying ${filename} ...`)
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into public._migrations_applied (filename) values ($1)', [filename])
      await client.query('commit')
      console.log(`  ✓ ${filename} applied`)
      appliedCount++
    } catch (e) {
      await client.query('rollback').catch(() => {})
      console.error(`  ✗ FAILED on ${filename}:`, e.message)
      console.error('    Stopping here — fix the error above and re-run; already-applied files were skipped above and will be skipped again.')
      process.exit(1)
    }
  }

  console.log(`\nDone. ${appliedCount} file(s) applied, ${skippedCount} already up to date.`)
} finally {
  await client.end().catch(() => {})
}
