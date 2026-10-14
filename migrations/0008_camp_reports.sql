-- One report per staff member for each camp (list of {id,url,name,staffId,staffName,role,addedAt}).
alter table public.camps add column if not exists reports jsonb not null default '[]';
