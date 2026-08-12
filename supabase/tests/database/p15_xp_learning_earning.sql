begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(22);

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (:'TEST_LEARNER_USER_ID'::uuid, 'authenticated', 'authenticated', 'pgtap-xp-learning-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('99999999-9999-4999-8999-999999999903'::uuid, 'authenticated', 'authenticated', 'pgtap-xp-learning-outsider@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update set email = excluded.email, updated_at = now();

set local role service_role;

insert into public.profiles (id, display_name, role)
values
  (:'TEST_LEARNER_USER_ID'::uuid, 'P15 XP Learning Learner', 'learner'),
  ('99999999-9999-4999-8999-999999999903'::uuid, 'P15 XP Learning Outsider', 'learner')
on conflict (id) do update set display_name = excluded.display_name, role = excluded.role;

insert into public.organizations (slug, name, status, created_by)
values ('p15c-xp-learning-org', 'P15C XP Learning Org', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update set name = excluded.name;

select id as p15c_xp_learning_org_id from public.organizations where slug = 'p15c-xp-learning-org' \gset
select id as p15c_xp_learning_account_id from public.xp_accounts where organization_id = :'p15c_xp_learning_org_id'::uuid and is_default \gset

insert into public.organizations (slug, name, status, created_by)
values ('p15d-xp-learning-church-org', 'P15D XP Learning Church Org', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update set name = excluded.name;

select id as p15d_xp_learning_church_org_id from public.organizations where slug = 'p15d-xp-learning-church-org' \gset
select id as p15d_xp_learning_church_account_id from public.xp_accounts where organization_id = :'p15d_xp_learning_church_org_id'::uuid and is_default \gset

insert into public.organization_plan_assignments (organization_id, plan_key, billing_status, assigned_by)
values
  (:'p15c_xp_learning_org_id'::uuid, 'team', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15d_xp_learning_church_org_id'::uuid, 'team', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict do nothing;

insert into public.programmes (organization_id, slug, title, objective, intended_audience, status)
values (:'p15c_xp_learning_org_id'::uuid, 'p15c-xp-learning-programme', 'P15C XP Learning Programme', '', '', 'published')
on conflict (organization_id, slug) do update set title = excluded.title
returning id as p15c_xp_learning_programme_id \gset

insert into public.programmes (organization_id, slug, title, objective, intended_audience, status)
values (:'p15d_xp_learning_church_org_id'::uuid, 'p15d-xp-learning-church-programme', 'P15D XP Learning Church Programme', '', '', 'published')
on conflict (organization_id, slug) do update set title = excluded.title
returning id as p15d_xp_learning_church_programme_id \gset

insert into public.missions (id, title, description, category, reward_xp, reward_type, repeatability, validation_type, status, validation_config)
values ('mission-p15c-xp-learning', 'P15C XP Learning Mission', 'Account-aware mission fixture.', 'course', 30, 'xp', 'once', 'course_completed', 'published', '{"courseId":"course-core-civic-values"}'::jsonb)
on conflict (id) do update set reward_xp = excluded.reward_xp, reward_type = excluded.reward_type, status = excluded.status;

insert into public.programme_missions (programme_id, mission_id, sort_order, xp_account_id)
values (:'p15c_xp_learning_programme_id'::uuid, 'mission-p15c-xp-learning', 1, :'p15c_xp_learning_account_id'::uuid)
on conflict (programme_id, mission_id) do update set xp_account_id = excluded.xp_account_id;

insert into public.enrolments (organization_id, user_id, programme_id, assignment_source, status, xp_account_id)
values (:'p15c_xp_learning_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, :'p15c_xp_learning_programme_id'::uuid, 'manual', 'active', :'p15c_xp_learning_account_id'::uuid)
on conflict do nothing;

insert into public.enrolments (organization_id, user_id, programme_id, assignment_source, status, xp_account_id)
values (:'p15d_xp_learning_church_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, :'p15d_xp_learning_church_programme_id'::uuid, 'manual', 'active', :'p15d_xp_learning_church_account_id'::uuid)
on conflict do nothing;

insert into public.courses (id, slug, title, description, intended_audience, learning_outcomes, category, level, status, sort_order, estimated_minutes)
values ('course-p15c-xp-learning', 'course-p15c-xp-learning', 'P15C XP Learning Course', 'Account-aware course fixture.', 'Learners', array['Complete the course'], 'Values Education', 'beginner', 'published', 999, 5)
on conflict (id) do update set title = excluded.title, status = excluded.status;

insert into public.programme_courses (programme_id, course_id, sort_order)
values (:'p15c_xp_learning_programme_id'::uuid, 'course-p15c-xp-learning', 1)
on conflict (programme_id, course_id) do nothing;

insert into public.assessment_versions (
  id,
  slug,
  title,
  description,
  xp_award,
  status,
  published_at
)
values (
  '44444444-4444-4444-8444-0000000015d1'::uuid,
  'p15d-contextual-assessment',
  'P15D Contextual Assessment',
  'Programme-scoped assessment fixture.',
  0,
  'draft',
  null
)
on conflict (id) do update
set title = excluded.title,
    status = excluded.status,
    xp_award = excluded.xp_award,
    published_at = excluded.published_at;

insert into public.assessment_questions (
  id,
  assessment_version_id,
  prompt,
  helper_text,
  sort_order
)
values (
  '44444444-4444-4444-8444-0000000015d2'::uuid,
  '44444444-4444-4444-8444-0000000015d1'::uuid,
  'How should contextual assessment completion be stored?',
  null,
  1
)
on conflict (id) do update
set prompt = excluded.prompt,
    sort_order = excluded.sort_order;

insert into public.assessment_question_options (
  id,
  question_id,
  label,
  description,
  sort_order
)
values (
  '44444444-4444-4444-8444-0000000015d3'::uuid,
  '44444444-4444-4444-8444-0000000015d2'::uuid,
  'Keep organisation context separate',
  null,
  1
)
on conflict (id) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

insert into public.assessment_option_dimension_weights (
  option_id,
  dimension_id,
  weight
)
values (
  '44444444-4444-4444-8444-0000000015d3'::uuid,
  'integrity',
  1
)
on conflict (option_id, dimension_id) do update
set weight = excluded.weight;

update public.assessment_versions
set status = 'published',
    published_at = coalesce(published_at, now())
where id = '44444444-4444-4444-8444-0000000015d1'::uuid;

insert into public.programme_assessments (
  programme_id,
  assessment_version_id,
  sort_order,
  xp_account_id
)
values (
  :'p15c_xp_learning_programme_id'::uuid,
  '44444444-4444-4444-8444-0000000015d1'::uuid,
  1,
  :'p15c_xp_learning_account_id'::uuid
)
on conflict (programme_id, assessment_version_id) do update
set sort_order = excluded.sort_order,
    xp_account_id = excluded.xp_account_id;

insert into public.programme_assessments (
  programme_id,
  assessment_version_id,
  sort_order,
  xp_account_id
)
values (
  :'p15d_xp_learning_church_programme_id'::uuid,
  '44444444-4444-4444-8444-0000000015d1'::uuid,
  1,
  :'p15d_xp_learning_church_account_id'::uuid
)
on conflict (programme_id, assessment_version_id) do update
set sort_order = excluded.sort_order,
    xp_account_id = excluded.xp_account_id;

insert into public.lessons (id, course_id, slug, title, description, status, sort_order, estimated_minutes)
values (
  'lesson-p15c-xp-learning',
  'course-p15c-xp-learning',
  'lesson-p15c-xp-learning',
  'P15C XP Learning Lesson',
  'Contextual completion fixture.',
  'published',
  1,
  5
)
on conflict (id) do update
set title = excluded.title,
    status = excluded.status;

insert into public.lesson_pages (id, lesson_id, page_number, title, subtitle, page_type)
values (
  'page-p15c-xp-learning',
  'lesson-p15c-xp-learning',
  1,
  'P15C XP Learning Page',
  null,
  'concept'
)
on conflict (id) do update
set title = excluded.title;

insert into public.quizzes (id, lesson_id, title, version, status)
values (
  'quiz-p15c-xp-learning',
  'lesson-p15c-xp-learning',
  'P15C XP Learning Quiz',
  1,
  'published'
)
on conflict (id) do update
set title = excluded.title,
    status = excluded.status;

select extensions.is(
  (select default_xp_account_id from public.programmes where id = :'p15c_xp_learning_programme_id'::uuid),
  :'p15c_xp_learning_account_id'::uuid,
  'programme defaults to its organization XP account'
);

select extensions.is(
  (select xp_account_id from public.enrolments where user_id = :'TEST_LEARNER_USER_ID'::uuid and programme_id = :'p15c_xp_learning_programme_id'::uuid),
  :'p15c_xp_learning_account_id'::uuid,
  'programme enrolment snapshots the trusted XP account'
);

select extensions.is(
  (select xp_account_id from public.programme_missions where programme_id = :'p15c_xp_learning_programme_id'::uuid and mission_id = 'mission-p15c-xp-learning'),
  :'p15c_xp_learning_account_id'::uuid,
  'programme mission records its owning XP account'
);

select extensions.is(
  (select prior_completion_policy from public.programme_courses where programme_id = :'p15c_xp_learning_programme_id'::uuid and course_id = 'course-p15c-xp-learning'),
  'recognize_prior_completion',
  'programme courses default to explicit prior-completion recognition'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;
select public.complete_values_assessment(
  '44444444-4444-4444-8444-0000000015d1'::uuid,
  jsonb_build_array(
    jsonb_build_object(
      'question_id', '44444444-4444-4444-8444-0000000015d2',
      'option_id', '44444444-4444-4444-8444-0000000015d3'
    )
  ),
  :'p15c_xp_learning_programme_id'::uuid
);

reset role;
set local role service_role;

select extensions.is(
  (select xp_account_id
   from public.user_assessment_attempts
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and assessment_version_id = '44444444-4444-4444-8444-0000000015d1'::uuid
   order by completed_at desc
   limit 1),
  :'p15c_xp_learning_account_id'::uuid,
  'contextual assessment attempt records the organization XP account'
);

select extensions.is_empty(
  format(
    $$ select 1 from public.user_value_profiles where user_id = %L::uuid and context_scope = 'platform' and organization_id is null $$,
    :'TEST_LEARNER_USER_ID'
  ),
  'contextual assessment completion does not satisfy the public value profile gate'
);

select extensions.is(
  (select context_scope || ':' || organization_id::text
   from public.user_value_profiles
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and context_scope = 'organization'
     and organization_id = :'p15c_xp_learning_org_id'::uuid),
  'organization:' || :'p15c_xp_learning_org_id',
  'contextual assessment completion creates the first organization recommendation profile'
);

select extensions.is(
  (select count(*)::integer
   from public.user_value_dimension_scores
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and context_scope = 'organization'
     and organization_id = :'p15c_xp_learning_org_id'::uuid),
  (select count(*)::integer from public.value_dimensions where status = 'active'),
  'contextual assessment scores are scoped to the first organization'
);

select latest_attempt_id as p15d_police_profile_attempt_id
from public.user_value_profiles
where user_id = :'TEST_LEARNER_USER_ID'::uuid
  and context_scope = 'organization'
  and organization_id = :'p15c_xp_learning_org_id'::uuid
\gset

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;
select public.complete_values_assessment(
  '44444444-4444-4444-8444-0000000015d1'::uuid,
  jsonb_build_array(
    jsonb_build_object(
      'question_id', '44444444-4444-4444-8444-0000000015d2',
      'option_id', '44444444-4444-4444-8444-0000000015d3'
    )
  ),
  :'p15d_xp_learning_church_programme_id'::uuid
);

reset role;
set local role service_role;

select extensions.is(
  (select latest_attempt_id
   from public.user_value_profiles
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and context_scope = 'organization'
     and organization_id = :'p15c_xp_learning_org_id'::uuid),
  :'p15d_police_profile_attempt_id'::uuid,
  'second organization assessment does not overwrite the first organization profile'
);

select extensions.is(
  (select xp_account_id
   from public.user_assessment_attempts
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and programme_id = :'p15d_xp_learning_church_programme_id'::uuid
   order by completed_at desc
   limit 1),
  :'p15d_xp_learning_church_account_id'::uuid,
  'second organization assessment attempt records its own organization XP account'
);

select extensions.is(
  (select count(*)::integer
   from public.user_value_profiles
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and context_scope = 'organization'
     and organization_id in (:'p15c_xp_learning_org_id'::uuid, :'p15d_xp_learning_church_org_id'::uuid)),
  2,
  'learner can hold separate organization recommendation profiles'
);

reset role;

select public.grant_mission_award(
  :'TEST_LEARNER_USER_ID'::uuid,
  'mission-p15c-xp-learning',
  'p15c-xp-learning:award',
  jsonb_build_object(
    'programmeId', :'p15c_xp_learning_programme_id'::uuid,
    'programmeMissionId', 'mission-p15c-xp-learning',
    'xpAccountId', '00000000-0000-4000-8000-00000000e001'::uuid
  )
) as p15c_xp_learning_award \gset

select extensions.is(
  :'p15c_xp_learning_award'::jsonb ->> 'status',
  'awarded',
  'programme mission award succeeds for an active programme learner'
);

select extensions.is(
  (select xp_account_id from public.xp_transactions where award_scope = 'mission:mission-p15c-xp-learning:p15c-xp-learning:award'),
  :'p15c_xp_learning_account_id'::uuid,
  'programme mission award resolves organization XP instead of caller metadata'
);

select extensions.is(
  (select xp_account_id from public.mission_awards where user_id = :'TEST_LEARNER_USER_ID'::uuid and mission_id = 'mission-p15c-xp-learning' and award_scope = 'p15c-xp-learning:award'),
  :'p15c_xp_learning_account_id'::uuid,
  'mission award records the account that received the XP'
);

select extensions.is(
  (select balance_cached from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = :'p15c_xp_learning_account_id'::uuid),
  30,
  'programme mission award credits only the organization account balance'
);

select extensions.throws_like(
  format(
    $$ select public.grant_mission_award(%L::uuid, 'mission-p15c-xp-learning', 'p15c-xp-learning:outsider', jsonb_build_object('programmeId', %L::uuid, 'programmeMissionId', 'mission-p15c-xp-learning')) $$,
    '99999999-9999-4999-8999-999999999903',
    :'p15c_xp_learning_programme_id'
  ),
  '%Active programme enrolment is required%',
  'programme metadata cannot award organization points to an unenrolled learner'
);

select extensions.throws_like(
  format(
    $$ update public.programme_missions set xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid where programme_id = %L::uuid and mission_id = 'mission-p15c-xp-learning' $$,
    :'p15c_xp_learning_programme_id'
  ),
  '%Programme XP account must be active and owned by the programme organization%',
  'programme configuration cannot use the platform XP account'
);

reset role;
set local role service_role;

update public.programme_courses
set prior_completion_policy = 'require_completion_in_context'
where programme_id = :'p15c_xp_learning_programme_id'::uuid
  and course_id = 'course-p15c-xp-learning';

insert into public.course_completions (
  organization_id, user_id, course_id, status, progress_percent, completed_at
)
values (
  :'p15c_xp_learning_org_id'::uuid,
  :'TEST_LEARNER_USER_ID'::uuid,
  'course-p15c-xp-learning',
  'completed',
  100,
  now()
)
on conflict (user_id, course_id) do update
set status = excluded.status, progress_percent = excluded.progress_percent, completed_at = excluded.completed_at;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;
select public.evaluate_programme_completion(:'p15c_xp_learning_programme_id'::uuid);

select extensions.is(
  (select status from public.programme_course_completions
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and programme_id = :'p15c_xp_learning_programme_id'::uuid
     and course_id = 'course-p15c-xp-learning'),
  'in_progress',
  'require_completion_in_context does not accept a public-only course completion'
);

reset role;
set local role service_role;

insert into public.lesson_page_completions (user_id, lesson_id, page_id, completed_at)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  'lesson-p15c-xp-learning',
  'page-p15c-xp-learning',
  now()
)
on conflict (user_id, lesson_id, page_id) do update
set completed_at = excluded.completed_at;

insert into public.lesson_progress (user_id, lesson_id, completed_pages, quiz_score, completed_at)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  'lesson-p15c-xp-learning',
  array['page-p15c-xp-learning']::text[],
  0,
  now()
)
on conflict (user_id, lesson_id) do update
set completed_pages = excluded.completed_pages,
    completed_at = excluded.completed_at;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  public.start_quiz_attempt(
    'quiz-p15c-xp-learning',
    'lesson-p15c-xp-learning',
    :'p15c_xp_learning_programme_id'::uuid,
    :'p15c_xp_learning_org_id'::uuid
  ) ->> 'status',
  'blocked',
  'contextual quiz start is blocked when only public lesson progress exists'
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
  ended_reason,
  programme_id,
  xp_account_id
)
values (
  '44444444-4444-4444-8444-0000000015c1'::uuid,
  :'TEST_LEARNER_USER_ID'::uuid,
  'lesson-p15c-xp-learning',
  'quiz-p15c-xp-learning',
  1,
  'earning',
  'graded',
  'p15c-contextual-quiz',
  now(),
  'submitted',
  :'p15c_xp_learning_programme_id'::uuid,
  :'p15c_xp_learning_account_id'::uuid
)
on conflict (id) do update
set status = excluded.status,
    programme_id = excluded.programme_id,
    xp_account_id = excluded.xp_account_id;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;
select public.evaluate_programme_completion(:'p15c_xp_learning_programme_id'::uuid);

select extensions.is(
  (select status from public.programme_course_completions
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and programme_id = :'p15c_xp_learning_programme_id'::uuid
     and course_id = 'course-p15c-xp-learning'),
  'in_progress',
  'require_completion_in_context does not accept public lesson progress plus a contextual quiz'
);

reset role;
set local role service_role;

insert into public.programme_lesson_page_completions (user_id, programme_id, lesson_id, page_id, completed_at)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15c_xp_learning_programme_id'::uuid,
  'lesson-p15c-xp-learning',
  'page-p15c-xp-learning',
  now()
)
on conflict (user_id, programme_id, lesson_id, page_id) do update
set completed_at = excluded.completed_at;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;
select public.evaluate_programme_completion(:'p15c_xp_learning_programme_id'::uuid);

select extensions.is(
  (select status from public.programme_course_completions
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and programme_id = :'p15c_xp_learning_programme_id'::uuid
     and course_id = 'course-p15c-xp-learning'),
  'completed',
  'contextual lesson page completion satisfies require_completion_in_context'
);

reset role;
set local role service_role;
update public.programme_courses
set prior_completion_policy = 'recognize_prior_completion'
where programme_id = :'p15c_xp_learning_programme_id'::uuid
  and course_id = 'course-p15c-xp-learning';

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;
select public.evaluate_programme_completion(:'p15c_xp_learning_programme_id'::uuid);

select extensions.is(
  (select status from public.programme_course_completions
   where user_id = :'TEST_LEARNER_USER_ID'::uuid
     and programme_id = :'p15c_xp_learning_programme_id'::uuid
     and course_id = 'course-p15c-xp-learning'),
  'completed',
  'recognize_prior_completion records the public completion in programme context'
);

select * from extensions.finish();
rollback;
