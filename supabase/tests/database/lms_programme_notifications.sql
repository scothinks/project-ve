begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(15);

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
    '11111111-1111-4111-8111-111111111301',
    'authenticated',
    'authenticated',
    'pgtap-notif-one@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222302',
    'authenticated',
    'authenticated',
    'pgtap-notif-two@example.test',
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
  ('11111111-1111-4111-8111-111111111301', 'Local pgTAP Notification Learner One', 0, 0, 'learner'),
  ('22222222-2222-4222-8222-222222222302', 'Local pgTAP Notification Learner Two', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

insert into public.organizations (slug, name, status, created_by)
values
  ('lms-notif-alpha', 'LMS Notifications Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('lms-notif-beta', 'LMS Notifications Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as notif_alpha_org_id
from public.organizations
where slug = 'lms-notif-alpha'
\gset

select id as notif_beta_org_id
from public.organizations
where slug = 'lms-notif-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'notif_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'programme_manager', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'notif_beta_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'notif_alpha_org_id'::uuid, '11111111-1111-4111-8111-111111111301'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'notif_alpha_org_id'::uuid, '22222222-2222-4222-8222-222222222302'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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
  'course-lms-notif-alpha',
  'course-lms-notif-alpha',
  'LMS Notifications Alpha Course',
  'Course used for notification coverage.',
  'Notification learners',
  array['Respond to reminders'],
  'Values Education',
  'beginner',
  'published',
  980,
  10,
  'organization_private',
  :'notif_alpha_org_id'::uuid
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
  'lesson-lms-notif-alpha',
  'course-lms-notif-alpha',
  'lesson-lms-notif-alpha',
  'Notification Lesson',
  'Required lesson',
  'Provides an activity source for reminder tests.',
  'published',
  1,
  8
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status;

insert into public.programmes (
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status
)
values (
  :'notif_alpha_org_id'::uuid,
  'lms-notif-programme',
  'LMS Notification Programme',
  'Exercise programme notifications.',
  'Notification learners',
  'published'
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      objective = excluded.objective,
      intended_audience = excluded.intended_audience,
      status = excluded.status;

select id as notif_programme_id
from public.programmes
where organization_id = :'notif_alpha_org_id'::uuid
  and slug = 'lms-notif-programme'
\gset

insert into public.programme_courses (programme_id, course_id, sort_order, requirement)
values (:'notif_programme_id'::uuid, 'course-lms-notif-alpha', 1, 'required')
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
  :'notif_alpha_org_id'::uuid,
  'lms-notif-cohort',
  'LMS Notification Cohort',
  'Cohort used for intervention queue tests.',
  'published'
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      description = excluded.description,
      status = excluded.status;

select id as notif_cohort_id
from public.cohorts
where organization_id = :'notif_alpha_org_id'::uuid
  and slug = 'lms-notif-cohort'
\gset

insert into public.cohort_members (cohort_id, user_id, status, added_by)
values
  (:'notif_cohort_id'::uuid, '22222222-2222-4222-8222-222222222302'::uuid, 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (cohort_id, user_id) do update
  set status = excluded.status,
      added_by = excluded.added_by;

insert into public.enrolments (
  organization_id,
  user_id,
  programme_id,
  assignment_source,
  status,
  assigned_at,
  due_at,
  metadata
)
values
  (
    :'notif_alpha_org_id'::uuid,
    '11111111-1111-4111-8111-111111111301'::uuid,
    :'notif_programme_id'::uuid,
    'manual',
    'active',
    '2026-08-02 12:00:00+00'::timestamptz,
    '2026-08-05 12:00:00+00'::timestamptz,
    '{}'::jsonb
  ),
  (
    :'notif_alpha_org_id'::uuid,
    '22222222-2222-4222-8222-222222222302'::uuid,
    :'notif_programme_id'::uuid,
    'cohort',
    'active',
    '2026-07-20 12:00:00+00'::timestamptz,
    '2026-08-01 12:00:00+00'::timestamptz,
    jsonb_build_object('cohortId', :'notif_cohort_id'::uuid)
  )
on conflict (organization_id, user_id, programme_id)
  where programme_id is not null
do update
  set status = excluded.status,
      assignment_source = excluded.assignment_source,
      assigned_at = excluded.assigned_at,
      due_at = excluded.due_at,
      metadata = excluded.metadata,
      updated_at = now();

select id as notif_due_soon_enrolment_id
from public.enrolments
where user_id = '11111111-1111-4111-8111-111111111301'::uuid
  and programme_id = :'notif_programme_id'::uuid
\gset

select id as notif_overdue_enrolment_id
from public.enrolments
where user_id = '22222222-2222-4222-8222-222222222302'::uuid
  and programme_id = :'notif_programme_id'::uuid
\gset

select extensions.is(
  (
    select count(*)::integer
    from public.user_notifications
    where event_type = 'lms_programme_assigned'
      and data ->> 'programmeId' = :'notif_programme_id'
  ),
  2,
  'programme enrolment insert queues assignment notifications through the secured primitive'
);

select public.generate_lms_programme_notifications('2026-08-03 12:00:00+00'::timestamptz) as notif_generation_result
\gset

select extensions.ok(
  (:'notif_generation_result'::jsonb ->> 'upcomingDueReminders')::integer = 1
  and (:'notif_generation_result'::jsonb ->> 'overdueReminders')::integer = 1
  and (:'notif_generation_result'::jsonb ->> 'inactivityReminders')::integer = 1
  and (:'notif_generation_result'::jsonb ->> 'interventions')::integer = 2,
  'service reminder job creates due soon, overdue, inactivity and intervention queue records'
);

select public.generate_lms_programme_notifications('2026-08-03 12:00:00+00'::timestamptz) as notif_second_generation_result
\gset

select extensions.ok(
  (:'notif_second_generation_result'::jsonb ->> 'assignmentNotifications')::integer = 0
  and (:'notif_second_generation_result'::jsonb ->> 'upcomingDueReminders')::integer = 0
  and (:'notif_second_generation_result'::jsonb ->> 'overdueReminders')::integer = 0
  and (:'notif_second_generation_result'::jsonb ->> 'inactivityReminders')::integer = 0,
  'programme notification generation is deduped for the same dispatch window'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.get_lms_intervention_queue(:'notif_alpha_org_id'::uuid, :'notif_programme_id'::uuid, 'open', 25) as notif_queue_result
\gset

select extensions.ok(
  jsonb_array_length(:'notif_queue_result'::jsonb -> 'items') = 2
  and exists (
    select 1
    from jsonb_array_elements(:'notif_queue_result'::jsonb -> 'items') item
    where item ->> 'type' = 'overdue'
      and item ->> 'severity' = 'critical'
  )
  and exists (
    select 1
    from jsonb_array_elements(:'notif_queue_result'::jsonb -> 'items') item
    where item ->> 'type' = 'inactive'
      and item ->> 'severity' = 'warning'
  ),
  'programme manager can read scoped overdue and inactivity intervention queue rows'
);

select id as notif_intervention_id
from public.lms_interventions
where enrolment_id = :'notif_overdue_enrolment_id'::uuid
  and intervention_type = 'overdue'
\gset

select public.admin_update_lms_intervention_status(:'notif_intervention_id'::uuid, 'acknowledged', 'Manager contacted learner.') as notif_ack_result
\gset

select extensions.is(
  :'notif_ack_result'::jsonb ->> 'status',
  'acknowledged',
  'programme manager can acknowledge a scoped intervention'
);

select extensions.throws_ok(
  format(
    $$ select public.get_lms_intervention_queue(%L::uuid, null, 'open', 25) $$,
    :'notif_beta_org_id'
  ),
  '42501',
  'Audience reporting access required.',
  'programme manager cannot read intervention queues outside their organisation'
);

reset role;
set local role service_role;

insert into public.programme_completions (
  organization_id,
  user_id,
  programme_id,
  status,
  progress_percent,
  completed_at
)
values (
  :'notif_alpha_org_id'::uuid,
  '22222222-2222-4222-8222-222222222302'::uuid,
  :'notif_programme_id'::uuid,
  'completed',
  100,
  '2026-08-03 13:00:00+00'::timestamptz
)
on conflict (user_id, programme_id) do update
  set status = excluded.status,
      progress_percent = excluded.progress_percent,
      completed_at = excluded.completed_at;

select extensions.ok(
  exists (
    select 1
    from public.user_notifications
    where user_id = '22222222-2222-4222-8222-222222222302'::uuid
      and event_type = 'lms_programme_completed'
      and data ->> 'programmeId' = :'notif_programme_id'
  )
  and not exists (
    select 1
    from public.lms_interventions
    where user_id = '22222222-2222-4222-8222-222222222302'::uuid
      and programme_id = :'notif_programme_id'::uuid
      and status in ('open', 'acknowledged')
  ),
  'programme completion queues a completion notification and resolves active interventions'
);

reset role;
set local role anon;

select extensions.throws_ok(
  $$ select public.generate_lms_programme_notifications('2026-08-03 12:00:00+00'::timestamptz) $$,
  '42501',
  'permission denied for function generate_lms_programme_notifications',
  'anon cannot execute LMS programme notification generation'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111301', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.generate_lms_programme_notifications('2026-08-03 12:00:00+00'::timestamptz) $$,
  '42501',
  'permission denied for function generate_lms_programme_notifications',
  'learner cannot execute LMS programme notification generation'
);

update public.lms_interventions
set status = 'dismissed',
    resolved_at = now()
where id = :'notif_intervention_id'::uuid;

reset role;
set local role service_role;

select extensions.is(
  (
    select status::text
    from public.lms_interventions
    where id = :'notif_intervention_id'::uuid
  ),
  'resolved',
  'learner cannot directly mutate LMS intervention queue rows'
);

reset role;

select extensions.ok(
  has_function_privilege('service_role', 'public.generate_lms_programme_notifications(timestamp with time zone)', 'execute')
  and not has_function_privilege('authenticated', 'public.generate_lms_programme_notifications(timestamp with time zone)', 'execute')
  and not has_function_privilege('anon', 'public.generate_lms_programme_notifications(timestamp with time zone)', 'execute'),
  'programme notification generation is service-role only'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.get_lms_intervention_queue(uuid, uuid, public.lms_intervention_status, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.admin_update_lms_intervention_status(uuid, public.lms_intervention_status, text)', 'execute')
  and not has_function_privilege('anon', 'public.get_lms_intervention_queue(uuid, uuid, public.lms_intervention_status, integer)', 'execute'),
  'intervention queue RPCs are authenticated only before contextual role checks'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'public.queue_lms_programme_assignment_notification()', 'execute')
  and not has_function_privilege('service_role', 'public.queue_lms_programme_assignment_notification()', 'execute')
  and not has_function_privilege('authenticated', 'public.upsert_lms_intervention(uuid, uuid, uuid, uuid, uuid, public.lms_intervention_type, public.lms_intervention_severity, text, timestamp with time zone, timestamp with time zone, jsonb)', 'execute'),
  'LMS notification trigger and intervention helpers are not directly executable by API roles'
);

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'generate_lms_programme_notifications'
      and identity_arguments = 'p_now timestamp with time zone'
      and classification = 'SERVICE_ROLE_ONLY'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'get_lms_intervention_queue'
      and identity_arguments = 'p_organization_id uuid, p_programme_id uuid, p_status lms_intervention_status, p_limit integer'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'LMS notification and intervention RPCs are explicitly classified'
);

select extensions.ok(
  exists (
    select 1
    from public.user_notifications
    where event_type in (
      'lms_programme_assigned',
      'lms_programme_due_soon',
      'lms_programme_overdue',
      'lms_programme_inactive',
      'lms_programme_completed'
    )
  ),
  'all LMS notification event types are represented in the fixture'
);

select * from extensions.finish();

rollback;
