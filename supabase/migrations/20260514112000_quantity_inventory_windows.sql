create table if not exists public.reward_quantity_allocations (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.rewards(id) on delete cascade,
  campaign_id text references public.campaigns(id) on delete set null,
  batch_id uuid references public.reward_inventory_batches(id) on delete set null,
  batch_label text,
  partner_reference text,
  quantity_total integer not null check (quantity_total >= 0),
  quantity_available integer not null check (quantity_available >= 0),
  available_from timestamptz,
  expires_at timestamptz,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_available <= quantity_total)
);

alter table public.reward_quantity_allocations enable row level security;

drop policy if exists "Admins can read reward quantity allocations" on public.reward_quantity_allocations;
create policy "Admins can read reward quantity allocations"
  on public.reward_quantity_allocations for select
  using (public.current_user_is_admin());

alter table public.reward_inventory_adjustments
  add column if not exists available_from timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists reward_quantity_allocations_available_idx
  on public.reward_quantity_allocations (reward_id, available_from, expires_at)
  where quantity_available > 0;

insert into public.reward_quantity_allocations (
  reward_id,
  campaign_id,
  quantity_total,
  quantity_available,
  available_from,
  reason
)
select
  rewards.id,
  rewards.campaign_id,
  greatest(0, rewards.total_available),
  greatest(0, rewards.total_available),
  coalesce(rewards.starts_at, now()),
  'Migrated existing available quantity'
from public.rewards
where rewards.fulfillment_type not in ('voucher_code', 'qr_code')
  and rewards.total_available > 0
  and not exists (
    select 1
    from public.reward_quantity_allocations
    where reward_quantity_allocations.reward_id = rewards.id
  );

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
    coalesce(sum(quantity_total), 0)::integer,
    coalesce(sum(quantity_available) filter (
      where (available_from is null or available_from <= now())
        and (expires_at is null or expires_at > now())
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
        and (reward_inventory_items.available_from is null or reward_inventory_items.available_from <= now())
        and (reward_inventory_items.expires_at is null or reward_inventory_items.expires_at > now())
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
      where (reward_quantity_allocations.available_from is null or reward_quantity_allocations.available_from <= now())
        and (reward_quantity_allocations.expires_at is null or reward_quantity_allocations.expires_at > now())
    ), 0)::integer as total_available
  from public.rewards
  left join public.reward_quantity_allocations
    on reward_quantity_allocations.reward_id = rewards.id
  where rewards.fulfillment_type not in ('voucher_code', 'qr_code')
    and rewards.status = 'published'
    and rewards.is_enabled
  group by rewards.id;
$$;

drop function if exists public.admin_set_reward_quantity(text, integer, text);
drop function if exists public.admin_set_reward_quantity(text, integer, text, text, text, text);

create or replace function public.admin_set_reward_quantity(
  p_reward_id text,
  p_total_available integer,
  p_reason text,
  p_campaign_id text default null,
  p_batch_label text default null,
  p_partner_reference text default null,
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
  v_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_total_available, 0));
  v_allocation_id uuid;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can set reward quantity.';
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
    raise exception 'Voucher and QR rewards require item batch upload.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Expiry must be after available from.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  insert into public.reward_quantity_allocations (
    reward_id,
    campaign_id,
    batch_label,
    partner_reference,
    quantity_total,
    quantity_available,
    available_from,
    expires_at,
    reason,
    created_by
  )
  values (
    p_reward_id,
    coalesce(p_campaign_id, v_reward.campaign_id),
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    v_quantity,
    v_quantity,
    p_available_from,
    p_expires_at,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Admin quantity allocation'),
    v_actor_id
  )
  returning id into v_allocation_id;

  insert into public.reward_inventory_adjustments (
    reward_id,
    campaign_id,
    batch_label,
    partner_reference,
    delta,
    reason,
    created_by,
    available_from,
    expires_at
  )
  values (
    p_reward_id,
    coalesce(p_campaign_id, v_reward.campaign_id),
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    v_quantity,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Admin quantity allocation'),
    v_actor_id,
    p_available_from,
    p_expires_at
  );

  perform public.refresh_reward_quantity_inventory_counts(p_reward_id);

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_quantity_allocated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'allocationId', v_allocation_id,
      'quantity', v_quantity,
      'campaignId', p_campaign_id,
      'batchLabel', p_batch_label,
      'partnerReference', p_partner_reference,
      'availableFrom', p_available_from,
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object(
    'status', 'allocated',
    'rewardId', p_reward_id,
    'allocationId', v_allocation_id,
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
     or (v_reward.ends_at is not null and v_reward.ends_at <= now()) then
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

grant execute on function public.refresh_reward_quantity_inventory_counts(text) to authenticated;
grant execute on function public.reward_available_inventory_counts() to authenticated;
grant execute on function public.admin_set_reward_quantity(text, integer, text, text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.redeem_reward(text) to authenticated;
