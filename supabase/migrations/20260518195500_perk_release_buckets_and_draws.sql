create table if not exists public.perk_prize_release_buckets (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid not null references public.perk_bundle_prizes(id) on delete cascade,
  label text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  release_cap integer not null check (release_cap > 0),
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists perk_prize_release_buckets_prize_idx
  on public.perk_prize_release_buckets (prize_id, sort_order, starts_at);

alter table public.perk_prize_release_buckets enable row level security;

drop policy if exists "Admins can read perk prize release buckets" on public.perk_prize_release_buckets;
create policy "Admins can read perk prize release buckets"
  on public.perk_prize_release_buckets for select
  using (public.current_user_is_admin());

drop trigger if exists perk_prize_release_buckets_set_updated_at on public.perk_prize_release_buckets;
create trigger perk_prize_release_buckets_set_updated_at
  before update on public.perk_prize_release_buckets
  for each row execute function public.set_updated_at();

create or replace function public.admin_upsert_perk_prize_release_bucket(
  p_bucket_id uuid default null,
  p_prize_id uuid default null,
  p_label text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_release_cap integer default null,
  p_sort_order integer default 0,
  p_is_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_prize public.perk_bundle_prizes%rowtype;
  v_existing public.perk_prize_release_buckets%rowtype;
  v_bucket_id uuid := coalesce(p_bucket_id, gen_random_uuid());
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage release buckets.';
  end if;

  if p_starts_at is null then
    raise exception 'Bucket start is required.';
  end if;

  if p_release_cap is null or p_release_cap <= 0 then
    raise exception 'Release cap must be greater than zero.';
  end if;

  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'Bucket end must be after the start.';
  end if;

  if p_bucket_id is not null then
    select * into v_existing
    from public.perk_prize_release_buckets
    where id = p_bucket_id
    for update;

    if not found then
      raise exception 'Release bucket not found.';
    end if;
  end if;

  select * into v_prize
  from public.perk_bundle_prizes
  where id = coalesce(p_prize_id, v_existing.prize_id)
  for update;

  if not found then
    raise exception 'Choose a perk prize first.';
  end if;

  insert into public.perk_prize_release_buckets (
    id,
    prize_id,
    label,
    starts_at,
    ends_at,
    release_cap,
    sort_order,
    is_enabled
  )
  values (
    v_bucket_id,
    v_prize.id,
    nullif(trim(coalesce(p_label, '')), ''),
    p_starts_at,
    p_ends_at,
    p_release_cap,
    coalesce(p_sort_order, 0),
    coalesce(p_is_enabled, true)
  )
  on conflict (id) do update
  set
    label = excluded.label,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    release_cap = excluded.release_cap,
    sort_order = excluded.sort_order,
    is_enabled = excluded.is_enabled,
    updated_at = now();

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    case when p_bucket_id is null then 'perk_release_bucket_created' else 'perk_release_bucket_updated' end,
    'perk_release_bucket',
    v_bucket_id::text,
    jsonb_build_object(
      'prizeId', v_prize.id,
      'bundleRewardId', v_prize.bundle_reward_id,
      'releaseCap', p_release_cap
    )
  );

  return jsonb_build_object(
    'bucketId', v_bucket_id
  );
end;
$$;

create or replace function public.admin_delete_perk_prize_release_bucket(
  p_bucket_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_bucket public.perk_prize_release_buckets%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage release buckets.';
  end if;

  select * into v_bucket
  from public.perk_prize_release_buckets
  where id = p_bucket_id
  for update;

  if not found then
    raise exception 'Release bucket not found.';
  end if;

  delete from public.perk_prize_release_buckets
  where id = p_bucket_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'perk_release_bucket_deleted',
    'perk_release_bucket',
    p_bucket_id::text,
    jsonb_build_object(
      'prizeId', v_bucket.prize_id
    )
  );
end;
$$;

create or replace function public.perk_prize_release_bucket_allows(
  p_prize_id uuid,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
set search_path = public
as $$
  with active_buckets as (
    select b.*
    from public.perk_prize_release_buckets b
    where b.prize_id = p_prize_id
      and b.is_enabled
  )
  select
    case
      when exists (select 1 from active_buckets) then exists (
        select 1
        from active_buckets b
        where b.starts_at <= p_now
          and (b.ends_at is null or b.ends_at > p_now)
          and (
            select count(*)
            from public.perk_bundle_draws d
            where d.prize_id = p_prize_id
              and d.award_status <> 'refunded'
              and d.created_at >= b.starts_at
              and (b.ends_at is null or d.created_at < b.ends_at)
          ) < b.release_cap
      )
      else true
    end
$$;

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
  v_xp_transaction_id uuid;
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

grant execute on function public.admin_upsert_perk_prize_release_bucket(uuid, uuid, text, timestamptz, timestamptz, integer, integer, boolean) to authenticated;
grant execute on function public.admin_delete_perk_prize_release_bucket(uuid) to authenticated;
