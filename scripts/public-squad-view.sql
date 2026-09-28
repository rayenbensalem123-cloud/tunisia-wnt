-- Run this once in the Supabase SQL Editor.
--
-- WHY
-- The audit removed members_select_anon, so anon reads of the table return
-- nothing. That is correct - the table holds passport_image - but the public
-- squad page reads with the anon key, so it has been rendering an empty
-- squad ever since.
--
-- This republishes the roster WITHOUT reopening the table. squad_public is a
-- view carrying every column a player card renders except passport_image, so
-- an identity document can never be fetched by name, and the members table
-- itself stays unreadable without a signed-in session.

CREATE OR REPLACE VIEW public.squad_public AS
  SELECT
    id, legacy_id, role, name, position, team_category, club, foot,
    nationality, languages, birthdate, height, goals, assists, clean_sheets,
    yellow_cards, red_cards, suspended, contract, nat_matches, history,
    image_url, image_path, jersey_number, camps, bio_quote, league_region,
    dual_nationality, second_nationality, updated_at
  FROM public.members;
-- No WITH (security_invoker = ...) clause: the view reads as its owner
-- (postgres), so the table's RLS is not re-applied. That is the default for
-- a view and is exactly the point - this is a deliberate, column-limited
-- publication, not a hole in the table's access control. Spelling the option
-- out is rejected on older Postgres, and the default already does it.

-- SELECT only. A view is updatable by default, so granting anything else here
-- would let a write reach the table through it. Revoke first so re-running
-- this cannot leave an earlier, wider grant behind.
REVOKE ALL ON public.squad_public FROM anon, authenticated;
GRANT SELECT ON public.squad_public TO anon, authenticated;

-- Fail loudly if the table ever regains a public read policy: this view only
-- stays safe while the table behind it is closed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE tablename = 'members'
               AND policyname = 'members_select_anon') THEN
    RAISE EXCEPTION
      'members_select_anon exists - the members table is publicly readable, which makes squad_public pointless and exposes passport_image';
  END IF;
END;
$$;
