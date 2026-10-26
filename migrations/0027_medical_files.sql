-- ═══════════════════════════════════════════════════════════════════════
-- 0027 · Medical files (IRM images & PDF reports on a player card)
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- What this creates
--   medical_files  : one row per uploaded document (IRM picture, doctor's
--                    PDF), remembering whose file it is, who added it and
--                    when. The file bytes themselves live in the existing
--                    private "members" storage bucket under medical/<id>/.
--   Four storage  : the upload folder medical/ is now gated on the
--   policies        Edit-medical permission (instead of Add-player).
--
-- Who sees what
--   read   : admin, staff with viewMedical, and the player herself (own files).
--   write  : admin or staff with editMedical — same as the Log injury button.
--
-- Privacy note: every signed-in account can technically pass the storage
-- READ policy (that one is shared with squad photos), but the app never
-- mints a signed URL for a medical file without re-checking ownership in
-- /api/image, so a leaked path alone reveals nothing.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. The registry of who owns which file.
CREATE TABLE IF NOT EXISTS public.medical_files (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id            bigint NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  file_path            text   NOT NULL UNIQUE,
  file_name            text   NOT NULL DEFAULT '',
  file_type            text   NOT NULL DEFAULT '' CHECK (file_type IN ('image','pdf','')),
  uploaded_by          uuid   DEFAULT auth.uid(),
  uploaded_by_username text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_files ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON TABLE public.medical_files TO authenticated;

-- 2. Row-level rules, mirroring the injuries table exactly.
DROP POLICY IF EXISTS medical_files_select ON public.medical_files;
CREATE POLICY medical_files_select ON public.medical_files
  FOR SELECT TO authenticated USING (
    public.current_active_admin()
    OR public.has_permission('viewMedical')
    OR member_id = public.current_member_id()
  );
DROP POLICY IF EXISTS medical_files_insert ON public.medical_files;
CREATE POLICY medical_files_insert ON public.medical_files
  FOR INSERT TO authenticated WITH CHECK (
    public.current_active_admin() OR public.has_permission('editMedical')
  );
DROP POLICY IF EXISTS medical_files_delete ON public.medical_files;
CREATE POLICY medical_files_delete ON public.medical_files
  FOR DELETE TO authenticated USING (
    public.current_active_admin() OR public.has_permission('editMedical')
  );

-- 3. Storage writes under medical/ follow the medical permissions instead of
--    the player-editing ones. The read policy (any active user) is untouched.
DROP POLICY IF EXISTS "members_storage_insert" ON storage.objects;
CREATE POLICY "members_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'medical/%' THEN public.has_permission('editMedical')
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('addPlayer')
      END
    )
  );
DROP POLICY IF EXISTS "members_storage_update" ON storage.objects;
CREATE POLICY "members_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'medical/%' THEN public.has_permission('editMedical')
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('editPlayer')
      END
    )
  ) WITH CHECK (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'medical/%' THEN public.has_permission('editMedical')
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('editPlayer')
      END
    )
  );
DROP POLICY IF EXISTS "members_storage_delete" ON storage.objects;
CREATE POLICY "members_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'members' AND (
      CASE
        WHEN name LIKE 'medical/%' THEN public.has_permission('editMedical')
        WHEN name LIKE 'camps-reports/%' OR name LIKE 'camps-photos/%' THEN public.has_permission('addCamps')
        ELSE public.has_permission('deletePlayer')
      END
    )
  );

-- 4. Verify: should list medical_files_select / _insert / _delete.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'medical_files'
ORDER BY policyname;
