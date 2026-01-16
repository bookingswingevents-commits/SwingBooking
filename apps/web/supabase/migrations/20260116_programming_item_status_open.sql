-- Add missing enum value used by the app
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'programming_item_status'
      and e.enumlabel = 'OPEN'
  ) then
    alter type public.programming_item_status add value 'OPEN';
  end if;
end $$;

notify pgrst, 'reload schema';
