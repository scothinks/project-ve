begin;
\ir ./_test_constants.psql
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;
select extensions.plan(34);

insert into auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'authenticated', 'authenticated', 'p15-xp-controls-admin@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (:'TEST_LEARNER_USER_ID'::uuid, 'authenticated', 'authenticated', 'p15-xp-controls-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('99999999-9999-4999-8999-999999999901'::uuid, 'authenticated', 'authenticated', 'p15-xp-controls-second@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

set local role service_role;

insert into public.profiles (id, display_name, xp, xp_balance_cached, role)
values
  (:'TEST_ADMIN_USER_ID'::uuid, 'P15 XP Controls Admin', 0, 0, 'admin'),
  (:'TEST_LEARNER_USER_ID'::uuid, 'P15 XP Controls Learner', 0, 0, 'learner'),
  ('99999999-9999-4999-8999-999999999901'::uuid, 'P15 XP Controls Second Learner', 0, 0, 'learner')
on conflict (id) do update
  set display_name = excluded.display_name,
      role = excluded.role,
      updated_at = now();

insert into public.organizations (slug, name, status, created_by)
values
  ('p15-xp-controls-alpha', 'P15 XP Controls Alpha', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('p15-xp-controls-beta', 'P15 XP Controls Beta', 'published', :'TEST_ADMIN_USER_ID'::uuid),
  ('p15-xp-controls-exposure', 'P15 XP Controls Exposure', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status,
      updated_at = now();

select id as p15_xp_controls_alpha_id from public.organizations where slug = 'p15-xp-controls-alpha' \gset
select id as p15_xp_controls_beta_id from public.organizations where slug = 'p15-xp-controls-beta' \gset
select id as p15_xp_controls_exposure_id from public.organizations where slug = 'p15-xp-controls-exposure' \gset

insert into public.organization_memberships (organization_id, user_id, role, status, invited_by)
values
  (:'p15_xp_controls_alpha_id'::uuid, :'TEST_ADMIN_USER_ID'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15_xp_controls_beta_id'::uuid, :'TEST_ADMIN_USER_ID'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15_xp_controls_exposure_id'::uuid, :'TEST_ADMIN_USER_ID'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid),
  (:'p15_xp_controls_beta_id'::uuid, '99999999-9999-4999-8999-999999999901'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, user_id, role) do update
  set status = excluded.status,
      updated_at = now();

select id as p15_xp_controls_alpha_account_id
from public.xp_accounts
where organization_id = :'p15_xp_controls_alpha_id'::uuid and is_default
\gset
select id as p15_xp_controls_beta_account_id
from public.xp_accounts
where organization_id = :'p15_xp_controls_beta_id'::uuid and is_default
\gset
select id as p15_xp_controls_exposure_account_id
from public.xp_accounts
where organization_id = :'p15_xp_controls_exposure_id'::uuid and is_default
\gset

insert into public.programmes (organization_id, slug, title, status, created_by)
values (:'p15_xp_controls_alpha_id'::uuid, 'controls-programme', 'Controls Programme', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (organization_id, slug) do update
  set title = excluded.title,
      status = excluded.status,
      updated_at = now();

select id as p15_xp_controls_programme_id
from public.programmes
where organization_id = :'p15_xp_controls_alpha_id'::uuid and slug = 'controls-programme'
\gset

insert into public.enrolments (organization_id, user_id, programme_id, assignment_source, status, xp_account_id)
values (
  :'p15_xp_controls_alpha_id'::uuid,
  '99999999-9999-4999-8999-999999999901'::uuid,
  :'p15_xp_controls_programme_id'::uuid,
  'manual',
  'active',
  :'p15_xp_controls_alpha_account_id'::uuid
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_update_xp_account_controls(
  :'p15_xp_controls_alpha_account_id'::uuid,
  'ngn',
  1.5,
  30,
  50,
  100,
  1000::numeric,
  40,
  80::numeric
);

select public.admin_update_xp_account_controls(
  :'p15_xp_controls_beta_account_id'::uuid,
  'GBP',
  1::numeric,
  30,
  100,
  30,
  null::numeric,
  null::numeric,
  null::numeric
);

select public.admin_update_xp_account_controls(
  :'p15_xp_controls_exposure_account_id'::uuid,
  'NGN',
  2,
  30,
  1000,
  1000,
  100::numeric,
  30::numeric,
  50::numeric
);

select extensions.is(
  (select issuance_cap_per_period from public.xp_accounts where id = :'p15_xp_controls_alpha_account_id'::uuid),
  50,
  'organisation manager can configure the account period issuance cap'
);

select extensions.is(
  (select accounting_currency from public.xp_accounts where id = :'p15_xp_controls_alpha_account_id'::uuid),
  'NGN',
  'organisation manager can configure and normalize the accounting currency'
);

select extensions.is(
  public.admin_get_xp_account_overview(:'p15_xp_controls_alpha_id'::uuid) -> 'controls' ->> 'accountingCurrency',
  'NGN',
  'overview returns the configured accounting currency'
);

select extensions.is(
  (select funded_reward_budget from public.xp_accounts where id = :'p15_xp_controls_alpha_account_id'::uuid),
  1000::numeric,
  'accounting currency updates preserve other exposure controls'
);

select extensions.is(
  (select issuance_cap_per_user from public.xp_accounts where id = :'p15_xp_controls_beta_account_id'::uuid),
  30,
  'organisation manager can configure the per-user issuance cap'
);

select extensions.is(
  public.admin_get_xp_account_overview(:'p15_xp_controls_beta_id'::uuid) -> 'controls' ->> 'accountingCurrency',
  'GBP',
  'different organisations may use different accounting currencies'
);

select extensions.is(
  (select count(*)::integer from public.xp_accounts where accounting_currency = 'XP'),
  0,
  'legacy XP accounting currency sentinel is not retained'
);

select extensions.is(
  (select accounting_currency from public.xp_accounts where scope = 'platform' and is_default),
  null::text,
  'legacy Project Ve XP account accounting currency is unconfigured'
);

select extensions.throws_like(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, 'USDT', 1, 30, 100, 100, null, null, null) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Accounting currency must be a three-letter ISO currency code%',
  'four-letter currency-like values are rejected'
);

select extensions.throws_like(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, '$', 1, 30, 100, 100, null, null, null) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Accounting currency must be a three-letter ISO currency code%',
  'currency symbols are rejected'
);

select extensions.throws_like(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, 'NAIRA', 1, 30, 100, 100, null, null, null) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Accounting currency must be a three-letter ISO currency code%',
  'currency names are rejected'
);

select extensions.throws_like(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, 'XP', 1, 30, 100, 100, null, null, null) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Accounting currency must be a three-letter ISO currency code%',
  'learner points labels are rejected as accounting currency'
);

select extensions.throws_like(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, 'NGN', 1, 30, 100, 100, null, 80, 40) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Exposure hard threshold cannot be below the warning threshold%',
  'accounting currency changes do not weaken exposure threshold validation'
);

