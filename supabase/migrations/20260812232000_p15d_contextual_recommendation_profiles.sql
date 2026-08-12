alter table public.user_assessment_attempts
  add column if not exists organization_id uuid references public.organizations(id);

create index if not exists user_assessment_attempts_context_idx
  on public.user_assessment_attempts(user_id, organization_id, programme_id, completed_at desc);

alter table public.user_value_profiles
  add column if not exists id uuid,
  add column if not exists context_scope text not null default 'platform',
  add column if not exists organization_id uuid references public.organizations(id);

update public.user_value_profiles
set id = coalesce(id, gen_random_uuid()),
    context_scope = coalesce(nullif(context_scope, ''), 'platform')
where id is null or context_scope is null or context_scope = '';

alter table public.user_value_profiles
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.user_value_profiles
  drop constraint if exists user_value_profiles_context_check;

alter table public.user_value_profiles
  add constraint user_value_profiles_context_check
  check (
    (context_scope = 'platform' and organization_id is null)
    or
    (context_scope = 'organization' and organization_id is not null)
  );

alter table public.user_value_profiles
  drop constraint if exists user_value_profiles_pkey;

alter table public.user_value_profiles
  add constraint user_value_profiles_pkey primary key (id);

alter table public.user_value_profiles
  drop constraint if exists user_value_profiles_context_key;

alter table public.user_value_profiles
  add constraint user_value_profiles_context_key
  unique nulls not distinct (user_id, context_scope, organization_id);

create index if not exists user_value_profiles_context_lookup_idx
  on public.user_value_profiles(user_id, context_scope, organization_id);

alter table public.user_value_dimension_scores
  add column if not exists id uuid,
  add column if not exists context_scope text not null default 'platform',
  add column if not exists organization_id uuid references public.organizations(id);

update public.user_value_dimension_scores
set id = coalesce(id, gen_random_uuid()),
    context_scope = coalesce(nullif(context_scope, ''), 'platform')
where id is null or context_scope is null or context_scope = '';

alter table public.user_value_dimension_scores
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.user_value_dimension_scores
  drop constraint if exists user_value_dimension_scores_context_check;

alter table public.user_value_dimension_scores
  add constraint user_value_dimension_scores_context_check
  check (
    (context_scope = 'platform' and organization_id is null)
    or
    (context_scope = 'organization' and organization_id is not null)
  );

alter table public.user_value_dimension_scores
  drop constraint if exists user_value_dimension_scores_pkey;

alter table public.user_value_dimension_scores
  add constraint user_value_dimension_scores_pkey
  primary key (id);

alter table public.user_value_dimension_scores
  drop constraint if exists user_value_dimension_scores_context_key;

alter table public.user_value_dimension_scores
  add constraint user_value_dimension_scores_context_key
  unique nulls not distinct (user_id, context_scope, organization_id, dimension_id);

create index if not exists user_value_dimension_scores_context_lookup_idx
  on public.user_value_dimension_scores(user_id, context_scope, organization_id);

