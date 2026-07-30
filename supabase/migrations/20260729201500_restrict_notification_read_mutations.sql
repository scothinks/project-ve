drop policy if exists "Users can update their notifications" on public.user_notifications;

revoke update on public.user_notifications from anon, authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid()
    and read_at is null;

  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and read_at is null;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'public',
    'mark_notification_read',
    'p_notification_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners marking one of their own notifications as read.',
    'Uses auth.uid() as the only user identity source and only updates read_at on matching unread notifications.',
    array['authenticated']
  ),
  (
    'public',
    'mark_all_notifications_read',
    '',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners marking all of their own notifications as read.',
    'Uses auth.uid() as the only user identity source and only updates read_at on matching unread notifications.',
    array['authenticated']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
