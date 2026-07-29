-- Phase 1: move trusted internal callers off public wrappers before
-- authenticated callers are allowed to reach those wrappers for denial tests.

create or replace function private.increment_profile_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'XP user is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'XP amount must be positive.';
  end if;

  if not exists (
    select 1
    from public.xp_transactions
    where user_id = p_user_id
      and direction = 'earn'
      and amount = p_amount
      and created_at = transaction_timestamp()
  ) then
    raise exception 'XP balance updates must be backed by a same-transaction ledger entry.';
  end if;

  update public.profiles
  set xp = xp + p_amount,
      xp_balance_cached = xp_balance_cached + p_amount,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'XP profile not found.';
  end if;
end;
$$;

revoke execute on function private.increment_profile_xp(uuid, integer) from public, anon, authenticated, service_role;

create or replace function public.accept_referral(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_user_id uuid := auth.uid();
  v_referral_code text := lower(trim(p_referral_code));
  v_referrer_user_id uuid;
  v_existing public.referral_attributions%rowtype;
  v_created public.referral_attributions%rowtype;
begin
  if v_referred_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_referral_code is null or v_referral_code = '' then
    raise exception 'Referral code is required.';
  end if;

  select id
    into v_referrer_user_id
    from public.profiles
   where lower(referral_code) = v_referral_code
   limit 1;

  if v_referrer_user_id is null then
    raise exception 'Referral link is not valid.';
  end if;

  if v_referrer_user_id = v_referred_user_id then
    raise exception 'You cannot use your own referral link.';
  end if;

  select *
    into v_existing
    from public.referral_attributions
   where referred_user_id = v_referred_user_id
   limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'status', 'already_attributed',
      'referrerUserId', v_existing.referrer_user_id,
      'referredUserId', v_existing.referred_user_id
    );
  end if;

  insert into public.referral_attributions (
    referral_code,
    referrer_user_id,
    referred_user_id,
    status
  )
  values (
    v_referral_code,
    v_referrer_user_id,
    v_referred_user_id,
    'signed_up'
  )
  returning * into v_created;

  perform private.queue_user_notification(
    v_referred_user_id,
    'account',
    'referral_applied',
    'Referral applied',
    'Your referral code was saved.',
    '/profile',
    'Open profile',
    jsonb_build_object(
      'referrerUserId', v_referrer_user_id,
      'referredUserId', v_referred_user_id
    ),
    'referral-applied:' || v_created.id::text || ':' || v_referred_user_id::text
  );

  perform private.queue_user_notification(
    v_referrer_user_id,
    'account',
    'referral_joined',
    'New referral',
    'A new learner joined with your referral code.',
    '/profile',
    'Open profile',
    jsonb_build_object(
      'referrerUserId', v_referrer_user_id,
      'referredUserId', v_referred_user_id
    ),
    'referral-joined:' || v_created.id::text || ':' || v_referrer_user_id::text
  );

  return jsonb_build_object(
    'status', 'attributed',
    'referrerUserId', v_created.referrer_user_id,
    'referredUserId', v_created.referred_user_id
  );
end;
$$;

