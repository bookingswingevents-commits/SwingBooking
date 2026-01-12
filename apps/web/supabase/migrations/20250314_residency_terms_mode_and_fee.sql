-- Extend residency terms mode to support RESIDENCY_WEEKLY (legacy values preserved)

alter table if exists public.residencies
  add column if not exists terms_mode text not null default 'RESIDENCY_WEEKLY',
  add column if not exists fee_amount_cents integer,
  add column if not exists fee_currency text not null default 'EUR',
  add column if not exists fee_is_net boolean not null default true;

alter table if exists public.residencies
  alter column terms_mode set default 'RESIDENCY_WEEKLY';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'residencies_terms_mode_check'
      and conrelid = 'public.residencies'::regclass
  ) then
    execute 'alter table public.residencies drop constraint residencies_terms_mode_check';
  end if;

  execute 'alter table public.residencies add constraint residencies_terms_mode_check check (terms_mode in (''SIMPLE_FEE'',''RESIDENCY_WEEKLY'',''INCLUDED'',''WEEKLY''))';
end $$;
