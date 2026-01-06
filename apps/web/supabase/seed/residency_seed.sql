-- Seed minimal pour Programmation en residence

-- Clients
insert into public.clients (id, name, notes)
values
  (gen_random_uuid(), 'Hotel Belle Saison', 'Seed demo')
on conflict do nothing;

-- Artists + profiles (10)
with artists_seed as (
  select gen_random_uuid() as id,
         'Artiste ' || gs as name,
         'artist' || gs || '@swingbooking.test' as email
  from generate_series(1, 10) gs
)
insert into public.profiles (id, full_name, email, role)
select id, name, email, 'artist'
from artists_seed
on conflict (id) do nothing;

insert into public.artists (id, stage_name, is_active)
select id, name, true
from (
  select id, name from artists_seed
) s
on conflict (id) do nothing;

-- Residency + weeks (Jan -> Apr)
with client_row as (
  select id from public.clients order by created_at desc limit 1
),
residency_row as (
  insert into public.residencies (client_id, name, start_date, end_date, lodging_included, meals_included, companion_included)
  select id, 'Residency Jan-Avr', date '2025-01-05', date '2025-04-13', true, true, true
  from client_row
  returning id, start_date, end_date
)
insert into public.residency_weeks (residency_id, start_date_sun, end_date_sun, type, performances_count, fee_cents)
select
  r.id,
  gs::date as start_date_sun,
  (gs + interval '7 days')::date as end_date_sun,
  'CALM'::public.residency_week_type,
  2,
  15000
from residency_row r
join generate_series(r.start_date, r.end_date - interval '7 days', interval '7 days') gs
  on true
on conflict (residency_id, start_date_sun) do nothing;
