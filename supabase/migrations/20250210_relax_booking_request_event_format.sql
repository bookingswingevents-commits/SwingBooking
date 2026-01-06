-- Assouplit la contrainte sur booking_requests.event_format pour accepter les
-- nouveaux slugs du catalogue (hyphens/underscores).
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'booking_requests_event_format_chk') then
    alter table public.booking_requests drop constraint booking_requests_event_format_chk;
  end if;
end $$;

alter table public.booking_requests
  add constraint booking_requests_event_format_chk
  check (
    event_format is null
    or event_format ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'
  );
