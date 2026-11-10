-- ═══════════════════════════════════════════════════════════════════════
-- 0029 · Stream & Videos space (replaces the Zoom "Meetings" feature)
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- What this creates
--   library_videos : one row per match replay, highlight, training clip or
--                    live stream. A row is either a LINK (YouTube, Vimeo,
--                    Twitch or a direct .mp4 address — best for full matches
--                    and live streams) or an UPLOAD (a file in the private
--                    "videos" storage bucket — best for short highlights).
--   videos bucket  : private; every active account can watch, only accounts
--                    with the Manage videos permission can add or remove.
--   manageVideos   : the new permission. Accounts that had Manage meetings
--                    get it automatically.
--
-- File size: the bucket is capped at 50 MB per file, which is the maximum on
-- Supabase's free plan. On a paid plan raise it in Storage → Settings and
-- change file_size_limit below. Full matches should be added as a link.
--
-- The old "meetings" table is dropped ONLY if it holds no rows, so nothing
-- is lost silently. If it has rows it is left in place and you get a notice.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Who may watch: any active account (same level as matches and camps).
CREATE OR REPLACE FUNCTION public.library_can_view()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce((SELECT status = 'active' FROM profiles WHERE id = auth.uid()), false);
$$;

-- 2. The library itself.
CREATE TABLE IF NOT EXISTS public.library_videos (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title               text NOT NULL CHECK (length(btrim(title)) > 0),
  description         text NOT NULL DEFAULT '',
  kind                text NOT NULL DEFAULT 'highlight'
                        CHECK (kind IN ('match','highlight','training','live')),
  team_category       text,
  source              text NOT NULL CHECK (source IN ('link','upload')),
  url                 text,        -- source = 'link'
  file_path           text,        -- source = 'upload' (inside the videos bucket)
  file_name           text,
  size_bytes          bigint,
  created_by          uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_username text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_videos_source_ok CHECK (
    (source = 'link'   AND coalesce(url, '') <> '') OR
    (source = 'upload' AND coalesce(file_path, '') <> '')
  )
);
CREATE INDEX IF NOT EXISTS library_videos_created_idx ON public.library_videos (created_at DESC);
ALTER TABLE public.library_videos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.library_videos TO authenticated;

DROP POLICY IF EXISTS library_videos_select ON public.library_videos;
CREATE POLICY library_videos_select ON public.library_videos
  FOR SELECT TO authenticated USING (public.library_can_view());
DROP POLICY IF EXISTS library_videos_insert ON public.library_videos;
CREATE POLICY library_videos_insert ON public.library_videos
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('manageVideos'));
DROP POLICY IF EXISTS library_videos_update ON public.library_videos;
CREATE POLICY library_videos_update ON public.library_videos
  FOR UPDATE TO authenticated USING (public.has_permission('manageVideos'))
  WITH CHECK (public.has_permission('manageVideos'));
DROP POLICY IF EXISTS library_videos_delete ON public.library_videos;
CREATE POLICY library_videos_delete ON public.library_videos
  FOR DELETE TO authenticated USING (public.has_permission('manageVideos'));

-- 3. Private storage bucket for uploaded clips.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('videos', 'videos', false, 52428800, ARRAY['video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "videos_storage_select" ON storage.objects;
CREATE POLICY "videos_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos' AND public.library_can_view());
DROP POLICY IF EXISTS "videos_storage_insert" ON storage.objects;
CREATE POLICY "videos_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'videos' AND public.has_permission('manageVideos'));
DROP POLICY IF EXISTS "videos_storage_update" ON storage.objects;
CREATE POLICY "videos_storage_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'videos' AND public.has_permission('manageVideos'))
  WITH CHECK (bucket_id = 'videos' AND public.has_permission('manageVideos'));
DROP POLICY IF EXISTS "videos_storage_delete" ON storage.objects;
CREATE POLICY "videos_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'videos' AND public.has_permission('manageVideos'));

-- 4. Audit log: allow the new table name (the old 'meetings' value stays so
--    history rows written earlier remain valid).
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_entity_type_check;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_entity_type_check CHECK (entity_type = ANY (ARRAY[
  'members','matches','camps','injuries','profiles','squad_templates','club_match_reports','meetings','club_reports',
  'member_documents','trip_plans','trip_members','league_teams','league_seasons','league_fixtures',
  'league_cup_matches','league_breaks','league_match_events','library_videos'
])) NOT VALID;
DROP TRIGGER IF EXISTS trg_log_library_videos ON public.library_videos;
CREATE TRIGGER trg_log_library_videos AFTER INSERT OR UPDATE OR DELETE ON public.library_videos
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- 5. Carry the permission over: whoever managed meetings now manages videos.
UPDATE public.profiles
   SET permissions = coalesce(permissions, '{}'::jsonb) || '{"manageVideos": true}'::jsonb
 WHERE permissions ->> 'manageMeetings' = 'true'
   AND coalesce(permissions ->> 'manageVideos', 'false') <> 'true';

-- 6. Retire the Zoom meetings table, but only if it is empty.
DO $$
BEGIN
  IF to_regclass('public.meetings') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.meetings) THEN
      DROP TABLE public.meetings;
    ELSE
      RAISE NOTICE 'public.meetings still has rows, so it was left in place. Export them, then run: DROP TABLE public.meetings;';
    END IF;
  END IF;
END $$;
