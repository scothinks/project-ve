begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(20);

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
    'pgtap-org-profile-admin@example.test',
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
    'pgtap-org-profile-member@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '77777777-7777-4777-8777-777777777711'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-org-profile-outsider@example.test',
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
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP Org Profile Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'Local pgTAP Org Profile Member', 0, 0, 'learner'),
  ('77777777-7777-4777-8777-777777777711'::uuid, 'Local pgTAP Org Profile Outsider', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

create temporary table test_org_profile_result
on commit drop
as
select public.admin_upsert_organization(
  null,
  'P15 Profile Organisation',
  'p15-profile-organisation',
  'published'
) as result;

grant select on test_org_profile_result to anon, authenticated, service_role;

select extensions.ok(
  (select (result ->> 'organizationId')::uuid is not null from test_org_profile_result),
  'platform admin can create the organisation used by the profile lifecycle gate'
);

select extensions.ok(
  (
    select short_name is null
      and description = ''
      and logo_url is null
      and accent_token = 'green'::public.organization_accent_token
      and support_email is null
      and support_phone is null
      and creation_source = 'platform_admin'::public.organization_creation_source
      and verification_status = 'unverified'::public.organization_verification_status
      and lifecycle_status = 'active'::public.organization_lifecycle_status
    from public.organizations
    where id = (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  ),
  'existing organization identity fields have safe defaults after migration'
);

select extensions.is(
  (
    select billing_status
    from public.organization_plan_assignments
    where organization_id = (select (result ->> 'organizationId')::uuid from test_org_profile_result)
      and ended_at is null
  ),
  'free'::public.organization_billing_status,
  'billing status remains modeled on the active plan assignment'
);

select public.admin_update_organization_profile(
  (select (result ->> 'organizationId')::uuid from test_org_profile_result),
  'P15 Profile',
  'Institutional pilot workspace for P15 profile checks.',
  'https://assets.example.test/p15-profile.png',
  'mission',
  'SUPPORT@EXAMPLE.TEST',
  '+1 555 0100',
  'verification_pending',
  'trial'
) as profile_result
\gset

select extensions.is(
  :'profile_result'::jsonb ->> 'status',
  'updated',
  'platform admin can update restrained organization profile fields'
);

select extensions.ok(
  (
    select short_name = 'P15 Profile'
      and description = 'Institutional pilot workspace for P15 profile checks.'
      and logo_url = 'https://assets.example.test/p15-profile.png'
      and accent_token = 'mission'::public.organization_accent_token
      and support_email = 'support@example.test'
      and support_phone = '+1 555 0100'
      and verification_status = 'verification_pending'::public.organization_verification_status
      and lifecycle_status = 'trial'::public.organization_lifecycle_status
    from public.organizations
    where id = (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  ),
  'profile RPC stores normalized identity, support, verification and lifecycle fields'
);

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type = 'organization_profile_updated'
      and entity_id = (select result ->> 'organizationId' from test_org_profile_result)
  ),
  'organization profile updates are audited'
);

select extensions.throws_ok(
  format(
    $$ select public.admin_update_organization_profile(%L::uuid, null, '', 'javascript:alert(1)', 'green', null, null, 'unverified', 'active') $$,
    (select result ->> 'organizationId' from test_org_profile_result)
  ),
  'P0001',
  'Organization logo URL must be a valid HTTP or HTTPS URL.',
  'profile RPC rejects unsafe logo URLs'
);

select extensions.throws_ok(
  format(
    $$ select public.admin_update_organization_profile(%L::uuid, null, '', null, 'green', 'invalid-email', null, 'unverified', 'active') $$,
    (select result ->> 'organizationId' from test_org_profile_result)
  ),
  'P0001',
  'Organization support email is invalid.',
  'profile RPC rejects invalid support email values'
);

select extensions.throws_ok(
  format(
    $$ select public.admin_update_organization_profile(%L::uuid, null, '', null, 'green', null, 'call us now', 'unverified', 'active') $$,
    (select result ->> 'organizationId' from test_org_profile_result)
  ),
  'P0001',
  'Organization support phone is invalid.',
  'profile RPC rejects invalid support phone values'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ select public.admin_update_organization_profile(%L::uuid, 'Learner edit', '', null, 'green', null, null, 'unverified', 'active') $$,
    (select result ->> 'organizationId' from test_org_profile_result)
  ),
  'P0001',
  'Organization manager access required.',
  'non-manager learners cannot update organization profile fields'
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
  (select (result ->> 'organizationId')::uuid from test_org_profile_result),
  :'TEST_LEARNER_USER_ID'::uuid,
  'learner',
  'active',
  :'TEST_ADMIN_USER_ID'::uuid
)
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
  'course-p15-org-profile-private',
  'course-p15-org-profile-private',
  'P15 Org Profile Private Course',
  'Private course for organization lifecycle checks.',
  'Organisation learners',
  array['Verify lifecycle entry'],
  'Values Education',
  'beginner',
  'published',
  991,
  10,
  'organization_private',
  (select (result ->> 'organizationId')::uuid from test_org_profile_result)
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      catalog_scope = excluded.catalog_scope,
      organization_id = excluded.organization_id;

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
  catalog_scope
)
values (
  'course-p15-org-profile-platform',
  'course-p15-org-profile-platform',
  'P15 Org Profile Platform Course',
  'Platform course for lifecycle compatibility checks.',
  'All learners',
  array['Verify platform access'],
  'Values Education',
  'beginner',
  'published',
  992,
  10,
  'platform'
)
on conflict (id) do update
  set title = excluded.title,
      status = excluded.status,
      catalog_scope = excluded.catalog_scope,
      organization_id = null;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.ok(
  public.current_user_can_enter_organization(
    (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  ),
  'active member can enter a trial organization workspace'
);

select extensions.ok(
  public.current_user_can_read_course('course-p15-org-profile-private'),
  'active member can read organization-private course while lifecycle allows entry'
);

reset role;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777711', true);
set local role authenticated;

select extensions.ok(
  not public.current_user_can_enter_organization(
    (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  ),
  'authenticated outsider cannot enter a Starter private organization'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organizations
    where id = (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  ),
  0,
  'authenticated outsider cannot read a Starter private organization row'
);

reset role;
set local role anon;

select extensions.throws_ok(
  format(
    $$ select public.current_user_can_enter_organization(%L::uuid) $$,
    (select result ->> 'organizationId' from test_org_profile_result)
  ),
  '42501',
  'permission denied for function current_user_can_enter_organization',
  'anon cannot execute organization entry helper'
);

select extensions.throws_ok(
  format(
    $$ select count(*)::integer from public.organizations where id = %L::uuid $$,
    (select result ->> 'organizationId' from test_org_profile_result)
  ),
  '42501',
  'permission denied for function current_user_has_organization_role',
  'anon cannot read a Starter private organization row'
);

select extensions.ok(
  public.current_user_can_read_course('course-p15-org-profile-platform'),
  'platform catalogue course readability remains functional for anonymous catalogue access'
);

reset role;
set local role service_role;

update public.organizations
set lifecycle_status = 'suspended',
    status = 'published'
where id = (select (result ->> 'organizationId')::uuid from test_org_profile_result);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.ok(
  not public.organization_allows_learner_entry(
    (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  )
  and not public.current_user_can_enter_organization(
    (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  )
  and not public.current_user_can_read_course('course-p15-org-profile-private'),
  'suspended organizations block learner entry and private course reads'
);

reset role;
set local role service_role;

update public.organizations
set lifecycle_status = 'active',
    status = 'archived'
where id = (select (result ->> 'organizationId')::uuid from test_org_profile_result);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.ok(
  not public.organization_allows_learner_entry(
    (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  )
  and not public.current_user_can_enter_organization(
    (select (result ->> 'organizationId')::uuid from test_org_profile_result)
  ),
  'content-archived organizations block learner entry even when lifecycle is active'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_update_organization_profile'
      and identity_arguments = 'p_organization_id uuid, p_short_name text, p_description text, p_logo_url text, p_accent_token organization_accent_token, p_support_email text, p_support_phone text, p_verification_status organization_verification_status, p_lifecycle_status organization_lifecycle_status'
      and classification = 'ADMIN_AUTHENTICATED'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'current_user_can_enter_organization'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'organization_allows_learner_entry'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
  ),
  'organization profile and entry RPCs are explicitly classified'
);

select * from extensions.finish();

rollback;
