-- Scoped XP settings: real organisations store entitlement overrides while the
-- Platform Catalog continues to own the platform-wide fallback row.

create or replace function private.organization_entitlements_are_valid(
  p_entitlements jsonb,
  p_require_all boolean default true
)
returns boolean
language plpgsql
immutable
set search_path = public, private
as $$
declare
  v_required_keys text[] := array[
    'max_courses',
    'max_total_lessons',
    'allowed_lesson_block_types',
    'max_storage_bytes',
    'ai_authoring_enabled',
    'max_active_missions',
    'allowed_mission_types',
    'allowed_mission_reward_modes',
    'max_xp_accounts',
    'max_active_rewards',
    'allowed_reward_fulfillment_types',
    'max_open_reward_claims',
    'max_fulfilled_reward_claims_per_month',
    'assessment_capability',
    'reporting_level'
  ];
  v_optional_keys text[] := array[
    'ai_monthly_allocation',
    'ai_temporary_allocation',
    'ai_top_up_allocation',
    'ai_warning_threshold',
    'ai_hard_limit',
    'ai_user_rate_limit_per_day',
    'ai_organization_concurrency_limit',
    'allowed_ai_operation_types',
    'allowed_ai_roles',
    'daily_quiz_xp_limit',
    'admin_manual_grant_daily_limit'
  ];
  v_key text;
begin
  if p_entitlements is null or jsonb_typeof(p_entitlements) <> 'object' then
    return false;
  end if;

  if p_require_all then
    foreach v_key in array v_required_keys loop
      if not p_entitlements ? v_key then
        return false;
      end if;
    end loop;
  end if;

  for v_key in select jsonb_object_keys(p_entitlements) loop
    if v_key <> all(v_required_keys) and v_key <> all(v_optional_keys) then
      return false;
    end if;

    if v_key in (
      'max_courses',
      'max_total_lessons',
      'max_storage_bytes',
      'max_active_missions',
      'max_xp_accounts',
      'max_active_rewards',
      'max_open_reward_claims',
      'max_fulfilled_reward_claims_per_month',
      'ai_monthly_allocation',
      'ai_temporary_allocation',
      'ai_top_up_allocation',
      'ai_warning_threshold',
      'ai_hard_limit',
      'ai_user_rate_limit_per_day',
      'ai_organization_concurrency_limit'
    ) then
      if jsonb_typeof(p_entitlements -> v_key) <> 'number'
         or (p_entitlements ->> v_key)::numeric < 0 then
        return false;
      end if;
    elsif v_key in ('daily_quiz_xp_limit', 'admin_manual_grant_daily_limit') then
      if jsonb_typeof(p_entitlements -> v_key) <> 'number'
         or (p_entitlements ->> v_key)::numeric < 0
         or trunc((p_entitlements ->> v_key)::numeric) <> (p_entitlements ->> v_key)::numeric
         or (p_entitlements ->> v_key)::numeric > 2147483647 then
        return false;
      end if;
    elsif v_key = 'ai_authoring_enabled' then
      if jsonb_typeof(p_entitlements -> v_key) <> 'boolean' then
        return false;
      end if;
    elsif v_key in (
      'allowed_lesson_block_types',
      'allowed_mission_types',
      'allowed_mission_reward_modes',
      'allowed_reward_fulfillment_types',
      'allowed_ai_operation_types',
      'allowed_ai_roles'
    ) then
      if jsonb_typeof(p_entitlements -> v_key) <> 'array' then
        return false;
      end if;
    elsif v_key in ('assessment_capability', 'reporting_level') then
      if jsonb_typeof(p_entitlements -> v_key) <> 'string'
         or length(trim(p_entitlements ->> v_key)) = 0 then
        return false;
      end if;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$$;

