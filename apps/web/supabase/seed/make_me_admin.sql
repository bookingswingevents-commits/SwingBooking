-- Usage: replace :user_id with your auth user id
-- Example:
--   user_id = '00000000-0000-0000-0000-000000000000'

alter table if exists public.profiles
  add column if not exists role text;

insert into public.profiles (id, role)
values (:'user_id', 'admin')
on conflict (id)
do update set role = 'admin';
