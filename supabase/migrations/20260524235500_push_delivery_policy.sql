create or replace function public.notification_event_supports_push(
  p_event_type text
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_event_type, '') in (
    'reward_redemption_created',
    'reward_redemption_fulfilled',
    'reward_redemption_refunded',
    'reward_redemption_expired',
    'mission_proof_approved',
    'mission_proof_rejected',
    'free_xp_grant',
    'new_course',
    'new_lesson',
    'new_mission',
    'new_reward',
    'continue_learning'
  );
$$;

create or replace function public.queue_push_deliveries_for_notification(
  p_notification_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.user_notifications%rowtype;
  v_inserted_count integer := 0;
begin
  select *
    into v_notification
  from public.user_notifications
  where id = p_notification_id;

  if not found then
    return 0;
  end if;

  if not public.notification_event_supports_push(v_notification.event_type) then
    return 0;
  end if;

  if not exists (
    select 1
    from public.notification_preferences np
    where np.user_id = v_notification.user_id
      and np.web_push_enabled = true
  ) then
    return 0;
  end if;

  insert into public.user_push_deliveries (
    notification_id,
    subscription_id
  )
  select
    v_notification.id,
    ups.id
  from public.user_push_subscriptions ups
  where ups.user_id = v_notification.user_id
    and ups.disabled_at is null
  on conflict (notification_id, subscription_id) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

grant execute on function public.notification_event_supports_push(text) to authenticated;
grant execute on function public.queue_push_deliveries_for_notification(uuid) to authenticated;
