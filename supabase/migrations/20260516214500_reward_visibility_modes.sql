alter table public.rewards
  add column if not exists visibility_mode text not null default 'store'
    check (visibility_mode in ('store', 'system_only', 'campaign_only', 'hidden'));

update public.rewards
set visibility_mode = case
  when fulfillment_type = 'native' then 'system_only'
  when visibility_mode is null then 'store'
  else visibility_mode
end
where fulfillment_type = 'native'
   or visibility_mode is null;

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

  if p_fulfillment_type not in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native') then
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
      'visibilityMode', p_visibility_mode
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

  if p_fulfillment_type not in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native') then
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
      'visibilityMode', p_visibility_mode
    )
  );

  return jsonb_build_object('status', 'created', 'rewardId', v_reward_id);
end;
$$;
