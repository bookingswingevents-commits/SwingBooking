-- Programming V2 program status
alter table if exists public.programming_programs
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'published', 'archived'));

comment on column public.programming_programs.status is 'Program status (draft/published/archived).';

create index if not exists programming_programs_status_idx on public.programming_programs(status);
