alter table public.reward_inventory_items
  add column if not exists perk_prize_id uuid references public.perk_bundle_prizes(id) on delete set null;

alter table public.reward_quantity_allocations
  add column if not exists perk_prize_id uuid references public.perk_bundle_prizes(id) on delete set null;

create index if not exists reward_inventory_items_perk_prize_idx
  on public.reward_inventory_items (reward_id, perk_prize_id, status, available_from, expires_at);

create index if not exists reward_quantity_allocations_perk_prize_idx
  on public.reward_quantity_allocations (reward_id, perk_prize_id, available_from, expires_at)
  where quantity_available > 0;

create or replace function public.reward_available_inventory_counts()
returns table(reward_id text, total_uploaded integer, total_available integer)
language sql
security definer
set search_path = public
as $$
  select
    rewards.id as reward_id,
    count(reward_inventory_items.id)::integer as total_uploaded,
    count(reward_inventory_items.id) filter (
      where reward_inventory_items.status = 'available'
        and reward_inventory_items.perk_prize_id is null
        and (reward_inventory_items.available_from is null or reward_inventory_items.available_from <= now())
        and (reward_inventory_items.expires_at is null or reward_inventory_items.expires_at > now())
        and public.campaign_is_live(reward_inventory_items.campaign_id)
    )::integer as total_available
  from public.rewards
  left join public.reward_inventory_items
    on reward_inventory_items.reward_id = rewards.id
  where rewards.fulfillment_type in ('voucher_code', 'qr_code')
    and rewards.status = 'published'
    and rewards.is_enabled
  group by rewards.id

  union all

  select
    rewards.id as reward_id,
    coalesce(sum(reward_quantity_allocations.quantity_total), 0)::integer as total_uploaded,
    coalesce(sum(reward_quantity_allocations.quantity_available) filter (
      where reward_quantity_allocations.perk_prize_id is null
        and (reward_quantity_allocations.available_from is null or reward_quantity_allocations.available_from <= now())
        and (reward_quantity_allocations.expires_at is null or reward_quantity_allocations.expires_at > now())
        and public.campaign_is_live(reward_quantity_allocations.campaign_id)
    ), 0)::integer as total_available
  from public.rewards
  left join public.reward_quantity_allocations
    on reward_quantity_allocations.reward_id = rewards.id
  where rewards.fulfillment_type not in ('voucher_code', 'qr_code')
    and rewards.status = 'published'
    and rewards.is_enabled
  group by rewards.id;
$$;

