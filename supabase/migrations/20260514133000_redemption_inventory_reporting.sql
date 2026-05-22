alter table public.reward_redemptions
  add column if not exists inventory_item_id uuid references public.reward_inventory_items(id) on delete set null,
  add column if not exists quantity_allocation_id uuid references public.reward_quantity_allocations(id) on delete set null;

alter table public.reward_quantity_allocations
  add column if not exists allocation_type text not null default 'upload'
    check (allocation_type in ('upload', 'reallocation', 'refund')),
  add column if not exists source_allocation_id uuid references public.reward_quantity_allocations(id) on delete set null;

create table if not exists public.reward_inventory_reallocations (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.rewards(id) on delete cascade,
  inventory_type text not null check (inventory_type in ('voucher_code', 'qr_code', 'quantity')),
  from_campaign_id text references public.campaigns(id) on delete set null,
  to_campaign_id text references public.campaigns(id) on delete set null,
  quantity integer not null check (quantity > 0),
  inventory_item_ids jsonb not null default '[]'::jsonb,
  from_quantity_allocation_ids jsonb not null default '[]'::jsonb,
  to_quantity_allocation_id uuid references public.reward_quantity_allocations(id) on delete set null,
  available_from timestamptz,
  expires_at timestamptz,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.reward_inventory_reallocations enable row level security;

drop policy if exists "Admins can read inventory reallocations" on public.reward_inventory_reallocations;
create policy "Admins can read inventory reallocations"
  on public.reward_inventory_reallocations for select
  using (public.current_user_is_admin());

create index if not exists reward_redemptions_inventory_item_idx
  on public.reward_redemptions (inventory_item_id)
  where inventory_item_id is not null;

create index if not exists reward_redemptions_quantity_allocation_idx
  on public.reward_redemptions (quantity_allocation_id)
  where quantity_allocation_id is not null;

create index if not exists reward_inventory_reallocations_reward_idx
  on public.reward_inventory_reallocations (reward_id, created_at desc);

create or replace function public.refresh_reward_quantity_inventory_counts(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_uploaded integer := 0;
  v_total_available integer := 0;
begin
  select
    coalesce(sum(quantity_total) filter (where allocation_type <> 'reallocation'), 0)::integer,
    coalesce(sum(quantity_available) filter (
      where (available_from is null or available_from <= now())
        and (expires_at is null or expires_at > now())
        and public.campaign_is_live(campaign_id)
    ), 0)::integer
    into v_total_uploaded, v_total_available
  from public.reward_quantity_allocations
  where reward_id = p_reward_id;

  update public.rewards
  set total_uploaded = v_total_uploaded,
      total_available = v_total_available,
      inventory_count = v_total_available,
      updated_at = now()
  where id = p_reward_id
    and fulfillment_type not in ('voucher_code', 'qr_code');

  return jsonb_build_object(
    'rewardId', p_reward_id,
    'totalUploaded', v_total_uploaded,
    'totalAvailable', v_total_available
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
  elsif v_reward.fulfillment_type = 'native' then
    v_payload := v_reward.fulfillment_config;
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

  if v_inventory_item.id is not null then
    update public.reward_inventory_items
    set status = 'reserved',
        redemption_id = v_redemption_id,
        assigned_at = now()
    where id = v_inventory_item.id;

    perform public.refresh_reward_item_inventory_counts(v_reward.id);
  elsif v_quantity_allocation.id is not null then
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
      when v_reward.fulfillment_type = 'manual' then 'Submit your details so the reward partner can process fulfillment.'
      when v_reward.fulfillment_type = 'voucher_code' then 'Your voucher code is ready.'
      when v_reward.fulfillment_type = 'qr_code' then 'Your QR pass is ready.'
      when v_reward.fulfillment_type = 'external_link' then 'Your reward link is ready.'
      else 'Your native reward has been applied.'
    end,
    v_reward.title,
    v_reward.description,
    v_reward.thumbnail,
    v_reward.claim_steps,
    v_reward.fulfillment_config,
    v_redemption_expires_at
  );

  if v_reward.fulfillment_type = 'native' then
    v_effect := v_reward.fulfillment_config ->> 'effect';

    if v_effect = 'xp_bonus' then
      v_bonus_xp := greatest(0, coalesce((v_reward.fulfillment_config ->> 'amount')::integer, 0));

      if v_bonus_xp <= 0 then
        raise exception 'This XP bonus is not configured correctly.';
      end if;

      insert into public.xp_transactions (
        user_id,
        amount,
        direction,
        source_type,
        source_id,
        award_scope,
        metadata
      )
      values (
        v_user_id,
        v_bonus_xp,
        'earn',
        'reward_redemption',
        v_redemption_id::text,
        'native_xp_bonus:' || v_redemption_id::text,
        jsonb_build_object('rewardId', v_reward.id, 'effect', 'xp_bonus')
      )
      returning id into v_bonus_transaction_id;

      update public.profiles
      set xp = xp + v_bonus_xp,
          xp_balance_cached = xp_balance_cached + v_bonus_xp,
          updated_at = now()
      where id = v_user_id;

      update public.reward_redemptions
      set status = 'fulfilled',
          fulfilled_at = now(),
          user_message = 'Your XP bonus has been added to your balance.'
      where id = v_redemption_id;
    elsif v_effect = 'xp_boost' then
      v_boost_multiplier := greatest(1.01, coalesce((v_reward.fulfillment_config ->> 'multiplier')::numeric, 1));
      v_boost_hours := greatest(1, coalesce((v_reward.fulfillment_config ->> 'durationHours')::integer, 24));
      v_boost_uses := nullif(greatest(0, coalesce((v_reward.fulfillment_config ->> 'uses')::integer, 0)), 0);

      insert into public.user_xp_boosts (
        user_id,
        redemption_id,
        multiplier,
        starts_at,
        ends_at,
        remaining_uses
      )
      values (
        v_user_id,
        v_redemption_id,
        v_boost_multiplier,
        now(),
        now() + make_interval(hours => v_boost_hours),
        v_boost_uses
      );

      update public.reward_redemptions
      set status = 'fulfilled',
          fulfilled_at = now(),
          user_message = 'Your XP boost is active.'
      where id = v_redemption_id;
    else
      raise exception 'This native reward is not supported yet.';
    end if;
  end if;

  return jsonb_build_object(
    'id', v_redemption_id,
    'rewardId', v_reward.id,
    'xpCost', v_reward.cost_xp,
    'claimState', case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    'fulfillmentType', v_reward.fulfillment_type,
    'redemptionExpiresAt', v_redemption_expires_at
  );
end;
$$;

create or replace function public.refund_reward_redemption(
  p_redemption_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_redemption public.reward_redemptions%rowtype;
  v_refund_transaction_id uuid;
  v_restored_inventory boolean := false;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = v_actor_id
      and role = 'admin'
  )
    into v_is_admin;

  if not v_is_admin then
    raise exception 'Only an admin can refund reward redemptions.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'We could not find this reward redemption.';
  end if;

  if v_redemption.refunded_at is not null or v_redemption.claim_state = 'refunded' then
    return jsonb_build_object('id', p_redemption_id, 'claimState', 'refunded', 'alreadyRefunded', true);
  end if;

  if v_redemption.fulfilled_at is not null then
    raise exception 'Fulfilled rewards cannot be automatically refunded.';
  end if;

  if v_redemption.inventory_item_id is not null then
    update public.reward_inventory_items
    set status = case
          when expires_at is not null and expires_at <= now() then 'expired'
          else 'available'
        end,
        redemption_id = null,
        assigned_at = null
    where id = v_redemption.inventory_item_id
      and redemption_id = p_redemption_id
      and status = 'reserved';

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_item_inventory_counts(v_redemption.reward_id);
    end if;
  elsif v_redemption.quantity_allocation_id is not null then
    update public.reward_quantity_allocations
    set quantity_available = least(quantity_total, quantity_available + 1),
        updated_at = now()
    where id = v_redemption.quantity_allocation_id;

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_quantity_inventory_counts(v_redemption.reward_id);
    end if;
  end if;

  insert into public.xp_transactions (
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    award_scope,
    metadata
  )
  values (
    v_redemption.user_id,
    coalesce(v_redemption.xp_cost_at_redemption, 0),
    'earn',
    'reward_redemption',
    p_redemption_id::text,
    'reward_refund:' || p_redemption_id::text,
    jsonb_build_object(
      'reason', coalesce(p_reason, 'admin_refund'),
      'inventoryRestored', v_restored_inventory
    )
  )
  returning id into v_refund_transaction_id;

  update public.profiles
  set xp = xp + coalesce(v_redemption.xp_cost_at_redemption, 0),
      xp_balance_cached = xp_balance_cached + coalesce(v_redemption.xp_cost_at_redemption, 0),
      updated_at = now()
  where id = v_redemption.user_id;

  update public.reward_redemptions
  set status = 'cancelled',
      claim_state = 'refunded',
      refunded_at = now(),
      refund_xp_transaction_id = v_refund_transaction_id,
      admin_note = p_reason,
      user_message = 'This reward was refunded. The XP has been returned to your balance.'
  where id = p_redemption_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_redemption_refunded',
    'reward_redemption',
    p_redemption_id::text,
    jsonb_build_object(
      'rewardId', v_redemption.reward_id,
      'reason', p_reason,
      'inventoryRestored', v_restored_inventory,
      'inventoryItemId', v_redemption.inventory_item_id,
      'quantityAllocationId', v_redemption.quantity_allocation_id
    )
  );

  return jsonb_build_object(
    'id', p_redemption_id,
    'claimState', 'refunded',
    'inventoryRestored', v_restored_inventory,
    'refundXpTransactionId', v_refund_transaction_id
  );
end;
$$;

create or replace function public.admin_mark_reward_redemption_fulfilled(
  p_redemption_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_redemption public.reward_redemptions%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can fulfill reward redemptions.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'We could not find this reward redemption.';
  end if;

  if v_redemption.claim_state in ('refunded', 'cancelled', 'expired') then
    raise exception 'This redemption can no longer be fulfilled.';
  end if;

  update public.reward_redemptions
  set status = 'fulfilled',
      claim_state = 'fulfilled',
      fulfilled_at = coalesce(fulfilled_at, now()),
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_note, '')), ''),
      user_message = 'This reward has been fulfilled.'
  where id = p_redemption_id;

  update public.reward_inventory_items
  set status = 'redeemed',
      redeemed_at = now()
  where redemption_id = p_redemption_id
    and status = 'reserved';

  perform public.refresh_reward_item_inventory_counts(v_redemption.reward_id);

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_redemption_fulfilled',
    'reward_redemption',
    p_redemption_id::text,
    jsonb_build_object('rewardId', v_redemption.reward_id, 'note', p_note)
  );

  return jsonb_build_object('id', p_redemption_id, 'claimState', 'fulfilled');
