# Data Privacy & Access Policy

This document describes who can see what in the Elite Squad Manager, and how
that access is enforced. It reflects the access rules as they actually run in
production (checked against the live database policies on 2026-10-06), not
just what the interface shows — every rule below is enforced by Postgres Row
Level Security (RLS) or, for passport documents, by the API route that signs
image URLs. Hiding a button in the app is never the only protection; a user
who is not allowed to see something cannot fetch it even by calling the
database or API directly.

## Accounts and roles

Every login is a row in `profiles` with a `role` and a `permissions` object:

- **admin** — full access to everything described below.
- **staff** — access is controlled per-feature by individual permission
  flags (see "Permission flags" below). A staff account has none of these
  by default; an admin grants them individually.
- **player** — a read-mostly account linked to exactly one roster row via
  `profiles.member_id`. A player can see the full squad roster, but their
  own medical history, passport document, and ability to submit club-match
  reports are scoped to their own linked row only, never a teammate's.

Only an active admin can change a `role`, `permissions`, or `member_id` —
this is enforced by a database trigger (`guard_profile_privileges`), not
just the UI, so it can't be bypassed by calling the API directly.

## What's private, and who can see it

| Data | Who can see it | How it's enforced |
|---|---|---|
| **Basic roster info** (name, position, caps, club, etc.) | Any signed-in, active account | RLS on `members` |
| **Medical history / injuries** | Admins; staff with the `viewMedical` permission; a player, their own record only | RLS on `injuries` (`has_permission('viewMedical') OR member_id = current_member_id()`) |
| **Passport / ID document scans** | Admins; staff with `viewMedical`; a player, their own document only | Enforced twice: storage-bucket RLS, *and* the `/api/image` route, which checks the caller's role/permissions/`member_id` before it will sign a URL for that specific file — a leaked file path alone isn't enough to read it |
| **Club match self-reports** (minutes/goals/assists a player logs for their own club matches) | Admins; staff with `viewClubReports`, `addPlayer` or `editPlayer`; a player, their own reports only | RLS on `club_match_reports` |
| **Passport expiry dates** | Admins; staff with `manageTravel` or `viewMedical`; a player, her own date only | RLS on `member_documents` (kept out of `members`, which every signed-in account can read) |
| **Trip plans** (flights, hotel) | Every admin/staff account; a player only for camps and matches she is called up to | RLS on `trip_plans` via `can_see_trip()` |
| **Per-person trip details** (visa, ticket, room) | Admins; staff with `manageTravel`; the person herself | RLS on `trip_members` |
| **Ligue Féminine** (club teams and their players) | Admins see every club. A club account sees only its own team and its own players, and can add and edit them (not delete). Nobody else, including staff and national-team players, sees Ligue data; it is also left out of the public roster view | RLS on `league_teams` and `members` (`my_league_team_id()`); club accounts count as *not* an "active user" everywhere else, so they read none of the national-team data; storage policy limits a club to `league/<its team id>/` |
| **Ligue Féminine match sheets** (who played, goals, assists and cards, with the player's name copied in) | Admins read and write. Club accounts read the whole league's sheets, read-only. Nobody else, and no anonymous access | RLS on `league_match_lineup` / `league_match_events`; names are stored on the row so clubs never need to read another club's `members` rows |
| **Ligue Féminine fixtures, standings, cup and calendar** (seasons, matchdays, scores, cup matches, breaks; no personal data) | Admins read and write. Club accounts read the whole league's fixtures, read-only. Nobody else, and no anonymous access | RLS on `league_seasons` / `league_fixtures` / `league_cup_matches` / `league_breaks` (admin write, `my_league_team_id()` read); club names for opponents come from `league_club_directory()` which exposes only id, name and logo |
| **Account management** (approving accounts, resetting passwords, changing permissions, linking accounts to roster rows) | Admins only | RLS on `profiles` (`current_active_admin()`); the privilege-guard trigger above |
| **Activity log** (who changed what, when) | Admins only | Same table relationships as above; written automatically by database triggers on every write to members, matches, injuries, profiles, squad templates, club match reports, and camps |

## Permission flags (staff accounts)

An admin can grant any combination of these to a staff account:

`addPlayer`, `editPlayer`, `deletePlayer`, `addMatch`, `deleteMatch`,
`exportData`, `viewMedical`, `editMedical`, `addCamps`, `viewClubReports`,
`manageMeetings`, `manageTravel` (passport expiry dates and trip logistics: edit only)

None of these are granted by default — a new staff account starts with no
access to sensitive data until an admin deliberately turns a flag on.

## Data export

Any account with `exportData` (or an admin) can export the roster, matches,
and camps as CSV or a full JSON backup. Medical records and club-match
reports are included in that export only if the account can already see
that data under the rules above — exporting never reveals more than the
account could already see on screen.

## CV import (AI)

"Fill from CV" on the player/staff card sends the uploaded CV (PDF or image) to
Anthropic's API to read it. The file is not stored by this app, and nothing is
saved until a person reviews the filled card and presses save. Only accounts
that can add or edit players can use it. Leave `ANTHROPIC_API_KEY` unset to
turn the feature off.

## For admins day to day

- **Granting `viewMedical` to a staff account is a real decision, not a
  convenience toggle** — combined with roster access, it effectively gives
  that account every player's injury history and passport document. Grant it
  only to people who actually need it (team doctor, physio, senior staff),
  and review who holds it periodically.
- **Removing a player or staff member from the roster does not auto-delete
  their historical records or files** — injuries, match history, and
  documents persist for the team's own record-keeping unless an admin
  deletes them explicitly. If the federation needs a formal data-retention
  or right-to-erasure process (e.g. a departed player asking for her data
  removed), that's a decision for admins to make and carry out by hand —
  the app doesn't automate it. (Any signed-in person can already download their
  own data as a JSON file from the account menu — "Download my data" — which
  only ever contains rows they are allowed to see.)

## What this intentionally does not cover

- **FIFA Connect ID** is stored as a roster field like any other; it carries
  no extra protection beyond the basic-roster-info row above.
- **Real player data accuracy**: some players' position/club/jersey-number
  fields are intentionally left blank rather than filled with placeholder
  data, pending the federation's own records.
- This document does not cover Vercel/Supabase infrastructure security
  (hosting provider access, backups, encryption at rest) — that's governed
  by Vercel's and Supabase's own security practices, not this app's code.
