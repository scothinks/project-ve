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
    'pgtap-xp-accounts-admin@example.test',
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
    'pgtap-xp-accounts-owner@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '99999999-9999-4999-8999-999999999901'::uuid,
    'authenticated',
    'authenticated',
    'pgtap-xp-accounts-outsider@example.test',
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
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP XP Accounts Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'Local pgTAP XP Accounts Owner', 0, 0, 'learner'),
  ('99999999-9999-4999-8999-999999999901'::uuid, 'Local pgTAP XP Accounts Outsider', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      xp = excluded.xp,
      xp_balance_cached = excluded.xp_balance_cached,
      role = excluded.role,
      updated_at = now();

select extensions.ok(
  exists (
    select 1
    from public.xp_accounts
    where id = '00000000-0000-4000-8000-00000000e001'::uuid
      and scope = 'platform'
      and organization_id is null
      and name = 'Project Ve XP'
      and short_label = 'XP'
      and status = 'active'
      and is_default
  ),
  'Project Ve XP platform account is seeded as the active default'
);

insert into public.xp_transactions (
  user_id,
  amount,
  direction,
  source_type,
  source_id,
  award_scope,
  metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  15,
  'earn',
  'adjustment',
  'p15-xp-default',
  'p15-xp-default:platform',
  '{}'::jsonb
)
on conflict (user_id, xp_account_id, award_scope)
  where direction = 'earn' and award_scope is not null
  do update set amount = excluded.amount
returning id as platform_xp_transaction_id
\gset

select extensions.is(
  (
    select xp_account_id
    from public.xp_transactions
    where id = :'platform_xp_transaction_id'::uuid
  ),
  '00000000-0000-4000-8000-00000000e001'::uuid,
  'new legacy XP transactions default to Project Ve XP'
);

select extensions.is(
  (
    select coalesce(sum(
      case when direction = 'earn' then amount else -amount end
    ), 0)::integer
    from public.xp_transactions
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
  ),
  15,
  'platform account balance is not duplicated by the account backfill/default'
);

insert into public.organizations (slug, name, status, created_by)
values
  ('p15c-xp-alpha', 'P15C XP Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('p15c-xp-beta', 'P15C XP Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status,
      updated_at = now();

select id as p15c_alpha_org_id
from public.organizations
where slug = 'p15c-xp-alpha'
\gset

select id as p15c_beta_org_id
from public.organizations
where slug = 'p15c-xp-beta'
\gset

insert into public.organization_plan_assignments (
  organization_id,
  plan_key,
  billing_status,
  assigned_by
)
values
  (:'p15c_alpha_org_id'::uuid, 'starter', 'free', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15c_beta_org_id'::uuid, 'starter', 'free', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id) where ended_at is null do update
  set plan_key = excluded.plan_key,
      billing_status = excluded.billing_status,
      assigned_by = excluded.assigned_by,
      updated_at = now();

insert into public.organization_memberships (
  organization_id,
  user_id,
  role,
  status,
  invited_by
)
values
  (:'p15c_alpha_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15c_beta_org_id'::uuid, '99999999-9999-4999-8999-999999999901'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      invited_by = excluded.invited_by;

insert into public.programmes (
  id,
  organization_id,
  slug,
  title,
  objective,
  intended_audience,
  status,
  completion_rules,
  created_by
)
values (
  '99999999-9999-4999-8999-999999999902'::uuid,
  :'p15c_alpha_org_id'::uuid,
  'p15c-xp-alpha-programme',
  'P15C XP Alpha Programme',
  'Verify programme XP account access.',
  'Programme learners',
  'published',
  '{}'::jsonb,
  :'TEST_ADMIN_USER_ID'::uuid
)
on conflict (id) do update
  set status = excluded.status,
      updated_at = now();

insert into public.enrolments (
  organization_id,
  user_id,
  programme_id,
  assignment_source,
  status,
  metadata
)
values (
  :'p15c_alpha_org_id'::uuid,
  '99999999-9999-4999-8999-999999999901'::uuid,
  '99999999-9999-4999-8999-999999999902'::uuid,
  'programme',
  'active',
  '{}'::jsonb
)
on conflict (organization_id, user_id, programme_id) where programme_id is not null
do update set status = 'active', updated_at = now();

select id as p15c_alpha_xp_account_id
from public.xp_accounts
where organization_id = :'p15c_alpha_org_id'::uuid
  and scope = 'organization'
  and status = 'active'
  and is_default
\gset

select id as p15c_beta_xp_account_id
from public.xp_accounts
where organization_id = :'p15c_beta_org_id'::uuid
  and scope = 'organization'
  and status = 'active'
  and is_default
\gset

select extensions.ok(
  :'p15c_alpha_xp_account_id'::uuid is not null
  and :'p15c_beta_xp_account_id'::uuid is not null,
  'Starter organizations automatically receive one active default organization XP account'
);

select extensions.is(
  (
    select count(*)::integer
    from public.xp_accounts
    where organization_id = :'p15c_alpha_org_id'::uuid
      and scope = 'organization'
      and status = 'active'
      and is_default
  ),
  1,
  'organization default XP account uniqueness is enforced for active defaults'
);

select extensions.throws_like(
  format(
    $$
      insert into public.xp_accounts (
        scope,
        organization_id,
        name,
        plural_name,
        short_label,
        status,
        is_default
      )
      values ('organization', %L::uuid, 'Duplicate Points', 'Duplicate Points', 'DUP', 'active', true)
    $$,
    :'p15c_alpha_org_id'
  ),
  '%duplicate key value violates unique constraint "xp_accounts_one_default_organization_idx"%',
  'cannot create a second active default account for one organization'
);

select extensions.throws_like(
  $$
    insert into public.xp_accounts (
      scope,
      organization_id,
      name,
      plural_name,
      short_label,
      status,
      is_default
    )
    values ('platform', gen_random_uuid(), 'Bad Platform XP', 'Bad Platform XP', 'BAD', 'active', false)
  $$,
  '%violates check constraint "xp_accounts_scope_organization_consistency"%',
  'platform XP accounts cannot be owned by an organization'
);

select extensions.throws_like(
  $$
    insert into public.xp_accounts (
      scope,
      organization_id,
      name,
      plural_name,
      short_label,
      status,
      is_default
    )
    values ('organization', null, 'Detached Points', 'Detached Points', 'DET', 'active', false)
  $$,
  '%violates check constraint "xp_accounts_scope_organization_consistency"%',
  'organization XP accounts require organization ownership'
);

insert into public.xp_transactions (
  user_id,
  xp_account_id,
  amount,
  direction,
  source_type,
  source_id,
  award_scope,
  metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15c_alpha_xp_account_id'::uuid,
  15,
  'earn',
  'adjustment',
  'p15-xp-alpha',
  'p15-xp-duplicate-scope',
  '{}'::jsonb
);

insert into public.xp_transactions (
  user_id,
  xp_account_id,
  amount,
  direction,
  source_type,
  source_id,
  award_scope,
  metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15c_beta_xp_account_id'::uuid,
  15,
  'earn',
  'adjustment',
  'p15-xp-beta',
  'p15-xp-duplicate-scope',
  '{}'::jsonb
);

select extensions.is(
  (
    select count(*)::integer
    from public.xp_transactions
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and award_scope = 'p15-xp-duplicate-scope'
  ),
  2,
  'duplicate award identity is scoped by XP account'
);

select extensions.throws_like(
  format(
    $$
      insert into public.xp_transactions (
        user_id,
        xp_account_id,
        amount,
        direction,
        source_type,
        source_id,
        award_scope,
        metadata
      )
      values (
        %L::uuid,
        %L::uuid,
        15,
        'earn',
        'adjustment',
        'p15-xp-alpha-duplicate',
        'p15-xp-duplicate-scope',
        '{}'::jsonb
      )
    $$,
    :'TEST_LEARNER_USER_ID',
    :'p15c_alpha_xp_account_id'
  ),
  '%duplicate key value violates unique constraint "xp_transactions_unique_award_scope"%',
  'duplicate award identity still prevents duplicate earns inside one XP account'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.xp_accounts
    where organization_id = :'p15c_alpha_org_id'::uuid
  ),
  1,
  'organization owner can read their organization XP account'
);

reset role;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999901', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.xp_accounts
    where organization_id = :'p15c_alpha_org_id'::uuid
  ),
  1,
  'programme-enrolled learners can read their organization XP account'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.xp_accounts
    where organization_id = :'p15c_beta_org_id'::uuid
  ),
  0,
  'organization owner cannot read another organization XP account'
);

select extensions.is(
  (
    select count(*)::integer
    from public.xp_accounts
    where scope = 'platform'
      and is_default
  ),
  1,
  'authenticated users can read the default platform XP account'
);

select extensions.throws_like(
  $$
    insert into public.xp_accounts (
      scope,
      organization_id,
      name,
      plural_name,
      short_label,
      status,
      is_default
    )
    values ('organization', null, 'Client Points', 'Client Points', 'CLT', 'active', false)
  $$,
  '%new row violates row-level security policy for table "xp_accounts"%',
  'authenticated clients cannot insert XP accounts directly'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.is(
  (
    select count(*)::integer
    from public.xp_accounts
    where scope = 'platform'
      and is_default
  ),
  0,
  'anonymous users cannot read XP accounts'
);

reset role;

select extensions.ok(
  not has_function_privilege('anon', 'private.ensure_default_organization_xp_account()', 'execute')
  and not has_function_privilege('authenticated', 'private.ensure_default_organization_xp_account()', 'execute')
  and not has_function_privilege('service_role', 'private.ensure_default_organization_xp_account()', 'execute'),
  'default organization XP account trigger helper is not directly executable by API roles'
);

select * from extensions.finish();

rollback;
