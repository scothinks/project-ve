begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(12);

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

insert into public.programmes (organization_id, slug, title, objective, intended_audience, status)
values (:'p15c_xp_learning_org_id'::uuid, 'p15c-xp-learning-programme', 'P15C XP Learning Programme', '', '', 'published')
on conflict (organization_id, slug) do update set title = excluded.title
returning id as p15c_xp_learning_programme_id \gset

insert into public.missions (id, title, description, category, reward_xp, reward_type, repeatability, validation_type, status, validation_config)
values ('mission-p15c-xp-learning', 'P15C XP Learning Mission', 'Account-aware mission fixture.', 'course', 30, 'xp', 'once', 'course_completed', 'published', '{"courseId":"course-core-civic-values"}'::jsonb)
on conflict (id) do update set reward_xp = excluded.reward_xp, reward_type = excluded.reward_type, status = excluded.status;

insert into public.programme_missions (programme_id, mission_id, sort_order, xp_account_id)
values (:'p15c_xp_learning_programme_id'::uuid, 'mission-p15c-xp-learning', 1, :'p15c_xp_learning_account_id'::uuid)
on conflict (programme_id, mission_id) do update set xp_account_id = excluded.xp_account_id;

insert into public.enrolments (organization_id, user_id, programme_id, assignment_source, status, xp_account_id)
values (:'p15c_xp_learning_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, :'p15c_xp_learning_programme_id'::uuid, 'manual', 'active', :'p15c_xp_learning_account_id'::uuid)
on conflict do nothing;

insert into public.courses (id, slug, title, description, intended_audience, learning_outcomes, category, level, status, sort_order, estimated_minutes)
values ('course-p15c-xp-learning', 'course-p15c-xp-learning', 'P15C XP Learning Course', 'Account-aware course fixture.', 'Learners', array['Complete the course'], 'Values Education', 'beginner', 'published', 999, 5)
on conflict (id) do update set title = excluded.title, status = excluded.status;

insert into public.programme_courses (programme_id, course_id, sort_order)
values (:'p15c_xp_learning_programme_id'::uuid, 'course-p15c-xp-learning', 1)
on conflict (programme_id, course_id) do nothing;

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
