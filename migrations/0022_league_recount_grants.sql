-- ============================================================
-- 0022  Close the two functions 0021 left open to anonymous callers
--
-- 0021 recreated league_recount_player() and league_recount_season() as SECURITY
-- DEFINER so the recount cannot half-succeed from a trigger. That was right, but
-- it missed the consequence: PostgreSQL grants EXECUTE on a new function to
-- PUBLIC, so a definer function is callable by anyone who can reach it.
--
-- Both return void, which PostgREST exposes as an RPC, so a logged-out visitor
-- could call them:
--
--     POST /rest/v1/rpc/league_recount_season   {"p_season": 1}
--
-- That runs as the owner and therefore over row level security, and it writes —
-- it deletes and rebuilds league_player_stats rows. Reachable without a session,
-- on the league's own tables, with no way for the policies to refuse it. The
-- effect is a recompute rather than a fabrication, but it is an unauthenticated
-- write and must not be reachable.
--
-- The other functions in this schema that a visitor can still call return
-- false or null for them, because they key off auth.uid(): they are checked
-- here for that reason and left alone.
--
-- Depends on 0021. Safe to re-run.
-- ============================================================

-- The only legitimate callers are the triggers in 0020 and 0021, which reach
-- these either as the writing admin (league_sheet_recount, SECURITY INVOKER) or
-- as the owner (league_fixture_status_recount, SECURITY DEFINER). So `anon` has
-- no business here, and `authenticated` needs it only for the invoker path.
REVOKE ALL ON FUNCTION public.league_recount_player(bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.league_recount_player(bigint, bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.league_recount_season(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.league_recount_season(bigint) TO authenticated;

-- Trigger-returning functions are not exposed as RPC, so this is tidiness rather
-- than a closed hole: no role needs EXECUTE on it, because firing a trigger does
-- not check the privilege.
REVOKE ALL ON FUNCTION public.league_fixture_status_recount() FROM PUBLIC, anon;

-- ── Verification ────────────────────────────────────────────────────────────
-- With the public anon key, no session:
--   POST /rest/v1/rpc/league_recount_season   {"p_season": 1}   -> 401, not 204
--   POST /rest/v1/rpc/league_recount_player   {...}             -> 401, not 204
-- node scripts/check-match-sheet-live.mjs checks exactly this.