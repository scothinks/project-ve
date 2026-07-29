begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(32);

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
  not has_function_privilege('anon', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute')
  and has_function_privilege('authenticated', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute'),
  'authenticated users can reach queue_user_notification denial wrapper while anon cannot'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_push_deliveries_for_notification(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.queue_push_deliveries_for_notification(uuid)', 'execute'),
  'client roles cannot execute queue_push_deliveries_for_notification'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.generate_continue_learning_reminders()', 'execute')
  and has_function_privilege('authenticated', 'public.generate_continue_learning_reminders()', 'execute'),
  'authenticated users can reach reminder generation denial wrapper while anon cannot'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.refresh_reward_item_inventory_counts(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.refresh_reward_item_inventory_counts(text)', 'execute'),
  'client roles cannot execute refresh_reward_item_inventory_counts'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.increment_profile_xp(uuid, integer)', 'execute'),
  'service_role can execute increment_profile_xp for trusted maintenance'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.apply_native_reward_effect(uuid, uuid, text, jsonb)', 'execute'),
  'service_role can execute apply_native_reward_effect for trusted maintenance'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute'),
  'service_role can execute queue_user_notification for trusted maintenance'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.queue_push_deliveries_for_notification(uuid)', 'execute'),
  'service_role can execute queue_push_deliveries_for_notification for trusted maintenance'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.generate_continue_learning_reminders()', 'execute'),
  'service_role can execute generate_continue_learning_reminders'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.refresh_reward_item_inventory_counts(text)', 'execute'),
  'service_role can execute refresh_reward_item_inventory_counts for trusted maintenance'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_reset_ai_course_tree(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_reset_ai_course_tree(text, text)', 'execute'),
  'only authenticated users can reach admin_reset_ai_course_tree before in-function admin checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_reset_ai_course_media(text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_reset_ai_course_media(text, text, text)', 'execute'),
  'only authenticated users can reach admin_reset_ai_course_media before in-function admin checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.find_existing_reward_inventory_values(text, text, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.find_existing_reward_inventory_values(text, text, jsonb)', 'execute'),
  'only authenticated users can reach find_existing_reward_inventory_values before in-function admin checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_reward_assignment_counts(text[])', 'execute')
  and not has_function_privilege('anon', 'public.admin_reward_assignment_counts(text[])', 'execute'),
  'only authenticated users can reach admin_reward_assignment_counts before in-function admin checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.admin_perk_prize_assignment_counts(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.admin_perk_prize_assignment_counts(uuid[])', 'execute'),
  'only authenticated users can reach admin_perk_prize_assignment_counts before in-function admin checks'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text)', 'execute')
  and not has_function_privilege('anon', 'public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text)', 'execute'),
  'only authenticated users can reach queue_broadcast_notification before in-function admin checks'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.admin_reset_ai_course_tree('missing-course', 'draft') $$,
  'P0001',
  'Admin access required.',
  'authenticated non-admin cannot execute admin_reset_ai_course_tree'
);

select extensions.throws_ok(
  $$ select public.admin_reset_ai_course_media('missing-course', null, 'draft') $$,
  'P0001',
  'Admin access required.',
  'authenticated non-admin cannot execute admin_reset_ai_course_media'
);

select extensions.throws_ok(
  $$ select * from public.find_existing_reward_inventory_values('reward', 'voucher_code', '[]'::jsonb) $$,
  'P0001',
  'Admin access required.',
  'authenticated non-admin cannot execute find_existing_reward_inventory_values'
);

select extensions.throws_ok(
  $$ select * from public.admin_reward_assignment_counts(array[]::text[]) $$,
  'P0001',
  'Admin access required.',
  'authenticated non-admin cannot execute admin_reward_assignment_counts'
);

select extensions.throws_ok(
  $$ select * from public.admin_perk_prize_assignment_counts(array[]::uuid[]) $$,
  'P0001',
  'Admin access required.',
  'authenticated non-admin cannot execute admin_perk_prize_assignment_counts'
);

select extensions.throws_ok(
  $$ select public.queue_broadcast_notification('system', 'test', 'Title', 'Body') $$,
  'P0001',
  'Admin access required.',
  'authenticated non-admin cannot execute queue_broadcast_notification'
);

reset role;

select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;

select extensions.lives_ok(
  $$ select public.admin_reset_ai_course_tree('missing-course', 'draft') $$,
  'admin can execute admin_reset_ai_course_tree'
);

select extensions.lives_ok(
  $$ select public.admin_reset_ai_course_media('missing-course', null, 'draft') $$,
  'admin can execute admin_reset_ai_course_media'
);

select extensions.lives_ok(
  $$ select * from public.find_existing_reward_inventory_values('reward', 'voucher_code', '[]'::jsonb) $$,
  'admin can execute find_existing_reward_inventory_values'
);

select extensions.lives_ok(
  $$ select * from public.admin_reward_assignment_counts(array[]::text[]) $$,
  'admin can execute admin_reward_assignment_counts'
);

select extensions.lives_ok(
  $$ select * from public.admin_perk_prize_assignment_counts(array[]::uuid[]) $$,
  'admin can execute admin_perk_prize_assignment_counts'
);

reset role;

select extensions.is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    left join private.rpc_security_classifications c
      on c.function_schema = n.nspname
     and c.function_name = p.proname
     and c.identity_arguments = pg_get_function_identity_arguments(p.oid)
    where n.nspname = 'public'
      and p.prosecdef
      and c.function_name is null
  $$,
  'all public SECURITY DEFINER functions are classified'
);

select extensions.is_empty(
  $$
    select p.oid::regprocedure::text
    from private.rpc_security_classifications c
    join pg_namespace n
      on n.nspname = c.function_schema
    join pg_proc p
      on p.pronamespace = n.oid
     and p.proname = c.function_name
     and pg_get_function_identity_arguments(p.oid) = c.identity_arguments
    where (
      has_function_privilege('anon', p.oid, 'execute') is distinct from ('anon' = any(c.execute_roles))
      or has_function_privilege('authenticated', p.oid, 'execute') is distinct from ('authenticated' = any(c.execute_roles))
    )
  $$,
  'client RPC privileges match security classifications'
);

select extensions.is_empty(
  $$
    select p.oid::regprocedure::text
    from private.rpc_security_classifications c
    join pg_namespace n
      on n.nspname = c.function_schema
    join pg_proc p
      on p.pronamespace = n.oid
     and p.proname = c.function_name
     and pg_get_function_identity_arguments(p.oid) = c.identity_arguments
    where (
      has_function_privilege('anon', p.oid, 'execute') is distinct from ('anon' = any(c.execute_roles))
      or has_function_privilege('authenticated', p.oid, 'execute') is distinct from ('authenticated' = any(c.execute_roles))
    )
  $$,
  'client execute privileges match RPC classifications'
);

select * from finish();

rollback;
