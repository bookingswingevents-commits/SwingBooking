-- Public artist portal for residencies

-- Add visibility fields
alter table if exists public.residencies
  add column if not exists is_public boolean not null default false,
  add column if not exists is_open boolean not null default true;

-- Link artists to auth.users
alter table if exists public.artists
  add column if not exists user_id uuid references auth.users(id) unique;

create index if not exists artists_user_id_idx on public.artists(user_id);
create index if not exists residencies_public_idx on public.residencies(is_public, is_open);

-- RLS policies for authenticated artists
create policy residencies_artist_public_select on public.residencies
  for select
  using (
    is_public = true
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'artist'
    )
  );

create policy residency_weeks_artist_public_select on public.residency_weeks
  for select
  using (
    exists (
      select 1
      from public.residencies r
      join public.profiles p on p.id = auth.uid()
      where r.id = residency_weeks.residency_id
        and r.is_public = true
        and p.role = 'artist'
    )
  );

create policy week_bookings_artist_public_select on public.week_bookings
  for select
  using (
    exists (
      select 1
      from public.residencies r
      join public.residency_weeks w on w.residency_id = r.id
      join public.profiles p on p.id = auth.uid()
      where w.id = week_bookings.residency_week_id
        and r.is_public = true
        and p.role = 'artist'
    )
  );

create policy week_applications_artist_insert on public.week_applications
  for insert
  with check (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = week_applications.artist_id
    )
  );

create policy week_applications_artist_select on public.week_applications
  for select
  using (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = week_applications.artist_id
    )
  );

create policy week_applications_artist_update on public.week_applications
  for update
  using (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = week_applications.artist_id
    )
  )
  with check (
    exists (
      select 1 from public.artists a
      where (a.id = auth.uid() or a.user_id = auth.uid())
        and a.id = week_applications.artist_id
    )
  );
