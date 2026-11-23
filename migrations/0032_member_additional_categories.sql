-- A player can belong to more than one national category (e.g. U20 and
-- SENIORS). The primary category stays in team_category; every other category
-- she plays in is listed here, so she appears in all of them with a badge.
-- No data is rewritten: existing cards simply get an empty list.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS additional_categories text[] NOT NULL DEFAULT '{}';
