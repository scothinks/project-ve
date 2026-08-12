begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(14);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'authenticated', 'authenticated', 'pgtap-xp-balance-admin@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (:'TEST_LEARNER_USER_ID'::uuid, 'authenticated', 'authenticated', 'pgtap-xp-balance-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

set local role service_role;

insert into public.profiles (id, display_name, xp, xp_balance_cached, role)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'Local pgTAP XP Balance Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'Local pgTAP XP Balance Learner', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      role = excluded.role,
      updated_at = now();

delete from public.xp_transactions
where user_id = :'TEST_LEARNER_USER_ID'::uuid;

insert into public.organizations (slug, name, status, created_by)
values ('p15c-xp-balance-org', 'P15C XP Balance Org', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      updated_at = now();

select id as p15c_xp_balance_org_id
from public.organizations
where slug = 'p15c-xp-balance-org'
\gset

select id as p15c_xp_balance_org_account_id
from public.xp_accounts
where organization_id = :'p15c_xp_balance_org_id'::uuid
  and is_default
\gset

select extensions.ok(
  exists (
    select 1 from public.user_xp_balances
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
  ),
  'profiles receive a platform XP balance row during the historical backfill'
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values
  (:'TEST_LEARNER_USER_ID'::uuid, '00000000-0000-4000-8000-00000000e001'::uuid, 40, 'earn', 'adjustment', 'p15-xp-balance-platform', 'p15-xp-balance:platform', '{}'::jsonb),
  (:'TEST_LEARNER_USER_ID'::uuid, :'p15c_xp_balance_org_account_id'::uuid, 25, 'earn', 'adjustment', 'p15-xp-balance-org', 'p15-xp-balance:org', '{}'::jsonb);

select extensions.is(
  (select balance_cached from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid),
  40,
  'platform transaction credits only the platform account balance'
);

select extensions.is(
  (select balance_cached from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = :'p15c_xp_balance_org_account_id'::uuid),
  25,
  'organization transaction credits only the organization account balance'
);

select extensions.is(
  (select xp_balance_cached from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  40,
  'legacy profile cache remains the platform account projection'
);

select extensions.is(
  (
    select balance_cached
    from public.user_xp_balances
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
  ),
  (
    select coalesce(sum(case when direction = 'earn' then amount else -amount end), 0)::integer
    from public.xp_transactions
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
  ),
  'platform balance reconciles with its ledger entries'
);

select extensions.is(
  (
    select balance_cached
    from public.user_xp_balances
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and xp_account_id = :'p15c_xp_balance_org_account_id'::uuid
  ),
  (
    select coalesce(sum(case when direction = 'earn' then amount else -amount end), 0)::integer
    from public.xp_transactions
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and xp_account_id = :'p15c_xp_balance_org_account_id'::uuid
  ),
  'organization balance reconciles with its ledger entries'
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15c_xp_balance_org_account_id'::uuid,
  10,
  'spend',
  'reward_redemption',
  'p15-xp-balance-org-spend',
  '{}'::jsonb
);

select extensions.is(
  (select balance_cached from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = :'p15c_xp_balance_org_account_id'::uuid),
  15,
  'a spend debits only its selected XP account'
);

select extensions.throws_like(
  format(
    $$
      insert into public.xp_transactions (user_id, xp_account_id, amount, direction, source_type, source_id, metadata)
      values (%L::uuid, %L::uuid, 16, 'spend', 'reward_redemption', 'p15-xp-balance-overdraw', '{}'::jsonb)
    $$,
    :'TEST_LEARNER_USER_ID',
    :'p15c_xp_balance_org_account_id'
  ),
  '%Insufficient XP account balance%',
  'the ledger cannot overdraw an account balance'
);

select extensions.is(
  (select balance_cached from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = :'p15c_xp_balance_org_account_id'::uuid),
  15,
  'a rejected spend leaves the account balance unchanged'
);

select extensions.throws_like(
  format(
    $$
      insert into public.xp_transactions (user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata)
      values (%L::uuid, %L::uuid, 25, 'earn', 'adjustment', 'p15-xp-balance-org-duplicate', 'p15-xp-balance:org', '{}'::jsonb)
    $$,
    :'TEST_LEARNER_USER_ID',
    :'p15c_xp_balance_org_account_id'
  ),
  '%xp_transactions_unique_award_scope%',
  'duplicate awards remain account-aware at the ledger boundary'
);

select extensions.is(
  (select balance_cached from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = :'p15c_xp_balance_org_account_id'::uuid),
  15,
  'a duplicate award does not double-credit an account balance'
);

reset role;

select extensions.ok(
  not has_function_privilege('anon', 'private.post_xp_transaction(uuid, uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.post_xp_transaction(uuid, uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute')
  and not has_function_privilege('service_role', 'private.post_xp_transaction(uuid, uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute'),
  'the account-aware XP posting primitive is not directly executable by API roles'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid),
  2,
  'learners can read only their own XP account balances'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select extensions.is(
  (select count(*)::integer from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid),
  0,
  'anonymous users cannot read XP account balances'
);

select * from extensions.finish();

rollback;
