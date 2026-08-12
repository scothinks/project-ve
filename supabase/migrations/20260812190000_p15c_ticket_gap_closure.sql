alter type public.xp_source_type add value if not exists 'reward_redemption_bonus';

alter table public.reward_redemptions
  add column if not exists updated_at timestamptz not null default now();

create or replace function private.is_starter_organization_unchecked(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select assignment.plan_key = 'starter'
    from public.organization_plan_assignments assignment
    join public.organization_plans plan on plan.key = assignment.plan_key
    where assignment.organization_id = p_organization_id
      and assignment.ended_at is null
      and plan.status = 'active'
    order by assignment.starts_at desc
    limit 1
  ), true);
$$;

revoke execute on function private.is_starter_organization_unchecked(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_programme_xp_account(
  p_user_id uuid,
  p_programme_id uuid,
  p_context_type text,
  p_context_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if p_user_id is null or p_programme_id is null then
    raise exception 'Programme learning context is required.';
  end if;

  if not exists (
    select 1 from public.enrolments
    where user_id = p_user_id
      and programme_id = p_programme_id
      and status in ('active', 'completed')
  ) and not (
    p_context_type = 'mission'
    and (
      exists (
        select 1 from public.mission_proofs proof
        where proof.user_id = p_user_id
          and proof.programme_id = p_programme_id
          and proof.mission_id = p_context_id
          and proof.status = 'submitted'
      )
      or exists (
        select 1
        from public.programmes programme
        join public.organization_memberships membership
          on membership.organization_id = programme.organization_id
        where programme.id = p_programme_id
          and membership.user_id = p_user_id
          and membership.status = 'active'
          and membership.role in ('organisation_owner', 'organisation_admin', 'programme_manager')
      )
    )
  ) then
    raise exception 'Active programme enrolment is required.' using errcode = '42501';
  end if;

  if p_context_type = 'course' and not exists (
    select 1 from public.programme_courses
    where programme_id = p_programme_id and course_id = p_context_id
  ) then
    raise exception 'Course is not attached to this programme.';
  elsif p_context_type = 'mission' and not exists (
    select 1 from public.programme_missions
    where programme_id = p_programme_id and mission_id = p_context_id
  ) then
    raise exception 'Mission is not attached to this programme.';
  elsif p_context_type = 'assessment' and not exists (
    select 1 from public.programme_assessments
    where programme_id = p_programme_id and assessment_version_id = p_context_id::uuid
  ) then
    raise exception 'Assessment is not attached to this programme.';
  end if;

  select coalesce(
    case when p_context_type = 'mission' then (
      select xp_account_id from public.programme_missions
      where programme_id = p_programme_id and mission_id = p_context_id
    ) end,
    case when p_context_type = 'assessment' then (
      select xp_account_id from public.programme_assessments
      where programme_id = p_programme_id and assessment_version_id = p_context_id::uuid
    ) end,
    (
      select xp_account_id from public.enrolments
      where user_id = p_user_id and programme_id = p_programme_id
        and status in ('active', 'completed')
      order by assigned_at desc limit 1
    ),
    (select default_xp_account_id from public.programmes where id = p_programme_id)
  ) into v_account_id;

  perform private.assert_programme_xp_account(p_programme_id, v_account_id);
  return v_account_id;
end;
$$;

revoke execute on function private.resolve_programme_xp_account(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_organization_reward_quotas()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_active integer;
  v_max integer;
begin
  if new.organization_id is null or not private.is_starter_organization_unchecked(new.organization_id) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('starter-rewards:' || new.organization_id::text, 0));

  if new.fulfillment_type <> 'manual' then
    raise exception 'Starter organisations support manual reward fulfilment only.'
      using errcode = 'check_violation';
  end if;

  v_max := private.organization_entitlement_integer_unchecked(new.organization_id, 'max_active_rewards');
  if new.status = 'published' and new.is_enabled then
    select count(*) into v_active
    from public.rewards reward
    where reward.organization_id = new.organization_id
      and reward.id <> new.id
      and reward.status = 'published'
      and reward.is_enabled;

    if v_active >= v_max then
      raise exception 'Starter organisations may have one active reward.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_organization_reward_quotas()
  from public, anon, authenticated, service_role;

drop trigger if exists rewards_enforce_organization_quotas on public.rewards;
create trigger rewards_enforce_organization_quotas
  before insert or update of status, is_enabled, fulfillment_type, organization_id
  on public.rewards
  for each row execute function private.enforce_organization_reward_quotas();

create or replace function private.enforce_organization_claim_quotas()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_org uuid;
  v_open integer;
  v_month integer;
  v_open_cap integer;
  v_month_cap integer;
begin
  select organization_id into v_org from public.rewards where id = new.reward_id;
  if v_org is null or not private.is_starter_organization_unchecked(v_org) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('starter-rewards:' || v_org::text, 0));
  v_open_cap := private.organization_entitlement_integer_unchecked(v_org, 'max_open_reward_claims');

  if tg_op = 'INSERT' then
    select count(*) into v_open
    from public.reward_redemptions redemption
    join public.rewards reward on reward.id = redemption.reward_id
    where reward.organization_id = v_org
      and redemption.claim_state not in ('fulfilled', 'rejected', 'cancelled', 'refunded', 'expired');

    if v_open >= v_open_cap then
      raise exception 'Starter organisation open reward claim limit reached.'
        using errcode = 'check_violation';
    end if;
  elsif new.claim_state = 'fulfilled' and old.claim_state is distinct from 'fulfilled' then
    v_month_cap := private.organization_entitlement_integer_unchecked(v_org, 'max_fulfilled_reward_claims_per_month');

    select count(*) into v_month
    from public.reward_redemptions redemption
    join public.rewards reward on reward.id = redemption.reward_id
    where reward.organization_id = v_org
      and redemption.claim_state = 'fulfilled'
      and redemption.fulfilled_at >= date_trunc('month', now());

    if v_month >= v_month_cap then
      raise exception 'Starter organisation monthly fulfilled reward limit reached.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_organization_claim_quotas()
  from public, anon, authenticated, service_role;

drop trigger if exists reward_redemptions_enforce_organization_claim_quotas on public.reward_redemptions;
create trigger reward_redemptions_enforce_organization_claim_quotas
  before insert or update of claim_state
  on public.reward_redemptions
  for each row execute function private.enforce_organization_claim_quotas();

create or replace function private.reject_starter_reward_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id
  from public.rewards
  where id = new.reward_id;

  if v_organization_id is not null
     and private.is_starter_organization_unchecked(v_organization_id) then
    raise exception 'Starter organisations cannot use voucher or QR inventory.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function private.reject_starter_reward_inventory()
  from public, anon, authenticated, service_role;

drop trigger if exists reward_inventory_items_reject_starter on public.reward_inventory_items;
create trigger reward_inventory_items_reject_starter
  before insert or update of reward_id, item_type
  on public.reward_inventory_items
  for each row execute function private.reject_starter_reward_inventory();

create or replace function private.assign_xp_transaction_account_from_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if new.source_type in ('reward_redemption', 'reward_redemption_bonus')
     and not coalesce(new.metadata ? 'attemptId', false)
     and new.source_id ~ '^[0-9a-fA-F-]{36}$' then
    select coalesce(redemption.xp_account_id, reward.xp_account_id)
      into v_account_id
    from public.reward_redemptions redemption
    join public.rewards reward on reward.id = redemption.reward_id
    where redemption.id = new.source_id::uuid;

    if v_account_id is not null then
      new.xp_account_id := v_account_id;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.assign_xp_transaction_account_from_reward()
  from public, anon, authenticated, service_role;

drop trigger if exists xp_transactions_assign_reward_account on public.xp_transactions;
create trigger xp_transactions_assign_reward_account
  before insert on public.xp_transactions
  for each row execute function private.assign_xp_transaction_account_from_reward();

create table if not exists public.programme_course_completions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  status public.lms_completion_status not null default 'in_progress',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  completed_at timestamptz,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, programme_id, course_id),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (status = 'completed' and completed_at is not null)
    or (status = 'in_progress' and completed_at is null)
  )
);

