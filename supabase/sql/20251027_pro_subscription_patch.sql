-- Patch: add pro subscription gating
alter table if exists public.venues
  add column if not exists is_pro boolean not null default false;

create index if not exists venues_is_pro_idx on public.venues(is_pro);
