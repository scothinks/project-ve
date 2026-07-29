begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(12);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute')
  and has_function_privilege('authenticated', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute'),
  'authenticated users can reach queue_user_notification denial wrapper while anon cannot'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_push_deliveries_for_notification(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.queue_push_deliveries_for_notification(uuid)', 'execute'),
  'client roles cannot queue push deliveries'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.generate_continue_learning_reminders()', 'execute')
  and has_function_privilege('authenticated', 'public.generate_continue_learning_reminders()', 'execute'),
  'authenticated users can reach reminder generation denial wrapper while anon cannot'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text)', 'execute')
  and has_function_privilege('authenticated', 'public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text)', 'execute'),
  'broadcast RPC is authenticated-only before admin authorization'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute')
  and has_function_privilege('service_role', 'public.queue_push_deliveries_for_notification(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.generate_continue_learning_reminders()', 'execute'),
  'service_role can execute operational notification RPCs'
);

select extensions.ok(
  not has_function_privilege('anon', 'private.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute')
  and not has_function_privilege('service_role', 'private.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute'),
  'private queue_user_notification helper is not directly executable by API roles'
);

select extensions.ok(
  not has_function_privilege('anon', 'private.queue_push_deliveries_for_notification(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.queue_push_deliveries_for_notification(uuid)', 'execute')
  and not has_function_privilege('service_role', 'private.queue_push_deliveries_for_notification(uuid)', 'execute'),
  'private push delivery helper is not directly executable by API roles'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.queue_user_notification('00000000-0000-0000-0000-000000000301', 'system', 'test', 'Title', 'Body') $$,
  '42501',
  'authenticated learner cannot queue a notification to themselves'
);

select extensions.throws_ok(
  $$ select public.queue_user_notification('00000000-0000-0000-0000-000000000302', 'system', 'test', 'Title', 'Body') $$,
  '42501',
  'authenticated learner cannot queue a notification to another user'
);

select extensions.throws_ok(
  $$ select public.generate_continue_learning_reminders() $$,
  '42501',
  'authenticated learner cannot run reminder generation'
);

select extensions.throws_ok(
  $$ select public.queue_broadcast_notification('system', 'test', 'Title', 'Body') $$,
  'P0001',
  'Admin access required.'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

select extensions.lives_ok(
  $$ select public.generate_continue_learning_reminders() $$,
  'service_role can run reminder generation'
);

select * from finish();

rollback;
