begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(16);

select extensions.ok(
  not has_function_privilege('anon', 'public.increment_profile_xp(uuid, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.increment_profile_xp(uuid, integer)', 'execute'),
  'authenticated users can reach increment_profile_xp denial wrapper while anon cannot'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.apply_native_reward_effect(uuid, uuid, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_native_reward_effect(uuid, uuid, text, jsonb)', 'execute'),
  'client roles cannot execute apply_native_reward_effect'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.increment_profile_xp(uuid, integer)', 'execute')
  and has_function_privilege('service_role', 'public.apply_native_reward_effect(uuid, uuid, text, jsonb)', 'execute'),
  'service_role can execute trusted XP helper RPCs'
);

select extensions.ok(
  not has_function_privilege('anon', 'private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute')
  and not has_function_privilege('service_role', 'private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute')
  and not has_function_privilege('anon', 'private.increment_profile_xp(uuid, integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.increment_profile_xp(uuid, integer)', 'execute')
  and not has_function_privilege('service_role', 'private.increment_profile_xp(uuid, integer)', 'execute'),
  'private XP helpers are not directly executable by API roles'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.increment_profile_xp('00000000-0000-0000-0000-000000000401', 500) $$,
  '42501',
  'authenticated learner cannot choose an XP amount'
);

reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

delete from public.xp_transactions
where user_id = :'TEST_LEARNER_USER_ID'::uuid;

update public.profiles
set xp = 0,
    xp_balance_cached = 0
where id = :'TEST_LEARNER_USER_ID'::uuid;

select extensions.is(
  (select xp_balance_cached from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  0,
  'service_role reset zeroes the learner XP cache before legacy increment assertions'
);

select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

select extensions.throws_ok(
  format($$ select public.increment_profile_xp(%L::uuid, 25) $$, :'TEST_LEARNER_USER_ID'),
  'P0001',
  'XP balance updates must be backed by a same-transaction ledger entry.'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

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
  25,
  'earn',
  'adjustment',
  'test-ledger',
  'test-ledger:increment',
  '{}'::jsonb
);

select set_config('request.jwt.claim.sub', '', true);

select extensions.lives_ok(
  format($$ select public.increment_profile_xp(%L::uuid, 25) $$, :'TEST_LEARNER_USER_ID'),
  'service_role can apply a same-transaction ledger-backed XP increment'
);

select extensions.is(
  (select xp_balance_cached from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  25,
  'ledger-backed legacy increment updates cached XP balance once'
);

select extensions.is(
  (select coalesce(sum(amount), 0)::integer from public.xp_transactions where user_id = :'TEST_LEARNER_USER_ID'::uuid and direction = 'earn'),
  25,
  'legacy increment does not create an extra ledger row'
);

select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

delete from public.xp_transactions
where user_id = :'TEST_LEARNER_USER_ID'::uuid;

update public.profiles
set xp = 0,
    xp_balance_cached = 0
where id = :'TEST_LEARNER_USER_ID'::uuid;

select extensions.is(
  (select xp_balance_cached from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  0,
  'service_role reset zeroes the learner XP cache before service-role fixture assertions'
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
  40,
  'earn',
  'adjustment',
  'test-private-post',
  'test-private-post:once',
  '{"kind":"test"}'::jsonb
)
on conflict (user_id, award_scope)
  where direction = 'earn' and award_scope is not null
  do nothing;

update public.profiles
set xp = 40,
    xp_balance_cached = 40
where id = :'TEST_LEARNER_USER_ID'::uuid;

select extensions.is(
  (select count(*)::integer from public.xp_transactions where user_id = :'TEST_LEARNER_USER_ID'::uuid and award_scope = 'test-private-post:once'),
  1,
  'service_role fixture seeds one scoped XP ledger row'
);

select extensions.is(
  (select xp_balance_cached from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  40,
  'service_role fixture updates cached balance'
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
  40,
  'earn',
  'adjustment',
  'test-private-post',
  'test-private-post:once',
  '{"kind":"test"}'::jsonb
)
on conflict (user_id, award_scope)
  where direction = 'earn' and award_scope is not null
  do nothing;

select extensions.is(
  (select count(*)::integer from public.xp_transactions where user_id = :'TEST_LEARNER_USER_ID'::uuid and award_scope = 'test-private-post:once'),
  1,
  'duplicate scoped service-role fixture does not duplicate ledger rows'
);

select extensions.is(
  (select xp_balance_cached from public.profiles where id = :'TEST_LEARNER_USER_ID'::uuid),
  40,
  'duplicate scoped service-role fixture does not double-credit cached balance'
);

select extensions.is(
  (select coalesce(sum(amount), 0)::integer from public.xp_transactions where user_id = :'TEST_LEARNER_USER_ID'::uuid and award_scope = 'test-private-post:once'),
  40,
  'duplicate scoped service-role fixture leaves one XP amount'
);

select * from finish();

rollback;
