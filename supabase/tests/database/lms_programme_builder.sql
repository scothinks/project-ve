begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(20);

set local role service_role;

insert into public.organizations (slug, name, status, created_by)
values
  ('lms-programme-alpha', 'LMS Programme Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('lms-programme-beta', 'LMS Programme Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as programme_alpha_org_id
from public.organizations
where slug = 'lms-programme-alpha'
\gset

select id as programme_beta_org_id
from public.organizations
where slug = 'lms-programme-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'programme_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'programme_beta_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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
  estimated_minutes
)
values (
  'course-lms-programme-platform',
  'course-lms-programme-platform',
  'LMS Programme Platform Course',
  'A reusable platform course.',
  'Organisation learners',
  array['Complete programme course'],
  'Values Education',
  'beginner',
  'published',
  920,
  10
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

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
values
  (
    'course-lms-programme-alpha-private',
    'course-lms-programme-alpha-private',
    'LMS Programme Alpha Private Course',
    'An alpha private course.',
    'Alpha learners',
    array['Complete alpha private course'],
    'Values Education',
    'beginner',
    'draft',
    921,
    8,
    'organization_private',
    :'programme_alpha_org_id'::uuid
  ),
  (
    'course-lms-programme-beta-private',
    'course-lms-programme-beta-private',
    'LMS Programme Beta Private Course',
    'A beta private course.',
    'Beta learners',
    array['Complete beta private course'],
    'Values Education',
    'beginner',
    'draft',
    922,
    8,
    'organization_private',
    :'programme_beta_org_id'::uuid
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      organization_id = excluded.organization_id;

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
  'mission-lms-programme',
  'LMS Programme Mission',
  'Complete a programme action.',
  'course',
  'xp',
  25,
  'once',
  'course_completed',
  '{"courseId":"course-lms-programme-platform"}'::jsonb,
  'published',
  920
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

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
  shared_with_programmes
)
values (
  'reward-lms-programme',
  'LMS Programme Reward',
  'A programme reward.',
  100,
  'published',
  true,
  'direct',
  'manual',
  'store',
  10,
  10,
  1,
  'lifetime',
  920,
  'platform_owned',
  true
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      is_enabled = excluded.is_enabled,
      owner_scope = excluded.owner_scope,
      shared_with_programmes = excluded.shared_with_programmes;

insert into public.assessment_versions (
  slug,
  title,
  description,
  xp_award,
  status,
  published_at
)
values (
  'lms-programme-assessment',
  'LMS Programme Assessment',
  'Programme readiness assessment.',
  0,
  'published',
  now()
)
on conflict (slug) do update
  set title = excluded.title,
      status = excluded.status
returning id as programme_assessment_id
\gset

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_upsert_programme(
  null,
  :'programme_alpha_org_id'::uuid,
  'Alpha Values Programme',
  'alpha-values-programme',
  'Help alpha learners practise the values curriculum.',
  'Alpha organisation learners',
  'draft',
  '2026-09-01 09:00:00+00'::timestamptz,
  '2026-10-01 09:00:00+00'::timestamptz,
  '{"requiredCourseCount":2,"missionCount":1}'::jsonb,
  array['course-lms-programme-platform', 'course-lms-programme-alpha-private']::text[],
  array['mission-lms-programme']::text[],
  array['reward-lms-programme']::text[],
  array[:'programme_assessment_id'::uuid]::uuid[]
) as programme_result
\gset

select extensions.is(
  (
    select organization_id
    from public.programmes
    where id = (:'programme_result'::jsonb ->> 'programmeId')::uuid
  ),
  :'programme_alpha_org_id'::uuid,
  'programme manager can create an organisation-owned programme'
);

select extensions.is(
  (
    select string_agg(course_id, ',' order by sort_order)
    from public.programme_courses
    where programme_id = (:'programme_result'::jsonb ->> 'programmeId')::uuid
  ),
  'course-lms-programme-platform,course-lms-programme-alpha-private',
  'programme course sequence preserves selected course order'
);

select extensions.ok(
  (
    select count(*) = 1
    from public.programme_missions
    where programme_id = (:'programme_result'::jsonb ->> 'programmeId')::uuid
  )
  and (
    select count(*) = 1
    from public.programme_rewards
    where programme_id = (:'programme_result'::jsonb ->> 'programmeId')::uuid
  )
  and (
    select count(*) = 1
    from public.programme_assessments
    where programme_id = (:'programme_result'::jsonb ->> 'programmeId')::uuid
  ),
  'programme builder stores mission, reward and assessment selections'
);

select public.admin_upsert_programme(
  null,
  :'programme_alpha_org_id'::uuid,
  'Alpha Follow-up Programme',
  'alpha-follow-up-programme',
  'Reuse the shared platform course.',
  'Alpha organisation learners',
  'draft',
  null,
  null,
  '{"requiredCourseCount":1}'::jsonb,
  array['course-lms-programme-platform']::text[],
  '{}'::text[],
  '{}'::text[],
  '{}'::uuid[]
) as second_programme_result
\gset

select extensions.is(
  (
    select count(*)::integer
    from public.programme_courses
    where course_id = 'course-lms-programme-platform'
      and programme_id in (
        (:'programme_result'::jsonb ->> 'programmeId')::uuid,
        (:'second_programme_result'::jsonb ->> 'programmeId')::uuid
      )
  ),
  2,
  'courses remain reusable across programmes'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        null,
        %L::uuid,
        'Cross Org Programme',
        'cross-org-programme',
        'Attempt cross organisation content.',
        'Alpha learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        array['course-lms-programme-beta-private']::text[],
        '{}'::text[],
        '{}'::text[],
        '{}'::uuid[]
      )
    $$,
    :'programme_alpha_org_id'
  ),
  'P0001',
  'Programme courses must be active platform courses or organisation-owned courses for the same organisation.',
  'programme builder rejects private courses from another organisation'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        null,
        %L::uuid,
        'Unauthorized Programme',
        'unauthorized-programme',
        'Attempt unauthorized programme creation.',
        'Beta learners',
        'draft',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        '{}'::text[],
        '{}'::uuid[]
      )
    $$,
    :'programme_beta_org_id'
  ),
  'P0001',
  'Programme manager access required.',
  'organisation learner cannot create programmes'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        null,
        %L::uuid,
        'No Course Published Programme',
        'no-course-published-programme',
        'Missing course.',
        'Alpha learners',
        'published',
        null,
        null,
        '{}'::jsonb,
        '{}'::text[],
        '{}'::text[],
        '{}'::text[],
        '{}'::uuid[]
      )
    $$,
    :'programme_alpha_org_id'
  ),
  'P0001',
  'Published programmes require at least one course.',
  'published programmes require at least one course'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        null,
        %L::uuid,
        'No Audience Published Programme',
        'no-audience-published-programme',
        '',
        '',
        'published',
        null,
        null,
        '{}'::jsonb,
        array['course-lms-programme-platform']::text[],
        '{}'::text[],
        '{}'::text[],
        '{}'::uuid[]
      )
    $$,
    :'programme_alpha_org_id'
  ),
  'P0001',
  'Published programmes require an objective and intended audience.',
  'published programmes require objective and audience'
);

