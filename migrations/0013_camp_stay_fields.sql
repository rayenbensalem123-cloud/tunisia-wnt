-- Camp page: drop the travel & logistics panel in favour of simple stay fields.
alter table public.camps add column if not exists country text not null default '';
alter table public.camps add column if not exists state text not null default '';
alter table public.camps add column if not exists hotel text not null default '';
alter table public.camps add column if not exists arrival_date text not null default '';
alter table public.camps add column if not exists departure_date text not null default '';
