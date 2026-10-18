-- ============================================================
-- 0016  DEFINE public.is_admin()
--
--   Migrations 0012, 0014 and 0015 write policies that call
--   public.is_admin(). Nothing in the migrations directory ever
--   defined it, so those policies fail to create on any database
--   built by applying migrations alone (it only resolves on a
--   project where supabase-setup.sql was run by hand).
--
--   This migration defines it as an alias of current_active_admin(),
--   which is the helper the rest of the schema already uses:
--   "the signed-in user is an admin AND their account is active".
--   SECURITY DEFINER is what stops it recursing through RLS while
--   reading profiles.
--
-- Depends on nothing. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_active_admin();
$$;

-- current_active_admin() is defined in supabase-setup.sql but not in any
-- migration, so a database built from migrations alone has neither it nor
-- is_admin(). Define it too rather than leaving is_admin() pointing at a
-- missing function. Body copied verbatim from supabase-setup.sql.
CREATE OR REPLACE FUNCTION public.current_active_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT role FROM profiles WHERE id = auth.uid()),'') = 'admin'
     AND coalesce((SELECT status FROM profiles WHERE id = auth.uid()),'') = 'active';
$$;

-- The other helpers the league policies call, defined for the same reason.
-- current_active_admin() is already in supabase-setup.sql; the two below are the
-- definitions from 0012, repeated verbatim so a migration-only database matches
-- one that also ran the setup file. Note the role = 'club' test on
-- my_league_team_id: it is what stops a non-club profile from reading league rows.
CREATE OR REPLACE FUNCTION public.my_league_team_id()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT league_team_id FROM profiles
  WHERE id = auth.uid() AND role = 'club' AND status = 'active';
$$;

-- ── Verification ────────────────────────────────────────────────────────────
-- Run after applying this migration. Every function must report exists = true;
-- is_admin() must return true only for an admin session and false for a signed-out
-- caller (the value below is what a signed-out caller should get).
--
-- SELECT proname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('is_admin','current_active_admin','my_league_team_id');
--
-- SELECT public.is_admin();   -- signed out => false