create or replace function public.admin_grant_user_xp(
  p_target_user_id uuid,
  p_amount integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text := 'Admin';
  v_local_date date := (now() at time zone 'Africa/Lagos')::date;
  v_daily_limit integer := 500;
  v_granted_today integer := 0;
  v_transaction_id uuid := gen_random_uuid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select coalesce(display_name, 'Admin')
    into v_actor_name
  from public.profiles
  where id = v_actor_id
    and role = 'admin';

  if not found then
    raise exception 'Admin access required.';
  end if;

  if p_target_user_id is null then
    raise exception 'Choose a user to grant XP.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Grant amount must be greater than 0.';
  end if;

  select coalesce(admin_manual_grant_daily_limit, 500)
    into v_daily_limit
  from public.xp_settings
  where id = 1;

  select coalesce(sum(amount), 0)
    into v_granted_today
  from public.xp_transactions
  where direction = 'earn'
    and source_type = 'adjustment'
    and source_id = 'admin_user_grant'
    and metadata->>'kind' = 'admin_user_grant'
    and metadata->>'granted_by' = v_actor_id::text
    and (created_at at time zone 'Africa/Lagos')::date = v_local_date;

  if v_granted_today + p_amount > v_daily_limit then
    raise exception 'Daily admin grant limit reached. % XP remaining today.', greatest(v_daily_limit - v_granted_today, 0);
  end if;

  update public.profiles
  set xp_balance_cached = xp_balance_cached + p_amount
  where id = p_target_user_id;

  if not found then
    raise exception 'User not found.';
  end if;

  insert into public.xp_transactions (
    id,
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    metadata
  ) values (
    v_transaction_id,
    p_target_user_id,
    p_amount,
    'earn',
    'adjustment',
    'admin_user_grant',
    jsonb_build_object(
      'kind', 'admin_user_grant',
      'granted_by', v_actor_id,
      'granted_by_name', v_actor_name,
      'target_user_id', p_target_user_id,
      'reason', coalesce(v_reason, 'Admin manual grant'),
      'local_date', v_local_date
    )
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    'admin_user_xp_granted',
    'profile',
    p_target_user_id::text,
    jsonb_build_object(
      'xp_amount', p_amount,
      'reason', coalesce(v_reason, 'Admin manual grant'),
      'xp_transaction_id', v_transaction_id,
      'local_date', v_local_date
    )
  );

  perform private.queue_user_notification(
    p_target_user_id,
    'account',
    'free_xp_grant',
    'Free XP added',
    case
      when v_reason is null then 'You received ' || p_amount::text || ' XP.'
      else 'You received ' || p_amount::text || ' XP. ' || v_reason
    end,
    '/xp-store',
    'Use XP',
    jsonb_build_object(
      'amount', p_amount,
      'reason', v_reason,
      'xpTransactionId', v_transaction_id
    ),
    'free-xp-grant:' || v_transaction_id::text
  );

  return v_transaction_id;
end;
$$;

create or replace function public.grant_mission_award(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_reward public.rewards%rowtype;
  v_transaction_id uuid;
  v_redemption_id uuid := gen_random_uuid();
  v_inventory_item public.reward_inventory_items%rowtype;
  v_quantity_allocation public.reward_quantity_allocations%rowtype;
  v_payload jsonb := '{}'::jsonb;
  v_redemption_expires_at timestamptz;
  v_limit_start timestamptz;
  v_existing_count integer := 0;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      coalesce(p_user_id::text, '') || ':' || coalesce(p_mission_id, '') || ':' || coalesce(p_award_scope, ''),
      0
    )
  );

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if exists (
    select 1
    from public.mission_awards
    where user_id = p_user_id
      and mission_id = p_mission_id
      and award_scope = p_award_scope
  ) then
    return jsonb_build_object('status', 'already_awarded');
  end if;

  if v_mission.reward_type = 'xp' then
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
      v_mission.reward_xp,
      'earn',
      'mission',
      v_mission.id,
      'mission:' || v_mission.id || ':' || p_award_scope,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('missionId', v_mission.id, 'awardScope', p_award_scope)
    )
    on conflict (user_id, award_scope)
      where direction = 'earn' and award_scope is not null
      do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then
      return jsonb_build_object('status', 'already_awarded');
    end if;

    insert into public.mission_awards (
      user_id,
      mission_id,
      award_scope,
      xp_transaction_id
    )
    values (
      p_user_id,
      v_mission.id,
      p_award_scope,
      v_transaction_id
    );

    perform private.increment_profile_xp(p_user_id, v_mission.reward_xp);

    return jsonb_build_object(
      'status', 'awarded',
      'missionId', v_mission.id,
      'awardScope', p_award_scope,
      'rewardType', 'xp',
      'awardedXp', v_mission.reward_xp
    );
  end if;

  if nullif(trim(coalesce(v_mission.reward_id, '')), '') is null then
    raise exception 'Mission reward is not configured.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = v_mission.reward_id
  for update;

  if not found
     or v_reward.status <> 'published'
     or not v_reward.is_enabled
     or (v_reward.starts_at is not null and v_reward.starts_at > now())
     or (v_reward.ends_at is not null and v_reward.ends_at <= now())
     or not public.campaign_is_live(v_reward.campaign_id)
     or coalesce(v_reward.distribution_mode, 'direct') = 'perk_bundle' then
    raise exception 'Configured mission reward is not available right now.';
  end if;

  if v_reward.offer_expires_at is not null and v_reward.offer_expires_at <= now() then
    raise exception 'Configured mission reward is not available right now.';
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
    where user_id = p_user_id
      and reward_id = v_reward.id
      and claim_state not in ('cancelled', 'refunded')
      and (
        v_reward.limit_period = 'lifetime'
        or requested_at >= coalesce(v_limit_start, '-infinity'::timestamptz)
      );

    if v_existing_count >= v_reward.per_user_limit then
      raise exception 'This mission reward is not available for this account right now.';
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
      raise exception 'Configured mission reward is currently sold out.';
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
      raise exception 'Configured mission reward is currently sold out.';
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
    redemption_expires_at,
    claim_data
  )
  values (
    v_redemption_id,
    p_user_id,
    v_reward.id,
    'requested',
    null,
    0,
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
    v_redemption_expires_at,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'missionId', v_mission.id,
      'rewardGrantedBy', 'mission',
      'awardScope', p_award_scope
    )
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
    perform public.apply_native_reward_effect(
      p_user_id,
      v_redemption_id,
      v_reward.id,
      coalesce(v_reward.fulfillment_config, '{}'::jsonb)
    );
  end if;

  insert into public.mission_awards (
    user_id,
    mission_id,
    award_scope,
    reward_redemption_id
  )
  values (
    p_user_id,
    v_mission.id,
    p_award_scope,
    v_redemption_id
  );

  return jsonb_build_object(
    'status', 'awarded',
    'missionId', v_mission.id,
    'awardScope', p_award_scope,
    'rewardType', 'reward',
    'rewardId', v_reward.id,
    'rewardTitle', v_reward.title,
    'rewardRedemptionId', v_redemption_id,
    'claimState', case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end
  );
