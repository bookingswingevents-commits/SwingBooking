do $$
begin
  -- Ici on enlève le check constraint existant (si présent) pour le recréer proprement.
  if exists (
    select 1
    from pg_constraint
    where conname = 'programming_items_status_check'
  ) then
    alter table public.programming_items
      drop constraint programming_items_status_check;
  end if;
end $$;

-- Recrée le check constraint en autorisant les statuts attendus
alter table public.programming_items
  add constraint programming_items_status_check
  check (status in ('DRAFT','OPEN','CLOSED','CANCELLED','CONFIRMED'));

notify pgrst, 'reload schema';
