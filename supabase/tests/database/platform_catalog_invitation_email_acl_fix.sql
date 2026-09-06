begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(12);

set local session_replication_role = replica;

insert into auth.users (
  id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('31100000-0000-4000-8000-000000000001'::uuid, 'authenticated', 'authenticated', 'catalog-invite-acl-manager@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('31100000-0000-4000-8000-000000000002'::uuid, 'authenticated', 'authenticated', 'catalog-invite-acl-invitee@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('31100000-0000-4000-8000-000000000003'::uuid, 'authenticated', 'authenticated', 'catalog-invite-acl-outsider@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update set email = excluded.email, updated_at = now();

set local session_replication_role = origin;
set local role service_role;

insert into public.profiles (id, display_name, role)
values
  ('31100000-0000-4000-8000-000000000001'::uuid, 'Catalog Invite ACL Manager', 'learner'),
  ('31100000-0000-4000-8000-000000000002'::uuid, 'Catalog Invite ACL Invitee', 'learner'),
  ('31100000-0000-4000-8000-000000000003'::uuid, 'Catalog Invite ACL Outsider', 'learner')
on conflict (id) do update
set display_name = excluded.display_name, role = excluded.role, updated_at = now();

insert into public.platform_catalog_memberships (user_id, role, status, invited_by)
values (
  '31100000-0000-4000-8000-000000000001'::uuid,
  'organisation_owner',
  'active',
  '31100000-0000-4000-8000-000000000001'::uuid
)
on conflict (user_id, role) do update set status = excluded.status, updated_at = now();

insert into public.platform_catalog_invitations (
  id, email, role, token_hash, status, expires_at, invited_by
)
values (
  '31100000-0000-4000-8000-000000000101'::uuid,
  'catalog-invite-acl-invitee@example.test',
  'content_editor',
  md5(gen_random_uuid()::text || clock_timestamp()::text),
  'pending',
  now() + interval '1 day',
  '31100000-0000-4000-8000-000000000001'::uuid
)
on conflict (id) do update
set email = excluded.email,
    invited_user_id = null,
    role = excluded.role,
    token_hash = excluded.token_hash,
    status = excluded.status,
    expires_at = excluded.expires_at,
    invited_by = excluded.invited_by,
    accepted_by = null,
    accepted_at = null,
    updated_at = now();

reset role;

select extensions.ok(
  position(
    'private.authenticated_user_email'
    in pg_get_functiondef('public.current_user_can_read_platform_catalog_invitation(uuid)'::regprocedure)
  ) = 0,
  'the invitation read boundary does not depend on the private email helper ACL'
);

select extensions.ok(
  position(
    'private.authenticated_user_email'
    in pg_get_functiondef('public.respond_platform_catalog_invitation(uuid,text)'::regprocedure)
  ) = 0,
  'the invitation response boundary does not depend on the private email helper ACL'
);

select extensions.ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_catalog_invitations'
      and policyname = 'Participants can read platform catalog invitations'
      and cmd = 'SELECT'
      and position('current_user_can_read_platform_catalog_invitation' in coalesce(qual, '')) > 0
      and position('authenticated_user_email' in coalesce(qual, '')) = 0
  ),
  'the deployed invitation SELECT policy uses the public read boundary and not the private helper'
);

select extensions.ok(
  not has_function_privilege('authenticated', 'private.authenticated_user_email()', 'execute'),
  'the private authenticated-email helper remains unavailable to authenticated callers'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '31100000-0000-4000-8000-000000000001',
    'email', 'catalog-invite-acl-manager@example.test',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select extensions.throws_like(
  $$ select private.authenticated_user_email() $$,
  '%permission denied%',
  'authenticated callers still cannot execute the private helper directly'
);

select extensions.is(
  (
    select count(*)::integer
    from public.platform_catalog_invitations
    where id = '31100000-0000-4000-8000-000000000101'::uuid
  ),
  1,
  'a Catalog manager can read invitation rows without invoking the private helper'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '31100000-0000-4000-8000-000000000002',
    'email', 'CATALOG-INVITE-ACL-INVITEE@EXAMPLE.TEST',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.platform_catalog_invitations
    where id = '31100000-0000-4000-8000-000000000101'::uuid
  ),
  1,
  'an email-only invitee can read their invitation using the normalized signed JWT email claim'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '31100000-0000-4000-8000-000000000003',
    'email', 'catalog-invite-acl-outsider@example.test',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select extensions.is_empty(
  $$
    select 1
    from public.platform_catalog_invitations
    where id = '31100000-0000-4000-8000-000000000101'::uuid
  $$,
  'an unrelated authenticated caller cannot read the invitation'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '31100000-0000-4000-8000-000000000002',
    'email', 'CATALOG-INVITE-ACL-INVITEE@EXAMPLE.TEST',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select extensions.is(
  public.respond_platform_catalog_invitation(
    '31100000-0000-4000-8000-000000000101'::uuid,
    'accept'
  ) ->> 'status',
  'accepted',
  'an email-only invitee can accept their invitation without the private helper'
);

reset role;
set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.platform_catalog_memberships
    where user_id = '31100000-0000-4000-8000-000000000002'::uuid
      and role = 'content_editor'
      and status = 'active'
  ),
  'acceptance creates the expected active Catalog membership'
);

select extensions.is(
  (
    select status::text
    from public.platform_catalog_invitations
    where id = '31100000-0000-4000-8000-000000000101'::uuid
  ),
  'accepted',
  'acceptance updates the invitation status'
);

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type = 'platform_catalog_invitation_accepted'
      and actor_user_id = '31100000-0000-4000-8000-000000000002'::uuid
      and entity_id = '31100000-0000-4000-8000-000000000101'
  ),
  'acceptance remains audit logged'
);

select * from extensions.finish();
rollback;
