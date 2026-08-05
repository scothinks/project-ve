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
    :'TEST_LEARNER_USER_ID'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-self-service-owner@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    :'TEST_ADMIN_USER_ID'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-self-service-admin@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '77777777-7777-4777-8777-777777777721'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-self-service-outsider@example.test',
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
  (:'TEST_LEARNER_USER_ID'::uuid, 'Local pgTAP Self Service Owner', 0, 0, 'learner'),
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP Self Service Admin', 0, 0, 'admin'),
  ('77777777-7777-4777-8777-777777777721'::uuid, 'Local pgTAP Self Service Outsider', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

create temporary table test_self_service_org_result
on commit drop
as
select public.create_self_service_organization(
  'Self Service Civic Club',
  '',
  'Civic Club',
  'A private Starter workspace for civic learning.',
  'SUPPORT@CIVIC-CLUB.EXAMPLE',
  true
) as result;

grant select on test_self_service_org_result to anon, authenticated, service_role;

select extensions.is(
  (select result ->> 'status' from test_self_service_org_result),
  'created',
  'authenticated learner can create a self-service organization'
);

select extensions.ok(
  (
    select slug = 'self-service-civic-club'
      and short_name = 'Civic Club'
      and description = 'A private Starter workspace for civic learning.'
      and support_email = 'support@civic-club.example'
      and status = 'published'::public.content_status
      and creation_source = 'self_service'::public.organization_creation_source
      and verification_status = 'unverified'::public.organization_verification_status
      and lifecycle_status = 'active'::public.organization_lifecycle_status
    from public.organizations
    where id = (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
  ),
  'self-service organization stores safe identity defaults and normalized support contact'
);

select extensions.ok(
  exists (
    select 1
    from public.organization_memberships
    where organization_id = (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
      and user_id = :'TEST_LEARNER_USER_ID'::uuid
      and role = 'organisation_owner'
      and status = 'active'
  )
  and not exists (
    select 1
    from public.organization_memberships
    where organization_id = (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
      and user_id = :'TEST_LEARNER_USER_ID'::uuid
      and role <> 'organisation_owner'
  )
  and (
    select role = 'learner'
    from public.profiles
    where id = :'TEST_LEARNER_USER_ID'::uuid
  ),
  'creator receives only organization_owner membership and remains a learner profile'
);

select extensions.is(
  (
    select plan_key
    from public.organization_plan_assignments
    where organization_id = (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
      and ended_at is null
  ),
  'starter',
  'self-service organizations receive Starter plan assignment immediately'
);

select extensions.is(
  (
    select billing_status
    from public.organization_plan_assignments
    where organization_id = (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
      and ended_at is null
  ),
  'free'::public.organization_billing_status,
  'self-service organizations cannot choose a paid billing status'
);

select extensions.is(
  (
    select public.resolve_organization_entitlements(
      (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
    ) ->> 'max_courses'
  ),
  '1',
  'Starter entitlements apply to the creator immediately'
);

select extensions.ok(
  public.current_user_can_manage_organization(
    (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
  )
  and public.current_user_can_enter_organization(
    (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
  ),
  'creator owner can open management and learner entry contexts'
);

reset role;
set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.organization_creation_attempts
    where organization_id = (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
      and user_id = :'TEST_LEARNER_USER_ID'::uuid
      and attempted_slug = 'self-service-civic-club'
      and succeeded
  )
  and exists (
    select 1
    from public.audit_events
    where event_type = 'organization_self_service_created'
      and entity_id = (select result ->> 'organizationId' from test_self_service_org_result)
  ),
  'self-service creation records attempt and audit metadata'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.create_self_service_organization('Self Service Civic Club', 'self-service-civic-club', null, '', null, true) $$,
  'P0001',
  'Organization slug is already in use.',
  'slug uniqueness is enforced in the self-service RPC'
);

select extensions.throws_ok(
  $$ select public.create_self_service_organization('No Terms Org', 'no-terms-org', null, '', null, false) $$,
  'P0001',
  'Accept the organization terms to continue.',
  'self-service organization creation requires accepted terms'
);

select extensions.throws_ok(
  $$ select public.create_self_service_organization('Bad Email Org', 'bad-email-org', null, '', 'bad-email', true) $$,
  'P0001',
  'Organization support email is invalid.',
  'self-service organization creation validates support email'
);

do $$ begin
  perform public.create_self_service_organization('Second Self Service Org', 'second-self-service-org', null, '', null, true);
  perform public.create_self_service_organization('Third Self Service Org', 'third-self-service-org', null, '', null, true);
end $$;

select extensions.throws_ok(
  $$ select public.create_self_service_organization('Fourth Self Service Org', 'fourth-self-service-org', null, '', null, true) $$,
  'P0001',
  'Organization creation is temporarily limited. Please try again later.',
  'self-service organization creation is rate-limited per user'
);

reset role;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777721', true);
set local role authenticated;

select extensions.ok(
  not public.current_user_can_enter_organization(
    (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
  ),
  'authenticated outsider cannot enter a self-service Starter organization'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organizations
    where id = (select (result ->> 'organizationId')::uuid from test_self_service_org_result)
  ),
  0,
  'self-service Starter organization is not publicly listed to authenticated outsiders'
);

reset role;
set local role anon;

select extensions.throws_ok(
  $$ select public.create_self_service_organization('Anon Org', 'anon-org', null, '', null, true) $$,
  '42501',
  'permission denied for function create_self_service_organization',
  'anon cannot execute self-service organization creation'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.create_self_service_organization(text, text, text, text, text, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.create_self_service_organization(text, text, text, text, text, boolean)', 'execute'),
  'self-service creation RPC grants stay authenticated-only'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'create_self_service_organization'
      and identity_arguments = 'p_name text, p_slug text, p_short_name text, p_description text, p_support_email text, p_terms_accepted boolean'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
  ),
  'self-service creation RPC is explicitly classified'
);

select * from extensions.finish();

rollback;
