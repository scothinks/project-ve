begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;

select extensions.plan(7);

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (:'TEST_LEARNER_USER_ID'::uuid, 'authenticated', 'authenticated', 'pgtap-xp-rewards-learner@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now() - interval '2 days', now()),
  ('99999999-9999-4999-8999-999999999904'::uuid, 'authenticated', 'authenticated', 'pgtap-xp-rewards-outsider@example.test', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now() - interval '2 days', now())
on conflict (id) do update set email = excluded.email, updated_at = now();

set local role service_role;
insert into public.profiles (id, display_name, role)
values
  (:'TEST_LEARNER_USER_ID'::uuid, 'P15 XP Rewards Learner', 'learner'),
  ('99999999-9999-4999-8999-999999999904'::uuid, 'P15 XP Rewards Outsider', 'learner')
on conflict (id) do update set display_name = excluded.display_name;

update public.profiles
set redemption_unlocked_at = now() - interval '1 minute'
where id in (:'TEST_LEARNER_USER_ID'::uuid, '99999999-9999-4999-8999-999999999904'::uuid);

insert into public.organizations (slug, name, status, created_by)
values ('p15c-xp-rewards-org', 'P15C XP Rewards Org', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update set name = excluded.name;
select id as p15c_xp_rewards_org_id from public.organizations where slug = 'p15c-xp-rewards-org' \gset
select id as p15c_xp_rewards_account_id from public.xp_accounts where organization_id = :'p15c_xp_rewards_org_id'::uuid and is_default \gset

insert into public.programmes (organization_id, slug, title, objective, intended_audience, status)
values (:'p15c_xp_rewards_org_id'::uuid, 'p15c-xp-rewards-programme', 'P15C XP Rewards Programme', '', '', 'published')
returning id as p15c_xp_rewards_programme_id \gset

insert into public.enrolments (organization_id, user_id, programme_id, assignment_source, status, xp_account_id)
values (:'p15c_xp_rewards_org_id'::uuid, :'TEST_LEARNER_USER_ID'::uuid, :'p15c_xp_rewards_programme_id'::uuid, 'manual', 'active', :'p15c_xp_rewards_account_id'::uuid);

insert into public.rewards (id, title, description, cost_xp, status, is_enabled, distribution_mode, fulfillment_type, visibility_mode, total_available, total_uploaded, per_user_limit, limit_period, owner_scope, organization_id, xp_account_id)
values ('reward-p15c-xp-org', 'P15C XP Organisation Reward', 'Account-aware redemption fixture.', 10, 'published', true, 'direct', 'manual', 'system_only', 2, 2, 2, 'lifetime', 'organization_owned', :'p15c_xp_rewards_org_id'::uuid, :'p15c_xp_rewards_account_id'::uuid);

insert into public.reward_quantity_allocations (reward_id, quantity_total, quantity_available, available_from, reason)
values ('reward-p15c-xp-org', 2, 2, now() - interval '1 minute', 'P15 XP reward test');

insert into public.xp_transactions (user_id, xp_account_id, amount, direction, source_type, source_id, metadata)
values (:'TEST_LEARNER_USER_ID'::uuid, :'p15c_xp_rewards_account_id'::uuid, 20, 'earn', 'adjustment', 'p15-xp-rewards-opening', '{}'::jsonb);

select extensions.is((select xp_account_id from public.rewards where id = 'reward-p15c-xp-org'), :'p15c_xp_rewards_account_id'::uuid, 'organisation reward is configured for its organisation account');

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;
select public.redeem_reward('reward-p15c-xp-org') as p15c_xp_rewards_redemption \gset

select extensions.is(:'p15c_xp_rewards_redemption'::jsonb ->> 'xpAccountId', :'p15c_xp_rewards_account_id'::text, 'redemption returns the configured organisation account');
select :'p15c_xp_rewards_redemption'::jsonb ->> 'id' as p15c_xp_rewards_redemption_id \gset

select extensions.is((select xp_account_id from public.reward_redemptions where id = :'p15c_xp_rewards_redemption_id'::uuid), :'p15c_xp_rewards_account_id'::uuid, 'redemption snapshots the charged account');
select extensions.is((select balance_cached from public.user_xp_balances where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = :'p15c_xp_rewards_account_id'::uuid), 10, 'organisation redemption debits only its account');

reset role;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999904', true);
set local role authenticated;
select extensions.throws_ok($$ select public.redeem_reward('reward-p15c-xp-org') $$, 'P0001', 'This reward is not available right now.', 'outsider cannot redeem an organisation reward');

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;
select public.refund_reward_redemption(:'p15c_xp_rewards_redemption_id'::uuid, 'test refund') as p15c_xp_rewards_refund \gset

select extensions.is((select xp_account_id from public.xp_transactions where id = (:'p15c_xp_rewards_refund'::jsonb ->> 'refundXpTransactionId')::uuid), :'p15c_xp_rewards_account_id'::uuid, 'refund returns value to the original organisation account');
select extensions.is((select coalesce(sum(case when direction = 'earn' then amount else -amount end), 0)::integer from public.xp_transactions where user_id = :'TEST_LEARNER_USER_ID'::uuid and xp_account_id = :'p15c_xp_rewards_account_id'::uuid), 20, 'refund restores the original account ledger balance');

select * from extensions.finish();
rollback;
