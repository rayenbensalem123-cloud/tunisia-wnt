-- The audit trigger on member_documents / trip_plans / trip_members (0010) writes
-- those table names into activity_log.entity_type, which is restricted by a CHECK.
-- Without this, every insert into the new tables would fail. Safe to re-run.
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_entity_type_check;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_entity_type_check CHECK (entity_type = ANY (ARRAY[
  'members','matches','camps','injuries','profiles','squad_templates','club_match_reports','meetings','club_reports',
  'member_documents','trip_plans','trip_members'
])) NOT VALID;
