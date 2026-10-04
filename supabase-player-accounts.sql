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
--   5. keeps a player out of matches, the activity log, and squad_public
--      (the whole roster)
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
  -- auth.uid() IS NULL means the statement did not arrive through PostgREST
  -- as an authenticated user: it is the SQL editor or a service-role call.
  -- That is a trusted context, and section 7 needs it to backfill member_id.
  -- This does not open the API, because an anonymous PostgREST write is
  -- already refused by RLS (no UPDATE policy grants anything to anon) before
  -- this trigger runs.
  IF public.current_active_admin() OR auth.uid() IS NULL THEN
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

-- The activity log records who changed what, across the WHOLE squad. It was
-- gated on current_active_user(), which is true for any active account, so a
-- 'player' could read every other user's changes through PostgREST even though
-- the UI only offers the log to admins. Staff only, both ways: a player makes
-- no changes, so they generate no entries either.
DROP POLICY IF EXISTS "activity_log_select_active" ON public.activity_log;
CREATE POLICY "activity_log_select_active" ON public.activity_log
  FOR SELECT USING (public.is_staff_account());

DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;
CREATE POLICY "activity_log_insert" ON public.activity_log
  FOR INSERT WITH CHECK (public.is_staff_account());

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
-- 6. AUTO-LINK ON REGISTRATION
-- A player picks "Player" on the sign-up form and types their first and
-- last name. That is all the information needed to find their card, so the
-- database does the matching itself: no admin click, and no way for a
-- client to point itself at someone else's card.
--
-- Runs on INSERT only. An account that already exists (or a link an admin
-- set by hand) is never touched.
-- ------------------------------------------------------------

-- "Béchir Abla" -> "bechirabla", so accents, spacing, punctuation and case
-- cannot stop a match. translate() folds the accents to ASCII first;
-- dropping non-letters instead would turn "Béchir" into "bchr" and never
-- match the plain "Bechir".
CREATE OR REPLACE FUNCTION public.norm_person_name(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(lower(coalesce(txt, '')),
      'àáâãäåèéêëìíîïòóôõöùúûüýÿçñ',
      'aaaaaaeeeeiiiiooooouuuuyycn'),
    '[^a-z]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.autolink_player_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keys text[];
  k    text;
  hits bigint[];
BEGIN
  -- Staff get no link: they see the whole squad by role, so a card would
  -- be meaningless. An existing link is left exactly as it is.
  IF NEW.role IS DISTINCT FROM 'player' OR NEW.member_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Prefer the real name; fall back to the username for people who sign up
  -- as e.g. "smarzouki".
  keys := ARRAY[
    public.norm_person_name(NEW.first_name || ' ' || NEW.last_name),
    public.norm_person_name(NEW.username)
  ];

  FOREACH k IN ARRAY keys LOOP
    CONTINUE WHEN k IS NULL OR k = '';
    SELECT array_agg(m.id) INTO hits
    FROM public.members m
    WHERE m.role = 'PLAYERS'
      AND public.norm_person_name(m.name) = k;
    -- Only link on a unique hit. Two players sharing a name (Salma
    -- Marzouki / Salma Zemzem) must NOT be guessed at, so those accounts
    -- stay unlinked and an admin picks from Manage Users.
    IF hits IS NOT NULL AND array_length(hits, 1) = 1 THEN
      NEW.member_id := hits[1];
      RETURN NEW;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Named so it sorts AFTER trg_guard_profile_insert: Postgres fires BEFORE
-- triggers in name order, and the insert guard is what normalises role and
-- status first.
DROP TRIGGER IF EXISTS trg_profile_autolink_player_card ON public.profiles;
CREATE TRIGGER trg_profile_autolink_player_card
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.autolink_player_card();

-- ------------------------------------------------------------
-- 7. LINK ACCOUNTS THAT ALREADY EXIST
-- Section 6 only fires on new sign-ups. This does the same matching for
-- accounts that were created before it existed.
--
-- It has to write member_id, which section 3 blocks for everyone but an
-- active admin. auth.uid() is NULL for a direct database/SQL-editor
-- session (and for a service-role call), which is what makes this run at
-- all: an anonymous PostgREST caller still cannot update profiles, because
-- RLS refuses the write before the trigger is ever reached.
-- ------------------------------------------------------------
UPDATE public.profiles p
SET member_id = m.id
FROM public.members m
WHERE p.role = 'player'
  AND p.member_id IS NULL
  AND m.role = 'PLAYERS'
  AND public.norm_person_name(m.name)
      = public.norm_person_name(p.first_name || ' ' || p.last_name)
  -- Same unique-only rule as the trigger. UPDATE ... FROM would otherwise pick
  -- an arbitrary row, silently linking two same-named players to one card.
  AND 1 = (SELECT count(*) FROM public.members m2
           WHERE m2.role = 'PLAYERS'
             AND public.norm_person_name(m2.name)
                 = public.norm_person_name(m.name));

-- Anyone the name match could not place, for an admin to set by hand:
--   SELECT p.username, p.first_name, p.last_name
--   FROM public.profiles p
--   WHERE p.role = 'player' AND p.member_id IS NULL
--   ORDER BY p.username;

-- ------------------------------------------------------------
-- AFTER THIS: new player accounts link themselves on sign-up. Anything
-- unmatched shows up in Manage Users under "Linked player card".
-- ============================================================