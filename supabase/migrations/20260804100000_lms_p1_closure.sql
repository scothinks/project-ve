create or replace function public.current_user_has_course_enrolment(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrolments enrolment
    where enrolment.user_id = auth.uid()
      and enrolment.course_id = p_course_id
      and enrolment.status in ('active', 'completed')
  );
$$;

create or replace function public.current_user_has_programme_enrolment(p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrolments enrolment
    where enrolment.user_id = auth.uid()
      and enrolment.programme_id = p_programme_id
      and enrolment.status in ('active', 'completed')
  );
$$;

revoke execute on function public.current_user_has_course_enrolment(text) from public, anon, authenticated, service_role;
grant execute on function public.current_user_has_course_enrolment(text) to anon, authenticated, service_role;

revoke execute on function public.current_user_has_programme_enrolment(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_has_programme_enrolment(uuid) to anon, authenticated, service_role;

create or replace function public.current_user_can_read_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and (
        public.current_user_is_admin()
        or public.current_user_has_course_enrolment(course.id)
        or (
          course.catalog_scope = 'platform'
          and course.status = 'published'
        )
        or (
          course.organization_id is not null
          and (
            public.current_user_has_organization_role(
              course.organization_id,
              array[
                'organisation_owner',
                'organisation_admin',
                'programme_manager',
                'content_editor',
                'reviewer',
                'instructor',
                'report_viewer'
              ]::public.organization_role_key[]
            )
            or (
              course.status = 'published'
              and public.current_user_has_organization_role(course.organization_id, null)
            )
          )
        )
      )
  );
$$;

create or replace function public.current_user_can_read_programme(p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programmes programme
    where programme.id = p_programme_id
      and (
        public.current_user_can_manage_organization_programmes(programme.organization_id)
        or public.current_user_has_programme_enrolment(programme.id)
        or public.current_user_has_organization_role(
          programme.organization_id,
          array['content_editor', 'reviewer', 'instructor', 'report_viewer']::public.organization_role_key[]
        )
        or (
          programme.status = 'published'
          and public.current_user_has_organization_role(programme.organization_id, null)
        )
      )
  );
$$;

create or replace function public.current_user_can_access_reward(p_reward_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rewards reward
    where reward.id = p_reward_id
      and (
        public.current_user_is_admin()
        or (
          reward.status = 'published'
          and reward.is_enabled
          and (reward.starts_at is null or reward.starts_at <= now())
          and (reward.ends_at is null or reward.ends_at > now())
          and public.campaign_is_live(reward.campaign_id)
          and (
            coalesce(reward.owner_scope, 'platform_owned') = 'platform_owned'
            or (
              reward.owner_scope = 'organization_owned'
              and auth.uid() is not null
              and reward.organization_id is not null
              and (
                public.current_user_has_organization_role(reward.organization_id, null)
                or exists (
                  select 1
                  from public.enrolments enrolment
                  where enrolment.user_id = auth.uid()
                    and enrolment.organization_id = reward.organization_id
                    and enrolment.status in ('active', 'completed')
                )
              )
            )
            or (
              reward.owner_scope = 'programme_sponsored'
              and auth.uid() is not null
              and reward.sponsored_programme_id is not null
              and exists (
                select 1
                from public.enrolments enrolment
                where enrolment.user_id = auth.uid()
                  and enrolment.programme_id = reward.sponsored_programme_id
                  and enrolment.status in ('active', 'completed')
              )
            )
          )
        )
      )
  );
$$;

revoke execute on function public.current_user_can_access_reward(text) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_access_reward(text) to anon, authenticated, service_role;

