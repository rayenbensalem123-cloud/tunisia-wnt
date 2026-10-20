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
| `0014_camp_stay_fields.sql` | Yes — `ADD COLUMN IF NOT EXISTS` only. Adds the camp stay fields (country, state, hotel, arrival/departure). Renamed from `0013_camp_stay_fields.sql`, which collided with the table below. |
| `0015_league_fixtures.sql` | Yes — `IF NOT EXISTS` / `OR REPLACE` / `DROP … IF EXISTS`. Adds Ligue Féminine seasons and fixtures (admin writes, club accounts read-only). Needs 0012 first. Renamed from `0014_league_fixtures.sql`. |
| `0016_league_cup_calendar.sql` | Yes — `IF NOT EXISTS` / `DROP … IF EXISTS`. Adds the Ligue Féminine cup (name, info, knockout matches) and season breaks for the calendar (admin writes, club accounts read-only). Needs 0012 and 0015 first. Renamed from `0015_league_cup_calendar.sql`. |
| `0017_define_rls_helpers.sql` | Yes — `CREATE OR REPLACE FUNCTION` only. Defines the four RLS helpers that policies call but no migration creates (see below). Safe to apply to a live database that already ran `supabase-setup.sql`. |
| `0018_league_player_stats.sql` | Yes — `IF NOT EXISTS` / `OR REPLACE` / `DROP … IF EXISTS`. Adds per-season player statistics (appearances, goals, assists, cards) and the `league_top_players` read used by the scorers' tables. Needs 0012 and 0015 first. |
| `0019_league_touch_search_path.sql` | Yes. Pins the `search_path` of `league_fixtures_touch()` (security checker warning). Needs 0015 first. |
| `0020_league_match_sheet.sql` | Yes — `IF NOT EXISTS` / `OR REPLACE` / `DROP … IF EXISTS`. Adds match lineups and match events (goals, assists, cards) and keeps `league_player_stats` in step with them. Admin writes, club accounts read-only. Needs 0015 and 0018 first. |
| `0021_league_sheet_source_of_truth.sql` | Yes, except the deletion in section 5, which only fires while no sheet exists. Rewrites the recount so it counts played matches only and removes a player's row when her sheet entries are gone, recounts on a change of match status, and raises `league_top_players` from 50 to 500 rows. Needs 0020 first. |
| `0022_league_recount_grants.sql` | Yes — `REVOKE` / `GRANT` only. Closes `league_recount_player` and `league_recount_season` to anonymous callers: 0021 made them `SECURITY DEFINER` and PostgreSQL grants `EXECUTE` on a new function to `PUBLIC`, so a logged-out visitor could reach a write path that runs over row level security. Needs 0021 first. |
| `0023_league_changes_notifications_squads.sql` | Yes — `IF NOT EXISTS` / `OR REPLACE` / `DROP … IF EXISTS`. Adds the match change history (with an optional reason), club notifications and matchday squads. A club reads only its own notifications and squad. Needs 0015 and 0020 first. |

### RLS helpers and the setup file

`0002`, `0009`, `0010`, `0012`, `0015` and `0016` write policies calling
`public.has_permission()`, `public.is_admin()`, `public.current_active_admin()` and
`public.my_league_team_id()`. Those helpers were only ever defined in
`../supabase-setup.sql`, which is applied by hand rather than by `db:migrate`.

This matters because Postgres resolves a function call inside `CREATE POLICY` when the
policy is created. A missing helper means the statement errors and **the table ends up
with no policy at all**. Under `db:migrate` that is loud — the transaction rolls back
and the run stops. Applied by hand in the SQL editor it is easy to miss, which is how
a league table can end up with no access rule and nobody notices until someone reports
it.

`0017` adds all four definitions, copied verbatim from `supabase-setup.sql` and `0012`,
so the migrations are self-contained and re-running it changes nothing on a database
that already ran the setup file.

Check it at any time:

```bash
node scripts/check-rls-helpers.mjs          # static: defined by the migrations?
node scripts/check-rls-helpers-live.mjs     # live: present on the real project?
```

The first parses every migration, collects the `public.<fn>()` calls made in an RLS
position and reports any that no migration defines. It exits non-zero while the gap
exists, so it works as a pre-commit or CI guard.

The second asks the live Supabase project instead. PostgREST exposes the public
schema's functions as RPC endpoints, so a function that does not exist answers `404`
while one that does answers normally — which makes existence checkable without a
direct postgres connection. It reads `.env.local` itself and prints only status codes,
never a secret. It probes a deliberately bogus function name first as a control, and
refuses to report if that control does not `404`, so a false green is not possible.

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
