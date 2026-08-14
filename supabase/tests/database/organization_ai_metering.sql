begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(17);

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
    :'TEST_ADMIN_USER_ID'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-ai-metering-admin@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    :'TEST_LEARNER_USER_ID'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-ai-metering-org-admin@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '77777777-7777-4777-8777-777777777702'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-ai-metering-outsider@example.test',
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

delete from public.ai_generation_jobs;

insert into public.profiles (
  id,
  display_name,
  xp,
  xp_balance_cached,
  role
)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP AI Metering Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'Local pgTAP AI Metering Org Admin', 0, 0, 'learner'),
  ('77777777-7777-4777-8777-777777777702'::uuid, 'Local pgTAP AI Metering Outsider', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

create temporary table test_ai_metering_org_result
on commit drop
as
select public.admin_upsert_organization(
  null,
  'P15 AI Metering Organisation',
  'p15-ai-metering-organisation',
  'published'
) as result;

create temporary table test_ai_metering_worker_org_result
on commit drop
as
select public.admin_upsert_organization(
  null,
  'P15 AI Metering Worker Organisation',
  'p15-ai-metering-worker-organisation',
  'published'
) as result;

grant select on test_ai_metering_org_result to anon, authenticated, service_role;
grant select on test_ai_metering_worker_org_result to anon, authenticated, service_role;

reset role;
set local role service_role;

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (
    (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result),
    :'TEST_LEARNER_USER_ID'::uuid,
    'organisation_admin',
    'active',
    :'TEST_ADMIN_USER_ID'::uuid
  ),
  (
    (select (result ->> 'organizationId')::uuid from test_ai_metering_worker_org_result),
    :'TEST_LEARNER_USER_ID'::uuid,
    'organisation_admin',
    'active',
    :'TEST_ADMIN_USER_ID'::uuid
  )
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ select public.reserve_organization_ai_usage(%L::uuid, %L::uuid, 'ai_course_plan', 'pre-grant', 'pre-grant-key', 'ai_planner_new_course', 10, null, null, null, null, null, null, '{}'::jsonb) $$,
    (select result ->> 'organizationId' from test_ai_metering_org_result),
    :'TEST_LEARNER_USER_ID'
  ),
  'P0001',
  'Organization AI access is not enabled with an active allocation.',
  'organization AI reservations require an active entitlement allocation'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

create temporary table test_ai_metering_grant_result
on commit drop
as
select public.admin_upsert_organization_temporary_entitlement_grant(
  null,
  (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result),
  'granular_override',
  null,
  '{
    "ai_authoring_enabled": true,
    "ai_monthly_allocation": 100,
    "ai_hard_limit": 100,
    "ai_user_rate_limit_per_day": 2,
    "ai_organization_concurrency_limit": 1,
    "allowed_ai_operation_types": ["ai_planner_new_course", "ai_course_draft"],
    "allowed_ai_roles": ["organisation_admin"]
  }'::jsonb,
  now() - interval '1 minute',
  now() + interval '7 days',
  'AI metering pgTAP grant'
) as result;

create temporary table test_ai_metering_worker_grant_result
on commit drop
as
select public.admin_upsert_organization_temporary_entitlement_grant(
  null,
  (select (result ->> 'organizationId')::uuid from test_ai_metering_worker_org_result),
  'granular_override',
  null,
  '{
    "ai_authoring_enabled": true,
    "ai_monthly_allocation": 100,
    "ai_hard_limit": 100,
    "ai_user_rate_limit_per_day": 5,
    "ai_organization_concurrency_limit": 2,
    "allowed_ai_operation_types": ["ai_course_draft"],
    "allowed_ai_roles": ["organisation_admin"]
  }'::jsonb,
  now() - interval '1 minute',
  now() + interval '7 days',
  'AI metering worker pgTAP grant'
) as result;

grant select on test_ai_metering_grant_result to anon, authenticated, service_role;
grant select on test_ai_metering_worker_grant_result to anon, authenticated, service_role;

