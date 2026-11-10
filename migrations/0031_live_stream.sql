-- Private live streaming: a library row can now be a Cloudflare Stream live input.
-- The stream KEY is never stored here (this table is readable by every active
-- account). Admins fetch it from the API when needed.
ALTER TABLE public.library_videos ADD COLUMN IF NOT EXISTS live_input_uid text;

ALTER TABLE public.library_videos DROP CONSTRAINT IF EXISTS library_videos_source_check;
ALTER TABLE public.library_videos ADD CONSTRAINT library_videos_source_check
  CHECK (source IN ('link','upload','stream'));

ALTER TABLE public.library_videos DROP CONSTRAINT IF EXISTS library_videos_source_ok;
ALTER TABLE public.library_videos ADD CONSTRAINT library_videos_source_ok CHECK (
  (source = 'link'   AND coalesce(url, '') <> '') OR
  (source = 'upload' AND coalesce(file_path, '') <> '') OR
  (source = 'stream' AND coalesce(live_input_uid, '') <> '')
);
