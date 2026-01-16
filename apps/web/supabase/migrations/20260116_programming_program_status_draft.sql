do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'programming_program_status'
      and e.enumlabel = 'DRAFT'
  ) then
    alter type public.programming_program_status add value 'DRAFT';
  end if;
end $$;

notify pgrst, 'reload schema';
