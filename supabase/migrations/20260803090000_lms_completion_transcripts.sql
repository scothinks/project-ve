do $$ begin
  create type public.lms_completion_status as enum (
    'in_progress',
    'completed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.course_completion_rules (
  course_id text primary key references public.courses(id) on delete cascade,
  required_lesson_ids text[] not null default '{}',
  required_quiz_ids text[] not null default '{}',
  required_mission_ids text[] not null default '{}',
  required_final_assessment_version_id uuid references public.assessment_versions(id) on delete set null,
  minimum_quiz_score integer not null default 0 check (minimum_quiz_score between 0 and 100),
  minimum_completion_threshold integer not null default 100 check (minimum_completion_threshold between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programme_completion_rules (
  programme_id uuid primary key references public.programmes(id) on delete cascade,
  required_course_ids text[] not null default '{}',
  required_mission_ids text[] not null default '{}',
  required_final_assessment_version_id uuid references public.assessment_versions(id) on delete set null,
  minimum_completion_threshold integer not null default 100 check (minimum_completion_threshold between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_completions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  status public.lms_completion_status not null default 'in_progress',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  completed_required_lessons text[] not null default '{}',
  completed_required_quizzes text[] not null default '{}',
  completed_required_missions text[] not null default '{}',
  missing_requirements jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id),
  check (jsonb_typeof(missing_requirements) = 'object'),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (status = 'completed' and completed_at is not null)
    or (status = 'in_progress' and completed_at is null)
  )
);

create table if not exists public.programme_completions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  status public.lms_completion_status not null default 'in_progress',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  completed_required_courses text[] not null default '{}',
  completed_required_missions text[] not null default '{}',
  missing_requirements jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, programme_id),
  check (jsonb_typeof(missing_requirements) = 'object'),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (status = 'completed' and completed_at is not null)
    or (status = 'in_progress' and completed_at is null)
  )
);

create index if not exists course_completions_user_status_idx
  on public.course_completions(user_id, status, evaluated_at desc);

create index if not exists programme_completions_user_status_idx
  on public.programme_completions(user_id, status, evaluated_at desc);

create index if not exists course_completions_course_status_idx
  on public.course_completions(course_id, status);

create index if not exists programme_completions_programme_status_idx
  on public.programme_completions(programme_id, status);

drop trigger if exists course_completion_rules_set_updated_at on public.course_completion_rules;
create trigger course_completion_rules_set_updated_at
  before update on public.course_completion_rules
  for each row execute function public.set_updated_at();

drop trigger if exists programme_completion_rules_set_updated_at on public.programme_completion_rules;
create trigger programme_completion_rules_set_updated_at
  before update on public.programme_completion_rules
  for each row execute function public.set_updated_at();

drop trigger if exists course_completions_set_updated_at on public.course_completions;
create trigger course_completions_set_updated_at
  before update on public.course_completions
  for each row execute function public.set_updated_at();

drop trigger if exists programme_completions_set_updated_at on public.programme_completions;
create trigger programme_completions_set_updated_at
  before update on public.programme_completions
  for each row execute function public.set_updated_at();

alter table public.course_completion_rules enable row level security;
alter table public.programme_completion_rules enable row level security;
alter table public.course_completions enable row level security;
alter table public.programme_completions enable row level security;

revoke insert, update, delete on public.course_completion_rules from anon, authenticated;
revoke insert, update, delete on public.programme_completion_rules from anon, authenticated;
revoke insert, update, delete on public.course_completions from anon, authenticated;
revoke insert, update, delete on public.programme_completions from anon, authenticated;

drop policy if exists "Course completion rules readable through course" on public.course_completion_rules;
create policy "Course completion rules readable through course"
  on public.course_completion_rules for select
  using (public.current_user_can_read_course(course_id));

drop policy if exists "Course completion rules writable by course editors" on public.course_completion_rules;
create policy "Course completion rules writable by course editors"
  on public.course_completion_rules for all
  using (public.current_user_can_edit_course(course_id))
  with check (public.current_user_can_edit_course(course_id));

