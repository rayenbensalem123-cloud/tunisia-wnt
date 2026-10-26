-- ═══════════════════════════════════════════════════════════════════════
-- 0025 · Repair account management (approve / modify / delete users)
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
--
-- Symptom in the app: newly registered members wait for approval, and the
-- Approve / Delete buttons do nothing — the writes are refused by the
-- database while the screen stays silent.
--
-- Registers themselves still work (the insert path was verified); what is
-- repaired here is the admin side of the profiles table: the two
-- row-security rules and the table privileges those buttons need.
--
-- Safe to run more than once: every statement is idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. The screen talks to the database through the "authenticated" role.
--    Even a correct row-level rule is void without the table privilege.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- 2. Admins may change accounts (approve, attach a card, change permissions).
--    Recreated with the canonical name so an old half-altered rule is gone.
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.current_active_admin())
  WITH CHECK (public.current_active_admin());

-- 3. Admins may delete an account (its registrations and links cascade as
--    designed elsewhere; the login credential is handled separately).
DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;
CREATE POLICY profiles_admin_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.current_active_admin());

-- 4. Show the final rule set for the profiles table.
--    Expected here: permissive policies for
--    · profiles_admin_update      (UPDATE, authenticated)
--    · profiles_admin_delete      (DELETE, authenticated)
--    · profiles_update_own        (UPDATE, authenticated) — self-service
--    · one INSERT policy for the registration flow
--    · one SELECT policy used by staff screens
SELECT policyname, cmd, roles, permissive
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
