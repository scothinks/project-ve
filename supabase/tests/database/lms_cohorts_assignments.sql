begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(26);

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
    '11111111-1111-4111-8111-111111111101',
    'authenticated',
    'authenticated',
    'pgtap-cohort-one@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222102',
    'authenticated',
    'authenticated',
    'pgtap-cohort-two@example.test',
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
    '11111111-1111-4111-8111-111111111101',
    'Local pgTAP Cohort Learner One',
    0,
    0,
    'learner'
  ),
  (
    '22222222-2222-4222-8222-222222222102',
    'Local pgTAP Cohort Learner Two',
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
  ('lms-cohort-alpha', 'LMS Cohort Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('lms-cohort-beta', 'LMS Cohort Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as cohort_alpha_org_id
from public.organizations
where slug = 'lms-cohort-alpha'
\gset

select id as cohort_beta_org_id
from public.organizations
where slug = 'lms-cohort-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'cohort_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'cohort_beta_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'cohort_alpha_org_id'::uuid, '11111111-1111-4111-8111-111111111101'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'cohort_alpha_org_id'::uuid, '22222222-2222-4222-8222-222222222102'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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
  'course-lms-cohort-platform',
  'course-lms-cohort-platform',
  'LMS Cohort Platform Course',
  'A reusable platform course for cohort assignments.',
  'Organisation learners',
  array['Complete cohort platform course'],
  'Values Education',
  'beginner',
  'published',
  930,
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
    'course-lms-cohort-alpha-private',
    'course-lms-cohort-alpha-private',
    'LMS Cohort Alpha Private Course',
    'An alpha private course for cohort assignments.',
    'Alpha learners',
    array['Complete cohort alpha course'],
    'Values Education',
    'beginner',
    'draft',
    931,
    8,
    'organization_private',
    :'cohort_alpha_org_id'::uuid
  ),
  (
    'course-lms-cohort-beta-private',
    'course-lms-cohort-beta-private',
    'LMS Cohort Beta Private Course',
    'A beta private course for boundary tests.',
    'Beta learners',
    array['Complete cohort beta course'],
    'Values Education',
    'beginner',
    'draft',
    932,
    8,
    'organization_private',
    :'cohort_beta_org_id'::uuid
  )
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      organization_id = excluded.organization_id;

insert into public.programmes (
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status
)
values (
  :'cohort_alpha_org_id'::uuid,
  'lms-cohort-programme',
  'LMS Cohort Programme',
  'Assign a programme to cohorts.',
  'Alpha learners',
  'published'
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      objective = excluded.objective,
      intended_audience = excluded.intended_audience,
      status = excluded.status
returning id as cohort_programme_id
\gset

insert into public.programme_courses (
  programme_id,
  course_id,
  sort_order,
  requirement
)
values
  (:'cohort_programme_id'::uuid, 'course-lms-cohort-platform', 1, 'required'),
  (:'cohort_programme_id'::uuid, 'course-lms-cohort-alpha-private', 2, 'required')
on conflict (programme_id, course_id) do update
  set sort_order = excluded.sort_order,
      requirement = excluded.requirement;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_upsert_cohort(
  null,
  :'cohort_alpha_org_id'::uuid,
  'Alpha September Cohort',
  'alpha-september-cohort',
  'Learners assigned to the September alpha intake.',
  'draft',
  '2026-09-01 09:00:00+00'::timestamptz,
  '2026-10-01 09:00:00+00'::timestamptz
) as cohort_result
\gset

select extensions.is(
  (
    select organization_id
    from public.cohorts
    where id = (:'cohort_result'::jsonb ->> 'cohortId')::uuid
  ),
  :'cohort_alpha_org_id'::uuid,
  'programme manager can create a cohort in their organisation'
);

select extensions.ok(
  exists (
    select 1
    from public.cohorts
    where id = (:'cohort_result'::jsonb ->> 'cohortId')::uuid
      and starts_at = '2026-09-01 09:00:00+00'::timestamptz
      and ends_at = '2026-10-01 09:00:00+00'::timestamptz
  ),
  'cohort schedule fields are persisted'
);

select public.admin_replace_cohort_members(
  (:'cohort_result'::jsonb ->> 'cohortId')::uuid,
  array[
    '11111111-1111-4111-8111-111111111101'::uuid,
    '22222222-2222-4222-8222-222222222102'::uuid
  ]::uuid[]
) as member_result
\gset

select extensions.is(
  (:'member_result'::jsonb ->> 'memberCount')::integer,
  2,
  'bulk cohort member replacement accepts multiple learner ids'
);

select extensions.is(
  (
    select count(*)::integer
    from public.cohort_members
    where cohort_id = (:'cohort_result'::jsonb ->> 'cohortId')::uuid
      and status = 'active'
  ),
  2,
  'bulk cohort replacement creates active member rows'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
set local role authenticated;

select extensions.ok(
  exists (
    select 1
    from public.cohorts
    where id = (:'cohort_result'::jsonb ->> 'cohortId')::uuid
  ),
  'active cohort member can read their cohort'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.admin_replace_cohort_members(
  (:'cohort_result'::jsonb ->> 'cohortId')::uuid,
  array['11111111-1111-4111-8111-111111111101'::uuid]::uuid[]
) as reduced_member_result
\gset

select extensions.is(
  (
    select status
    from public.cohort_members
    where cohort_id = (:'cohort_result'::jsonb ->> 'cohortId')::uuid
      and user_id = '22222222-2222-4222-8222-222222222102'::uuid
  ),
  'withdrawn'::public.lms_participation_status,
  'bulk replacement withdraws omitted members instead of deleting history'
);

select public.admin_assign_course(
  :'cohort_alpha_org_id'::uuid,
  'course-lms-cohort-platform',
  array['22222222-2222-4222-8222-222222222102'::uuid]::uuid[],
  '{}'::uuid[],
  '2026-09-15 09:00:00+00'::timestamptz
) as manual_course_assignment_result
\gset

select extensions.ok(
  (:'manual_course_assignment_result'::jsonb ->> 'manualAssignments')::integer = 1
  and (:'manual_course_assignment_result'::jsonb ->> 'enrolments')::integer = 1
  and exists (
    select 1
    from public.enrolments
    where organization_id = :'cohort_alpha_org_id'::uuid
      and user_id = '22222222-2222-4222-8222-222222222102'::uuid
      and course_id = 'course-lms-cohort-platform'
      and assignment_source = 'manual'
      and due_at = '2026-09-15 09:00:00+00'::timestamptz
  ),
  'manual course assignment creates a direct course enrolment with due date'
);

select public.admin_assign_course(
  :'cohort_alpha_org_id'::uuid,
  'course-lms-cohort-alpha-private',
  '{}'::uuid[],
  array[(:'cohort_result'::jsonb ->> 'cohortId')::uuid]::uuid[],
  '2026-09-20 09:00:00+00'::timestamptz
) as cohort_course_assignment_result
\gset

select extensions.ok(
  (:'cohort_course_assignment_result'::jsonb ->> 'cohortAssignments')::integer = 1
  and (:'cohort_course_assignment_result'::jsonb ->> 'enrolments')::integer = 1
  and exists (
    select 1
    from public.enrolments
    where organization_id = :'cohort_alpha_org_id'::uuid
      and user_id = '11111111-1111-4111-8111-111111111101'::uuid
      and course_id = 'course-lms-cohort-alpha-private'
      and assignment_source = 'cohort'
      and metadata ->> 'cohortId' = :'cohort_result'::jsonb ->> 'cohortId'
  ),
  'cohort course assignment enrols active cohort members only'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_assign_course(
        %L::uuid,
        'course-lms-cohort-beta-private',
        array['11111111-1111-4111-8111-111111111101'::uuid],
        '{}'::uuid[],
        null
      )
    $$,
    :'cohort_alpha_org_id'
  ),
  'P0001',
  'Organisation-owned courses can only be assigned inside the same organisation.',
  'course assignment rejects private courses from another organisation'
);

select extensions.ok(
  not exists (
    select 1
    from public.course_assignments
    where organization_id = :'cohort_alpha_org_id'::uuid
      and course_id = 'course-lms-cohort-beta-private'
  )
  and not exists (
    select 1
    from public.enrolments
    where organization_id = :'cohort_alpha_org_id'::uuid
      and course_id = 'course-lms-cohort-beta-private'
  ),
  'failed course assignment leaves no partial assignment or enrolment rows'
);

select public.admin_assign_programme(
  :'cohort_programme_id'::uuid,
  array['22222222-2222-4222-8222-222222222102'::uuid]::uuid[],
  array[(:'cohort_result'::jsonb ->> 'cohortId')::uuid]::uuid[],
  '2026-09-05 09:00:00+00'::timestamptz,
  '2026-10-15 09:00:00+00'::timestamptz
) as programme_assignment_result
\gset

select extensions.ok(
  (:'programme_assignment_result'::jsonb ->> 'manualAssignments')::integer = 1
  and (:'programme_assignment_result'::jsonb ->> 'cohortAssignments')::integer = 1
  and (:'programme_assignment_result'::jsonb ->> 'programmeEnrolments')::integer = 2,
  'programme assignment supports manual learners and cohorts in one transaction'
);

select extensions.is(
  (
    select count(*)::integer
    from public.enrolments
    where organization_id = :'cohort_alpha_org_id'::uuid
      and user_id in (
        '11111111-1111-4111-8111-111111111101'::uuid,
        '22222222-2222-4222-8222-222222222102'::uuid
      )
      and course_id in ('course-lms-cohort-platform', 'course-lms-cohort-alpha-private')
      and metadata ->> 'programmeId' = :'cohort_programme_id'
  ),
  4,
  'programme assignment fans out to course enrolments for programme courses'
);

select extensions.ok(
  exists (
    select 1
    from public.programme_assignments
    where programme_id = :'cohort_programme_id'::uuid
      and intake_starts_at = '2026-09-05 09:00:00+00'::timestamptz
  )
  and exists (
    select 1
    from public.enrolments
    where programme_id = :'cohort_programme_id'::uuid
      and metadata ->> 'intakeStartsAt' = '2026-09-05T09:00:00+00:00'
  ),
  'programme intake date is recorded on assignments and enrolment metadata'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
set local role authenticated;

select extensions.ok(
  exists (
    select 1
    from public.enrolments
    where user_id = '11111111-1111-4111-8111-111111111101'::uuid
      and course_id = 'course-lms-cohort-alpha-private'
  ),
  'learner can read their own cohort-created enrolments'
);

select extensions.ok(
  not exists (
    select 1
    from public.enrolments
    where user_id = '22222222-2222-4222-8222-222222222102'::uuid
  ),
  'learner cannot read another learner enrolments'
);

select extensions.throws_ok(
  format(
    $$
      select public.admin_assign_course(
        %L::uuid,
        'course-lms-cohort-platform',
        array['11111111-1111-4111-8111-111111111101'::uuid],
        '{}'::uuid[],
        null
      )
    $$,
    :'cohort_alpha_org_id'
  ),
  'P0001',
  'Audience manager access required.',
  'ordinary learner cannot assign courses'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select id as status_enrolment_id
from public.enrolments
where organization_id = :'cohort_alpha_org_id'::uuid
  and user_id = '11111111-1111-4111-8111-111111111101'::uuid
  and course_id = 'course-lms-cohort-alpha-private'
limit 1
\gset

select public.admin_update_enrolment_status(
  :'status_enrolment_id'::uuid,
  'completed'
) as completed_enrolment_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.enrolments
    where id = :'status_enrolment_id'::uuid
      and status = 'completed'
      and completed_at is not null
      and withdrawn_at is null
  ),
  'audience manager can mark an enrolment completed'
);

select public.admin_update_enrolment_status(
  :'status_enrolment_id'::uuid,
  'withdrawn'
) as withdrawn_enrolment_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.enrolments
    where id = :'status_enrolment_id'::uuid
      and status = 'withdrawn'
      and completed_at is null
      and withdrawn_at is not null
  ),
  'audience manager can mark an enrolment withdrawn'
);

reset role;
set local role service_role;

select extensions.throws_ok(
  format(
    $$
      insert into public.course_assignments (
        organization_id,
        course_id,
        cohort_id,
        assignment_source
      )
      values (
        %L::uuid,
        'course-lms-cohort-platform',
        (%L::jsonb ->> 'cohortId')::uuid,
        'cohort'
      )
    $$,
    :'cohort_beta_org_id',
    :'cohort_result'
  ),
  'P0001',
  'Cohorts can only receive assignments inside their owning organisation.',
  'assignment boundary trigger blocks cross-organisation cohort targets outside the RPC'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$
      select public.admin_upsert_cohort(
        null,
        %L::uuid,
        'Unauthorized Beta Cohort',
        'unauthorized-beta-cohort',
        'Attempt unauthorized cohort creation.',
        'draft',
        null,
        null
      )
    $$,
    :'cohort_beta_org_id'
  ),
  'P0001',
  'Audience manager access required.',
  'organisation learner cannot create cohorts in an unmanaged organisation'
);

