alter type public.xp_source_type add value if not exists 'assessment';

create table if not exists public.value_dimensions (
  id text primary key,
  label text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  xp_award integer not null default 0 check (xp_award >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_version_id uuid not null references public.assessment_versions(id) on delete cascade,
  prompt text not null,
  helper_text text,
  question_type text not null default 'single_select' check (question_type in ('single_select')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  label text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_option_dimension_weights (
  option_id uuid not null references public.assessment_question_options(id) on delete cascade,
  dimension_id text not null references public.value_dimensions(id),
  weight numeric not null check (weight >= 0),
  primary key (option_id, dimension_id)
);

create table if not exists public.user_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_version_id uuid not null references public.assessment_versions(id),
  status text not null default 'started' check (status in ('started', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  xp_transaction_id uuid references public.xp_transactions(id)
);

create table if not exists public.user_assessment_answers (
  attempt_id uuid not null references public.user_assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id),
  option_id uuid not null references public.assessment_question_options(id),
  primary key (attempt_id, question_id)
);

create table if not exists public.user_value_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latest_attempt_id uuid references public.user_assessment_attempts(id),
  assessment_version_id uuid references public.assessment_versions(id),
  assessment_completed_at timestamptz,
  readiness_level text not null default 'beginner' check (readiness_level in ('beginner', 'intermediate', 'advanced')),
  primary_dimension_id text references public.value_dimensions(id),
  secondary_dimension_id text references public.value_dimensions(id),
  profile_summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_value_dimension_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dimension_id text not null references public.value_dimensions(id),
  score numeric not null check (score >= 0 and score <= 1),
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, dimension_id)
);

create index if not exists assessment_versions_status_idx
  on public.assessment_versions (status);

create index if not exists assessment_questions_version_idx
  on public.assessment_questions (assessment_version_id, sort_order);

create index if not exists assessment_question_options_question_idx
  on public.assessment_question_options (question_id, sort_order);

create index if not exists user_assessment_attempts_user_idx
  on public.user_assessment_attempts (user_id, completed_at desc);

create index if not exists user_value_dimension_scores_user_idx
  on public.user_value_dimension_scores (user_id);

drop trigger if exists value_dimensions_set_updated_at on public.value_dimensions;
create trigger value_dimensions_set_updated_at
  before update on public.value_dimensions
  for each row execute function public.set_updated_at();

drop trigger if exists user_value_profiles_set_updated_at on public.user_value_profiles;
create trigger user_value_profiles_set_updated_at
  before update on public.user_value_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_value_dimension_scores_set_updated_at on public.user_value_dimension_scores;
create trigger user_value_dimension_scores_set_updated_at
  before update on public.user_value_dimension_scores
  for each row execute function public.set_updated_at();

alter table public.value_dimensions enable row level security;
alter table public.assessment_versions enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_question_options enable row level security;
alter table public.assessment_option_dimension_weights enable row level security;
alter table public.user_assessment_attempts enable row level security;
alter table public.user_assessment_answers enable row level security;
alter table public.user_value_profiles enable row level security;
alter table public.user_value_dimension_scores enable row level security;

drop policy if exists "Active value dimensions are readable" on public.value_dimensions;
create policy "Active value dimensions are readable"
  on public.value_dimensions for select
  using (status = 'active');

drop policy if exists "Published assessment versions are readable" on public.assessment_versions;
create policy "Published assessment versions are readable"
  on public.assessment_versions for select
  using (status = 'published');

drop policy if exists "Published assessment questions are readable" on public.assessment_questions;
create policy "Published assessment questions are readable"
  on public.assessment_questions for select
  using (
    exists (
      select 1
      from public.assessment_versions version
      where version.id = assessment_questions.assessment_version_id
        and version.status = 'published'
    )
  );

drop policy if exists "Published assessment options are readable" on public.assessment_question_options;
create policy "Published assessment options are readable"
  on public.assessment_question_options for select
  using (
    exists (
      select 1
      from public.assessment_questions question
      join public.assessment_versions version
        on version.id = question.assessment_version_id
      where question.id = assessment_question_options.question_id
        and version.status = 'published'
    )
  );

drop policy if exists "Published assessment weights are readable" on public.assessment_option_dimension_weights;
create policy "Published assessment weights are readable"
  on public.assessment_option_dimension_weights for select
  using (
    exists (
      select 1
      from public.assessment_question_options option
      join public.assessment_questions question
        on question.id = option.question_id
      join public.assessment_versions version
        on version.id = question.assessment_version_id
      where option.id = assessment_option_dimension_weights.option_id
        and version.status = 'published'
    )
  );

drop policy if exists "Users can read their assessment attempts" on public.user_assessment_attempts;
create policy "Users can read their assessment attempts"
  on public.user_assessment_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their assessment answers" on public.user_assessment_answers;
create policy "Users can read their assessment answers"
  on public.user_assessment_answers for select
  using (
    exists (
      select 1
      from public.user_assessment_attempts attempt
      where attempt.id = user_assessment_answers.attempt_id
        and attempt.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read their value profile" on public.user_value_profiles;
create policy "Users can read their value profile"
  on public.user_value_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their value dimension scores" on public.user_value_dimension_scores;
create policy "Users can read their value dimension scores"
  on public.user_value_dimension_scores for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all value dimensions" on public.value_dimensions;
create policy "Admins can read all value dimensions"
  on public.value_dimensions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all assessment versions" on public.assessment_versions;
create policy "Admins can read all assessment versions"
  on public.assessment_versions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all assessment questions" on public.assessment_questions;
create policy "Admins can read all assessment questions"
  on public.assessment_questions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all assessment options" on public.assessment_question_options;
create policy "Admins can read all assessment options"
  on public.assessment_question_options for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all assessment weights" on public.assessment_option_dimension_weights;
create policy "Admins can read all assessment weights"
  on public.assessment_option_dimension_weights for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all user assessment attempts" on public.user_assessment_attempts;
create policy "Admins can read all user assessment attempts"
  on public.user_assessment_attempts for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all user assessment answers" on public.user_assessment_answers;
create policy "Admins can read all user assessment answers"
  on public.user_assessment_answers for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all user value profiles" on public.user_value_profiles;
create policy "Admins can read all user value profiles"
  on public.user_value_profiles for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all user value scores" on public.user_value_dimension_scores;
create policy "Admins can read all user value scores"
  on public.user_value_dimension_scores for select
  using (public.current_user_is_admin());

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
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_assessment.xp_award,
      'earn',
      'assessment',
      v_assessment.slug,
      v_award_scope,
      jsonb_build_object(
        'kind', 'values_assessment',
        'assessmentVersionId', v_assessment.id,
        'assessmentSlug', v_assessment.slug,
        'attemptId', v_attempt_id
      )
    )
    on conflict (user_id, award_scope)
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

insert into public.value_dimensions (
  id,
  label,
  description,
  sort_order,
  status
) values
  ('self_awareness', 'Self-Awareness', 'Understanding emotions, choices, personal responsibility, and self-control.', 1, 'active'),
  ('integrity', 'Integrity', 'Honesty, fairness, accountability, and doing the right thing even when it is difficult.', 2, 'active'),
  ('critical_judgment', 'Critical Judgment', 'Thinking clearly, questioning pressure or misinformation, and making reasoned decisions.', 3, 'active'),
  ('tolerance_respect', 'Tolerance and Respect', 'Respecting difference, showing empathy, and living peacefully with others.', 4, 'active'),
  ('gender_safety_sgbv', 'Respect and Safety', 'Understanding consent, boundaries, harassment, abuse, and gender-based harm in a safe and age-appropriate way.', 5, 'active'),
  ('community_action', 'Community Action', 'Helping others, participating in community life, and contributing to shared progress.', 6, 'active'),
  ('leadership_readiness', 'Leadership Readiness', 'Taking initiative, guiding peers responsibly, and helping solve problems constructively.', 7, 'active'),
  ('digital_responsibility', 'Digital Responsibility', 'Acting responsibly online, protecting privacy, avoiding cyberbullying, and checking information before sharing.', 8, 'active')
on conflict (id) do update
  set label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order,
      status = excluded.status,
      updated_at = now();

insert into public.assessment_versions (
  id,
  slug,
  title,
  description,
  xp_award,
  status,
  published_at
) values (
  '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001',
  'values-starter-check-v1',
  'Values Starter Check',
  'Answer a few quick questions so Project VE can suggest lessons that fit where you are starting from.',
  20,
  'published',
  now()
)
on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      description = excluded.description,
      xp_award = excluded.xp_award,
      status = excluded.status,
      published_at = excluded.published_at;

insert into public.assessment_questions (
  id,
  assessment_version_id,
  prompt,
  helper_text,
  question_type,
  sort_order
) values
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1001', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'You feel angry because someone disrespected you in public. What are you most likely to do?', null, 'single_select', 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1002', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'You find something valuable that belongs to someone else, and nobody sees you. What do you do?', null, 'single_select', 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1003', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'Someone sends you a shocking message online and says, "Share this quickly." What do you do?', null, 'single_select', 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1004', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'A new person joins your class, group, or workplace. They speak differently and have different beliefs. What do you do?', null, 'single_select', 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1005', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'A friend keeps making unwanted comments about someone''s body, clothes, or relationship choices. What do you do?', null, 'single_select', 5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1006', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'There is a problem in your school, workplace, or community. What is your first step?', null, 'single_select', 6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1007', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'Your group needs someone to organize a small task, but nobody wants to lead. What do you do?', null, 'single_select', 7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1008', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d0001', 'Someone posts an embarrassing picture or private information about another person online. What do you do?', null, 'single_select', 8)
on conflict (id) do update
  set assessment_version_id = excluded.assessment_version_id,
      prompt = excluded.prompt,
      helper_text = excluded.helper_text,
      question_type = excluded.question_type,
      sort_order = excluded.sort_order;

insert into public.assessment_question_options (
  id,
  question_id,
  label,
  description,
  sort_order
) values
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2001', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1001', 'React immediately so people know I am not weak.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2002', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1001', 'Walk away, but keep thinking about revenge.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2003', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1001', 'Calm down first, then decide what to do.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2004', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1001', 'Calm down, speak respectfully, and try to solve the issue safely.', null, 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2005', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1002', 'Keep it because nobody will know.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2006', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1002', 'Keep it if I think the owner is rich or careless.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2007', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1002', 'Try to return it if it is not too difficult.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2008', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1002', 'Make a serious effort to return it because it is the right thing to do.', null, 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2009', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1003', 'Share it immediately.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2010', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1003', 'Share it if many people are already sharing it.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2011', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1003', 'Check if the source is reliable first.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2012', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1003', 'Ask questions and warn others not to spread it until confirmed.', null, 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2013', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1004', 'Avoid them because they are not like me.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2014', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1004', 'Treat them politely but keep them outside my circle.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2015', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1004', 'Include them if they show they are friendly.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2016', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1004', 'Welcome them and help others treat them with respect too.', null, 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2017', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1005', 'Laugh along because it is just a joke.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2018', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1005', 'Stay quiet because I do not want trouble.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2019', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1005', 'Tell my friend privately that the comments are not respectful.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2020', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1005', 'Support the person affected and encourage safer, more respectful behavior.', null, 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2021', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1006', 'Wait for someone older or more powerful to handle it.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2022', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1006', 'Talk about it with friends only.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2023', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1006', 'Find out who is responsible and what can be done.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2024', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1006', 'Gather people and suggest a practical next step.', null, 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2025', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1007', 'Stay silent so the responsibility does not fall on me.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2026', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1007', 'Wait until someone else starts, then help a little.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2027', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1007', 'Offer to help organize one clear part of the task.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2028', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1007', 'Help the group agree on a plan and share responsibilities fairly.', null, 4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2029', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1008', 'Share it because it is funny.', null, 1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2030', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1008', 'Look at it but do not get involved.', null, 2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2031', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1008', 'Refuse to share it and report or discourage it if possible.', null, 3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2032', '3b2ebf9a-c1d4-4b61-9d5f-f4d4452d1008', 'Support the person affected and encourage others to stop spreading it.', null, 4)
on conflict (id) do update
  set question_id = excluded.question_id,
      label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order;

insert into public.assessment_option_dimension_weights (
  option_id,
  dimension_id,
  weight
) values
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2001', 'self_awareness', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2001', 'critical_judgment', 0.2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2002', 'self_awareness', 0.3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2003', 'self_awareness', 0.8),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2003', 'critical_judgment', 0.5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2004', 'self_awareness', 0.9),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2004', 'tolerance_respect', 0.6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2004', 'leadership_readiness', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2005', 'integrity', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2006', 'integrity', 0.2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2006', 'critical_judgment', 0.2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2007', 'integrity', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2007', 'community_action', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2008', 'integrity', 0.9),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2008', 'community_action', 0.5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2009', 'critical_judgment', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2009', 'digital_responsibility', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2010', 'critical_judgment', 0.3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2010', 'digital_responsibility', 0.2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2011', 'critical_judgment', 0.8),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2011', 'digital_responsibility', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2012', 'critical_judgment', 0.9),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2012', 'digital_responsibility', 0.8),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2012', 'leadership_readiness', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2013', 'tolerance_respect', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2014', 'tolerance_respect', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2015', 'tolerance_respect', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2015', 'community_action', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2016', 'tolerance_respect', 0.9),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2016', 'community_action', 0.5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2016', 'leadership_readiness', 0.5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2017', 'gender_safety_sgbv', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2017', 'tolerance_respect', 0.2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2018', 'gender_safety_sgbv', 0.3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2018', 'self_awareness', 0.3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2019', 'gender_safety_sgbv', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2019', 'tolerance_respect', 0.6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2019', 'leadership_readiness', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2020', 'gender_safety_sgbv', 0.9),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2020', 'tolerance_respect', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2020', 'community_action', 0.5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2020', 'leadership_readiness', 0.5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2021', 'community_action', 0.2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2022', 'community_action', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2023', 'community_action', 0.6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2023', 'critical_judgment', 0.6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2024', 'community_action', 0.8),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2024', 'leadership_readiness', 0.8),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2025', 'leadership_readiness', 0.2),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2026', 'leadership_readiness', 0.4),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2026', 'community_action', 0.3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2027', 'leadership_readiness', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2027', 'community_action', 0.6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2028', 'leadership_readiness', 0.9),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2028', 'community_action', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2028', 'integrity', 0.5),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2029', 'digital_responsibility', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2029', 'tolerance_respect', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2029', 'gender_safety_sgbv', 0.1),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2030', 'digital_responsibility', 0.3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2030', 'tolerance_respect', 0.3),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2031', 'digital_responsibility', 0.8),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2031', 'tolerance_respect', 0.6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2031', 'gender_safety_sgbv', 0.6),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2032', 'digital_responsibility', 0.9),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2032', 'tolerance_respect', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2032', 'gender_safety_sgbv', 0.7),
  ('3b2ebf9a-c1d4-4b61-9d5f-f4d4452d2032', 'community_action', 0.5)
on conflict (option_id, dimension_id) do update
  set weight = excluded.weight;
