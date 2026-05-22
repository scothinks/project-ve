alter table public.missions
  add column if not exists reward_type text,
  add column if not exists reward_id text references public.rewards(id) on delete restrict;

update public.missions
set reward_type = 'xp'
where reward_type is null;

alter table public.missions
  alter column reward_type set default 'xp',
  alter column reward_type set not null,
  alter column reward_xp drop not null;

alter table public.missions
  drop constraint if exists missions_reward_type_check,
  drop constraint if exists missions_reward_selection_check;

alter table public.missions
  add constraint missions_reward_type_check
    check (reward_type in ('xp', 'reward')),
  add constraint missions_reward_selection_check
    check (
      (reward_type = 'xp' and reward_xp is not null and reward_id is null)
      or (reward_type = 'reward' and reward_xp is null and reward_id is not null)
    );

alter table public.mission_awards
  add column if not exists reward_redemption_id uuid references public.reward_redemptions(id) on delete restrict;

alter table public.mission_awards
  alter column xp_transaction_id drop not null;

alter table public.mission_awards
  drop constraint if exists mission_awards_reward_target_check;

alter table public.mission_awards
  add constraint mission_awards_reward_target_check
    check (
      ((xp_transaction_id is not null)::integer + (reward_redemption_id is not null)::integer) = 1
    );

create unique index if not exists mission_awards_reward_redemption_idx
  on public.mission_awards (reward_redemption_id)
  where reward_redemption_id is not null;