drop policy if exists "Programme completion rules readable through programme" on public.programme_completion_rules;
create policy "Programme completion rules readable through programme"
  on public.programme_completion_rules for select
  using (public.current_user_can_read_programme(programme_id));

drop policy if exists "Programme completion rules writable by programme managers" on public.programme_completion_rules;
create policy "Programme completion rules writable by programme managers"
  on public.programme_completion_rules for all
  using (public.current_user_can_manage_programme(programme_id))
  with check (public.current_user_can_manage_programme(programme_id));

drop policy if exists "Course completions readable by learner and audience staff" on public.course_completions;
create policy "Course completions readable by learner and audience staff"
  on public.course_completions for select
  using (
    user_id = auth.uid()
    or public.current_user_is_admin()
    or (
      organization_id is not null
      and public.current_user_can_read_organization_audience(organization_id)
    )
  );

drop policy if exists "Course completions writable by evaluators and audience managers" on public.course_completions;
create policy "Course completions writable by evaluators and audience managers"
  on public.course_completions for all
  using (
    public.current_user_is_admin()
    or (
      organization_id is not null
      and public.current_user_can_manage_organization_audience(organization_id)
    )
  )
  with check (
    public.current_user_is_admin()
    or (
      organization_id is not null
      and public.current_user_can_manage_organization_audience(organization_id)
    )
  );

drop policy if exists "Programme completions readable by learner and audience staff" on public.programme_completions;
create policy "Programme completions readable by learner and audience staff"
  on public.programme_completions for select
  using (
    user_id = auth.uid()
    or public.current_user_is_admin()
    or public.current_user_can_read_organization_audience(organization_id)
  );

drop policy if exists "Programme completions writable by evaluators and audience managers" on public.programme_completions;
create policy "Programme completions writable by evaluators and audience managers"
  on public.programme_completions for all
  using (
    public.current_user_is_admin()
    or public.current_user_can_manage_organization_audience(organization_id)
  )
  with check (
    public.current_user_is_admin()
    or public.current_user_can_manage_organization_audience(organization_id)
  );

