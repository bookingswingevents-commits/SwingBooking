-- Add week_type on residency_weeks + allow CANCELLED status

do $$ begin
  create type public.week_type as enum ('calm','strong');
exception when duplicate_object then null; end $$;

do $$ begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'residency_week_status' and e.enumlabel = 'CANCELLED'
  ) then
    alter type public.residency_week_status add value 'CANCELLED';
  end if;
end $$;

alter table public.residency_weeks
  add column if not exists week_type public.week_type;

update public.residency_weeks
set week_type = 'calm'
where week_type is null;

alter table public.residency_weeks
  alter column week_type set default 'calm';

-- RLS: artists can read weeks they are confirmed on
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'residency_weeks'
      and policyname = 'residency_weeks_artist_confirmed_select'
  ) then
    create policy residency_weeks_artist_confirmed_select on public.residency_weeks
      for select using (
        exists (
          select 1
          from public.week_bookings wb
          join public.artists a on a.id = wb.artist_id
          where wb.residency_week_id = residency_weeks.id
            and wb.status = 'CONFIRMED'
            and a.user_id = auth.uid()
        )
      );
  end if;
end $$;