revoke execute on function private.organization_entitlements_are_valid(jsonb, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_workspace_xp_settings_unchecked(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_platform_daily_quiz_limit integer := 50;
  v_platform_manual_grant_limit integer := 500;
  v_entitlements jsonb := '{}'::jsonb;
  v_override_updated_at timestamptz;
begin
  select
    coalesce(default_daily_quiz_xp_limit, 50),
    coalesce(admin_manual_grant_daily_limit, 500)
  into v_platform_daily_quiz_limit, v_platform_manual_grant_limit
  from public.xp_settings
  where id = 1;

  if p_organization_id is not null then
    v_entitlements := private.resolve_organization_entitlements_unchecked(p_organization_id);

    select override.updated_at
    into v_override_updated_at
    from public.organization_entitlement_overrides override
    where override.organization_id = p_organization_id
      and override.ended_at is null
      and (
        override.entitlements ? 'daily_quiz_xp_limit'
        or override.entitlements ? 'admin_manual_grant_daily_limit'
      )
    order by override.starts_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'defaultDailyQuizXpLimit', coalesce(
      nullif(v_entitlements ->> 'daily_quiz_xp_limit', '')::integer,
      v_platform_daily_quiz_limit
    ),
    'adminManualGrantDailyLimit', coalesce(
      nullif(v_entitlements ->> 'admin_manual_grant_daily_limit', '')::integer,
      v_platform_manual_grant_limit
    ),
    'dailyQuizSource', case
      when p_organization_id is not null and v_entitlements ? 'daily_quiz_xp_limit'
        then 'workspace_override'
      else 'platform_default'
    end,
    'manualGrantSource', case
      when p_organization_id is not null and v_entitlements ? 'admin_manual_grant_daily_limit'
        then 'workspace_override'
      else 'platform_default'
    end,
    'updatedAt', case
      when p_organization_id is null then (
        select updated_at from public.xp_settings where id = 1
      )
      else v_override_updated_at
    end
  );
end;
$$;

revoke execute on function private.resolve_workspace_xp_settings_unchecked(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_xp_account_organization_id(
  p_xp_account_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select account.organization_id
  from public.xp_accounts account
  where account.id = p_xp_account_id;
$$;

revoke execute on function private.resolve_xp_account_organization_id(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_daily_quiz_xp_limit(
  p_xp_account_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    private.resolve_workspace_xp_settings_unchecked(
      private.resolve_xp_account_organization_id(p_xp_account_id)
    ) ->> 'defaultDailyQuizXpLimit'
  )::integer;
$$;

revoke execute on function private.resolve_daily_quiz_xp_limit(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.resolve_manual_grant_daily_limit(
  p_organization_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    private.resolve_workspace_xp_settings_unchecked(p_organization_id)
      ->> 'adminManualGrantDailyLimit'
  )::integer;
$$;

revoke execute on function private.resolve_manual_grant_daily_limit(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.admin_get_workspace_xp_settings(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_can_manage boolean := false;
  v_can_read boolean := false;
  v_settings jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    v_can_manage := public.current_user_can_manage_platform_catalog();
    v_can_read := public.current_user_is_admin()
      or public.current_user_has_platform_catalog_role(null);
  else
    v_can_manage := public.current_user_can_manage_organization(p_organization_id);
    v_can_read := public.current_user_is_admin()
      or public.current_user_has_organization_role(p_organization_id, null);
  end if;

  if not v_can_read then
    raise exception 'You cannot read XP settings for this workspace.' using errcode = '42501';
  end if;

  v_settings := private.resolve_workspace_xp_settings_unchecked(p_organization_id);
  return v_settings || jsonb_build_object(
    'canManage', v_can_manage,
    'organizationId', p_organization_id,
    'scope', case when p_organization_id is null then 'platform_catalog' else 'organization' end
  );
end;
$$;

create or replace function public.admin_save_workspace_xp_settings(
  p_organization_id uuid,
  p_default_daily_quiz_xp_limit integer,
  p_admin_manual_grant_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_override_id uuid;
  v_entitlement_delta jsonb := jsonb_build_object(
    'daily_quiz_xp_limit', p_default_daily_quiz_xp_limit,
    'admin_manual_grant_daily_limit', p_admin_manual_grant_daily_limit
  );
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_default_daily_quiz_xp_limit is null or p_default_daily_quiz_xp_limit < 0 then
    raise exception 'Default daily quiz XP limit must be 0 or more.';
  end if;

  if p_admin_manual_grant_daily_limit is null or p_admin_manual_grant_daily_limit < 0 then
    raise exception 'Admin manual grant daily limit must be 0 or more.';
  end if;

  if p_organization_id is null then
    if not public.current_user_can_manage_platform_catalog() then
      raise exception 'You cannot manage Platform Catalog XP settings.' using errcode = '42501';
    end if;

    update public.xp_settings
    set default_daily_quiz_xp_limit = p_default_daily_quiz_xp_limit,
        admin_manual_grant_daily_limit = p_admin_manual_grant_daily_limit,
        updated_at = now()
    where id = 1;

    if not found then
      insert into public.xp_settings (
        id,
        default_daily_quiz_xp_limit,
        admin_manual_grant_daily_limit,
        updated_at
      ) values (
        1,
        p_default_daily_quiz_xp_limit,
        p_admin_manual_grant_daily_limit,
        now()
      );
    end if;
  else
    if not public.current_user_can_manage_organization(p_organization_id) then
      raise exception 'You cannot manage XP settings for this organisation.' using errcode = '42501';
    end if;

    perform 1
    from public.organizations organization
    where organization.id = p_organization_id
    for update;

    if not found then
      raise exception 'Organisation does not exist.';
    end if;

    select override.id
    into v_override_id
    from public.organization_entitlement_overrides override
    where override.organization_id = p_organization_id
      and override.ended_at is null
    order by override.starts_at desc
    limit 1
    for update;

    if v_override_id is null then
      insert into public.organization_entitlement_overrides (
        organization_id,
        entitlements,
        reason,
        created_by
      ) values (
        p_organization_id,
        v_entitlement_delta,
        'Workspace XP settings',
        v_actor_id
      )
      returning id into v_override_id;
    else
      update public.organization_entitlement_overrides
      set entitlements = entitlements || v_entitlement_delta,
          reason = coalesce(reason, 'Workspace XP settings'),
          updated_at = now()
      where id = v_override_id;
    end if;
  end if;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    'workspace_xp_settings_updated',
    case when p_organization_id is null then 'platform_catalog' else 'organization' end,
    coalesce(p_organization_id::text, 'platform-catalog'),
    jsonb_build_object(
      'organizationId', p_organization_id,
      'defaultDailyQuizXpLimit', p_default_daily_quiz_xp_limit,
      'adminManualGrantDailyLimit', p_admin_manual_grant_daily_limit,
      'overrideId', v_override_id
    )
  );

  return public.admin_get_workspace_xp_settings(p_organization_id);
end;
$$;

revoke execute on function public.admin_get_workspace_xp_settings(uuid)
  from public, anon;
grant execute on function public.admin_get_workspace_xp_settings(uuid)
  to authenticated, service_role;

revoke execute on function public.admin_save_workspace_xp_settings(uuid, integer, integer)
  from public, anon;
grant execute on function public.admin_save_workspace_xp_settings(uuid, integer, integer)
  to authenticated, service_role;

-- The public account-aware wrapper sets app.xp_account_id before entering this
-- legacy implementation. Resolve the cap from that trusted account context.
create or replace function public.start_quiz_attempt_legacy(
  p_quiz_id text,
  p_lesson_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid := gen_random_uuid();
  v_quiz public.quizzes%rowtype;
  v_lesson public.lessons%rowtype;
  v_course public.courses%rowtype;
  v_last_ended_at timestamptz;
  v_page_count integer := 0;
  v_completed_count integer := 0;
  v_requires_fresh_reread boolean := false;
  v_retry_available_at timestamptz;
  v_daily_limit integer := 50;
  v_daily_earned integer := 0;
  v_daily_remaining integer := 0;
  v_unawarded_count integer := 0;
  v_question_ids text[] := '{}';
  v_mode public.quiz_attempt_mode := 'earning';
  v_seed text;
  v_total_possible_xp integer := 0;
  v_questions jsonb := '[]'::jsonb;
  v_account_id uuid := coalesce(
    nullif(current_setting('app.xp_account_id', true), '')::uuid,
    '00000000-0000-4000-8000-00000000e001'::uuid
  );
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_quiz
  from public.quizzes
  where id = p_quiz_id
    and status = 'published';

  if not found then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select *
    into v_lesson
  from public.lessons
  where id = v_quiz.lesson_id
    and status = 'published';

  if not found or (p_lesson_id is not null and p_lesson_id <> v_lesson.id) then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select *
    into v_course
  from public.courses
  where id = v_lesson.course_id
    and status = 'published';

  if not found then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select ended_at
    into v_last_ended_at
  from public.quiz_attempts
  where user_id = v_user_id
    and lesson_id = v_lesson.id
    and ended_at is not null
  order by ended_at desc
  limit 1;

  v_requires_fresh_reread := v_last_ended_at is not null
    and coalesce(v_lesson.retry_requires_reread, false);

  select count(*)
    into v_page_count
  from public.lesson_pages
  where lesson_id = v_lesson.id;

  select count(distinct lpc.page_id)
    into v_completed_count
  from public.lesson_page_completions lpc
  join public.lesson_pages lp
    on lp.id = lpc.page_id
   and lp.lesson_id = v_lesson.id
  where lpc.user_id = v_user_id
    and lpc.lesson_id = v_lesson.id
    and (
      not v_requires_fresh_reread
      or lpc.completed_at > v_last_ended_at
    );

  if coalesce(v_lesson.quiz_requires_lesson_completion, true)
    and v_completed_count < v_page_count
  then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', case
        when v_requires_fresh_reread then 'Please reread the lesson pages before retrying this quiz.'
        else 'Complete the lesson pages before starting the quiz.'
      end
    );
  end if;

  if v_lesson.retry_mode = 'disabled' and v_last_ended_at is not null then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'retry_disabled',
      'message', 'This lesson quiz can only be completed once.'
    );
  end if;

  if v_lesson.retry_mode = 'cooldown' and v_last_ended_at is not null then
    v_retry_available_at := v_last_ended_at
      + make_interval(secs => coalesce(v_lesson.retry_cooldown_seconds, 86400));

    if v_retry_available_at > now() then
      return jsonb_build_object(
        'status', 'blocked',
        'reason', 'cooldown',
        'message', 'Your progress is saved. This quiz unlocks again after the retry window.',
        'retryAvailableAt', v_retry_available_at
      );
    end if;
  end if;

  select coalesce(
    (
      select earnable_quiz_xp_limit
      from public.user_daily_xp_limits
      where user_id = v_user_id
        and local_date = (now() at time zone 'Africa/Lagos')::date
    ),
    private.resolve_daily_quiz_xp_limit(v_account_id)
  )
  into v_daily_limit;

  select coalesce(sum(amount), 0)
    into v_daily_earned
  from public.xp_transactions
  where user_id = v_user_id
    and xp_account_id = v_account_id
    and direction = 'earn'
    and source_type = 'quiz_question'
    and (created_at at time zone 'Africa/Lagos')::date =
      (now() at time zone 'Africa/Lagos')::date;

  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

  select count(*)
    into v_unawarded_count
  from public.quiz_questions qq
  where qq.quiz_id = v_quiz.id
    and not exists (
      select 1
      from public.xp_transactions xp
      where xp.user_id = v_user_id
        and xp.xp_account_id = v_account_id
        and xp.direction = 'earn'
        and xp.source_type = 'quiz_question'
        and xp.source_id = qq.id
    );

  v_mode := case
    when v_unawarded_count > 0 then 'earning'::public.quiz_attempt_mode
    else 'practice'::public.quiz_attempt_mode
  end;

  if v_mode = 'earning' then
    select coalesce(array_agg(id order by question_order), '{}')::text[]
      into v_question_ids
    from public.quiz_questions qq
    where qq.quiz_id = v_quiz.id
      and qq.xp <= v_daily_remaining
      and not exists (
        select 1
        from public.xp_transactions xp
        where xp.user_id = v_user_id
          and xp.xp_account_id = v_account_id
          and xp.direction = 'earn'
          and xp.source_type = 'quiz_question'
          and xp.source_id = qq.id
      );
  else
    select coalesce(array_agg(id order by question_order), '{}')::text[]
      into v_question_ids
    from public.quiz_questions
    where quiz_id = v_quiz.id;
  end if;

  if v_mode = 'earning' and coalesce(array_length(v_question_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'daily_cap_reached',
      'message', 'You have reached today''s quiz XP limit.',
      'nextResetAt', (
        ((now() at time zone 'Africa/Lagos')::date + interval '1 day')
          at time zone 'Africa/Lagos'
      )
    );
  end if;

  v_seed := v_quiz.id || ':' || v_attempt_id::text;

  insert into public.quiz_attempts (
    id,
    user_id,
    lesson_id,
    quiz_id,
    quiz_version,
    mode,
    status,
    seed
  ) values (
    v_attempt_id,
    v_user_id,
    v_lesson.id,
    v_quiz.id,
    v_quiz.version,
    v_mode,
    'in_progress',
    v_seed
  );

  insert into public.quiz_attempt_questions (
    attempt_id,
    question_id,
    question_order,
    question_snapshot,
    options_snapshot,
    xp
  )
  select
    v_attempt_id,
    qq.id,
    row_number() over (order by qq.question_order)::integer,
    jsonb_build_object(
      'id', qq.id,
      'prompt', qq.prompt,
      'type', qq.question_type,
      'xp', qq.xp,
      'order', qq.question_order
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', qo.id,
            'questionId', qo.question_id,
            'label', qo.label,
            'order', qo.option_order
          )
          order by qo.option_order
        )
        from public.quiz_options qo
        where qo.question_id = qq.id
      ),
      '[]'::jsonb
    ),
    qq.xp
  from public.quiz_questions qq
  where qq.id = any(v_question_ids)
  order by qq.question_order;

  select coalesce(sum(xp), 0)
    into v_total_possible_xp
  from public.quiz_attempt_questions
  where attempt_id = v_attempt_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', aq.question_id,
        'quizId', v_quiz.id,
        'prompt', aq.question_snapshot ->> 'prompt',
        'type', aq.question_snapshot ->> 'type',
        'xp', aq.xp,
        'order', aq.question_order,
        'options', aq.options_snapshot
      )
      order by aq.question_order
    ),
    '[]'::jsonb
  )
  into v_questions
  from public.quiz_attempt_questions aq
  where aq.attempt_id = v_attempt_id;

  return jsonb_build_object(
    'status', 'started',
    'attemptId', v_attempt_id,
    'mode', v_mode,
    'questions', v_questions,
    'dailyXpLimit', v_daily_limit,
    'dailyXpRemaining', v_daily_remaining,
    'totalPossibleXp', v_total_possible_xp
  );
end;
$$;

revoke execute on function public.start_quiz_attempt_legacy(text, text)
  from public, anon, authenticated, service_role;

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
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
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

  v_account_id := coalesce(
    v_attempt.xp_account_id,
    '00000000-0000-4000-8000-00000000e001'::uuid
  );

  if exists (
    select 1
    from public.quiz_answers
    where attempt_id = p_attempt_id
      and question_id = p_question_id
  ) then
    raise exception 'This question has already been answered.';
  end if;

  select xp, options_snapshot
  into v_question_xp, v_options_snapshot
  from public.quiz_attempt_questions
  where attempt_id = p_attempt_id
    and question_id = p_question_id;

  if v_question_xp is null then
    raise exception 'Question is not part of this attempt.';
  end if;

  select coalesce(array_agg(distinct option_id order by option_id), '{}')
  into v_selected_option_ids
  from unnest(coalesce(p_selected_option_ids, '{}')) as option_id;

  if coalesce(array_length(v_selected_option_ids, 1), 0) = 0 then
    raise exception 'At least one selected option is required.';
  end if;

  select exists (
    select 1
    from unnest(v_selected_option_ids) selected(option_id)
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(v_options_snapshot, '[]')) option_snapshot(value)
      where option_snapshot.value ->> 'id' = selected.option_id
    )
  )
  into v_has_invalid_option;

  if v_has_invalid_option then
    raise exception 'One or more selected options do not belong to this attempt question.';
  end if;

  select correct_option_ids
  into v_correct_option_ids
  from private.quiz_answer_keys
  where question_id = p_question_id;

  v_correct_option_ids := coalesce(v_correct_option_ids, '{}');
  v_is_correct := v_selected_option_ids = v_correct_option_ids;
  v_answer_correct := v_is_correct;

  if v_attempt.mode <> 'practice' and v_is_correct then
    perform pg_advisory_xact_lock(
      hashtextextended(
        v_user_id::text
          || ':quiz_xp:'
          || v_account_id::text
          || ':'
          || (now() at time zone 'Africa/Lagos')::date::text,
        0
      )
    );
  end if;

  select exists (
    select 1
    from public.xp_transactions
    where user_id = v_user_id
      and xp_account_id = v_account_id
      and direction = 'earn'
      and award_scope = v_award_scope
  )
  into v_already_awarded;

  select coalesce(
    (
      select earnable_quiz_xp_limit
      from public.user_daily_xp_limits
      where user_id = v_user_id
        and local_date = (now() at time zone 'Africa/Lagos')::date
    ),
    private.resolve_daily_quiz_xp_limit(v_account_id)
  )
  into v_daily_limit;

  select coalesce(sum(amount), 0)
  into v_daily_earned
  from public.xp_transactions
  where user_id = v_user_id
    and xp_account_id = v_account_id
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
      v_boost_bonus_xp := greatest(
        0,
        floor(v_question_xp * (v_boost.multiplier - 1))::integer
      );
      v_earned_xp := v_question_xp + v_boost_bonus_xp;
    end if;

    perform private.post_xp_transaction(
      v_user_id,
      'earn',
      v_base_earned_xp,
      'quiz_question',
      p_question_id,
      v_award_scope,
      jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id)
    );

    if v_boost_bonus_xp > 0 then
      perform private.post_xp_transaction(
        v_user_id,
        'earn',
        v_boost_bonus_xp,
        'reward_redemption',
        v_boost.redemption_id::text,
        'xp_boost:' || v_boost.id::text || ':' || p_question_id,
        jsonb_build_object(
          'attemptId', p_attempt_id,
          'quizId', v_attempt.quiz_id,
          'boostId', v_boost.id
        )
      );

      update public.user_xp_boosts
      set used_count = used_count + 1,
          status = case
            when remaining_uses is not null and used_count + 1 >= remaining_uses
              then 'consumed'
            else status
          end
      where id = v_boost.id;
    end if;
  end if;

  insert into public.quiz_answers (
    attempt_id,
    user_id,
    question_id,
    selected_option_ids,
    is_correct,
    earned_xp,
    status
  ) values (
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
      when v_attempt.mode = 'practice' then 'practice_completed'
      else 'graded'
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
    'dailyXpRemaining', greatest(
      0,
      v_daily_limit - v_daily_earned - v_base_earned_xp
    ),
    'nextResetAt', (
      ((now() at time zone 'Africa/Lagos')::date + interval '1 day')
        at time zone 'Africa/Lagos'
    )
  );
