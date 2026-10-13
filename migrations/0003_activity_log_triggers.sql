-- ─────────────────────────────────────────────────────────────
-- ACTIVITY LOG — generic audit trigger
-- ─────────────────────────────────────────────────────────────
-- This documents the log_activity() trigger function and the per-table
-- triggers that call it, which currently live only in the database (they
-- were set up directly via the SQL editor, not through a committed
-- migration, so nothing in the repo described them until now).
--
-- The function is generic: it diffs OLD vs NEW on UPDATE, and picks a
-- human-readable label from whichever of name/opponent/username the
-- touched table happens to have. No per-table logic is needed beyond
-- attaching the trigger, so adding audit coverage to a new table is a
-- single CREATE TRIGGER statement.
--
-- Safe to re-run: every statement below is idempotent.

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_actor uuid := (select auth.uid());
  v_username text;
  v_label text;
  v_category text;
  v_changes jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_ignore text[] := array['updated_at','created_at'];
  v_member_name text;
  v_member_cat text;
begin
  select username into v_username from public.profiles where id = v_actor;

  if TG_OP = 'DELETE' then
    if TG_TABLE_NAME = 'injuries' then
      select name, team_category into v_member_name, v_member_cat from public.members where id = OLD.member_id;
      v_label := coalesce(v_member_name,'Unknown player') || ' — ' || coalesce(OLD.injury_type,'injury');
    elsif TG_TABLE_NAME = 'members' then
      v_label := coalesce(OLD.name, OLD.id::text) || case when OLD.team_category is not null then ' (' || OLD.team_category || ')' else '' end;
    else
      v_label := coalesce((to_jsonb(OLD)->>'name'), (to_jsonb(OLD)->>'opponent'), (to_jsonb(OLD)->>'username'), OLD.id::text);
    end if;
    insert into public.activity_log (actor_id, actor_username, action, entity_type, entity_id, entity_label)
    values (v_actor, v_username, 'delete', TG_TABLE_NAME, OLD.id::text, v_label);
    return OLD;

  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key = any(v_ignore) then continue; end if;
      if v_old->v_key is distinct from v_new->v_key then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old->v_key, 'to', v_new->v_key));
      end if;
    end loop;

    if TG_TABLE_NAME = 'injuries' then
      select name, team_category into v_member_name, v_member_cat from public.members where id = NEW.member_id;
      v_label := coalesce(v_member_name,'Unknown player') || ' — ' || coalesce(NEW.injury_type,'injury');
    elsif TG_TABLE_NAME = 'members' then
      v_label := coalesce(NEW.name, NEW.id::text) || case when NEW.team_category is not null then ' (' || NEW.team_category || ')' else '' end;
    else
      v_label := coalesce((v_new->>'name'), (v_new->>'opponent'), (v_new->>'username'), NEW.id::text);
    end if;

    insert into public.activity_log (actor_id, actor_username, action, entity_type, entity_id, entity_label, changes)
    values (v_actor, v_username, 'update', TG_TABLE_NAME, NEW.id::text, v_label, v_changes);
    return NEW;

  else
    if TG_TABLE_NAME = 'injuries' then
      select name, team_category into v_member_name, v_member_cat from public.members where id = NEW.member_id;
      v_label := coalesce(v_member_name,'Unknown player') || ' — ' || coalesce(NEW.injury_type,'injury');
    elsif TG_TABLE_NAME = 'members' then
      v_label := coalesce(NEW.name, NEW.id::text) || case when NEW.team_category is not null then ' (' || NEW.team_category || ')' else '' end;
    else
      v_label := coalesce((to_jsonb(NEW)->>'name'), (to_jsonb(NEW)->>'opponent'), (to_jsonb(NEW)->>'username'), NEW.id::text);
    end if;
    insert into public.activity_log (actor_id, actor_username, action, entity_type, entity_id, entity_label)
    values (v_actor, v_username, 'insert', TG_TABLE_NAME, NEW.id::text, v_label);
    return NEW;
  end if;
end;
$$;

-- One trigger per audited table. All call the same function above.
DROP TRIGGER IF EXISTS trg_log_members ON public.members;
CREATE TRIGGER trg_log_members AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS trg_log_matches ON public.matches;
CREATE TRIGGER trg_log_matches AFTER INSERT OR UPDATE OR DELETE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS trg_log_injuries ON public.injuries;
CREATE TRIGGER trg_log_injuries AFTER INSERT OR UPDATE OR DELETE ON public.injuries
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS trg_log_profiles ON public.profiles;
CREATE TRIGGER trg_log_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS trg_log_squad_templates ON public.squad_templates;
CREATE TRIGGER trg_log_squad_templates AFTER INSERT OR UPDATE OR DELETE ON public.squad_templates
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Added in this pass — these two tables existed without audit coverage:
DROP TRIGGER IF EXISTS trg_log_club_match_reports ON public.club_match_reports;
CREATE TRIGGER trg_log_club_match_reports AFTER INSERT OR UPDATE OR DELETE ON public.club_match_reports
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS trg_log_camps ON public.camps;
CREATE TRIGGER trg_log_camps AFTER INSERT OR UPDATE OR DELETE ON public.camps
FOR EACH ROW EXECUTE FUNCTION public.log_activity();
