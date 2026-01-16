-- Programming V2 program status
alter table if exists public.programming_programs
  add column if not exists status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED'));

comment on column public.programming_programs.status is 'Program status (DRAFT/PUBLISHED/ARCHIVED).';

create index if not exists programming_programs_status_idx on public.programming_programs(status);
