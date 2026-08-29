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
    :'TEST_ADMIN_USER_ID'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-p03-admin@example.test',
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
    'pgtap-p03-member@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '31313131-3131-4131-8131-313131313131'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-p03-enrolled@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '32323232-3232-4232-8232-323232323232'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-p03-outsider@example.test',
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

insert into public.profiles (id, display_name, xp, xp_balance_cached, role)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'P03 Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'P03 Member', 0, 0, 'learner'),
  ('31313131-3131-4131-8131-313131313131'::uuid, 'P03 Enrolled Learner', 0, 0, 'learner'),
  ('32323232-3232-4232-8232-323232323232'::uuid, 'P03 Outsider', 0, 0, 'learner')
on conflict (id) do update
set display_name = excluded.display_name,
    xp = excluded.xp,
    xp_balance_cached = excluded.xp_balance_cached,
    role = excluded.role,
    updated_at = now();

insert into public.organizations (
  id,
  slug,
  name,
  short_name,
  logo_url,
  accent_token,
  status,
  lifecycle_status,
  created_by
)
values (
  '30303030-3030-4030-8030-303030303010'::uuid,
  'p03-workspace-context',
  'P03 Workspace Context Organisation',
  'P03 Workspace',
  'https://assets.example.test/p03-workspace.png',
  'violet',
  'published',
  'active',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    short_name = excluded.short_name,
    logo_url = excluded.logo_url,
    accent_token = excluded.accent_token,
    status = excluded.status,
    lifecycle_status = excluded.lifecycle_status,
    updated_at = now();

insert into public.organization_plan_assignments (
  organization_id,
  plan_key,
  billing_status,
  assigned_by
)
values (
  '30303030-3030-4030-8030-303030303010'::uuid,
  'team',
  'active',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (organization_id) where ended_at is null do update
set plan_key = excluded.plan_key,
    billing_status = excluded.billing_status,
    assigned_by = excluded.assigned_by;

update public.xp_accounts
set display_name_plural = 'P03 Credits',
    short_label = 'P03',
    display_format = 'amount_short_label'
where organization_id = '30303030-3030-4030-8030-303030303010'::uuid
  and scope = 'organization'
  and is_default
  and status = 'active';

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values (
  '30303030-3030-4030-8030-303030303010'::uuid,
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
  'course-p03-workspace-context',
  'course-p03-workspace-context',
  'P03 Workspace Course',
  'A focused course identifier for workspace-context coverage.',
  'Organisation learners',
  array['Resolve a scoped delivery context'],
  'Values Education',
  'beginner',
  'published',
  3030,
  10,
  'organization_private',
  '30303030-3030-4030-8030-303030303010'::uuid
)
on conflict (id) do update
set title = excluded.title,
    status = excluded.status,
    catalog_scope = excluded.catalog_scope,
    organization_id = excluded.organization_id,
    updated_at = now();

insert into public.programmes (
  id,
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status,
  created_by
)
values (
  '30303030-3030-4030-8030-303030303020'::uuid,
  '30303030-3030-4030-8030-303030303010'::uuid,
  'p03-workspace-programme',
  'P03 Workspace Programme',
  'Exercise one-operation learner context resolution.',
  'Organisation learners',
  'published',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (id) do update
set title = excluded.title,
    status = excluded.status,
    updated_at = now();

insert into public.programme_courses (programme_id, course_id, sort_order, requirement)
values (
  '30303030-3030-4030-8030-303030303020'::uuid,
  'course-p03-workspace-context',
  1,
  'required'
)
on conflict (programme_id, course_id) do update
set sort_order = excluded.sort_order,
    requirement = excluded.requirement;

insert into public.enrolments (
  organization_id,
  user_id,
  programme_id,
  assignment_source,
  status,
  metadata
)
values (
  '30303030-3030-4030-8030-303030303010'::uuid,
  '31313131-3131-4131-8131-313131313131'::uuid,
  '30303030-3030-4030-8030-303030303020'::uuid,
  'programme',
  'active',
  '{}'::jsonb
)
on conflict (organization_id, user_id, programme_id) where programme_id is not null do update
set status = excluded.status,
    updated_at = now();

insert into public.user_xp_balances (user_id, xp_account_id, balance_cached)
select :'TEST_LEARNER_USER_ID'::uuid, account.id, 27
from public.xp_accounts account
where account.organization_id = '30303030-3030-4030-8030-303030303010'::uuid
  and account.scope = 'organization'
  and account.is_default
  and account.status = 'active'
on conflict (user_id, xp_account_id) do update
set balance_cached = excluded.balance_cached;

insert into public.user_xp_balances (user_id, xp_account_id, balance_cached)
select '31313131-3131-4131-8131-313131313131'::uuid, account.id, 42
from public.xp_accounts account
where account.organization_id = '30303030-3030-4030-8030-303030303010'::uuid
  and account.scope = 'organization'
  and account.is_default
  and account.status = 'active'
on conflict (user_id, xp_account_id) do update
set balance_cached = excluded.balance_cached;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.get_organization_learner_workspace_context('p03-workspace-context') as member_context
\gset

select extensions.is(
  :'member_context'::jsonb ->> 'accessSource',
  'membership',
  'active organization member resolves a membership-scoped workspace context'
);

select extensions.is(
  :'member_context'::jsonb -> 'membershipRoles',
  '["learner"]'::jsonb,
  'member context returns only the current caller active roles'
);

select extensions.ok(
  (:'member_context'::jsonb -> 'courseIds') ? 'course-p03-workspace-context'
  and :'member_context'::jsonb -> 'courseDeliveries' @> '[{"courseId":"course-p03-workspace-context","scope":"organization","programmeId":null}]'::jsonb,
  'member context returns organization course and delivery identifiers without screen payloads'
);

select extensions.ok(
  :'member_context'::jsonb -> 'branding' @> '{"name":"P03 Workspace Context Organisation","shortName":"P03 Workspace","accentToken":"violet"}'::jsonb
  and :'member_context'::jsonb -> 'xpAccount' @> '{"balance":27,"label":"P03","type":"organization"}'::jsonb,
  'member context returns restrained branding and caller XP account state'
);

select extensions.ok(
  not (:'member_context'::jsonb ?| array['missions', 'missionIds', 'assessments', 'rewards', 'courses']),
  'workspace context excludes mission, assessment, reward, and course screen data'
);

reset role;
select set_config('request.jwt.claim.sub', '31313131-3131-4131-8131-313131313131', true);
set local role authenticated;

select public.get_organization_learner_workspace_context('p03-workspace-context') as enrolled_context
\gset

select extensions.is(
  :'enrolled_context'::jsonb ->> 'accessSource',
  'programme_enrolment',
  'enrolled learner resolves a programme-enrolment workspace context without membership'
);

select extensions.ok(
  (:'enrolled_context'::jsonb -> 'programmeIds') ? '30303030-3030-4030-8030-303030303020'
  and (:'enrolled_context'::jsonb -> 'courseIds') ? 'course-p03-workspace-context',
  'enrolled learner context returns assigned programme and course identifiers'
);

select extensions.ok(
  :'enrolled_context'::jsonb -> 'courseDeliveries' @> '[{"courseId":"course-p03-workspace-context","label":"P03 Workspace Programme","programmeId":"30303030-3030-4030-8030-303030303020","scope":"programme"}]'::jsonb
  and (:'enrolled_context'::jsonb -> 'xpAccount' ->> 'balance')::integer = 42,
  'enrolled learner context returns programme delivery identity and caller XP balance'
);

reset role;
select set_config('request.jwt.claim.sub', '32323232-3232-4232-8232-323232323232', true);
set local role authenticated;

select extensions.is(
  public.get_organization_learner_workspace_context('p03-workspace-context'),
  null::jsonb,
  'authenticated outsider cannot resolve an organization workspace context'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.ok(
  public.get_organization_learner_workspace_context('p03-workspace-context')
    ->> 'organizationId' = '30303030-3030-4030-8030-303030303010',
  'platform admin retains authorized organization workspace resolution'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

select extensions.is(
  public.get_organization_learner_workspace_context('p03-workspace-context'),
  null::jsonb,
  'service role without a user JWT subject cannot invent a learner workspace context'
);

reset role;
set local role anon;

select extensions.throws_ok(
  $$ select public.get_organization_learner_workspace_context('p03-workspace-context') $$,
  '42501',
  'permission denied for function get_organization_learner_workspace_context',
  'anonymous callers cannot execute the organization workspace context RPC'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'get_organization_learner_workspace_context'
      and identity_arguments = 'p_organization_slug text'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
      and execute_roles = array['authenticated', 'service_role']
  ),
  'workspace context RPC is explicitly classified as authenticated self-scoped read access'
);

select extensions.ok(
  (
    select procedure.prosecdef
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'get_organization_learner_workspace_context'
      and pg_get_function_identity_arguments(procedure.oid) = 'p_organization_slug text'
  ),
  'workspace context aggregation has an explicit narrow SECURITY DEFINER boundary'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.get_organization_learner_workspace_context(text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_organization_learner_workspace_context(text)', 'execute')
  and has_function_privilege('service_role', 'public.get_organization_learner_workspace_context(text)', 'execute'),
  'workspace context RPC execute grants match its authenticated and service-role classification'
);

select * from extensions.finish();

rollback;
