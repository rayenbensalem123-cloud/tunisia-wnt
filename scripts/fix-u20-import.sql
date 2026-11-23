-- Fix: the 23 players imported from IMG_20261021_0003.pdf were created with
-- team_category = 'SENIORS'. Move those cards to 'U20'.
--
-- Run in Supabase -> SQL Editor. The first SELECT is a preview: check that it
-- lists exactly the imported players before running the UPDATE. Nothing else
-- is touched (IDs, clubs and camp rosters stay the same).

-- 1) PREVIEW — review this list first
SELECT id, name, team_category, club
FROM public.members
WHERE team_category = 'SENIORS'
  AND lower(trim(name)) IN (
    'kmar makhlouf', 'yasmin ayachi', 'yasmine khmila', 'roudayna madyouni',
    'tasnim salhi', 'rawen fatnassi', 'roua ben mabrouk', 'arij kadhi',
    'zayneb boukhriss', 'rabhi ranim', 'yasmine moumen', 'mariem ben salah',
    'wided mejri', 'lilia belhajjrad', 'ranim ajroud', 'candice nasraoui',
    'sirine fedi', 'mayssa omrane', 'sarra chaya',
    'ines rejaibi', 'lnes rejaibi',
    'françoise sirine', 'francoise sirine', 'maelle ben fraj', 'yasmine gaida'
  )
ORDER BY name;

-- 2) APPLY — run only once the preview above looks right
UPDATE public.members
SET team_category = 'U20',
    updated_at = now()
WHERE team_category = 'SENIORS'
  AND lower(trim(name)) IN (
    'kmar makhlouf', 'yasmin ayachi', 'yasmine khmila', 'roudayna madyouni',
    'tasnim salhi', 'rawen fatnassi', 'roua ben mabrouk', 'arij kadhi',
    'zayneb boukhriss', 'rabhi ranim', 'yasmine moumen', 'mariem ben salah',
    'wided mejri', 'lilia belhajjrad', 'ranim ajroud', 'candice nasraoui',
    'sirine fedi', 'mayssa omrane', 'sarra chaya',
    'ines rejaibi', 'lnes rejaibi',
    'françoise sirine', 'francoise sirine', 'maelle ben fraj', 'yasmine gaida'
  );
