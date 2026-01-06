-- Full stabilization patch 2025-11-08
-- Objectifs :
--  - Aligner le schéma avec le front (snapshots venue, formation, horaires, réseaux sociaux)
--  - Harmoniser les statuts demande/proposition/invitations
--  - Ajouter les tables utilitaires (request_pricing, itinéraires enrichis)
--  - Ajouter/mettre à jour les fonctions RPC utilisées par l’app
--  - Étendre l’enum d’abonnement et dates de plan

--------------------------------------------------------------------------------
-- Helpers
--------------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

--------------------------------------------------------------------------------
-- Abonnements / venues
--------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'subscription_plan') then
    create type public.subscription_plan as enum ('free','starter','pro','premium');
  end if;
end $$;

-- Ajoute la valeur "free" si absente
do $$
begin
  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' and t.typname = 'subscription_plan')
     and not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                     where t.typname = 'subscription_plan' and enumlabel = 'free') then
    alter type public.subscription_plan add value if not exists 'free';
  end if;
end $$;

alter table if exists public.venues
  add column if not exists is_pro boolean not null default false,
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_expires_at timestamptz,
  add column if not exists address_line1 text,
  add column if not exists postal_code text,
  add column if not exists contact_name text,
  add column if not exists billing_email text,
  add column if not exists contact_phone text;

alter table if exists public.venues
  alter column subscription_plan set default 'free';

update public.venues set subscription_plan = coalesce(subscription_plan, 'free');

--------------------------------------------------------------------------------
-- Booking requests : snapshots + formation + horaires + commission
--------------------------------------------------------------------------------
-- Statuts harmonisés
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'booking_request_status') then
    create type public.booking_request_status as enum (
      'pending','reviewing','sent_to_artists','proposal_sent','client_review',
      'client_approved','client_declined','confirmed','cancelled','archived'
    );
  end if;
end $$;


alter table if exists public.booking_requests
  add column if not exists event_format text,
  add column if not exists formation text,
  add column if not exists start_time text,
  add column if not exists duration_minutes int,
  add column if not exists venue_company_name text,
  add column if not exists venue_address text,
  add column if not exists venue_contact_name text,
  add column if not exists venue_contact_phone text,
  add column if not exists venue_contact_email text,
  add column if not exists practical_info text,
  add column if not exists commission_rate numeric(6,4) default 0;

--------------------------------------------------------------------------------
-- Artists : formations + réseaux sociaux + actif
--------------------------------------------------------------------------------
alter table if exists public.artists
  add column if not exists formations text[],
  add column if not exists tech_needs text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists facebook_url text,
  add column if not exists tiktok_url text,
  add column if not exists contact_phone text,
  add column if not exists instagram_media_url text,
  add column if not exists is_active boolean not null default true;

--------------------------------------------------------------------------------
-- Request artists : statut + réponse
--------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'request_artist_status') then
    create type public.request_artist_status as enum ('invited','accepted','declined');
  end if;
end $$;

alter table if exists public.request_artists
  add column if not exists status public.request_artist_status not null default 'invited',
  add column if not exists response_message text,
  add column if not exists responded_at timestamptz;

--------------------------------------------------------------------------------
-- Proposals : statut aligné + note client
--------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'proposal_status') then
    create type public.proposal_status as enum ('sent','accepted','rejected','needs_changes');
  end if;
end $$;

alter table if exists public.proposals
  add column if not exists client_note text;


--------------------------------------------------------------------------------
-- Itineraries enrichies
--------------------------------------------------------------------------------
alter table if exists public.itineraries
  add column if not exists request_id uuid references public.booking_requests(id) on delete cascade,
  add column if not exists target text, -- 'client' | 'artist'
  add column if not exists title text,
  add column if not exists data_json jsonb default '{}'::jsonb;

