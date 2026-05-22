create table if not exists public.campaigns (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  budget_label text,
  budget_amount integer check (budget_amount is null or budget_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;

drop policy if exists "Admins can read campaigns" on public.campaigns;
create policy "Admins can read campaigns"
  on public.campaigns for select
  using (public.current_user_is_admin());

alter table public.rewards
  add column if not exists campaign_id text references public.campaigns(id) on delete set null;

alter table public.reward_inventory_items
  add column if not exists campaign_id text references public.campaigns(id) on delete set null,
  add column if not exists batch_label text,
  add column if not exists partner_reference text;

alter table public.reward_inventory_adjustments
  add column if not exists campaign_id text references public.campaigns(id) on delete set null,
  add column if not exists batch_label text,
  add column if not exists partner_reference text;

create index if not exists rewards_campaign_idx
  on public.rewards (campaign_id, sort_order);

create index if not exists reward_inventory_items_campaign_idx
  on public.reward_inventory_items (campaign_id, reward_id, status);

create index if not exists reward_inventory_adjustments_campaign_idx
  on public.reward_inventory_adjustments (campaign_id, reward_id, created_at desc);

insert into public.campaigns (
  id,
  slug,
  name,
  description,
  status,
  starts_at,
  ends_at,
  budget_label
)
values (
  'campaign-evergreen',
  'evergreen',
  'Evergreen Rewards',
  'Default campaign for existing rewards and always-on inventory.',
  'active',
  '2026-01-01 00:00:00+00',
  null,
  'Evergreen'
)
on conflict (id) do nothing;

update public.rewards
set campaign_id = coalesce(campaign_id, 'campaign-evergreen')
where campaign_id is null;

update public.reward_inventory_items
set campaign_id = coalesce(campaign_id, 'campaign-evergreen')
where campaign_id is null;

update public.reward_inventory_adjustments
set campaign_id = coalesce(campaign_id, 'campaign-evergreen')
where campaign_id is null;

drop policy if exists "Admins can read all campaigns" on public.campaigns;
create policy "Admins can read all campaigns"
  on public.campaigns for select
  using (public.current_user_is_admin());

create or replace function public.admin_upsert_campaign(
  p_campaign_id text,
  p_name text,
  p_slug text,
  p_description text,
  p_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_budget_label text,
  p_budget_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_campaign_id text := lower(regexp_replace(trim(coalesce(p_campaign_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_slug text := lower(regexp_replace(trim(coalesce(p_slug, p_name, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_exists boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage campaigns.';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Campaign name is required.';
  end if;

  if p_status not in ('draft', 'active', 'archived') then
    raise exception 'Unsupported campaign status.';
  end if;

  if v_campaign_id = '' then
    v_campaign_id := 'campaign-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  end if;

  if v_slug = '' then
    v_slug := v_campaign_id;
  end if;

  select exists(select 1 from public.campaigns where id = v_campaign_id) into v_exists;

  insert into public.campaigns (
    id,
    slug,
    name,
    description,
    status,
    starts_at,
    ends_at,
    budget_label,
    budget_amount
  )
  values (
    v_campaign_id,
    v_slug,
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_status,
    p_starts_at,
    p_ends_at,
    nullif(trim(coalesce(p_budget_label, '')), ''),
    p_budget_amount
  )
  on conflict (id) do update
  set slug = excluded.slug,
      name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      budget_label = excluded.budget_label,
      budget_amount = excluded.budget_amount,
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
    case when v_exists then 'campaign_updated' else 'campaign_created' end,
    'campaign',
    v_campaign_id,
    jsonb_build_object('name', p_name, 'status', p_status)
  );

  return jsonb_build_object('status', case when v_exists then 'updated' else 'created' end, 'campaignId', v_campaign_id);
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
      'campaignId', p_campaign_id
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
    jsonb_build_object('title', p_title, 'status', p_status, 'costXp', p_cost_xp, 'campaignId', p_campaign_id)
  );

  return jsonb_build_object('status', 'created', 'rewardId', v_reward_id);
end;
$$;

create or replace function public.admin_set_reward_quantity(
  p_reward_id text,
  p_total_available integer,
  p_reason text,
  p_campaign_id text default null,
  p_batch_label text default null,
  p_partner_reference text default null
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

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
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
      campaign_id,
      batch_label,
      partner_reference,
      delta,
      reason,
      created_by
    )
    values (
      p_reward_id,
      p_campaign_id,
      nullif(trim(coalesce(p_batch_label, '')), ''),
      nullif(trim(coalesce(p_partner_reference, '')), ''),
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
    jsonb_build_object(
      'previous', v_current,
      'next', v_next,
      'delta', v_delta,
      'reason', p_reason,
      'campaignId', p_campaign_id,
      'batchLabel', p_batch_label
    )
  );

  return jsonb_build_object('status', 'updated', 'rewardId', p_reward_id, 'totalAvailable', v_next, 'delta', v_delta);
end;
$$;

create or replace function public.admin_upload_reward_inventory(
  p_reward_id text,
  p_item_type text,
  p_items jsonb,
  p_expires_at timestamptz,
  p_campaign_id text default null,
  p_batch_label text default null,
  p_partner_reference text default null
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
  v_row_campaign_id text;
  v_row_expires_at timestamptz;
  v_row_partner_reference text;
  v_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can upload reward inventory.';
  end if;

  if p_item_type not in ('voucher_code', 'qr_code') then
    raise exception 'Inventory upload only supports voucher and QR rewards.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
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
    v_row_campaign_id := coalesce(nullif(v_item ->> 'campaignId', ''), p_campaign_id, v_reward.campaign_id);
    v_row_partner_reference := coalesce(nullif(v_item ->> 'partnerReference', ''), p_partner_reference);
    v_row_expires_at := coalesce(nullif(v_item ->> 'expiresAt', '')::timestamptz, p_expires_at);

    if v_row_campaign_id is not null
       and not exists (select 1 from public.campaigns where id = v_row_campaign_id) then
      raise exception 'Campaign not found for inventory row.';
    end if;

    if v_value is not null then
      insert into public.reward_inventory_items (
        reward_id,
        campaign_id,
        batch_label,
        partner_reference,
        item_type,
        payload,
        expires_at,
        uploaded_by
      )
      values (
        p_reward_id,
        v_row_campaign_id,
        nullif(trim(coalesce(p_batch_label, '')), ''),
        nullif(trim(coalesce(v_row_partner_reference, '')), ''),
        p_item_type,
        case
          when p_item_type = 'voucher_code' then jsonb_build_object('code', v_value)
          else jsonb_build_object('qrPayload', v_value)
        end,
        v_row_expires_at,
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
    jsonb_build_object('count', v_count, 'itemType', p_item_type, 'campaignId', p_campaign_id, 'batchLabel', p_batch_label)
  );

  return jsonb_build_object('status', 'uploaded', 'rewardId', p_reward_id, 'count', v_count);
end;
$$;
