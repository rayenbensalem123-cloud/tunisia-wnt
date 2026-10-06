-- Meetings feature (Zoom-backed): schedule a meeting, store the join link,
-- and later the recording link, so it stays rewatchable after the call ends.
-- Applied directly via the Supabase MCP on 2026-10-06 — this file documents
-- what's actually live, same convention as supabase-activity-log-triggers.sql.

create table if not exists public.meetings (
  id bigint generated always as identity primary key,
  title text not null,
  team_category text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled', -- 'scheduled' | 'recorded'
  zoom_meeting_id text,
  join_url text,
  start_url text,      -- host-only start link; never shown to non-managers in the UI
  recording_url text,  -- filled in once /api/zoom/recording finds a cloud recording
  created_by uuid references public.profiles(id) on delete set null,
  created_by_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings enable row level security;

-- Anyone active can see meetings exist and watch a recording once it's
-- attached — same visibility level as matches and camps.
create policy meetings_select_active on public.meetings
  for select using (current_active_user());

-- Scheduling/editing/deleting requires the manageMeetings permission (or admin).
-- Mirrors the addCamps / viewClubReports pattern: a flag an admin grants per staff account.
create policy meetings_insert_managers on public.meetings
  for insert with check (has_perm_or_admin('manageMeetings'));

create policy meetings_update_managers on public.meetings
  for update using (has_perm_or_admin('manageMeetings')) with check (has_perm_or_admin('manageMeetings'));

create policy meetings_delete_managers on public.meetings
  for delete using (has_perm_or_admin('manageMeetings'));

create trigger trg_log_meetings
  after insert or update or delete on public.meetings
  for each row execute function log_activity();

-- ─────────────────────────────────────────────
-- Required environment variables (set in Vercel → Project → Settings → Environment Variables)
-- ─────────────────────────────────────────────
-- ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
--
-- These come from a Zoom "Server-to-Server OAuth" app, created at
-- https://marketplace.zoom.us/ (Develop → Build App → Server-to-Server OAuth).
-- That app type is made for exactly this: a backend service creating meetings
-- and reading recordings on behalf of the Zoom account, no per-user Zoom login.
-- Grant it these scopes: meeting:write:admin, meeting:read:admin,
-- cloud_recording:read:admin (or the user-level equivalents if the Zoom
-- account only has one licensed user). Without these three env vars set,
-- /api/zoom/schedule and /api/zoom/recording return a clear "not configured"
-- error instead of failing silently.
