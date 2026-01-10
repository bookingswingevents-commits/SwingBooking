-- Residency terms mode and fee fields

alter table if exists public.residencies
  add column if not exists terms_mode text not null default 'WEEKLY',
  add column if not exists fee_amount_cents integer,
  add column if not exists fee_currency text not null default 'EUR',
  add column if not exists fee_is_net boolean not null default true;

do $$ begin
  alter table public.residencies
    add constraint residencies_terms_mode_check
    check (terms_mode in ('SIMPLE_FEE','INCLUDED','WEEKLY'));
exception when duplicate_object then null; end $$;