select public.admin_set_programme_status(
  (:'programme_result'::jsonb ->> 'programmeId')::uuid,
  'published'
) as programme_status_result
\gset

select extensions.is(
  (
    select status
    from public.programmes
    where id = (:'programme_result'::jsonb ->> 'programmeId')::uuid
  ),
  'published'::public.content_status,
  'programme manager can publish a complete programme'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_upsert_programme(
  null,
  :'programme_beta_org_id'::uuid,
  'Beta Published Programme',
  'beta-published-programme',
  'Help beta learners practise the values curriculum.',
  'Beta organisation learners',
  'published',
  null,
  null,
  '{"requiredCourseCount":1}'::jsonb,
  array['course-lms-programme-platform']::text[],
  '{}'::text[],
  '{}'::text[],
  '{}'::uuid[]
) as beta_published_programme_result
\gset

select public.admin_upsert_programme(
  null,
  :'programme_beta_org_id'::uuid,
  'Beta Draft Programme',
  'beta-draft-programme',
  'Draft beta programme.',
  'Beta organisation learners',
  'draft',
  null,
  null,
  '{}'::jsonb,
  '{}'::text[],
  '{}'::text[],
  '{}'::text[],
  '{}'::uuid[]
) as beta_draft_programme_result
\gset

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.programmes
    where organization_id = :'programme_beta_org_id'::uuid
  ),
  1,
  'organisation learner can read published programmes in their organisation only'
);