create or replace function public.user_completed_assessment(
  p_user_id uuid,
  p_assessment_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_assessment_version_id is null
    or exists (
      select 1
      from public.user_assessment_attempts attempt
      where attempt.user_id = p_user_id
        and attempt.assessment_version_id = p_assessment_version_id
        and attempt.status = 'completed'
        and attempt.completed_at is not null
    );
$$;

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

  v_assessment_completed := public.user_completed_assessment(p_user_id, v_rule.required_final_assessment_version_id);

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
      and coalesce(array_length(v_missing_lesson_ids, 1), 0) = 0
      and coalesce(array_length(v_missing_quiz_ids, 1), 0) = 0
      and coalesce(array_length(v_missing_mission_ids, 1), 0) = 0
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

  v_assessment_completed := public.user_completed_assessment(p_user_id, v_rule.required_final_assessment_version_id);

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
      and coalesce(array_length(v_missing_course_ids, 1), 0) = 0
      and coalesce(array_length(v_missing_mission_ids, 1), 0) = 0
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

create or replace function public.evaluate_course_completion(p_course_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.course_completions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not public.current_user_can_read_course(p_course_id) then
    raise exception 'Course access required.' using errcode = '42501';
  end if;

  v_result := public.upsert_course_completion_for_user(v_user_id, p_course_id);

  return to_jsonb(v_result);
end;
$$;

create or replace function public.evaluate_programme_completion(p_programme_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.programme_completions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not public.current_user_can_read_programme(p_programme_id) then
    raise exception 'Programme access required.' using errcode = '42501';
  end if;

  v_result := public.upsert_programme_completion_for_user(v_user_id, p_programme_id);

  return to_jsonb(v_result);
end;
$$;

create or replace function public.get_my_lms_transcript()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id text;
  v_programme_id uuid;
  v_courses jsonb := '[]'::jsonb;
  v_programmes jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  for v_course_id in
    select distinct enrolment.course_id
    from public.enrolments enrolment
    where enrolment.user_id = v_user_id
      and enrolment.course_id is not null
  loop
    perform public.upsert_course_completion_for_user(v_user_id, v_course_id);
  end loop;

  for v_programme_id in
    select distinct enrolment.programme_id
    from public.enrolments enrolment
    where enrolment.user_id = v_user_id
      and enrolment.programme_id is not null
  loop
    perform public.upsert_programme_completion_for_user(v_user_id, v_programme_id);
  end loop;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'courseId', completion.course_id,
      'title', course.title,
      'category', course.category,
      'status', completion.status,
      'progressPercent', completion.progress_percent,
      'completedAt', completion.completed_at,
      'evaluatedAt', completion.evaluated_at,
      'missingRequirements', completion.missing_requirements,
      'metadata', completion.metadata
    )
    order by completion.completed_at desc nulls last, course.title asc
  ), '[]'::jsonb)
    into v_courses
  from public.course_completions completion
  join public.courses course
    on course.id = completion.course_id
  where completion.user_id = v_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'programmeId', completion.programme_id,
      'title', programme.title,
      'organizationId', programme.organization_id,
      'status', completion.status,
      'progressPercent', completion.progress_percent,
      'completedAt', completion.completed_at,
      'evaluatedAt', completion.evaluated_at,
      'missingRequirements', completion.missing_requirements,
      'metadata', completion.metadata
    )
    order by completion.completed_at desc nulls last, programme.title asc
  ), '[]'::jsonb)
    into v_programmes
  from public.programme_completions completion
  join public.programmes programme
    on programme.id = completion.programme_id
  where completion.user_id = v_user_id;

  return jsonb_build_object(
    'generatedAt', now(),
    'courses', v_courses,
    'programmes', v_programmes
  );
end;
$$;

create or replace function public.admin_upsert_course_completion_rules(
  p_course_id text,
  p_required_lesson_ids text[],
  p_required_quiz_ids text[],
  p_required_mission_ids text[],
  p_required_final_assessment_version_id uuid,
  p_minimum_quiz_score integer,
  p_minimum_completion_threshold integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_required_lesson_ids text[] := coalesce(p_required_lesson_ids, '{}');
  v_required_quiz_ids text[] := coalesce(p_required_quiz_ids, '{}');
  v_required_mission_ids text[] := coalesce(p_required_mission_ids, '{}');
begin
  if v_actor_id is null or not public.current_user_can_edit_course(p_course_id) then
    raise exception 'Course editor access required.';
  end if;

  if exists (
    select 1
    from unnest(v_required_lesson_ids) as required(lesson_id)
    left join public.lessons lesson
      on lesson.id = required.lesson_id
     and lesson.course_id = p_course_id
    where lesson.id is null
  ) then
    raise exception 'Required lessons must belong to the course.';
  end if;

  if exists (
    select 1
    from unnest(v_required_quiz_ids) as required(quiz_id)
    left join public.quizzes quiz
      on quiz.id = required.quiz_id
    left join public.lessons lesson
      on lesson.id = quiz.lesson_id
     and lesson.course_id = p_course_id
    where quiz.id is null
       or lesson.id is null
  ) then
    raise exception 'Required quizzes must belong to the course.';
  end if;

  if exists (
    select 1
    from unnest(v_required_mission_ids) as required(mission_id)
    left join public.missions mission
      on mission.id = required.mission_id
     and mission.status <> 'archived'
    where mission.id is null
  ) then
    raise exception 'Required missions must reference active missions.';
  end if;

  if p_required_final_assessment_version_id is not null
    and not exists (
      select 1
      from public.assessment_versions
      where id = p_required_final_assessment_version_id
        and status <> 'archived'
    )
  then
    raise exception 'Required final assessment must reference an active assessment version.';
  end if;

  insert into public.course_completion_rules (
    course_id,
    required_lesson_ids,
    required_quiz_ids,
    required_mission_ids,
    required_final_assessment_version_id,
    minimum_quiz_score,
    minimum_completion_threshold,
    updated_by
  )
  values (
    p_course_id,
    v_required_lesson_ids,
    v_required_quiz_ids,
    v_required_mission_ids,
    p_required_final_assessment_version_id,
    coalesce(p_minimum_quiz_score, 0),
    coalesce(p_minimum_completion_threshold, 100),
    v_actor_id
  )
  on conflict (course_id) do update
    set required_lesson_ids = excluded.required_lesson_ids,
        required_quiz_ids = excluded.required_quiz_ids,
        required_mission_ids = excluded.required_mission_ids,
        required_final_assessment_version_id = excluded.required_final_assessment_version_id,
        minimum_quiz_score = excluded.minimum_quiz_score,
        minimum_completion_threshold = excluded.minimum_completion_threshold,
        updated_by = excluded.updated_by;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'course_completion_rules_updated',
    'course',
    p_course_id,
    jsonb_build_object('requiredLessons', array_length(v_required_lesson_ids, 1), 'requiredQuizzes', array_length(v_required_quiz_ids, 1))
  );

  return jsonb_build_object('courseId', p_course_id, 'status', 'saved');
