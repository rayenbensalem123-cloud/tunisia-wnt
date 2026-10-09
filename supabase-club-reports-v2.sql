-- Extends the club-match self-report form (club_match_reports, created in
-- an earlier migration — see the "Club" tab on a player's card). Applied
-- directly via the Supabase MCP on 2026-10-08/09; this file documents what's
-- actually live, same convention as supabase-meetings.sql.

-- Position played, a staff "verified" trust marker, an injury flag separate
-- from the main injuries module, and the ability to record that she simply
-- didn't feature in a given matchday rather than forcing a 0-minute
-- "played" report.
ALTER TABLE public.club_match_reports ADD COLUMN IF NOT EXISTS position_played text;
ALTER TABLE public.club_match_reports ADD COLUMN IF NOT EXISTS did_not_play boolean NOT NULL DEFAULT false;
ALTER TABLE public.club_match_reports ADD COLUMN IF NOT EXISTS had_injury boolean;
ALTER TABLE public.club_match_reports ADD COLUMN IF NOT EXISTS injury_notes text;
ALTER TABLE public.club_match_reports ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.club_match_reports ADD COLUMN IF NOT EXISTS verified_by_username text;
ALTER TABLE public.club_match_reports ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- A player can update her own report (per the pre-existing
-- club_reports_update_own RLS policy), but "verified" is staff's word, not
-- hers — guard those three columns the same way guard_profile_privileges
-- guards role/status/permissions on profiles.
CREATE OR REPLACE FUNCTION public.guard_club_report_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_perm_or_admin('editPlayer') OR public.has_perm_or_admin('addPlayer') THEN
    RETURN NEW;
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.verified_by_username IS DISTINCT FROM OLD.verified_by_username
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'Only staff can verify a club match report' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_club_report_verification
  BEFORE UPDATE ON public.club_match_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_club_report_verification();
