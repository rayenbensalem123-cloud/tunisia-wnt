-- ============================================================
-- 0024  PHONE APP: MEDICAL / FITNESS NEXT TO THE SQUAD
--
-- The phone app shows each national-team player's availability, medical note,
-- last checkup, medical log, fitness trend and minutes. None of that lives on
-- `members`, so it gets its own table keyed by the member.
--
--   * every active account reads it (same rule as the squad itself)
--   * the admin, or an account holding the 'editMedical' permission, writes it
--   * Ligue players never get a row (they are not on the national squad)
--
-- Safe to re-run. The app keeps working without this file: it just shows every
-- player as fit with no medical notes until it is applied.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.player_medical (
  member_id    bigint PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  status       text   NOT NULL DEFAULT 'fit' CHECK (status IN ('fit','recovery','injured')),
  medical_note text   NOT NULL DEFAULT '' CHECK (length(medical_note) <= 2000),
  last_checkup date,
  medical_log  jsonb  NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(medical_log) = 'array'),
  fitness      jsonb  NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fitness) = 'array'),
  minutes      integer NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid
);

ALTER TABLE public.player_medical ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.player_medical FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_medical TO authenticated;

DROP POLICY IF EXISTS player_medical_select ON public.player_medical;
CREATE POLICY player_medical_select ON public.player_medical
  FOR SELECT TO authenticated USING (public.is_active_user());

DROP POLICY IF EXISTS player_medical_insert ON public.player_medical;
CREATE POLICY player_medical_insert ON public.player_medical
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_perm('editMedical'));

DROP POLICY IF EXISTS player_medical_update ON public.player_medical;
CREATE POLICY player_medical_update ON public.player_medical
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_perm('editMedical'))
  WITH CHECK (public.is_admin() OR public.has_perm('editMedical'));

DROP POLICY IF EXISTS player_medical_delete ON public.player_medical;
CREATE POLICY player_medical_delete ON public.player_medical
  FOR DELETE TO authenticated USING (public.is_admin());

-- Stamp who changed a row and when, whatever the client sends.
CREATE OR REPLACE FUNCTION public.player_medical_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS player_medical_stamp ON public.player_medical;
CREATE TRIGGER player_medical_stamp BEFORE INSERT OR UPDATE ON public.player_medical
  FOR EACH ROW EXECUTE FUNCTION public.player_medical_stamp();

-- Live updates for the phone app.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'player_medical') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.player_medical;
  END IF;
END $$;
