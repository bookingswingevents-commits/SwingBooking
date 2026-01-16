-- Admin booking confirmation RPC for Programming V2
create or replace function public.admin_create_programming_booking(
  p_item_id uuid,
  p_application_id uuid,
  p_snapshot jsonb,
  p_option jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_booking_id uuid;
  v_status text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'NOT_ADMIN';
  end if;

  select status
    into v_status
    from public.programming_items
    where id = p_item_id
    for update;

  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if v_status <> 'OPEN' then
    raise exception 'ITEM_NOT_OPEN';
  end if;

  if exists (select 1 from public.programming_bookings where item_id = p_item_id) then
    raise exception 'BOOKING_EXISTS';
  end if;

  if not exists (
    select 1
    from public.programming_applications
    where id = p_application_id
      and item_id = p_item_id
  ) then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  insert into public.programming_bookings (item_id, artist_id, status, conditions_snapshot_json, option_json)
  select item_id, artist_id, 'CONFIRMED', p_snapshot, coalesce(p_option, '{}'::jsonb)
  from public.programming_applications
  where id = p_application_id
  returning id into v_booking_id;

  update public.programming_items
    set status = 'CLOSED'
    where id = p_item_id;

  update public.programming_applications
    set status = 'ACCEPTED'
    where id = p_application_id;

  update public.programming_applications
    set status = 'REJECTED'
    where item_id = p_item_id
      and id <> p_application_id;

  return v_booking_id;
end;
$$;
