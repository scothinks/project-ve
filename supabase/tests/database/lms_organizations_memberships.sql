begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(19);

set local role service_role;

select extensions.is(
  (select count(*)::integer from public.organization_roles),
  8,
  'initial organization role catalogue contains the P1 roles'
);

select extensions.ok(
  exists(select 1 from public.organization_roles where role = 'organisation_owner')
  and exists(select 1 from public.organization_roles where role = 'learner'),
  'organization role catalogue separates contextual roles from platform profile roles'
);

select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

create temporary table test_lms_org_result
on commit drop
as
select public.admin_upsert_organization(
  null,
  'LMS Alpha Organisation',
  'lms-alpha-organisation',
  'published'
) as result;

grant select on test_lms_org_result to anon, authenticated, service_role;

select extensions.ok(
  (select (result ->> 'organizationId')::uuid is not null from test_lms_org_result),
  'platform admin can create an organization through the admin RPC'
);

reset role;
set local role service_role;

insert into public.organizations (slug, name, status, created_by)
values ('lms-beta-organisation', 'LMS Beta Organisation', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status
returning id as organization_id
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  ((select (result ->> 'organizationId')::uuid from test_lms_org_result), :'TEST_LEARNER_USER_ID'::uuid, 'organisation_admin', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'organization_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'organization_id'::uuid, :'TEST_ADMIN_USER_ID'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

select extensions.is(
  (select role from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  'learner',
  'organization roles do not promote a learner to platform admin'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organization_memberships
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and organization_id in ((select (result ->> 'organizationId')::uuid from test_lms_org_result), :'organization_id'::uuid)
      and role in ('organisation_admin', 'learner')
  ),
  2,
  'one user can hold different contextual roles in different organizations'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.admin_upsert_organization(null, 'Unauthorized Org', 'unauthorized-org', 'draft') $$,
  'P0001',
  'Only a platform admin can manage organizations.',
  'non-platform admin cannot manage organizations'
);

select extensions.lives_ok(
  format(
    $$ select public.admin_upsert_organization_membership(%L::uuid, %L::uuid, 'learner', 'active') $$,
    (select result ->> 'organizationId' from test_lms_org_result),
    :'TEST_ADMIN_USER_ID'
  ),
  'organisation_admin can manage organization memberships in their organization'
);

select extensions.ok(
  public.current_user_has_organization_role(
    (select (result ->> 'organizationId')::uuid from test_lms_org_result),
    array['organisation_admin']::public.organization_role_key[]
  ),
  'contextual role helper returns true for the caller role in the selected organization'
);

select extensions.ok(
  not public.current_user_has_organization_role(
    :'organization_id'::uuid,
    array['organisation_admin']::public.organization_role_key[]
  ),
  'contextual role helper does not leak a role from one organization to another'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organizations
  ),
  2,
  'member can read organizations where they have active memberships'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organization_memberships
  ),
  3,
  'organisation_admin can read memberships for their managed organization plus their own memberships elsewhere'
);

reset role;
set local role service_role;

update public.organization_memberships
set status = 'suspended'
where organization_id = :'organization_id'::uuid
  and user_id = :'TEST_LEARNER_USER_ID'::uuid
  and role = 'learner';

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.organizations
  ),
  1,
  'suspended memberships no longer grant organization visibility'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organization_memberships
    where organization_id = :'organization_id'::uuid
  ),
  1,
  'suspended memberships remain visible to their user without granting organization visibility'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.organizations
    where slug in ('lms-alpha-organisation', 'lms-beta-organisation')
  ),
  2,
  'platform admin can read all organizations'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organization_memberships
    where organization_id in ((select (result ->> 'organizationId')::uuid from test_lms_org_result), :'organization_id'::uuid)
  ),
  4,
  'platform admin can read all organization memberships'
);

reset role;
set local role anon;

select extensions.throws_ok(
  $$ select public.admin_upsert_organization(null, 'Anon Org', 'anon-org', 'draft') $$,
  '42501',
  'permission denied for function admin_upsert_organization',
  'anon cannot execute organization management RPC'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_upsert_organization(uuid, text, text, public.content_status)', 'execute')
  and not has_function_privilege('anon', 'public.admin_upsert_organization(uuid, text, text, public.content_status)', 'execute'),
  'organization admin RPC execute grants are authenticated only before in-function platform admin checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.current_user_has_organization_role(uuid, public.organization_role_key[])', 'execute')
  and not has_function_privilege('anon', 'public.current_user_has_organization_role(uuid, public.organization_role_key[])', 'execute'),
  'organization role helper is available only to authenticated API callers'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_schema = 'public'
      and function_name = 'admin_upsert_organization_membership'
      and identity_arguments = 'p_organization_id uuid, p_user_id uuid, p_role organization_role_key, p_status organization_membership_status'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'organization membership management RPC is explicitly classified'
);

select * from extensions.finish();

rollback;
