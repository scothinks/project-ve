begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(12);

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
    '11111111-1111-4111-8111-111111111201',
    'authenticated',
    'authenticated',
    'pgtap-reporting-one@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    'authenticated',
    'authenticated',
    'pgtap-reporting-two@example.test',
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
  role,
  redemption_unlocked_at
)
values
  ('11111111-1111-4111-8111-111111111201', 'Local pgTAP Reporting Learner One', 0, 0, 'learner', now() - interval '2 days'),
  ('22222222-2222-4222-8222-222222222202', 'Local pgTAP Reporting Learner Two', 0, 0, 'learner', now() - interval '2 days')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      redemption_unlocked_at = excluded.redemption_unlocked_at,
      updated_at = now();

insert into public.organizations (slug, name, status, created_by)
values
  ('lms-reporting-alpha', 'LMS Reporting Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('lms-reporting-beta', 'LMS Reporting Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as reporting_alpha_org_id
from public.organizations
where slug = 'lms-reporting-alpha'
\gset

select id as reporting_beta_org_id
from public.organizations
where slug = 'lms-reporting-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'reporting_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'report_viewer', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'reporting_beta_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'reporting_alpha_org_id'::uuid, '11111111-1111-4111-8111-111111111201'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'reporting_alpha_org_id'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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
  'course-lms-reporting-alpha',
  'course-lms-reporting-alpha',
  'LMS Reporting Alpha Course',
  'Course used for reporting coverage.',
  'Reporting learners',
  array['Read reports'],
  'Values Education',
  'beginner',
  'published',
  960,
  10,
  'organization_private',
  :'reporting_alpha_org_id'::uuid
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      organization_id = excluded.organization_id,
      catalog_scope = excluded.catalog_scope;

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
values (
  'lesson-lms-reporting-alpha',
  'course-lms-reporting-alpha',
  'lesson-lms-reporting-alpha',
  'Reporting Lesson',
  'Required lesson',
  'Quiz source lesson.',
  'published',
  1,
  8
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.quizzes (
  id,
  lesson_id,
  title,
  version,
  status
)
values (
  'quiz-lms-reporting-alpha',
  'lesson-lms-reporting-alpha',
  'Reporting Quiz',
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
  'question-lms-reporting-alpha',
  'quiz-lms-reporting-alpha',
  1,
  'single_choice',
  'Which report is scoped?',
  'Organisation reports are scoped.',
  5
)
on conflict (id) do update
  set prompt = excluded.prompt;

insert into public.programmes (
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status
)
values (
  :'reporting_alpha_org_id'::uuid,
  'lms-reporting-programme',
  'LMS Reporting Programme',
  'Exercise programme reporting.',
  'Reporting learners',
  'published'
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      objective = excluded.objective,
      intended_audience = excluded.intended_audience,
      status = excluded.status;

select id as reporting_programme_id
from public.programmes
where organization_id = :'reporting_alpha_org_id'::uuid
  and slug = 'lms-reporting-programme'
\gset

insert into public.programme_courses (programme_id, course_id, sort_order, requirement)
values (:'reporting_programme_id'::uuid, 'course-lms-reporting-alpha', 1, 'required')
on conflict (programme_id, course_id) do update
  set sort_order = excluded.sort_order,
      requirement = excluded.requirement;

insert into public.cohorts (
  organization_id,
  slug,
  title,
  description,
  status
)
values (
  :'reporting_alpha_org_id'::uuid,
  'lms-reporting-cohort',
  'LMS Reporting Cohort',
  'Cohort used for reporting.',
  'published'
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      description = excluded.description,
      status = excluded.status;

select id as reporting_cohort_id
from public.cohorts
where organization_id = :'reporting_alpha_org_id'::uuid
  and slug = 'lms-reporting-cohort'
\gset

insert into public.cohort_members (cohort_id, user_id, status, added_by)
values
  (:'reporting_cohort_id'::uuid, '11111111-1111-4111-8111-111111111201'::uuid, 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'reporting_cohort_id'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (cohort_id, user_id) do update
  set status = excluded.status,
      added_by = excluded.added_by;

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
  'mission-lms-reporting-alpha',
  'LMS Reporting Mission',
  'Mission used for reporting.',
  'custom',
  'xp',
  10,
  'once',
  'manual_review',
  '{}'::jsonb,
  'published',
  960
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.programme_missions (programme_id, mission_id, sort_order)
values (:'reporting_programme_id'::uuid, 'mission-lms-reporting-alpha', 1)
on conflict (programme_id, mission_id) do update
  set sort_order = excluded.sort_order;

insert into public.rewards (
  id,
  title,
  description,
  cost_xp,
  status,
  is_enabled,
  distribution_mode,
  fulfillment_type,
  visibility_mode,
  total_available,
  total_uploaded,
  per_user_limit,
  limit_period,
  sort_order,
  owner_scope,
  organization_id,
  shared_with_programmes
)
values (
  'reward-lms-reporting-alpha',
  'LMS Reporting Reward',
  'Reward used for reporting.',
  25,
  'published',
  true,
  'direct',
  'manual',
  'system_only',
  10,
  10,
  1,
  'lifetime',
  960,
  'organization_owned',
  :'reporting_alpha_org_id'::uuid,
  false
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      owner_scope = excluded.owner_scope,
      organization_id = excluded.organization_id,
      shared_with_programmes = excluded.shared_with_programmes;

insert into public.programme_rewards (programme_id, reward_id, sort_order)
values (:'reporting_programme_id'::uuid, 'reward-lms-reporting-alpha', 1)
on conflict (programme_id, reward_id) do update
  set sort_order = excluded.sort_order;

insert into public.enrolments (
  organization_id,
  user_id,
  course_id,
  assignment_source,
  status,
  due_at,
  started_at,
  completed_at,
  metadata
)
values
  (
    :'reporting_alpha_org_id'::uuid,
    '11111111-1111-4111-8111-111111111201'::uuid,
    'course-lms-reporting-alpha',
    'cohort',
    'completed',
    now() + interval '1 day',
    now() - interval '2 days',
    now() - interval '1 day',
    jsonb_build_object('cohortId', :'reporting_cohort_id'::uuid, 'programmeId', :'reporting_programme_id'::uuid)
  ),
  (
    :'reporting_alpha_org_id'::uuid,
    '22222222-2222-4222-8222-222222222202'::uuid,
    'course-lms-reporting-alpha',
    'cohort',
    'active',
    now() - interval '1 day',
    now() - interval '1 day',
    null,
    jsonb_build_object('cohortId', :'reporting_cohort_id'::uuid, 'programmeId', :'reporting_programme_id'::uuid)
  )
on conflict (organization_id, user_id, course_id)
  where course_id is not null
do update
  set status = excluded.status,
      due_at = excluded.due_at,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      metadata = excluded.metadata;

insert into public.enrolments (
  organization_id,
  user_id,
  programme_id,
  assignment_source,
  status,
  due_at,
  started_at,
  completed_at,
  metadata
)
values
  (
    :'reporting_alpha_org_id'::uuid,
    '11111111-1111-4111-8111-111111111201'::uuid,
    :'reporting_programme_id'::uuid,
    'cohort',
    'completed',
    now() + interval '1 day',
    now() - interval '2 days',
    now() - interval '1 day',
    jsonb_build_object('cohortId', :'reporting_cohort_id'::uuid)
  ),
  (
    :'reporting_alpha_org_id'::uuid,
    '22222222-2222-4222-8222-222222222202'::uuid,
    :'reporting_programme_id'::uuid,
    'cohort',
    'active',
    now() - interval '1 day',
    now() - interval '1 day',
    null,
    jsonb_build_object('cohortId', :'reporting_cohort_id'::uuid)
  )
on conflict (organization_id, user_id, programme_id)
  where programme_id is not null
do update
  set status = excluded.status,
      due_at = excluded.due_at,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      metadata = excluded.metadata;

insert into public.course_completions (
  organization_id,
  user_id,
  course_id,
  status,
  progress_percent,
  completed_at,
  missing_requirements,
  metadata
)
values
  (:'reporting_alpha_org_id'::uuid, '11111111-1111-4111-8111-111111111201'::uuid, 'course-lms-reporting-alpha', 'completed', 100, now() - interval '1 day', '{}'::jsonb, '{}'::jsonb),
  (:'reporting_alpha_org_id'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, 'course-lms-reporting-alpha', 'in_progress', 50, null, '{}'::jsonb, '{}'::jsonb)
on conflict (user_id, course_id) do update
  set status = excluded.status,
      progress_percent = excluded.progress_percent,
      completed_at = excluded.completed_at;

insert into public.programme_completions (
  organization_id,
  user_id,
  programme_id,
  status,
  progress_percent,
  completed_at,
  missing_requirements,
  metadata
)
values
  (:'reporting_alpha_org_id'::uuid, '11111111-1111-4111-8111-111111111201'::uuid, :'reporting_programme_id'::uuid, 'completed', 100, now() - interval '1 day', '{}'::jsonb, '{}'::jsonb),
  (:'reporting_alpha_org_id'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, :'reporting_programme_id'::uuid, 'in_progress', 40, null, '{}'::jsonb, '{}'::jsonb)
on conflict (user_id, programme_id) do update
  set status = excluded.status,
      progress_percent = excluded.progress_percent,
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
  started_at,
  ended_at
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1201',
  '11111111-1111-4111-8111-111111111201'::uuid,
  'lesson-lms-reporting-alpha',
  'quiz-lms-reporting-alpha',
  1,
  'earning',
  'graded',
  'reporting-seed',
  now() - interval '2 days',
  now() - interval '2 days'
)
on conflict (id) do update
  set status = excluded.status,
      ended_at = excluded.ended_at;

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
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1201',
  '11111111-1111-4111-8111-111111111201'::uuid,
  'question-lms-reporting-alpha',
  array['option-lms-reporting-alpha'],
  true,
  5,
  'earned'
)
on conflict (attempt_id, question_id) do update
  set is_correct = excluded.is_correct,
      earned_xp = excluded.earned_xp,
      status = excluded.status;

insert into public.xp_transactions (
  id,
  user_id,
  amount,
  direction,
  source_type,
  source_id,
  award_scope,
  metadata
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb1201',
  '11111111-1111-4111-8111-111111111201'::uuid,
  10,
  'earn',
  'mission',
  'mission-lms-reporting-alpha',
  'lms-reporting-alpha-award',
  '{}'::jsonb
)
on conflict (id) do update
  set amount = excluded.amount;

insert into public.mission_awards (
  user_id,
  mission_id,
  award_scope,
  xp_transaction_id
)
values (
  '11111111-1111-4111-8111-111111111201'::uuid,
  'mission-lms-reporting-alpha',
  'lms-reporting-alpha-award',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb1201'
)
on conflict (user_id, mission_id, award_scope) do update
  set xp_transaction_id = excluded.xp_transaction_id;

insert into public.reward_redemptions (
  user_id,
  reward_id,
  status,
  requested_at,
  fulfilled_at,
  claim_state
)
values (
  '11111111-1111-4111-8111-111111111201'::uuid,
  'reward-lms-reporting-alpha',
  'fulfilled',
  now() - interval '1 day',
  now(),
  'fulfilled'
)
on conflict (id) do nothing;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_get_lms_reporting(:'reporting_alpha_org_id'::uuid, :'reporting_programme_id'::uuid, :'reporting_cohort_id'::uuid, 50) as reporting_result
\gset

select extensions.ok(
  (:'reporting_result'::jsonb -> 'summary' ->> 'assignedLearners')::integer = 2
  and (:'reporting_result'::jsonb -> 'summary' ->> 'completedLearners')::integer = 1
  and (:'reporting_result'::jsonb -> 'summary' ->> 'overdueLearners')::integer = 1,
  'report viewer sees assigned, completed and overdue learner counts for their organisation'
);

select extensions.ok(
  (:'reporting_result'::jsonb -> 'summary' ->> 'averageQuizScore')::integer = 100
  and (:'reporting_result'::jsonb -> 'summary' ->> 'missionAwards')::integer = 1
  and (:'reporting_result'::jsonb -> 'summary' ->> 'rewardRedemptions')::integer >= 1,
  'report includes quiz score, mission completion and reward usage summary metrics'
);

select extensions.is(
  jsonb_array_length(:'reporting_result'::jsonb -> 'learners'),
  2,
  'learner detail includes scoped learners only'
);

select extensions.is(
  jsonb_array_length(:'reporting_result'::jsonb -> 'cohortComparison'),
  1,
  'cohort comparison respects the selected cohort filter'
);

select extensions.is(
  (:'reporting_result'::jsonb -> 'quizScores' -> 0 ->> 'averageScore')::integer,
  100,
  'quiz score report aggregates completed quiz attempts'
);

select extensions.is(
  (:'reporting_result'::jsonb -> 'missionCompletion' -> 0 ->> 'awards')::integer,
  1,
  'mission completion report counts scoped mission awards'
);

select extensions.ok(
  jsonb_array_length(:'reporting_result'::jsonb -> 'rewardUsage') >= 1
  and (:'reporting_result'::jsonb -> 'rewardUsage' -> 0 ->> 'redemptions')::integer >= 1,
  'reward usage report counts scoped reward redemptions'
);

select extensions.throws_ok(
  format($$ select public.admin_get_lms_reporting(%L::uuid, null, null, 50) $$, :'reporting_beta_org_id'),
  '42501',
  'Reporting access required.',
  'report viewer cannot read another organisation reporting'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.ok(
  (public.admin_get_lms_reporting(null, null, null, 10) -> 'summary' ->> 'assignedLearners')::integer >= 2,
  'platform admin can run cross-organisation reporting'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.throws_ok(
  $$ select public.admin_get_lms_reporting(null, null, null, 50) $$,
  '42501',
  'permission denied for function admin_get_lms_reporting',
  'anon cannot execute LMS reporting RPC'
);

reset role;

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_get_lms_reporting(uuid, uuid, uuid, integer)', 'execute')
  and not has_function_privilege('anon', 'public.admin_get_lms_reporting(uuid, uuid, uuid, integer)', 'execute'),
  'LMS reporting RPC is authenticated only'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_get_lms_reporting'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'LMS reporting RPC is explicitly classified'
);

select * from extensions.finish();

rollback;
