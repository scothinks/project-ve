begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(25);

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333301',
    'authenticated',
    'authenticated',
    'pgtap-completion-peer@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
  set email = excluded.email,
      aud = excluded.aud,
      role = excluded.role,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = now();

set local role service_role;

insert into public.profiles (
  id,
  display_name,
  xp,
  xp_balance_cached,
  role
)
values (
  '33333333-3333-4333-8333-333333333301',
  'Local pgTAP Completion Peer',
  0,
  0,
  'learner'
)
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

insert into public.organizations (slug, name, status, created_by)
values (
  'lms-completion-alpha',
  'LMS Completion Alpha',
  'published',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as completion_org_id
from public.organizations
where slug = 'lms-completion-alpha'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'completion_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'completion_org_id'::uuid, '33333333-3333-4333-8333-333333333301'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

insert into public.courses (
  id,
  slug,
  title,
  description,
  intended_audience,
  learning_outcomes,
  category,
  level,
  status,
  sort_order,
  estimated_minutes,
  catalog_scope,
  organization_id
)
values (
  'course-lms-completion-core',
  'course-lms-completion-core',
  'LMS Completion Core Course',
  'A course used to evaluate completion rules.',
  'Organisation learners',
  array['Complete a lesson', 'Pass a quiz'],
  'Values Education',
  'beginner',
  'published',
  940,
  15,
  'organization_private',
  :'completion_org_id'::uuid
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      intended_audience = excluded.intended_audience,
      learning_outcomes = excluded.learning_outcomes,
      catalog_scope = excluded.catalog_scope,
      organization_id = excluded.organization_id;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  subtitle,
  description,
  status,
  sort_order,
  estimated_minutes
)
values
  (
    'lesson-lms-completion-core',
    'course-lms-completion-core',
    'lesson-lms-completion-core',
    'Completion Core Lesson',
    'Required lesson',
    'Complete this lesson for course completion.',
    'published',
    1,
    8
  ),
  (
    'lesson-lms-completion-extra',
    'course-lms-completion-core',
    'lesson-lms-completion-extra',
    'Completion Extra Lesson',
    'Optional lesson',
    'Not required by the completion rule.',
    'published',
    2,
    7
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      sort_order = excluded.sort_order;

insert into public.lesson_pages (
  id,
  lesson_id,
  page_number,
  title,
  subtitle,
  page_type
)
values (
  'page-lms-completion-core',
  'lesson-lms-completion-core',
  1,
  'Completion Concepts',
  'The required page',
  'concept'
)
on conflict (id) do update
  set title = excluded.title;

insert into public.quizzes (
  id,
  lesson_id,
  title,
  version,
  status
)
values (
  'quiz-lms-completion-core',
  'lesson-lms-completion-core',
  'Completion Check',
  1,
  'published'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.quiz_questions (
  id,
  quiz_id,
  question_order,
  question_type,
  prompt,
  explanation,
  xp
)
values (
  'question-lms-completion-core',
  'quiz-lms-completion-core',
  1,
  'single_choice',
  'Which action completes the course?',
  'Complete all configured requirements.',
  5
)
on conflict (id) do update
  set prompt = excluded.prompt;

insert into public.quiz_options (
  id,
  question_id,
  option_order,
  label,
  is_correct
)
values
  ('option-lms-completion-core-correct', 'question-lms-completion-core', 1, 'Complete every requirement', true),
  ('option-lms-completion-core-wrong', 'question-lms-completion-core', 2, 'Skip the assessment', false)
on conflict (id) do update
  set label = excluded.label,
      is_correct = excluded.is_correct;

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_type,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order
)
values (
  'mission-lms-completion-core',
  'LMS Completion Mission',
  'Complete a mission linked to the course.',
  'course',
  'xp',
  25,
  'once',
  'course_completed',
  '{"courseId":"course-lms-completion-core"}'::jsonb,
  'published',
  940
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.assessment_versions (
  slug,
  title,
  description,
  xp_award,
  status,
  published_at
)
values (
  'lms-completion-assessment',
  'LMS Completion Assessment',
  'Assessment required for transcript completion.',
  0,
  'published',
  now()
)
on conflict (slug) do update
  set title = excluded.title,
      status = excluded.status
returning id as completion_assessment_id
\gset

insert into public.programmes (
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status
)
values (
  :'completion_org_id'::uuid,
  'lms-completion-programme',
  'LMS Completion Programme',
  'Group required completion activities.',
  'Completion learners',
  'published'
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      objective = excluded.objective,
      intended_audience = excluded.intended_audience,
      status = excluded.status
returning id as completion_programme_id
\gset

insert into public.programme_courses (
  programme_id,
  course_id,
  sort_order,
  requirement
)
values (
  :'completion_programme_id'::uuid,
  'course-lms-completion-core',
  1,
  'required'
)
on conflict (programme_id, course_id) do update
  set sort_order = excluded.sort_order,
      requirement = excluded.requirement;

insert into public.programme_missions (
  programme_id,
  mission_id,
  sort_order
)
values (
  :'completion_programme_id'::uuid,
  'mission-lms-completion-core',
  1
)
on conflict (programme_id, mission_id) do update
  set sort_order = excluded.sort_order;

insert into public.programme_assessments (
  programme_id,
  assessment_version_id,
  sort_order
)
values (
  :'completion_programme_id'::uuid,
  :'completion_assessment_id'::uuid,
  1
)
on conflict (programme_id, assessment_version_id) do update
  set sort_order = excluded.sort_order;

insert into public.enrolments (
  organization_id,
  user_id,
  course_id,
  assignment_source,
  status,
  metadata
)
values (
  :'completion_org_id'::uuid,
  '33333333-3333-4333-8333-333333333301'::uuid,
  'course-lms-completion-core',
  'manual',
  'active',
  '{"fixture":"lms-completion"}'::jsonb
)
on conflict do nothing;

insert into public.enrolments (
  organization_id,
  user_id,
  programme_id,
  assignment_source,
  status,
  metadata
)
values (
  :'completion_org_id'::uuid,
  '33333333-3333-4333-8333-333333333301'::uuid,
  :'completion_programme_id'::uuid,
  'manual',
  'active',
  '{"fixture":"lms-completion"}'::jsonb
)
on conflict do nothing;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_upsert_course_completion_rules(
  'course-lms-completion-core',
  array['lesson-lms-completion-core']::text[],
  array['quiz-lms-completion-core']::text[],
  array['mission-lms-completion-core']::text[],
  :'completion_assessment_id'::uuid,
  100,
  100
) as course_rules_result
\gset

select extensions.is(
  :'course_rules_result'::jsonb ->> 'status',
  'saved',
  'programme manager can save course completion rules for an editable organisation course'
);

select extensions.throws_ok(
  $$
    select public.admin_upsert_course_completion_rules(
      'course-lms-completion-core',
      array['lesson-does-not-belong']::text[],
      '{}'::text[],
      '{}'::text[],
      null,
      0,
      100
    )
  $$,
  'P0001',
  'Required lessons must belong to the course.',
  'course completion rules reject invalid lesson references'
);

select public.admin_upsert_programme_completion_rules(
  :'completion_programme_id'::uuid,
  array['course-lms-completion-core']::text[],
  array['mission-lms-completion-core']::text[],
  :'completion_assessment_id'::uuid,
  100
) as programme_rules_result
\gset

select extensions.is(
  :'programme_rules_result'::jsonb ->> 'status',
  'saved',
  'programme manager can save programme completion rules'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme_completion_rules(
        %L::uuid,
        array['course-does-not-belong']::text[],
        '{}'::text[],
        null,
        100
      )
    $$,
    :'completion_programme_id'
  ),
  'P0001',
  'Required courses must belong to the programme.',
  'programme completion rules reject courses outside the programme'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333301', true);
set local role authenticated;

select public.evaluate_course_completion('course-lms-completion-core') as initial_course_completion
\gset

select extensions.is(
  :'initial_course_completion'::jsonb ->> 'status',
  'in_progress',
  'learner course completion starts in progress before required activity'
);

select extensions.is(
  (:'initial_course_completion'::jsonb ->> 'progress_percent')::integer,
  0,
  'learner course completion starts at zero percent'
);

select extensions.ok(
  (:'initial_course_completion'::jsonb -> 'missing_requirements' -> 'lessonIds') ? 'lesson-lms-completion-core'
  and (:'initial_course_completion'::jsonb -> 'missing_requirements' -> 'quizIds') ? 'quiz-lms-completion-core'
  and (:'initial_course_completion'::jsonb -> 'missing_requirements' -> 'missionIds') ? 'mission-lms-completion-core'
  and (:'initial_course_completion'::jsonb -> 'missing_requirements' ->> 'assessmentVersionId') = :'completion_assessment_id',
  'course completion reports all missing configured requirements'
);

select extensions.throws_ok(
  format(
    $$
      insert into public.course_completions (organization_id, user_id, course_id, status, progress_percent)
      values (%L::uuid, '33333333-3333-4333-8333-333333333301'::uuid, 'course-lms-completion-core', 'completed', 100)
    $$,
    :'completion_org_id'
  ),
  '42501',
  'permission denied for table course_completions',
  'learner cannot directly forge course completion rows'
);

select extensions.throws_ok(
  $$ select public.upsert_course_completion_for_user('33333333-3333-4333-8333-333333333301'::uuid, 'course-lms-completion-core') $$,
  '42501',
  'permission denied for function upsert_course_completion_for_user',
  'learner cannot execute internal course completion helper'
);

reset role;
set local role service_role;

insert into public.lesson_page_completions (
  user_id,
  lesson_id,
  page_id,
  completed_at
)
values (
  '33333333-3333-4333-8333-333333333301'::uuid,
  'lesson-lms-completion-core',
  'page-lms-completion-core',
  now()
)
on conflict (user_id, lesson_id, page_id) do update
  set completed_at = excluded.completed_at;

insert into public.lesson_progress (
  user_id,
  lesson_id,
  completed_pages,
  quiz_score,
  completed_at
)
values (
  '33333333-3333-4333-8333-333333333301'::uuid,
  'lesson-lms-completion-core',
  array['page-lms-completion-core']::text[],
  0,
  now()
)
on conflict (user_id, lesson_id) do update
  set completed_pages = excluded.completed_pages,
      quiz_score = excluded.quiz_score,
      completed_at = excluded.completed_at;

insert into public.quiz_attempts (
  id,
  user_id,
  lesson_id,
  quiz_id,
  quiz_version,
  mode,
  status,
  seed,
  ended_at,
  ended_reason
)
values (
  '44444444-4444-4444-8444-444444444401'::uuid,
  '33333333-3333-4333-8333-333333333301'::uuid,
  'lesson-lms-completion-core',
  'quiz-lms-completion-core',
  1,
  'earning',
  'graded',
  'completion-seed-low',
  now(),
  'submitted'
)
on conflict (id) do update
  set status = excluded.status;

insert into public.quiz_answers (
  attempt_id,
  user_id,
  question_id,
  selected_option_ids,
  is_correct,
  earned_xp,
  status
)
values (
  '44444444-4444-4444-8444-444444444401'::uuid,
  '33333333-3333-4333-8333-333333333301'::uuid,
  'question-lms-completion-core',
  array['option-lms-completion-core-wrong']::text[],
  false,
  0,
  'missed'
)
on conflict (attempt_id, question_id) do update
  set selected_option_ids = excluded.selected_option_ids,
      is_correct = excluded.is_correct,
      status = excluded.status;

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333301', true);
set local role authenticated;

select public.evaluate_course_completion('course-lms-completion-core') as partial_course_completion
\gset

select extensions.is(
  :'partial_course_completion'::jsonb ->> 'status',
  'in_progress',
  'low quiz score prevents course completion'
);

select extensions.ok(
  (:'partial_course_completion'::jsonb -> 'completed_required_lessons') ? 'lesson-lms-completion-core'
  and (:'partial_course_completion'::jsonb -> 'missing_requirements' -> 'quizIds') ? 'quiz-lms-completion-core',
  'completed lessons are recorded while failed quiz remains missing'
);

reset role;
set local role service_role;

insert into public.quiz_attempts (
  id,
  user_id,
  lesson_id,
  quiz_id,
  quiz_version,
  mode,
  status,
  seed,
  ended_at,
  ended_reason
)
values (
  '44444444-4444-4444-8444-444444444402'::uuid,
  '33333333-3333-4333-8333-333333333301'::uuid,
  'lesson-lms-completion-core',
  'quiz-lms-completion-core',
  1,
  'earning',
  'graded',
  'completion-seed-pass',
  now(),
  'submitted'
)
on conflict (id) do update
  set status = excluded.status;

insert into public.quiz_answers (
  attempt_id,
  user_id,
  question_id,
  selected_option_ids,
  is_correct,
  earned_xp,
  status
)
values (
  '44444444-4444-4444-8444-444444444402'::uuid,
  '33333333-3333-4333-8333-333333333301'::uuid,
  'question-lms-completion-core',
  array['option-lms-completion-core-correct']::text[],
  true,
  5,
  'earned'
)
on conflict (attempt_id, question_id) do update
  set selected_option_ids = excluded.selected_option_ids,
      is_correct = excluded.is_correct,
      status = excluded.status;

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
  '33333333-3333-4333-8333-333333333301'::uuid,
  25,
  'earn',
  'mission',
  'mission-lms-completion-core',
  'lms-completion-mission-award',
  '{}'::jsonb
)
on conflict (user_id, award_scope) where direction = 'earn' and award_scope is not null do update
  set amount = excluded.amount
returning id as completion_xp_transaction_id
\gset

insert into public.mission_awards (
  user_id,
  mission_id,
  award_scope,
  xp_transaction_id
)
values (
  '33333333-3333-4333-8333-333333333301'::uuid,
  'mission-lms-completion-core',
  'lms-completion-mission-award',
  :'completion_xp_transaction_id'::uuid
)
on conflict (user_id, mission_id, award_scope) do update
  set xp_transaction_id = excluded.xp_transaction_id;

insert into public.user_assessment_attempts (
  user_id,
  assessment_version_id,
  status,
  completed_at
)
values (
  '33333333-3333-4333-8333-333333333301'::uuid,
  :'completion_assessment_id'::uuid,
  'completed',
  now()
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333301', true);
set local role authenticated;

select public.evaluate_course_completion('course-lms-completion-core') as complete_course_completion
\gset

select extensions.is(
  :'complete_course_completion'::jsonb ->> 'status',
  'completed',
  'learner course completion becomes completed after all configured requirements are met'
);

select extensions.is(
  (:'complete_course_completion'::jsonb ->> 'progress_percent')::integer,
  100,
  'completed course reports one hundred percent progress'
);

select public.evaluate_programme_completion(:'completion_programme_id'::uuid) as complete_programme_completion
\gset

select extensions.is(
  :'complete_programme_completion'::jsonb ->> 'status',
  'completed',
  'programme completion derives from required course, mission and assessment completion'
);

select extensions.ok(
  (:'complete_programme_completion'::jsonb -> 'completed_required_courses') ? 'course-lms-completion-core'
  and (:'complete_programme_completion'::jsonb -> 'completed_required_missions') ? 'mission-lms-completion-core',
  'programme completion records completed required courses and missions'
);

select public.get_my_lms_transcript() as transcript_result
\gset

select extensions.ok(
  jsonb_array_length(:'transcript_result'::jsonb -> 'courses') = 1
  and jsonb_array_length(:'transcript_result'::jsonb -> 'programmes') = 1
  and (:'transcript_result'::jsonb -> 'courses' -> 0 ->> 'status') = 'completed'
  and (:'transcript_result'::jsonb -> 'programmes' -> 0 ->> 'status') = 'completed',
  'learner transcript returns own evaluated course and programme records'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.course_completions),
  1,
  'organisation manager can read learner course completions in their organisation'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.programme_completions),
  1,
  'platform admin can read programme completions'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333301', true);
set local role authenticated;

select extensions.ok(
  not exists (
    select 1
    from public.course_completions
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
  ),
  'learner cannot read another learner completion records'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.throws_ok(
  $$ select public.get_my_lms_transcript() $$,
  '42501',
  'permission denied for function get_my_lms_transcript',
  'anon cannot execute learner transcript RPC'
);

select extensions.throws_ok(
  $$ select public.evaluate_course_completion('course-lms-completion-core') $$,
  '42501',
  'permission denied for function evaluate_course_completion',
  'anon cannot execute course completion evaluation RPC'
);

reset role;

select extensions.ok(
  has_function_privilege('authenticated', 'public.get_my_lms_transcript()', 'execute')
  and not has_function_privilege('anon', 'public.get_my_lms_transcript()', 'execute'),
  'transcript RPC is authenticated only'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.user_completed_assessment(uuid, uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.user_completed_assessment(uuid, uuid)', 'execute'),
  'assessment completion helper is not directly executable by API roles'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'get_my_lms_transcript'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
  ),
  'transcript RPC is explicitly classified'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_upsert_course_completion_rules'
      and classification = 'ADMIN_AUTHENTICATED'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_upsert_programme_completion_rules'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'completion rule admin RPCs are explicitly classified'
);

select * from extensions.finish();

rollback;
