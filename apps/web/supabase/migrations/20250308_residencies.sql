-- Résidences / Programmation en résidence

-- Enums
do $$ begin
  create type public.residency_week_type as enum ('CALM', 'BUSY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.residency_week_status as enum ('OPEN', 'CONFIRMED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.week_application_status as enum ('APPLIED', 'WITHDRAWN', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.week_booking_status as enum ('CONFIRMED', 'CANCELLED');
exception when duplicate_object then null; end $$;

-- Base tables
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.residencies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  lodging_included boolean not null default true,
  meals_included boolean not null default true,
  companion_included boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.residency_invitations (
  id uuid primary key default gen_random_uuid(),
  residency_id uuid not null references public.residencies(id) on delete cascade,
  token text not null unique,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending','sent','failed','mocked')),
  target_filter jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.residency_weeks (
  id uuid primary key default gen_random_uuid(),
  residency_id uuid not null references public.residencies(id) on delete cascade,
  start_date_sun date not null,
  end_date_sun date not null,
  type public.residency_week_type not null,
  performances_count int not null check (performances_count in (2,4)),
  fee_cents int not null check (fee_cents in (15000,30000)),
  status public.residency_week_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  unique (residency_id, start_date_sun)
);

create table if not exists public.week_applications (
  id uuid primary key default gen_random_uuid(),
  residency_week_id uuid not null references public.residency_weeks(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  invitation_id uuid references public.residency_invitations(id) on delete set null,
  status public.week_application_status not null default 'APPLIED',
  created_at timestamptz not null default now(),
  unique (residency_week_id, artist_id)
);

create table if not exists public.week_bookings (
  id uuid primary key default gen_random_uuid(),
  residency_week_id uuid not null references public.residency_weeks(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  status public.week_booking_status not null default 'CONFIRMED',
  confirmed_at timestamptz not null default now()
);

alter table public.residency_weeks
  add column if not exists confirmed_booking_id uuid references public.week_bookings(id) on delete set null;

-- Indexes
create index if not exists residencies_client_id_idx on public.residencies(client_id);
create index if not exists residency_weeks_residency_id_idx on public.residency_weeks(residency_id);
create index if not exists week_applications_week_id_idx on public.week_applications(residency_week_id);
create index if not exists week_applications_artist_id_idx on public.week_applications(artist_id);
create index if not exists week_bookings_week_id_idx on public.week_bookings(residency_week_id);
create index if not exists residency_invitations_residency_id_idx on public.residency_invitations(residency_id);

create unique index if not exists week_bookings_confirmed_unique
  on public.week_bookings(residency_week_id)
  where status = 'CONFIRMED';

-- Helper functions
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

create or replace function public.current_residency_token()
returns text
language sql
stable
as $$
  select nullif((current_setting('request.headers', true)::json ->> 'x-residency-token')::text, '');
$$;

create or replace function public.residency_id_from_token()
returns uuid
language sql
stable
as $$
  select ri.residency_id
  from public.residency_invitations ri
  where ri.token = public.current_residency_token()
  limit 1;
$$;

create or replace function public.artist_id_from_token()
returns uuid
language sql
stable
as $$
  select (ri.target_filter ->> 'artist_id')::uuid
  from public.residency_invitations ri
  where ri.token = public.current_residency_token()
  limit 1;
$$;

-- Confirmation RPCs
create or replace function public.confirm_residency_week(p_week_id uuid, p_artist_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_status public.residency_week_status;
  v_booking_id uuid;
begin
  select status
    into v_status
    from public.residency_weeks
    where id = p_week_id
    for update;

  if not found then
    raise exception 'Week not found';
  end if;

  if v_status <> 'OPEN' then
    raise exception 'Week not open';
  end if;

  if not exists (
    select 1 from public.week_applications
    where residency_week_id = p_week_id
      and artist_id = p_artist_id
      and status = 'APPLIED'
  ) then
    raise exception 'Artist not applied';
  end if;

  insert into public.week_bookings (residency_week_id, artist_id, status, confirmed_at)
  values (p_week_id, p_artist_id, 'CONFIRMED', now())
  returning id into v_booking_id;

  update public.residency_weeks
    set status = 'CONFIRMED',
        confirmed_booking_id = v_booking_id
  where id = p_week_id;

  update public.week_applications
    set status = case when artist_id = p_artist_id then 'APPLIED' else 'REJECTED' end
  where residency_week_id = p_week_id;

  return v_booking_id;
end;
$$;

create or replace function public.cancel_residency_week_confirmation(p_week_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_booking_id uuid;
begin
  select confirmed_booking_id
    into v_booking_id
    from public.residency_weeks
    where id = p_week_id
    for update;

  if not found then
    raise exception 'Week not found';
  end if;

  update public.residency_weeks
    set status = 'OPEN',
        confirmed_booking_id = null
  where id = p_week_id;

  if v_booking_id is not null then
    update public.week_bookings
      set status = 'CANCELLED'
    where id = v_booking_id;
  end if;

  update public.week_applications
    set status = 'APPLIED'
  where residency_week_id = p_week_id
    and status = 'REJECTED';
end;
$$;

-- RLS
alter table public.clients enable row level security;
alter table public.residencies enable row level security;
alter table public.residency_invitations enable row level security;
alter table public.residency_weeks enable row level security;
alter table public.week_applications enable row level security;
alter table public.week_bookings enable row level security;

create policy clients_admin_all on public.clients
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy residencies_admin_all on public.residencies
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy residency_invitations_admin_all on public.residency_invitations
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy residency_weeks_admin_all on public.residency_weeks
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy week_applications_admin_all on public.week_applications
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy week_bookings_admin_all on public.week_bookings
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Public token access
create policy residencies_public_select on public.residencies
  for select using (id = public.residency_id_from_token());

create policy residency_weeks_public_select on public.residency_weeks
  for select using (residency_id = public.residency_id_from_token());

create policy residency_invitations_public_select on public.residency_invitations
  for select using (token = public.current_residency_token());

create policy week_applications_public_select on public.week_applications
  for select using (artist_id = public.artist_id_from_token());

create policy week_applications_public_insert on public.week_applications
  for insert
  with check (
    artist_id = public.artist_id_from_token()
    and residency_week_id in (
      select id from public.residency_weeks
      where residency_id = public.residency_id_from_token()
        and status = 'OPEN'
    )
  );

create policy week_applications_public_update on public.week_applications
  for update
  using (
    artist_id = public.artist_id_from_token()
    and residency_week_id in (
      select id from public.residency_weeks
      where residency_id = public.residency_id_from_token()
        and status = 'OPEN'
    )
  )
  with check (
    artist_id = public.artist_id_from_token()
    and residency_week_id in (
      select id from public.residency_weeks
      where residency_id = public.residency_id_from_token()
        and status = 'OPEN'
    )
  );
