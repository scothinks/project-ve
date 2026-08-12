-- P1.5C focused closure: explicit organisation/programme delivery context,
-- contextual lesson completion enforcement and refund-neutral issuance reporting.

create or replace function private.is_reward_refund_restoration(
  p_source_type text,
  p_award_scope text
)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  select p_source_type = 'reward_redemption'
    and coalesce(p_award_scope, '') like 'reward_refund:%';
$$;

revoke execute on function private.is_reward_refund_restoration(text, text)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_organization_delivery_xp_account(
  p_user_id uuid,
  p_organization_id uuid,
  p_course_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if p_user_id is null or p_organization_id is null or p_course_id is null then
    raise exception 'Organisation learning context is required.';
  end if;

  if p_user_id <> auth.uid() then
    raise exception 'Learner context does not match the current user.' using errcode = '42501';
  end if;

  if not public.current_user_can_enter_organization(p_organization_id) then
    raise exception 'Organisation learning context is not available.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and course.organization_id = p_organization_id
      and course.status = 'published'
      and public.current_user_can_read_course(course.id)
  ) then
    raise exception 'Course is not available in this organisation context.' using errcode = '42501';
  end if;

  select id
    into v_account_id
  from public.xp_accounts
  where organization_id = p_organization_id
    and scope = 'organization'
    and is_default
    and status = 'active'
  order by created_at
  limit 1;

  if v_account_id is null then
    raise exception 'Organisation XP account is not available.';
  end if;

  return v_account_id;
end;
$$;

