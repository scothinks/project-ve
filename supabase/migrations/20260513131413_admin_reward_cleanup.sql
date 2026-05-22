create or replace function public.admin_create_reward(
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
  p_sort_order integer,
  p_total_available integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward_id text := lower(regexp_replace(trim(coalesce(p_reward_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_total_available integer := greatest(0, coalesce(p_total_available, 0));
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can create rewards.';
  end if;

  if v_reward_id = '' then
    v_reward_id := 'reward-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Reward name is required.';
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

  insert into public.rewards (
    id,
    title,
    description,
    cost_xp,
    inventory_count,
    starts_at,
    ends_at,
    status,
    thumbnail,
    offer_expires_at,
    terms,
    claim_steps,
    fulfillment_type,
    fulfillment_config,
    per_user_limit,
    limit_period,
    redemption_window_days,
    sort_order,
    is_enabled,
    total_uploaded,
    total_available
  )
  values (
    v_reward_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_cost_xp,
    v_total_available,
    now(),
    null,
    p_status,
    coalesce(p_thumbnail, '{}'::jsonb),
    p_offer_expires_at,
    nullif(trim(coalesce(p_terms, '')), ''),
    coalesce(p_claim_steps, '[]'::jsonb),
    p_fulfillment_type,
    coalesce(p_fulfillment_config, '{}'::jsonb),
    p_per_user_limit,
    p_limit_period,
    p_redemption_window_days,
    coalesce(p_sort_order, 0),
    coalesce(p_is_enabled, false),
    v_total_available,
    v_total_available
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
    'reward_created',
    'reward',
    v_reward_id,
    jsonb_build_object('title', p_title, 'status', p_status, 'costXp', p_cost_xp)
  );

  return jsonb_build_object('status', 'created', 'rewardId', v_reward_id);
end;
$$;

create or replace function public.admin_set_reward_enabled(
  p_reward_id text,
  p_is_enabled boolean
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
    raise exception 'Only an admin can update reward availability.';
  end if;

  update public.rewards
  set is_enabled = coalesce(p_is_enabled, false),
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
    case when coalesce(p_is_enabled, false) then 'reward_enabled' else 'reward_disabled' end,
    'reward',
    p_reward_id,
    jsonb_build_object('isEnabled', coalesce(p_is_enabled, false))
  );

  return jsonb_build_object('status', 'updated', 'rewardId', p_reward_id, 'isEnabled', coalesce(p_is_enabled, false));
end;
$$;

create or replace function public.admin_set_reward_quantity(
  p_reward_id text,
  p_total_available integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current integer;
  v_next integer := greatest(0, coalesce(p_total_available, 0));
  v_delta integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can set reward quantity.';
  end if;

  select total_available
    into v_current
  from public.rewards
  where id = p_reward_id
  for update;

  if v_current is null then
    raise exception 'Reward not found.';
  end if;

  v_delta := v_next - v_current;

  update public.rewards
  set total_available = v_next,
      inventory_count = v_next,
      total_uploaded = greatest(total_uploaded, v_next),
      updated_at = now()
  where id = p_reward_id;

  if v_delta <> 0 then
    insert into public.reward_inventory_adjustments (
      reward_id,
      delta,
      reason,
      created_by
    )
    values (
      p_reward_id,
      v_delta,
      coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Admin quantity set'),
      v_actor_id
    );
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
    'reward_quantity_set',
    'reward',
    p_reward_id,
    jsonb_build_object('previous', v_current, 'next', v_next, 'delta', v_delta, 'reason', p_reason)
  );

  return jsonb_build_object('status', 'updated', 'rewardId', p_reward_id, 'totalAvailable', v_next, 'delta', v_delta);
end;
$$;
