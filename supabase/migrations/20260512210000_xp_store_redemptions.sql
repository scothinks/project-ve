alter table public.rewards
  add column if not exists thumbnail jsonb not null default '{}'::jsonb,
  add column if not exists offer_expires_at timestamptz,
  add column if not exists terms text,
  add column if not exists claim_steps jsonb not null default '[]'::jsonb,
  add column if not exists fulfillment_type text not null default 'manual'
    check (fulfillment_type in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native')),
  add column if not exists fulfillment_config jsonb not null default '{}'::jsonb,
  add column if not exists per_user_limit integer not null default 1 check (per_user_limit > 0),
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists total_uploaded integer not null default 0 check (total_uploaded >= 0),
  add column if not exists total_available integer not null default 0 check (total_available >= 0);

alter table public.reward_redemptions
  add column if not exists xp_cost_at_redemption integer check (xp_cost_at_redemption is null or xp_cost_at_redemption > 0),
  add column if not exists fulfillment_type text
    check (fulfillment_type is null or fulfillment_type in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native')),
  add column if not exists fulfillment_payload jsonb not null default '{}'::jsonb,
  add column if not exists claim_data jsonb,
  add column if not exists claim_state text not null default 'purchased'
    check (claim_state in ('purchased', 'claim_started', 'details_submitted', 'fulfilled', 'expired', 'cancelled', 'refunded')),
  add column if not exists claim_started_at timestamptz,
  add column if not exists claim_submitted_at timestamptz,
  add column if not exists user_message text,
  add column if not exists reward_title_snapshot text,
  add column if not exists reward_description_snapshot text,
  add column if not exists reward_thumbnail_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists claim_steps_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists fulfillment_config_snapshot jsonb not null default '{}'::jsonb;

create table if not exists public.reward_inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.rewards(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.reward_inventory_adjustments enable row level security;

drop policy if exists "Admins can read reward inventory adjustments" on public.reward_inventory_adjustments;
create policy "Admins can read reward inventory adjustments"
  on public.reward_inventory_adjustments for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create index if not exists rewards_store_order_idx
  on public.rewards (sort_order, created_at desc)
  where status = 'published' and is_enabled = true;

create index if not exists reward_redemptions_user_requested_idx
  on public.reward_redemptions (user_id, requested_at desc);

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
  v_existing_count integer;
  v_redemption_id uuid := gen_random_uuid();
  v_xp_transaction_id uuid;
  v_payload jsonb := '{}'::jsonb;
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

  if v_reward.total_available <= 0 then
    raise exception 'This reward is currently sold out.';
  end if;

  if v_balance < v_reward.cost_xp then
    raise exception 'You need more XP to exchange for this reward.';
  end if;

  select count(*)
    into v_existing_count
  from public.reward_redemptions
  where user_id = v_user_id
    and reward_id = p_reward_id
    and claim_state not in ('cancelled', 'refunded');

  if v_existing_count >= v_reward.per_user_limit then
    raise exception 'You have already reached the limit for this reward.';
  end if;

  if v_reward.fulfillment_type = 'voucher_code' then
    v_payload := jsonb_build_object(
      'code',
      coalesce(v_reward.fulfillment_config ->> 'code', 'VE-DEMO-CODE')
    );
  elsif v_reward.fulfillment_type = 'qr_code' then
    v_payload := jsonb_build_object(
      'qrPayload',
      coalesce(v_reward.fulfillment_config ->> 'qrPayload', 'project-ve:redemption:' || v_redemption_id::text)
    );
  elsif v_reward.fulfillment_type = 'external_link' then
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

  update public.rewards
  set total_available = total_available - 1,
      inventory_count = greatest(0, coalesce(inventory_count, total_available) - 1),
      updated_at = now()
  where id = v_reward.id;

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
    fulfillment_config_snapshot
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
    'purchased',
    case
      when v_reward.fulfillment_type = 'manual' then 'Submit your details so the reward partner can process fulfillment.'
      when v_reward.fulfillment_type = 'voucher_code' then 'Your voucher code is ready.'
      when v_reward.fulfillment_type = 'qr_code' then 'Your QR pass is ready.'
      when v_reward.fulfillment_type = 'external_link' then 'Your reward link is ready.'
      else 'Your reward has been added.'
    end,
    v_reward.title,
    v_reward.description,
    v_reward.thumbnail,
    v_reward.claim_steps,
    v_reward.fulfillment_config
  );

  return jsonb_build_object(
    'id', v_redemption_id,
    'rewardId', v_reward.id,
    'xpCost', v_reward.cost_xp,
    'claimState', 'purchased',
    'fulfillmentType', v_reward.fulfillment_type
  );
end;
$$;

create or replace function public.submit_manual_redemption_details(
  p_redemption_id uuid,
  p_claim_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_redemption public.reward_redemptions%rowtype;
begin
  if v_user_id is null then
    raise exception 'You need an account to submit reward details.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'We could not find this reward purchase.';
  end if;

  if v_redemption.fulfillment_type <> 'manual' then
    raise exception 'This reward does not need a details form.';
  end if;

  if v_redemption.claim_state in ('details_submitted', 'fulfilled', 'cancelled', 'refunded') then
    raise exception 'This reward has already moved past the details step.';
  end if;

  update public.reward_redemptions
  set claim_data = coalesce(p_claim_data, '{}'::jsonb),
      claim_state = 'details_submitted',
      claim_started_at = coalesce(claim_started_at, now()),
      claim_submitted_at = now(),
      user_message = 'Your details were submitted. We will share them with the reward partner for fulfillment.'
  where id = p_redemption_id;

  return jsonb_build_object(
    'id', p_redemption_id,
    'claimState', 'details_submitted'
  );
end;
$$;

grant execute on function public.redeem_reward(text) to authenticated;
grant execute on function public.submit_manual_redemption_details(uuid, jsonb) to authenticated;

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
  sort_order,
  is_enabled,
  total_uploaded,
  total_available
)
values
  (
    'reward-meal-ticket-500',
    'N500 Meal Ticket',
    'Exchange XP for a partner-managed meal ticket.',
    20,
    25,
    now() - interval '1 day',
    '2026-07-31 23:59:59+00',
    'published',
    '{"icon":"MEAL","color":"#f4fbf7"}',
    '2026-06-30 23:59:59+00',
    'One ticket per learner while the offer is available. Partner fulfillment timelines may vary.',
    '["Submit your name and phone number.", "Project VE shares your request with the reward partner.", "The partner contacts you with pickup or delivery instructions."]',
    'manual',
    '{"fields":[{"id":"fullName","label":"Full name","type":"text","required":true},{"id":"phone","label":"Phone number","type":"tel","required":true},{"id":"city","label":"City","type":"text","required":true}]}',
    1,
    10,
    true,
    25,
    25
  ),
  (
    'reward-airtime-voucher',
    'Airtime Voucher',
    'Get a demo airtime voucher code you can reveal after exchange.',
    40,
    40,
    now() - interval '1 day',
    '2026-07-31 23:59:59+00',
    'published',
    '{"icon":"AIR","color":"#eef7ff"}',
    '2026-06-15 23:59:59+00',
    'Voucher codes are single-use and subject to partner network availability.',
    '["Reveal your voucher code.", "Copy the code.", "Redeem it with the listed airtime partner."]',
    'voucher_code',
    '{"code":"VE-AIRTIME-1000","partner":"DemoTel"}',
    1,
    20,
    true,
    40,
    40
  ),
  (
    'reward-event-qr-pass',
    'Community Event Pass',
    'Unlock a QR pass for a Project VE partner event.',
    100,
    12,
    now() - interval '1 day',
    '2026-08-31 23:59:59+00',
    'published',
    '{"icon":"PASS","color":"#fff7ed"}',
    '2026-07-15 23:59:59+00',
    'QR passes are valid only for the named event and may require identity confirmation.',
    '["Open your QR pass.", "Present it at the event desk.", "A partner scans and validates the pass."]',
    'qr_code',
    '{"event":"Project VE Community Clinic"}',
    1,
    30,
    true,
    12,
    12
  ),
  (
    'reward-partner-discount',
    'Partner Discount',
    'Open a partner page to claim a limited learning discount.',
    75,
    100,
    now() - interval '1 day',
    '2026-09-30 23:59:59+00',
    'published',
    '{"icon":"DEAL","color":"#f8f5ff"}',
    '2026-07-31 23:59:59+00',
    'Partner offers may change or close after the offer window ends.',
    '["Open the partner link.", "Follow the partner redemption instructions.", "Use the same email you use on Project VE."]',
    'external_link',
    '{"url":"https://example.com/project-ve-discount","buttonLabel":"Open partner offer"}',
    1,
    40,
    true,
    100,
    100
  ),
  (
    'reward-retry-pass',
    'XP Retry Pass',
    'Unlock one extra XP-eligible lesson retry when available.',
    60,
    50,
    now() - interval '1 day',
    '2026-08-31 23:59:59+00',
    'published',
    '{"icon":"RETRY","color":"#edfdf5"}',
    '2026-07-01 23:59:59+00',
    'Native rewards apply inside Project VE and may depend on lesson retry rules.',
    '["Your retry pass is added to your account.", "Use it on an eligible lesson.", "Earn only XP that remains eligible."]',
    'native',
    '{"effect":"lesson_retry_pass","quantity":1}',
    2,
    50,
    true,
    50,
    50
  )
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    cost_xp = excluded.cost_xp,
    inventory_count = excluded.inventory_count,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    thumbnail = excluded.thumbnail,
    offer_expires_at = excluded.offer_expires_at,
    terms = excluded.terms,
    claim_steps = excluded.claim_steps,
    fulfillment_type = excluded.fulfillment_type,
    fulfillment_config = excluded.fulfillment_config,
    per_user_limit = excluded.per_user_limit,
    sort_order = excluded.sort_order,
    is_enabled = excluded.is_enabled,
    total_uploaded = greatest(public.rewards.total_uploaded, excluded.total_uploaded),
    total_available = greatest(public.rewards.total_available, excluded.total_available),
    updated_at = now();