end;
$$;

create or replace function public.admin_adjust_xp_account(
  p_xp_account_id uuid,
  p_target_user_id uuid,
  p_amount integer,
  p_direction public.xp_direction,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_account public.xp_accounts%rowtype;
  v_transaction_id uuid;
  v_direction public.xp_direction := p_direction;
  v_source_id text := gen_random_uuid()::text;
  v_local_date date := (now() at time zone 'Africa/Lagos')::date;
  v_daily_limit integer := 500;
  v_granted_today integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_target_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'A positive adjustment amount and target learner are required.';
  end if;

  if v_direction not in ('earn', 'spend') then
    raise exception 'Adjustment direction is invalid.';
  end if;

  select *
  into v_account
  from public.xp_accounts
  where id = p_xp_account_id
    and status = 'active'
  for update;

  if not found or v_account.scope <> 'organization' then
    raise exception 'An active organisation XP account is required.';
  end if;

  if not public.current_user_is_admin()
     and not public.current_user_has_organization_role(
       v_account.organization_id,
       array['organisation_owner', 'organisation_admin']::public.organization_role_key[]
     ) then
    raise exception 'You cannot adjust this organisation XP account.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = v_account.organization_id
      and membership.user_id = p_target_user_id
      and membership.status = 'active'
  ) and not exists (
    select 1
    from public.enrolments enrolment
    join public.programmes programme
      on programme.id = enrolment.programme_id
    where enrolment.organization_id = v_account.organization_id
      and programme.organization_id = v_account.organization_id
      and enrolment.user_id = p_target_user_id
      and enrolment.status in ('active', 'completed')
  ) then
    raise exception 'The target learner is not active in this organisation.';
  end if;

  if v_direction = 'earn' then
    perform pg_advisory_xact_lock(
      hashtextextended(
        v_actor_id::text
          || ':manual_xp:'
          || v_account.organization_id::text
          || ':'
          || v_local_date::text,
        0
      )
    );

    v_daily_limit := private.resolve_manual_grant_daily_limit(v_account.organization_id);

    select coalesce(sum(xp_transaction.amount), 0)
    into v_granted_today
    from public.xp_transactions xp_transaction
    join public.xp_accounts account
      on account.id = xp_transaction.xp_account_id
    where account.organization_id = v_account.organization_id
      and xp_transaction.direction = 'earn'
      and xp_transaction.source_type = 'adjustment'
      and xp_transaction.metadata ->> 'adjustedBy' = v_actor_id::text
      and (xp_transaction.created_at at time zone 'Africa/Lagos')::date = v_local_date;

    if v_granted_today + p_amount > v_daily_limit then
      raise exception 'Daily admin grant limit reached. % XP remaining today.',
        greatest(v_daily_limit - v_granted_today, 0);
    end if;
  end if;

  v_transaction_id := private.post_xp_transaction(
    p_target_user_id,
    v_account.id,
    v_direction,
    p_amount,
    'adjustment',
    v_source_id,
    'admin_adjustment:' || v_source_id,
    jsonb_build_object(
      'kind', 'admin_manual_grant',
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'organizationId', v_account.organization_id,
      'xpAccountId', v_account.id,
      'adjustedBy', v_actor_id,
      'localDate', v_local_date
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
    'xp_account_adjusted',
    'xp_account',
    v_account.id::text,
    jsonb_build_object(
      'organizationId', v_account.organization_id,
      'targetUserId', p_target_user_id,
      'amount', p_amount,
      'direction', v_direction,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'transactionId', v_transaction_id,
      'dailyLimit', case when v_direction = 'earn' then v_daily_limit else null end
    )
  );

  return jsonb_build_object(
    'transactionId', v_transaction_id,
    'xpAccountId', v_account.id,
    'dailyLimit', case when v_direction = 'earn' then v_daily_limit else null end,
    'remainingToday', case
      when v_direction = 'earn'
        then greatest(v_daily_limit - v_granted_today - p_amount, 0)
      else null
    end
  );
end;
$$;

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
    'admin_get_workspace_xp_settings',
    'p_organization_id uuid',
    'ADMIN_AUTHENTICATED',
    'Platform Catalog staff and organisation workspace staff reading effective XP settings.',
    'Requires catalog staff access for the null catalog scope or active membership in the requested organisation; returns only that scope.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_save_workspace_xp_settings',
    'p_organization_id uuid, p_default_daily_quiz_xp_limit integer, p_admin_manual_grant_daily_limit integer',
    'ADMIN_AUTHENTICATED',
    'Platform Catalog owners/admins and organisation owners/admins saving scoped XP settings.',
    'Requires current_user_can_manage_platform_catalog() for the catalog default or current_user_can_manage_organization() for the requested organisation.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
