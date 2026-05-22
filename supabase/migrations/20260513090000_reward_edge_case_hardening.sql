alter table public.rewards
  add column if not exists limit_period text not null default 'lifetime'
    check (limit_period in ('none', 'lifetime', 'daily', 'weekly', 'monthly', 'campaign')),
  add column if not exists redemption_window_days integer check (redemption_window_days is null or redemption_window_days > 0);

alter table public.reward_redemptions
  add column if not exists redemption_expires_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists expiry_reason text,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_xp_transaction_id uuid unique references public.xp_transactions(id) on delete restrict,
  add column if not exists admin_note text;

create table if not exists public.reward_inventory_items (
  id uuid primary key default gen_random_uuid(),
  reward_id text not null references public.rewards(id) on delete cascade,
  item_type text not null check (item_type in ('voucher_code', 'qr_code')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'redeemed', 'expired', 'void')),
  redemption_id uuid unique references public.reward_redemptions(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  assigned_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz,
  notes text
);

create index if not exists reward_inventory_items_available_idx
  on public.reward_inventory_items (reward_id, status, uploaded_at)
  where status = 'available';

alter table public.reward_inventory_items enable row level security;

drop policy if exists "Admins can read reward inventory items" on public.reward_inventory_items;
create policy "Admins can read reward inventory items"
  on public.reward_inventory_items for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create table if not exists public.user_xp_boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  redemption_id uuid not null unique references public.reward_redemptions(id) on delete cascade,
  multiplier numeric(5,2) not null check (multiplier > 1),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  remaining_uses integer check (remaining_uses is null or remaining_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  status text not null default 'active' check (status in ('active', 'consumed', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists user_xp_boosts_active_idx
  on public.user_xp_boosts (user_id, status, ends_at)
  where status = 'active';

alter table public.user_xp_boosts enable row level security;

drop policy if exists "Users can read their XP boosts" on public.user_xp_boosts;
create policy "Users can read their XP boosts"
  on public.user_xp_boosts for select
  using (auth.uid() = user_id);

insert into public.reward_inventory_items (reward_id, item_type, payload, expires_at)
select
  'reward-airtime-voucher',
  'voucher_code',
  jsonb_build_object('code', 'VE-AIRTIME-' || lpad(series::text, 4, '0'), 'partner', 'DemoTel'),
  '2026-08-31 23:59:59+00'::timestamptz
from generate_series(1, 12) series
where not exists (
  select 1 from public.reward_inventory_items where reward_id = 'reward-airtime-voucher'
);

insert into public.reward_inventory_items (reward_id, item_type, payload, expires_at)
select
  'reward-event-qr-pass',
  'qr_code',
  jsonb_build_object('qrPayload', 'project-ve:event-pass:' || lpad(series::text, 4, '0')),
  '2026-09-30 23:59:59+00'::timestamptz
from generate_series(1, 8) series
where not exists (
  select 1 from public.reward_inventory_items where reward_id = 'reward-event-qr-pass'
);

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
  where reward_id in ('reward-airtime-voucher', 'reward-event-qr-pass')
  group by reward_id
) inventory
where rewards.id = inventory.reward_id;

update public.rewards
set limit_period = 'lifetime',
    redemption_window_days = 30,
    fulfillment_config = jsonb_set(
      fulfillment_config,
      '{fields}',
      '[
        {"id":"fullName","label":"Full name","type":"text","required":true},
        {"id":"phone","label":"Phone number","type":"tel","required":true},
        {"id":"email","label":"Email","type":"email","required":true},
        {"id":"city","label":"City","type":"text","required":true}
      ]'::jsonb
    )
where id = 'reward-meal-ticket-500';

update public.rewards
set title = 'XP Bonus',
    description = 'Top up your XP balance instantly.',
    cost_xp = 80,
    thumbnail = '{"icon":"BONUS","color":"#edfdf5"}',
    terms = 'Native XP bonuses are added immediately after exchange.',
    claim_steps = '["Confirm the exchange.", "Project VE adds the bonus XP to your balance.", "Use your updated balance in the XP Store."]',
    fulfillment_config = '{"effect":"xp_bonus","amount":120}',
    per_user_limit = 1,
    limit_period = 'weekly',
    redemption_window_days = null,
    total_uploaded = 100,
    total_available = greatest(total_available, 50),
    inventory_count = greatest(coalesce(inventory_count, 0), 50),
    updated_at = now()
where id = 'reward-retry-pass';

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
  total_available
)
values (
  'reward-xp-boost',
  'XP Boost',
  'Multiply the next XP you earn for a limited period.',
  90,
  50,
  now() - interval '1 day',
  '2026-09-30 23:59:59+00',
  'published',
  '{"icon":"BOOST","color":"#fff7ed"}',
  '2026-07-31 23:59:59+00',
  'Boost bonus XP is added when you correctly answer eligible quiz questions while the boost is active.',
  '["Confirm the exchange.", "Project VE activates your boost.", "Earn boosted XP on eligible quiz questions before the boost expires."]',
  'native',
  '{"effect":"xp_boost","multiplier":2,"durationHours":24,"uses":3}',
  1,
  'weekly',
  null,
  60,
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
    limit_period = excluded.limit_period,
    redemption_window_days = excluded.redemption_window_days,
    sort_order = excluded.sort_order,
    is_enabled = excluded.is_enabled,
    total_uploaded = greatest(public.rewards.total_uploaded, excluded.total_uploaded),
    total_available = greatest(public.rewards.total_available, excluded.total_available),
    updated_at = now();

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

  if v_reward.total_available <= 0 then
    raise exception 'This reward is currently sold out.';
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
      and (expires_at is null or expires_at > now())
    order by uploaded_at asc
    for update skip locked
    limit 1;

    if v_inventory_item.id is null then
      raise exception 'This reward is currently sold out.';
    end if;

    v_payload := v_inventory_item.payload;
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

  if v_inventory_item.id is not null then
    update public.reward_inventory_items
    set status = 'reserved',
        redemption_id = v_redemption_id,
        assigned_at = now()
    where id = v_inventory_item.id;
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
  v_field jsonb;
  v_field_id text;
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

  if v_redemption.redemption_expires_at is not null
     and v_redemption.redemption_expires_at <= now() then
    update public.reward_redemptions
    set claim_state = 'expired',
        expired_at = now(),
        expiry_reason = 'redemption_window_expired',
        user_message = 'This reward redemption has expired.'
    where id = p_redemption_id;

    raise exception 'This reward redemption has expired.';
  end if;

  if v_redemption.claim_state in ('details_submitted', 'fulfilled', 'cancelled', 'refunded', 'expired') then
    raise exception 'This reward has already moved past the details step.';
  end if;

  for v_field in
    select value
    from jsonb_array_elements(coalesce(v_redemption.fulfillment_config_snapshot -> 'fields', '[]'::jsonb))
  loop
    if coalesce((v_field ->> 'required')::boolean, false) then
      v_field_id := v_field ->> 'id';

      if v_field_id is null
         or not coalesce(p_claim_data, '{}'::jsonb) ? v_field_id
         or length(trim(coalesce(p_claim_data ->> v_field_id, ''))) = 0 then
        raise exception 'Please complete all required reward details.';
      end if;
    end if;
  end loop;

  update public.reward_redemptions
  set claim_data = coalesce(p_claim_data, '{}'::jsonb),
      claim_state = 'details_submitted',
      claim_started_at = coalesce(claim_started_at, now()),
      claim_submitted_at = now(),
      user_message = 'Submitted for processing.'
  where id = p_redemption_id;

  return jsonb_build_object(
    'id', p_redemption_id,
    'claimState', 'details_submitted'
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
    jsonb_build_object('reason', coalesce(p_reason, 'admin_refund'))
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

  return jsonb_build_object(
    'id', p_redemption_id,
    'claimState', 'refunded',
    'refundXpTransactionId', v_refund_transaction_id
  );
end;
$$;

create or replace function public.answer_quiz_question(
  p_attempt_id uuid,
  p_question_id text,
  p_selected_option_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
  v_question_xp integer;
  v_attempt_question_count integer;
  v_answered_count integer;
  v_correct_option_ids text[];
  v_selected_option_ids text[];
  v_has_invalid_option boolean;
  v_is_correct boolean;
  v_already_awarded boolean;
  v_daily_limit integer := 30;
  v_daily_earned integer := 0;
  v_daily_remaining integer := 0;
  v_status public.quiz_answer_status;
  v_earned_xp integer := 0;
  v_base_earned_xp integer := 0;
  v_boost_bonus_xp integer := 0;
  v_answer_correct boolean;
  v_award_scope text := 'quiz_question:' || p_question_id;
  v_completed boolean := false;
  v_attempt_status public.quiz_attempt_status;
  v_boost public.user_xp_boosts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_attempt
    from public.quiz_attempts
   where id = p_attempt_id
     and user_id = v_user_id
   for update;

  if v_attempt.id is null or v_attempt.status <> 'in_progress' then
    raise exception 'Attempt is not active.';
  end if;

  if exists (
    select 1 from public.quiz_answers
    where attempt_id = p_attempt_id and question_id = p_question_id
  ) then
    raise exception 'This question has already been answered.';
  end if;

  select xp
    into v_question_xp
    from public.quiz_attempt_questions
   where attempt_id = p_attempt_id
     and question_id = p_question_id;

  if v_question_xp is null then
    raise exception 'Question is not part of this attempt.';
  end if;

  select coalesce(array_agg(distinct option_id order by option_id), '{}'::text[])
    into v_selected_option_ids
    from unnest(coalesce(p_selected_option_ids, '{}'::text[])) as option_id;

  if coalesce(array_length(v_selected_option_ids, 1), 0) = 0 then
    raise exception 'At least one selected option is required.';
  end if;

  select exists (
    select 1
      from unnest(v_selected_option_ids) selected(option_id)
     where not exists (
       select 1 from public.quiz_options o
        where o.id = selected.option_id
          and o.question_id = p_question_id
     )
  )
    into v_has_invalid_option;

  if v_has_invalid_option then
    raise exception 'One or more selected options do not belong to this question.';
  end if;

  select coalesce(array_agg(id order by id), '{}'::text[])
    into v_correct_option_ids
    from public.quiz_options
   where question_id = p_question_id
     and is_correct = true;

  v_is_correct := v_selected_option_ids = v_correct_option_ids;
  v_answer_correct := v_is_correct;

  select exists (
    select 1 from public.xp_transactions
     where user_id = v_user_id
       and direction = 'earn'
       and award_scope = v_award_scope
  )
    into v_already_awarded;

  select coalesce(earnable_quiz_xp_limit, 30)
    into v_daily_limit
    from public.user_daily_xp_limits
   where user_id = v_user_id
     and local_date = (now() at time zone 'Africa/Lagos')::date;

  v_daily_limit := coalesce(v_daily_limit, 30);

  select coalesce(sum(amount), 0)
    into v_daily_earned
    from public.xp_transactions
   where user_id = v_user_id
     and direction = 'earn'
     and source_type = 'quiz_question'
     and (created_at at time zone 'Africa/Lagos')::date =
       (now() at time zone 'Africa/Lagos')::date;

  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

  update public.user_xp_boosts
     set status = 'expired'
   where user_id = v_user_id
     and status = 'active'
     and ends_at <= now();

  if v_attempt.mode = 'practice' then
    v_status := 'practice';
    v_answer_correct := v_is_correct;
  elsif not v_is_correct then
    v_status := 'missed';
  elsif v_already_awarded then
    v_status := 'already_earned';
  elsif v_daily_remaining < v_question_xp then
    v_status := 'daily_cap_deferred';
    v_answer_correct := false;
  else
    v_status := 'earned';
    v_base_earned_xp := v_question_xp;
    v_earned_xp := v_question_xp;

    select *
      into v_boost
    from public.user_xp_boosts
    where user_id = v_user_id
      and status = 'active'
      and starts_at <= now()
      and ends_at > now()
      and (remaining_uses is null or used_count < remaining_uses)
    order by multiplier desc, ends_at asc
    for update skip locked
    limit 1;

    if v_boost.id is not null then
      v_boost_bonus_xp := greatest(0, floor(v_question_xp * (v_boost.multiplier - 1))::integer);
      v_earned_xp := v_question_xp + v_boost_bonus_xp;
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
      v_base_earned_xp,
      'earn',
      'quiz_question',
      p_question_id,
      v_award_scope,
      jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id)
    );

    if v_boost_bonus_xp > 0 then
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
        v_boost_bonus_xp,
        'earn',
        'reward_redemption',
        v_boost.redemption_id::text,
        'xp_boost:' || v_boost.id::text || ':' || p_question_id,
        jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id, 'boostId', v_boost.id)
      );

      update public.user_xp_boosts
      set used_count = used_count + 1,
          status = case
            when remaining_uses is not null and used_count + 1 >= remaining_uses then 'consumed'
            else status
          end
      where id = v_boost.id;
    end if;

    update public.profiles
       set xp = xp + v_earned_xp,
           xp_balance_cached = xp_balance_cached + v_earned_xp
     where id = v_user_id;
  end if;

  insert into public.quiz_answers (
    attempt_id,
    user_id,
    question_id,
    selected_option_ids,
    is_correct,
    earned_xp,
    status
  )
  values (
    p_attempt_id,
    v_user_id,
    p_question_id,
    v_selected_option_ids,
    v_answer_correct,
    v_earned_xp,
    v_status
  );

  select count(*)
    into v_attempt_question_count
    from public.quiz_attempt_questions
   where attempt_id = p_attempt_id;

  select count(*)
    into v_answered_count
    from public.quiz_answers
   where attempt_id = p_attempt_id;

  if v_status = 'daily_cap_deferred' then
    v_attempt_status := 'daily_cap_reached';
    v_completed := true;
  elsif v_answered_count >= v_attempt_question_count then
    v_attempt_status := case
      when v_attempt.mode = 'practice' then 'practice_completed'::public.quiz_attempt_status
      else 'graded'::public.quiz_attempt_status
    end;
    v_completed := true;
  end if;

  if v_completed then
    update public.quiz_attempts
       set status = v_attempt_status,
           ended_at = now(),
           ended_reason = v_attempt_status::text
     where id = p_attempt_id;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'completed', v_completed,
    'attemptStatus', coalesce(v_attempt_status::text, 'in_progress'),
    'questionResult', jsonb_build_object(
      'questionId', p_question_id,
      'correct', v_answer_correct,
      'earnedXp', v_earned_xp,
      'status', v_status,
      'boostBonusXp', v_boost_bonus_xp
    ),
    'dailyXpLimit', v_daily_limit,
    'dailyXpRemaining', greatest(0, v_daily_limit - v_daily_earned - v_base_earned_xp),
    'nextResetAt', (
      ((now() at time zone 'Africa/Lagos')::date + interval '1 day') at time zone 'Africa/Lagos'
    )
  );
end;
$$;

grant execute on function public.refund_reward_redemption(uuid, text) to authenticated;