drop policy if exists "Published rewards are readable" on public.rewards;
create policy "Rewards are readable by LMS eligibility"
  on public.rewards for select
  using (public.current_user_can_access_reward(id));

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
     or not public.campaign_is_live(v_reward.campaign_id)
     or not public.current_user_can_access_reward(v_reward.id) then
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
      raise exception 'This reward is currently sold out.';
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
    v_redemption_expires_at
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
    v_effect := v_reward.fulfillment_config ->> 'effect';

    if v_effect = 'xp_bonus' then
      v_bonus_xp := greatest(1, coalesce((v_reward.fulfillment_config ->> 'amount')::integer, 1));

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
        v_bonus_xp,
        'earn',
        'reward_redemption_bonus',
        v_redemption_id::text,
        jsonb_build_object('rewardId', v_reward.id, 'rewardTitle', v_reward.title, 'effect', 'xp_bonus')
      )
      returning id into v_bonus_transaction_id;

      update public.profiles
      set xp = xp + v_bonus_xp,
          xp_balance_cached = xp_balance_cached + v_bonus_xp,
          updated_at = now()
      where id = v_user_id;

      update public.reward_redemptions
      set user_message = format('You received %s XP.', v_bonus_xp),
          status = 'fulfilled',
          claim_state = 'fulfilled',
          updated_at = now()
      where id = v_redemption_id;
    elsif v_effect = 'xp_boost' then
      v_boost_multiplier := greatest(1.1, coalesce((v_reward.fulfillment_config ->> 'multiplier')::numeric, 2));
      v_boost_hours := greatest(1, coalesce((v_reward.fulfillment_config ->> 'durationHours')::integer, 24));
      v_boost_uses := greatest(1, coalesce((v_reward.fulfillment_config ->> 'uses')::integer, 1));

      insert into public.user_xp_boosts (
        user_id,
        redemption_id,
        multiplier,
        remaining_uses,
        starts_at,
        ends_at
      )
      values (
        v_user_id,
        v_redemption_id,
        v_boost_multiplier,
        v_boost_uses,
        now(),
        now() + make_interval(hours => v_boost_hours)
      );

      update public.reward_redemptions
      set user_message = format('Your %sx XP boost is active.', trim(to_char(v_boost_multiplier, 'FM999999990.##'))),
          status = 'fulfilled',
          claim_state = 'fulfilled',
          updated_at = now()
      where id = v_redemption_id;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_redemption_id,
    'rewardId', v_reward.id,
    'xpCost', v_reward.cost_xp,
    'claimState', case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    'redemptionExpiresAt', v_redemption_expires_at
  );
end;
$$;

grant execute on function public.redeem_reward(text) to authenticated;

create or replace function public.upsert_course_completion_for_user(
  p_user_id uuid,
  p_course_id text
)
returns public.course_completions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_rule public.course_completion_rules%rowtype;
  v_required_lesson_ids text[] := '{}';
  v_required_quiz_ids text[] := '{}';
  v_required_mission_ids text[] := '{}';
  v_completed_lesson_ids text[] := '{}';
  v_completed_quiz_ids text[] := '{}';
  v_completed_mission_ids text[] := '{}';
  v_missing_lesson_ids text[] := '{}';
  v_missing_quiz_ids text[] := '{}';
  v_missing_mission_ids text[] := '{}';
  v_assessment_completed boolean := true;
  v_requirement_count integer := 0;
  v_completed_count integer := 0;
  v_progress_percent integer := 100;
  v_status public.lms_completion_status := 'in_progress';
  v_completed_at timestamptz := null;
  v_result public.course_completions%rowtype;
  v_minimum_quiz_score integer := 0;
  v_minimum_completion_threshold integer := 100;
