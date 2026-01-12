-- Client contact + address fields and residency event address fields

alter table if exists public.clients
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists billing_address_line1 text,
  add column if not exists billing_address_line2 text,
  add column if not exists billing_zip text,
  add column if not exists billing_city text,
  add column if not exists billing_country text,
  add column if not exists default_event_address_line1 text,
  add column if not exists default_event_address_line2 text,
  add column if not exists default_event_zip text,
  add column if not exists default_event_city text,
  add column if not exists default_event_country text;

alter table if exists public.residencies
  add column if not exists event_address_line1 text,
  add column if not exists event_address_line2 text,
  add column if not exists event_address_zip text,
  add column if not exists event_address_city text,
  add column if not exists event_address_country text;