end;
$$;

create or replace function public.admin_upsert_programme_completion_rules(
  p_programme_id uuid,
  p_required_course_ids text[],
  p_required_mission_ids text[],
  p_required_final_assessment_version_id uuid,
  p_minimum_completion_threshold integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_required_course_ids text[] := coalesce(p_required_course_ids, '{}');
  v_required_mission_ids text[] := coalesce(p_required_mission_ids, '{}');
begin
  if v_actor_id is null or not public.current_user_can_manage_programme(p_programme_id) then
    raise exception 'Programme manager access required.';
  end if;

  if exists (
    select 1
    from unnest(v_required_course_ids) as required(course_id)
    left join public.programme_courses programme_course
      on programme_course.course_id = required.course_id
     and programme_course.programme_id = p_programme_id
    where programme_course.course_id is null
  ) then
    raise exception 'Required courses must belong to the programme.';
  end if;

  if exists (
    select 1
    from unnest(v_required_mission_ids) as required(mission_id)
    left join public.programme_missions programme_mission
      on programme_mission.mission_id = required.mission_id
     and programme_mission.programme_id = p_programme_id
    where programme_mission.mission_id is null
  ) then
    raise exception 'Required missions must belong to the programme.';
  end if;

  if p_required_final_assessment_version_id is not null
    and not exists (
      select 1
      from public.programme_assessments
      where programme_id = p_programme_id
        and assessment_version_id = p_required_final_assessment_version_id
    )
  then
    raise exception 'Required final assessment must be attached to the programme.';
  end if;

  insert into public.programme_completion_rules (
    programme_id,
    required_course_ids,
    required_mission_ids,
    required_final_assessment_version_id,
    minimum_completion_threshold,
    updated_by
  )
  values (
    p_programme_id,
    v_required_course_ids,
    v_required_mission_ids,
    p_required_final_assessment_version_id,
    coalesce(p_minimum_completion_threshold, 100),
    v_actor_id
  )
  on conflict (programme_id) do update
    set required_course_ids = excluded.required_course_ids,
        required_mission_ids = excluded.required_mission_ids,
        required_final_assessment_version_id = excluded.required_final_assessment_version_id,
        minimum_completion_threshold = excluded.minimum_completion_threshold,
        updated_by = excluded.updated_by;

  update public.programmes
  set completion_rules = jsonb_build_object(
    'requiredCourseIds', v_required_course_ids,
    'requiredMissionIds', v_required_mission_ids,
    'requiredFinalAssessmentVersionId', p_required_final_assessment_version_id,
    'minimumCompletionThreshold', coalesce(p_minimum_completion_threshold, 100)
  )
  where id = p_programme_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'programme_completion_rules_updated',
    'programme',
    p_programme_id::text,
    jsonb_build_object('requiredCourses', array_length(v_required_course_ids, 1), 'requiredMissions', array_length(v_required_mission_ids, 1))
  );

  return jsonb_build_object('programmeId', p_programme_id, 'status', 'saved');
