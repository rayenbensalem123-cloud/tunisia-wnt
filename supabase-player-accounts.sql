-- ============================================================
-- TUNISIA WNT — PLAYER ACCOUNTS  (see only your own card)
--
-- Run this in Supabase Dashboard > SQL Editor > New query, AFTER
-- supabase-setup.sql. Safe to re-run.
--
-- What it does:
--   1. links an account to its own player card (profiles.member_id)
--   2. lets an ADMIN set that link (and nobody else)
--   3. makes a 'player' account read exactly ONE members row: its own
--   4. lets a player read its own medical record, nobody else's
--   5. stops a signed-in player from reading squad_public (the whole roster)
--
-- Admin/staff accounts are unaffected: they still see everything.
-- ============================================================

-- ------------------------------------------------------------
-- 1. THE LINK: profiles.member_id -> members.id
-- ------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_id bigint;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_member_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_member_id_fkey
      FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE SET NULL;
  END IF;
END $fk$;

CREATE INDEX IF NOT EXISTS profiles_member_id_idx ON public.profiles(member_id);

-- ------------------------------------------------------------
-- 2. HELPERS
-- ------------------------------------------------------------
-- The caller's own card id, but ONLY for a 'player' account.
-- Staff and admins get NULL here, because they use has_permission()
-- instead — this function is the "you may see one row" path.
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN coalesce((SELECT role FROM profiles WHERE id = auth.uid()), '') <> 'player'
             THEN NULL
           ELSE (SELECT member_id FROM profiles WHERE id = auth.uid())
         END;
$$;

-- Is the caller an active staff/admin account (i.e. sees the whole squad)?
CREATE OR REPLACE FUNCTION public.is_staff_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT role IN ('admin','staff') AND status = 'active'
    FROM profiles WHERE id = auth.uid()
  ), false);
$$;

-- ------------------------------------------------------------
-- 3. ONLY AN ADMIN MAY MOVE THE LINK
-- Without this, a player could point their own account at any
-- member id and read that card instead of their own.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_active_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.member_id IS DISTINCT FROM OLD.member_id THEN
    RAISE EXCEPTION 'Only an active admin can change role, status, permissions, username or linked player'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 4. RLS: A PLAYER READS EXACTLY ITS OWN ROW
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "members_select_active" ON public.members;
CREATE POLICY "members_select_active" ON public.members
  FOR SELECT USING (
    public.current_active_user()
    AND ( public.is_staff_account() OR id = public.current_member_id() )
  );

-- A player sees its own injuries; nothing else. Staff keep the flag.
DROP POLICY IF EXISTS "injuries_select_active" ON public.injuries;
CREATE POLICY "injuries_select_active" ON public.injuries
  FOR SELECT USING (
    public.has_permission('viewMedical')
    OR member_id = public.current_member_id()
  );

-- A player has no write flags, so every write policy already refuses it.
-- This makes the intent explicit rather than implied.
DROP POLICY IF EXISTS "matches_select_active" ON public.matches;
CREATE POLICY "matches_select_active" ON public.matches
  FOR SELECT USING (public.is_staff_account());

-- ------------------------------------------------------------
-- 5. CLOSE squad_public TO SIGNED-IN USERS
-- squad_public deliberately reads as its owner, so the table's RLS
-- is NOT re-applied through it. Granting it to `authenticated` would
-- hand every logged-in player the entire roster, defeating section 4.
-- The public page still reads it with the anon key, which is fine.
-- ------------------------------------------------------------
REVOKE ALL ON public.squad_public FROM authenticated;
GRANT SELECT ON public.squad_public TO anon;

-- ------------------------------------------------------------
-- 6. LINK EXISTING PLAYER ACCOUNTS
-- One-off helper: point unlinked 'player' accounts at a card by matching
-- the username against the member's name (case/space insensitive).
-- Review the SELECT before running the UPDATE.
-- ------------------------------------------------------------
-- SELECT p.username, p.member_id, m.id AS matched_member, m.name
-- FROM public.profiles p
-- LEFT JOIN public.members m
--   ON lower(regexp_replace(m.name, '\s+', '', 'g'))
--    = lower(regexp_replace(p.username, '[^a-zA-Z0-9]', '', 'g'))
-- WHERE p.role = 'player' AND p.member_id IS NULL;

-- ------------------------------------------------------------
-- AFTER THIS: sign in as admin, open Menu > Manage Users, and set
-- "Linked card" on each player account.
-- ============================================================