create or replace function public.admin_reward_assignment_counts(p_reward_ids text[] default null)
returns table(
  reward_id text,
  total_available integer,
  direct_available integer,
  assigned_available integer
)
language sql
security definer
set search_path = public
as $$
  with reward_scope as (
    select id
    from public.rewards
    where p_reward_ids is null or id = any(p_reward_ids)
  ),
  item_counts as (
    select
      reward_id,
      count(*) filter (
        where status = 'available'
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      )::integer as total_available,
      count(*) filter (
        where status = 'available'
          and perk_prize_id is null
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      )::integer as direct_available,
      count(*) filter (
        where status = 'available'
          and perk_prize_id is not null
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      )::integer as assigned_available
    from public.reward_inventory_items
    where p_reward_ids is null or reward_id = any(p_reward_ids)
    group by reward_id
  ),
  quantity_counts as (
    select
      reward_id,
      coalesce(sum(quantity_available) filter (
        where (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      ), 0)::integer as total_available,
      coalesce(sum(quantity_available) filter (
        where perk_prize_id is null
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      ), 0)::integer as direct_available,
      coalesce(sum(quantity_available) filter (
        where perk_prize_id is not null
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      ), 0)::integer as assigned_available
    from public.reward_quantity_allocations
    where p_reward_ids is null or reward_id = any(p_reward_ids)
    group by reward_id
  )
  select
    reward_scope.id as reward_id,
    coalesce(item_counts.total_available, quantity_counts.total_available, 0) as total_available,
    coalesce(item_counts.direct_available, quantity_counts.direct_available, 0) as direct_available,
    coalesce(item_counts.assigned_available, quantity_counts.assigned_available, 0) as assigned_available
  from reward_scope
  left join item_counts on item_counts.reward_id = reward_scope.id
  left join quantity_counts on quantity_counts.reward_id = reward_scope.id;
$$;

create or replace function public.admin_perk_prize_assignment_counts(p_prize_ids uuid[] default null)
returns table(
  prize_id uuid,
  assigned_available integer
)
language sql
security definer
set search_path = public
as $$
  with item_counts as (
    select
      perk_prize_id as prize_id,
      count(*) filter (
        where status = 'available'
          and (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      )::integer as assigned_available
    from public.reward_inventory_items
    where perk_prize_id is not null
      and (p_prize_ids is null or perk_prize_id = any(p_prize_ids))
    group by perk_prize_id
  ),
  quantity_counts as (
    select
      perk_prize_id as prize_id,
      coalesce(sum(quantity_available) filter (
        where (available_from is null or available_from <= now())
          and (expires_at is null or expires_at > now())
          and public.campaign_is_live(campaign_id)
      ), 0)::integer as assigned_available
    from public.reward_quantity_allocations
    where perk_prize_id is not null
      and (p_prize_ids is null or perk_prize_id = any(p_prize_ids))
    group by perk_prize_id
  )
  select
    coalesce(item_counts.prize_id, quantity_counts.prize_id) as prize_id,
    coalesce(item_counts.assigned_available, quantity_counts.assigned_available, 0) as assigned_available
  from item_counts
  full outer join quantity_counts
    on quantity_counts.prize_id = item_counts.prize_id;
$$;

create or replace function public.admin_assign_reward_stock_to_perk_prize(
  p_prize_id uuid,
  p_quantity integer,
  p_reason text default null,
  p_available_from timestamptz default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_prize public.perk_bundle_prizes%rowtype;
  v_source_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_quantity, 0));
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Assigned to perk prize');
  v_remaining integer := 0;
  v_take integer := 0;
  v_moved integer := 0;
  v_allocation public.reward_quantity_allocations%rowtype;
  v_item_ids uuid[] := '{}';
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can assign perk prize stock.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Expiry must be after available from.';
  end if;

  select *
    into v_prize
  from public.perk_bundle_prizes
  where id = p_prize_id
  for update;

  if not found or v_prize.prize_type <> 'reward' or v_prize.source_reward_id is null then
    raise exception 'Choose a linked reward prize first.';
  end if;

  select *
    into v_source_reward
  from public.rewards
  where id = v_prize.source_reward_id
  for update;

  if not found or v_source_reward.distribution_mode = 'perk_bundle' then
    raise exception 'Linked reward is not available for perk assignment.';
  end if;

  if v_source_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    select array_agg(id)
      into v_item_ids
    from (
      select id
      from public.reward_inventory_items
      where reward_id = v_source_reward.id
        and perk_prize_id is null
        and status = 'available'
        and (available_from is null or available_from <= now())
        and (expires_at is null or expires_at > now())
        and public.campaign_is_live(campaign_id)
      order by coalesce(available_from, uploaded_at), uploaded_at
      for update skip locked
      limit v_quantity
    ) picked;

    v_moved := coalesce(array_length(v_item_ids, 1), 0);

    if v_moved < v_quantity then
      raise exception 'Only % unassigned item(s) are available for this reward.', v_moved;
    end if;

    update public.reward_inventory_items
    set perk_prize_id = v_prize.id,
        available_from = coalesce(p_available_from, available_from),
        expires_at = coalesce(p_expires_at, expires_at),
        assigned_at = coalesce(assigned_at, now())
    where id = any(v_item_ids);

    perform public.refresh_reward_item_inventory_counts(v_source_reward.id);
  else
    v_remaining := v_quantity;

    for v_allocation in
      select *
      from public.reward_quantity_allocations
      where reward_id = v_source_reward.id
        and perk_prize_id is null
        and quantity_available > 0
        and (available_from is null or available_from <= now())
        and (expires_at is null or expires_at > now())
        and public.campaign_is_live(campaign_id)
      order by coalesce(available_from, created_at), created_at
      for update skip locked
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_allocation.quantity_available);

      update public.reward_quantity_allocations
      set quantity_available = quantity_available - v_take,
          updated_at = now()
      where id = v_allocation.id;

      insert into public.reward_quantity_allocations (
        reward_id,
        campaign_id,
        batch_id,
        batch_label,
        partner_reference,
        quantity_total,
        quantity_available,
        available_from,
        expires_at,
        reason,
        created_by,
        allocation_type,
        source_allocation_id,
        perk_prize_id
      )
      values (
        v_source_reward.id,
        v_allocation.campaign_id,
        v_allocation.batch_id,
        v_allocation.batch_label,
        v_allocation.partner_reference,
        v_take,
        v_take,
        coalesce(p_available_from, v_allocation.available_from),
        coalesce(p_expires_at, v_allocation.expires_at),
        v_reason,
        v_actor_id,
        'reallocation',
        v_allocation.id,
        v_prize.id
      );

      v_moved := v_moved + v_take;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_moved < v_quantity then
      raise exception 'Only % unassigned quantity is available for this reward.', v_moved;
    end if;

    perform public.refresh_reward_quantity_inventory_counts(v_source_reward.id);
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
    'perk_prize_stock_assigned',
    'perk_bundle_prize',
    v_prize.id::text,
    jsonb_build_object(
      'sourceRewardId', v_source_reward.id,
      'quantity', v_quantity,
      'availableFrom', p_available_from,
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object(
    'status', 'assigned',
    'prizeId', v_prize.id,
    'sourceRewardId', v_source_reward.id,
    'quantity', v_quantity
  );
end;
$$;

create or replace function public.admin_release_reward_stock_from_perk_prize(
  p_prize_id uuid,
  p_quantity integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_prize public.perk_bundle_prizes%rowtype;
  v_source_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_quantity, 0));
  v_reason text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Released from perk prize');
  v_remaining integer := 0;
  v_take integer := 0;
  v_moved integer := 0;
  v_allocation public.reward_quantity_allocations%rowtype;
  v_item_ids uuid[] := '{}';
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can release perk prize stock.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  select *
    into v_prize
  from public.perk_bundle_prizes
  where id = p_prize_id
  for update;

  if not found or v_prize.prize_type <> 'reward' or v_prize.source_reward_id is null then
    raise exception 'Choose a linked reward prize first.';
  end if;

  select *
    into v_source_reward
  from public.rewards
  where id = v_prize.source_reward_id
  for update;

  if v_source_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    select array_agg(id)
      into v_item_ids
    from (
      select id
      from public.reward_inventory_items
      where reward_id = v_source_reward.id
        and perk_prize_id = v_prize.id
        and status = 'available'
        and (expires_at is null or expires_at > now())
        and public.campaign_is_live(campaign_id)
      order by coalesce(available_from, uploaded_at), uploaded_at
      for update skip locked
      limit v_quantity
    ) picked;

    v_moved := coalesce(array_length(v_item_ids, 1), 0);

    if v_moved < v_quantity then
      raise exception 'Only % assigned item(s) are available to release.', v_moved;
    end if;

    update public.reward_inventory_items
    set perk_prize_id = null
    where id = any(v_item_ids);

    perform public.refresh_reward_item_inventory_counts(v_source_reward.id);
  else
    v_remaining := v_quantity;

    for v_allocation in
      select *
      from public.reward_quantity_allocations
      where reward_id = v_source_reward.id
        and perk_prize_id = v_prize.id
        and quantity_available > 0
        and (expires_at is null or expires_at > now())
        and public.campaign_is_live(campaign_id)
      order by coalesce(available_from, created_at), created_at
      for update skip locked
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_allocation.quantity_available);

      update public.reward_quantity_allocations
      set quantity_available = quantity_available - v_take,
          updated_at = now()
      where id = v_allocation.id;

      insert into public.reward_quantity_allocations (
        reward_id,
        campaign_id,
        batch_id,
        batch_label,
        partner_reference,
        quantity_total,
        quantity_available,
        available_from,
        expires_at,
        reason,
        created_by,
        allocation_type,
        source_allocation_id,
        perk_prize_id
      )
      values (
        v_source_reward.id,
        v_allocation.campaign_id,
        v_allocation.batch_id,
        v_allocation.batch_label,
        v_allocation.partner_reference,
        v_take,
        v_take,
        v_allocation.available_from,
        v_allocation.expires_at,
        v_reason,
        v_actor_id,
        'reallocation',
        coalesce(v_allocation.source_allocation_id, v_allocation.id),
        null
      );

      v_moved := v_moved + v_take;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_moved < v_quantity then
      raise exception 'Only % assigned quantity is available to release.', v_moved;
    end if;

    perform public.refresh_reward_quantity_inventory_counts(v_source_reward.id);
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
    'perk_prize_stock_released',
    'perk_bundle_prize',
    v_prize.id::text,
    jsonb_build_object(
      'sourceRewardId', v_source_reward.id,
      'quantity', v_quantity
    )
  );

  return jsonb_build_object(
    'status', 'released',
    'prizeId', v_prize.id,
    'sourceRewardId', v_source_reward.id,
    'quantity', v_quantity
  );
