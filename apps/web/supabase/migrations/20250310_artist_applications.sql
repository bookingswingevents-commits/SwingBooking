-- Artist applications (Phase 1 admin-operated onboarding)

create table if not exists public.artist_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage_name text not null,
  email text not null,
  phone text,
  city text,
  bio text,
  instagram_url text,
  formations_supported text[],
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  admin_notes text
);

create table if not exists public.artist_application_event_formats (
  application_id uuid references public.artist_applications(id) on delete cascade,
  event_format_id bigint references public.event_formats(id) on delete cascade,
  primary key (application_id, event_format_id)
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists artist_applications_updated_at on public.artist_applications;
create trigger artist_applications_updated_at
before update on public.artist_applications
for each row execute function public.set_updated_at();

-- RLS
alter table public.artist_applications enable row level security;
alter table public.artist_application_event_formats enable row level security;

-- Admin only (reads/updates via admin role)
create policy artist_applications_admin_all on public.artist_applications
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy artist_application_event_formats_admin_all on public.artist_application_event_formats
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