end;
$$;

revoke execute on function public.user_completed_assessment(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.upsert_course_completion_for_user(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.upsert_programme_completion_for_user(uuid, uuid) from public, anon, authenticated, service_role;

revoke execute on function public.evaluate_course_completion(text) from public, anon, authenticated, service_role;
grant execute on function public.evaluate_course_completion(text) to authenticated, service_role;

revoke execute on function public.evaluate_programme_completion(uuid) from public, anon, authenticated, service_role;
grant execute on function public.evaluate_programme_completion(uuid) to authenticated, service_role;

revoke execute on function public.get_my_lms_transcript() from public, anon, authenticated, service_role;
grant execute on function public.get_my_lms_transcript() to authenticated, service_role;

revoke execute on function public.admin_upsert_course_completion_rules(text, text[], text[], text[], uuid, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_course_completion_rules(text, text[], text[], text[], uuid, integer, integer) to authenticated, service_role;

revoke execute on function public.admin_upsert_programme_completion_rules(uuid, text[], text[], uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_programme_completion_rules(uuid, text[], text[], uuid, integer) to authenticated, service_role;

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
    'evaluate_course_completion',
    'p_course_id text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners refreshing their own course completion record.',
    'Uses auth.uid() as the only learner identity and requires course read access before evaluating progress into course_completions.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'evaluate_programme_completion',
    'p_programme_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners refreshing their own programme completion record.',
    'Uses auth.uid() as the only learner identity and requires programme read access before evaluating programme and derived course completion.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'get_my_lms_transcript',
    '',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners reading their own LMS transcript.',
    'Uses auth.uid() as the only learner identity, refreshes own enrolment-linked completion records, and returns only own transcript rows.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_course_completion_rules',
    'p_course_id text, p_required_lesson_ids text[], p_required_quiz_ids text[], p_required_mission_ids text[], p_required_final_assessment_version_id uuid, p_minimum_quiz_score integer, p_minimum_completion_threshold integer',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual course editor configuring canonical course completion rules.',
    'Requires auth.uid(), course edit rights and validates lesson, quiz, mission and assessment references before updating rules.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_programme_completion_rules',
    'p_programme_id uuid, p_required_course_ids text[], p_required_mission_ids text[], p_required_final_assessment_version_id uuid, p_minimum_completion_threshold integer',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual programme manager configuring canonical programme completion rules.',
    'Requires auth.uid(), programme manager rights and validates required courses, missions and final assessment against programme attachments.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'user_completed_assessment',
    'p_user_id uuid, p_assessment_version_id uuid',
    'INTERNAL_HELPER',
    'LMS completion evaluator internals.',
    'Revoked from API roles; called by completion evaluators to check completed assessment attempts for the supplied user id.',
    array[]::text[]
  ),
  (
    'public',
    'upsert_course_completion_for_user',
    'p_user_id uuid, p_course_id text',
    'INTERNAL_HELPER',
    'LMS completion evaluator internals.',
    'Revoked from API roles; called by authenticated self-service and programme evaluators after caller-level authorization has been established.',
    array[]::text[]
  ),
  (
    'public',
    'upsert_programme_completion_for_user',
    'p_user_id uuid, p_programme_id uuid',
    'INTERNAL_HELPER',
    'LMS completion evaluator internals.',
    'Revoked from API roles; called by authenticated transcript and programme evaluators after caller-level authorization has been established.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
