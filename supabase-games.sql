-- ============================================================
-- STAFF GAMES — shared storage for Match-day Bingo and "Who am I?"
-- Run this once in the Supabase SQL editor (safe to re-run).
-- Until it has been run the games still work, but each device keeps its own
-- picks/scores (nothing is shared between staff).
-- Depends on public.current_active_user() from supabase-setup.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bingo_picks (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL DEFAULT auth.uid(),
  username   text        NOT NULL,
  match_key  text        NOT NULL,                 -- "<YYYY-MM-DD>|<opponent lowercased>"
  picks      jsonb       NOT NULL DEFAULT '[]',    -- up to 5 square ids
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_key),
  CONSTRAINT bingo_picks_max_five CHECK (jsonb_typeof(picks) = 'array' AND jsonb_array_length(picks) <= 5)
);

CREATE TABLE IF NOT EXISTS public.game_scores (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL DEFAULT auth.uid(),
  username   text        NOT NULL,
  game       text        NOT NULL,                 -- e.g. 'whoami'
  points     integer     NOT NULL CHECK (points >= 0 AND points <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_scores_game_idx ON public.game_scores (game, points DESC);

ALTER TABLE public.bingo_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bingo_picks_select" ON public.bingo_picks;
DROP POLICY IF EXISTS "bingo_picks_insert" ON public.bingo_picks;
DROP POLICY IF EXISTS "bingo_picks_update" ON public.bingo_picks;
DROP POLICY IF EXISTS "game_scores_select" ON public.game_scores;
DROP POLICY IF EXISTS "game_scores_insert" ON public.game_scores;

-- Everyone active can see the leaderboard; you can only write your own rows.
CREATE POLICY "bingo_picks_select" ON public.bingo_picks FOR SELECT USING (public.current_active_user());
CREATE POLICY "bingo_picks_insert" ON public.bingo_picks FOR INSERT
  WITH CHECK (public.current_active_user() AND user_id = auth.uid());
CREATE POLICY "bingo_picks_update" ON public.bingo_picks FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "game_scores_select" ON public.game_scores FOR SELECT USING (public.current_active_user());
CREATE POLICY "game_scores_insert" ON public.game_scores FOR INSERT
  WITH CHECK (public.current_active_user() AND user_id = auth.uid());

-- The save time is set by the server, never trusted from the client, so a pick edited after the
-- match day can be ignored when the table is scored.
CREATE OR REPLACE FUNCTION public.bingo_picks_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bingo_picks_touch ON public.bingo_picks;
CREATE TRIGGER trg_bingo_picks_touch
  BEFORE INSERT OR UPDATE ON public.bingo_picks
  FOR EACH ROW EXECUTE FUNCTION public.bingo_picks_touch();
