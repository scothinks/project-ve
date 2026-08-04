begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(16);

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
    '44444444-4444-4444-8444-444444444401',
    'authenticated',
    'authenticated',
    'pgtap-p1-release-learner@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555501',
    'authenticated',
    'authenticated',
    'pgtap-p1-release-outsider@example.test',
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
values
  (
    '44444444-4444-4444-8444-444444444401',
    'Local pgTAP P1 Release Learner',
    0,
    0,
    'learner'
  ),
  (
    '55555555-5555-4555-8555-555555555501',
    'Local pgTAP P1 Release Outsider',
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
values
  ('lms-p1-release-alpha', 'LMS P1 Release Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('lms-p1-release-beta', 'LMS P1 Release Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as p1_alpha_org_id
from public.organizations
where slug = 'lms-p1-release-alpha'
\gset

select id as p1_beta_org_id
from public.organizations
where slug = 'lms-p1-release-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'p1_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p1_alpha_org_id'::uuid, '44444444-4444-4444-8444-444444444401'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p1_beta_org_id'::uuid, '55555555-5555-4555-8555-555555555501'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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
  'course-lms-p1-release-platform',
  'course-lms-p1-release-platform',
  'LMS P1 Release Platform Course',
  'Canonical platform course for the P1 release gate.',
  'Organisation learners',
  array['Use platform content safely'],
  'Values Education',
  'beginner',
  'published',
  980,
  12
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  description,
  status,
  sort_order,
  estimated_minutes
)
values (
  'lesson-lms-p1-release-platform',
  'course-lms-p1-release-platform',
  'lesson-lms-p1-release-platform',
  'P1 Release Platform Lesson',
  'A lesson copied into adapted content.',
  'published',
  1,
  12
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
  page_type
)
values (
  'page-lms-p1-release-platform',
  'lesson-lms-p1-release-platform',
  1,
  'P1 Release Platform Page',
  'concept'
)
on conflict (id) do update
  set title = excluded.title;

insert into public.lesson_content_blocks (
  id,
  page_id,
  block_type,
  sort_order,
  payload
)
values (
  '44444444-1111-4444-8444-444444444401'::uuid,
  'page-lms-p1-release-platform',
  'text',
  1,
  '{"html":"<p>P1 release platform content.</p>"}'::jsonb
)
on conflict (id) do update
  set payload = excluded.payload;

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
    'course-lms-p1-release-alpha-private',
    'course-lms-p1-release-alpha-private',
    'LMS P1 Release Alpha Private Course',
    'Alpha private course for isolation checks.',
    'Alpha learners',
    array['Use alpha private content'],
    'Values Education',
    'beginner',
    'published',
    981,
    8,
    'organization_private',
    :'p1_alpha_org_id'::uuid
  ),
  (
    'course-lms-p1-release-beta-private',
    'course-lms-p1-release-beta-private',
    'LMS P1 Release Beta Private Course',
    'Beta private course for isolation checks.',
    'Beta learners',
    array['Use beta private content'],
    'Values Education',
    'beginner',
    'published',
    982,
    8,
    'organization_private',
    :'p1_beta_org_id'::uuid
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      catalog_scope = excluded.catalog_scope,
      organization_id = excluded.organization_id;

insert into public.cohorts (
  organization_id,
  slug,
  title,
  description,
  status
)
values (
  :'p1_alpha_org_id'::uuid,
  'lms-p1-release-alpha-cohort',
  'LMS P1 Release Alpha Cohort',
  'Cohort used by the P1 release gate.',
  'published'
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      description = excluded.description,
      status = excluded.status;

select id as p1_alpha_cohort_id
from public.cohorts
where organization_id = :'p1_alpha_org_id'::uuid
  and slug = 'lms-p1-release-alpha-cohort'
\gset

insert into public.cohort_members (cohort_id, user_id, status, added_by)
values (
  :'p1_alpha_cohort_id'::uuid,
  '44444444-4444-4444-8444-444444444401'::uuid,
  'active',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (cohort_id, user_id) do update
  set status = excluded.status,
      added_by = excluded.added_by;

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
values
  (
    'reward-lms-p1-release-shared-platform',
    'LMS P1 Release Shared Platform Reward',
    'Shared platform reward available to programmes.',
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
    980,
    'platform_owned',
    null,
    true
  ),
  (
    'reward-lms-p1-release-beta-org',
    'LMS P1 Release Beta Organisation Reward',
    'Beta reward that must not attach to alpha programmes.',
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
    981,
    'organization_owned',
    :'p1_beta_org_id'::uuid,
    false
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      is_enabled = excluded.is_enabled,
      owner_scope = excluded.owner_scope,
      organization_id = excluded.organization_id,
      shared_with_programmes = excluded.shared_with_programmes;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.ok(
  public.current_user_has_organization_role(
    :'p1_alpha_org_id'::uuid,
    array['programme_manager']::public.organization_role_key[]
  )
  and not public.current_user_has_organization_role(
    :'p1_beta_org_id'::uuid,
    array['programme_manager']::public.organization_role_key[]
  ),
  'contextual roles are scoped per organisation'
);

select extensions.ok(
  public.current_user_can_read_course('course-lms-p1-release-platform'),
  'shared platform catalogue courses remain readable across tenant context'
);

select extensions.ok(
  public.current_user_can_read_course('course-lms-p1-release-alpha-private')
  and not public.current_user_can_read_course('course-lms-p1-release-beta-private'),
  'organisation-private course access is isolated by tenant'
);

select public.admin_adapt_platform_course(
  'course-lms-p1-release-platform',
  :'p1_alpha_org_id'::uuid,
  'LMS P1 Release Alpha Adapted Course'
) as p1_adapt_result
\gset

select :'p1_adapt_result'::jsonb ->> 'courseId' as p1_adapted_course_id
\gset

select extensions.ok(
  :'p1_adapted_course_id' <> 'course-lms-p1-release-platform'
  and (
    select catalog_scope = 'adapted_platform'::public.course_catalog_scope
      and organization_id = :'p1_alpha_org_id'::uuid
      and source_course_id = 'course-lms-p1-release-platform'
      and status = 'draft'
    from public.courses
    where id = :'p1_adapted_course_id'
  ),
  'adapted platform courses keep independent IDs, tenant ownership, draft state and source provenance'
);

select extensions.is(
  (
    select count(*)::integer
    from public.lessons
    where course_id = :'p1_adapted_course_id'
  ),
  1,
  'adapted content copies the instructional lesson tree'
);

select public.admin_upsert_programme(
  null,
  :'p1_alpha_org_id'::uuid,
  'LMS P1 Release Alpha Programme',
  'lms-p1-release-alpha-programme',
  'Exercise the P1 LMS release gate.',
  'Alpha learners',
  'published',
  '2026-09-01 09:00:00+00'::timestamptz,
  '2026-10-01 09:00:00+00'::timestamptz,
  '{"requiredCourseCount":1}'::jsonb,
  array[:'p1_adapted_course_id']::text[],
  '{}'::text[],
  array['reward-lms-p1-release-shared-platform']::text[],
  '{}'::uuid[]
) as p1_programme_result
\gset

select :'p1_programme_result'::jsonb ->> 'programmeId' as p1_programme_id
\gset

select extensions.is(
  (
    select string_agg(course_id, ',' order by sort_order)
    from public.programme_courses
    where programme_id = :'p1_programme_id'::uuid
  ),
  :'p1_adapted_course_id',
  'programme builder preserves adapted-course sequence'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_programme(
        %L::uuid,
        %L::uuid,
        'LMS P1 Release Alpha Programme',
        'lms-p1-release-alpha-programme',
        'Exercise the P1 LMS release gate.',
        'Alpha learners',
        'published',
        null,
        null,
        '{}'::jsonb,
        array[%L]::text[],
        '{}'::text[],
        array['reward-lms-p1-release-beta-org']::text[],
        '{}'::uuid[]
      )
    $$,
    :'p1_programme_id',
    :'p1_alpha_org_id',
    :'p1_adapted_course_id'
  ),
  'P0001',
  'Programme rewards must be shared platform rewards, organisation-owned rewards for the same organisation, or rewards sponsored by this programme.',
  'tenant reward isolation blocks cross-organisation reward attachment'
);

select public.admin_assign_programme(
  :'p1_programme_id'::uuid,
  '{}'::uuid[],
  array[:'p1_alpha_cohort_id'::uuid],
  '2026-09-01 09:00:00+00'::timestamptz,
  '2026-10-01 09:00:00+00'::timestamptz
) as p1_assignment_result
\gset

select extensions.ok(
  (:'p1_assignment_result'::jsonb ->> 'cohortAssignments')::integer = 1
  and (:'p1_assignment_result'::jsonb ->> 'programmeEnrolments')::integer = 1
  and (:'p1_assignment_result'::jsonb ->> 'courseEnrolments')::integer = 1,
  'cohort programme assignment creates programme and course enrolments'
);

select extensions.ok(
  exists (
    select 1
    from public.enrolments
    where organization_id = :'p1_alpha_org_id'::uuid
      and user_id = '44444444-4444-4444-8444-444444444401'::uuid
      and programme_id = :'p1_programme_id'::uuid
      and assignment_source = 'cohort'
      and metadata ->> 'cohortId' = :'p1_alpha_cohort_id'
  )
  and exists (
    select 1
    from public.enrolments
    where organization_id = :'p1_alpha_org_id'::uuid
      and user_id = '44444444-4444-4444-8444-444444444401'::uuid
      and course_id = :'p1_adapted_course_id'
      and metadata ->> 'programmeId' = :'p1_programme_id'
  ),
  'assignment fan-out preserves cohort and programme provenance on enrolments'
);

reset role;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444401', true);
set local role authenticated;

select public.evaluate_programme_completion(:'p1_programme_id'::uuid) as p1_completion_result
\gset

select extensions.is(
  :'p1_completion_result'::jsonb ->> 'status',
  'completed',
  'assigned learner can complete the programme through the learner completion RPC'
);

select extensions.ok(
  (:'p1_completion_result'::jsonb -> 'completed_required_courses') ? :'p1_adapted_course_id',
  'programme completion records the required adapted course'
);

select extensions.is(
  (
    select count(*)::integer
    from public.enrolments
    where user_id = '55555555-5555-4555-8555-555555555501'::uuid
      and organization_id = :'p1_alpha_org_id'::uuid
  ),
  0,
  'tenant assignment does not leak enrolments to users outside the assigned organisation'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_assign_programme(
        %L::uuid,
        array[%L::uuid],
        '{}'::uuid[],
        null,
        null
      )
    $$,
    :'p1_programme_id',
    '55555555-5555-4555-8555-555555555501'
  ),
  'P0001',
  'Audience manager access required.',
  'learner cannot manage programme assignment'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_get_lms_reporting(
  :'p1_alpha_org_id'::uuid,
  :'p1_programme_id'::uuid,
  :'p1_alpha_cohort_id'::uuid,
  25
) as p1_reporting_result
\gset

select extensions.ok(
  (:'p1_reporting_result'::jsonb -> 'summary' ->> 'assignedLearners')::integer = 1
  and (:'p1_reporting_result'::jsonb -> 'summary' ->> 'completedLearners')::integer = 1
  and jsonb_array_length(:'p1_reporting_result'::jsonb -> 'learners') = 1,
  'reporting returns scoped assigned and completed learner outcomes'
);

select extensions.throws_ok(
  format(
    $$ select public.admin_get_lms_reporting(%L::uuid, null, null, 25) $$,
    :'p1_beta_org_id'
  ),
  '42501',
  'Reporting access required.',
  'reporting access controls deny cross-organisation reads'
);

reset role;
set local role anon;

select extensions.throws_ok(
  $$ select public.admin_get_lms_reporting(null, null, null, 25) $$,
  '42501',
  'permission denied for function admin_get_lms_reporting',
  'anonymous users cannot execute LMS reporting'
);

select * from extensions.finish();

rollback;