end;
$$;

create or replace function public.handle_profile_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform private.queue_user_notification(
    new.id,
    'account',
    'account_welcome',
    'Welcome',
    'Your account is ready.',
    '/profile',
    'Open profile',
    jsonb_build_object('userId', new.id),
    'account-welcome:' || new.id::text
  );

  return new;
end;
$$;

create or replace function public.notify_first_earned_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction <> 'earn' then
    return new;
  end if;

  if new.source_type not in ('quiz_question', 'mission') then
    return new;
  end if;

  if exists (
    select 1
    from public.xp_transactions xp
    where xp.user_id = new.user_id
      and xp.direction = 'earn'
      and xp.source_type in ('quiz_question', 'mission')
      and xp.id <> new.id
  ) then
    return new;
  end if;

  perform private.queue_user_notification(
    new.user_id,
    'account',
    'first_xp_earned',
    'First XP earned',
    'You earned XP. Turn on alerts to catch more opportunities.',
    '/dashboard',
    'Open app',
    jsonb_build_object(
      'amount', new.amount,
      'sourceId', new.source_id,
      'sourceType', new.source_type,
      'xpTransactionId', new.id
    ),
    'first-xp-earned:' || new.user_id::text
  );

  return new;
end;
$$;

create or replace function public.notify_mission_proof_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission_title text := 'Mission';
  v_body text;
