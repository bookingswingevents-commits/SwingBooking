create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  to_email text not null,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_event_type_created_at_idx
  on public.email_logs(event_type, created_at desc);

alter table public.email_logs enable row level security;