--------------------------------------------------------------------------------
-- Pricing table
--------------------------------------------------------------------------------
create table if not exists public.request_pricing (
  id bigserial primary key,
  request_id uuid references public.booking_requests(id) on delete cascade unique,
  client_quote numeric(12,2),
  artist_fee numeric(12,2),
  internal_costs numeric(12,2),
  currency text default 'EUR',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

--------------------------------------------------------------------------------
-- RPC: helpers roles
--------------------------------------------------------------------------------
create or replace function public.is_admin(_uid uuid) returns boolean stable as $$
  select exists (select 1 from public.profiles p where p.id = _uid and p.role = 'admin');
$$ language sql;

--------------------------------------------------------------------------------
-- RPC: admin_invite_artists
--------------------------------------------------------------------------------
create or replace function public.admin_invite_artists(_request_id uuid, _artist_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  inserted int := 0;
begin
  if caller is null or not public.is_admin(caller) then
    raise exception 'forbidden';
  end if;

  if _request_id is null or _artist_ids is null or array_length(_artist_ids,1) is null then
    return 0;
  end if;

  insert into public.request_artists(request_id, artist_id, invited_by, status)
  select _request_id, unnest(_artist_ids), caller, 'invited'
  on conflict (request_id, artist_id) do update set status = excluded.status
  returning 1 into inserted;

  update public.booking_requests
    set status = 'sent_to_artists', updated_at = now()
    where id = _request_id;

  return coalesce(inserted, 0);
end;
$$;

--------------------------------------------------------------------------------
-- RPC: admin_create_proposal
--------------------------------------------------------------------------------
create or replace function public.admin_create_proposal(_request_id uuid, _artist_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_id uuid;
begin
  if caller is null or not public.is_admin(caller) then
    raise exception 'forbidden';
  end if;

  if _request_id is null or _artist_id is null then
    raise exception 'missing params';
  end if;

  insert into public.proposals(request_id, artist_id, status)
  values (_request_id, _artist_id, 'sent')
  returning id into new_id;

  -- Marque la demande
  update public.booking_requests
    set status = 'proposal_sent', updated_at = now()
    where id = _request_id;

  -- Marque l'invitation comme acceptée si elle existe
  update public.request_artists
    set status = 'accepted', responded_at = now()
    where request_id = _request_id and artist_id = _artist_id;

  return new_id;
end;
$$;

--------------------------------------------------------------------------------
-- RPC: admin_delete_booking_request
-- (la fonction existe déjà dans la base, on ne la redéfinit pas ici
--  pour éviter l’erreur "cannot change return type of existing function")
--------------------------------------------------------------------------------
-- create or replace function public.admin_delete_booking_request(_request_id uuid)
-- returns boolean
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   caller uuid := auth.uid();
-- begin
--   if caller is null or not public.is_admin(caller) then
--     raise exception 'forbidden';
--   end if;
--   delete from public.booking_requests where id = _request_id;
--   return found;
-- end;
-- $$;

--------------------------------------------------------------------------------
-- RPC: artist_reply_invitation
--------------------------------------------------------------------------------
create or replace function public.artist_reply_invitation(_request_id uuid, _answer text, _reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  new_status public.request_artist_status;
begin
  if caller is null then
    raise exception 'auth required';
  end if;
  if lower(coalesce(_answer,'')) not in ('accepted','declined') then
    raise exception 'invalid answer';
  end if;

  new_status := case when lower(_answer) = 'accepted' then 'accepted' else 'declined' end;

  update public.request_artists
    set status = new_status,
        response_message = _reason,
        responded_at = now()
    where request_id = _request_id and artist_id = caller;

  return true;
end;
$$;

--------------------------------------------------------------------------------
-- RPC: venue_update_proposal (accept / decline / changes)
-- La fonction existe déjà dans la base avec une autre signature.
-- On NE la redéfinit pas ici pour éviter l’erreur "cannot change return type
-- of existing function". La logique métier (packs, quotas, commission, etc.)
-- est gérée côté serveur dans l’API /api/proposals/respond.
--------------------------------------------------------------------------------
-- create or replace function public.venue_update_proposal(
--   _proposal_id uuid,
--   _action text,
--   _message text default null
-- ) returns text
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   caller uuid := auth.uid();
--   req_id uuid;
--   art_id uuid;
--   plan public.subscription_plan := 'free';
--   new_prop_status public.proposal_status;
--   new_req_status public.booking_request_status;
--   mod_limit int := null;
--   monthly_limit int := null;
--   used_mods int := 0;
--   used_events int := 0;
--   v_id uuid;
-- begin
--   -- … (corps original commenté)
--   return new_prop_status::text;
-- end;
-- $$;


--------------------------------------------------------------------------------
-- RPC: list_roadmaps_for_current_user
-- Une version de cette fonction existe déjà dans la base avec un autre
-- RETURNS TABLE. On ne la redéfinit pas ici pour éviter l’erreur
-- "cannot change return type of existing function".
--------------------------------------------------------------------------------
-- create or replace function public.list_roadmaps_for_current_user(_role text)
-- returns table (
--   request_id uuid,
--   proposal_id uuid,
--   event_date date,
--   start_time text,
--   duration_minutes int,
--   event_format text,
--   formation text,
--   title text,
--   venue_address text,
--   artist_id uuid,
--   artist_stage_name text,
--   tech_needs text,
--   status text
-- ) language sql
-- security definer
-- set search_path = public
-- as $$
--   select
--     r.id as request_id,
--     p.id as proposal_id,
--     r.event_date,
--     r.start_time,
--     r.duration_minutes,
--     r.event_format,
--     r.formation,
--     coalesce(i.title, r.title) as title,
--     r.venue_address,
--     p.artist_id,
--     a.stage_name as artist_stage_name,
--     a.tech_needs,
--     r.status
--   from public.itineraries i
--   left join public.proposals p on p.id = i.proposal_id
--   join public.booking_requests r on r.id = coalesce(i.request_id, p.request_id)
--   left join public.artists a on a.id = p.artist_id
--   where
--     case
--       when lower(coalesce(_role,'')) = 'artist' then p.artist_id = auth.uid()
--       else r.venue_id = auth.uid()
--     end;
-- $$;


--------------------------------------------------------------------------------
-- RPC: admin_send_runsheets (+ alias)
--------------------------------------------------------------------------------
create or replace function public.admin_send_runsheets(_request_id uuid default null, _proposal_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  req_id uuid;
  prop_id uuid;
begin
  if caller is null or not public.is_admin(caller) then
    raise exception 'forbidden';
  end if;

  if _proposal_id is not null then
    select id, request_id into prop_id, req_id from public.proposals where id = _proposal_id;
  elsif _request_id is not null then
    select id into prop_id from public.proposals where request_id = _request_id order by created_at desc limit 1;
    req_id := _request_id;
  end if;

  if req_id is null then
    raise exception 'request not found';
  end if;

  if prop_id is null then
    insert into public.itineraries(request_id, target, title)
    values (req_id, 'client', 'Feuille de route client'),
           (req_id, 'artist', 'Feuille de route artiste');
  else
    insert into public.itineraries(request_id, proposal_id, target, title)
    values (req_id, prop_id, 'client', 'Feuille de route client'),
           (req_id, prop_id, 'artist', 'Feuille de route artiste')
    on conflict do nothing;
  end if;

  update public.booking_requests set status = 'confirmed', updated_at = now() where id = req_id;
  return true;
end;
$$;

create or replace function public.admin_send_run_sheets(_request_id uuid default null, _proposal_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.admin_send_runsheets(_request_id, _proposal_id);
$$;

create or replace function public.admin_send_feuilles_de_route(_request_id uuid default null, _proposal_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.admin_send_runsheets(_request_id, _proposal_id);
$$;

create or replace function public.admin_send_roadmap(_request_id uuid default null, _proposal_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.admin_send_runsheets(_request_id, _proposal_id);
$$;

--------------------------------------------------------------------------------
-- Indexes utiles
--------------------------------------------------------------------------------
create index if not exists booking_requests_status_idx on public.booking_requests(status);
create index if not exists proposals_request_idx on public.proposals(request_id);
create index if not exists request_artists_request_idx on public.request_artists(request_id);
create index if not exists itineraries_request_idx on public.itineraries(request_id);