create index if not exists programme_course_completions_scope_idx
  on public.programme_course_completions(programme_id, course_id, status);

alter table public.programme_course_completions enable row level security;

drop policy if exists "Learners and programme staff can read contextual completions"
  on public.programme_course_completions;
create policy "Learners and programme staff can read contextual completions"
  on public.programme_course_completions for select
  using (
    auth.uid() = user_id
    or public.current_user_can_read_programme(programme_id)
  );

revoke insert, update, delete on public.programme_course_completions from anon, authenticated;

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
  where exists (
    select 1 from public.lesson_progress progress
    where progress.user_id = p_user_id
      and progress.lesson_id = required_id
      and progress.completed_at is not null
  );

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
  v_completed_at timestamptz;
  v_result public.programme_completions%rowtype;
  v_minimum_completion_threshold integer := 100;
  v_course_id text;
begin
  if p_user_id is null then raise exception 'User is required.'; end if;

  select * into v_programme from public.programmes where id = p_programme_id;
  if not found then raise exception 'Programme not found.'; end if;

  select * into v_rule from public.programme_completion_rules where programme_id = p_programme_id;
  if found then
    v_required_course_ids := coalesce(v_rule.required_course_ids, '{}');
    v_required_mission_ids := coalesce(v_rule.required_mission_ids, '{}');
    v_minimum_completion_threshold := coalesce(v_rule.minimum_completion_threshold, 100);
  else
    select coalesce(array_agg(course_id order by sort_order), '{}')::text[]
      into v_required_course_ids
    from public.programme_courses
    where programme_id = p_programme_id and requirement = 'required';

    select coalesce(array_agg(mission_id order by sort_order), '{}')::text[]
      into v_required_mission_ids
    from public.programme_missions
    where programme_id = p_programme_id;
  end if;

  foreach v_course_id in array v_required_course_ids loop
    perform private.record_programme_course_completion(p_user_id, p_programme_id, v_course_id);
  end loop;

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_course_ids
  from unnest(v_required_course_ids) required_id
  where exists (
    select 1 from public.programme_course_completions completion
    where completion.user_id = p_user_id
      and completion.programme_id = p_programme_id
      and completion.course_id = required_id
      and completion.status = 'completed'
  );

  select coalesce(array_agg(required_id order by required_id), '{}')::text[]
    into v_completed_mission_ids
  from unnest(v_required_mission_ids) required_id
  where exists (
    select 1 from public.mission_awards award
    where award.user_id = p_user_id
      and award.mission_id = required_id
      and (award.programme_id = p_programme_id or award.programme_id is null)
  );

  v_assessment_completed := public.user_completed_assessment(p_user_id, v_rule.required_final_assessment_version_id);
  v_requirement_count := coalesce(array_length(v_required_course_ids, 1), 0)
    + coalesce(array_length(v_required_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null then 1 else 0 end;
  v_completed_count := coalesce(array_length(v_completed_course_ids, 1), 0)
    + coalesce(array_length(v_completed_mission_ids, 1), 0)
    + case when v_rule.required_final_assessment_version_id is not null and v_assessment_completed then 1 else 0 end;
  v_progress_percent := case when v_requirement_count = 0 then 100 else least(100, round(v_completed_count::numeric / v_requirement_count * 100)::integer) end;
  v_status := case when v_progress_percent >= v_minimum_completion_threshold and v_assessment_completed then 'completed' else 'in_progress' end;

  select completed_at into v_completed_at
  from public.programme_completions
  where user_id = p_user_id and programme_id = p_programme_id;
  if v_status = 'completed' then v_completed_at := coalesce(v_completed_at, now()); else v_completed_at := null; end if;

  select * into v_result
  from public.programme_completions
  where user_id = p_user_id and programme_id = p_programme_id;

  insert into public.programme_completions (
    organization_id, user_id, programme_id, status, progress_percent,
    completed_required_courses, completed_required_missions, missing_requirements,
    completed_at, evaluated_at, metadata
  ) values (
    v_programme.organization_id, p_user_id, p_programme_id, v_status, v_progress_percent,
    v_completed_course_ids, v_completed_mission_ids,
    jsonb_build_object(
      'courseIds', array(
        select required_id from unnest(v_required_course_ids) required_id
        where not required_id = any(v_completed_course_ids)
      ),
      'missionIds', array(
        select required_id from unnest(v_required_mission_ids) required_id
        where not required_id = any(v_completed_mission_ids)
      )
    ),
    v_completed_at, now(), jsonb_build_object('requiredCourseIds', v_required_course_ids, 'requiredMissionIds', v_required_mission_ids)
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
  returning * into v_result;

  return v_result;
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
  v_options_snapshot jsonb;
  v_attempt_question_count integer;
  v_answered_count integer;
  v_correct_option_ids text[];
  v_selected_option_ids text[];
  v_has_invalid_option boolean;
  v_is_correct boolean;
  v_already_awarded boolean;
  v_daily_limit integer := 50;
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
  v_account_id uuid := coalesce(v_attempt.xp_account_id, '00000000-0000-4000-8000-00000000e001'::uuid);
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select * into v_attempt
  from public.quiz_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;
  if v_attempt.id is null or v_attempt.status <> 'in_progress' then raise exception 'Attempt is not active.'; end if;
  v_account_id := coalesce(v_attempt.xp_account_id, '00000000-0000-4000-8000-00000000e001'::uuid);

  if exists (select 1 from public.quiz_answers where attempt_id = p_attempt_id and question_id = p_question_id) then
    raise exception 'This question has already been answered.';
  end if;

  select xp, options_snapshot into v_question_xp, v_options_snapshot
  from public.quiz_attempt_questions where attempt_id = p_attempt_id and question_id = p_question_id;
  if v_question_xp is null then raise exception 'Question is not part of this attempt.'; end if;

  select coalesce(array_agg(distinct option_id order by option_id), '{}') into v_selected_option_ids
  from unnest(coalesce(p_selected_option_ids, '{}')) as option_id;
  if coalesce(array_length(v_selected_option_ids, 1), 0) = 0 then raise exception 'At least one selected option is required.'; end if;

  select exists (
    select 1 from unnest(v_selected_option_ids) selected(option_id)
    where not exists (
      select 1 from jsonb_array_elements(coalesce(v_options_snapshot, '[]')) option_snapshot(value)
      where option_snapshot.value ->> 'id' = selected.option_id
    )
  ) into v_has_invalid_option;
  if v_has_invalid_option then raise exception 'One or more selected options do not belong to this attempt question.'; end if;

  select correct_option_ids into v_correct_option_ids from private.quiz_answer_keys where question_id = p_question_id;
  v_correct_option_ids := coalesce(v_correct_option_ids, '{}');
  v_is_correct := v_selected_option_ids = v_correct_option_ids;
  v_answer_correct := v_is_correct;

  if v_attempt.mode <> 'practice' and v_is_correct then
    perform pg_advisory_xact_lock(
      hashtextextended(
        v_user_id::text || ':quiz_xp:' || (now() at time zone 'Africa/Lagos')::date::text,
        0
      )
    );
  end if;

  select exists (
    select 1 from public.xp_transactions
    where user_id = v_user_id and xp_account_id = v_account_id
      and direction = 'earn' and award_scope = v_award_scope
  ) into v_already_awarded;

  select coalesce(
    (select earnable_quiz_xp_limit from public.user_daily_xp_limits where user_id = v_user_id and local_date = (now() at time zone 'Africa/Lagos')::date),
    (select default_daily_quiz_xp_limit from public.xp_settings where id = 1), 50
  ) into v_daily_limit;
  select coalesce(sum(amount), 0) into v_daily_earned
  from public.xp_transactions
  where user_id = v_user_id and xp_account_id = v_account_id
    and direction = 'earn' and source_type = 'quiz_question'
    and (created_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date;
  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

  update public.user_xp_boosts set status = 'expired'
  where user_id = v_user_id and status = 'active' and ends_at <= now();

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

    select * into v_boost from public.user_xp_boosts
    where user_id = v_user_id and status = 'active' and starts_at <= now() and ends_at > now()
      and (remaining_uses is null or used_count < remaining_uses)
    order by multiplier desc, ends_at asc for update skip locked limit 1;
    if v_boost.id is not null then
      v_boost_bonus_xp := greatest(0, floor(v_question_xp * (v_boost.multiplier - 1))::integer);
      v_earned_xp := v_question_xp + v_boost_bonus_xp;
    end if;

    perform private.post_xp_transaction(v_user_id, 'earn', v_base_earned_xp, 'quiz_question', p_question_id, v_award_scope, jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id));
    if v_boost_bonus_xp > 0 then
      perform private.post_xp_transaction(v_user_id, 'earn', v_boost_bonus_xp, 'reward_redemption', v_boost.redemption_id::text, 'xp_boost:' || v_boost.id::text || ':' || p_question_id, jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id, 'boostId', v_boost.id));
      update public.user_xp_boosts set used_count = used_count + 1,
        status = case when remaining_uses is not null and used_count + 1 >= remaining_uses then 'consumed' else status end
      where id = v_boost.id;
    end if;
  end if;

  insert into public.quiz_answers (attempt_id, user_id, question_id, selected_option_ids, is_correct, earned_xp, status)
  values (p_attempt_id, v_user_id, p_question_id, v_selected_option_ids, v_answer_correct, v_earned_xp, v_status);

  select count(*) into v_attempt_question_count from public.quiz_attempt_questions where attempt_id = p_attempt_id;
  select count(*) into v_answered_count from public.quiz_answers where attempt_id = p_attempt_id;
  if v_status = 'daily_cap_deferred' then
    v_attempt_status := 'daily_cap_reached'; v_completed := true;
  elsif v_answered_count >= v_attempt_question_count then
    v_attempt_status := case when v_attempt.mode = 'practice' then 'practice_completed' else 'graded' end;
    v_completed := true;
  end if;
  if v_completed then
    update public.quiz_attempts set status = v_attempt_status, ended_at = now(), ended_reason = v_attempt_status::text where id = p_attempt_id;
  end if;

  return jsonb_build_object(
    'status', v_status, 'completed', v_completed, 'attemptStatus', coalesce(v_attempt_status::text, 'in_progress'),
    'questionResult', jsonb_build_object('questionId', p_question_id, 'correct', v_answer_correct, 'earnedXp', v_earned_xp, 'status', v_status, 'boostBonusXp', v_boost_bonus_xp),
    'dailyXpLimit', v_daily_limit, 'dailyXpRemaining', greatest(0, v_daily_limit - v_daily_earned - v_base_earned_xp),
    'nextResetAt', (((now() at time zone 'Africa/Lagos')::date + interval '1 day') at time zone 'Africa/Lagos')
  );
end;
$$;

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values (
  'public', 'answer_quiz_question', 'p_attempt_id uuid, p_question_id text, p_selected_option_ids text[]',
  'PUBLIC_AUTHENTICATED_SELF', 'Authenticated learners answering their own server-created attempts.',
  'Derives the learner account from the trusted quiz attempt and scopes duplicate protection and daily caps to that account.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set authorization_rule = excluded.authorization_rule,
    reviewed_at = now();

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values (
  'public', 'admin_update_xp_account_presentation',
  'p_xp_account_id uuid, p_display_name text, p_display_name_plural text, p_short_label text, p_icon text, p_display_format text, p_status xp_account_status',
  'ADMIN_AUTHENTICATED', 'Organisation managers configuring their organisation XP account presentation.',
  'Requires organisation management access and updates only an organisation-scoped account.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set authorization_rule = excluded.authorization_rule,
    reviewed_at = now();

create or replace function public.admin_update_xp_account_presentation(
  p_xp_account_id uuid,
  p_display_name text,
  p_display_name_plural text,
  p_short_label text,
  p_icon text,
  p_display_format text,
  p_status public.xp_account_status
)
returns public.xp_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
begin
  select * into v_account from public.xp_accounts where id = p_xp_account_id for update;
  if not found then raise exception 'XP account not found.'; end if;
  if v_account.scope <> 'organization' or not public.current_user_can_manage_organization(v_account.organization_id) then
    raise exception 'Organisation account management access is required.';
  end if;
  if nullif(trim(p_display_name), '') is null or nullif(trim(p_display_name_plural), '') is null or nullif(trim(p_short_label), '') is null then
    raise exception 'XP account labels are required.';
  end if;
  if p_display_format not in ('amount_name', 'amount_short_label') then raise exception 'Unsupported XP account display format.'; end if;

  update public.xp_accounts
  set name = left(trim(p_display_name), 80),
      plural_name = left(trim(p_display_name_plural), 80),
      short_label = left(trim(p_short_label), 20),
      icon_url = left(trim(coalesce(p_icon, 'coins')), 200),
      display_name = left(trim(p_display_name), 80),
      display_name_plural = left(trim(p_display_name_plural), 80),
      icon = left(trim(coalesce(p_icon, 'coins')), 80),
      display_format = p_display_format,
      status = p_status,
      updated_at = now()
  where id = p_xp_account_id
  returning * into v_account;
  return v_account;
end;
$$;

revoke execute on function public.admin_update_xp_account_presentation(uuid, text, text, text, text, text, public.xp_account_status)
  from public, anon;
grant execute on function public.admin_update_xp_account_presentation(uuid, text, text, text, text, text, public.xp_account_status)
  to authenticated;

create or replace function public.admin_update_xp_account_presentation(
  p_xp_account_id uuid,
  p_display_name text,
  p_display_name_plural text,
  p_short_label text,
  p_icon text,
  p_display_format text
)
returns public.xp_accounts
language sql
security definer
set search_path = public
as $$
  select public.admin_update_xp_account_presentation(
    p_xp_account_id, p_display_name, p_display_name_plural, p_short_label,
    p_icon, p_display_format, 'active'::public.xp_account_status
  );
$$;

create or replace function public.admin_get_xp_account_overview(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
  v_circulation bigint;
  v_issuance bigint;
  v_redemptions bigint;
  v_adjustments bigint;
  v_rewards jsonb;
  v_history jsonb;
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

  select coalesce(sum(balance_cached), 0) into v_circulation
  from public.user_xp_balances where xp_account_id = v_account.id;
  select coalesce(sum(amount) filter (where direction = 'earn'), 0),
         coalesce(sum(amount) filter (where direction = 'spend'), 0),
         coalesce(sum(amount) filter (where source_type = 'adjustment'), 0)
    into v_issuance, v_redemptions, v_adjustments
  from public.xp_transactions where xp_account_id = v_account.id;

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
    'rewards', v_rewards,
    'transactions', v_history
  );
end;
$$;

revoke execute on function public.admin_get_xp_account_overview(uuid) from public, anon;
grant execute on function public.admin_get_xp_account_overview(uuid) to authenticated;

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values (
  'public', 'admin_get_xp_account_overview', 'p_organization_id uuid',
  'ADMIN_AUTHENTICATED', 'Organisation managers reading their scoped XP account operations.',
  'Requires organisation management access and returns only the selected organisation account.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set authorization_rule = excluded.authorization_rule,
    reviewed_at = now();
