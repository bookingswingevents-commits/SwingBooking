-- Residency program type + conditions JSON + roadmap overrides
alter table if exists public.residencies
  add column if not exists program_type text not null default 'WEEKLY_RESIDENCY',
  add column if not exists conditions_json jsonb not null default '{}'::jsonb,
  add column if not exists roadmap_overrides_json jsonb not null default '{}'::jsonb;

update public.residencies
  set program_type = 'MULTI_DATES'
where mode = 'DATES';

update public.residencies
  set conditions_json = coalesce(conditions_json, '{}'::jsonb) || jsonb_build_object(
    'lodging', jsonb_build_object(
      'included', lodging_included,
      'companion_included', companion_included
    ),
    'meals', jsonb_build_object(
      'included', meals_included
    )
  )
where conditions_json is null or conditions_json = '{}'::jsonb;

with week_values as (
  select
    residency_id,
    max(case when coalesce(week_type, case when type = 'BUSY' then 'strong' else 'calm' end) = 'calm'
      then fee_cents end) as calm_fee,
    max(case when coalesce(week_type, case when type = 'BUSY' then 'strong' else 'calm' end) = 'calm'
      then performances_count end) as calm_performances,
    max(case when coalesce(week_type, case when type = 'BUSY' then 'strong' else 'calm' end) = 'strong'
      then fee_cents end) as peak_fee,
    max(case when coalesce(week_type, case when type = 'BUSY' then 'strong' else 'calm' end) = 'strong'
      then performances_count end) as peak_performances
  from public.residency_weeks
  group by residency_id
)
update public.residencies r
set conditions_json = jsonb_set(
  coalesce(r.conditions_json, '{}'::jsonb),
  '{remuneration}',
  jsonb_build_object(
    'mode', 'PER_WEEK',
    'currency', coalesce(r.fee_currency, 'EUR'),
    'is_net', coalesce(r.fee_is_net, true),
    'per_week', jsonb_build_object(
      'calm', jsonb_build_object('fee_cents', w.calm_fee, 'performances_count', w.calm_performances),
      'peak', jsonb_build_object('fee_cents', w.peak_fee, 'performances_count', w.peak_performances)
    )
  ),
  true
)
from week_values w
where r.id = w.residency_id and r.mode <> 'DATES';

update public.residencies r
set conditions_json = jsonb_set(
  coalesce(r.conditions_json, '{}'::jsonb),
  '{remuneration}',
  jsonb_build_object(
    'mode', 'PER_DATE',
    'currency', coalesce(r.fee_currency, 'EUR'),
    'is_net', coalesce(r.fee_is_net, true),
    'per_date', jsonb_build_object('amount_cents', r.fee_amount_cents)
  ),
  true
)
where r.mode = 'DATES' and r.fee_amount_cents is not null;