begin
  if p_user_id is null then
    raise exception 'User is required.';
  end if;

  select *
    into v_course
  from public.courses
  where id = p_course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  select *
    into v_rule
  from public.course_completion_rules
  where course_id = p_course_id;

  if found then
    v_required_lesson_ids := coalesce(v_rule.required_lesson_ids, '{}');
    v_required_quiz_ids := coalesce(v_rule.required_quiz_ids, '{}');
    v_required_mission_ids := coalesce(v_rule.required_mission_ids, '{}');
    v_minimum_quiz_score := coalesce(v_rule.minimum_quiz_score, 0);
    v_minimum_completion_threshold := coalesce(v_rule.minimum_completion_threshold, 100);
  else
    select coalesce(array_agg(lesson.id order by lesson.sort_order), '{}')::text[]
      into v_required_lesson_ids
    from public.lessons lesson
    where lesson.course_id = p_course_id
      and lesson.status = 'published';

    select coalesce(array_agg(quiz.id order by lesson.sort_order), '{}')::text[]
      into v_required_quiz_ids
    from public.quizzes quiz
    join public.lessons lesson
      on lesson.id = quiz.lesson_id
    where lesson.course_id = p_course_id
      and lesson.status = 'published'
      and quiz.status = 'published';
  end if;

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_lesson_ids
  from unnest(v_required_lesson_ids) required_id
  where exists (
    select 1
    from public.lesson_progress progress
    where progress.user_id = p_user_id
      and progress.lesson_id = required_id
      and progress.completed_at is not null
  );

  with attempt_scores as (
    select
      attempt.quiz_id,
      attempt.id,
      case
        when count(answer.id) = 0 then 0
        else round(avg(case when answer.is_correct then 100::numeric else 0::numeric end))::integer
      end as score
    from public.quiz_attempts attempt
    left join public.quiz_answers answer
      on answer.attempt_id = attempt.id
     and answer.user_id = attempt.user_id
    where attempt.user_id = p_user_id
      and attempt.status in ('graded', 'practice_completed', 'daily_cap_reached')
      and attempt.quiz_id = any(v_required_quiz_ids)
    group by attempt.quiz_id, attempt.id
  )
  select coalesce(array_agg(distinct quiz_id order by quiz_id), '{}')::text[]
    into v_completed_quiz_ids
  from attempt_scores
  where score >= v_minimum_quiz_score;

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_mission_ids
  from unnest(v_required_mission_ids) required_id
  where exists (
    select 1
    from public.mission_awards award
    where award.user_id = p_user_id
      and award.mission_id = required_id
  );

  v_assessment_completed := public.user_completed_assessment(
    p_user_id,
    v_rule.required_final_assessment_version_id
  );

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_lesson_ids
  from unnest(v_required_lesson_ids) required_id
  where not required_id = any(v_completed_lesson_ids);

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_quiz_ids
  from unnest(v_required_quiz_ids) required_id
  where not required_id = any(v_completed_quiz_ids);

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_mission_ids
  from unnest(v_required_mission_ids) required_id
  where not required_id = any(v_completed_mission_ids);

  v_requirement_count :=
    coalesce(array_length(v_required_lesson_ids, 1), 0)
    + coalesce(array_length(v_required_quiz_ids, 1), 0)
    + coalesce(array_length(v_required_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null then 1 else 0 end;
  v_completed_count :=
    coalesce(array_length(v_completed_lesson_ids, 1), 0)
    + coalesce(array_length(v_completed_quiz_ids, 1), 0)
    + coalesce(array_length(v_completed_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null and v_assessment_completed then 1 else 0 end;
  v_progress_percent := case
    when v_requirement_count = 0 then 100
    else least(100, greatest(0, round((v_completed_count::numeric / v_requirement_count::numeric) * 100)::integer))
  end;
  v_status := case
    when v_progress_percent >= v_minimum_completion_threshold
      and v_assessment_completed
      then 'completed'::public.lms_completion_status
    else 'in_progress'::public.lms_completion_status
  end;

  select completed_at
    into v_completed_at
  from public.course_completions
  where user_id = p_user_id
    and course_id = p_course_id;

  if v_status = 'completed' then
    v_completed_at := coalesce(v_completed_at, now());
  else
    v_completed_at := null;
  end if;

  insert into public.course_completions (
    organization_id,
    user_id,
    course_id,
    status,
    progress_percent,
    completed_required_lessons,
    completed_required_quizzes,
    completed_required_missions,
    missing_requirements,
    completed_at,
    evaluated_at,
    metadata
  )
  values (
    v_course.organization_id,
    p_user_id,
    p_course_id,
    v_status,
    v_progress_percent,
    v_completed_lesson_ids,
    v_completed_quiz_ids,
    v_completed_mission_ids,
    jsonb_build_object(
      'lessonIds', v_missing_lesson_ids,
      'quizIds', v_missing_quiz_ids,
      'missionIds', v_missing_mission_ids,
      'assessmentVersionId', case when v_assessment_completed then null else v_rule.required_final_assessment_version_id end
    ),
    v_completed_at,
    now(),
    jsonb_build_object(
      'requiredLessonIds', v_required_lesson_ids,
      'requiredQuizIds', v_required_quiz_ids,
      'requiredMissionIds', v_required_mission_ids,
      'minimumQuizScore', v_minimum_quiz_score,
      'minimumCompletionThreshold', v_minimum_completion_threshold,
      'requiredFinalAssessmentVersionId', v_rule.required_final_assessment_version_id
    )
  )
  on conflict (user_id, course_id) do update
    set organization_id = excluded.organization_id,
        status = excluded.status,
        progress_percent = excluded.progress_percent,
        completed_required_lessons = excluded.completed_required_lessons,
        completed_required_quizzes = excluded.completed_required_quizzes,
        completed_required_missions = excluded.completed_required_missions,
        missing_requirements = excluded.missing_requirements,
        completed_at = excluded.completed_at,
        evaluated_at = excluded.evaluated_at,
        metadata = excluded.metadata
  returning *
    into v_result;

  return v_result;
end;
$$;

create or replace function public.upsert_programme_completion_for_user(
  p_user_id uuid,
  p_programme_id uuid
)
returns public.programme_completions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes%rowtype;
  v_rule public.programme_completion_rules%rowtype;
  v_required_course_ids text[] := '{}';
  v_required_mission_ids text[] := '{}';
  v_completed_course_ids text[] := '{}';
  v_completed_mission_ids text[] := '{}';
  v_missing_course_ids text[] := '{}';
  v_missing_mission_ids text[] := '{}';
  v_assessment_completed boolean := true;
  v_requirement_count integer := 0;
  v_completed_count integer := 0;
  v_progress_percent integer := 100;
  v_status public.lms_completion_status := 'in_progress';
  v_completed_at timestamptz := null;
  v_result public.programme_completions%rowtype;
  v_minimum_completion_threshold integer := 100;
  v_course_id text;
begin
  if p_user_id is null then
    raise exception 'User is required.';
  end if;

  select *
    into v_programme
  from public.programmes
  where id = p_programme_id;

  if not found then
    raise exception 'Programme not found.';
  end if;

  select *
    into v_rule
  from public.programme_completion_rules
  where programme_id = p_programme_id;

  if found then
    v_required_course_ids := coalesce(v_rule.required_course_ids, '{}');
    v_required_mission_ids := coalesce(v_rule.required_mission_ids, '{}');
    v_minimum_completion_threshold := coalesce(v_rule.minimum_completion_threshold, 100);
  else
    select coalesce(array_agg(course_id order by sort_order), '{}')::text[]
      into v_required_course_ids
    from public.programme_courses
    where programme_id = p_programme_id
      and requirement = 'required';

    select coalesce(array_agg(mission_id order by sort_order), '{}')::text[]
      into v_required_mission_ids
    from public.programme_missions
    where programme_id = p_programme_id;
  end if;

  foreach v_course_id in array v_required_course_ids loop
    perform public.upsert_course_completion_for_user(p_user_id, v_course_id);
  end loop;

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_course_ids
  from unnest(v_required_course_ids) required_id
  where exists (
    select 1
    from public.course_completions completion
    where completion.user_id = p_user_id
      and completion.course_id = required_id
      and completion.status = 'completed'
  );

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_mission_ids
  from unnest(v_required_mission_ids) required_id
  where exists (
    select 1
    from public.mission_awards award
    where award.user_id = p_user_id
      and award.mission_id = required_id
  );

  v_assessment_completed := public.user_completed_assessment(
    p_user_id,
    v_rule.required_final_assessment_version_id
  );

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_course_ids
  from unnest(v_required_course_ids) required_id
  where not required_id = any(v_completed_course_ids);

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_missing_mission_ids
  from unnest(v_required_mission_ids) required_id
  where not required_id = any(v_completed_mission_ids);

  v_requirement_count :=
    coalesce(array_length(v_required_course_ids, 1), 0)
    + coalesce(array_length(v_required_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null then 1 else 0 end;
  v_completed_count :=
    coalesce(array_length(v_completed_course_ids, 1), 0)
    + coalesce(array_length(v_completed_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null and v_assessment_completed then 1 else 0 end;
  v_progress_percent := case
    when v_requirement_count = 0 then 100
    else least(100, greatest(0, round((v_completed_count::numeric / v_requirement_count::numeric) * 100)::integer))
  end;
  v_status := case
    when v_progress_percent >= v_minimum_completion_threshold
      and v_assessment_completed
      then 'completed'::public.lms_completion_status
    else 'in_progress'::public.lms_completion_status
  end;

  select completed_at
    into v_completed_at
  from public.programme_completions
  where user_id = p_user_id
    and programme_id = p_programme_id;

  if v_status = 'completed' then
    v_completed_at := coalesce(v_completed_at, now());
  else
    v_completed_at := null;
  end if;

  insert into public.programme_completions (
    organization_id,
    user_id,
    programme_id,
    status,
    progress_percent,
    completed_required_courses,
    completed_required_missions,
    missing_requirements,
    completed_at,
    evaluated_at,
    metadata
  )
  values (
    v_programme.organization_id,
    p_user_id,
    p_programme_id,
    v_status,
    v_progress_percent,
    v_completed_course_ids,
    v_completed_mission_ids,
    jsonb_build_object(
      'courseIds', v_missing_course_ids,
      'missionIds', v_missing_mission_ids,
      'assessmentVersionId', case when v_assessment_completed then null else v_rule.required_final_assessment_version_id end
    ),
    v_completed_at,
    now(),
    jsonb_build_object(
      'requiredCourseIds', v_required_course_ids,
      'requiredMissionIds', v_required_mission_ids,
      'minimumCompletionThreshold', v_minimum_completion_threshold,
      'requiredFinalAssessmentVersionId', v_rule.required_final_assessment_version_id
    )
  )
  on conflict (user_id, programme_id) do update
    set organization_id = excluded.organization_id,
        status = excluded.status,
        progress_percent = excluded.progress_percent,
        completed_required_courses = excluded.completed_required_courses,
        completed_required_missions = excluded.completed_required_missions,
        missing_requirements = excluded.missing_requirements,
        completed_at = excluded.completed_at,
        evaluated_at = excluded.evaluated_at,
        metadata = excluded.metadata
  returning *
    into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_get_lms_reporting(
  p_organization_id uuid default null,
  p_programme_id uuid default null,
  p_cohort_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := p_organization_id;
  v_programme public.programmes%rowtype;
  v_cohort public.cohorts%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_summary jsonb := '{}'::jsonb;
  v_cohort_comparison jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_quiz_scores jsonb := '[]'::jsonb;
  v_mission_completion jsonb := '[]'::jsonb;
  v_reward_usage jsonb := '[]'::jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_programme_id is not null then
    select *
      into v_programme
    from public.programmes
    where id = p_programme_id;

    if not found then
      raise exception 'Programme not found.';
    end if;

    if v_organization_id is not null and v_organization_id <> v_programme.organization_id then
      raise exception 'Programme does not belong to the selected organisation.';
    end if;

    v_organization_id := v_programme.organization_id;
  end if;

  if p_cohort_id is not null then
    select *
      into v_cohort
    from public.cohorts
    where id = p_cohort_id;

    if not found then
      raise exception 'Cohort not found.';
    end if;

    if v_organization_id is not null and v_organization_id <> v_cohort.organization_id then
      raise exception 'Cohort does not belong to the selected organisation.';
    end if;

    v_organization_id := v_cohort.organization_id;
  end if;

  if v_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Reporting access required.' using errcode = '42501';
    end if;
  elsif not public.current_user_can_read_organization_audience(v_organization_id) then
    raise exception 'Reporting access required.' using errcode = '42501';
  end if;

  drop table if exists pg_temp.lms_reporting_enrolments;
  create temporary table pg_temp.lms_reporting_enrolments on commit drop as
  select enrolment.*
  from public.enrolments enrolment
  where (v_organization_id is null or enrolment.organization_id = v_organization_id)
    and (
      p_programme_id is null
      or enrolment.programme_id = p_programme_id
      or enrolment.metadata ->> 'programmeId' = p_programme_id::text
    )
    and (
      p_cohort_id is null
      or enrolment.metadata ->> 'cohortId' = p_cohort_id::text
    );

  drop table if exists pg_temp.lms_reporting_users;
  create temporary table pg_temp.lms_reporting_users on commit drop as
  select distinct enrolment.user_id
  from pg_temp.lms_reporting_enrolments enrolment;

  drop table if exists pg_temp.lms_reporting_quiz_attempt_scores;
  create temporary table pg_temp.lms_reporting_quiz_attempt_scores on commit drop as
  select
    attempt.id as attempt_id,
    attempt.user_id,
    attempt.quiz_id,
    quiz.title as quiz_title,
    lesson.course_id,
    case
      when count(answer.id) = 0 then 0
      else round(avg(case when answer.is_correct then 100::numeric else 0::numeric end))::integer
    end as score
  from public.quiz_attempts attempt
  join public.quizzes quiz
    on quiz.id = attempt.quiz_id
  join public.lessons lesson
    on lesson.id = attempt.lesson_id
  join pg_temp.lms_reporting_users scoped_user
    on scoped_user.user_id = attempt.user_id
  left join public.quiz_answers answer
    on answer.attempt_id = attempt.id
   and answer.user_id = attempt.user_id
  where attempt.status <> 'in_progress'
    and exists (
      select 1
      from pg_temp.lms_reporting_enrolments enrolment
      where enrolment.user_id = attempt.user_id
        and enrolment.course_id = lesson.course_id
    )
  group by attempt.id, attempt.user_id, attempt.quiz_id, quiz.title, lesson.course_id;

  select jsonb_build_object(
    'organizationId', v_organization_id,
    'programmeId', p_programme_id,
    'cohortId', p_cohort_id,
    'assignedLearners', coalesce(count(distinct enrolment.user_id), 0),
    'startedLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.started_at is not null
        or course_completion.progress_percent > 0
        or programme_completion.progress_percent > 0
    ), 0),
    'inProgressLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'active'
        and (
          enrolment.started_at is not null
          or course_completion.progress_percent > 0
          or programme_completion.progress_percent > 0
        )
        and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
    ), 0),
    'completedLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'completed'
        or course_completion.status = 'completed'
        or programme_completion.status = 'completed'
    ), 0),
    'overdueLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'active'
        and enrolment.due_at is not null
        and enrolment.due_at < now()
        and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
    ), 0),
    'averageCourseProgress', coalesce(round(avg(course_completion.progress_percent))::integer, 0),
    'averageProgrammeProgress', coalesce(round(avg(programme_completion.progress_percent))::integer, 0),
    'averageQuizScore', coalesce((select round(avg(score))::integer from pg_temp.lms_reporting_quiz_attempt_scores), 0),
    'missionAwards', coalesce((
      select count(*)::integer
      from public.mission_awards award
      join pg_temp.lms_reporting_users scoped_user
        on scoped_user.user_id = award.user_id
      where p_programme_id is null
        or exists (
          select 1
          from public.programme_missions programme_mission
          where programme_mission.programme_id = p_programme_id
            and programme_mission.mission_id = award.mission_id
        )
    ), 0),
    'rewardRedemptions', coalesce((
      select count(*)::integer
      from public.reward_redemptions redemption
      join pg_temp.lms_reporting_users scoped_user
        on scoped_user.user_id = redemption.user_id
      where p_programme_id is null
        or exists (
          select 1
          from public.programme_rewards programme_reward
          where programme_reward.programme_id = p_programme_id
            and programme_reward.reward_id = redemption.reward_id
        )
    ), 0),
    'generatedAt', now()
  )
    into v_summary
  from pg_temp.lms_reporting_enrolments enrolment
  left join public.course_completions course_completion
    on course_completion.user_id = enrolment.user_id
   and course_completion.course_id = enrolment.course_id
  left join public.programme_completions programme_completion
    on programme_completion.user_id = enrolment.user_id
   and programme_completion.programme_id = enrolment.programme_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cohortId', cohort.id,
      'title', cohort.title,
      'activeMembers', coalesce(member_counts.active_members, 0),
      'assignedLearners', coalesce(enrolment_counts.assigned_learners, 0),
      'completedLearners', coalesce(enrolment_counts.completed_learners, 0),
      'overdueLearners', coalesce(enrolment_counts.overdue_learners, 0),
      'averageProgress', coalesce(enrolment_counts.average_progress, 0)
    )
    order by cohort.title
  ), '[]'::jsonb)
    into v_cohort_comparison
  from public.cohorts cohort
  left join lateral (
    select count(*)::integer as active_members
    from public.cohort_members member
    where member.cohort_id = cohort.id
      and member.status = 'active'
  ) member_counts on true
  left join lateral (
    select
      count(distinct enrolment.user_id)::integer as assigned_learners,
      count(distinct enrolment.user_id) filter (
        where enrolment.status = 'completed'
          or course_completion.status = 'completed'
          or programme_completion.status = 'completed'
      )::integer as completed_learners,
      count(distinct enrolment.user_id) filter (
        where enrolment.status = 'active'
          and enrolment.due_at is not null
          and enrolment.due_at < now()
          and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
      )::integer as overdue_learners,
      round(avg(coalesce(course_completion.progress_percent, programme_completion.progress_percent, 0)))::integer as average_progress
    from pg_temp.lms_reporting_enrolments enrolment
    left join public.course_completions course_completion
      on course_completion.user_id = enrolment.user_id
     and course_completion.course_id = enrolment.course_id
    left join public.programme_completions programme_completion
      on programme_completion.user_id = enrolment.user_id
     and programme_completion.programme_id = enrolment.programme_id
    where enrolment.metadata ->> 'cohortId' = cohort.id::text
  ) enrolment_counts on true
  where (v_organization_id is null or cohort.organization_id = v_organization_id)
    and (p_cohort_id is null or cohort.id = p_cohort_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', learner.user_id,
      'displayName', profile.display_name,
      'cohorts', coalesce(learner.cohorts, '[]'::jsonb),
      'assignedCount', learner.assigned_count,
      'startedCount', learner.started_count,
      'completedCount', learner.completed_count,
      'overdueCount', learner.overdue_count,
      'averageCourseProgress', learner.average_course_progress,
      'averageProgrammeProgress', learner.average_programme_progress,
      'averageQuizScore', learner.average_quiz_score,
      'missionAwards', learner.mission_awards,
      'rewardRedemptions', learner.reward_redemptions,
      'lastActivityAt', learner.last_activity_at
    )
    order by learner.last_activity_at desc nulls last, profile.display_name asc nulls last
  ), '[]'::jsonb)
    into v_learners
  from (
    select
      scoped_user.user_id,
      count(distinct enrolment.id)::integer as assigned_count,
      count(distinct enrolment.id) filter (
        where enrolment.started_at is not null
          or course_completion.progress_percent > 0
          or programme_completion.progress_percent > 0
      )::integer as started_count,
      count(distinct enrolment.id) filter (
        where enrolment.status = 'completed'
          or course_completion.status = 'completed'
          or programme_completion.status = 'completed'
      )::integer as completed_count,
      count(distinct enrolment.id) filter (
        where enrolment.status = 'active'
          and enrolment.due_at is not null
          and enrolment.due_at < now()
          and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
      )::integer as overdue_count,
      coalesce(round(avg(course_completion.progress_percent))::integer, 0) as average_course_progress,
      coalesce(round(avg(programme_completion.progress_percent))::integer, 0) as average_programme_progress,
      coalesce(quiz_scores.average_quiz_score, 0) as average_quiz_score,
      coalesce(mission_counts.mission_awards, 0) as mission_awards,
      coalesce(redemption_counts.reward_redemptions, 0) as reward_redemptions,
      coalesce(max(enrolment.updated_at), max(course_completion.evaluated_at), max(programme_completion.evaluated_at)) as last_activity_at,
      coalesce(cohort_memberships.cohorts, '[]'::jsonb) as cohorts
    from pg_temp.lms_reporting_users scoped_user
    join pg_temp.lms_reporting_enrolments enrolment
      on enrolment.user_id = scoped_user.user_id
    left join public.course_completions course_completion
      on course_completion.user_id = enrolment.user_id
     and course_completion.course_id = enrolment.course_id
    left join public.programme_completions programme_completion
      on programme_completion.user_id = enrolment.user_id
     and programme_completion.programme_id = enrolment.programme_id
    left join lateral (
      select round(avg(score))::integer as average_quiz_score
      from pg_temp.lms_reporting_quiz_attempt_scores attempt_score
      where attempt_score.user_id = scoped_user.user_id
    ) quiz_scores on true
    left join lateral (
      select count(*)::integer as mission_awards
      from public.mission_awards award
      where award.user_id = scoped_user.user_id
        and (
          p_programme_id is null
          or exists (
            select 1
            from public.programme_missions programme_mission
            where programme_mission.programme_id = p_programme_id
              and programme_mission.mission_id = award.mission_id
          )
        )
    ) mission_counts on true
    left join lateral (
      select count(*)::integer as reward_redemptions
      from public.reward_redemptions redemption
      where redemption.user_id = scoped_user.user_id
        and (
          p_programme_id is null
          or exists (
            select 1
            from public.programme_rewards programme_reward
            where programme_reward.programme_id = p_programme_id
              and programme_reward.reward_id = redemption.reward_id
          )
        )
    ) redemption_counts on true
    left join lateral (
      select coalesce(jsonb_agg(
        jsonb_build_object('cohortId', cohort.id, 'title', cohort.title)
        order by cohort.title
      ), '[]'::jsonb) as cohorts
      from public.cohort_members member
      join public.cohorts cohort
        on cohort.id = member.cohort_id
      where member.user_id = scoped_user.user_id
        and member.status = 'active'
        and (v_organization_id is null or cohort.organization_id = v_organization_id)
        and (p_cohort_id is null or cohort.id = p_cohort_id)
    ) cohort_memberships on true
    group by
      scoped_user.user_id,
      quiz_scores.average_quiz_score,
      mission_counts.mission_awards,
      redemption_counts.reward_redemptions,
      cohort_memberships.cohorts
    order by last_activity_at desc nulls last
    limit v_limit
  ) learner
  join public.profiles profile
    on profile.id = learner.user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'quizId', quiz_id,
      'title', quiz_title,
      'attempts', attempts,
      'averageScore', average_score
    )
    order by quiz_title
  ), '[]'::jsonb)
    into v_quiz_scores
  from (
    select
      quiz_id,
      quiz_title,
      count(*)::integer as attempts,
      round(avg(score))::integer as average_score
    from pg_temp.lms_reporting_quiz_attempt_scores
    group by quiz_id, quiz_title
    order by quiz_title
    limit v_limit
  ) quiz_report;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'missionId', mission.id,
      'title', mission.title,
      'awards', coalesce(award_counts.awards, 0),
      'assignedLearners', (v_summary ->> 'assignedLearners')::integer,
      'completionRate', case
        when (v_summary ->> 'assignedLearners')::integer = 0 then 0
        else round((coalesce(award_counts.awards, 0)::numeric / (v_summary ->> 'assignedLearners')::integer::numeric) * 100)::integer
      end
    )
    order by mission.title
  ), '[]'::jsonb)
    into v_mission_completion
  from public.missions mission
  join (
    select distinct mission_id
    from public.programme_missions programme_mission
    join public.programmes programme
      on programme.id = programme_mission.programme_id
    where (v_organization_id is null or programme.organization_id = v_organization_id)
      and (p_programme_id is null or programme.id = p_programme_id)
    union
    select distinct award.mission_id
    from public.mission_awards award
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = award.user_id
    where p_programme_id is null
  ) scoped_missions
    on scoped_missions.mission_id = mission.id
  left join lateral (
    select count(*)::integer as awards
    from public.mission_awards award
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = award.user_id
    where award.mission_id = mission.id
      and (
        p_programme_id is null
        or exists (
          select 1
          from public.programme_missions programme_mission
          where programme_mission.programme_id = p_programme_id
            and programme_mission.mission_id = award.mission_id
        )
      )
  ) award_counts on true
  limit v_limit;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rewardId', reward.id,
      'title', reward.title,
      'redemptions', reward_report.redemptions,
      'fulfilled', reward_report.fulfilled,
      'requested', reward_report.requested
    )
    order by reward.title
  ), '[]'::jsonb)
    into v_reward_usage
  from (
    select
      redemption.reward_id,
      count(*)::integer as redemptions,
      count(*) filter (where redemption.status in ('fulfilled', 'approved'))::integer as fulfilled,
      count(*) filter (where redemption.status = 'requested')::integer as requested
    from public.reward_redemptions redemption
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = redemption.user_id
    where p_programme_id is null
      or exists (
        select 1
        from public.programme_rewards programme_reward
        where programme_reward.programme_id = p_programme_id
          and programme_reward.reward_id = redemption.reward_id
      )
    group by redemption.reward_id
    order by count(*) desc
    limit v_limit
  ) reward_report
  join public.rewards reward
    on reward.id = reward_report.reward_id;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'cohortComparison', v_cohort_comparison,
    'learners', v_learners,
    'quizScores', v_quiz_scores,
    'missionCompletion', v_mission_completion,
    'rewardUsage', v_reward_usage
  );
end;
$$;

revoke execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, integer) to authenticated, service_role;

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
    'current_user_has_course_enrolment',
    'p_course_id text',
    'PUBLIC_AUTHENTICATED_SELF',
    'RLS policies and learner access checks that need to know whether auth.uid() has an active or completed course enrolment.',
    'Uses auth.uid() only and does not accept a target user id; returns true only for active or completed enrolments on the requested course.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_has_programme_enrolment',
    'p_programme_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'RLS policies and learner access checks that need to know whether auth.uid() has an active or completed programme enrolment.',
    'Uses auth.uid() only and does not accept a target user id; returns true only for active or completed enrolments on the requested programme.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_access_reward',
    'p_reward_id text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Reward RLS and redemption eligibility checks for tenant-owned and programme-sponsored reward visibility.',
    'Allows platform admins; otherwise evaluates auth.uid() membership or enrolment eligibility for the requested reward owner scope without accepting a target user id.',
    array['anon', 'authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
