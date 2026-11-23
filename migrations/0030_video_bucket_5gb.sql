-- Raise the videos bucket to 5 GB per file.
-- Supabase also has a GLOBAL limit (50 MB on Free). Raise that first:
-- Dashboard -> Storage -> Settings -> "Upload file size limit" (needs the Pro plan).
UPDATE storage.buckets SET file_size_limit = 5368709120 WHERE id = 'videos';
