begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(29);

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
  ),
  (
    '33333333-3333-4333-8333-333333333203',
    'authenticated',
    'authenticated',
    'pgtap-reporting-unit-supervisor@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444204',
    'authenticated',
    'authenticated',
    'pgtap-reporting-broad-instructor@example.test',
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
  ('22222222-2222-4222-8222-222222222202', 'Local pgTAP Reporting Learner Two', 0, 0, 'learner', now() - interval '2 days'),
  ('33333333-3333-4333-8333-333333333203', 'Local pgTAP Reporting Unit Supervisor', 0, 0, 'learner', now() - interval '2 days'),
  ('44444444-4444-4444-8444-444444444204', 'Local pgTAP Reporting Broad Instructor', 0, 0, 'learner', now() - interval '2 days')
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
  (:'reporting_alpha_org_id'::uuid, '22222222-2222-4222-8222-222222222202'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'reporting_alpha_org_id'::uuid, '33333333-3333-4333-8333-333333333203'::uuid, 'instructor', 'invited', :'TEST_ADMIN_USER_ID'::uuid),
  (:'reporting_alpha_org_id'::uuid, '44444444-4444-4444-8444-444444444204'::uuid, 'instructor', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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

insert into public.organization_units (
  id,
  organization_id,
  parent_unit_id,
  name,
  unit_type,
  status,
  created_by
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301',
    :'reporting_alpha_org_id'::uuid,
    null,
    'Reporting Direct Unit',
    'Department',
    'published',
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1302',
    :'reporting_alpha_org_id'::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301',
    'Reporting Child Unit',
    'Team',
    'published',
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1303',
    :'reporting_alpha_org_id'::uuid,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1302',
    'Reporting Grandchild Unit',
    'Class',
    'published',
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1304',
    :'reporting_alpha_org_id'::uuid,
    null,
    'Reporting Cohort Unit',
    'Branch',
    'published',
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb1301',
    :'reporting_beta_org_id'::uuid,
    null,
    'Reporting Beta Unit',
    'Department',
    'published',
    :'TEST_ADMIN_USER_ID'::uuid
  )
on conflict (id) do update
  set organization_id = excluded.organization_id,
      parent_unit_id = excluded.parent_unit_id,
      name = excluded.name,
      unit_type = excluded.unit_type,
      status = excluded.status;

select extensions.throws_ok(
  format(
    $$ insert into public.organization_units (organization_id, parent_unit_id, name, unit_type) values (%L::uuid, %L::uuid, 'Cross org child', 'Team') $$,
    :'reporting_alpha_org_id',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb1301'
  ),
  '23514',
  'Organisation units cannot cross organisations.',
  'unit parent boundary prevents cross-organisation hierarchy'
);

select extensions.throws_ok(
  format(
    $$ insert into public.organization_units (organization_id, parent_unit_id, name, unit_type) values (%L::uuid, %L::uuid, 'Reporting Too Deep Unit', 'Class') $$,
    :'reporting_alpha_org_id',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1303'
  ),
  '23514',
  'Organisation units support a maximum depth of 3 during Phase 1.5.',
  'unit hierarchy is capped at three levels'
);

insert into public.organization_unit_members (
  unit_id,
  organization_id,
  user_id,
  role,
  status,
  assigned_by
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301',
    :'reporting_alpha_org_id'::uuid,
    '11111111-1111-4111-8111-111111111201'::uuid,
    'learner',
    'active',
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301',
    :'reporting_alpha_org_id'::uuid,
    '33333333-3333-4333-8333-333333333203'::uuid,
    'instructor',
    'active',
    :'TEST_ADMIN_USER_ID'::uuid
  )
on conflict (unit_id, user_id, role) do update
  set status = excluded.status,
      organization_id = excluded.organization_id,
      assigned_by = excluded.assigned_by;

select extensions.throws_ok(
  format(
    $$ insert into public.organization_unit_members (unit_id, organization_id, user_id, role) values (%L::uuid, %L::uuid, %L::uuid, 'learner') $$,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301',
    :'reporting_beta_org_id',
    '11111111-1111-4111-8111-111111111201'
  ),
  '23514',
  'Unit members cannot cross organisations.',
  'unit member boundary prevents cross-organisation assignment'
);

insert into public.cohort_units (
  cohort_id,
  unit_id,
  organization_id,
  assigned_by
)
values (
  :'reporting_cohort_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1304',
  :'reporting_alpha_org_id'::uuid,
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (cohort_id, unit_id) do update
  set organization_id = excluded.organization_id,
      assigned_by = excluded.assigned_by;

select extensions.throws_ok(
  format(
    $$ insert into public.cohort_units (cohort_id, unit_id, organization_id) values (%L::uuid, %L::uuid, %L::uuid) $$,
    :'reporting_cohort_id',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb1301',
    :'reporting_alpha_org_id'
  ),
  '23514',
  'Cohort units cannot cross organisations.',
  'cohort unit boundary prevents cross-organisation association'
);

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
  'proof_upload',
  jsonb_build_object('requiredProofFields', jsonb_build_array('text'), 'proofRequirementMode', 'all'),
  'published',
  960
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      validation_type = excluded.validation_type,
      validation_config = excluded.validation_config;

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

insert into public.mission_proofs (
  id,
  user_id,
  mission_id,
  award_scope,
  organization_id,
  programme_id,
  programme_mission_id,
  proof_type,
  value,
  status
)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccc1201',
    '11111111-1111-4111-8111-111111111201'::uuid,
    'mission-lms-reporting-alpha',
    'lms-reporting-alpha-proof',
    :'reporting_alpha_org_id'::uuid,
    :'reporting_programme_id'::uuid,
    null,
    'text',
    'Learner one submitted scoped evidence.',
    'submitted'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccc1202',
    '22222222-2222-4222-8222-222222222202'::uuid,
    'mission-lms-reporting-alpha',
    'lms-reporting-alpha-proof-two',
    :'reporting_alpha_org_id'::uuid,
    :'reporting_programme_id'::uuid,
    null,
    'text',
    'Learner two submitted unrelated scoped evidence.',
    'submitted'
  )
on conflict (id) do update
  set status = excluded.status,
      value = excluded.value,
      organization_id = excluded.organization_id,
      programme_id = excluded.programme_id;

insert into public.lms_interventions (
  id,
  organization_id,
  programme_id,
  cohort_id,
  user_id,
  intervention_type,
  status,
  severity,
  reason,
  due_at,
  last_activity_at
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddd1201',
  :'reporting_alpha_org_id'::uuid,
  :'reporting_programme_id'::uuid,
  :'reporting_cohort_id'::uuid,
  '11111111-1111-4111-8111-111111111201'::uuid,
  'inactive',
  'open',
  'warning',
  'Learner has not made recent progress.',
  now() + interval '3 days',
  now() - interval '21 days'
)
on conflict (id) do update
  set status = excluded.status,
      severity = excluded.severity,
      reason = excluded.reason,
      last_activity_at = excluded.last_activity_at;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_get_lms_reporting(:'reporting_alpha_org_id'::uuid, :'reporting_programme_id'::uuid, :'reporting_cohort_id'::uuid, null, 50) as reporting_result
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

select public.admin_get_lms_reporting(:'reporting_alpha_org_id'::uuid, null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301'::uuid, 50) as direct_unit_reporting_result
\gset

select extensions.ok(
  (:'direct_unit_reporting_result'::jsonb -> 'summary' ->> 'unitId') = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301'
  and (:'direct_unit_reporting_result'::jsonb -> 'summary' ->> 'assignedLearners')::integer = 1
  and jsonb_array_length(:'direct_unit_reporting_result'::jsonb -> 'learners') = 1,
  'unit reporting filter scopes learner detail to direct active unit learners'
);

select public.admin_get_lms_reporting(:'reporting_alpha_org_id'::uuid, null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1304'::uuid, 50) as cohort_unit_reporting_result
\gset

select extensions.ok(
  (:'cohort_unit_reporting_result'::jsonb -> 'summary' ->> 'assignedLearners')::integer = 2
  and jsonb_array_length(:'cohort_unit_reporting_result'::jsonb -> 'cohortComparison') = 1,
  'unit reporting filter includes learners through cohort-unit association'
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
  format($$ select public.admin_get_lms_reporting(%L::uuid, null, null, null, 50) $$, :'reporting_beta_org_id'),
  '42501',
  'Reporting access required.',
  'report viewer cannot read another organisation reporting'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333203', true);
set local role authenticated;

select public.admin_get_lms_reporting(:'reporting_alpha_org_id'::uuid, null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301'::uuid, 50) as supervisor_unit_reporting_result
\gset

select extensions.ok(
  (:'supervisor_unit_reporting_result'::jsonb -> 'summary' ->> 'assignedLearners')::integer = 1
  and jsonb_array_length(:'supervisor_unit_reporting_result'::jsonb -> 'learners') = 1,
  'unit-scoped supervisor sees only learners assigned to the permitted unit'
);

select extensions.throws_ok(
  format($$ select public.admin_get_lms_reporting(%L::uuid, null, null, null, 50) $$, :'reporting_alpha_org_id'),
  '42501',
  'Reporting access required.',
  'unit-scoped supervisor cannot read whole-organisation reporting'
);

select extensions.throws_ok(
  format($$ select public.admin_get_lms_reporting(%L::uuid, null, null, %L::uuid, 50) $$, :'reporting_alpha_org_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1304'),
  '42501',
  'Reporting access required.',
  'unit-scoped supervisor cannot read another unit'
);

select public.admin_get_instructor_workspace(:'reporting_alpha_org_id'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301'::uuid, 50) as instructor_workspace_result
\gset

select extensions.ok(
  (:'instructor_workspace_result'::jsonb ->> 'canAct')::boolean
  and jsonb_array_length(:'instructor_workspace_result'::jsonb -> 'learners') = 1
  and jsonb_array_length(:'instructor_workspace_result'::jsonb -> 'missionEvidence') = 1
  and jsonb_array_length(:'instructor_workspace_result'::jsonb -> 'openInterventions') = 1,
  'unit-scoped instructor workspace includes only permitted learner operations data'
);

select public.admin_get_instructor_workspace(:'reporting_alpha_org_id'::uuid, null, 50) as instructor_all_units_workspace_result
\gset

select extensions.ok(
  jsonb_array_length(:'instructor_all_units_workspace_result'::jsonb -> 'learners') = 1
  and jsonb_array_length(:'instructor_all_units_workspace_result'::jsonb -> 'units') = 1,
  'unit-scoped instructor all-units workspace stays limited to assigned units'
);

select public.admin_send_instructor_scoped_notification(
  :'reporting_alpha_org_id'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa1301'::uuid,
  array['11111111-1111-4111-8111-111111111201'::uuid],
  'Scoped instructor reminder',
  'Please continue your assigned programme.',
  '/notifications'
) as instructor_notification_result
\gset

reset role;
set local role service_role;

select extensions.ok(
  (:'instructor_notification_result'::jsonb ->> 'createdCount')::integer = 1
  and exists (
    select 1
    from public.user_notifications
    where user_id = '11111111-1111-4111-8111-111111111201'::uuid
      and event_type = 'instructor_scoped_reminder'
      and title = 'Scoped instructor reminder'
  )
  and exists (
    select 1
    from public.audit_events
    where actor_user_id = '33333333-3333-4333-8333-333333333203'::uuid
      and event_type = 'instructor_scoped_notification_sent'
  ),
  'unit-scoped instructor sends audited reminders through notification infrastructure'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333203', true);
set local role authenticated;

select public.admin_update_lms_intervention_status(
  'dddddddd-dddd-4ddd-8ddd-dddddddd1201'::uuid,
  'acknowledged',
  'Instructor contacted learner.'
) as instructor_intervention_update_result
\gset

reset role;
set local role service_role;

select extensions.ok(
  (:'instructor_intervention_update_result'::jsonb ->> 'status') = 'acknowledged'
  and exists (
    select 1
    from public.audit_events
    where actor_user_id = '33333333-3333-4333-8333-333333333203'::uuid
      and event_type = 'lms_intervention_status_updated'
      and entity_id = 'dddddddd-dddd-4ddd-8ddd-dddddddd1201'
  ),
  'unit-scoped instructor can update permitted interventions with audit trail'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444204', true);
set local role authenticated;

select extensions.throws_ok(
  format($$ select public.admin_get_instructor_workspace(%L::uuid, null, 50) $$, :'reporting_alpha_org_id'),
  '42501',
  'Instructor workspace access required.',
  'active instructor membership alone is not enough for assignment-scoped workspace access'
);

select extensions.throws_ok(
  $$ select public.admin_update_lms_intervention_status('dddddddd-dddd-4ddd-8ddd-dddddddd1201'::uuid, 'resolved', 'Broad instructor attempted update.') $$,
  '42501',
  'Scoped instructor access required.',
  'active instructor membership alone cannot update unrelated interventions'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.ok(
  not (public.admin_get_instructor_workspace(:'reporting_alpha_org_id'::uuid, null, 50) ->> 'canAct')::boolean
  and (public.admin_get_instructor_workspace(:'reporting_alpha_org_id'::uuid, null, 50) ->> 'readOnly')::boolean,
  'report viewer instructor workspace remains read-only'
);

select extensions.throws_ok(
  format(
    $$ select public.admin_send_instructor_scoped_notification(%L::uuid, null, array[%L::uuid], 'Read-only attempt', 'No send', '/notifications') $$,
    :'reporting_alpha_org_id',
    '11111111-1111-4111-8111-111111111201'
  ),
  '42501',
  'Scoped instructor access required.',
  'report viewer cannot send scoped reminders'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.ok(
  (public.admin_get_lms_reporting(null, null, null, null, 10) -> 'summary' ->> 'assignedLearners')::integer >= 2,
  'platform admin can run cross-organisation reporting'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.throws_ok(
  $$ select public.admin_get_lms_reporting(null, null, null, null, 50) $$,
  '42501',
  'permission denied for function admin_get_lms_reporting',
  'anon cannot execute LMS reporting RPC'
);

reset role;

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_get_lms_reporting(uuid, uuid, uuid, uuid, integer)', 'execute')
  and not has_function_privilege('anon', 'public.admin_get_lms_reporting(uuid, uuid, uuid, uuid, integer)', 'execute'),
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
