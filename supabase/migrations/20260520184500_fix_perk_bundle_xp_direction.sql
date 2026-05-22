create or replace function public.redeem_perk_bundle(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bundle public.rewards%rowtype;
  v_balance integer;
  v_existing_count integer := 0;
  v_limit_start timestamptz;
  v_redemption_id uuid := gen_random_uuid();
  v_xp_transaction_id uuid := gen_random_uuid();
  v_awarded_quantity_allocation public.reward_quantity_allocations%rowtype;
  v_awarded_inventory_item public.reward_inventory_items%rowtype;
  v_prize public.perk_bundle_prizes%rowtype;
  v_source_reward public.rewards%rowtype;
  v_payload jsonb := '{}'::jsonb;
  v_redemption_expires_at timestamptz;
  v_awarded_reward_id text;
  v_awarded_title text := 'Perk reward';
  v_awarded_description text;
  v_awarded_thumbnail jsonb := '{}'::jsonb;
  v_awarded_claim_steps jsonb := '[]'::jsonb;
  v_awarded_fulfillment_config jsonb := '{}'::jsonb;
  v_awarded_fulfillment_type text;
  v_selected boolean := false;
  v_day_start timestamptz := ((now() at time zone 'Africa/Lagos')::date at time zone 'Africa/Lagos');
  v_fallback jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'You need an account to redeem this perk.';
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
    into v_bundle
  from public.rewards
  where id = p_reward_id
  for update;

  if not found
     or v_bundle.distribution_mode <> 'perk_bundle'
     or v_bundle.status <> 'published'
     or not v_bundle.is_enabled
     or v_bundle.visibility_mode <> 'store'
     or (v_bundle.starts_at is not null and v_bundle.starts_at > now())
     or (v_bundle.ends_at is not null and v_bundle.ends_at <= now())
     or not public.campaign_is_live(v_bundle.campaign_id) then
    raise exception 'This perk is not available right now.';
  end if;

  if v_bundle.offer_expires_at is not null and v_bundle.offer_expires_at <= now() then
    raise exception 'This perk offer has expired.';
  end if;

  if v_balance < v_bundle.cost_xp then
    raise exception 'You need more XP to redeem this perk.';
  end if;

  if v_bundle.limit_period <> 'none' then
    if v_bundle.limit_period = 'daily' then
      v_limit_start := v_day_start;
    elsif v_bundle.limit_period = 'weekly' then
      v_limit_start := (
        ((now() at time zone 'Africa/Lagos')::date
          - (((extract(dow from (now() at time zone 'Africa/Lagos')::date)::integer + 6) % 7))::integer)
        at time zone 'Africa/Lagos'
      );
    elsif v_bundle.limit_period = 'monthly' then
      v_limit_start := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    elsif v_bundle.limit_period = 'campaign' then
      v_limit_start := coalesce(v_bundle.starts_at, '-infinity'::timestamptz);
    end if;

    select count(*)
      into v_existing_count
    from public.reward_redemptions
    where user_id = v_user_id
      and reward_id = v_bundle.id
      and claim_state not in ('cancelled', 'refunded')
      and (
        v_bundle.limit_period = 'lifetime'
        or requested_at >= coalesce(v_limit_start, '-infinity'::timestamptz)
      );

    if v_existing_count >= v_bundle.per_user_limit then
      raise exception 'You have already reached the limit for this perk.';
    end if;
  end if;

  for v_prize in
    select *
    from public.perk_bundle_prizes
    where bundle_reward_id = v_bundle.id
      and is_enabled
      and (available_from is null or available_from <= now())
      and (expires_at is null or expires_at > now())
      and public.perk_prize_release_bucket_allows(perk_bundle_prizes.id, now())
      and (
        total_win_cap is null
        or (
          select count(*)
          from public.perk_bundle_draws d
          where d.prize_id = perk_bundle_prizes.id
            and d.award_status <> 'refunded'
        ) < total_win_cap
      )
      and (
        daily_win_cap is null
        or (
          select count(*)
          from public.perk_bundle_draws d
          where d.prize_id = perk_bundle_prizes.id
            and d.award_status <> 'refunded'
            and d.created_at >= v_day_start
        ) < daily_win_cap
      )
    order by (-ln(greatest(random(), 0.000001)) / greatest(weight, 1)), sort_order, created_at
  loop
    if v_prize.prize_type = 'reward' then
      select *
        into v_source_reward
      from public.rewards
      where id = v_prize.source_reward_id
      for update;

      if not found
         or v_source_reward.fulfillment_type = 'native'
         or v_source_reward.distribution_mode = 'perk_bundle'
         or v_source_reward.status <> 'published'
         or not v_source_reward.is_enabled
         or (v_source_reward.starts_at is not null and v_source_reward.starts_at > now())
         or (v_source_reward.ends_at is not null and v_source_reward.ends_at <= now())
         or not public.campaign_is_live(v_source_reward.campaign_id) then
        continue;
      end if;

      v_awarded_reward_id := v_source_reward.id;
      v_awarded_title := v_source_reward.title;
      v_awarded_description := v_source_reward.description;
      v_awarded_thumbnail := coalesce(v_source_reward.thumbnail, '{}'::jsonb);
      v_awarded_claim_steps := coalesce(v_source_reward.claim_steps, '[]'::jsonb);
      v_awarded_fulfillment_config := coalesce(v_source_reward.fulfillment_config, '{}'::jsonb);
      v_awarded_fulfillment_type := v_source_reward.fulfillment_type;
      v_redemption_expires_at := case
        when v_source_reward.redemption_window_days is not null then now() + make_interval(days => v_source_reward.redemption_window_days)
        else null
      end;

      if v_source_reward.fulfillment_type in ('voucher_code', 'qr_code') then
        select *
          into v_awarded_inventory_item
        from public.reward_inventory_items
        where reward_id = v_source_reward.id
          and perk_prize_id = v_prize.id
          and item_type = v_source_reward.fulfillment_type
          and status = 'available'
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
        order by coalesce(available_from, uploaded_at) asc, uploaded_at asc
        for update skip locked
        limit 1;

        if v_awarded_inventory_item.id is null then
          continue;
        end if;

        v_payload := v_awarded_inventory_item.payload;
      else
        select *
          into v_awarded_quantity_allocation
        from public.reward_quantity_allocations
        where reward_id = v_source_reward.id
          and perk_prize_id = v_prize.id
          and quantity_available > 0
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
        order by coalesce(available_from, created_at) asc, created_at asc
        for update skip locked
        limit 1;

        if v_awarded_quantity_allocation.id is null then
          continue;
        end if;

        if v_source_reward.fulfillment_type = 'external_link' then
          v_payload := jsonb_build_object(
            'url',
            v_source_reward.fulfillment_config ->> 'url',
            'label',
            coalesce(v_source_reward.fulfillment_config ->> 'buttonLabel', 'Open reward')
          );
        else
          v_payload := '{}'::jsonb;
        end if;
      end if;

      v_selected := true;
      exit;
    elsif v_prize.prize_type = 'native_xp' then
      v_awarded_reward_id := null;
      v_awarded_title := coalesce(nullif(trim(coalesce(v_prize.title, '')), ''), 'Bonus XP');
      v_awarded_description := 'A surprise XP reward from your perk.';
      v_awarded_thumbnail := coalesce(v_prize.thumbnail, v_bundle.thumbnail, '{}'::jsonb);
      v_awarded_claim_steps := '[]'::jsonb;
      v_awarded_fulfillment_config := jsonb_build_object(
        'effect', 'xp_bonus',
        'amount', greatest(1, coalesce((v_prize.config ->> 'amount')::integer, 1))
      );
      v_awarded_fulfillment_type := 'native';
      v_payload := v_awarded_fulfillment_config;
      v_selected := true;
      exit;
    elsif v_prize.prize_type = 'xp_boost' then
      v_awarded_reward_id := null;
      v_awarded_title := coalesce(nullif(trim(coalesce(v_prize.title, '')), ''), 'XP Boost');
      v_awarded_description := 'A surprise XP boost from your perk.';
      v_awarded_thumbnail := coalesce(v_prize.thumbnail, v_bundle.thumbnail, '{}'::jsonb);
      v_awarded_claim_steps := '[]'::jsonb;
      v_awarded_fulfillment_config := jsonb_build_object(
        'effect', 'xp_boost',
        'multiplier', greatest(1.1, coalesce((v_prize.config ->> 'multiplier')::numeric, 2)),
        'durationHours', greatest(1, coalesce((v_prize.config ->> 'durationHours')::integer, 24)),
        'uses', greatest(1, coalesce((v_prize.config ->> 'uses')::integer, 1))
      );
      v_awarded_fulfillment_type := 'native';
      v_payload := v_awarded_fulfillment_config;
      v_selected := true;
      exit;
    end if;
  end loop;

  if not v_selected then
    v_fallback := case
      when jsonb_typeof(v_bundle.fulfillment_config -> 'fallback') = 'object'
        then v_bundle.fulfillment_config -> 'fallback'
      else '{}'::jsonb
    end;

    if coalesce(v_fallback ->> 'prizeType', 'native_xp') = 'xp_boost' then
      v_awarded_title := coalesce(nullif(trim(coalesce(v_fallback ->> 'title', '')), ''), 'XP Boost');
      v_awarded_description := 'A fallback XP boost from your perk.';
      v_awarded_thumbnail := coalesce(v_bundle.thumbnail, '{}'::jsonb);
      v_awarded_claim_steps := '[]'::jsonb;
      v_awarded_fulfillment_config := jsonb_build_object(
        'effect', 'xp_boost',
        'multiplier', greatest(1.1, coalesce((v_fallback ->> 'multiplier')::numeric, 2)),
        'durationHours', greatest(1, coalesce((v_fallback ->> 'durationHours')::integer, 24)),
        'uses', greatest(1, coalesce((v_fallback ->> 'uses')::integer, 1))
      );
      v_awarded_fulfillment_type := 'native';
      v_payload := v_awarded_fulfillment_config;
    else
      v_awarded_title := coalesce(nullif(trim(coalesce(v_fallback ->> 'title', '')), ''), 'Bonus XP');
      v_awarded_description := 'A fallback XP reward from your perk.';
      v_awarded_thumbnail := coalesce(v_bundle.thumbnail, '{}'::jsonb);
      v_awarded_claim_steps := '[]'::jsonb;
      v_awarded_fulfillment_config := jsonb_build_object(
        'effect', 'xp_bonus',
        'amount', greatest(1, coalesce((v_fallback ->> 'amount')::integer, 1))
      );
      v_awarded_fulfillment_type := 'native';
      v_payload := v_awarded_fulfillment_config;
    end if;
  end if;

  insert into public.xp_transactions (
    id,
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    metadata
  )
  values (
    v_xp_transaction_id,
    v_user_id,
    v_bundle.cost_xp,
    'spend',
    'reward_redemption',
    v_redemption_id::text,
    jsonb_build_object('rewardId', v_bundle.id)
  );

  update public.profiles
  set xp_balance_cached = xp_balance_cached - v_bundle.cost_xp,
      updated_at = now()
  where id = v_user_id;

  insert into public.reward_redemptions (
    id,
    user_id,
    reward_id,
    bundle_reward_id,
    awarded_reward_id,
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
    redemption_expires_at,
  )
  values (
    v_redemption_id,
    v_user_id,
    v_bundle.id,
    v_bundle.id,
    v_awarded_reward_id,
    'requested',
    v_xp_transaction_id,
    v_bundle.cost_xp,
    v_awarded_fulfillment_type,
    v_payload,
    v_awarded_inventory_item.id,
    v_awarded_quantity_allocation.id,
    case when v_awarded_fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    case
      when v_awarded_fulfillment_type = 'manual' then 'You unlocked ' || v_awarded_title || '. Submit your details to claim it.'
      when v_awarded_fulfillment_type = 'voucher_code' then 'You unlocked ' || v_awarded_title || '.'
      when v_awarded_fulfillment_type = 'qr_code' then 'You unlocked ' || v_awarded_title || '.'
      when v_awarded_fulfillment_type = 'external_link' then 'You unlocked ' || v_awarded_title || '.'
      else 'You unlocked ' || v_awarded_title || '.'
    end,
    v_awarded_title,
    v_awarded_description,
    v_awarded_thumbnail,
    v_awarded_claim_steps,
    v_awarded_fulfillment_config,
    v_redemption_expires_at,
  );

  if v_awarded_quantity_allocation.id is not null then
    update public.reward_quantity_allocations
    set quantity_available = quantity_available - 1,
        updated_at = now()
    where id = v_awarded_quantity_allocation.id;
  end if;

  if v_awarded_inventory_item.id is not null then
    update public.reward_inventory_items
    set status = 'reserved',
        assigned_at = now(),
        redemption_id = v_redemption_id
    where id = v_awarded_inventory_item.id;
  end if;

  insert into public.perk_bundle_draws (
    bundle_reward_id,
    user_id,
    redemption_id,
    prize_id,
    awarded_reward_id,
    bundle_quantity_allocation_id,
    awarded_inventory_item_id,
    awarded_quantity_allocation_id,
    awarded_fulfillment_type,
    awarded_title,
    awarded_thumbnail,
    awarded_payload
  )
  values (
    v_bundle.id,
    v_user_id,
    v_redemption_id,
    v_prize.id,
    v_awarded_reward_id,
    null,
    v_awarded_inventory_item.id,
    v_awarded_quantity_allocation.id,
    v_awarded_fulfillment_type,
    v_awarded_title,
    v_awarded_thumbnail,
    v_payload
  );

  if v_awarded_fulfillment_type = 'native' then
    perform public.apply_native_reward_effect(
      v_user_id,
      v_redemption_id,
      v_bundle.id,
      v_awarded_fulfillment_config
    );
  end if;

  return jsonb_build_object(
    'id', v_redemption_id,
    'rewardId', v_bundle.id,
    'xpCost', v_bundle.cost_xp,
    'claimState', case when v_awarded_fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    'fulfillmentType', v_awarded_fulfillment_type,
    'redemptionExpiresAt', v_redemption_expires_at
  );
end;
$$;

grant execute on function public.redeem_perk_bundle(text) to authenticated;
