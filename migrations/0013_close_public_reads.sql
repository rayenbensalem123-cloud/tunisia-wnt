-- ============================================================
-- 0013  CLOSE TWO PUBLIC (NO-LOGIN) READ PATHS
--
-- 1. public.squad_public was readable by anyone on the internet (role anon):
--    names, birthdates, heights and photos of the whole national-team roster,
--    including U-17 players. Nothing in the app reads it any more - a signed-out
--    visitor only ever sees the login screen - so the anon grant is removed.
--    Signed-in accounts read `members` directly, where RLS applies.
--
-- 2. Five leftover tables had policies for role anon:
--      players       ALL  USING (true)   <- anyone could read AND WRITE it
--      agenda, announcements, fixture, form_entries   SELECT USING (true)
--    No code reads or writes them. Only the anon policies are dropped; the
--    tables and their rows are left untouched, so this is fully reversible.
--
-- Safe to re-run.
-- ============================================================
REVOKE ALL ON public.squad_public FROM anon, authenticated;

DROP POLICY IF EXISTS players_full        ON public.players;
DROP POLICY IF EXISTS agenda_read         ON public.agenda;
DROP POLICY IF EXISTS announcements_read  ON public.announcements;
DROP POLICY IF EXISTS fixture_read        ON public.fixture;
DROP POLICY IF EXISTS form_read           ON public.form_entries;