revoke execute on function private.resolve_organization_delivery_xp_account(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.programme_lesson_completed_in_context(
  p_user_id uuid,
  p_programme_id uuid,
  p_lesson_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lesson_pages page
    where page.lesson_id = p_lesson_id
  )
  and not exists (
    select 1
    from public.lesson_pages page
    where page.lesson_id = p_lesson_id
      and not exists (
        select 1
        from public.programme_lesson_page_completions completion
        where completion.user_id = p_user_id
          and completion.programme_id = p_programme_id
          and completion.lesson_id = p_lesson_id
          and completion.page_id = page.id
      )
  );
$$;

revoke execute on function private.programme_lesson_completed_in_context(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.record_programme_course_completion(
  p_user_id uuid,
  p_programme_id uuid,
  p_course_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes%rowtype;
  v_course_link public.programme_courses%rowtype;
  v_rule public.course_completion_rules%rowtype;
  v_public_completion public.course_completions%rowtype;
  v_required_lesson_ids text[] := '{}';
  v_required_quiz_ids text[] := '{}';
  v_required_mission_ids text[] := '{}';
  v_completed_lessons integer := 0;
  v_completed_quizzes integer := 0;
  v_completed_missions integer := 0;
  v_requirements integer := 0;
  v_completed integer := 0;
  v_progress integer := 0;
  v_contextual_activity boolean := false;
  v_assessment_completed boolean := true;
  v_completed_at timestamptz;
begin
  select * into v_programme from public.programmes where id = p_programme_id;
  select * into v_course_link
  from public.programme_courses
  where programme_id = p_programme_id and course_id = p_course_id;

  if v_programme.id is null or v_course_link.programme_id is null then
    raise exception 'Programme course context is invalid.';
  end if;

  if not exists (
    select 1 from public.enrolments
    where user_id = p_user_id and programme_id = p_programme_id
      and status in ('active', 'completed')
  ) then
    raise exception 'Active programme enrolment is required.' using errcode = '42501';
  end if;

  select * into v_rule from public.course_completion_rules where course_id = p_course_id;
  if v_rule.course_id is null then
    select coalesce(array_agg(lesson.id order by lesson.sort_order), '{}')::text[]
      into v_required_lesson_ids
    from public.lessons lesson
    where lesson.course_id = p_course_id and lesson.status = 'published';

    select coalesce(array_agg(quiz.id order by lesson.sort_order), '{}')::text[]
      into v_required_quiz_ids
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where lesson.course_id = p_course_id
      and lesson.status = 'published'
      and quiz.status = 'published';
  else
    v_required_lesson_ids := coalesce(v_rule.required_lesson_ids, '{}');
    v_required_quiz_ids := coalesce(v_rule.required_quiz_ids, '{}');
    v_required_mission_ids := coalesce(v_rule.required_mission_ids, '{}');
  end if;

  if v_course_link.prior_completion_policy = 'recognize_prior_completion' then
    select * into v_public_completion
    from public.course_completions
    where user_id = p_user_id and course_id = p_course_id;

    if v_public_completion.id is null then
      v_public_completion := public.upsert_course_completion_for_user(p_user_id, p_course_id);
    end if;

    insert into public.programme_course_completions (
      organization_id, user_id, programme_id, course_id, status,
      progress_percent, completed_at, evaluated_at, metadata
    ) values (
      v_programme.organization_id, p_user_id, p_programme_id, p_course_id,
      v_public_completion.status, v_public_completion.progress_percent,
      v_public_completion.completed_at, now(),
      jsonb_build_object('priorCompletionPolicy', v_course_link.prior_completion_policy, 'source', 'public_completion')
    )
    on conflict (user_id, programme_id, course_id) do update
      set status = excluded.status,
          progress_percent = excluded.progress_percent,
          completed_at = excluded.completed_at,
          evaluated_at = excluded.evaluated_at,
          metadata = excluded.metadata;
    return;
  end if;

  select count(*) into v_completed_lessons
  from unnest(v_required_lesson_ids) required_id
  where private.programme_lesson_completed_in_context(p_user_id, p_programme_id, required_id);

  select count(*) into v_completed_quizzes
  from unnest(v_required_quiz_ids) required_id
  where exists (
    select 1 from public.quiz_attempts attempt
    where attempt.user_id = p_user_id
      and attempt.programme_id = p_programme_id
      and attempt.quiz_id = required_id
      and attempt.status in ('graded', 'practice_completed', 'daily_cap_reached')
  );

  select count(*) into v_completed_missions
  from unnest(v_required_mission_ids) required_id
  where exists (
    select 1 from public.mission_awards award
    where award.user_id = p_user_id
      and award.programme_id = p_programme_id
      and award.mission_id = required_id
  );

  v_contextual_activity := exists (
    select 1 from public.programme_lesson_page_completions completion
    join public.lessons lesson on lesson.id = completion.lesson_id
    where completion.user_id = p_user_id
      and completion.programme_id = p_programme_id
      and lesson.course_id = p_course_id
  ) or exists (
    select 1 from public.quiz_attempts attempt
    join public.quizzes quiz on quiz.id = attempt.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where attempt.user_id = p_user_id
      and attempt.programme_id = p_programme_id
      and lesson.course_id = p_course_id
  ) or exists (
    select 1 from public.user_assessment_attempts attempt
    where attempt.user_id = p_user_id and attempt.programme_id = p_programme_id
      and v_rule.required_final_assessment_version_id is not null
      and attempt.assessment_version_id = v_rule.required_final_assessment_version_id
  ) or exists (
    select 1 from public.mission_awards award
    where award.user_id = p_user_id
      and award.programme_id = p_programme_id
      and award.mission_id = any(v_required_mission_ids)
  );

  if v_rule.required_final_assessment_version_id is not null then
    v_assessment_completed := exists (
      select 1 from public.user_assessment_attempts attempt
      where attempt.user_id = p_user_id
        and attempt.programme_id = p_programme_id
        and attempt.assessment_version_id = v_rule.required_final_assessment_version_id
        and attempt.status = 'completed'
    );
  end if;

  v_requirements := coalesce(array_length(v_required_lesson_ids, 1), 0)
    + coalesce(array_length(v_required_quiz_ids, 1), 0)
    + coalesce(array_length(v_required_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null then 1 else 0 end;
  v_completed := v_completed_lessons + v_completed_quizzes + v_completed_missions
    + case when v_rule.required_final_assessment_version_id is not null and v_assessment_completed then 1 else 0 end;
  v_progress := case when v_requirements = 0 then 0 else least(100, round(v_completed::numeric / v_requirements * 100)::integer) end;

  if v_contextual_activity and v_requirements = v_completed then
    v_completed_at := now();
  end if;

  insert into public.programme_course_completions (
    organization_id, user_id, programme_id, course_id, status,
    progress_percent, completed_at, evaluated_at, metadata
  ) values (
    v_programme.organization_id, p_user_id, p_programme_id, p_course_id,
    case when v_completed_at is not null then 'completed' else 'in_progress' end::public.lms_completion_status,
    v_progress, v_completed_at, now(),
    jsonb_build_object(
      'priorCompletionPolicy', v_course_link.prior_completion_policy,
      'contextualActivity', v_contextual_activity,
      'completedLessons', v_completed_lessons,
      'completedQuizzes', v_completed_quizzes,
      'completedMissions', v_completed_missions
    )
  )
  on conflict (user_id, programme_id, course_id) do update
    set status = excluded.status,
        progress_percent = excluded.progress_percent,
        completed_at = excluded.completed_at,
        evaluated_at = excluded.evaluated_at,
        metadata = excluded.metadata;
end;
$$;

revoke execute on function private.record_programme_course_completion(uuid, uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.start_quiz_attempt(
  p_quiz_id text,
  p_lesson_id text,
  p_programme_id uuid,
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_course_id text;
  v_lesson public.lessons%rowtype;
  v_programme_organization_id uuid;
begin
  select lesson.*
    into v_lesson
  from public.quizzes quiz
  join public.lessons lesson on lesson.id = quiz.lesson_id
  where quiz.id = p_quiz_id;

  v_course_id := v_lesson.course_id;

  if v_course_id is null then
    return public.start_quiz_attempt_legacy(p_quiz_id, p_lesson_id);
  end if;

  if p_programme_id is not null then
    select organization_id
      into v_programme_organization_id
    from public.programmes
    where id = p_programme_id;

    if p_organization_id is not null and p_organization_id <> v_programme_organization_id then
      raise exception 'Programme does not belong to the requested organisation context.' using errcode = '42501';
    end if;

    v_account_id := private.resolve_programme_xp_account(
      v_user_id, p_programme_id, 'course', v_course_id
    );

    if coalesce(v_lesson.quiz_requires_lesson_completion, true)
       and exists (
         select 1
         from public.programme_courses programme_course
         where programme_course.programme_id = p_programme_id
           and programme_course.course_id = v_course_id
           and programme_course.prior_completion_policy = 'require_completion_in_context'
       )
       and not private.programme_lesson_completed_in_context(v_user_id, p_programme_id, v_lesson.id) then
      return jsonb_build_object(
        'status', 'blocked',
        'reason', 'lesson_incomplete',
        'message', 'Complete the lesson pages in this programme before starting the quiz.'
      );
    end if;

    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', p_programme_id::text, true);
  elsif p_organization_id is not null then
    v_account_id := private.resolve_organization_delivery_xp_account(v_user_id, p_organization_id, v_course_id);
    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', '', true);
  end if;

  begin
    v_result := public.start_quiz_attempt_legacy(p_quiz_id, p_lesson_id);
  exception when others then
    perform set_config('app.xp_account_id', '', true);
    perform set_config('app.xp_programme_id', '', true);
    raise;
  end;

  perform set_config('app.xp_account_id', '', true);
  perform set_config('app.xp_programme_id', '', true);

  return v_result || jsonb_build_object(
    'organizationId', p_organization_id,
    'programmeId', p_programme_id,
    'xpAccountId', v_account_id
  );
end;
$$;

create or replace function public.start_quiz_attempt(
  p_quiz_id text,
  p_lesson_id text,
  p_programme_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.start_quiz_attempt(p_quiz_id, p_lesson_id, p_programme_id, null);
$$;

create or replace function public.start_quiz_attempt(
  p_quiz_id text,
  p_lesson_id text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.start_quiz_attempt(p_quiz_id, p_lesson_id, null, null);
$$;

revoke execute on function public.start_quiz_attempt(text, text, uuid, uuid) from public, anon;
grant execute on function public.start_quiz_attempt(text, text, uuid, uuid) to authenticated;
revoke execute on function public.start_quiz_attempt(text, text, uuid) from public, anon;
grant execute on function public.start_quiz_attempt(text, text, uuid) to authenticated;
revoke execute on function public.start_quiz_attempt(text, text) from public, anon;
grant execute on function public.start_quiz_attempt(text, text) to authenticated;

create or replace function public.complete_lesson_page(
  p_lesson_id text,
  p_page_id text,
  p_programme_id uuid,
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id text;
  v_result jsonb;
  v_programme_organization_id uuid;
  v_account_id uuid;
begin
  select course_id into v_course_id from public.lessons where id = p_lesson_id;

  if p_programme_id is null and p_organization_id is null then
    return public.complete_lesson_page(p_lesson_id, p_page_id);
  end if;

  if p_programme_id is not null then
    select organization_id
      into v_programme_organization_id
    from public.programmes
    where id = p_programme_id;

    if p_organization_id is not null and p_organization_id <> v_programme_organization_id then
      raise exception 'Programme does not belong to the requested organisation context.' using errcode = '42501';
    end if;

    v_account_id := private.resolve_programme_xp_account(v_user_id, p_programme_id, 'course', v_course_id);
    v_result := public.complete_lesson_page(p_lesson_id, p_page_id);
    insert into public.programme_lesson_page_completions(user_id, programme_id, lesson_id, page_id)
    values (v_user_id, p_programme_id, p_lesson_id, p_page_id)
    on conflict (user_id, programme_id, lesson_id, page_id) do update set completed_at = excluded.completed_at;
    perform public.upsert_programme_completion_for_user(v_user_id, p_programme_id);
    return v_result || jsonb_build_object(
      'organizationId', coalesce(p_organization_id, v_programme_organization_id),
      'programmeId', p_programme_id,
      'xpAccountId', v_account_id,
      'contextual', true
    );
  end if;

  v_account_id := private.resolve_organization_delivery_xp_account(v_user_id, p_organization_id, v_course_id);
  v_result := public.complete_lesson_page(p_lesson_id, p_page_id);
  return v_result || jsonb_build_object(
    'organizationId', p_organization_id,
    'programmeId', null,
    'xpAccountId', v_account_id,
    'contextual', false
  );
end;
$$;

create or replace function public.complete_lesson_page(
  p_lesson_id text,
  p_page_id text,
  p_programme_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.complete_lesson_page(p_lesson_id, p_page_id, p_programme_id, null);
$$;

revoke execute on function public.complete_lesson_page(text, text, uuid, uuid) from public, anon;
grant execute on function public.complete_lesson_page(text, text, uuid, uuid) to authenticated;
revoke execute on function public.complete_lesson_page(text, text, uuid) from public, anon;
grant execute on function public.complete_lesson_page(text, text, uuid) to authenticated;

create or replace function private.enforce_xp_account_issuance_controls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
  v_period_start timestamptz;
  v_issued_period bigint;
  v_issued_user bigint;
  v_current_exposure numeric(14, 2);
  v_projected_exposure numeric(14, 2);
begin
  if new.direction <> 'earn'
     or private.is_reward_refund_restoration(new.source_type::text, new.award_scope) then
    return new;
  end if;
  select * into v_account from public.xp_accounts where id = new.xp_account_id for update;
  if not found or v_account.scope <> 'organization' then return new; end if;
  if new.award_scope is not null and exists (
    select 1 from public.xp_transactions transaction
    where transaction.user_id = new.user_id and transaction.xp_account_id = new.xp_account_id
      and transaction.direction = 'earn' and transaction.award_scope = new.award_scope
  ) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('xp-issuance:' || new.xp_account_id::text, 0));
  v_period_start := now() - make_interval(days => v_account.issuance_period_days);
  select coalesce(sum(amount), 0) into v_issued_period from public.xp_transactions
  where xp_account_id = new.xp_account_id
    and direction = 'earn'
    and created_at >= v_period_start
    and not private.is_reward_refund_restoration(source_type::text, award_scope);
  if v_account.issuance_cap_per_period is not null and v_issued_period + new.amount > v_account.issuance_cap_per_period then
    raise exception 'XP account period issuance cap reached. % XP remains.', greatest(v_account.issuance_cap_per_period - v_issued_period, 0);
  end if;
  select coalesce(sum(amount), 0) into v_issued_user from public.xp_transactions
  where xp_account_id = new.xp_account_id
    and user_id = new.user_id
    and direction = 'earn'
    and created_at >= v_period_start
    and not private.is_reward_refund_restoration(source_type::text, award_scope);
  if v_account.issuance_cap_per_user is not null and v_issued_user + new.amount > v_account.issuance_cap_per_user then
    raise exception 'XP account learner issuance cap reached. % XP remains.', greatest(v_account.issuance_cap_per_user - v_issued_user, 0);
  end if;
  if v_account.exposure_hard_threshold is not null then
    select coalesce(sum(balance_cached), 0) * v_account.accounting_value_per_unit into v_current_exposure
    from public.user_xp_balances where xp_account_id = new.xp_account_id;
    v_projected_exposure := v_current_exposure + new.amount * v_account.accounting_value_per_unit;
    if v_projected_exposure > v_account.exposure_hard_threshold then
      raise exception 'XP account exposure hard threshold reached. Estimated liability is %.', v_current_exposure;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.admin_get_xp_account_overview(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
  v_period_start timestamptz;
  v_circulation bigint;
  v_issuance bigint;
  v_redemptions bigint;
  v_adjustments bigint;
  v_period_issuance bigint;
  v_estimated_liability numeric(14, 2);
  v_rewards jsonb;
  v_history jsonb;
  v_programme_issuance jsonb;
  v_user_issuance jsonb;
begin
  if p_organization_id is null or not public.current_user_can_manage_organization(p_organization_id) then
    raise exception 'Organisation XP account access is required.' using errcode = '42501';
  end if;

  select * into v_account
  from public.xp_accounts
  where organization_id = p_organization_id and scope = 'organization' and is_default
  order by status = 'active' desc
  limit 1;
  if not found then raise exception 'Organisation XP account not found.'; end if;

  v_period_start := now() - make_interval(days => v_account.issuance_period_days);

  select coalesce(sum(balance_cached), 0) into v_circulation
  from public.user_xp_balances where xp_account_id = v_account.id;
  select coalesce(sum(amount) filter (
           where direction = 'earn'
             and not private.is_reward_refund_restoration(source_type::text, award_scope)
         ), 0),
         coalesce(sum(amount) filter (where direction = 'spend'), 0),
         coalesce(sum(amount) filter (where source_type = 'adjustment'), 0),
         coalesce(sum(amount) filter (
           where direction = 'earn'
             and created_at >= v_period_start
             and not private.is_reward_refund_restoration(source_type::text, award_scope)
         ), 0)
    into v_issuance, v_redemptions, v_adjustments, v_period_issuance
  from public.xp_transactions where xp_account_id = v_account.id;
  select coalesce(sum(balance_cached), 0) * v_account.accounting_value_per_unit
    into v_estimated_liability
  from public.user_xp_balances where xp_account_id = v_account.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'programmeId', issuance.programme_id,
    'programmeName', programme.title,
    'issued', issuance.issued
  ) order by issuance.issued desc), '[]'::jsonb)
    into v_programme_issuance
  from (
    select transaction.programme_id, sum(transaction.amount)::bigint as issued
    from public.xp_transactions transaction
    where transaction.xp_account_id = v_account.id
      and transaction.direction = 'earn'
      and transaction.programme_id is not null
      and not private.is_reward_refund_restoration(transaction.source_type::text, transaction.award_scope)
    group by transaction.programme_id
  ) issuance
  join public.programmes programme on programme.id = issuance.programme_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', issuance.user_id,
    'displayName', coalesce(profile.display_name, 'Unnamed learner'),
    'issued', issuance.issued
  ) order by issuance.issued desc), '[]'::jsonb)
    into v_user_issuance
  from (
    select transaction.user_id, sum(transaction.amount)::bigint as issued
    from public.xp_transactions transaction
    where transaction.xp_account_id = v_account.id
      and transaction.direction = 'earn'
      and not private.is_reward_refund_restoration(transaction.source_type::text, transaction.award_scope)
    group by transaction.user_id
  ) issuance
  left join public.profiles profile on profile.id = issuance.user_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', reward.id, 'title', reward.title, 'costXp', reward.cost_xp, 'status', reward.status, 'isEnabled', reward.is_enabled) order by reward.title), '[]'::jsonb)
    into v_rewards
  from public.rewards reward where reward.xp_account_id = v_account.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', transaction.id, 'userId', transaction.user_id, 'amount', transaction.amount, 'direction', transaction.direction, 'sourceType', transaction.source_type, 'sourceId', transaction.source_id, 'createdAt', transaction.created_at) order by transaction.created_at desc), '[]'::jsonb)
    into v_history
  from (select * from public.xp_transactions where xp_account_id = v_account.id order by created_at desc limit 50) transaction;

  return jsonb_build_object(
    'account', jsonb_build_object('id', v_account.id, 'name', v_account.name, 'pluralName', v_account.plural_name, 'shortLabel', v_account.short_label, 'icon', coalesce(v_account.icon_url, v_account.icon), 'displayFormat', v_account.display_format, 'status', v_account.status),
    'circulation', v_circulation,
    'issuance', v_issuance,
    'redemptions', v_redemptions,
    'adjustments', v_adjustments,
    'controls', jsonb_build_object(
      'accountingValuePerUnit', v_account.accounting_value_per_unit,
      'issuancePeriodDays', v_account.issuance_period_days,
      'issuanceCapPerPeriod', v_account.issuance_cap_per_period,
      'issuanceCapPerUser', v_account.issuance_cap_per_user,
      'fundedRewardBudget', v_account.funded_reward_budget,
      'exposureWarningThreshold', v_account.exposure_warning_threshold,
      'exposureHardThreshold', v_account.exposure_hard_threshold,
      'periodIssued', v_period_issuance,
      'periodRemaining', greatest(v_account.issuance_cap_per_period - v_period_issuance, 0)
    ),
    'exposure', jsonb_build_object(
      'estimatedUnredeemedLiability', v_estimated_liability,
      'warning', v_account.exposure_warning_threshold is not null and v_estimated_liability >= v_account.exposure_warning_threshold,
      'hardBlocked', v_account.exposure_hard_threshold is not null and v_estimated_liability >= v_account.exposure_hard_threshold
    ),
    'programmeIssuance', v_programme_issuance,
    'userIssuance', v_user_issuance,
    'rewards', v_rewards,
    'transactions', v_history
  );
end;
$$;

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values
  (
    'public', 'start_quiz_attempt', 'p_quiz_id text, p_lesson_id text, p_programme_id uuid, p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF', 'Authenticated learner quiz start with explicit organisation/programme delivery context.',
    'Requires auth.uid(); programme context resolves through programme enrolment and course attachment, organisation context resolves through organisation entry, course ownership and course read access. XP account is never accepted from the client.',
    array['authenticated', 'service_role']
  ),
  (
    'public', 'complete_lesson_page', 'p_lesson_id text, p_page_id text, p_programme_id uuid, p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF', 'Authenticated learner lesson progress with explicit organisation/programme delivery context.',
    'Requires auth.uid(); programme context resolves through programme enrolment and course attachment, organisation context resolves through organisation entry, course ownership and course read access. XP account is never accepted from the client.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