select extensions.ok(
  (
    select (result -> 'entitlements' ->> 'ai_authoring_enabled')::boolean
      and (result -> 'entitlements' ->> 'ai_monthly_allocation')::numeric = 100
    from test_ai_metering_grant_result
  ),
  'organization AI access is enabled through the generic temporary entitlement grant'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

create temporary table test_ai_usage_first
on commit drop
as
select public.reserve_organization_ai_usage(
  (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result),
  :'TEST_LEARNER_USER_ID'::uuid,
  'ai_course_plan',
  'planner-first',
  'planner-first-key',
  'ai_planner_new_course',
  10,
  0.20,
  null,
  null,
  null,
  null,
  null,
  '{"test":"first"}'::jsonb
) as result;

grant select on test_ai_usage_first to anon, authenticated, service_role;

select extensions.ok(
  (
    select result ? 'usageRecordId'
      and (result ->> 'status') = 'reserved'
      and (result ->> 'reservedUnits')::numeric = 10
    from test_ai_usage_first
  ),
  'organization admins can reserve metered AI usage within allocation'
);

reset role;
set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type = 'organization_ai_usage_reserved'
      and entity_id = (select result ->> 'organizationId' from test_ai_metering_org_result)
  ),
  'AI usage reservations are audited'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (
    select public.reserve_organization_ai_usage(
      (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result),
      :'TEST_LEARNER_USER_ID'::uuid,
      'ai_course_plan',
      'planner-first',
      'planner-first-key',
      'ai_planner_new_course',
      10,
      0.20,
      null,
      null,
      null,
      null,
      null,
      '{}'::jsonb
    ) ->> 'usageRecordId'
  ),
  (select result ->> 'usageRecordId' from test_ai_usage_first),
  'reservation idempotency returns the original usage record'
);

select extensions.throws_ok(
  format(
    $$ select public.reserve_organization_ai_usage(%L::uuid, %L::uuid, 'ai_course_plan', 'planner-concurrent', 'planner-concurrent-key', 'ai_planner_new_course', 5, null, null, null, null, null, null, '{}'::jsonb) $$,
    (select result ->> 'organizationId' from test_ai_metering_org_result),
    :'TEST_LEARNER_USER_ID'
  ),
  'P0001',
  'Organization AI concurrency limit has been reached.',
  'organization concurrency caps block additional reservations while one is active'
);

reset role;
set local role service_role;

select public.reconcile_organization_ai_usage(
  (select (result ->> 'usageRecordId')::uuid from test_ai_usage_first),
  'released',
  null,
  '{}'::jsonb,
  null,
  0,
  0,
  'validation_error',
  'release_validation_failure_before_provider_work',
  '{}'::jsonb
);

select extensions.ok(
  exists (
    select 1
    from public.organization_ai_usage_records
    where id = (select (result ->> 'usageRecordId')::uuid from test_ai_usage_first)
      and status = 'released'
      and final_charged_units = 0
      and reconciliation_status = 'released'
  ),
  'reconciliation releases unused reservations without charging'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ select public.reserve_organization_ai_usage(%L::uuid, %L::uuid, 'ai_course_plan', 'planner-disallowed', 'planner-disallowed-key', 'ai_course_media_assets', 5, null, null, null, null, null, null, '{}'::jsonb) $$,
    (select result ->> 'organizationId' from test_ai_metering_org_result),
    :'TEST_LEARNER_USER_ID'
  ),
  'P0001',
  'AI operation is not allowed for this organization.',
  'allowed operation types are enforced server-side'
);

create temporary table test_ai_usage_charged
on commit drop
as
select public.reserve_organization_ai_usage(
  (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result),
  :'TEST_LEARNER_USER_ID'::uuid,
  'ai_course_plan',
  'planner-charged',
  'planner-charged-key',
  'ai_planner_new_course',
  90,
  1.50,
  null,
  null,
  null,
  null,
  null,
  '{}'::jsonb
) as result;

grant select on test_ai_usage_charged to anon, authenticated, service_role;

reset role;
set local role service_role;

select public.reconcile_organization_ai_usage(
  (select (result ->> 'usageRecordId')::uuid from test_ai_usage_charged),
  'charged',
  'test-model',
  '{"inputTokens": 20, "outputTokens": 40}'::jsonb,
  1.25,
  80,
  80,
  null,
  'charge_actual_when_available_else_reserved_estimate',
  '{}'::jsonb
);

select extensions.ok(
  exists (
    select 1
    from public.organization_ai_usage_records
    where id = (select (result ->> 'usageRecordId')::uuid from test_ai_usage_charged)
      and status = 'charged'
      and actual_provider_model = 'test-model'
      and actual_provider_cost = 1.25
      and final_charged_units = 80
      and reconciliation_status = 'adjusted'
  ),
  'charged usage records provider usage, provider cost, internal cost and reconciliation status'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ select public.reserve_organization_ai_usage(%L::uuid, %L::uuid, 'ai_course_plan', 'planner-over-cap', 'planner-over-cap-key', 'ai_planner_new_course', 30, null, null, null, null, null, null, '{}'::jsonb) $$,
    (select result ->> 'organizationId' from test_ai_metering_org_result),
    :'TEST_LEARNER_USER_ID'
  ),
  'P0001',
  'Organization AI hard limit would be exceeded.',
  'hard caps include already charged usage'
);

