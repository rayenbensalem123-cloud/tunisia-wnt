-- ============================================================
-- 0018  LIGUE FEMININE: PLAYER STATISTICS PER SEASON
--
--   * league_player_stats   one row per (season, player): appearances,
--                           goals, assists, yellows, reds
--
-- Why this exists: league_fixtures records only the SCORE of a match
-- (home_goals / away_goals). Nothing in the schema could say which
-- player scored, so there was no way to build a top-scorers table
-- or show a player's season on her card.
--
--   admin           read and write everything
--   club account    READ ONLY, the whole league's player stats
--   everyone else   nothing (staff, players, anonymous)
--
-- Same access model as 0015, so a club can see the scorers' table
-- but only an admin can enter the numbers.
--
-- Depends on 0012 (league_teams, my_league_team_id, is_admin) and
-- 0015 (league_seasons). Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.league_player_stats (
  season_id   bigint NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  member_id   bigint NOT NULL REFERENCES public.members(id)     ON DELETE CASCADE,
  appearances integer NOT NULL DEFAULT 0 CHECK (appearances >= 0),
  goals       integer NOT NULL DEFAULT 0 CHECK (goals       >= 0),
  assists     integer NOT NULL DEFAULT 0 CHECK (assists     >= 0),
  yellows     integer NOT NULL DEFAULT 0 CHECK (yellows     >= 0),
  reds        integer NOT NULL DEFAULT 0 CHECK (reds        >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  PRIMARY KEY (season_id, member_id)
);
-- Leaderboards read by season, ordered by goals; the covering order here is what
-- makes "top scorers" a plain index scan instead of a sort over the whole season.
CREATE INDEX IF NOT EXISTS league_player_stats_goals_idx
  ON public.league_player_stats (season_id, goals DESC, assists DESC);
CREATE INDEX IF NOT EXISTS league_player_stats_member_idx
  ON public.league_player_stats (member_id, season_id);

-- ------------------------------------------------------------
-- 2. RLS: club accounts and admins read, only admins write
-- ------------------------------------------------------------
ALTER TABLE public.league_player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS league_player_stats_read ON public.league_player_stats;
CREATE POLICY league_player_stats_read ON public.league_player_stats
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.my_league_team_id() IS NOT NULL);

DROP POLICY IF EXISTS league_player_stats_admin_write ON public.league_player_stats;
CREATE POLICY league_player_stats_admin_write ON public.league_player_stats
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.league_player_stats FROM anon;

-- ------------------------------------------------------------
-- 3. Convenience read for the leaderboards
--
-- Joins the player's name and club onto their stats row. SECURITY INVOKER on
-- purpose so the two table policies above are still what authorise the read —
-- this function must never become a way around them.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.league_top_players(p_season_id bigint)
RETURNS TABLE (
  member_id   bigint,
  name        text,
  team_id     bigint,
  team_name   text,
  appearances integer,
  goals       integer,
  assists     integer,
  yellows     integer,
  reds        integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT s.member_id,
         m.name,
         m.league_team_id,
         t.name,
         s.appearances, s.goals, s.assists, s.yellows, s.reds
  FROM public.league_player_stats s
  JOIN public.members m        ON m.id = s.member_id
  LEFT JOIN public.league_teams t ON t.id = m.league_team_id
  WHERE s.season_id = p_season_id
    AND (s.goals > 0 OR s.assists > 0 OR s.appearances > 0)
  ORDER BY s.goals DESC, s.assists DESC, s.appearances DESC, m.name
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.league_top_players(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.league_top_players(bigint) TO authenticated;

-- ── Verification ────────────────────────────────────────────────────────────
--   SELECT public.is_admin(), public.has_permission('addPlayer');
--   SELECT count(*) FROM public.league_player_stats;   -- 0 on a fresh install
