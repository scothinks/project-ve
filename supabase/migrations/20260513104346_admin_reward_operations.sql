create or replace function public.admin_update_reward(
  p_reward_id text,
  p_title text,
  p_description text,
  p_cost_xp integer,
  p_status public.content_status,
  p_is_enabled boolean,
  p_thumbnail jsonb,
  p_offer_expires_at timestamptz,
  p_terms text,
  p_claim_steps jsonb,
  p_fulfillment_type text,
  p_fulfillment_config jsonb,
  p_per_user_limit integer,
  p_limit_period text,
  p_redemption_window_days integer,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update rewards.';
  end if;

  if p_cost_xp is null or p_cost_xp <= 0 then
    raise exception 'Reward XP cost must be greater than zero.';
  end if;

  if p_per_user_limit is null or p_per_user_limit <= 0 then
    raise exception 'Per-user limit must be greater than zero.';
  end if;

  if p_fulfillment_type not in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native') then
    raise exception 'Unsupported fulfillment type.';
  end if;

  if p_limit_period not in ('none', 'lifetime', 'daily', 'weekly', 'monthly', 'campaign') then
    raise exception 'Unsupported reward limit period.';
  end if;

  update public.rewards
  set title = nullif(trim(p_title), ''),
      description = nullif(trim(coalesce(p_description, '')), ''),
      cost_xp = p_cost_xp,
      status = p_status,
      is_enabled = coalesce(p_is_enabled, false),
      thumbnail = coalesce(p_thumbnail, '{}'::jsonb),
      offer_expires_at = p_offer_expires_at,
      terms = nullif(trim(coalesce(p_terms, '')), ''),
      claim_steps = coalesce(p_claim_steps, '[]'::jsonb),
      fulfillment_type = p_fulfillment_type,
      fulfillment_config = coalesce(p_fulfillment_config, '{}'::jsonb),
      per_user_limit = p_per_user_limit,
      limit_period = p_limit_period,
      redemption_window_days = p_redemption_window_days,
      sort_order = coalesce(p_sort_order, 0),
      updated_at = now()
  where id = p_reward_id;

  if not found then
    raise exception 'Reward not found.';
  end if;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_updated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'title', p_title,
      'status', p_status,
      'isEnabled', p_is_enabled,
      'costXp', p_cost_xp
    )
  );

  return jsonb_build_object('status', 'updated', 'rewardId', p_reward_id);
end;
$$;

create or replace function public.admin_adjust_reward_quantity(
  p_reward_id text,
  p_delta integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_available integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can adjust reward quantity.';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'Quantity change is required.';
  end if;

  select total_available
    into v_available
  from public.rewards
  where id = p_reward_id
  for update;

  if v_available is null then
    raise exception 'Reward not found.';
  end if;

  if v_available + p_delta < 0 then
    raise exception 'Quantity cannot go below zero.';
  end if;

  update public.rewards
  set total_available = total_available + p_delta,
      inventory_count = greatest(0, coalesce(inventory_count, total_available) + p_delta),
      total_uploaded = case when p_delta > 0 then total_uploaded + p_delta else total_uploaded end,
      updated_at = now()
  where id = p_reward_id;

  insert into public.reward_inventory_adjustments (
    reward_id,
    delta,
    reason,
    created_by
  )
  values (
    p_reward_id,
    p_delta,
    nullif(trim(coalesce(p_reason, '')), ''),
    v_actor_id
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_quantity_adjusted',
    'reward',
    p_reward_id,
    jsonb_build_object('delta', p_delta, 'reason', p_reason)
  );

  return jsonb_build_object('status', 'adjusted', 'rewardId', p_reward_id, 'delta', p_delta);
end;
$$;

create or replace function public.admin_upload_reward_inventory(
  p_reward_id text,
  p_item_type text,
  p_items jsonb,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_item jsonb;
  v_value text;
  v_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can upload reward inventory.';
  end if;

  if p_item_type not in ('voucher_code', 'qr_code') then
    raise exception 'Inventory upload only supports voucher and QR rewards.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if v_reward.fulfillment_type <> p_item_type then
    raise exception 'Inventory type must match the reward fulfillment type.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_value := nullif(trim(coalesce(v_item ->> 'value', '')), '');

    if v_value is not null then
      insert into public.reward_inventory_items (
        reward_id,
        item_type,
        payload,
        expires_at,
        uploaded_by
      )
      values (
        p_reward_id,
        p_item_type,
        case
          when p_item_type = 'voucher_code' then jsonb_build_object('code', v_value)
          else jsonb_build_object('qrPayload', v_value)
        end,
        p_expires_at,
        v_actor_id
      );

      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'No inventory items were provided.';
  end if;

  update public.rewards
  set total_uploaded = inventory.total_uploaded,
      total_available = inventory.total_available,
      inventory_count = inventory.total_available,
      updated_at = now()
  from (
    select
      reward_id,
      count(*)::integer as total_uploaded,
      count(*) filter (where status = 'available')::integer as total_available
    from public.reward_inventory_items
    where reward_id = p_reward_id
    group by reward_id
  ) inventory
  where rewards.id = inventory.reward_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_inventory_uploaded',
    'reward',
    p_reward_id,
    jsonb_build_object('count', v_count, 'itemType', p_item_type)
  );

  return jsonb_build_object('status', 'uploaded', 'rewardId', p_reward_id, 'count', v_count);
end;
$$;
