-- ─────────────────────────────────────────────────────────────
-- TRAVEL DOCUMENTS + TRIP LOGISTICS
-- ─────────────────────────────────────────────────────────────
-- member_documents : passport expiry per roster member (kept OUT of `members`
--                    because that table is readable by every signed-in user).
-- trip_plans       : one team-level plan (flights, hotel) per camp or match.
-- trip_members     : per-person visa / ticket / room for one camp or match.
--
-- New permission flag: manageTravel (stored in profiles.permissions like the others).
--
-- Who sees what
--   member_documents : admin, staff with manageTravel or viewMedical, and the
--                      player herself (her own row only).
--   trip_plans       : every admin/staff account; a player only for camps/matches
--                      she is called up to.
--   trip_members     : admin, staff with manageTravel, and the person themself.
--   Writes (all three): admin or manageTravel only.
--
-- Safe to re-run.

-- The roster member linked to the signed-in account (players AND staff).
-- current_member_id() is deliberately NULL for staff, so it can't be used here.
CREATE OR REPLACE FUNCTION public.my_member_id()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT member_id FROM profiles WHERE id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.can_see_trip(p_type text, p_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff_account() OR (
    public.my_member_id() IS NOT NULL AND (
      (p_type = 'camp' AND EXISTS (
        SELECT 1 FROM camps c WHERE c.id = p_id AND (
          c.players @> to_jsonb(public.my_member_id()) OR c.players @> to_jsonb(public.my_member_id()::text)
          OR c.staff @> to_jsonb(public.my_member_id()) OR c.staff @> to_jsonb(public.my_member_id()::text))))
      OR
      (p_type = 'match' AND EXISTS (
        SELECT 1 FROM matches m WHERE m.id = p_id AND (
          m.details->'squad' @> to_jsonb(public.my_member_id()) OR m.details->'squad' @> to_jsonb(public.my_member_id()::text))))
    )
  );
$$;

-- ── Passport expiry ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_documents (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id      bigint NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  passport_expiry date,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid DEFAULT auth.uid()
);
ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_documents_select ON public.member_documents;
DROP POLICY IF EXISTS member_documents_write  ON public.member_documents;
CREATE POLICY member_documents_select ON public.member_documents FOR SELECT USING (
  public.has_permission('manageTravel') OR public.has_permission('viewMedical')
  OR member_id = public.my_member_id());
CREATE POLICY member_documents_write ON public.member_documents FOR ALL
  USING (public.has_permission('manageTravel')) WITH CHECK (public.has_permission('manageTravel'));

-- ── Team-level trip plan ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_plans (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type    text   NOT NULL CHECK (event_type IN ('camp','match')),
  event_id      bigint NOT NULL,
  depart_date   date,
  depart_from   text NOT NULL DEFAULT '',
  arrive_to     text NOT NULL DEFAULT '',
  flight_info   text NOT NULL DEFAULT '',
  return_date   date,
  return_info   text NOT NULL DEFAULT '',
  hotel_name    text NOT NULL DEFAULT '',
  hotel_address text NOT NULL DEFAULT '',
  check_in      date,
  check_out     date,
  notes         text NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid DEFAULT auth.uid(),
  UNIQUE (event_type, event_id)
);
ALTER TABLE public.trip_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_plans_select ON public.trip_plans;
DROP POLICY IF EXISTS trip_plans_write  ON public.trip_plans;
CREATE POLICY trip_plans_select ON public.trip_plans FOR SELECT USING (public.can_see_trip(event_type, event_id));
CREATE POLICY trip_plans_write ON public.trip_plans FOR ALL
  USING (public.has_permission('manageTravel')) WITH CHECK (public.has_permission('manageTravel'));

-- ── Per-person trip details ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_members (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type    text   NOT NULL CHECK (event_type IN ('camp','match')),
  event_id      bigint NOT NULL,
  member_id     bigint NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  visa_status   text   NOT NULL DEFAULT 'unknown'
                CHECK (visa_status IN ('unknown','not_needed','to_apply','applied','approved','refused')),
  ticket_status text   NOT NULL DEFAULT 'pending' CHECK (ticket_status IN ('pending','booked')),
  room          text   NOT NULL DEFAULT '',
  notes         text   NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid DEFAULT auth.uid(),
  UNIQUE (event_type, event_id, member_id)
);
ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_members_select ON public.trip_members;
DROP POLICY IF EXISTS trip_members_write  ON public.trip_members;
CREATE POLICY trip_members_select ON public.trip_members FOR SELECT USING (
  public.has_permission('manageTravel') OR member_id = public.my_member_id());
CREATE POLICY trip_members_write ON public.trip_members FOR ALL
  USING (public.has_permission('manageTravel')) WITH CHECK (public.has_permission('manageTravel'));

-- Audit trail (same generic trigger as the other tables).
DROP TRIGGER IF EXISTS trg_log_member_documents ON public.member_documents;
CREATE TRIGGER trg_log_member_documents AFTER INSERT OR UPDATE OR DELETE ON public.member_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
DROP TRIGGER IF EXISTS trg_log_trip_plans ON public.trip_plans;
CREATE TRIGGER trg_log_trip_plans AFTER INSERT OR UPDATE OR DELETE ON public.trip_plans
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
DROP TRIGGER IF EXISTS trg_log_trip_members ON public.trip_members;
CREATE TRIGGER trg_log_trip_members AFTER INSERT OR UPDATE OR DELETE ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
