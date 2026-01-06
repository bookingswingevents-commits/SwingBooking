-- Table de demandes de kit de communication / "Tout passe par là"
create table if not exists public.communication_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id) on delete cascade,
  requested_by_user_id uuid null,
  requested_by_role text not null check (requested_by_role in ('venue','artist')),
  contact_email text not null,
  status text not null default 'new' check (status in ('new','contacted','scheduled','delivered')),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists communication_requests_request_id_idx
  on public.communication_requests(request_id);
