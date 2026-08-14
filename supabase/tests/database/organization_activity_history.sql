begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(10);

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
    'pgtap-activity-platform@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '99999991-9999-4999-8999-999999999901'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-activity-owner@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '99999992-9999-4999-8999-999999999902'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-activity-beta-admin@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '99999993-9999-4999-8999-999999999903'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-activity-learner@example.test',
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
  role,
  redemption_unlocked_at
)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'Activity Platform Admin', 0, 0, 'admin', now() - interval '2 days'),
  ('99999991-9999-4999-8999-999999999901'::uuid, 'Activity Alpha Owner', 0, 0, 'learner', now() - interval '2 days'),
  ('99999992-9999-4999-8999-999999999902'::uuid, 'Activity Beta Admin', 0, 0, 'learner', now() - interval '2 days'),
  ('99999993-9999-4999-8999-999999999903'::uuid, 'Activity Learner', 0, 0, 'learner', now() - interval '2 days')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      redemption_unlocked_at = excluded.redemption_unlocked_at,
      updated_at = now();

insert into public.organizations (slug, name, status, created_by)
values
  ('activity-alpha', 'Activity Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('activity-beta', 'Activity Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

select id as activity_alpha_org_id
from public.organizations
where slug = 'activity-alpha'
\gset

select id as activity_beta_org_id
from public.organizations
where slug = 'activity-beta'
\gset

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'activity_alpha_org_id'::uuid, '99999991-9999-4999-8999-999999999901'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'activity_alpha_org_id'::uuid, '99999993-9999-4999-8999-999999999903'::uuid, 'learner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'activity_beta_org_id'::uuid, '99999992-9999-4999-8999-999999999902'::uuid, 'organisation_admin', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

select id as activity_alpha_account_id
from public.xp_accounts
where organization_id = :'activity_alpha_org_id'::uuid
  and scope = 'organization'
limit 1
\gset

select set_config('request.jwt.claim.sub', '99999991-9999-4999-8999-999999999901', true);

insert into public.rewards (
  id,
  title,
  description,
  cost_xp,
  status,
  organization_id,
  owner_scope,
  fulfillment_type,
  fulfillment_config,
  xp_account_id
)
values (
  'activity-alpha-reward',
  'Activity Alpha Reward',
  'Reward used by activity history tests.',
  25,
  'draft',
  :'activity_alpha_org_id'::uuid,
  'organization_owned',
  'manual',
  '{"fields":[]}'::jsonb,
  :'activity_alpha_account_id'::uuid
)
on conflict (id) do update
  set cost_xp = excluded.cost_xp,
      organization_id = excluded.organization_id,
      owner_scope = excluded.owner_scope,
      xp_account_id = excluded.xp_account_id;

update public.rewards
set cost_xp = 30,
    status = 'published'
where id = 'activity-alpha-reward';

insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
values (
  '99999991-9999-4999-8999-999999999901'::uuid,
  'organization_invitation_created',
  'organization_invitation',
  gen_random_uuid()::text,
  jsonb_build_object(
    'organizationId', :'activity_alpha_org_id'::uuid,
    'role', 'learner',
    'email', 'secret-person@example.test',
    'tokenHash', 'secret-token-hash',
    'claimData', jsonb_build_object('phone', '+15555550101')
  )
);

insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
values (
  '99999992-9999-4999-8999-999999999902'::uuid,
  'organization_profile_updated',
  'organization',
  :'activity_beta_org_id',
  jsonb_build_object('organizationId', :'activity_beta_org_id'::uuid, 'accentToken', 'blue')
);

reset role;
select set_config('request.jwt.claim.sub', '99999991-9999-4999-8999-999999999901', true);
set local role authenticated;

select public.admin_get_organization_activity(:'activity_alpha_org_id'::uuid, null, null, null, null, null, 100) as alpha_activity
\gset

select extensions.ok(
  jsonb_array_length(:'alpha_activity'::jsonb -> 'events') >= 3,
  'organisation owner can read their organisation activity'
);

select extensions.ok(
  exists (
    select 1
    from jsonb_array_elements(:'alpha_activity'::jsonb -> 'events') event
    where event ->> 'eventType' = 'organization_reward_published'
      and (event ->> 'hasChanges')::boolean
      and event -> 'changes' -> 'before' ->> 'costXp' = '25'
      and event -> 'changes' -> 'after' ->> 'costXp' = '30'
  ),
  'high-risk reward configuration activity retains before and after context'
);

select extensions.ok(
  :'alpha_activity'::text not like '%secret-person@example.test%'
  and :'alpha_activity'::text not like '%secret-token-hash%'
  and :'alpha_activity'::text not like '%+15555550101%',
  'sensitive activity metadata is redacted from the activity RPC'
);

select extensions.throws_ok(
  $$ select public.admin_get_organization_activity(null, null, null, null, null, null, 100) $$,
  '42501',
  'Organisation is required.',
  'organisation owner cannot inspect all organisations without an organisation scope'
);

select extensions.throws_ok(
  format($$ select public.admin_get_organization_activity(%L::uuid, null, null, null, null, null, 100) $$, :'activity_beta_org_id'),
  '42501',
  'Organisation activity access required.',
  'organisation owner cannot inspect another organisation activity'
);

reset role;
set local role service_role;

select extensions.throws_ok(
  $$ update public.audit_events set metadata = '{}'::jsonb where event_type = 'organization_invitation_created' $$,
  '42501',
  'Audit events are immutable.',
  'audit events cannot be edited even by service role table writes'
);

select extensions.throws_ok(
  $$ delete from public.audit_events where event_type = 'organization_invitation_created' $$,
  '42501',
  'Audit events are immutable.',
  'audit events cannot be deleted'
);

reset role;
select set_config('request.jwt.claim.sub', '99999992-9999-4999-8999-999999999902', true);
set local role authenticated;

select extensions.throws_ok(
  format($$ select public.admin_get_organization_activity(%L::uuid, null, null, null, null, null, 100) $$, :'activity_alpha_org_id'),
  '42501',
  'Organisation activity access required.',
  'admin from another organisation cannot inspect alpha activity'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_get_organization_activity(null, null, null, null, null, null, 100) as platform_activity
\gset

select extensions.ok(
  exists (
    select 1
    from jsonb_array_elements(:'platform_activity'::jsonb -> 'events') event
    where event ->> 'organizationId' = :'activity_alpha_org_id'
  )
  and exists (
    select 1
    from jsonb_array_elements(:'platform_activity'::jsonb -> 'events') event
    where event ->> 'organizationId' = :'activity_beta_org_id'
  ),
  'platform admins can inspect activity across organisations'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_get_organization_activity(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer)', 'execute')
  and has_function_privilege('service_role', 'public.admin_get_organization_activity(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer)', 'execute')
  and not has_function_privilege('anon', 'public.admin_get_organization_activity(uuid, uuid, text, text, timestamp with time zone, timestamp with time zone, integer)', 'execute'),
  'activity history RPC execute grants are authenticated-only plus service role'
);

select * from extensions.finish();

rollback;
