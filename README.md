# Tunisia WNT — Elite Squad Manager

Squad management portal for the Tunisia Women's National Team: players, staff,
match history, camps and staff-permission management. Built with Next.js
(App Router) + Supabase (Postgres, Auth, Storage).

## Stack

- **Next.js** (App Router) + React + TypeScript
- **Tailwind CSS** (v4) + shadcn/ui primitives
- **Supabase** — Postgres + RLS, Auth, Storage
- **pdfjs-dist** — server-side PDF parsing for the player import

## Getting started

```bash
pnpm install
cp .env.local.example .env.local   # add your Supabase keys
pnpm dev
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser anon key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — **never commit, never ship to the client** |
| `BLOB_READ_WRITE_TOKEN` | Legacy Vercel Blob token (optional) |

## Database setup

Run [`supabase-setup.sql`](./supabase-setup.sql) once in the Supabase SQL editor.
It creates the tables, enables RLS, installs the privilege-guard trigger, and
seeds demo data.

After registering your first account through the portal, promote it to admin:

```sql
UPDATE public.profiles SET role = 'admin', status = 'active' WHERE username = 'YOUR_USERNAME';
```

## Security model

Authorisation is enforced **in the database**, not in the UI:

- `trg_guard_profile_privileges` — a user may edit their own profile, but only an
  active admin can change `role`, `status`, `permissions` or `username`. This
  blocks privilege escalation via a direct API call with the public anon key.
- RLS policies gate `members`, `matches`, `injuries`, `squad_templates` and
  `activity_log` on `current_active_user()` and the `has_permission(...)` flags
  (`addPlayer`, `editPlayer`, `deletePlayer`, `addMatch`, `deleteMatch`).
- There is **no anon read access** to squad data.
- The `members` storage bucket is **private**; passports are served with
  expiring signed URLs.
- Every `/api/*` route that uses the service-role client requires a valid
  `Authorization: Bearer` token from an **active** account.

API routes: `upload` (5 MB, MIME allowlist), `import-players` (8 MB, 30-page
cap, `addPlayer` required), `image` (host allowlist, no open proxy),
`register` (rate-limited, always creates a `pending` account),
`admin-reset-password` (admin only).

## Scripts

```bash
pnpm dev     # dev server
pnpm build   # production build
pnpm start   # serve the production build
```