end;
$$;

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

grant execute on function public.admin_reward_assignment_counts(text[]) to authenticated;
grant execute on function public.admin_perk_prize_assignment_counts(uuid[]) to authenticated;
grant execute on function public.admin_assign_reward_stock_to_perk_prize(uuid, integer, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_release_reward_stock_from_perk_prize(uuid, integer, text) to authenticated;

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
  v_bundle_quantity_allocation public.reward_quantity_allocations%rowtype;
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

  select *
    into v_bundle_quantity_allocation
  from public.reward_quantity_allocations
  where reward_id = v_bundle.id
    and perk_prize_id is null
    and quantity_available > 0
    and (available_from is null or available_from <= now())
    and (expires_at is null or expires_at > now())
    and public.campaign_is_live(campaign_id)
  order by coalesce(available_from, created_at) asc, created_at asc
  for update skip locked
  limit 1;

  if v_bundle_quantity_allocation.id is null then
    raise exception 'This perk is currently sold out.';
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
    xp_transaction_id,
    fulfillment_type,
    reward_title_snapshot,
    xp_cost_at_redemption,
    redemption_expires_at,
    claim_state,
    user_message
  )
  values (
    v_redemption_id,
    v_user_id,
    v_bundle.id,
    v_xp_transaction_id,
    v_awarded_fulfillment_type,
    v_awarded_title,
    v_bundle.cost_xp,
    v_redemption_expires_at,
    case when v_awarded_fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    v_awarded_description
  );

  update public.reward_quantity_allocations
  set quantity_available = quantity_available - 1,
      updated_at = now()
  where id = v_bundle_quantity_allocation.id;

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
    v_bundle_quantity_allocation.id,
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
