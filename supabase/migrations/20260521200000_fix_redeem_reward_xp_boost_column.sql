create or replace function public.redeem_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_balance integer;
  v_existing_count integer := 0;
  v_limit_start timestamptz;
  v_redemption_id uuid := gen_random_uuid();
  v_xp_transaction_id uuid;
  v_bonus_transaction_id uuid;
  v_inventory_item public.reward_inventory_items%rowtype;
  v_quantity_allocation public.reward_quantity_allocations%rowtype;
  v_payload jsonb := '{}'::jsonb;
  v_redemption_expires_at timestamptz;
  v_effect text;
  v_bonus_xp integer;
  v_boost_multiplier numeric(5,2);
  v_boost_hours integer;
  v_boost_uses integer;
begin
  if v_user_id is null then
    raise exception 'You need an account to exchange XP for rewards.';
  end if;

  select xp_balance_cached
    into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if v_balance is null then
    raise exception 'We could not find your XP balance. Please sign in again.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found
     or v_reward.status <> 'published'
     or not v_reward.is_enabled
     or (v_reward.starts_at is not null and v_reward.starts_at > now())
     or (v_reward.ends_at is not null and v_reward.ends_at <= now())
     or not public.campaign_is_live(v_reward.campaign_id) then
    raise exception 'This reward is not available right now.';
  end if;

  if v_reward.offer_expires_at is not null and v_reward.offer_expires_at <= now() then
    raise exception 'This XP offer has expired.';
  end if;

  if v_balance < v_reward.cost_xp then
    raise exception 'You need more XP to exchange for this reward.';
  end if;

  if v_reward.limit_period <> 'none' then
    if v_reward.limit_period = 'daily' then
      v_limit_start := ((now() at time zone 'Africa/Lagos')::date at time zone 'Africa/Lagos');
    elsif v_reward.limit_period = 'weekly' then
      v_limit_start := (
        ((now() at time zone 'Africa/Lagos')::date
          - (((extract(dow from (now() at time zone 'Africa/Lagos')::date)::integer + 6) % 7))::integer)
        at time zone 'Africa/Lagos'
      );
    elsif v_reward.limit_period = 'monthly' then
      v_limit_start := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    elsif v_reward.limit_period = 'campaign' then
      v_limit_start := coalesce(v_reward.starts_at, '-infinity'::timestamptz);
    end if;

    select count(*)
      into v_existing_count
    from public.reward_redemptions
    where user_id = v_user_id
      and reward_id = p_reward_id
      and claim_state not in ('cancelled', 'refunded')
      and (
        v_reward.limit_period = 'lifetime'
        or requested_at >= coalesce(v_limit_start, '-infinity'::timestamptz)
      );

    if v_existing_count >= v_reward.per_user_limit then
      raise exception 'You have already reached the limit for this reward.';
    end if;
  end if;

  if v_reward.redemption_window_days is not null then
    v_redemption_expires_at := now() + make_interval(days => v_reward.redemption_window_days);
  end if;

  if v_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    select *
      into v_inventory_item
    from public.reward_inventory_items
    where reward_id = v_reward.id
      and perk_prize_id is null
      and item_type = v_reward.fulfillment_type
      and status = 'available'
      and (available_from is null or available_from <= now())
      and (expires_at is null or expires_at > now())
      and public.campaign_is_live(campaign_id)
    order by coalesce(available_from, uploaded_at) asc, uploaded_at asc
    for update skip locked
    limit 1;

    if v_inventory_item.id is null then
      raise exception 'This reward is currently sold out.';
    end if;

    v_payload := v_inventory_item.payload;
  else
    select *
      into v_quantity_allocation
    from public.reward_quantity_allocations
    where reward_id = v_reward.id
      and perk_prize_id is null
      and quantity_available > 0
      and (available_from is null or available_from <= now())
      and (expires_at is null or expires_at > now())
      and public.campaign_is_live(campaign_id)
    order by coalesce(available_from, created_at) asc, created_at asc
    for update skip locked
    limit 1;

    if v_quantity_allocation.id is null then
      raise exception 'This reward is currently sold out.';
    end if;
  end if;

  if v_reward.fulfillment_type = 'external_link' then
    v_payload := jsonb_build_object(
      'url',
      v_reward.fulfillment_config ->> 'url',
      'label',
      coalesce(v_reward.fulfillment_config ->> 'buttonLabel', 'Open reward')
    );
  elsif v_reward.fulfillment_type = 'qr_code' and v_inventory_item.id is not null then
    v_payload := coalesce(
      v_inventory_item.payload,
      jsonb_build_object(
        'qrPayload',
        v_redemption_id::text,
        'reference',
        'qr:' || v_redemption_id::text
      )
    );
  end if;

  insert into public.xp_transactions (
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    metadata
  )
  values (
    v_user_id,
    v_reward.cost_xp,
    'spend',
    'reward_redemption',
    v_redemption_id::text,
    jsonb_build_object('rewardId', v_reward.id, 'rewardTitle', v_reward.title)
  )
  returning id into v_xp_transaction_id;

  update public.profiles
  set xp = greatest(0, xp - v_reward.cost_xp),
      xp_balance_cached = greatest(0, xp_balance_cached - v_reward.cost_xp),
      updated_at = now()
  where id = v_user_id;

  if v_quantity_allocation.id is not null then
    update public.reward_quantity_allocations
    set quantity_available = greatest(0, quantity_available - 1),
        updated_at = now()
    where id = v_quantity_allocation.id;

    perform public.refresh_reward_quantity_inventory_counts(v_reward.id);
  end if;

  insert into public.reward_redemptions (
    id,
    user_id,
    reward_id,
    status,
    xp_transaction_id,
    xp_cost_at_redemption,
    fulfillment_type,
    fulfillment_payload,
    inventory_item_id,
    quantity_allocation_id,
    claim_state,
    user_message,
    reward_title_snapshot,
    reward_description_snapshot,
    reward_thumbnail_snapshot,
    claim_steps_snapshot,
    fulfillment_config_snapshot,
    redemption_expires_at
  )
  values (
    v_redemption_id,
    v_user_id,
    v_reward.id,
    'requested',
    v_xp_transaction_id,
    v_reward.cost_xp,
    v_reward.fulfillment_type,
    v_payload,
    v_inventory_item.id,
    v_quantity_allocation.id,
    case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    case
      when v_reward.fulfillment_type = 'manual' then 'Your reward has been added to history. Complete the claim form when you are ready.'
      when v_reward.fulfillment_type = 'voucher_code' then 'Your voucher code is ready.'
      when v_reward.fulfillment_type = 'qr_code' then 'Your QR pass is ready.'
      when v_reward.fulfillment_type = 'external_link' then 'Your reward is ready.'
      else 'Your reward is ready.'
    end,
    v_reward.title,
    v_reward.description,
    coalesce(v_reward.thumbnail, '{}'::jsonb),
    coalesce(v_reward.claim_steps, '[]'::jsonb),
    coalesce(v_reward.fulfillment_config, '{}'::jsonb),
    v_redemption_expires_at
  );

  if v_inventory_item.id is not null then
    update public.reward_inventory_items
    set status = 'reserved',
        redemption_id = v_redemption_id,
        assigned_at = now()
    where id = v_inventory_item.id;

    perform public.refresh_reward_item_inventory_counts(v_reward.id);
  end if;

  if v_reward.fulfillment_type = 'native' then
    v_effect := v_reward.fulfillment_config ->> 'effect';

    if v_effect = 'xp_bonus' then
      v_bonus_xp := greatest(1, coalesce((v_reward.fulfillment_config ->> 'amount')::integer, 1));

      insert into public.xp_transactions (
        user_id,
        amount,
        direction,
        source_type,
        source_id,
        metadata
      )
      values (
        v_user_id,
        v_bonus_xp,
        'earn',
        'reward_redemption_bonus',
        v_redemption_id::text,
        jsonb_build_object('rewardId', v_reward.id, 'rewardTitle', v_reward.title, 'effect', 'xp_bonus')
      )
      returning id into v_bonus_transaction_id;

      update public.profiles
      set xp = xp + v_bonus_xp,
          xp_balance_cached = xp_balance_cached + v_bonus_xp,
          updated_at = now()
      where id = v_user_id;

      update public.reward_redemptions
      set user_message = format('You received %s XP.', v_bonus_xp),
          status = 'fulfilled',
          claim_state = 'fulfilled',
          updated_at = now()
      where id = v_redemption_id;
    elsif v_effect = 'xp_boost' then
      v_boost_multiplier := greatest(1.1, coalesce((v_reward.fulfillment_config ->> 'multiplier')::numeric, 2));
      v_boost_hours := greatest(1, coalesce((v_reward.fulfillment_config ->> 'durationHours')::integer, 24));
      v_boost_uses := greatest(1, coalesce((v_reward.fulfillment_config ->> 'uses')::integer, 1));

      insert into public.user_xp_boosts (
        user_id,
        redemption_id,
        multiplier,
        remaining_uses,
        starts_at,
        ends_at
      )
      values (
        v_user_id,
        v_redemption_id,
        v_boost_multiplier,
        v_boost_uses,
        now(),
        now() + make_interval(hours => v_boost_hours)
      );

      update public.reward_redemptions
      set user_message = format('Your %sx XP boost is active.', trim(to_char(v_boost_multiplier, 'FM999999990.##'))),
          status = 'fulfilled',
          claim_state = 'fulfilled',
          updated_at = now()
      where id = v_redemption_id;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_redemption_id,
    'rewardId', v_reward.id,
    'xpCost', v_reward.cost_xp,
    'claimState', case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    'redemptionExpiresAt', v_redemption_expires_at
  );
end;
$$;

grant execute on function public.redeem_reward(text) to authenticated;
