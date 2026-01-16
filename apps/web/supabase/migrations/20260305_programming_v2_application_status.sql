-- Extend programming_applications status values
alter table if exists public.programming_applications
  drop constraint if exists programming_applications_status_check;

alter table public.programming_applications
  add constraint programming_applications_status_check
  check (status in ('APPLIED', 'WITHDRAWN', 'REJECTED', 'ACCEPTED'));
