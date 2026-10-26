-- ═══════════════════════════════════════════════════════════════════════
-- 0028 · Attach medical files to their injury report
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- From now on every IRM picture / PDF report belongs to one injury report:
-- the Files area lives inside each report card, and deleting a report
-- removes its files automatically (the database cleans up the list rows;
-- the app clears the stored bytes itself).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.medical_files ADD COLUMN IF NOT EXISTS injury_id bigint;

ALTER TABLE public.medical_files DROP CONSTRAINT IF EXISTS medical_files_injury_id_fkey;
ALTER TABLE public.medical_files
  ADD CONSTRAINT medical_files_injury_id_fkey
  FOREIGN KEY (injury_id) REFERENCES public.injuries(id)
  ON DELETE CASCADE;

-- Verify: injury_id should appear in the list below.
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='medical_files'
ORDER BY ordinal_position;