create temporary table test_ai_usage_rate_limited
on commit drop
as
select public.reserve_organization_ai_usage(
  (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result),
  :'TEST_LEARNER_USER_ID'::uuid,
  'ai_course_plan',
  'planner-rate-limited',
  'planner-rate-limited-key',
  'ai_planner_new_course',
  5,
  null,
  null,
  null,
  null,
  null,
  null,
  '{}'::jsonb
) as result;

grant select on test_ai_usage_rate_limited to anon, authenticated, service_role;

select extensions.throws_ok(
  format(
    $$ select public.reserve_organization_ai_usage(%L::uuid, %L::uuid, 'ai_course_plan', 'planner-rate-blocked', 'planner-rate-blocked-key', 'ai_planner_new_course', 1, null, null, null, null, null, null, '{}'::jsonb) $$,
    (select result ->> 'organizationId' from test_ai_metering_org_result),
    :'TEST_LEARNER_USER_ID'
  ),
  'P0001',
  'User AI rate limit has been reached for this organization.',
  'per-user daily rate limits count charged and active reserved usage'
);

select extensions.ok(
  (
    select count(*) >= 3
    from public.organization_ai_usage_records
    where organization_id = (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result)
  ),
  'organization admins can read their AI usage records through RLS'
);

reset role;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777702', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.organization_ai_usage_records
    where organization_id = (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result)
  ),
  0,
  'outsiders cannot read organization AI usage records'
);

select extensions.throws_ok(
  $$
    insert into public.organization_ai_usage_records (
      organization_id,
      actor_user_id,
      source_type,
      source_id,
      idempotency_key,
      operation_type,
      estimated_units,
      reserved_units
    )
    values (
      (select (result ->> 'organizationId')::uuid from test_ai_metering_org_result),
      '77777777-7777-4777-8777-777777777702'::uuid,
      'ai_course_plan',
      'direct-write',
      'direct-write-key',
      'ai_planner_new_course',
      1,
      1
    )
  $$,
  '42501',
  'permission denied for table organization_ai_usage_records',
  'authenticated users cannot direct-write AI usage records'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

create temporary table test_ai_worker_job
on commit drop
as
select public.create_organization_ai_generation_job(
  (select (result ->> 'organizationId')::uuid from test_ai_metering_worker_org_result),
  :'TEST_LEARNER_USER_ID'::uuid,
  'course_text',
  '{"mode":"create_course"}'::jsonb,
  'pgtap-ai-metering-worker-course',
  'pgtap-ai-metering-worker-job-key',
  'ai_course_draft',
  10,
  0.25,
  null,
  null,
  null,
  null,
  null,
  'queued'
) as result;

grant select on test_ai_worker_job to anon, authenticated, service_role;

reset role;
set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.ai_generation_jobs job
    join public.organization_ai_usage_records usage
      on usage.id = job.organization_ai_usage_record_id
    where job.id = (select (result ->> 'jobId')::uuid from test_ai_worker_job)
      and job.organization_id = (select (result ->> 'organizationId')::uuid from test_ai_metering_worker_org_result)
      and job.estimated_units = 10
      and usage.status = 'reserved'
  ),
  'organization AI job creation links durable jobs to reserved usage records'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_revoke_organization_temporary_entitlement_grant(
  (select (result ->> 'grantId')::uuid from test_ai_metering_worker_grant_result),
  'revoke before worker claim'
);

reset role;
set local role service_role;

create temporary table test_ai_worker_claim_after_revoke
on commit drop
as
select * from public.claim_ai_generation_job('pgtap-ai-metering-worker', 1800, 3);

select extensions.is(
  (select count(*)::integer from test_ai_worker_claim_after_revoke),
  0,
  'worker-side validation refuses queued organization AI jobs after entitlement revocation'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.reserve_organization_ai_usage(uuid, uuid, text, text, text, text, numeric, numeric, uuid, text, text, uuid, text, jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.reserve_organization_ai_usage(uuid, uuid, text, text, text, text, numeric, numeric, uuid, text, text, uuid, text, jsonb)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.reconcile_organization_ai_usage(uuid, text, text, jsonb, numeric, numeric, numeric, text, text, jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.reconcile_organization_ai_usage(uuid, text, text, jsonb, numeric, numeric, numeric, text, text, jsonb)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.create_organization_ai_generation_job(uuid, uuid, text, jsonb, text, text, text, numeric, numeric, uuid, text, text, uuid, text, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.create_organization_ai_generation_job(uuid, uuid, text, jsonb, text, text, text, numeric, numeric, uuid, text, text, uuid, text, text)',
    'execute'
  ),
  'AI metering RPC execute grants are limited to authenticated callers and service role workers'
);

select extensions.finish();

rollback;
