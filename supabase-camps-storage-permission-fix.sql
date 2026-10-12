-- Fixes camp report/photo uploads failing with a permission error for staff
-- accounts that have "Add Camps" but not "Add Player". Run once in
-- Supabase > SQL Editor. Safe to re-run (each policy is dropped and
-- recreated). Already folded into supabase-setup.sql for fresh installs -
-- this file is only needed if you set the database up before this fix.
--
-- The app lets anyone with addCamps manage camps, including the camp report
-- and camp photos upload boxes (see app/page.tsx: canManage of the camps
-- screen is canManageUsers||p.addCamps). But every write to the "members"
-- storage bucket - no matter which folder - required addPlayer specifically.
-- A coach or camp-manager account with addCamps but not addPlayer could open
-- the upload box, drop a file, and get a database-level permission error
-- with nothing in the UI explaining why.
--
-- This scopes uploads under camps-reports/ and camps-photos/ to addCamps
-- instead, and leaves every other folder (player portraits, passports, etc.)
-- gated on addPlayer/editPlayer/deletePlayer exactly as before.

DROP POLICY IF EXISTS "members_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "members_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "members_storage_delete" ON storage.objects;

CREATE POLICY "members_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('addPlayer')
      END
    )
  );
CREATE POLICY "members_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('editPlayer')
      END
    )
  ) WITH CHECK (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('editPlayer')
      END
    )
  );
CREATE POLICY "members_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('deletePlayer')
      END
    )
  );
