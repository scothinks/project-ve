alter table public.rewards
  drop constraint if exists rewards_fulfillment_type_check;

alter table public.rewards
  add constraint rewards_fulfillment_type_check
  check (fulfillment_type in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native', 'perk_bundle'));

alter table public.reward_redemptions
  add column if not exists bundle_reward_id text references public.rewards(id) on delete set null,
  add column if not exists awarded_reward_id text references public.rewards(id) on delete set null;

create index if not exists reward_redemptions_bundle_reward_idx
  on public.reward_redemptions (bundle_reward_id)
  where bundle_reward_id is not null;

create index if not exists reward_redemptions_awarded_reward_idx
  on public.reward_redemptions (awarded_reward_id)
  where awarded_reward_id is not null;

create table if not exists public.perk_bundle_prizes (
  id uuid primary key default gen_random_uuid(),
  bundle_reward_id text not null references public.rewards(id) on delete cascade,
  prize_type text not null check (prize_type in ('reward', 'native_xp', 'xp_boost')),
  source_reward_id text references public.rewards(id) on delete set null,
  title text,
  thumbnail jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  weight integer not null default 1 check (weight > 0),
  total_win_cap integer check (total_win_cap is null or total_win_cap > 0),
  daily_win_cap integer check (daily_win_cap is null or daily_win_cap > 0),
  available_from timestamptz,
  expires_at timestamptz,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or available_from is null or expires_at > available_from),
  check (
    (prize_type = 'reward' and source_reward_id is not null)
    or (prize_type <> 'reward' and source_reward_id is null)
  )
);

