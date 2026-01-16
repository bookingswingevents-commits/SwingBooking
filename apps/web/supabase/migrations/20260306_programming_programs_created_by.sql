-- Add created_by to programming_programs for auditability

alter table public.programming_programs
  add column if not exists created_by uuid;

alter table public.programming_programs
  alter column created_by set default auth.uid();

create index if not exists programming_programs_created_by_idx
  on public.programming_programs(created_by);
