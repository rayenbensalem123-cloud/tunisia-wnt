-- ============================================================
-- 0017  DEFINE THE RLS HELPERS THE MIGRATIONS CALL
--
--   Several migrations write RLS policies that call public.<helper>()
--   functions which were only ever defined in ../supabase-setup.sql
--   — a file that is applied by hand rather than by db:migrate.
--
--   Postgres resolves a function call inside CREATE POLICY at
--   creation time. When the helper is missing, the statement errors
--   and the table ends up with NO policy at all, which is a silent
--   hole rather than a loud failure. Under db:migrate it is loud
--   (the transaction rolls back and the run stops); applied by hand
--   in the SQL editor it is easy to miss.
--
--   This migration defines every helper a migration policy calls but
--   no migration creates. Verify with:
--     node scripts/check-rls-helpers.mjs
--
--   The bodies are copied verbatim from ../supabase-setup.sql and
--   0012, so re-running this on a database that already ran the
--   setup file changes nothing.
--
-- Depends on nothing. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- is_admin() — the signed-in user is an admin with an active account.
-- Used by 0012, 0015 and 0016 for "admin writes, club accounts read only".
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_active_admin();
$$;

-- current_active_admin() is the helper the rest of the schema already uses.
CREATE OR REPLACE FUNCTION public.current_active_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT role FROM profiles WHERE id = auth.uid()),'') = 'admin'
     AND coalesce((SELECT status FROM profiles WHERE id = auth.uid()),'') = 'active';
$$;

-- has_permission() — does the caller hold a named permission flag?
-- Admins pass for everything. Used by 0002, 0009 and 0010, so a missing
-- definition there leaves player/staff permissions unenforced.
CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT (role = 'admin')
       OR coalesce(permissions ->> perm, 'false') = 'true'
    FROM profiles
    WHERE id = auth.uid() AND status = 'active'
  ), false);
$$;

-- my_league_team_id() — the club team this account belongs to.
-- The role = 'club' test is load-bearing: it is what stops a staff or
-- player profile that happens to carry a league_team_id from reading
-- another club's rows.
CREATE OR REPLACE FUNCTION public.my_league_team_id()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT league_team_id FROM profiles
  WHERE id = auth.uid() AND role = 'club' AND status = 'active';
$$;

-- ── Verification ────────────────────────────────────────────────────────────
-- All four must report exists = true.
--
-- SELECT proname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('is_admin','current_active_admin','has_permission','my_league_team_id');
--
-- Signed out, every one of these must be false:
--   SELECT public.is_admin(), public.has_permission('addPlayer'),
--          public.my_league_team_id() IS NULL;
