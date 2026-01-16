-- Programming V2 application/booking option snapshots
alter table if exists public.programming_applications
  add column if not exists option_json jsonb not null default '{}'::jsonb;

comment on column public.programming_applications.option_json is 'Selected option when applying.';

alter table if exists public.programming_bookings
  add column if not exists option_json jsonb not null default '{}'::jsonb;

comment on column public.programming_bookings.option_json is 'Selected option snapshot at booking.';
