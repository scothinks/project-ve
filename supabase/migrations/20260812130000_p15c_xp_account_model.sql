do $$ begin
  create type public.xp_account_scope as enum (
    'platform',
    'organization'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.xp_account_status as enum (
    'active',
    'archived'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.xp_accounts (
  id uuid primary key default gen_random_uuid(),
  scope public.xp_account_scope not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  plural_name text not null check (length(trim(plural_name)) > 0),
  short_label text not null check (length(trim(short_label)) > 0),
  icon_url text,
  status public.xp_account_status not null default 'active',
  is_default boolean not null default false,
  accounting_currency text not null default 'XP' check (length(trim(accounting_currency)) > 0),
  accounting_value_per_unit numeric(12, 4) not null default 0 check (accounting_value_per_unit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint xp_accounts_scope_organization_consistency check (
    (scope = 'platform' and organization_id is null)
    or (scope = 'organization' and organization_id is not null)
  )
);

insert into public.xp_accounts (
  id,
  scope,
  organization_id,
  name,
  plural_name,
  short_label,
  status,
  is_default,
  accounting_currency,
  accounting_value_per_unit
)
values (
  '00000000-0000-4000-8000-00000000e001'::uuid,
  'platform',
  null,
  'Project Ve XP',
  'Project Ve XP',
  'XP',
  'active',
  true,
  'XP',
  0
)
on conflict (id) do update
  set scope = excluded.scope,
      organization_id = excluded.organization_id,
      name = excluded.name,
      plural_name = excluded.plural_name,
      short_label = excluded.short_label,
      status = excluded.status,
      is_default = excluded.is_default,
      accounting_currency = excluded.accounting_currency,
      accounting_value_per_unit = excluded.accounting_value_per_unit,
      updated_at = now();

insert into public.xp_accounts (
  scope,
  organization_id,
  name,
  plural_name,
  short_label,
  status,
  is_default,
  accounting_currency,
  accounting_value_per_unit
)
select
  'organization'::public.xp_account_scope,
  organization.id,
  organization.name || ' Points',
  organization.name || ' Points',
  'PTS',
  'active'::public.xp_account_status,
  true,
  'XP',
  0
from public.organizations organization
where not exists (
  select 1
  from public.xp_accounts account
  where account.organization_id = organization.id
    and account.scope = 'organization'
    and account.status = 'active'
    and account.is_default
);

create unique index if not exists xp_accounts_one_default_platform_idx
  on public.xp_accounts(is_default)
  where scope = 'platform' and status = 'active' and is_default;

create unique index if not exists xp_accounts_one_default_organization_idx
  on public.xp_accounts(organization_id)
  where scope = 'organization' and status = 'active' and is_default;

create index if not exists xp_accounts_organization_status_idx
  on public.xp_accounts(organization_id, status)
  where scope = 'organization';

drop trigger if exists xp_accounts_set_updated_at on public.xp_accounts;
create trigger xp_accounts_set_updated_at
  before update on public.xp_accounts
  for each row execute function public.set_updated_at();

create or replace function private.ensure_default_organization_xp_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.xp_accounts (
    scope,
    organization_id,
    name,
    plural_name,
    short_label,
    status,
    is_default,
    accounting_currency,
    accounting_value_per_unit
  )
  values (
    'organization',
    new.id,
    new.name || ' Points',
    new.name || ' Points',
    'PTS',
    'active',
    true,
    'XP',
    0
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function private.ensure_default_organization_xp_account()
  from public, anon, authenticated, service_role;

drop trigger if exists organizations_ensure_default_xp_account on public.organizations;
create trigger organizations_ensure_default_xp_account
  after insert on public.organizations
  for each row execute function private.ensure_default_organization_xp_account();

alter table public.xp_accounts enable row level security;

create or replace function private.current_user_can_read_xp_account(
  p_scope public.xp_account_scope,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      p_scope = 'platform'
      or exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.role = 'admin'
      )
      or exists (
        select 1
        from public.organization_memberships membership
        where membership.organization_id = p_organization_id
          and membership.user_id = auth.uid()
          and membership.status = 'active'
      )
      or public.current_user_can_enter_organization(p_organization_id)
    );
$$;

revoke execute on function private.current_user_can_read_xp_account(public.xp_account_scope, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.current_user_can_read_xp_account(public.xp_account_scope, uuid)
  to anon, authenticated, service_role;

drop policy if exists "XP accounts are readable by account participants" on public.xp_accounts;
create policy "XP accounts are readable by account participants"
  on public.xp_accounts for select
  using (private.current_user_can_read_xp_account(scope, organization_id));

alter table public.xp_transactions
  add column if not exists xp_account_id uuid;

update public.xp_transactions
set xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
where xp_account_id is null;

alter table public.xp_transactions
  alter column xp_account_id set default '00000000-0000-4000-8000-00000000e001'::uuid,
  alter column xp_account_id set not null;

do $$ begin
  alter table public.xp_transactions
    add constraint xp_transactions_xp_account_id_fkey
    foreign key (xp_account_id)
    references public.xp_accounts(id)
    on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists xp_transactions_account_user_created_idx
  on public.xp_transactions(xp_account_id, user_id, created_at desc);

drop index if exists public.xp_transactions_unique_award_scope;

create unique index xp_transactions_unique_award_scope
  on public.xp_transactions (user_id, xp_account_id, award_scope)
  where direction = 'earn' and award_scope is not null;

create or replace function private.post_xp_transaction(
  p_user_id uuid,
  p_direction public.xp_direction,
  p_amount integer,
  p_source_type public.xp_source_type,
  p_source_id text,
  p_award_scope text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform_xp_account_id constant uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_transaction_id uuid;
  v_inserted boolean := false;
begin
  if p_user_id is null then
    raise exception 'XP user is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'XP amount must be positive.';
  end if;

  if p_direction is null then
    raise exception 'XP direction is required.';
  end if;

  if p_source_type is null or nullif(trim(coalesce(p_source_id, '')), '') is null then
    raise exception 'XP source is required.';
  end if;

  if p_direction = 'earn' and nullif(trim(coalesce(p_award_scope, '')), '') is not null then
    insert into public.xp_transactions (
      user_id,
      xp_account_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      p_user_id,
      v_platform_xp_account_id,
      p_amount,
      p_direction,
      p_source_type,
      p_source_id,
      p_award_scope,
      coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id, xp_account_id, award_scope)
      where direction = 'earn' and award_scope is not null
      do nothing
    returning id into v_transaction_id;

    v_inserted := v_transaction_id is not null;

    if v_transaction_id is null then
      select id
        into v_transaction_id
      from public.xp_transactions
      where user_id = p_user_id
        and xp_account_id = v_platform_xp_account_id
        and direction = 'earn'
        and award_scope = p_award_scope;
    end if;
  else
    insert into public.xp_transactions (
      user_id,
      xp_account_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      p_user_id,
      v_platform_xp_account_id,
      p_amount,
      p_direction,
      p_source_type,
      p_source_id,
      p_award_scope,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_transaction_id;

    v_inserted := true;
  end if;

  if v_inserted then
    update public.profiles
    set xp = greatest(0, xp + case when p_direction = 'earn' then p_amount else -p_amount end),
        xp_balance_cached = greatest(
          0,
          xp_balance_cached + case when p_direction = 'earn' then p_amount else -p_amount end
        ),
        updated_at = now()
    where id = p_user_id;

    if not found then
      raise exception 'XP profile not found.';
    end if;
  end if;

  return v_transaction_id;
end;
$$;

revoke execute on function private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.complete_values_assessment(
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
begin
  if v_user_id is null then
    raise exception 'You must be signed in to complete the Values Starter Check.';
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
    completed_at
  ) values (
    v_attempt_id,
    v_user_id,
    v_assessment.id,
    'completed',
    v_started_at,
    v_completed_at
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
    dimension_id,
    score,
    confidence,
    updated_at
  )
  select
    v_user_id,
    dimension_id,
    score,
    confidence,
    now()
  from normalized_scores
  on conflict (user_id, dimension_id) do update
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
  where user_id = v_user_id;

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
    v_attempt_id,
    v_assessment.id,
    v_completed_at,
    v_readiness_level,
    v_primary_dimension_id,
    v_secondary_dimension_id,
    v_profile_summary,
    now()
  )
  on conflict (user_id) do update
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
        'xpAccountId', v_platform_xp_account_id
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
    and dimension.status = 'active';

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'xp_awarded', v_xp_awarded,
    'readiness_level', v_readiness_level,
    'primary_dimension_id', v_primary_dimension_id,
    'secondary_dimension_id', v_secondary_dimension_id,
    'dimension_scores', v_dimension_scores,
    'profile_summary', v_profile_summary
  );
end;
$$;

grant execute on function public.complete_values_assessment(uuid, jsonb) to authenticated;

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
  v_platform_xp_account_id constant uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
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
  v_context jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_organization_id uuid := nullif(v_context ->> 'organizationId', '')::uuid;
  v_programme_id uuid := nullif(v_context ->> 'programmeId', '')::uuid;
  v_programme_mission_id text := nullif(trim(coalesce(v_context ->> 'programmeMissionId', '')), '');
  v_xp_account_id uuid := nullif(v_context ->> 'xpAccountId', '')::uuid;
  v_effective_reward_xp integer;
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

  v_effective_reward_xp := greatest(
    1,
    coalesce(nullif(v_context ->> 'rewardXpOverride', '')::integer, v_mission.reward_xp, 1)
  );

  if v_mission.reward_type = 'xp' then
    if v_xp_account_id is not null and v_xp_account_id <> v_platform_xp_account_id then
      raise exception 'Account-aware mission XP is not enabled yet.';
    end if;

    insert into public.xp_transactions (
      user_id,
      xp_account_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      p_user_id,
      v_platform_xp_account_id,
      v_effective_reward_xp,
      'earn',
      'mission',
      v_mission.id,
      'mission:' || v_mission.id || ':' || p_award_scope,
      v_context || jsonb_build_object(
        'missionId', v_mission.id,
        'awardScope', p_award_scope,
        'organizationId', v_organization_id,
        'programmeId', v_programme_id,
        'programmeMissionId', v_programme_mission_id,
        'xpAccountId', v_platform_xp_account_id,
        'awardedXp', v_effective_reward_xp
      )
    )
    on conflict (user_id, xp_account_id, award_scope)
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
      xp_transaction_id,
      organization_id,
      programme_id,
      programme_mission_id,
      xp_account_id
    )
    values (
      p_user_id,
      v_mission.id,
      p_award_scope,
      v_transaction_id,
      v_organization_id,
      v_programme_id,
      v_programme_mission_id,
      v_platform_xp_account_id
    );

    perform private.increment_profile_xp(p_user_id, v_effective_reward_xp);

    return jsonb_build_object(
      'status', 'awarded',
      'missionId', v_mission.id,
      'awardScope', p_award_scope,
      'rewardType', 'xp',
      'awardedXp', v_effective_reward_xp,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id
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
    v_context || jsonb_build_object(
      'missionId', v_mission.id,
      'rewardGrantedBy', 'mission',
      'awardScope', p_award_scope,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id,
      'xpAccountId', v_xp_account_id
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
    reward_redemption_id,
    organization_id,
    programme_id,
    programme_mission_id,
    xp_account_id
  )
  values (
    p_user_id,
    v_mission.id,
    p_award_scope,
    v_redemption_id,
    v_organization_id,
    v_programme_id,
    v_programme_mission_id,
    v_xp_account_id
  );

  return jsonb_build_object(
    'status', 'awarded',
    'missionId', v_mission.id,
    'awardScope', p_award_scope,
    'rewardType', 'reward',
    'rewardId', v_reward.id,
    'rewardTitle', v_reward.title,
    'rewardRedemptionId', v_redemption_id,
    'claimState', case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    'organizationId', v_organization_id,
    'programmeId', v_programme_id,
    'programmeMissionId', v_programme_mission_id
  );
end;
$$;

do $$ begin
  alter table public.programme_missions
    add constraint programme_missions_xp_account_id_fkey
    foreign key (xp_account_id)
    references public.xp_accounts(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.mission_awards
    add constraint mission_awards_xp_account_id_fkey
    foreign key (xp_account_id)
    references public.xp_accounts(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.mission_proofs
    add constraint mission_proofs_xp_account_id_fkey
    foreign key (xp_account_id)
    references public.xp_accounts(id)
    on delete set null;
exception when duplicate_object then null;
end $$;