create or replace function public.complete_values_assessment_legacy(
  p_assessment_version_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform_xp_account_id constant uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_user_id uuid := auth.uid();
  v_assessment public.assessment_versions%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_started_at timestamptz := now();
  v_completed_at timestamptz := now();
  v_total_questions integer := 0;
  v_submitted_count integer := 0;
  v_distinct_question_count integer := 0;
  v_primary_dimension_id text;
  v_secondary_dimension_id text;
  v_primary_dimension_label text;
  v_secondary_dimension_label text;
  v_average_score numeric := 0;
  v_readiness_level text := 'beginner';
  v_profile_summary jsonb := '{}'::jsonb;
  v_dimension_scores jsonb := '[]'::jsonb;
  v_award_scope text;
  v_xp_transaction_id uuid;
  v_xp_awarded integer := 0;
  v_context_scope text := coalesce(nullif(current_setting('app.assessment_context_scope', true), ''), 'platform');
  v_organization_id uuid := nullif(current_setting('app.assessment_organization_id', true), '')::uuid;
  v_programme_id uuid := nullif(current_setting('app.xp_programme_id', true), '')::uuid;
  v_attempt_xp_account_id uuid := coalesce(nullif(current_setting('app.xp_account_id', true), '')::uuid, v_platform_xp_account_id);
begin
  if v_user_id is null then
    raise exception 'You must be signed in to complete the Values Starter Check.';
  end if;

  if v_context_scope not in ('platform', 'organization') then
    raise exception 'Assessment context is invalid.';
  end if;

  if v_context_scope = 'platform' and v_organization_id is not null then
    raise exception 'Platform assessments cannot carry organisation context.';
  end if;

  if v_context_scope = 'organization' and v_organization_id is null then
    raise exception 'Organisation assessments require organisation context.';
  end if;

  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Assessment answers are invalid.';
  end if;

  select *
    into v_assessment
  from public.assessment_versions
  where id = p_assessment_version_id
    and status = 'published';

  if not found then
    raise exception 'This assessment is not available right now.';
  end if;

  select count(*)
    into v_total_questions
  from public.assessment_questions
  where assessment_version_id = v_assessment.id;

  if v_total_questions = 0 then
    raise exception 'This assessment is not ready yet.';
  end if;

  with submitted_answers as (
    select
      nullif(trim(question_id), '')::uuid as question_id,
      nullif(trim(option_id), '')::uuid as option_id
    from jsonb_to_recordset(p_answers) as submitted(question_id text, option_id text)
  )
  select count(*), count(distinct question_id)
    into v_submitted_count, v_distinct_question_count
  from submitted_answers;

  if v_submitted_count <> v_total_questions or v_distinct_question_count <> v_total_questions then
    raise exception 'Please answer every question before continuing.';
  end if;

  if exists (
    with submitted_answers as (
      select
        nullif(trim(question_id), '')::uuid as question_id,
        nullif(trim(option_id), '')::uuid as option_id
      from jsonb_to_recordset(p_answers) as submitted(question_id text, option_id text)
    )
    select 1
    from submitted_answers
    where question_id is null or option_id is null
  ) then
    raise exception 'Assessment answers are invalid.';
  end if;

  if exists (
    with submitted_answers as (
      select
        nullif(trim(question_id), '')::uuid as question_id,
        nullif(trim(option_id), '')::uuid as option_id
      from jsonb_to_recordset(p_answers) as submitted(question_id text, option_id text)
    )
    select 1
    from submitted_answers answer
    left join public.assessment_questions question
      on question.id = answer.question_id
     and question.assessment_version_id = v_assessment.id
    where question.id is null
  ) then
    raise exception 'Assessment questions do not match this check.';
  end if;

  if exists (
    with submitted_answers as (
      select
        nullif(trim(question_id), '')::uuid as question_id,
        nullif(trim(option_id), '')::uuid as option_id
      from jsonb_to_recordset(p_answers) as submitted(question_id text, option_id text)
    )
    select 1
    from submitted_answers answer
    left join public.assessment_question_options option
      on option.id = answer.option_id
     and option.question_id = answer.question_id
    where option.id is null
  ) then
    raise exception 'One or more selected answers are invalid.';
  end if;

  insert into public.user_assessment_attempts (
    id,
    user_id,
    assessment_version_id,
    status,
    started_at,
    completed_at,
    organization_id,
    programme_id,
    xp_account_id
  ) values (
    v_attempt_id,
    v_user_id,
    v_assessment.id,
    'completed',
    v_started_at,
    v_completed_at,
    v_organization_id,
    v_programme_id,
    v_attempt_xp_account_id
  );

  insert into public.user_assessment_answers (
    attempt_id,
    question_id,
    option_id
  )
  select
    v_attempt_id,
    answer.question_id,
    answer.option_id
  from (
    select
      nullif(trim(question_id), '')::uuid as question_id,
      nullif(trim(option_id), '')::uuid as option_id
    from jsonb_to_recordset(p_answers) as submitted(question_id text, option_id text)
  ) as answer;

  with assessment_questions as (
    select id
    from public.assessment_questions
    where assessment_version_id = v_assessment.id
  ),
  dimensions as (
    select id, label, sort_order
    from public.value_dimensions
    where status = 'active'
  ),
  question_dimension_max as (
    select
      question.id as question_id,
      dimension.id as dimension_id,
      coalesce(max(weight.weight), 0) as max_weight
    from assessment_questions question
    cross join dimensions dimension
    left join public.assessment_question_options option
      on option.question_id = question.id
    left join public.assessment_option_dimension_weights weight
      on weight.option_id = option.id
     and weight.dimension_id = dimension.id
    group by question.id, dimension.id
  ),
  dimension_max as (
    select
      dimension_id,
      sum(max_weight) as max_possible_score
    from question_dimension_max
    group by dimension_id
  ),
  raw_scores as (
    select
      dimension.id as dimension_id,
      coalesce(sum(weight.weight), 0) as raw_score
    from dimensions dimension
    left join public.user_assessment_answers answer
      on answer.attempt_id = v_attempt_id
    left join public.assessment_option_dimension_weights weight
      on weight.option_id = answer.option_id
     and weight.dimension_id = dimension.id
    group by dimension.id
  ),
  normalized_scores as (
    select
      dimension.id as dimension_id,
      dimension.label,
      dimension.sort_order,
      round(
        case
          when coalesce(dimension_max.max_possible_score, 0) > 0
            then greatest(0::numeric, least(1::numeric, raw_scores.raw_score / dimension_max.max_possible_score))
          else 0::numeric
        end,
        4
      ) as score,
      case
        when coalesce(dimension_max.max_possible_score, 0) > 0 then 1::numeric
        else 0.2::numeric
      end as confidence
    from dimensions dimension
    left join raw_scores
      on raw_scores.dimension_id = dimension.id
    left join dimension_max
      on dimension_max.dimension_id = dimension.id
  )
  insert into public.user_value_dimension_scores (
    user_id,
    context_scope,
    organization_id,
    dimension_id,
    score,
    confidence,
    updated_at
  )
  select
    v_user_id,
    v_context_scope,
    v_organization_id,
    dimension_id,
    score,
    confidence,
    now()
  from normalized_scores
  on conflict on constraint user_value_dimension_scores_context_key do update
    set score = excluded.score,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at;

  with ranked_scores as (
    select
      score.dimension_id,
      score.score,
      dimension.label,
      dimension.sort_order
    from public.user_value_dimension_scores score
    join public.value_dimensions dimension
      on dimension.id = score.dimension_id
    where score.user_id = v_user_id
      and score.context_scope = v_context_scope
      and score.organization_id is not distinct from v_organization_id
      and dimension.status = 'active'
    order by score.score asc, dimension.sort_order asc
  )
  select
    max(case when row_number = 1 then dimension_id end),
    max(case when row_number = 2 then dimension_id end),
    max(case when row_number = 1 then label end),
    max(case when row_number = 2 then label end)
    into v_primary_dimension_id, v_secondary_dimension_id, v_primary_dimension_label, v_secondary_dimension_label
  from (
    select
      dimension_id,
      label,
      row_number() over (order by score asc, sort_order asc) as row_number
    from ranked_scores
  ) ranked;

  select coalesce(avg(score), 0)
    into v_average_score
  from public.user_value_dimension_scores
  where user_id = v_user_id
    and context_scope = v_context_scope
    and organization_id is not distinct from v_organization_id;

  v_readiness_level := case
    when v_average_score < 0.45 then 'beginner'
    when v_average_score < 0.70 then 'intermediate'
    else 'advanced'
  end;

  v_profile_summary := jsonb_build_object(
    'title', 'Your learning path is ready',
    'message', 'We''ll recommend lessons that help you build stronger choices, safer relationships, and positive community habits.',
    'recommended_focus_labels', to_jsonb(array_remove(array[v_primary_dimension_label, v_secondary_dimension_label], null)),
    'readiness_label', initcap(v_readiness_level),
    'learner_safe_summary', case
      when v_readiness_level = 'advanced'
        then 'Keep building with deeper lessons and practical missions that help you lead by example and make responsible decisions in real situations.'
      when v_readiness_level = 'intermediate'
        then 'Build on what you already know with practical lessons and scenarios that strengthen everyday judgment, relationships, and positive action.'
      else 'Start with simple, practical lessons and scenarios that build confidence step by step.'
    end
  );

  insert into public.user_value_profiles (
    user_id,
    context_scope,
    organization_id,
    latest_attempt_id,
    assessment_version_id,
    assessment_completed_at,
    readiness_level,
    primary_dimension_id,
    secondary_dimension_id,
    profile_summary,
    updated_at
  ) values (
    v_user_id,
    v_context_scope,
    v_organization_id,
    v_attempt_id,
    v_assessment.id,
    v_completed_at,
    v_readiness_level,
    v_primary_dimension_id,
    v_secondary_dimension_id,
    v_profile_summary,
    now()
  )
  on conflict on constraint user_value_profiles_context_key do update
    set latest_attempt_id = excluded.latest_attempt_id,
        assessment_version_id = excluded.assessment_version_id,
        assessment_completed_at = excluded.assessment_completed_at,
        readiness_level = excluded.readiness_level,
        primary_dimension_id = excluded.primary_dimension_id,
        secondary_dimension_id = excluded.secondary_dimension_id,
        profile_summary = excluded.profile_summary,
        updated_at = excluded.updated_at;

  v_award_scope := 'assessment:' || v_assessment.slug;

  if v_assessment.xp_award > 0 then
    insert into public.xp_transactions (
      id,
      user_id,
      xp_account_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_platform_xp_account_id,
      v_assessment.xp_award,
      'earn',
      'assessment',
      v_assessment.slug,
      v_award_scope,
      jsonb_build_object(
        'kind', 'values_assessment',
        'assessmentVersionId', v_assessment.id,
        'assessmentSlug', v_assessment.slug,
        'attemptId', v_attempt_id,
        'contextScope', v_context_scope,
        'organizationId', v_organization_id,
        'programmeId', v_programme_id,
        'xpAccountId', v_attempt_xp_account_id
      )
    )
    on conflict (user_id, xp_account_id, award_scope)
      where direction = 'earn' and award_scope is not null
      do nothing
    returning id into v_xp_transaction_id;

    if v_xp_transaction_id is not null then
      v_xp_awarded := v_assessment.xp_award;

      update public.profiles
      set xp = xp + v_assessment.xp_award,
          xp_balance_cached = xp_balance_cached + v_assessment.xp_award
      where id = v_user_id;
    end if;
  end if;

  if v_xp_transaction_id is not null then
    update public.user_assessment_attempts
    set xp_transaction_id = v_xp_transaction_id
    where id = v_attempt_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'dimension_id', score.dimension_id,
        'label', dimension.label,
        'score', score.score,
        'confidence', score.confidence
      )
      order by dimension.sort_order
    ),
    '[]'::jsonb
  )
    into v_dimension_scores
  from public.user_value_dimension_scores score
  join public.value_dimensions dimension
    on dimension.id = score.dimension_id
  where score.user_id = v_user_id
    and score.context_scope = v_context_scope
    and score.organization_id is not distinct from v_organization_id
    and dimension.status = 'active';

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'xp_awarded', v_xp_awarded,
    'readiness_level', v_readiness_level,
    'primary_dimension_id', v_primary_dimension_id,
    'secondary_dimension_id', v_secondary_dimension_id,
    'dimension_scores', v_dimension_scores,
    'profile_summary', v_profile_summary,
    'context_scope', v_context_scope,
    'organization_id', v_organization_id
  );
