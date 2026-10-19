-- ============================================================
-- 0019  LIGUE FEMININE: pin the search_path of the updated_at trigger function
--
-- The Supabase security checker flags league_fixtures_touch() because it has no fixed
-- search_path. This only sets one; the function body is unchanged. Safe to re-run.
-- Depends on 0015.
-- ============================================================
ALTER FUNCTION public.league_fixtures_touch() SET search_path = public, pg_temp;