reset role;
set local role service_role;

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15_xp_controls_alpha_account_id'::uuid,
  40::numeric,
  'earn',
  'mission',
  'p15-xp-controls-alpha-1',
  'p15-xp-controls-alpha-1',
  jsonb_build_object('programmeId', :'p15_xp_controls_programme_id'::uuid)
);

select extensions.is(
  (select programme_id from public.xp_transactions where award_scope = 'p15-xp-controls-alpha-1'),
  :'p15_xp_controls_programme_id'::uuid,
  'organisation ledger rows retain trusted programme attribution'
);

select extensions.throws_like(
  format($$
    insert into public.xp_transactions (
      user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
    ) values (
      %L::uuid,
      %L::uuid,
      11,
      'earn',
      'mission',
      'p15-xp-controls-alpha-2',
      'p15-xp-controls-alpha-2',
      '{}'::jsonb
    )
  $$, :'TEST_LEARNER_USER_ID', :'p15_xp_controls_alpha_account_id'),
  '%period issuance cap reached%',
  'organisation issuance cannot bypass the period cap'
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15_xp_controls_beta_account_id'::uuid,
  20,
  'earn',
  'adjustment',
  'p15-xp-controls-beta-1',
  'p15-xp-controls-beta-1',
  '{}'::jsonb
);

select extensions.throws_like(
  format($$
    insert into public.xp_transactions (
      user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
    ) values (
      %L::uuid,
      %L::uuid,
      11,
      'earn',
      'adjustment',
      'p15-xp-controls-beta-2',
      'p15-xp-controls-beta-2',
      '{}'::jsonb
    )
  $$, :'TEST_LEARNER_USER_ID', :'p15_xp_controls_beta_account_id'),
  '%learner issuance cap reached%',
  'organisation issuance cannot bypass the per-user cap'
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15_xp_controls_beta_account_id'::uuid,
  10,
  'earn',
  'reward_redemption',
  'p15-xp-controls-beta-refund',
  'reward_refund:p15-xp-controls-beta-refund',
  '{}'::jsonb
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15_xp_controls_beta_account_id'::uuid,
  10,
  'earn',
  'adjustment',
  'p15-xp-controls-beta-3',
  'p15-xp-controls-beta-3',
  '{}'::jsonb
);

select extensions.is(
  (public.admin_get_xp_account_overview(:'p15_xp_controls_beta_id'::uuid) ->> 'issuance')::integer,
  30,
  'reward refunds do not inflate issuance reporting or consume future issuance capacity'
);

select extensions.is(
  (public.admin_get_xp_account_overview(:'p15_xp_controls_beta_id'::uuid) ->> 'circulation')::integer,
  40,
  'reward refunds still restore outstanding circulation'
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15_xp_controls_alpha_account_id'::uuid,
  1,
  'earn',
  'mission',
  'p15-xp-controls-alpha-duplicate',
  'p15-xp-controls-alpha-1',
  '{}'::jsonb
)
on conflict (user_id, xp_account_id, award_scope)
where direction = 'earn' and award_scope is not null
do nothing;

