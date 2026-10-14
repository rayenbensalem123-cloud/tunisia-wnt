# Admin data-privacy policy — Tunisia WNT Elite Squad Manager

Who can see medical records and passport scans, and how that data is stored
and secured. Written for federation admins who need to answer "who can see
this" and "where does it live" without reading the code — each claim below
points at the code or database policy that actually enforces it, so it stays
accurate as the app changes (if a linked file changes behavior, update this
doc in the same change).

## 1. What's covered

- **Medical records** — injury history, status, and notes (`injuries` table).
- **Passport scans** — image uploads stored under `passports/` in the
  `members` storage bucket.
- **Everything else** (squad roster, match data, camp reports, photos) is
  internal-team data visible to any active account, not personal/medical
  data, and isn't covered by this policy.

## 2. Who can see what

Access is controlled by a permission flag on each account's `profiles` row,
checked both in the UI and — for medical data and passports specifically —
enforced again at the database level, so a bug in the UI can't leak this
data on its own.

| Data | Who can view | Who can edit |
|---|---|---|
| Injury/medical records | Admins, and any account with the **View Medical** permission | Admins, and any account with the **Edit Medical** permission |
| A player's own passport scan | That player's own account only, plus anyone with **View Medical**, plus admins | Admins (uploaded via the camp/player-profile editor) |
| Any other player's passport scan | Nobody without **View Medical** or admin — not even other players | — |

**Players never see another player's medical records or passport by
default.** A staff account only sees medical data if an admin has explicitly
granted it the **View Medical** permission (Account management → permissions
on that user). Granting **Edit Medical** separately controls who can *change*
records, not just view them.

## 3. Where it's enforced

- **In the app**: `app/page.tsx` gates the medical/welfare UI on
  `viewMedical`/`editMedical`; a user without the flag never sees the menu
  item at all.
- **At the database**: Postgres Row-Level Security policies on the
  `injuries` table restrict reads/writes the same way, so the restriction
  holds even if a request bypasses the UI entirely.
- **For passport scans specifically**: scans aren't public files. The
  storage bucket they live in is private, and every scan is served through
  `/api/image`, which mints a short-lived signed URL (1 hour) only after
  checking, server-side: is the caller an admin, does the caller have
  **View Medical**, or is the caller the player the scan belongs to? Anyone
  else gets a 404, not a permission error — the app never reveals whether a
  given file exists to someone who isn't allowed to see it.

## 4. Storage and security basics

- All files (passports, player photos, camp reports, camp photos) live in
  one private Supabase Storage bucket, never a public one. Nothing is
  reachable by guessing a URL.
- Every API route that reads or writes this data requires a valid, signed-in
  session (a verified Supabase auth token) — there is no anonymous access
  path.
- Changes to medical records, roster entries, and a handful of other
  sensitive tables are automatically logged (actor, what changed, when) via
  database triggers — see `migrations/0003_activity_log_triggers.sql` — so
  if a dispute ever comes up about who changed or viewed a record, there's a
  trail for who changed what (view-only access isn't currently logged,
  changes are).
- Upload and data-export endpoints are rate-limited per account to reduce
  the damage a compromised login could do.

## 5. What admins should know day to day

- **Granting View Medical to a staff account is a real decision**, not a
  convenience toggle — it gives that account every player's injury history
  and (if also combined with roster access) effectively their passport
  scans too. Grant it only to people who actually need it (team doctor,
  physio, senior staff), and review who holds it periodically.
- **Exporting data** (via the **Export Data** permission) pulls from
  whatever the exporting account can already see — someone without View
  Medical cannot export medical data through this path either.
- **Removing a player or staff member** from the roster does not currently
  auto-delete their historical records or files — those persist for the
  team's own record-keeping (match history, past injuries) unless an admin
  deletes them explicitly. If the federation needs a formal data-retention
  or right-to-erasure policy (e.g. for a departed player who asks for her
  data removed), that's a process decision for admins to make, not something
  the app currently automates.

## 6. Questions this doc doesn't answer

This describes how the app enforces access *within the platform*. It does
not cover: who outside the platform (e.g. Supabase project owners, hosting
provider) can technically access the underlying database, physical device
security for staff accounts, or any legal/regulatory data-protection
obligations the federation may have (GDPR-style rules, Tunisian data
protection law, etc.) — those are organizational/legal questions, not
technical ones, and should be reviewed with whoever handles that for the
federation.
