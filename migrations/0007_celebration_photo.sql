-- Second photo per player (the celebration one). Run once in Supabase > SQL Editor. Safe to re-run.
-- The normal portrait stays in image_url / image_path; this adds image2_url / image2_path next to them.
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS image2_url  text;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS image2_path text;
