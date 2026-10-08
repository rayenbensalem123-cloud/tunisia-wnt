-- Self-service password reset. Applied directly via the Supabase MCP on
-- 2026-10-08 — this file documents what's actually live, same convention as
-- supabase-meetings.sql.
--
-- The app's Supabase Auth users log in with a synthetic placeholder email
-- (`<username>@placeholder.tunisia-wnt.local>`), not a real address — see
-- registerUser() in lib/app-data.ts. So Supabase's own built-in
-- "reset password by email" can't be pointed at a real inbox directly.
-- Instead: a user can optionally record a real recovery email on their own
-- profile, and /api/forgot-password + /api/reset-password implement the
-- actual reset using the service-role key, gated by a short-lived one-time
-- token mailed to that address.

-- Optional recovery email, self-set by the account owner. Not in the
-- guard_profile_privileges() guarded-column list, so the existing
-- "profiles_update_own" policy already allows a user to set/change their
-- own — no new policy needed.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Two different accounts must not share one recovery email, or a reset
-- link sent to it could land in the wrong inbox.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (lower(email)) WHERE email IS NOT NULL;

-- One-time reset tokens. We store a SHA-256 hash, never the raw token, so a
-- DB read (backup, leaked log, etc.) can't be replayed into a password
-- reset. RLS is enabled with NO policies: only the service-role key (used
-- solely by the two API routes below) can touch this table — no
-- anon/authenticated access at all, by Postgres's default-deny with RLS on.
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS password_reset_tokens_profile_idx
  ON public.password_reset_tokens (profile_id);

-- ─────────────────────────────────────────────
-- Required environment variable (set in Vercel → Project → Settings → Environment Variables)
-- ─────────────────────────────────────────────
-- RESEND_API_KEY
--
-- From https://resend.com (free tier: 100 emails/day / 3,000/month, enough
-- for a federation-sized roster). Create an account, verify a sending
-- domain (or use their shared onboarding domain for testing), and create an
-- API key. Without this set, /api/forgot-password returns a clear
-- "email isn't configured yet" error instead of failing silently or
-- pretending to send — same degrade-gracefully pattern as the Zoom and
-- Sentry integrations.
--
-- Until RESEND_API_KEY is set, users without a working reset flow still
-- have the existing fallback: an admin can reset their password from the
-- Users panel (adminResetPassword / /api/admin-reset-password).