begin
  if new.status not in ('approved', 'rejected') or old.status is not distinct from new.status then
    return new;
  end if;

  select title
    into v_mission_title
  from public.missions
  where id = new.mission_id;

  if new.status = 'approved' then
    v_body := v_mission_title || ' was approved. Your reward is now available.';
  else
    v_body := case
      when coalesce(new.rejection_reason, '') <> '' then new.rejection_reason
      else v_mission_title || ' needs another proof submission.'
    end;
  end if;

  perform private.queue_user_notification(
    new.user_id,
    'missions',
    'mission_proof_' || new.status::text,
    case
      when new.status = 'approved' then 'Mission approved'
      else 'Mission needs changes'
    end,
    v_body,
    '/missions',
    'Open missions',
    jsonb_build_object(
      'missionId', new.mission_id,
      'awardScope', new.award_scope,
      'status', new.status
    ),
    'mission-proof:' || new.user_id::text || ':' || new.mission_id || ':' || new.award_scope || ':' || new.status::text
  );

  return new;
end;
$$;

create or replace function public.notify_reward_redemption_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_title text := coalesce(new.reward_title_snapshot, 'Reward');
  v_body text;
  v_title text;
begin
  if tg_op = 'INSERT' then
    v_title := case
      when new.claim_state = 'fulfilled' then 'Reward applied'
      else 'Reward unlocked'
    end;

    v_body := case
      when coalesce(new.user_message, '') <> '' then new.user_message
      when new.claim_state = 'fulfilled' then v_reward_title || ' was applied to your account.'
      else v_reward_title || ' is ready in your rewards inbox.'
    end;

    perform private.queue_user_notification(
      new.user_id,
      'rewards',
      'reward_redemption_created',
      v_title,
      v_body,
      '/xp-store',
      'View reward',
      jsonb_build_object(
        'redemptionId', new.id,
        'rewardId', new.reward_id,
        'claimState', new.claim_state
      ),
      'reward-redemption-created:' || new.id::text
    );

    return new;
  end if;

  if old.claim_state is distinct from new.claim_state then
    if new.claim_state = 'fulfilled' then
      perform private.queue_user_notification(
        new.user_id,
        'rewards',
        'reward_redemption_fulfilled',
        'Reward fulfilled',
        coalesce(new.user_message, v_reward_title || ' has been fulfilled.'),
        '/xp-store',
        'Open reward',
        jsonb_build_object(
          'redemptionId', new.id,
          'rewardId', new.reward_id,
          'claimState', new.claim_state
        ),
        'reward-redemption-fulfilled:' || new.id::text
      );
    elsif new.claim_state = 'refunded' then
      perform private.queue_user_notification(
        new.user_id,
        'rewards',
        'reward_redemption_refunded',
        'Reward refunded',
        coalesce(new.user_message, 'This reward was refunded and your XP was returned.'),
        '/xp-store',
        'Review reward',
        jsonb_build_object(
          'redemptionId', new.id,
          'rewardId', new.reward_id,
          'claimState', new.claim_state
        ),
        'reward-redemption-refunded:' || new.id::text
      );
    elsif new.claim_state = 'expired' then
      perform private.queue_user_notification(
        new.user_id,
        'rewards',
        'reward_redemption_expired',
        'Reward expired',
        coalesce(new.user_message, v_reward_title || ' expired before it was claimed.'),
        '/xp-store',
        'View rewards',
        jsonb_build_object(
          'redemptionId', new.id,
          'rewardId', new.reward_id,
          'claimState', new.claim_state
        ),
        'reward-redemption-expired:' || new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

-- Phase 2: public wrappers are authenticated-reachable only to fail closed
-- before reaching trusted primitives.

create or replace function public.queue_user_notification(
  p_user_id uuid,
  p_category text,
  p_event_type text,
  p_title text,
  p_body text,
  p_cta_href text default null,
  p_cta_label text default null,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id = auth.uid() then
    raise exception 'authenticated learner cannot queue a notification to themselves' using errcode = '42501';
  elsif auth.uid() is not null then
    raise exception 'authenticated learner cannot queue a notification to another user' using errcode = '42501';
  end if;

  return private.queue_user_notification(
    p_user_id,
    p_category,
    p_event_type,
    p_title,
    p_body,
    p_cta_href,
    p_cta_label,
    p_data,
    p_dedupe_key
  );
end;
$$;

create or replace function public.generate_continue_learning_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_count integer := 0;
  v_notification_id uuid;
  v_user_id uuid;
  v_last_activity_at timestamptz;
  v_local_date text := to_char((now() at time zone 'Africa/Lagos')::date, 'YYYYMMDD');
begin
  if auth.uid() is not null then
    raise exception 'authenticated learner cannot run reminder generation' using errcode = '42501';
  end if;

  for v_user_id, v_last_activity_at in
    with unfinished_lessons as (
      select
        lp.user_id,
        max(greatest(coalesce(lp.updated_at, lp.started_at), lp.started_at)) as last_started_at
      from public.lesson_progress lp
      join public.lessons l
        on l.id = lp.lesson_id
       and l.status = 'published'
      join public.courses c
        on c.id = l.course_id
       and c.status = 'published'
      where lp.completed_at is null
      group by lp.user_id
    ),
    learning_activity as (
      select
        activity.user_id,
        max(activity.activity_at) as last_activity_at
      from (
        select
          lp.user_id,
          max(greatest(coalesce(lp.updated_at, lp.started_at), lp.started_at)) as activity_at
        from public.lesson_progress lp
        group by lp.user_id

        union all

        select
          lpc.user_id,
          max(lpc.completed_at) as activity_at
        from public.lesson_page_completions lpc
        group by lpc.user_id

        union all

        select
          qa.user_id,
          max(coalesce(qa.ended_at, qa.started_at, qa.created_at)) as activity_at
        from public.quiz_attempts qa
        group by qa.user_id
      ) activity
      group by activity.user_id
    )
    select
      p.id,
      coalesce(la.last_activity_at, ul.last_started_at) as last_activity_at
    from unfinished_lessons ul
    join public.profiles p
      on p.id = ul.user_id
     and p.role = 'learner'
    left join learning_activity la
      on la.user_id = ul.user_id
    where coalesce(la.last_activity_at, ul.last_started_at) <= now() - interval '3 days'
      and not exists (
        select 1
        from public.user_notifications un
        where un.user_id = ul.user_id
          and un.event_type = 'continue_learning'
          and un.created_at >= now() - interval '3 days'
      )
  loop
    select private.queue_user_notification(
      v_user_id,
      'system',
      'continue_learning',
      'Continue learning',
      'You have unfinished lessons waiting and more XP to earn.',
      '/dashboard',
      'Continue',
      jsonb_build_object('lastActivityAt', v_last_activity_at),
      'continue-learning:' || v_user_id::text || ':' || v_local_date
    )
    into v_notification_id;

    if v_notification_id is not null then
      v_created_count := v_created_count + 1;
    end if;
  end loop;

  return v_created_count;
end;
$$;

create or replace function public.increment_profile_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    raise exception 'authenticated learner cannot choose an XP amount' using errcode = '42501';
  end if;

  perform private.increment_profile_xp(p_user_id, p_amount);
end;
$$;

grant execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.generate_continue_learning_reminders() to authenticated;
grant execute on function public.increment_profile_xp(uuid, integer) to authenticated;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'public',
    'queue_user_notification',
    'p_user_id uuid, p_category text, p_event_type text, p_title text, p_body text, p_cta_href text, p_cta_label text, p_data jsonb, p_dedupe_key text',
    'INTERNAL_HELPER',
    'Trusted database functions and service maintenance jobs; authenticated clients may only reach the deny-on-entry wrapper.',
    'Authenticated callers are denied before delegation. Trusted callers must use private.queue_user_notification or service_role with no user JWT subject.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'generate_continue_learning_reminders',
    '',
    'SERVICE_ROLE_ONLY',
    'Notification dispatch job; authenticated clients may only reach the deny-on-entry wrapper.',
    'Authenticated callers are denied before any reminder generation. Service-role dispatch runs with no request.jwt.claim.sub.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'increment_profile_xp',
    'p_user_id uuid, p_amount integer',
    'INTERNAL_HELPER',
    'Trusted database XP workflows and service maintenance jobs; authenticated clients may only reach the deny-on-entry wrapper.',
    'Authenticated callers are denied before delegation. Trusted callers must use private.increment_profile_xp or service_role with no user JWT subject.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
