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
  (:'TEST_ADMIN_USER_ID'::uuid, 'authenticated', 'authenticated', 'pgtap-invite-admin@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('81818181-8181-4818-8818-181818181801'::uuid, 'authenticated', 'authenticated', 'pgtap-invite-owner-a@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('82828282-8282-4828-8828-282828282802'::uuid, 'authenticated', 'authenticated', 'pgtap-invite-owner-b@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('83838383-8383-4838-8838-383838383803'::uuid, 'authenticated', 'authenticated', 'pgtap-invite-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('84848484-8484-4848-8848-484848484804'::uuid, 'authenticated', 'authenticated', 'pgtap-invite-email@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('85858585-8585-4858-8858-585858585805'::uuid, 'authenticated', 'authenticated', 'pgtap-invite-outsider@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
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
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP Invite Admin', 0, 0, 'admin'),
  ('81818181-8181-4818-8818-181818181801'::uuid, 'Local pgTAP Invite Owner A', 0, 0, 'learner'),
  ('82828282-8282-4828-8828-282828282802'::uuid, 'Local pgTAP Invite Owner B', 0, 0, 'learner'),
  ('83838383-8383-4838-8838-383838383803'::uuid, 'Local pgTAP Invite Learner', 0, 0, 'learner'),
  ('84848484-8484-4848-8848-484848484804'::uuid, 'Local pgTAP Invite Email Learner', 0, 0, 'learner'),
  ('85858585-8585-4858-8858-585858585805'::uuid, 'Local pgTAP Invite Outsider', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

insert into public.organizations (
  slug,
  name,
  status,
  lifecycle_status,
  created_by
)
values
  ('lms-invite-alpha', 'LMS Invite Alpha', 'published', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  ('lms-invite-beta', 'LMS Invite Beta', 'published', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status,
      lifecycle_status = excluded.lifecycle_status;

select id as invite_alpha_org_id
from public.organizations
where slug = 'lms-invite-alpha'
\gset

select id as invite_beta_org_id
from public.organizations
where slug = 'lms-invite-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'invite_alpha_org_id'::uuid, '81818181-8181-4818-8818-181818181801'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'invite_beta_org_id'::uuid, '82828282-8282-4828-8828-282828282802'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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
  'course-lms-invite-platform',
  'course-lms-invite-platform',
  'LMS Invite Platform Course',
  'A reusable platform course for invitation coverage.',
  'Organisation learners',
  array['Complete invited programme course'],
  'Values Education',
  'beginner',
  'published',
  1190,
  10
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
  status,
  created_by
)
values (
  :'invite_alpha_org_id'::uuid,
  'invite-programme',
  'Invite Programme',
  'Validate programme-only invitations.',
  'Invited learners',
  'published',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      status = excluded.status;

select id as invite_programme_id
from public.programmes
where organization_id = :'invite_alpha_org_id'::uuid
  and slug = 'invite-programme'
\gset

insert into public.programme_courses (
  programme_id,
  course_id,
  sort_order,
  requirement
)
values (
  :'invite_programme_id'::uuid,
  'course-lms-invite-platform',
  1,
  'required'
)
on conflict (programme_id, course_id) do update
  set sort_order = excluded.sort_order;

insert into public.cohorts (
  organization_id,
  slug,
  title,
  description,
  status,
  created_by
)
values (
  :'invite_alpha_org_id'::uuid,
  'invite-cohort',
  'Invite Cohort',
  'Validate cohort invitations.',
  'published',
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      status = excluded.status;

select id as invite_cohort_id
from public.cohorts
where organization_id = :'invite_alpha_org_id'::uuid
  and slug = 'invite-cohort'
\gset

reset role;

select set_config('request.jwt.claim.sub', '81818181-8181-4818-8818-181818181801', true);
set local role authenticated;

create temporary table test_org_invite_result
on commit drop
as
select public.admin_create_organization_invitation(
  :'invite_alpha_org_id'::uuid,
  'organization',
  null,
  null,
  '83838383-8383-4838-8838-383838383803'::uuid,
  'learner',
  now() + interval '7 days'
) as result;

grant select on test_org_invite_result to authenticated, service_role;

select extensions.is(
  (select result ->> 'status' from test_org_invite_result),
  'pending',
  'organisation owner can create a pending organisation invitation'
);

set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.user_notifications
    where user_id = '83838383-8383-4838-8838-383838383803'::uuid
      and event_type = 'organization_invitation'
      and cta_href = '/org/my'
  ),
  'existing-user invitations create an in-app notification for /org/my'
);

select extensions.ok(
  exists (
    select 1
    from public.organization_invitations
    where id = (select (result ->> 'invitationId')::uuid from test_org_invite_result)
      and token_hash is not null
      and token_hash !~ '@'
      and email = 'pgtap-invite-learner@example.test'
  ),
  'invitation stores a token hash and normalized email instead of a plaintext reusable secret'
);

reset role;
select set_config('request.jwt.claim.sub', '83838383-8383-4838-8838-383838383803', true);
set local role authenticated;

create temporary table test_org_accept_result
on commit drop
as
select public.respond_organization_invitation(
  (select (result ->> 'invitationId')::uuid from test_org_invite_result),
  'accept'
) as result;

grant select on test_org_accept_result to authenticated, service_role;

select extensions.ok(
  exists (
    select 1
    from public.organization_memberships
    where organization_id = :'invite_alpha_org_id'::uuid
      and user_id = '83838383-8383-4838-8838-383838383803'::uuid
      and role = 'learner'
      and status = 'active'
  ),
  'accepting an organisation invitation creates active membership'
);

select extensions.is(
  (
    select public.respond_organization_invitation(
      (select (result ->> 'invitationId')::uuid from test_org_invite_result),
      'accept'
    ) ->> 'idempotent'
  ),
  'true',
  'accepting an already accepted invitation is idempotent for the same user'
);

set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type = 'organization_invitation_accepted'
      and entity_id = (select result ->> 'invitationId' from test_org_invite_result)
  ),
  'invitation acceptance is audited'
);

reset role;
select set_config('request.jwt.claim.sub', '81818181-8181-4818-8818-181818181801', true);
set local role authenticated;

create temporary table test_programme_invite_result
on commit drop
as
select public.admin_create_organization_invitation(
  :'invite_alpha_org_id'::uuid,
  'programme',
  :'invite_programme_id'::uuid,
  'pgtap-invite-email@example.test',
  null,
  'learner',
  now() + interval '7 days'
) as result;

grant select on test_programme_invite_result to authenticated, service_role;

reset role;
select set_config('request.jwt.claim.sub', '84848484-8484-4848-8848-484848484804', true);
set local role authenticated;

select public.respond_organization_invitation(
  (select (result ->> 'invitationId')::uuid from test_programme_invite_result),
  'accept'
) as programme_accept_result
\gset

select extensions.ok(
  exists (
    select 1
    from public.enrolments
    where organization_id = :'invite_alpha_org_id'::uuid
      and user_id = '84848484-8484-4848-8848-484848484804'::uuid
      and programme_id = :'invite_programme_id'::uuid
      and status = 'active'
  )
  and exists (
    select 1
    from public.enrolments
    where organization_id = :'invite_alpha_org_id'::uuid
      and user_id = '84848484-8484-4848-8848-484848484804'::uuid
      and course_id = 'course-lms-invite-platform'
      and assignment_source = 'programme'
  ),
  'programme invitations create programme and programme-course enrolments'
);

select extensions.ok(
  not exists (
    select 1
    from public.organization_memberships
    where organization_id = :'invite_alpha_org_id'::uuid
      and user_id = '84848484-8484-4848-8848-484848484804'::uuid
  ),
  'programme-only invitations do not create broad organisation membership'
);

select extensions.ok(
  public.current_user_can_enter_organization(:'invite_alpha_org_id'::uuid),
  'programme-only invitees can still enter the organisation context'
);

reset role;
select set_config('request.jwt.claim.sub', '81818181-8181-4818-8818-181818181801', true);
set local role authenticated;

create temporary table test_revoked_invite_result
on commit drop
as
select public.admin_create_organization_invitation(
  :'invite_alpha_org_id'::uuid,
  'cohort',
  :'invite_cohort_id'::uuid,
  null,
  '85858585-8585-4858-8858-585858585805'::uuid,
  'learner',
  now() + interval '7 days'
) as result;

grant select on test_revoked_invite_result to authenticated, service_role;

select public.admin_revoke_organization_invitation(
  (select (result ->> 'invitationId')::uuid from test_revoked_invite_result)
) as revoke_result
\gset

select extensions.is(
  :'revoke_result'::jsonb ->> 'status',
  'revoked',
  'organisation owner can revoke a pending invitation'
);

reset role;
select set_config('request.jwt.claim.sub', '85858585-8585-4858-8858-585858585805', true);
set local role authenticated;

select extensions.throws_like(
  format(
    $$ select public.respond_organization_invitation(%L::uuid, 'accept') $$,
    (select result ->> 'invitationId' from test_revoked_invite_result)
  ),
  '%Invitation is no longer available%',
  'revoked invitations cannot be accepted'
);

set local role service_role;

insert into public.organization_invitations (
  organization_id,
  target_type,
  target_id,
  email,
  invited_user_id,
  role,
  token_hash,
  status,
  expires_at,
  invited_by
)
values (
  :'invite_alpha_org_id'::uuid,
  'organization',
  null,
  'pgtap-invite-outsider@example.test',
  '85858585-8585-4858-8858-585858585805'::uuid,
  'learner',
  encode(extensions.digest('expired-invite-token', 'sha256'), 'hex'),
  'pending',
  now() - interval '1 day',
  '81818181-8181-4818-8818-181818181801'::uuid
)
returning id as expired_invitation_id
\gset

reset role;
select set_config('request.jwt.claim.sub', '85858585-8585-4858-8858-585858585805', true);
set local role authenticated;

select extensions.throws_like(
  format(
    $$ select public.respond_organization_invitation(%L::uuid, 'accept') $$,
    :'expired_invitation_id'
  ),
  '%Invitation has expired%',
  'expired invitations cannot be accepted'
);

reset role;
select set_config('request.jwt.claim.sub', '81818181-8181-4818-8818-181818181801', true);
set local role authenticated;

create temporary table test_cross_org_invite_result
on commit drop
as
select public.admin_create_organization_invitation(
  :'invite_alpha_org_id'::uuid,
  'organization',
  null,
  'pgtap-cross-org@example.test',
  null,
  'learner',
  now() + interval '7 days'
) as result;

grant select on test_cross_org_invite_result to authenticated, service_role;

reset role;
select set_config('request.jwt.claim.sub', '82828282-8282-4828-8828-282828282802', true);
set local role authenticated;

select extensions.throws_like(
  format(
    $$ select public.admin_revoke_organization_invitation(%L::uuid) $$,
    (select result ->> 'invitationId' from test_cross_org_invite_result)
  ),
  '%Audience manager access required%',
  'Organisation B owner cannot modify Organisation A invitations'
);

select extensions.throws_like(
  format(
    $$ select public.admin_create_organization_invitation(%L::uuid, 'organization', null, 'blocked@example.test', null, 'learner', now() + interval '7 days') $$,
    :'invite_alpha_org_id'
  ),
  '%Audience manager access required%',
  'Organisation B owner cannot create Organisation A invitations'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.ok(
  not has_function_privilege('anon', 'public.respond_organization_invitation(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_create_organization_invitation(uuid, public.organization_invitation_target_type, uuid, text, uuid, public.organization_role_key, timestamp with time zone)', 'execute')
  and has_function_privilege('authenticated', 'public.respond_organization_invitation(uuid, text)', 'execute'),
  'invitation RPC grants are restricted to authenticated/service-role callers'
);

reset role;
select set_config('request.jwt.claim.sub', '85858585-8585-4858-8858-585858585805', true);
set local role authenticated;

select extensions.throws_like(
  $$ update public.organization_invitations set status = 'accepted' where true $$,
  '%permission denied%',
  'authenticated users cannot update invitation rows directly'
);

reset role;

select extensions.ok(
  exists (
    select 1
    from private.rpc_security_classifications
    where function_name = 'respond_organization_invitation'
      and classification = 'PUBLIC_AUTHENTICATED_SELF'
  )
  and exists (
    select 1
    from private.rpc_security_classifications
    where function_name = 'admin_create_organization_invitation'
      and classification = 'ADMIN_AUTHENTICATED'
  ),
  'invitation RPCs are classified'
);

set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.audit_events
    where event_type in (
      'organization_invitation_created',
      'organization_invitation_accepted',
      'organization_invitation_revoked',
      'organization_invitation_expired'
    )
  ),
  'invitation lifecycle changes are audited'
);

select * from extensions.finish();

rollback;
