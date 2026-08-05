begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(18);

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
    'pgtap-entitlements-admin@example.test',
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
    'pgtap-entitlements-member@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '77777777-7777-4777-8777-777777777701'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-entitlements-outsider@example.test',
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
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP Entitlements Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'Local pgTAP Entitlements Member', 0, 0, 'learner'),
  ('77777777-7777-4777-8777-777777777701'::uuid, 'Local pgTAP Entitlements Outsider', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

select extensions.is(
  (select count(*)::integer from public.organization_plans where key in ('starter', 'team', 'professional', 'enterprise')),
  4,
  'initial organization plans are seeded'
);

select extensions.ok(
  (
    select entitlements -> 'max_courses' = '1'::jsonb
      and entitlements -> 'allowed_lesson_block_types' = '["text", "image", "table", "callout"]'::jsonb
      and entitlements -> 'ai_authoring_enabled' = 'false'::jsonb
    from public.organization_plans
    where key = 'starter'
  ),
  'Starter entitlements are data-driven and include required content limits'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

create temporary table test_entitlement_org_result
on commit drop
as
select public.admin_upsert_organization(
  null,
  'P15 Entitlement Organisation',
  'p15-entitlement-organisation',
  'published'
) as result;

grant select on test_entitlement_org_result to anon, authenticated, service_role;

select extensions.is(
  (
    select plan_key
    from public.organization_plan_assignments
    where organization_id = (select (result ->> 'organizationId')::uuid from test_entitlement_org_result)
      and ended_at is null
  ),
  'starter',
  'new platform-created organizations receive an active Starter assignment'
);

select extensions.is(
  (
    select public.resolve_organization_entitlements(
      (select (result ->> 'organizationId')::uuid from test_entitlement_org_result)
    ) ->> 'max_courses'
  ),
  '1',
  'central resolver returns Starter limits before plan changes'
);

select extensions.ok(
  public.organization_entitlement_allows_integer(
    (select (result ->> 'organizationId')::uuid from test_entitlement_org_result),
    'max_courses',
    1
  )
  and not public.organization_entitlement_allows_integer(
    (select (result ->> 'organizationId')::uuid from test_entitlement_org_result),
    'max_courses',
    2
  ),
  'integer entitlement helper enforces resolved numeric limits'
);

select public.admin_assign_organization_plan(
  (select (result ->> 'organizationId')::uuid from test_entitlement_org_result),
  'professional',
  'sponsored',
  '{"max_courses": 12, "max_storage_bytes": 209715200}'::jsonb,
  'Sponsored institutional pilot'
) as plan_result
\gset

select extensions.is(
  (
    select plan_key
    from public.organization_plan_assignments
    where organization_id = (select (result ->> 'organizationId')::uuid from test_entitlement_org_result)
      and ended_at is null
  ),
  'professional',
  'platform admin can assign a paid plan without code changes'
);

select extensions.is(
  (
    select billing_status
    from public.organization_plan_assignments
    where organization_id = (select (result ->> 'organizationId')::uuid from test_entitlement_org_result)
      and ended_at is null
  ),
  'sponsored'::public.organization_billing_status,
  'sponsored pilots keep billing status separate from plan key'
);

select extensions.is(
  (
    select public.resolve_organization_entitlements(
      (select (result ->> 'organizationId')::uuid from test_entitlement_org_result)
    ) ->> 'max_courses'
  ),
  '12',
  'entitlement overrides merge over the assigned plan'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organization_plan_assignments
    where organization_id = (select (result ->> 'organizationId')::uuid from test_entitlement_org_result)
      and ended_at is null
  ),
  1,
  'only one active plan assignment remains after reassignment'
);

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type = 'organization_plan_assigned'
      and entity_id = (select result ->> 'organizationId' from test_entitlement_org_result)
  ),
  'plan assignment is audited'
);

reset role;
set local role service_role;

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values (
  (select (result ->> 'organizationId')::uuid from test_entitlement_org_result),
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

select extensions.is(
  (
    select public.resolve_organization_entitlements(
      (select (result ->> 'organizationId')::uuid from test_entitlement_org_result)
    ) ->> 'reporting_level'
  ),
  'advanced',
  'active organization members can resolve their organization entitlements'
);

select extensions.throws_ok(
  format(
    $$ select public.admin_assign_organization_plan(%L::uuid, 'team', 'active', '{}'::jsonb, null) $$,
    (select result ->> 'organizationId' from test_entitlement_org_result)
  ),
  'P0001',
  'Only a platform admin can assign organization plans.',
  'non-platform admins cannot assign organization plans'
);

select extensions.throws_ok(
  format(
    $$ insert into public.organization_plan_assignments (organization_id, plan_key) values (%L::uuid, 'team') $$,
    (select result ->> 'organizationId' from test_entitlement_org_result)
  ),
  '42501',
  'new row violates row-level security policy for table "organization_plan_assignments"',
  'direct authenticated table writes cannot bypass plan assignment RPC authorization'
);

reset role;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777701', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ select public.resolve_organization_entitlements(%L::uuid) $$,
    (select result ->> 'organizationId' from test_entitlement_org_result)
  ),
  'P0001',
  'You cannot read organization entitlements.',
  'outsiders cannot resolve another organization entitlement contract'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ select public.admin_assign_organization_plan(%L::uuid, 'professional', 'sponsored', '{"unknown_key": 1}'::jsonb, 'bad override') $$,
    (select result ->> 'organizationId' from test_entitlement_org_result)
  ),
  'P0001',
  'Entitlement overrides are invalid.',
  'platform admin cannot assign unknown entitlement override keys'
);

reset role;
set local role anon;

select extensions.throws_ok(
  format(
    $$ select public.admin_assign_organization_plan(%L::uuid, 'team', 'active', '{}'::jsonb, null) $$,
    (select result ->> 'organizationId' from test_entitlement_org_result)
  ),
  '42501',
  'permission denied for function admin_assign_organization_plan',
  'anon cannot execute plan assignment RPC'
);

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.admin_assign_organization_plan(uuid, text, public.organization_billing_status, jsonb, text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.admin_assign_organization_plan(uuid, text, public.organization_billing_status, jsonb, text)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.resolve_organization_entitlements(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.resolve_organization_entitlements(uuid)',
    'execute'
  ),
  'plan resolver and assignment RPC grants stay behind authenticated execution'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_assign_organization_plan'
      and identity_arguments = 'p_organization_id uuid, p_plan_key text, p_billing_status organization_billing_status, p_entitlement_overrides jsonb, p_override_reason text'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'plan assignment RPC is explicitly classified'
);

select * from extensions.finish();

rollback;