end;
$$;

create or replace function public.admin_reallocate_reward_inventory(
  p_reward_id text,
  p_from_campaign_id text,
  p_to_campaign_id text,
  p_quantity integer,
  p_available_from timestamptz default null,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_quantity, 0));
  v_item_ids uuid[] := array[]::uuid[];
  v_moved integer := 0;
  v_remaining integer;
  v_take integer;
  v_allocation record;
  v_from_allocation_ids uuid[] := array[]::uuid[];
  v_to_allocation_id uuid;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can reallocate inventory.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_from_campaign_id is null or p_to_campaign_id is null or p_from_campaign_id = p_to_campaign_id then
    raise exception 'Choose different source and destination campaigns.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Expiry must be after available from.';
  end if;

  if not exists (select 1 from public.campaigns where id = p_from_campaign_id) then
    raise exception 'Source campaign not found.';
  end if;

  if not exists (select 1 from public.campaigns where id = p_to_campaign_id) then
    raise exception 'Destination campaign not found.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if v_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    select coalesce(array_agg(id), array[]::uuid[])
      into v_item_ids
    from (
      select id
      from public.reward_inventory_items
      where reward_id = p_reward_id
        and campaign_id = p_from_campaign_id
        and status = 'available'
        and (expires_at is null or expires_at > now())
      order by coalesce(available_from, uploaded_at), uploaded_at
      for update skip locked
      limit v_quantity
    ) items;

    v_moved := coalesce(array_length(v_item_ids, 1), 0);

    if v_moved < v_quantity then
      raise exception 'Only % unused item(s) are available to reallocate.', v_moved;
    end if;

    update public.reward_inventory_items
    set campaign_id = p_to_campaign_id,
        available_from = p_available_from,
        expires_at = p_expires_at
    where id = any(v_item_ids);

    perform public.refresh_reward_item_inventory_counts(p_reward_id);
  else
    v_remaining := v_quantity;

    for v_allocation in
      select *
      from public.reward_quantity_allocations
      where reward_id = p_reward_id
        and campaign_id = p_from_campaign_id
        and quantity_available > 0
        and (expires_at is null or expires_at > now())
      order by coalesce(available_from, created_at), created_at
      for update skip locked
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_allocation.quantity_available);

      update public.reward_quantity_allocations
      set quantity_available = quantity_available - v_take,
          updated_at = now()
      where id = v_allocation.id;

      v_from_allocation_ids := array_append(v_from_allocation_ids, v_allocation.id);
      v_moved := v_moved + v_take;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_moved < v_quantity then
      raise exception 'Only % unused quantity is available to reallocate.', v_moved;
    end if;

    insert into public.reward_quantity_allocations (
      reward_id,
      campaign_id,
      quantity_total,
      quantity_available,
      available_from,
      expires_at,
      reason,
      created_by,
      allocation_type,
      source_allocation_id
    )
    values (
      p_reward_id,
      p_to_campaign_id,
      v_quantity,
      v_quantity,
      p_available_from,
      p_expires_at,
      coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Inventory reallocation'),
      v_actor_id,
      'reallocation',
      v_from_allocation_ids[1]
    )
    returning id into v_to_allocation_id;

    perform public.refresh_reward_quantity_inventory_counts(p_reward_id);
  end if;

  insert into public.reward_inventory_reallocations (
    reward_id,
    inventory_type,
    from_campaign_id,
    to_campaign_id,
    quantity,
    inventory_item_ids,
    from_quantity_allocation_ids,
    to_quantity_allocation_id,
    available_from,
    expires_at,
    reason,
    created_by
  )
  values (
    p_reward_id,
    case when v_reward.fulfillment_type in ('voucher_code', 'qr_code') then v_reward.fulfillment_type else 'quantity' end,
    p_from_campaign_id,
    p_to_campaign_id,
    v_quantity,
    coalesce(to_jsonb(v_item_ids), '[]'::jsonb),
    coalesce(to_jsonb(v_from_allocation_ids), '[]'::jsonb),
    v_to_allocation_id,
    p_available_from,
    p_expires_at,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Inventory reallocation'),
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
    'reward_inventory_reallocated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'fromCampaignId', p_from_campaign_id,
      'toCampaignId', p_to_campaign_id,
      'quantity', v_quantity
    )
  );

  return jsonb_build_object(
    'status', 'reallocated',
    'rewardId', p_reward_id,
    'quantity', v_quantity,
    'fromCampaignId', p_from_campaign_id,
    'toCampaignId', p_to_campaign_id
  );
end;
$$;

grant execute on function public.redeem_reward(text) to authenticated;
grant execute on function public.refund_reward_redemption(uuid, text) to authenticated;
grant execute on function public.admin_mark_reward_redemption_fulfilled(uuid, text) to authenticated;
grant execute on function public.admin_reallocate_reward_inventory(text, text, text, integer, timestamptz, timestamptz, text) to authenticated;
