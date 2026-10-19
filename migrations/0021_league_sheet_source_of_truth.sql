-- ============================================================
-- 0021  LIGUE FEMININE: THE MATCH SHEET IS THE SOURCE OF THE NUMBERS
--
-- 0020 made league_player_stats derived from league_match_lineup and
-- league_match_events, but its recount had three problems, and the third one
-- cannot be corrected by hand any more now that the stats tables are read-only:
--
--   1. Removing a player's last sheet row left her old totals in place forever.
--      league_recount_player() returned early when it found nothing, so the row
--      it should have deleted kept the appearances and goals she no longer had.
--
--   2. A lineup row for a match that was never played still counted. Nothing
--      joined to league_fixtures, so a sheet entered for a fixture later marked
--      postponed went on adding appearances.
--
--   3. league_top_players() stopped at 50 rows. That limit was chosen when a
--      season held a handful of hand-typed lines; now that every appearance is
--      recorded, a full season returns the whole league and 50 cuts it in half.
--
-- 0020 also deliberately left hand-typed totals alone for players with no sheet.
-- Now that the numbers are the sheet's and nothing else, that would leave values
-- in place that can no longer be edited or explained, so this migration clears
-- them once, while no sheet data exists.
--
-- Depends on 0012, 0015, 0018 and 0020. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Recount one player from the sheets, counting played matches only
--
-- SECURITY DEFINER so the recount always lands: it is reached from triggers that
-- fire as whoever wrote the sheet, and it must not be able to half-succeed. The
-- search_path is pinned because a definer function that resolves a bare table
-- name would otherwise be a way to run code as the owner.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.league_recount_player(p_season bigint, p_member bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  a int; g int; s int; y int; r int;
BEGIN
  IF p_season IS NULL OR p_member IS NULL THEN
    RETURN;
  END IF;

  -- Appearances, from matches that were actually played.
  SELECT count(*) INTO a
  FROM public.league_match_lineup l
  JOIN public.league_fixtures f ON f.id = l.fixture_id
  WHERE l.season_id = p_season
    AND l.member_id = p_member
    AND f.status = 'played';

  SELECT count(*) FILTER (WHERE e.kind = 'goal'),
         count(*) FILTER (WHERE e.kind = 'assist'),
         count(*) FILTER (WHERE e.kind = 'yellow'),
         count(*) FILTER (WHERE e.kind = 'red')
    INTO g, s, y, r
  FROM public.league_match_events e
  JOIN public.league_fixtures f ON f.id = e.fixture_id
  WHERE e.season_id = p_season
    AND e.member_id = p_member
    AND f.status = 'played';

  -- Nothing left: the row has to go. Keeping it is what let a player who was
  -- taken out of a sheet go on being credited with the match.
  IF a = 0 AND g = 0 AND s = 0 AND y = 0 AND r = 0 THEN
    DELETE FROM public.league_player_stats
    WHERE season_id = p_season AND member_id = p_member;
    RETURN;
  END IF;

  INSERT INTO public.league_player_stats
    (season_id, member_id, appearances, goals, assists, yellows, reds, updated_at)
  VALUES (p_season, p_member, a, g, s, y, r, now())
  ON CONFLICT (season_id, member_id) DO UPDATE
    SET appearances = EXCLUDED.appearances,
        goals       = EXCLUDED.goals,
        assists     = EXCLUDED.assists,
        yellows     = EXCLUDED.yellows,
        reds        = EXCLUDED.reds,
        updated_at  = now();
END;
$$;

-- ------------------------------------------------------------
-- 2. Recount a whole season
--
-- Needed when a match changes status: a result corrected from played to
-- postponed (or back) changes every player who was in its sheet, and no per-row
-- trigger on the sheets fires for that. It is also how the migration rebuilds
-- the table at the end.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.league_recount_season(p_season bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  m bigint;
BEGIN
  IF p_season IS NULL THEN
    RETURN;
  END IF;

  -- Everyone the season's sheets mention, in either table.
  FOR m IN
    SELECT DISTINCT member_id FROM public.league_match_lineup  WHERE season_id = p_season
    UNION
    SELECT DISTINCT member_id FROM public.league_match_events  WHERE season_id = p_season
  LOOP
    PERFORM public.league_recount_player(p_season, m);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- 3. A result changing status changes who played
--
-- Only on a real change of status: generating a calendar inserts every fixture
-- at once, and recounting a season per insert would be a lot of work to prove
-- that nothing had happened yet.
--
-- Deleting a fixture needs no trigger here: the cascade removes its sheet rows,
-- and their own triggers recount the players involved.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.league_fixture_status_recount()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.league_recount_season(OLD.season_id);
  IF NEW.season_id IS DISTINCT FROM OLD.season_id THEN
    PERFORM public.league_recount_season(NEW.season_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_league_fixture_status_recount ON public.league_fixtures;
CREATE TRIGGER trg_league_fixture_status_recount
  AFTER UPDATE OF status ON public.league_fixtures
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.league_fixture_status_recount();

-- ------------------------------------------------------------
-- 4. Read the whole league, not the first fifty
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
  JOIN public.members m           ON m.id = s.member_id
  LEFT JOIN public.league_teams t ON t.id = m.league_team_id
  WHERE s.season_id = p_season_id
    AND (s.goals > 0 OR s.assists > 0 OR s.appearances > 0)
  ORDER BY s.goals DESC, s.assists DESC, s.appearances DESC, m.name
  LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.league_top_players(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.league_top_players(bigint) TO authenticated;

-- ------------------------------------------------------------
-- 5. Drop the totals that nothing can explain any more
--
-- 0018's numbers were typed in by hand and 0020 left them alone for players with
-- no sheet. The statistics screen no longer has an editor, so those values cannot
-- be corrected or accounted for; they would just sit there disagreeing with the
-- match sheets.
--
-- Only while no sheet exists: re-running this migration must never wipe totals
-- that the triggers have since derived.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.league_match_lineup)
     AND NOT EXISTS (SELECT 1 FROM public.league_match_events) THEN
    DELETE FROM public.league_player_stats;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 6. Repair what 0020's recount already wrote
--
-- 0020 has been live long enough for someone to enter a sheet. Anything its
-- recount produced for a player who is still in a sheet is recomputed correctly
-- here; anything it left behind for a player who has since been taken out of
-- every sheet is removed. Running this over every season is a handful of rows
-- each, and it means the table is right without anyone having to remember which
-- result was edited under the old function.
-- ------------------------------------------------------------
DO $$
DECLARE
  s bigint;
BEGIN
  FOR s IN SELECT id FROM public.league_seasons ORDER BY id LOOP
    PERFORM public.league_recount_season(s);
  END LOOP;
END;
$$;

-- ── Verification ────────────────────────────────────────────────────────────
-- 1. Put a player in a lineup, mark the fixture played, then:
--      SELECT * FROM public.league_player_stats WHERE member_id = <id>;
--    She has one appearance.
-- 2. Set that fixture to 'postponed':
--      SELECT * FROM public.league_player_stats WHERE member_id = <id>;
--    Her row is gone: a match that was not played is not an appearance.
-- 3. Put her back and delete the lineup row:
--      SELECT * FROM public.league_player_stats WHERE member_id = <id>;
--    No row remains — she is not left holding last week's numbers.