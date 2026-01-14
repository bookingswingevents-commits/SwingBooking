-- Roadmap templates for residencies (calm/strong)

do $$ begin
  create type public.week_type as enum ('calm','strong');
exception when duplicate_object then null; end $$;

create table if not exists public.roadmap_templates (
  id uuid primary key default gen_random_uuid(),
  residency_id uuid not null references public.residencies(id) on delete cascade,
  week_type public.week_type not null,
  title text not null default '',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (residency_id, week_type)
);

create index if not exists roadmap_templates_residency_id_idx
  on public.roadmap_templates(residency_id);
create index if not exists roadmap_templates_week_type_idx
  on public.roadmap_templates(week_type);

-- Add week_type to residency_weeks for matching templates
alter table public.residency_weeks
  add column if not exists week_type public.week_type;

update public.residency_weeks
set week_type = case
  when type = 'CALM' then 'calm'::public.week_type
  when type = 'BUSY' then 'strong'::public.week_type
  else null
end
where week_type is null;

-- updated_at trigger for roadmap_templates
drop trigger if exists roadmap_templates_updated_at on public.roadmap_templates;
create trigger roadmap_templates_updated_at
before update on public.roadmap_templates
for each row execute function public.set_updated_at();

-- RLS
alter table public.roadmap_templates enable row level security;

create policy roadmap_templates_admin_all on public.roadmap_templates
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy roadmap_templates_artist_read on public.roadmap_templates
  for select using (
    exists (
      select 1
      from public.week_bookings wb
      join public.residency_weeks rw on rw.id = wb.residency_week_id
      join public.artists a on a.id = wb.artist_id
      where rw.residency_id = roadmap_templates.residency_id
        and wb.status = 'CONFIRMED'
        and a.user_id = auth.uid()
    )
  );
