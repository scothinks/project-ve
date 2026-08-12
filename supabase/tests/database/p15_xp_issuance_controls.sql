begin;
\ir ./_test_constants.psql
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;
select extensions.plan(14);

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
  (:'p15_xp_controls_exposure_id'::uuid, :'TEST_ADMIN_USER_ID'::uuid, 'organisation_owner', 'active', :'TEST_ADMIN_USER_ID'::uuid)
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

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select public.admin_update_xp_account_controls(
  :'p15_xp_controls_alpha_account_id'::uuid,
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
  (select issuance_cap_per_user from public.xp_accounts where id = :'p15_xp_controls_beta_account_id'::uuid),
  30,
  'organisation manager can configure the per-user issuance cap'
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
    $$ select public.admin_update_xp_account_controls(%L::uuid, 1, 30, 100, 100, null, null, null) $$,
    :'p15_xp_controls_alpha_account_id'
  ),
  '%Organisation XP account access is required%',
  'learners cannot change issuance or exposure controls'
);

select extensions.throws_like(
  format($$ select public.admin_get_xp_account_overview(%L::uuid) $$, :'p15_xp_controls_alpha_id'),
  '%Organisation XP account access is required%',
  'learners cannot read organisation issuance reporting'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric)', 'execute')
  and not has_function_privilege('anon', 'public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric)', 'execute'),
  'issuance controls RPC is manager-facing and not anonymous'
);

select * from extensions.finish();
rollback;