end;
$$;

create or replace function public.complete_values_assessment(
  p_assessment_version_id uuid,
  p_answers jsonb,
  p_programme_id uuid
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
  v_organization_id uuid;
begin
  if p_programme_id is not null then
    select organization_id
      into v_organization_id
    from public.programmes
    where id = p_programme_id;

    if v_organization_id is null then
      raise exception 'Programme context is invalid.';
    end if;

    v_account_id := private.resolve_programme_xp_account(
      v_user_id, p_programme_id, 'assessment', p_assessment_version_id::text
    );
    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', p_programme_id::text, true);
    perform set_config('app.assessment_context_scope', 'organization', true);
    perform set_config('app.assessment_organization_id', v_organization_id::text, true);
  else
    perform set_config('app.xp_account_id', '', true);
    perform set_config('app.xp_programme_id', '', true);
    perform set_config('app.assessment_context_scope', 'platform', true);
    perform set_config('app.assessment_organization_id', '', true);
  end if;

  begin
    v_result := public.complete_values_assessment_legacy(p_assessment_version_id, p_answers);
  exception when others then
    perform set_config('app.xp_account_id', '', true);
    perform set_config('app.xp_programme_id', '', true);
    perform set_config('app.assessment_context_scope', '', true);
    perform set_config('app.assessment_organization_id', '', true);
    raise;
  end;

  perform set_config('app.xp_account_id', '', true);
  perform set_config('app.xp_programme_id', '', true);
  perform set_config('app.assessment_context_scope', '', true);
  perform set_config('app.assessment_organization_id', '', true);

  return v_result || jsonb_build_object(
    'programme_id', p_programme_id,
    'organization_id', v_organization_id,
    'xp_account_id', v_account_id
  );
end;
$$;

create or replace function public.complete_values_assessment(
  p_assessment_version_id uuid,
  p_answers jsonb
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.complete_values_assessment(p_assessment_version_id, p_answers, null);
$$;

revoke execute on function public.complete_values_assessment_legacy(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.complete_values_assessment(uuid, jsonb, uuid) from public, anon;
revoke execute on function public.complete_values_assessment(uuid, jsonb) from public, anon;
grant execute on function public.complete_values_assessment(uuid, jsonb, uuid) to authenticated;
grant execute on function public.complete_values_assessment(uuid, jsonb) to authenticated;