select extensions.ok(
  exists (
    select 1
    from public.programmes
    where id = (:'beta_published_programme_result'::jsonb ->> 'programmeId')::uuid
  )
  and not exists (
    select 1
    from public.programmes
    where id = (:'beta_draft_programme_result'::jsonb ->> 'programmeId')::uuid
  ),
  'organisation learner cannot read draft programmes they do not manage'
);

reset role;
set local role service_role;

insert into public.programmes (
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status
)
values (
  :'programme_alpha_org_id'::uuid,
  'alpha-trigger-programme',
  'Alpha Trigger Programme',
  'Trigger enforcement.',
  'Alpha learners',
  'draft'
)
returning id as trigger_programme_id
\gset

select extensions.throws_ok(
  format(
    $$ insert into public.programme_courses (programme_id, course_id, sort_order) values (%L::uuid, 'course-lms-programme-beta-private', 1) $$,
    :'trigger_programme_id'
  ),
  'P0001',
  'Organisation-owned courses can only be used by programmes in the same organisation.',
  'programme course trigger blocks cross-organisation private courses even outside the RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.is(
  (select count(*)::integer from public.programmes),
  0,
  'anon cannot read programmes'
);

select extensions.throws_ok(
  $$ select public.admin_set_programme_status('11111111-1111-4111-8111-111111111111'::uuid, 'published') $$,
  '42501',
  'permission denied for function admin_set_programme_status',
  'anon cannot execute programme lifecycle RPC'
);

reset role;

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_upsert_programme(uuid, uuid, text, text, text, text, public.content_status, timestamp with time zone, timestamp with time zone, jsonb, text[], text[], text[], uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.admin_upsert_programme(uuid, uuid, text, text, text, text, public.content_status, timestamp with time zone, timestamp with time zone, jsonb, text[], text[], text[], uuid[])', 'execute'),
  'programme builder RPC is authenticated only before in-function contextual role checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.current_user_can_manage_programme(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.current_user_can_manage_programme(uuid)', 'execute'),
  'programme management helper is authenticated only'
);

select extensions.ok(
  not has_function_privilege('service_role', 'public.enforce_programme_course_catalog_scope()', 'execute')
  and not has_function_privilege('authenticated', 'public.enforce_programme_course_catalog_scope()', 'execute'),
  'programme course enforcement trigger is not directly executable by API roles'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_upsert_programme'
      and identity_arguments = 'p_programme_id uuid, p_organization_id uuid, p_title text, p_slug text, p_objective text, p_intended_audience text, p_status content_status, p_schedule_starts_at timestamp with time zone, p_schedule_ends_at timestamp with time zone, p_completion_rules jsonb, p_course_ids text[], p_mission_ids text[], p_reward_ids text[], p_assessment_version_ids uuid[]'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'programme builder RPC is explicitly classified'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_set_programme_status'
      and identity_arguments = 'p_programme_id uuid, p_status content_status'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'programme lifecycle RPC is explicitly classified'
);

select extensions.ok(
  exists(select 1 from public.programmes where id = (:'second_programme_result'::jsonb ->> 'programmeId')::uuid)
  and exists(select 1 from public.programme_courses where programme_id = (:'second_programme_result'::jsonb ->> 'programmeId')::uuid),
  'second programme remains intact after later failed programme operations'
);

select * from extensions.finish();

rollback;
