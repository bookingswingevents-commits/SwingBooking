-- Minimal RLS for booking_requests + profiles (admin/venue/artist)

alter table public.booking_requests enable row level security;
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booking_requests' and policyname = 'booking_requests_admin_all'
  ) then
    execute 'create policy booking_requests_admin_all on public.booking_requests for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booking_requests' and policyname = 'booking_requests_venue_select'
  ) then
    execute 'create policy booking_requests_venue_select on public.booking_requests for select using (venue_id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booking_requests' and policyname = 'booking_requests_venue_update'
  ) then
    execute 'create policy booking_requests_venue_update on public.booking_requests for update using (venue_id = auth.uid()) with check (venue_id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'booking_requests' and policyname = 'booking_requests_artist_select'
  ) then
    execute $policy$
      create policy booking_requests_artist_select on public.booking_requests
      for select
      using (
        exists (
          select 1
          from public.request_artists ra
          join public.artists a on a.id = ra.artist_id
          where ra.request_id = booking_requests.id
            and a.user_id = auth.uid()
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_admin_all'
  ) then
    execute 'create policy profiles_admin_all on public.profiles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_select'
  ) then
    execute 'create policy profiles_self_select on public.profiles for select using (id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_update'
  ) then
    execute 'create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid())';
  end if;
end $$;
