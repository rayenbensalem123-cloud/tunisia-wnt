-- Per-user secret token for the personal camp calendar feed (ICS subscription).
-- The token is the only credential in the feed URL, so it is unique, random and
-- regenerable. Self-updates are already allowed by profiles_update_own, and
-- guard_profile_privileges does not cover this column. Safe to re-run.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_token text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_calendar_token_key
  ON public.profiles (calendar_token) WHERE calendar_token IS NOT NULL;
