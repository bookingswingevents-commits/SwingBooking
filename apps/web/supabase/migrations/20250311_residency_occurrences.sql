-- Add residency mode and occurrences for multi-date programming

alter table if exists public.residencies
  add column if not exists mode text not null default 'RANGE';

do $$ begin
  alter table public.residencies
    add constraint residencies_mode_check
    check (mode in ('RANGE','DATES'));
exception when duplicate_object then null; end $$;

create table if not exists public.residency_occurrences (
  id uuid primary key default gen_random_uuid(),
  residency_id uuid not null references public.residencies(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz not null default now(),
  unique (residency_id, date, start_time, end_time)
);

create index if not exists residency_occurrences_residency_date_idx
  on public.residency_occurrences(residency_id, date);

alter table public.residency_occurrences enable row level security;

create policy residency_occurrences_admin_all on public.residency_occurrences
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy residency_occurrences_public_select on public.residency_occurrences
  for select using (residency_id = public.residency_id_from_token());

create policy residency_occurrences_artist_public_select on public.residency_occurrences
  for select
  using (
    exists (
      select 1
      from public.residencies r
      join public.profiles p on p.id = auth.uid()
      where r.id = residency_occurrences.residency_id
        and r.is_public = true
        and p.role = 'artist'
    )
  );
