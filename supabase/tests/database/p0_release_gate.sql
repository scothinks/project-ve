begin;

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(16);

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
  'P0 gate: every public SECURITY DEFINER function is classified'
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
  'P0 gate: client RPC privileges match classifications'
);

select extensions.is_empty(
  $$
    select function_name
    from (
      values
        ('apply_native_reward_effect', 'public.apply_native_reward_effect(uuid, uuid, text, jsonb)'),
        ('queue_push_deliveries_for_notification', 'public.queue_push_deliveries_for_notification(uuid)'),
        ('grant_mission_award', 'public.grant_mission_award(uuid, text, text, jsonb)'),
        ('refresh_reward_quantity_inventory_counts', 'public.refresh_reward_quantity_inventory_counts(text)'),
        ('aggregate_ad_events_daily', 'public.aggregate_ad_events_daily(date, date)'),
        ('upsert_ad_frequency_counter', 'public.upsert_ad_frequency_counter(public.ad_frequency_scope_type, text, text, interval, text, text, text, uuid, text, text, public.ad_event_type)'),
        ('mission_proof_fields_satisfy', 'public.mission_proof_fields_satisfy(text[], text, uuid, text, text, text[])')
    ) sensitive(function_name, signature)
    where has_function_privilege('anon', signature, 'execute')
       or has_function_privilege('authenticated', signature, 'execute')
  $$,
  'P0 gate: sensitive implementation RPCs are not client executable'
);

select extensions.is_empty(
  $$
    select function_name
    from (
      values
        ('increment_profile_xp', 'public.increment_profile_xp(uuid, integer)'),
        ('queue_user_notification', 'public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text)'),
        ('generate_continue_learning_reminders', 'public.generate_continue_learning_reminders()')
    ) helpers(function_name, signature)
    where has_function_privilege('anon', signature, 'execute')
       or has_function_privilege('authenticated', signature, 'execute')
  $$,
  'P0 gate: sensitive implementation helpers are not directly executable by client roles'
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
  'P0 gate: internal, service-only, and trigger-only functions are not client executable'
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
  'P0 gate: trigger-only functions are not executable by service_role'
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
  'P0 gate: self-scoped SECURITY DEFINER functions do not accept caller-supplied user ids'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.generate_continue_learning_reminders()', 'execute'),
  'P0 gate: service role can run notification reminders'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.start_quiz_attempt(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.start_quiz_attempt(text, text)', 'execute'),
  'P0 gate: quiz start is authenticated use-case RPC'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.answer_quiz_question(uuid, text, text[])', 'execute')
  and not has_function_privilege('anon', 'public.answer_quiz_question(uuid, text, text[])', 'execute'),
  'P0 gate: quiz answer is authenticated use-case RPC'
);

select extensions.is_empty(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('quiz_attempts', 'quiz_attempt_questions')
      and cmd = 'INSERT'
      and 'authenticated' = any(roles)
  $$,
  'P0 gate: learners do not have direct quiz attempt insert policies'
);

select extensions.is_empty(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('quiz_questions', 'quiz_options')
      and policyname in ('Published quiz questions are readable', 'Published quiz options are readable')
  $$,
  'P0 gate: raw published quiz answer tables are not learner-readable'
);

select extensions.ok(
  has_table_privilege('anon', 'public.learner_quiz_questions', 'select')
  and has_table_privilege('authenticated', 'public.learner_quiz_questions', 'select')
  and has_table_privilege('anon', 'public.learner_quiz_options', 'select')
  and has_table_privilege('authenticated', 'public.learner_quiz_options', 'select'),
  'P0 gate: sanitized learner quiz views are readable'
);

select extensions.is_empty(
  $$
    select table_name || '.' || column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('learner_quiz_questions', 'learner_quiz_options')
      and column_name in ('is_correct', 'correct_option_ids', 'explanation')
  $$,
  'P0 gate: sanitized learner quiz views omit answer key fields'
);

select extensions.ok(
  not has_table_privilege('anon', 'private.quiz_answer_keys', 'select')
  and not has_table_privilege('authenticated', 'private.quiz_answer_keys', 'select'),
  'P0 gate: private quiz answer keys are not client-readable'
);

select extensions.ok(
  not has_function_privilege('anon', 'private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute')
  and not has_function_privilege('service_role', 'private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb)', 'execute'),
  'P0 gate: canonical XP posting helper is private-only'
);

select * from finish();

rollback;