select extensions.is(
  (select sum(amount)::integer from public.xp_transactions where xp_account_id = :'p15_xp_controls_alpha_account_id'::uuid and direction = 'earn'),
  40,
  'idempotent duplicate awards do not consume issuance capacity'
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  :'p15_xp_controls_exposure_account_id'::uuid,
  20,
  'earn',
  'adjustment',
  'p15-xp-controls-exposure-1',
  'p15-xp-controls-exposure-1',
  '{}'::jsonb
);

select extensions.is(
  (public.admin_get_xp_account_overview(:'p15_xp_controls_exposure_id'::uuid) -> 'exposure' ->> 'estimatedUnredeemedLiability')::numeric,
  40::numeric,
  'overview reports estimated unredeemed liability from outstanding balances'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.lives_ok(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, 'GBP', 2, 30, 1000, 1000, 100, 30, 50) $$,
    :'p15_xp_controls_exposure_account_id'
  ),
  'manager can change accounting currency without converting balances'
);

select extensions.is(
  (public.admin_get_xp_account_overview(:'p15_xp_controls_exposure_id'::uuid) -> 'exposure' ->> 'estimatedUnredeemedLiability')::numeric,
  40::numeric,
  'changing accounting currency does not change estimated liability math'
);

select extensions.ok(
  (public.admin_get_xp_account_overview(:'p15_xp_controls_exposure_id'::uuid) -> 'exposure' ->> 'warning')::boolean,
  'changing accounting currency does not change exposure warning state'
);

select extensions.ok(
  (public.admin_get_xp_account_overview(:'p15_xp_controls_alpha_id'::uuid) -> 'exposure' ->> 'warning')::boolean,
  'overview exposes the configured exposure warning state'
);

select extensions.ok(
  exists (
    select 1
    from jsonb_array_elements(public.admin_get_xp_account_overview(:'p15_xp_controls_alpha_id'::uuid) -> 'programmeIssuance') item
    where item ->> 'programmeId' = :'p15_xp_controls_programme_id'
      and (item ->> 'issued')::integer = 40
  ),
  'overview reports issuance by programme'
);

select extensions.ok(
  exists (
    select 1
    from jsonb_array_elements(public.admin_get_xp_account_overview(:'p15_xp_controls_alpha_id'::uuid) -> 'userIssuance') item
    where item ->> 'userId' = :'TEST_LEARNER_USER_ID'
      and (item ->> 'issued')::integer = 40
  ),
  'overview reports issuance by learner'
);

select extensions.lives_ok(
  format(
    $$ select public.admin_adjust_xp_account(%L::uuid, %L::uuid, 5, 'earn'::public.xp_direction, 'programme learner adjustment') $$,
    :'p15_xp_controls_alpha_account_id',
    '99999999-9999-4999-8999-999999999901'
  ),
  'organisation manager can adjust a programme-only learner without membership'
);

select extensions.is(
  (
    select count(*)::integer
    from public.organization_memberships
    where organization_id = :'p15_xp_controls_alpha_id'::uuid
      and user_id = '99999999-9999-4999-8999-999999999901'::uuid
  ),
  0,
  'programme-only adjustment does not create an organization membership'
);

reset role;
set local role service_role;

select extensions.throws_like(
  format($$
    insert into public.xp_transactions (
      user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
    ) values (
      %L::uuid,
      %L::uuid,
      6,
      'earn',
      'adjustment',
      'p15-xp-controls-exposure-2',
      'p15-xp-controls-exposure-2',
      '{}'::jsonb
    )
  $$, :'TEST_LEARNER_USER_ID', :'p15_xp_controls_exposure_account_id'),
  '%exposure hard threshold reached%',
  'organisation issuance stops at the configured hard exposure threshold'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_like(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, 'NGN', 1, 30, 100, 100, null, null, null) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Organisation XP account access is required%',
  'learners cannot change issuance or exposure controls'
);

reset role;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999901', true);
set local role authenticated;

select extensions.throws_like(
  format(
    $$ select public.admin_update_xp_account_controls(%L::uuid, 'NGN', 1, 30, 100, 100, null, null, null) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Organisation XP account access is required%',
  'organisation managers cannot change another organisation accounting currency'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_like(
  format($$ select public.admin_get_xp_account_overview(%L::uuid) $$, :'p15_xp_controls_alpha_id'),
  '%Organisation XP account access is required%',
  'learners cannot read organisation issuance reporting'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_update_xp_account_controls(uuid, text, numeric, integer, integer, integer, numeric, numeric, numeric)', 'execute')
  and not has_function_privilege('anon', 'public.admin_update_xp_account_controls(uuid, text, numeric, integer, integer, integer, numeric, numeric, numeric)', 'execute'),
  'issuance controls RPC is manager-facing and not anonymous'
);

select extensions.is(
  to_regprocedure('public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric)'),
  null::regprocedure,
  'previous issuance controls RPC overload is retired'
);

select * from extensions.finish();
rollback;
