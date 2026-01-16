-- Programming V2 core schema (clean, decoupled from legacy)

create table if not exists public.programming_programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  program_type text not null check (program_type in ('MULTI_DATES', 'WEEKLY_RESIDENCY')),
  is_public boolean not null default false,
  is_open boolean not null default true,
  conditions_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programming_programs is 'Programming V2 programs (flexible, condition-based).';
comment on column public.programming_programs.program_type is 'Program type (MULTI_DATES or WEEKLY_RESIDENCY).';
comment on column public.programming_programs.conditions_json is 'Modular conditions JSON for the program.';

create table if not exists public.programming_items (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programming_programs(id) on delete cascade,
  item_type text not null check (item_type in ('DATE', 'WEEK')),
  start_date date not null,
  end_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'CANCELLED')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.programming_items is 'Programming V2 items (dates or weeks).';
comment on column public.programming_items.item_type is 'DATE or WEEK.';
comment on column public.programming_items.metadata_json is 'Flexible item metadata (no hardcoded business rules).';

create table if not exists public.programming_applications (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.programming_items(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  status text not null default 'APPLIED' check (status in ('APPLIED', 'WITHDRAWN', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, artist_id)
);

comment on table public.programming_applications is 'Artist applications to Programming V2 items.';
comment on column public.programming_applications.status is 'Application status.';

create table if not exists public.programming_bookings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.programming_items(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  status text not null default 'CONFIRMED' check (status in ('CONFIRMED', 'CANCELLED')),
  conditions_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id)
);

comment on table public.programming_bookings is 'Confirmed bookings for Programming V2 items (one per item).';
comment on column public.programming_bookings.conditions_snapshot_json is 'Conditions snapshot at booking time.';

create index if not exists programming_programs_client_id_idx on public.programming_programs(client_id);
create index if not exists programming_programs_public_idx on public.programming_programs(is_public, is_open);
create index if not exists programming_items_program_id_idx on public.programming_items(program_id);
create index if not exists programming_items_status_idx on public.programming_items(status);
create index if not exists programming_applications_artist_id_idx on public.programming_applications(artist_id);
create index if not exists programming_bookings_artist_id_idx on public.programming_bookings(artist_id);

-- RLS
alter table public.programming_programs enable row level security;
alter table public.programming_items enable row level security;
alter table public.programming_applications enable row level security;
alter table public.programming_bookings enable row level security;

-- Admin full access
create policy programming_programs_admin_all on public.programming_programs
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy programming_items_admin_all on public.programming_items
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy programming_applications_admin_all on public.programming_applications
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy programming_bookings_admin_all on public.programming_bookings
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Artist read open programs
create policy programming_programs_artist_select on public.programming_programs
  for select
  using (
    is_public = true
    and is_open = true
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'artist'
    )
  );

-- Artist read open items or own items via applications/bookings
create policy programming_items_artist_select on public.programming_items
  for select
  using (
    exists (
      select 1
      from public.programming_programs pr
      join public.profiles p on p.id = auth.uid()
      where pr.id = programming_items.program_id
        and pr.is_public = true
        and pr.is_open = true
        and programming_items.status = 'OPEN'
        and p.role = 'artist'
    )
    or exists (
      select 1
      from public.programming_applications pa
      join public.artists a on a.id = pa.artist_id
      where pa.item_id = programming_items.id
        and (a.id = auth.uid() or a.user_id = auth.uid())
    )
    or exists (
      select 1
      from public.programming_bookings pb
      join public.artists a on a.id = pb.artist_id
      where pb.item_id = programming_items.id
        and (a.id = auth.uid() or a.user_id = auth.uid())
    )
  );

-- Artist applications (insert/select/update own)
create policy programming_applications_artist_insert on public.programming_applications
  for insert
  with check (
    exists (
      select 1
      from public.artists a
      join public.programming_items pi on pi.id = programming_applications.item_id
      join public.programming_programs pr on pr.id = pi.program_id
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = programming_applications.artist_id
        and pr.is_public = true
        and pr.is_open = true
        and pi.status = 'OPEN'
    )
  );

create policy programming_applications_artist_select on public.programming_applications
  for select
  using (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = programming_applications.artist_id
    )
  );

create policy programming_applications_artist_update on public.programming_applications
  for update
  using (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = programming_applications.artist_id
    )
  )
  with check (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = programming_applications.artist_id
    )
  );

-- Artist bookings (select own)
create policy programming_bookings_artist_select on public.programming_bookings
  for select
  using (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = programming_bookings.artist_id
    )
  );
