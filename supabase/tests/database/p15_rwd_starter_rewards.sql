begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(8);

set local role service_role;

update public.profiles
set display_name = 'P15 RWD Starter Learner',
    role = 'learner',
    redemption_unlocked_at = now() - interval '1 day'
where id = :'TEST_LEARNER_USER_ID'::uuid;

insert into public.organizations (slug, name, status, created_by)
values ('p15-rwd-starter-org', 'P15 RWD Starter Org', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update set name = excluded.name;

select id as p15_rwd_starter_org_id
from public.organizations
where slug = 'p15-rwd-starter-org'
\gset

select id as p15_rwd_starter_account_id
from public.xp_accounts
where organization_id = :'p15_rwd_starter_org_id'::uuid and is_default
\gset

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;
select public.admin_assign_organization_plan(
  :'p15_rwd_starter_org_id'::uuid,
  'starter',
  'free',
  '{"max_open_reward_claims":1,"max_fulfilled_reward_claims_per_month":1}'::jsonb,
  'P15 RWD quota fixture'
);

reset role;
set local role service_role;

insert into public.rewards (
  id, title, description, cost_xp, status, is_enabled, distribution_mode,
  fulfillment_type, visibility_mode, total_available, total_uploaded,
  per_user_limit, limit_period, owner_scope, organization_id, xp_account_id
)
values (
  'reward-p15-rwd-starter-manual', 'Starter Manual Reward', 'Starter reward fixture.',
  5, 'published', true, 'direct', 'manual', 'system_only', 0, 0,
  1, 'lifetime', 'organization_owned', :'p15_rwd_starter_org_id'::uuid,
  :'p15_rwd_starter_account_id'::uuid
);

select extensions.ok(
  exists (
    select 1 from public.rewards
    where id = 'reward-p15-rwd-starter-manual' and fulfillment_type = 'manual'
  ),
  'Starter organisations can publish one manual reward'
);

select extensions.throws_like(
  format($$
    insert into public.rewards (
      id, title, cost_xp, status, is_enabled, distribution_mode,
      fulfillment_type, visibility_mode, owner_scope, organization_id, xp_account_id
    ) values (
      'reward-p15-rwd-starter-second', 'Starter Second Reward', 5, 'published', true,
      'direct', 'manual', 'system_only', 'organization_owned',
      %L::uuid, %L::uuid
    )
  $$, :'p15_rwd_starter_org_id', :'p15_rwd_starter_account_id'),
  '%Starter organisations may have one active reward%',
  'Starter organisations are limited to one active reward'
);

select extensions.throws_like(
  $$
    update public.rewards set fulfillment_type = 'external_link'
    where id = 'reward-p15-rwd-starter-manual'
  $$,
  '%Starter organisations support manual reward fulfilment only%',
  'Starter organisations cannot use external fulfilment providers'
);

select extensions.throws_like(
  $$
    insert into public.reward_inventory_items (reward_id, item_type, payload)
    values ('reward-p15-rwd-starter-manual', 'voucher_code', '{"code":"starter-disabled"}'::jsonb)
  $$,
  '%Starter organisations cannot use voucher or QR inventory%',
  'Starter organisations cannot upload voucher or QR inventory'
);

insert into public.reward_redemptions (
  user_id, reward_id, xp_account_id, fulfillment_type, claim_state
)
values (
  :'TEST_LEARNER_USER_ID'::uuid, 'reward-p15-rwd-starter-manual',
  :'p15_rwd_starter_account_id'::uuid, 'manual', 'purchased'
);

select extensions.throws_like(
  format($$
    insert into public.reward_redemptions (
      user_id, reward_id, xp_account_id, fulfillment_type, claim_state
    ) values (
      %L::uuid, 'reward-p15-rwd-starter-manual',
      %L::uuid, 'manual', 'purchased'
    )
  $$, :'TEST_LEARNER_USER_ID', :'p15_rwd_starter_account_id'),
  '%Starter organisation open reward claim limit reached%',
  'Starter open claim cap is enforced at the database boundary'
);

update public.reward_redemptions
set claim_state = 'cancelled'
where reward_id = 'reward-p15-rwd-starter-manual'
  and user_id = :'TEST_LEARNER_USER_ID'::uuid;

insert into public.reward_redemptions (
  user_id, reward_id, xp_account_id, fulfillment_type, claim_state
)
values (
  :'TEST_LEARNER_USER_ID'::uuid, 'reward-p15-rwd-starter-manual',
  :'p15_rwd_starter_account_id'::uuid, 'manual', 'purchased'
);

select extensions.ok(
  (select count(*) from public.reward_redemptions where reward_id = 'reward-p15-rwd-starter-manual') = 2,
  'cancelled claims do not consume the Starter open claim cap'
);

update public.reward_redemptions
set claim_state = 'fulfilled', fulfilled_at = now()
where reward_id = 'reward-p15-rwd-starter-manual' and claim_state = 'purchased';

insert into public.reward_redemptions (
  user_id, reward_id, xp_account_id, fulfillment_type, claim_state
)
values (
  :'TEST_LEARNER_USER_ID'::uuid, 'reward-p15-rwd-starter-manual',
  :'p15_rwd_starter_account_id'::uuid, 'manual', 'purchased'
);

select extensions.throws_like(
  $$
    update public.reward_redemptions
    set claim_state = 'fulfilled', fulfilled_at = now()
    where reward_id = 'reward-p15-rwd-starter-manual' and claim_state = 'purchased'
  $$,
  '%Starter organisation monthly fulfilled reward limit reached%',
  'Starter monthly fulfilled claim cap is enforced'
);

insert into public.xp_transactions (
  user_id, xp_account_id, amount, direction, source_type, source_id, award_scope, metadata
)
values (
  :'TEST_LEARNER_USER_ID'::uuid,
  '00000000-0000-4000-8000-00000000e001'::uuid,
  10,
  'earn',
  'adjustment',
  'p15-rwd-native-opening',
  'p15-rwd-native-opening',
  '{}'::jsonb
);

insert into public.rewards (
  id, title, description, cost_xp, status, is_enabled, distribution_mode,
  fulfillment_type, fulfillment_config, visibility_mode, total_available,
  total_uploaded, per_user_limit, limit_period, owner_scope
)
values (
  'reward-p15-rwd-native-platform', 'Native XP Bonus', 'Native reward fixture.',
  5, 'published', true, 'direct', 'native',
  '{"effect":"xp_bonus","amount":2}'::jsonb, 'system_only', 1, 1,
  1, 'lifetime', 'platform_owned'
);

insert into public.reward_quantity_allocations (reward_id, quantity_total, quantity_available, reason)
values ('reward-p15-rwd-native-platform', 1, 1, 'P15 RWD native reward fixture');

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.redeem_reward('reward-p15-rwd-native-platform') as p15_rwd_native_redemption
\gset

select extensions.ok(
  exists (
    select 1
    from public.xp_transactions
    where source_type = 'reward_redemption_bonus'
      and source_id = (:'p15_rwd_native_redemption'::jsonb ->> 'id')
      and xp_account_id = '00000000-0000-4000-8000-00000000e001'::uuid
  ),
  'native reward bonuses are recorded in the configured XP account'
);

select * from extensions.finish();
rollback;
