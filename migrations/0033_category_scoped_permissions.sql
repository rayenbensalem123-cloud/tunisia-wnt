-- Category-scoped staff permissions.
--
-- A profile can carry permissions->managedCategories, e.g. ["U17"]. When the
-- array is present and non-empty, that account may only WRITE rows in those
-- categories. Empty/absent keeps the old behaviour (all categories), so every
-- existing account is unaffected. Admins and server-side writes (no auth uid)
-- are always allowed.
--
-- This is enforced in the database, not just by hiding buttons in the UI.

CREATE OR REPLACE FUNCTION public.allowed_categories()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN current_setting('request.jwt.claim.sub', true) IS NULL OR current_setting('request.jwt.claim.sub', true) = '' THEN NULL
    ELSE (
      SELECT CASE
        WHEN (permissions -> 'managedCategories') IS NULL
          OR jsonb_typeof(permissions -> 'managedCategories') <> 'array'
          OR jsonb_array_length(permissions -> 'managedCategories') = 0
        THEN NULL
        ELSE ARRAY(SELECT jsonb_array_elements_text(permissions -> 'managedCategories'))
      END
      FROM profiles
      WHERE id = current_setting('request.jwt.claim.sub', true)::uuid AND status = 'active'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_category(cat text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    current_setting('request.jwt.claim.sub', true) IS NULL
    OR current_setting('request.jwt.claim.sub', true) = ''
    OR coalesce((SELECT role = 'admin' FROM profiles WHERE id = current_setting('request.jwt.claim.sub', true)::uuid), false)
    OR public.allowed_categories() IS NULL
    OR cat = ANY (public.allowed_categories());
$$;

CREATE OR REPLACE FUNCTION public.enforce_category_scope()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  old_cat text;
  new_cat text;
  added text[];
BEGIN
  IF TG_TABLE_NAME = 'members' THEN
    IF TG_OP <> 'INSERT' THEN old_cat := OLD.team_category; END IF;
    IF TG_OP <> 'DELETE' THEN new_cat := NEW.team_category; END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN old_cat := OLD.team_category; END IF;
    IF TG_OP <> 'DELETE' THEN new_cat := NEW.team_category; END IF;
  END IF;

  IF old_cat IS NOT NULL AND NOT public.can_manage_category(old_cat) THEN
    RAISE EXCEPTION 'You may only change data in your assigned categories (%, blocked)', old_cat;
  END IF;
  IF new_cat IS NOT NULL AND NOT public.can_manage_category(new_cat) THEN
    RAISE EXCEPTION 'You may only change data in your assigned categories (%, blocked)', new_cat;
  END IF;

  -- A scoped user must not add an out-of-scope category to a player card.
  IF TG_TABLE_NAME = 'members' AND TG_OP <> 'DELETE'
     AND coalesce(array_length(public.allowed_categories(), 1), 0) > 0 THEN
    added := ARRAY(
      SELECT unnest(coalesce(NEW.additional_categories, '{}'::text[]))
      EXCEPT
      SELECT unnest(coalesce(
        CASE WHEN TG_OP = 'INSERT' THEN '{}'::text[] ELSE OLD.additional_categories END,
        '{}'::text[]))
    );
    IF array_length(added, 1) > 0 THEN
      SELECT array_agg(c) INTO added FROM unnest(added) c WHERE NOT public.can_manage_category(c);
      IF array_length(added, 1) > 0 THEN
        RAISE EXCEPTION 'You may only add your own categories to a player card';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scope_members ON public.members;
CREATE TRIGGER trg_scope_members BEFORE INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_scope();

DROP TRIGGER IF EXISTS trg_scope_matches ON public.matches;
CREATE TRIGGER trg_scope_matches BEFORE INSERT OR UPDATE OR DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_scope();

DROP TRIGGER IF EXISTS trg_scope_camps ON public.camps;
CREATE TRIGGER trg_scope_camps BEFORE INSERT OR UPDATE OR DELETE ON public.camps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_scope();