reset role;
set local role anon;

select extensions.throws_ok(
  format(
    $$
      select public.admin_assign_programme(
        %L::uuid,
        '{}'::uuid[],
        '{}'::uuid[],
        null,
        null
      )
    $$,
    :'cohort_programme_id'
  ),
  '42501',
  'permission denied for function admin_assign_programme',
  'anon cannot execute programme assignment RPC'
);

reset role;

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_upsert_cohort(uuid, uuid, text, text, text, public.content_status, timestamp with time zone, timestamp with time zone)', 'execute')
  and not has_function_privilege('anon', 'public.admin_upsert_cohort(uuid, uuid, text, text, text, public.content_status, timestamp with time zone, timestamp with time zone)', 'execute'),
  'cohort builder RPC is authenticated only before in-function contextual role checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_assign_course(uuid, text, uuid[], uuid[], timestamp with time zone)', 'execute')
  and not has_function_privilege('anon', 'public.admin_assign_course(uuid, text, uuid[], uuid[], timestamp with time zone)', 'execute'),
  'course assignment RPC is authenticated only before in-function contextual role checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.current_user_can_manage_organization_audience(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.current_user_can_manage_organization_audience(uuid)', 'execute'),
  'audience management helper is authenticated only'
);

select extensions.ok(
  not has_function_privilege('service_role', 'public.enforce_lms_assignment_boundaries()', 'execute')
  and not has_function_privilege('authenticated', 'public.enforce_lms_assignment_boundaries()', 'execute'),
  'LMS assignment enforcement trigger is not directly executable by API roles'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_assign_programme'
      and identity_arguments = 'p_programme_id uuid, p_user_ids uuid[], p_cohort_ids uuid[], p_intake_starts_at timestamp with time zone, p_due_at timestamp with time zone'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'programme assignment RPC is explicitly classified'
);

select * from extensions.finish();

rollback;
