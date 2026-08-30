begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(47);

select extensions.ok(
  not has_function_privilege('anon', 'public.increment_profile_xp(uuid, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.increment_profile_xp(uuid, integer)', 'execute'),
  'client roles cannot execute increment_profile_xp directly'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.apply_native_reward_effect(uuid, uuid, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.apply_native_reward_effect(uuid, uuid, text, jsonb)', 'execute'),
  'client roles cannot execute apply_native_reward_effect'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)', 'execute'),
  'client roles cannot execute queue_user_notification directly'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.queue_push_deliveries_for_notification(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.queue_push_deliveries_for_notification(uuid)', 'execute'),
  'client roles cannot execute queue_push_deliveries_for_notification'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.generate_continue_learning_reminders()', 'execute')
  and not has_function_privilege('authenticated', 'public.generate_continue_learning_reminders()', 'execute'),
  'client roles cannot execute reminder generation directly'
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
  not has_function_privilege('anon', 'public.grant_mission_award(uuid, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.grant_mission_award(uuid, text, text, jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.grant_mission_award(uuid, text, text, jsonb)', 'execute'),
  'no API role can execute grant_mission_award directly'
);

select extensions.is_empty(
  $$
    select function_name
    from (
      values
        ('refresh_reward_quantity_inventory_counts', 'public.refresh_reward_quantity_inventory_counts(text)'),
        ('aggregate_ad_events_daily', 'public.aggregate_ad_events_daily(date, date)'),
        ('upsert_ad_frequency_counter', 'public.upsert_ad_frequency_counter(public.ad_frequency_scope_type, text, text, interval, text, text, text, uuid, text, text, public.ad_event_type)'),
        ('mission_proof_fields_satisfy', 'public.mission_proof_fields_satisfy(text[], text, uuid, text, text, text[])')
    ) sensitive(function_name, signature)
    where has_function_privilege('anon', signature, 'execute')
       or has_function_privilege('authenticated', signature, 'execute')
       or has_function_privilege('service_role', signature, 'execute')
  $$,
  'residual internal maintenance helpers are not directly executable by API roles'
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
  $$ select public.grant_mission_award('00000000-0000-0000-0000-000000000101', 'mission-complete-starter-budget', 've-sec-002-direct-a') $$,
  '42501',
  'permission denied for function grant_mission_award',
  'authenticated learner cannot execute grant_mission_award directly'
);

select extensions.throws_ok(
  $$ select public.grant_mission_award('00000000-0000-0000-0000-000000000101', 'mission-complete-starter-budget', 've-sec-002-direct-b') $$,
  '42501',
  'permission denied for function grant_mission_award',
  'authenticated learner cannot vary award_scope to manufacture repeated mission awards'
);

select extensions.throws_ok(
  $$ select public.admin_reset_ai_course_tree('missing-course', 'draft') $$,
  'P0001',
  'Course editor access required.',
  'authenticated non-admin cannot execute admin_reset_ai_course_tree'
);

select extensions.throws_ok(
  $$ select public.admin_reset_ai_course_media('missing-course', null, 'draft') $$,
  'P0001',
  'Course editor access required.',
  'authenticated non-admin cannot execute admin_reset_ai_course_media'
);

select extensions.throws_ok(
  $$ select * from public.find_existing_reward_inventory_values('reward', 'voucher_code', '[]'::jsonb) $$,
  'P0001',
  'Admin or organisation manager access required.',
  'authenticated non-admin non-org-staff cannot execute find_existing_reward_inventory_values'
);

select extensions.throws_ok(
  $$ select public.refund_reward_redemption('00000000-0000-0000-0000-000000000999'::uuid, 'test') $$,
  'P0001',
  'We could not find this reward redemption.',
  'authenticated non-admin without an existing redemption is rejected by refund_reward_redemption'
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

set local role anon;

select extensions.throws_ok(
  $$ select public.grant_mission_award('00000000-0000-0000-0000-000000000101', 'mission-complete-starter-budget', 've-sec-002-anon') $$,
  '42501',
  'permission denied for function grant_mission_award',
  'anon cannot execute grant_mission_award directly'
);

reset role;

set local role service_role;

select extensions.is(
  (
    select count(*)::integer
    from public.mission_awards
    where user_id = '00000000-0000-0000-0000-000000000101'::uuid
      and mission_id = 'mission-complete-starter-budget'
      and award_scope in ('ve-sec-002-direct-a', 've-sec-002-direct-b', 've-sec-002-anon')
  ),
  0,
  'direct grant_mission_award attempts do not create mission awards'
);

reset role;

set local role service_role;

insert into public.courses (
  id,
  slug,
  title,
  description,
  category,
  level,
  status
)
values (
  'course-ve-sec-002-mission-flow',
  've-sec-002-mission-flow',
  'VE-SEC-002 Mission Flow',
  'Transaction-local course fixture for RPC security tests.',
  'Security',
  'beginner',
  'published'
)
on conflict (id) do update
set status = excluded.status;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  description,
  status
)
values (
  'lesson-ve-sec-002-mission-flow',
  'course-ve-sec-002-mission-flow',
  've-sec-002-mission-flow',
  'VE-SEC-002 Mission Flow',
  'Transaction-local lesson fixture for RPC security tests.',
  'published'
)
on conflict (id) do update
set course_id = excluded.course_id,
    status = excluded.status;

insert into public.lesson_pages (
  id,
  lesson_id,
  page_number,
  title,
  page_type
)
values (
  'page-ve-sec-002-mission-flow-1',
  'lesson-ve-sec-002-mission-flow',
  1,
  'Mission Flow Page',
  'concept'
)
on conflict (id) do update
set lesson_id = excluded.lesson_id,
    page_number = excluded.page_number;

insert into public.missions (
  id,
  title,
  description,
  category,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  reward_type
)
values (
  'mission-ve-sec-002-supported-flow',
  'VE-SEC-002 Supported Flow',
  'Transaction-local mission fixture for RPC security tests.',
  'course',
  1,
  'once',
  'lesson_completed',
  '{"lessonId": "lesson-ve-sec-002-mission-flow"}'::jsonb,
  'published',
  'xp'
)
on conflict (id) do update
set validation_config = excluded.validation_config,
    status = excluded.status,
    reward_xp = excluded.reward_xp;

reset role;

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select public.complete_lesson_page('lesson-ve-sec-002-mission-flow', lesson_pages.id)
from public.lesson_pages
where lesson_pages.lesson_id = 'lesson-ve-sec-002-mission-flow'
order by lesson_pages.page_number;

select extensions.ok(
  public.lesson_is_complete_for_user(:'TEST_LEARNER_USER_ID'::uuid, 'lesson-ve-sec-002-mission-flow'),
  'supported lesson completion RPC makes the mission validation true'
);

select extensions.is(
  public.award_valid_mission_xp('mission-ve-sec-002-supported-flow', 've-sec-002-supported-flow') ->> 'status',
  'awarded',
  'supported mission award RPC still grants a valid completed mission'
);

reset role;

set local role service_role;

select extensions.is(
  (
    select count(*)::integer
    from public.mission_awards
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and mission_id = 'mission-ve-sec-002-supported-flow'
      and award_scope = 've-sec-002-supported-flow'
  ),
  1,
  'supported mission award path creates one mission award'
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

select extensions.throws_ok(
  $$ select public.refund_reward_redemption('00000000-0000-0000-0000-000000000999'::uuid, 'test') $$,
  'P0001',
  'We could not find this reward redemption.',
  'admin reaches refund_reward_redemption after admin authorization'
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
    select c.function_schema || '.' || c.function_name || '(' || c.identity_arguments || ')'
    from private.rpc_security_classifications c
    left join pg_namespace n
      on n.nspname = c.function_schema
    left join pg_proc p
      on p.pronamespace = n.oid
     and p.proname = c.function_name
     and pg_get_function_identity_arguments(p.oid) = c.identity_arguments
    where c.function_schema = 'public'
      and p.oid is null
  $$,
  'all public RPC classifications resolve to current function signatures'
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
      or has_function_privilege('service_role', p.oid, 'execute') is distinct from ('service_role' = any(c.execute_roles))
    )
  $$,
  'API role RPC privileges match security classifications'
);

select extensions.is_empty(
  $$
    select p.oid::regprocedure::text || ' classified as ' || c.classification::text
    from private.rpc_security_classifications c
    join pg_namespace n
      on n.nspname = c.function_schema
    join pg_proc p
      on p.pronamespace = n.oid
     and p.proname = c.function_name
     and pg_get_function_identity_arguments(p.oid) = c.identity_arguments
    where c.classification in ('INTERNAL_HELPER', 'SERVICE_ROLE_ONLY', 'TRIGGER_ONLY')
      and (
        has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute')
      )
  $$,
  'internal, service-only, and trigger-only SECURITY DEFINER functions are not client executable'
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
    where c.classification = 'TRIGGER_ONLY'
      and has_function_privilege('service_role', p.oid, 'execute')
  $$,
  'trigger-only SECURITY DEFINER functions are not executable by service_role'
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
    where c.classification = 'PUBLIC_AUTHENTICATED_SELF'
      and c.identity_arguments ~ '(^|, )p_user_id uuid(,|$)'
  $$,
  'self-scoped SECURITY DEFINER functions do not accept caller-supplied user ids'
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
      or has_function_privilege('service_role', p.oid, 'execute') is distinct from ('service_role' = any(c.execute_roles))
    )
  $$,
  'API role execute privileges match RPC classifications'
);

select * from finish();

rollback;
