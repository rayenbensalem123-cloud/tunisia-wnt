-- ═══════════════════════════════════════════════════════════════════════
-- 0026 · Let admins delete an account that has history notes
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
--
-- Symptom in the app (shown in the delete alert):
--   update or delete on table "profiles" violates foreign key constraint
--   "activity_log_actor_id_fkey" on table "activity_log"
--
-- Cause: every history note in activity_log keeps a pointer (actor_id) to
-- the account that did the action, and that pointer had no rule for what
-- should happen when the pointed-at account is removed — so the database
-- refused the removal. From now on the pointer is simply blanked (the
-- note keeps the username text, so the history stays readable).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. The pointer column must accept blank, or it cannot be blanked later.
ALTER TABLE public.activity_log ALTER COLUMN actor_id DROP NOT NULL;

-- 2. Replace the pointer rule: blank it instead of refusing the delete.
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_actor_id_fkey;
ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- 3. Show any OTHER tables that still hold a pointer to accounts, each
--    with its removal rule — anything listed with "NO ACTION" here would
--    refuse account deletes the same way. If this returns rows, the rule
--    named in the last column is the next one to repair.
SELECT
  tc.table_name      AS holding_table,
  kcu.column_name    AS pointer_column,
  rc.delete_rule     AS on_delete
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
 AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND kcu.column_name <> 'id'
  AND rc.unique_constraint_schema = 'public'
  AND rc.constraint_name IN (
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND constraint_type = 'PRIMARY KEY'
  )
ORDER BY holding_table;
