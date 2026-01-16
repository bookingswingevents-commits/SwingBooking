alter table public.programming_items
add column if not exists item_type text not null default 'WEEK';

notify pgrst, 'reload schema';
