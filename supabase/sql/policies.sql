
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.artists enable row level security;
alter table public.booking_requests enable row level security;
alter table public.request_artists enable row level security;
alter table public.availability_responses enable row level security;
alter table public.proposals enable row level security;
alter table public.itineraries enable row level security;
alter table public.feedbacks enable row level security;
alter table public.invoices enable row level security;
alter table public.notifications enable row level security;
alter table public.request_pricing enable row level security;

-- Profiles
create policy "read own profile or public" on public.profiles
for select using (
  auth.uid() = id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "update own profile" on public.profiles
for update using ( auth.uid() = id );

-- Venues
create policy "venue can read/update own" on public.venues
for select using ( auth.uid() = id );
create policy "venue can update own" on public.venues
for update using ( auth.uid() = id );
create policy "admin can read all venues" on public.venues
for all using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin') );

-- Artists
create policy "artist can read/update own" on public.artists
for select using ( auth.uid() = id );
create policy "artist can update own" on public.artists
for update using ( auth.uid() = id );
create policy "admin can read all artists" on public.artists
for all using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin') );
create policy "premium venue can read artists" on public.artists
for select using (
  exists (
    select 1 from public.venues v
    where v.id = auth.uid()
      and (v.subscription_plan = 'premium' or v.is_pro = true)
  )
);

-- Booking requests
create policy "venue can manage own requests" on public.booking_requests
for all using ( auth.uid() = venue_id );

create policy "artist can view invited requests" on public.booking_requests
for select using ( exists (select 1 from public.request_artists ra where ra.request_id = id and ra.artist_id = auth.uid()) );

create policy "admin manage all requests" on public.booking_requests
for all using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin') );

-- Request artists
create policy "artist can read own invitations" on public.request_artists
for select using ( artist_id = auth.uid() );
create policy "admin/venue insert invitations" on public.request_artists
for insert with check (
  (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  or (exists (select 1 from public.booking_requests r where r.id=request_id and r.venue_id=auth.uid()))
);

-- Availability
create policy "artist upsert availability for invited requests" on public.availability_responses
for all using ( artist_id = auth.uid() );

-- Proposals
create policy "admin create proposals" on public.proposals
for insert with check ( exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') );

create policy "venue read proposals for own requests" on public.proposals
for select using ( exists (select 1 from public.booking_requests r where r.id = request_id and r.venue_id = auth.uid()) );

create policy "artist read own proposals" on public.proposals
for select using ( artist_id = auth.uid() );

-- Itineraries
create policy "venue & artist read itineraries of their proposals" on public.itineraries
for select using ( exists (select 1 from public.proposals pr where pr.id = proposal_id and (pr.artist_id = auth.uid() or exists (select 1 from public.booking_requests r where r.id = pr.request_id and r.venue_id = auth.uid()))) );

-- Feedbacks
create policy "user create feedbacks for their requests" on public.feedbacks
for insert with check (
  exists (select 1 from public.booking_requests r where r.id = request_id and (r.venue_id = auth.uid()
    or exists (select 1 from public.request_artists ra where ra.request_id=r.id and ra.artist_id=auth.uid())))
);

-- Invoices
create policy "artist & venue read their invoices" on public.invoices
for select using ( artist_id = auth.uid() or venue_id = auth.uid() );


alter table public.venue_unlocked_artists enable row level security;

-- Venue unlocked artists
create policy "venue_read_own_unlocked_artists" on public.venue_unlocked_artists
for select using ( auth.uid() = venue_id );

create policy "venue_insert_own_unlocked_artists" on public.venue_unlocked_artists
for insert with check ( auth.uid() = venue_id );

create policy "venue_delete_own_unlocked_artists" on public.venue_unlocked_artists
for delete using ( auth.uid() = venue_id );

create policy "admin_manage_unlocked_artists" on public.venue_unlocked_artists
for all using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') );

-- Request pricing (admin only)
create policy "admin_read_request_pricing" on public.request_pricing
for select using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') );
create policy "admin_write_request_pricing" on public.request_pricing
for all using ( exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') );
