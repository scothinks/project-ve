begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(19);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute'),
  'client roles cannot execute queue_user_notification directly'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_push_deliveries_for_notification(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.queue_push_deliveries_for_notification(uuid)', 'execute'),
  'client roles cannot queue push deliveries'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.generate_continue_learning_reminders()', 'execute')
  and not has_function_privilege('authenticated', 'public.generate_continue_learning_reminders()', 'execute'),
  'client roles cannot execute reminder generation directly'
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

select extensions.ok(
  not has_function_privilege('anon', 'public.mark_notification_read(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.mark_notification_read(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.mark_all_notifications_read()', 'execute')
  and has_function_privilege('authenticated', 'public.mark_all_notifications_read()', 'execute'),
  'authenticated users can execute scoped notification read RPCs while anon cannot'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.user_notifications', 'update'),
  'authenticated users cannot update notification rows directly'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
set local role authenticated;

select extensions.throws_ok(
  $$ select public.queue_user_notification('00000000-0000-0000-0000-000000000301', 'system', 'test', 'Title', 'Body') $$,
  '42501',
  'permission denied for function queue_user_notification'
);

select extensions.throws_ok(
  $$ select public.queue_user_notification('00000000-0000-0000-0000-000000000302', 'system', 'test', 'Title', 'Body') $$,
  '42501',
  'permission denied for function queue_user_notification'
);

select extensions.throws_ok(
  $$ select public.generate_continue_learning_reminders() $$,
  '42501',
  'permission denied for function generate_continue_learning_reminders'
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

create temporary table test_notification_ids (
  label text primary key,
  id uuid not null
) on commit drop;

grant select on test_notification_ids to authenticated;

with created as (
  insert into public.user_notifications (
    user_id,
    category,
    event_type,
    title,
    body,
    dedupe_key
  )
  values (
    :'TEST_LEARNER_USER_ID',
    'system',
    'test_scoped_read_one',
    'Read test one',
    'Scoped read fixture.',
    've-notif-002-one:' || gen_random_uuid()::text
  )
  returning id
)
insert into test_notification_ids (label, id)
select 'learner_one', id
from created;

with created as (
  insert into public.user_notifications (
    user_id,
    category,
    event_type,
    title,
    body,
    dedupe_key
  )
  values (
    :'TEST_LEARNER_USER_ID',
    'system',
    'test_scoped_read_two',
    'Read test two',
    'Scoped read fixture.',
    've-notif-002-two:' || gen_random_uuid()::text
  )
  returning id
)
insert into test_notification_ids (label, id)
select 'learner_two', id
from created;

with created as (
  insert into public.user_notifications (
    user_id,
    category,
    event_type,
    title,
    body,
    dedupe_key
  )
  values (
    :'TEST_ADMIN_USER_ID',
    'system',
    'test_scoped_read_other',
    'Other user read test',
    'Scoped read fixture.',
    've-notif-002-other:' || gen_random_uuid()::text
  )
  returning id
)
insert into test_notification_ids (label, id)
select 'other_user', id
from created;

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.throws_ok(
  format(
    $$ update public.user_notifications set title = 'Tampered title' where id = %L::uuid $$,
    (select id from test_notification_ids where label = 'learner_one')
  ),
  '42501',
  'permission denied for table user_notifications'
);

select extensions.ok(
  (select public.mark_notification_read(id) from test_notification_ids where label = 'learner_one'),
  'authenticated learner can mark one owned notification read'
);

select extensions.ok(
  not (select public.mark_notification_read(id) from test_notification_ids where label = 'other_user'),
  'authenticated learner cannot mark another user notification read'
);

reset role;
set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.user_notifications un
    join test_notification_ids t
      on t.id = un.id
    where t.label = 'other_user'
      and un.read_at is null
  ),
  'cross-user mark read attempt leaves other user notification unread'
);

reset role;
select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.mark_all_notifications_read();

select extensions.ok(
  not exists (
    select 1
    from public.user_notifications un
    join test_notification_ids t
      on t.id = un.id
    where t.label in ('learner_one', 'learner_two')
      and un.read_at is null
  ),
  'authenticated learner can mark remaining owned notifications read'
);

select * from finish();

rollback;
