# Migrations

`supabase-setup.sql` (at the repo root) is the baseline schema — it's assumed
already applied to the live database and isn't tracked here. Everything in
this directory is an incremental fix or feature SQL file applied *after*
that baseline, in order.

## Convention

- Files are numbered `NNNN_description.sql`, zero-padded to 4 digits,
  applied in ascending numeric order.
- The number only encodes apply order; it does not need to match any other
  numbering scheme. Leave gaps-free and append the next integer when adding
  a new migration.
- Each file is meant to be **idempotent** — safe to run again against a
  database that already has it applied — because for years this repo's only
  source of truth for "did someone actually run this against prod" was
  tribal memory. `pnpm db:migrate` now tracks this properly (see below), but
  a migration should still tolerate being re-run by hand in the SQL editor,
  since that's how most of these were really applied historically.
- New migrations should prefer `create table if not exists`,
  `add column if not exists`, `create index if not exists`, and
  `create or replace function`. Plain `create policy` / `create trigger`
  have no `if not exists` form in Postgres, so either guard them with a
  `drop policy if exists` / `drop trigger if exists` immediately before, or
  wrap the statement in a `do $$ begin ... exception when duplicate_object
  then null; end $$;` block.

## Current files

| File | Idempotent / safe to re-run? |
| --- | --- |
| `0001_games.sql` | Yes — says so in its header; uses `if not exists` throughout. |
| `0002_player_accounts.sql` | Yes — says so in its header; uses `if not exists` / `create or replace` throughout. |
| `0003_activity_log_triggers.sql` | Yes — says so in its header ("every statement below is idempotent"). |
| `0004_meetings.sql` | **No**, despite the general convention. It has no re-run note, and its `create policy ...` / `create trigger ...` statements have no `if not exists` guard — running it twice fails with "policy/trigger already exists". Drop the four policies and the trigger first if you need to re-apply it. |
| `0005_password_reset.sql` | Yes in practice — no explicit header claim, but every statement is `... if not exists`. |
| `0006_club_reports_v2.sql` | Mostly, but **not fully**: the `alter table ... add column if not exists` and `create or replace function` lines are safe, but the trailing `create trigger trg_guard_club_report_verification ...` has no guard and fails on a second run. Drop that trigger first if re-applying. |
| `0007_celebration_photo.sql` | Yes — says so in its header; `add column if not exists`. |
| `0008_camp_reports.sql` | Yes in practice (single `add column if not exists`), though it has no explicit header note. |
| `0009_camps_storage_permission_fix.sql` | Yes — says so in its header ("each policy is dropped and recreated"). |
| `0010_travel_and_documents.sql` | Yes — tables are `IF NOT EXISTS`; functions, policies and triggers are dropped/replaced. |
| `0011_activity_log_new_entities.sql` | Yes — drops and recreates the constraint. |
| `0012_ligue_feminine.sql` | Yes — all `IF NOT EXISTS` / `OR REPLACE` / `DROP … IF EXISTS`. Changes live access rules (members read policy, `is_active_user`), so run it deliberately. |
| `0013_close_public_reads.sql` | Yes — `REVOKE` and `DROP POLICY IF EXISTS`. Removes anonymous read access to the roster view and five unused tables. |

If you add a migration whose statements genuinely can't be made re-run-safe
(e.g. a one-off data backfill), say so loudly in its header instead of
silently breaking the "safe to re-run" convention — `db:migrate` skips a
file entirely once it's recorded as applied, so a non-idempotent file is
only ever run once from the script's point of view, but a human re-running
it by hand (e.g. in the SQL editor) should still be warned.

## Applying migrations

`pnpm db:migrate` (see `scripts/db-migrate.mjs`) is the supported way to
apply these. It:

1. Connects once to `DATABASE_URL` (same env var as the old `db:apply`).
2. Ensures a `_migrations_applied` tracking table exists:
   ```sql
   create table if not exists public._migrations_applied (
     filename   text primary key,
     applied_at timestamptz not null default now()
   );
   ```
3. Applies `supabase-setup.sql` first, recording it in the same tracking
   table under the filename `supabase-setup.sql` (skipped if already
   recorded) — so the baseline and every migration share one source of
   truth for "has this actually been run against this database".
4. Walks every `migrations/NNNN_*.sql` file in ascending numeric order,
   skipping any file already recorded in `_migrations_applied`, and for
   each new one: runs it, then records it.

This does **not** run automatically (no CI/CD hook, no `postinstall`). It's
a deliberate, reviewed step a human runs by hand with real credentials in
`.env.local`, same as the old `db:apply` — the point of this mechanism is
making "has this been applied" *answerable*, not adding unreviewed
automation that touches a live database on its own.

The previous `db:apply` script (`scripts/apply-sql.mjs`, applying only
`supabase-setup.sql` plus an anon-key RLS sanity check) still exists and
still works unchanged — `pnpm db:apply` runs it. `pnpm db:migrate` is the
new, broader command that also walks `migrations/`.