create or replace function public.admin_assert_valid_mission_reward(
  p_reward_type text,
  p_reward_xp integer,
  p_reward_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.rewards%rowtype;
begin
  if p_reward_type not in ('xp', 'reward') then
    raise exception 'Choose a supported reward type.';
  end if;

  if p_reward_type = 'xp' then
    if coalesce(p_reward_xp, 0) <= 0 then
      raise exception 'Reward XP must be greater than 0.';
    end if;

    return;
  end if;

  if nullif(trim(coalesce(p_reward_id, '')), '') is null then
    raise exception 'Choose a reward.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if not found then
    raise exception 'Selected reward was not found.';
  end if;

  if coalesce(v_reward.distribution_mode, 'direct') = 'perk_bundle' then
    raise exception 'Perk bundles cannot be assigned directly to missions.';
  end if;
end;
$$;

create or replace function public.admin_create_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_type text,
  p_reward_xp integer,
  p_reward_id text,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can create a mission.';
  end if;

  if v_mission_id is null then
    raise exception 'Mission id is required.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  perform public.admin_assert_valid_mission_reward(p_reward_type, p_reward_xp, v_reward_id);
  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

  insert into public.missions (
    id,
    title,
    description,
    category,
    reward_type,
    reward_xp,
    reward_id,
    repeatability,
    validation_type,
    validation_config,
    starts_at,
    ends_at,
    status,
    sort_order
  )
  values (
    v_mission_id,
    trim(p_title),
    trim(p_description),
    p_category,
    p_reward_type,
    case when p_reward_type = 'xp' then p_reward_xp else null end,
    case when p_reward_type = 'reward' then v_reward_id else null end,
    p_repeatability,
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb),
    p_starts_at,
    p_ends_at,
    p_status,
    coalesce(p_sort_order, 0)
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
    'mission_created',
    'mission',
    v_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  return jsonb_build_object('missionId', v_mission_id);
end;
$$;

create or replace function public.admin_update_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_type text,
  p_reward_xp integer,
  p_reward_id text,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update a mission.';
  end if;

  if nullif(trim(coalesce(p_mission_id, '')), '') is null then
    raise exception 'Mission id is required.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  perform public.admin_assert_valid_mission_reward(p_reward_type, p_reward_xp, v_reward_id);
  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

  update public.missions
  set title = trim(p_title),
      description = trim(p_description),
      category = p_category,
      reward_type = p_reward_type,
      reward_xp = case when p_reward_type = 'xp' then p_reward_xp else null end,
      reward_id = case when p_reward_type = 'reward' then v_reward_id else null end,
      repeatability = p_repeatability,
      validation_type = p_validation_type,
      validation_config = coalesce(p_validation_config, '{}'::jsonb),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      sort_order = coalesce(p_sort_order, 0),
      updated_at = now()
  where id = p_mission_id;

  if not found then
    raise exception 'Mission not found.';
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
    'mission_updated',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  return jsonb_build_object('missionId', p_mission_id);
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

    perform public.increment_profile_xp(p_user_id, v_mission.reward_xp);

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

create or replace function public.award_valid_mission_xp(
  p_mission_id text,
  p_award_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_valid boolean := false;
  v_lesson_id text;
  v_course_id text;
  v_required_count integer;
  v_within_days integer;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_referred_user_id uuid;
  v_minimum_account_age_hours integer := 24;
  v_required_fields text[];
  v_requires_manual_review boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_mission
    from public.missions
   where id = p_mission_id
     and status = 'published'
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now());

  if v_mission.id is null then
    raise exception 'Mission not found.';
  end if;

  case v_mission.validation_type
    when 'lesson_completed' then
      v_lesson_id := v_mission.validation_config ->> 'lessonId';
      select public.lesson_is_complete_for_user(v_user_id, v_lesson_id)
        into v_valid;

    when 'course_completed' then
      v_course_id := v_mission.validation_config ->> 'courseId';

      select count(*)
        into v_total_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.course_id = v_course_id
         and l.status = 'published'
         and c.status = 'published';

      select count(*)
        into v_completed_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.course_id = v_course_id
         and l.status = 'published'
         and c.status = 'published'
         and public.lesson_is_complete_for_user(v_user_id, l.id);

      v_valid := v_total_lessons > 0 and v_completed_lessons >= v_total_lessons;

    when 'lesson_count_completed' then
      v_required_count := greatest(1, coalesce((v_mission.validation_config ->> 'count')::integer, 1));
      v_within_days := nullif(v_mission.validation_config ->> 'withinDays', '')::integer;

      if v_within_days is null then
        select count(*)
          into v_completed_lessons
          from public.lessons l
          join public.courses c on c.id = l.course_id
         where l.status = 'published'
           and c.status = 'published'
           and public.lesson_is_complete_for_user(v_user_id, l.id);
      else
        select count(distinct lesson_id)
          into v_completed_lessons
          from public.lesson_progress
         where user_id = v_user_id
           and completed_at is not null
           and completed_at >= now() - make_interval(days => v_within_days);
      end if;

      v_valid := v_completed_lessons >= v_required_count;

    when 'referral_friend_completed_lessons' then
      v_required_count := greatest(
        1,
        coalesce((v_mission.validation_config ->> 'requiredFriendLessonCount')::integer, 1)
      );
      v_minimum_account_age_hours := greatest(
        0,
        coalesce((v_mission.validation_config ->> 'minimumAccountAgeHours')::integer, 24)
      );

      if p_award_scope !~ '^referral:' then
        raise exception 'Invalid referral award scope.';
      end if;

      v_referred_user_id := replace(p_award_scope, 'referral:', '')::uuid;

      if not exists (
        select 1
          from public.referral_attributions
         where referrer_user_id = v_user_id
           and referred_user_id = v_referred_user_id
           and created_at <= now() - make_interval(hours => v_minimum_account_age_hours)
      ) then
        raise exception 'Referral is not eligible yet.';
      end if;

      select count(*)
        into v_completed_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.status = 'published'
         and c.status = 'published'
         and public.lesson_is_complete_for_user(v_referred_user_id, l.id);

      v_valid := v_completed_lessons >= v_required_count;

    when 'proof_upload' then
      select array_agg(value::text)
        into v_required_fields
        from jsonb_array_elements_text(
          coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
        ) as value;

      v_requires_manual_review :=
        coalesce((v_mission.validation_config ->> 'requiresManualReview')::boolean, false);

      if v_requires_manual_review then
        select bool_and(exists (
          select 1
            from public.mission_proofs mp
           where mp.user_id = v_user_id
             and mp.mission_id = v_mission.id
             and mp.award_scope = p_award_scope
             and mp.proof_type::text = required_field
             and mp.status = 'approved'
        ))
          into v_valid
          from unnest(v_required_fields) required_field;
      else
        select bool_and(exists (
          select 1
            from public.mission_proofs mp
           where mp.user_id = v_user_id
             and mp.mission_id = v_mission.id
             and mp.award_scope = p_award_scope
             and mp.proof_type::text = required_field
             and mp.status in ('submitted', 'approved')
        ))
          into v_valid
          from unnest(v_required_fields) required_field;
      end if;

    else
      v_valid := false;
  end case;

  v_valid := coalesce(v_valid, false);

  if not v_valid then
    raise exception 'Mission is not complete.';
  end if;

  return public.grant_mission_award(v_user_id, v_mission.id, p_award_scope);
end;
$$;

create or replace function public.admin_review_mission_proof_submission(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_status public.review_status,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_required_fields text[];
  v_valid boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can review mission proof.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found or v_mission.validation_type <> 'proof_upload' then
    raise exception 'Mission proof submission was not found.';
  end if;

  update public.mission_proofs
  set status = p_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '') else null end,
      updated_at = now()
  where user_id = p_user_id
    and mission_id = p_mission_id
    and award_scope = p_award_scope;

  if not found then
    raise exception 'Mission proof submission was not found.';
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
    'mission_proof_' || p_status::text,
    'mission_proof',
    p_user_id::text || ':' || p_mission_id || ':' || p_award_scope,
    jsonb_build_object(
      'userId', p_user_id,
      'missionId', p_mission_id,
      'awardScope', p_award_scope,
      'rejectionReason', p_rejection_reason
    )
  );

  if p_status = 'rejected' then
    return jsonb_build_object('status', 'rejected');
  end if;

  select array_agg(value::text)
    into v_required_fields
    from jsonb_array_elements_text(
      coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
    ) as value;

  select bool_and(exists (
    select 1
      from public.mission_proofs mp
     where mp.user_id = p_user_id
       and mp.mission_id = p_mission_id
       and mp.award_scope = p_award_scope
       and mp.proof_type::text = required_field
       and mp.status = 'approved'
  ))
    into v_valid
    from unnest(v_required_fields) required_field;

  if not coalesce(v_valid, false) then
    return jsonb_build_object('status', 'approved_pending_required_fields');
  end if;

  return public.grant_mission_award(
    p_user_id,
    v_mission.id,
    p_award_scope,
    jsonb_build_object('reviewedBy', v_actor_id)
  );
end;
$$;

grant execute on function public.award_valid_mission_xp(text, text) to authenticated;