create table if not exists public.perk_bundle_draws (
  id uuid primary key default gen_random_uuid(),
  bundle_reward_id text not null references public.rewards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redemption_id uuid not null unique references public.reward_redemptions(id) on delete cascade,
  prize_id uuid references public.perk_bundle_prizes(id) on delete set null,
  awarded_reward_id text references public.rewards(id) on delete set null,
  bundle_quantity_allocation_id uuid references public.reward_quantity_allocations(id) on delete set null,
  awarded_inventory_item_id uuid references public.reward_inventory_items(id) on delete set null,
  awarded_quantity_allocation_id uuid references public.reward_quantity_allocations(id) on delete set null,
  awarded_fulfillment_type text not null check (awarded_fulfillment_type in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native')),
  awarded_title text not null,
  awarded_thumbnail jsonb not null default '{}'::jsonb,
  awarded_payload jsonb not null default '{}'::jsonb,
  award_status text not null default 'awarded' check (award_status in ('awarded', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists perk_bundle_prizes_bundle_idx
  on public.perk_bundle_prizes (bundle_reward_id, sort_order, created_at);

create index if not exists perk_bundle_draws_bundle_idx
  on public.perk_bundle_draws (bundle_reward_id, created_at desc);

create index if not exists perk_bundle_draws_prize_idx
  on public.perk_bundle_draws (prize_id, created_at desc)
  where prize_id is not null;

alter table public.perk_bundle_prizes enable row level security;
alter table public.perk_bundle_draws enable row level security;

drop policy if exists "Admins can read perk bundle prizes" on public.perk_bundle_prizes;
create policy "Admins can read perk bundle prizes"
  on public.perk_bundle_prizes for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read perk bundle draws" on public.perk_bundle_draws;
create policy "Admins can read perk bundle draws"
  on public.perk_bundle_draws for select
  using (public.current_user_is_admin());

drop trigger if exists perk_bundle_prizes_set_updated_at on public.perk_bundle_prizes;
create trigger perk_bundle_prizes_set_updated_at
  before update on public.perk_bundle_prizes
  for each row execute function public.set_updated_at();

create or replace function public.apply_native_reward_effect(
  p_user_id uuid,
  p_redemption_id uuid,
  p_source_reward_id text,
  p_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bonus_transaction_id uuid;
  v_effect text := coalesce(p_config ->> 'effect', '');
  v_bonus_xp integer;
  v_boost_multiplier numeric(5,2);
  v_boost_hours integer;
  v_boost_uses integer;
begin
  if v_effect = 'xp_bonus' then
    v_bonus_xp := greatest(1, coalesce((p_config ->> 'amount')::integer, 0));

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
      p_user_id,
      v_bonus_xp,
      'earn',
      'reward_redemption',
      p_redemption_id::text,
      'native_xp_bonus:' || p_redemption_id::text,
      jsonb_build_object('rewardId', p_source_reward_id, 'effect', 'xp_bonus')
    )
    returning id into v_bonus_transaction_id;

    update public.profiles
    set xp = xp + v_bonus_xp,
        xp_balance_cached = xp_balance_cached + v_bonus_xp,
        updated_at = now()
    where id = p_user_id;

    update public.reward_redemptions
    set status = 'fulfilled',
        claim_state = 'fulfilled',
        fulfilled_at = now(),
        user_message = 'Your XP bonus has been added to your balance.'
    where id = p_redemption_id;

    return jsonb_build_object('effect', 'xp_bonus', 'transactionId', v_bonus_transaction_id);
  elsif v_effect = 'xp_boost' then
    v_boost_multiplier := greatest(1.01, coalesce((p_config ->> 'multiplier')::numeric, 1));
    v_boost_hours := greatest(1, coalesce((p_config ->> 'durationHours')::integer, 24));
    v_boost_uses := nullif(greatest(0, coalesce((p_config ->> 'uses')::integer, 0)), 0);

    insert into public.user_xp_boosts (
      user_id,
      redemption_id,
      multiplier,
      starts_at,
      ends_at,
      remaining_uses
    )
    values (
      p_user_id,
      p_redemption_id,
      v_boost_multiplier,
      now(),
      now() + make_interval(hours => v_boost_hours),
      v_boost_uses
    );

    update public.reward_redemptions
    set status = 'fulfilled',
        claim_state = 'fulfilled',
        fulfilled_at = now(),
        user_message = 'Your XP boost is active.'
    where id = p_redemption_id;

    return jsonb_build_object('effect', 'xp_boost');
  end if;

  raise exception 'This native reward is not supported yet.';
end;
$$;

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
  p_visibility_mode text,
  p_fulfillment_config jsonb,
  p_per_user_limit integer,
  p_limit_period text,
  p_redemption_window_days integer,
  p_sort_order integer,
  p_campaign_id text default null
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

  if p_fulfillment_type not in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native', 'perk_bundle') then
    raise exception 'Unsupported fulfillment type.';
  end if;

  if p_visibility_mode not in ('store', 'system_only', 'campaign_only', 'hidden') then
    raise exception 'Unsupported reward visibility mode.';
  end if;

  if p_limit_period not in ('none', 'lifetime', 'daily', 'weekly', 'monthly', 'campaign') then
    raise exception 'Unsupported reward limit period.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
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
      visibility_mode = p_visibility_mode,
      fulfillment_config = coalesce(p_fulfillment_config, '{}'::jsonb),
      per_user_limit = p_per_user_limit,
      limit_period = p_limit_period,
      redemption_window_days = p_redemption_window_days,
      sort_order = coalesce(p_sort_order, 0),
      campaign_id = p_campaign_id,
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
      'costXp', p_cost_xp,
      'campaignId', p_campaign_id,
      'visibilityMode', p_visibility_mode,
      'fulfillmentType', p_fulfillment_type
    )
  );

  return jsonb_build_object('status', 'updated', 'rewardId', p_reward_id);
end;
$$;

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
  p_visibility_mode text,
  p_fulfillment_config jsonb,
  p_per_user_limit integer,
  p_limit_period text,
  p_redemption_window_days integer,
  p_sort_order integer,
  p_total_available integer,
  p_campaign_id text default null
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

  if p_fulfillment_type not in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native', 'perk_bundle') then
    raise exception 'Unsupported fulfillment type.';
  end if;

  if p_visibility_mode not in ('store', 'system_only', 'campaign_only', 'hidden') then
    raise exception 'Unsupported reward visibility mode.';
  end if;

  if p_limit_period not in ('none', 'lifetime', 'daily', 'weekly', 'monthly', 'campaign') then
    raise exception 'Unsupported reward limit period.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
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
    visibility_mode,
    fulfillment_config,
    per_user_limit,
    limit_period,
    redemption_window_days,
    sort_order,
    is_enabled,
    total_uploaded,
    total_available,
    campaign_id
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
    p_visibility_mode,
    coalesce(p_fulfillment_config, '{}'::jsonb),
    p_per_user_limit,
    p_limit_period,
    p_redemption_window_days,
    coalesce(p_sort_order, 0),
    coalesce(p_is_enabled, false),
    v_total_available,
    v_total_available,
    p_campaign_id
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
    jsonb_build_object(
      'title', p_title,
      'status', p_status,
      'costXp', p_cost_xp,
      'campaignId', p_campaign_id,
      'visibilityMode', p_visibility_mode,
      'fulfillmentType', p_fulfillment_type
    )
  );

  return jsonb_build_object('status', 'created', 'rewardId', v_reward_id);
end;
$$;

create or replace function public.admin_upsert_perk_bundle_prize(
  p_prize_id uuid default null,
  p_bundle_reward_id text default null,
  p_prize_type text default null,
  p_source_reward_id text default null,
  p_title text default null,
  p_thumbnail jsonb default '{}'::jsonb,
  p_config jsonb default '{}'::jsonb,
  p_weight integer default 1,
  p_total_win_cap integer default null,
  p_daily_win_cap integer default null,
  p_available_from timestamptz default null,
  p_expires_at timestamptz default null,
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
  v_bundle_reward public.rewards%rowtype;
  v_existing public.perk_bundle_prizes%rowtype;
  v_source_reward public.rewards%rowtype;
  v_prize_id uuid := coalesce(p_prize_id, gen_random_uuid());
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage perk prizes.';
  end if;

  if p_weight is null or p_weight <= 0 then
    raise exception 'Prize weight must be greater than zero.';
  end if;

  if p_total_win_cap is not null and p_total_win_cap <= 0 then
    raise exception 'Total win cap must be greater than zero.';
  end if;

  if p_daily_win_cap is not null and p_daily_win_cap <= 0 then
    raise exception 'Daily win cap must be greater than zero.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Prize expiry must be after available from.';
  end if;

  if p_prize_id is not null then
    select * into v_existing
    from public.perk_bundle_prizes
    where id = p_prize_id
    for update;

    if not found then
      raise exception 'Perk prize not found.';
    end if;
  end if;

  select * into v_bundle_reward
  from public.rewards
  where id = coalesce(p_bundle_reward_id, v_existing.bundle_reward_id)
  for update;

  if not found or v_bundle_reward.fulfillment_type <> 'perk_bundle' then
    raise exception 'Choose a perk bundle reward first.';
  end if;

  if coalesce(p_prize_type, v_existing.prize_type) not in ('reward', 'native_xp', 'xp_boost') then
    raise exception 'Unsupported perk prize type.';
  end if;

  if coalesce(p_prize_type, v_existing.prize_type) = 'reward' then
    if nullif(trim(coalesce(p_source_reward_id, '')), '') is null then
      raise exception 'Choose a reward prize source.';
    end if;

    select * into v_source_reward
    from public.rewards
    where id = p_source_reward_id
    for update;

    if not found or v_source_reward.fulfillment_type in ('native', 'perk_bundle') then
      raise exception 'Choose a real reward with partner or fulfillment inventory.';
    end if;
  else
    if coalesce(p_prize_type, v_existing.prize_type) = 'native_xp'
       and greatest(1, coalesce((p_config ->> 'amount')::integer, 0)) <= 0 then
      raise exception 'Fallback XP must be greater than zero.';
    end if;
  end if;

  insert into public.perk_bundle_prizes (
    id,
    bundle_reward_id,
    prize_type,
    source_reward_id,
    title,
    thumbnail,
    config,
    weight,
    total_win_cap,
    daily_win_cap,
    available_from,
    expires_at,
    sort_order,
    is_enabled
  )
  values (
    v_prize_id,
    v_bundle_reward.id,
    coalesce(p_prize_type, 'native_xp'),
    case when coalesce(p_prize_type, 'native_xp') = 'reward' then p_source_reward_id else null end,
    nullif(trim(coalesce(p_title, '')), ''),
    coalesce(p_thumbnail, '{}'::jsonb),
    coalesce(p_config, '{}'::jsonb),
    greatest(1, coalesce(p_weight, 1)),
    p_total_win_cap,
    p_daily_win_cap,
    p_available_from,
    p_expires_at,
    coalesce(p_sort_order, 0),
    coalesce(p_is_enabled, true)
  )
  on conflict (id) do update
  set prize_type = excluded.prize_type,
      source_reward_id = excluded.source_reward_id,
      title = excluded.title,
      thumbnail = excluded.thumbnail,
      config = excluded.config,
      weight = excluded.weight,
      total_win_cap = excluded.total_win_cap,
      daily_win_cap = excluded.daily_win_cap,
      available_from = excluded.available_from,
      expires_at = excluded.expires_at,
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
    case when p_prize_id is null then 'perk_bundle_prize_created' else 'perk_bundle_prize_updated' end,
    'perk_bundle_prize',
    v_prize_id::text,
    jsonb_build_object(
      'bundleRewardId', v_bundle_reward.id,
      'prizeType', coalesce(p_prize_type, v_existing.prize_type),
      'sourceRewardId', p_source_reward_id
    )
  );

  return jsonb_build_object('status', case when p_prize_id is null then 'created' else 'updated' end, 'prizeId', v_prize_id);
end;
$$;

create or replace function public.admin_delete_perk_bundle_prize(
  p_prize_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_prize public.perk_bundle_prizes%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage perk prizes.';
  end if;

  select * into v_prize
  from public.perk_bundle_prizes
  where id = p_prize_id
  for update;

  if not found then
    raise exception 'Perk prize not found.';
  end if;

  delete from public.perk_bundle_prizes where id = p_prize_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'perk_bundle_prize_deleted',
    'perk_bundle_prize',
    p_prize_id::text,
    jsonb_build_object('bundleRewardId', v_prize.bundle_reward_id)
  );

  return jsonb_build_object('status', 'deleted', 'prizeId', p_prize_id);
end;
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
     or v_bundle.fulfillment_type <> 'perk_bundle'
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
      and bundle_reward_id = v_bundle.id
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
         or v_source_reward.fulfillment_type in ('native', 'perk_bundle')
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
    v_fallback := coalesce(v_bundle.fulfillment_config -> 'fallback', '{}'::jsonb);
    v_awarded_reward_id := null;
    v_awarded_title := coalesce(nullif(trim(coalesce(v_fallback ->> 'title', '')), ''), 'Bonus XP');
    v_awarded_description := 'A fallback reward from your perk.';
    v_awarded_thumbnail := coalesce(v_fallback -> 'thumbnail', v_bundle.thumbnail, '{}'::jsonb);
    v_awarded_claim_steps := '[]'::jsonb;

    if coalesce(v_fallback ->> 'prizeType', 'native_xp') = 'xp_boost' then
      v_awarded_fulfillment_config := jsonb_build_object(
        'effect', 'xp_boost',
        'multiplier', greatest(1.1, coalesce((v_fallback ->> 'multiplier')::numeric, 2)),
        'durationHours', greatest(1, coalesce((v_fallback ->> 'durationHours')::integer, 24)),
        'uses', greatest(1, coalesce((v_fallback ->> 'uses')::integer, 1))
      );
      v_awarded_title := coalesce(nullif(trim(coalesce(v_fallback ->> 'title', '')), ''), 'XP Boost');
    else
      v_awarded_fulfillment_config := jsonb_build_object(
        'effect', 'xp_bonus',
        'amount', greatest(1, coalesce((v_fallback ->> 'amount')::integer, 1))
      );
    end if;

    v_awarded_fulfillment_type := 'native';
    v_payload := v_awarded_fulfillment_config;
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
    v_bundle.cost_xp,
    'spend',
    'reward_redemption',
    v_redemption_id::text,
    jsonb_build_object('rewardId', v_bundle.id, 'rewardTitle', v_bundle.title, 'bundle', true)
  )
  returning id into v_xp_transaction_id;

  update public.profiles
  set xp = greatest(0, xp - v_bundle.cost_xp),
      xp_balance_cached = greatest(0, xp_balance_cached - v_bundle.cost_xp),
      updated_at = now()
  where id = v_user_id;

  update public.reward_quantity_allocations
  set quantity_available = greatest(0, quantity_available - 1),
      updated_at = now()
  where id = v_bundle_quantity_allocation.id;

  perform public.refresh_reward_quantity_inventory_counts(v_bundle.id);

  if v_awarded_quantity_allocation.id is not null then
    update public.reward_quantity_allocations
    set quantity_available = greatest(0, quantity_available - 1),
        updated_at = now()
    where id = v_awarded_quantity_allocation.id;

    if v_awarded_reward_id is not null then
      perform public.refresh_reward_quantity_inventory_counts(v_awarded_reward_id);
    end if;
  end if;

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
    redemption_expires_at
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
    v_redemption_expires_at
  );

  if v_awarded_inventory_item.id is not null then
    update public.reward_inventory_items
    set status = 'reserved',
        redemption_id = v_redemption_id,
        assigned_at = now()
    where id = v_awarded_inventory_item.id;

    perform public.refresh_reward_item_inventory_counts(v_awarded_reward_id);
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
  v_inventory_reward_id text;
  v_draw public.perk_bundle_draws%rowtype;
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

  v_inventory_reward_id := coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);

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
      perform public.refresh_reward_item_inventory_counts(v_inventory_reward_id);
    end if;
  elsif v_redemption.quantity_allocation_id is not null then
    update public.reward_quantity_allocations
    set quantity_available = least(quantity_total, quantity_available + 1),
        updated_at = now()
    where id = v_redemption.quantity_allocation_id;

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_quantity_inventory_counts(v_inventory_reward_id);
    end if;
  end if;

  select *
    into v_draw
  from public.perk_bundle_draws
  where redemption_id = p_redemption_id
  for update;

  if found and v_draw.bundle_quantity_allocation_id is not null then
    update public.reward_quantity_allocations
    set quantity_available = least(quantity_total, quantity_available + 1),
        updated_at = now()
    where id = v_draw.bundle_quantity_allocation_id;

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_quantity_inventory_counts(v_draw.bundle_reward_id);
    end if;

    update public.perk_bundle_draws
    set award_status = 'refunded'
    where id = v_draw.id;
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
      'awardedRewardId', v_redemption.awarded_reward_id,
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
  v_inventory_reward_id text;
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

  v_inventory_reward_id := coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);
  perform public.refresh_reward_item_inventory_counts(v_inventory_reward_id);

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
    jsonb_build_object('rewardId', v_redemption.reward_id, 'awardedRewardId', v_redemption.awarded_reward_id, 'note', p_note)
  );

  return jsonb_build_object('id', p_redemption_id, 'claimState', 'fulfilled');
end;
$$;

grant execute on function public.apply_native_reward_effect(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.admin_upsert_perk_bundle_prize(uuid, text, text, text, text, jsonb, jsonb, integer, integer, integer, timestamptz, timestamptz, integer, boolean) to authenticated;
grant execute on function public.admin_delete_perk_bundle_prize(uuid) to authenticated;
grant execute on function public.redeem_perk_bundle(text) to authenticated;
