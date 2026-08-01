begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(21);

reset role;
set local role service_role;

insert into public.ai_generation_jobs (
  id,
  entity_type,
  entity_id,
  job_type,
  status,
  prompt,
  result,
  created_by,
  attempt_count,
  locked_at,
  locked_by,
  heartbeat_at,
  available_at,
  lock_token,
  lock_version
) values
  (
    '00000000-0000-4000-8000-000000000101',
    'course',
    'test-ai-worker-stale-course',
    'course_text',
    'running',
    '{"mode":"create_course"}'::jsonb,
    '{}'::jsonb,
    :'TEST_ADMIN_USER_ID',
    1,
    now() - interval '2 hours',
    'stale-worker',
    now() - interval '2 hours',
    '1900-01-01 00:00:00+00'::timestamptz,
    '10000000-0000-4000-8000-000000000101'::uuid,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000201',
    'course',
    'test-ai-worker-active-course',
    'course_text',
    'running',
    '{"mode":"create_course"}'::jsonb,
    '{}'::jsonb,
    :'TEST_ADMIN_USER_ID',
    1,
    now(),
    'active-worker',
    now(),
    '1900-01-02 00:00:00+00'::timestamptz,
    '10000000-0000-4000-8000-000000000201'::uuid,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'course',
    'test-ai-worker-queued-course',
    'course_text',
    'queued',
    '{"mode":"create_course"}'::jsonb,
    '{}'::jsonb,
    :'TEST_ADMIN_USER_ID',
    0,
    null,
    null,
    null,
    '1900-01-03 00:00:00+00'::timestamptz,
    null,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000301',
    'course',
    'test-ai-worker-final-failure-course',
    'course_text',
    'running',
    '{"mode":"create_course"}'::jsonb,
    '{}'::jsonb,
    :'TEST_ADMIN_USER_ID',
    2,
    now(),
    'failure-worker',
    now(),
    '1900-01-04 00:00:00+00'::timestamptz,
    '10000000-0000-4000-8000-000000000301'::uuid,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000401',
    'course',
    'test-ai-worker-partial-course',
    'course_text',
    'running',
    '{"mode":"create_course"}'::jsonb,
    '{}'::jsonb,
    :'TEST_ADMIN_USER_ID',
    1,
    now(),
    'materialize-worker',
    now(),
    '1900-01-05 00:00:00+00'::timestamptz,
    '10000000-0000-4000-8000-000000000401'::uuid,
    1
  );

create temporary table test_claimed_stale
on commit drop
as
select *
from public.claim_ai_generation_job('fresh-worker', 1800, 3);

select extensions.is(
  (select count(*)::integer from test_claimed_stale),
  1,
  'stale lease recovery claims exactly one stale running job'
);

select extensions.is(
  (select id from test_claimed_stale),
  '00000000-0000-4000-8000-000000000101'::uuid,
  'stale lease recovery claims the expired locked job'
);

select extensions.ok(
  exists (
    select 1
    from public.ai_generation_jobs
    where id = '00000000-0000-4000-8000-000000000101'
      and status = 'running'
      and locked_by = 'fresh-worker'
      and locked_at is not null
      and heartbeat_at is not null
      and attempt_count = 2
      and lock_token is not null
      and lock_token <> '10000000-0000-4000-8000-000000000101'::uuid
      and lock_version = 2
  ),
  'stale lease recovery refreshes lock metadata, token, version, and attempts'
);

select extensions.ok(
  (select lock_token is not null and lock_version = 2 from test_claimed_stale),
  'claim returns the current lock token and version to the worker'
);

select extensions.throws_ok(
  $$
    select public.heartbeat_ai_generation_job(
      '00000000-0000-4000-8000-000000000101',
      'fresh-worker',
      '10000000-0000-4000-8000-000000000101'::uuid,
      1,
      1800
    )
  $$,
  '42501',
  'AI generation job lease is not held by this worker.',
  'heartbeat rejects a stale token and lock version'
);

select extensions.lives_ok(
  $$
    select public.heartbeat_ai_generation_job(
      '00000000-0000-4000-8000-000000000101',
      'fresh-worker',
      (select lock_token from public.ai_generation_jobs where id = '00000000-0000-4000-8000-000000000101'),
      (select lock_version from public.ai_generation_jobs where id = '00000000-0000-4000-8000-000000000101'),
      1800
    )
  $$,
  'heartbeat accepts the current worker token and version'
);

select extensions.throws_ok(
  $$
    select public.fail_ai_generation_job(
      '00000000-0000-4000-8000-000000000101',
      'stale-worker',
      '10000000-0000-4000-8000-000000000101'::uuid,
      1,
      'Stale worker failure.',
      'worker_error',
      '{"name":"StaleWorkerError"}'::jsonb,
      false
    )
  $$,
  '42501',
  'AI generation job lease is not held by this worker.',
  'stale worker cannot fail a job after another worker reclaims the lease'
);

select extensions.throws_ok(
  $$
    select public.materialize_ai_course_text_job(
      '00000000-0000-4000-8000-000000000101'::uuid,
      'test-ai-worker-stale-course',
      null::jsonb,
      null::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '{"mode":"stale-worker"}'::jsonb,
      'stale-worker',
      '10000000-0000-4000-8000-000000000101'::uuid,
      1
    )
  $$,
  '42501',
  'AI generation job lease is not held by this worker.',
  'stale worker cannot complete a job after another worker reclaims the lease'
);

select extensions.ok(
  exists (
    select 1
    from public.ai_generation_jobs
    where id = '00000000-0000-4000-8000-000000000101'
      and status = 'running'
      and locked_by = 'fresh-worker'
      and error is null
      and completed_at is null
  ),
  'stale worker denial leaves the reclaimed worker lease intact'
);

create temporary table test_claimed_exclusion
on commit drop
as
select *
from public.claim_ai_generation_job('second-worker', 1800, 3);

select extensions.is(
  (select id from test_claimed_exclusion),
  '00000000-0000-4000-8000-000000000202'::uuid,
  'simultaneous claim exclusion skips a freshly locked running job'
);

select extensions.ok(
  exists (
    select 1
    from public.ai_generation_jobs
    where id = '00000000-0000-4000-8000-000000000201'
      and status = 'running'
      and locked_by = 'active-worker'
      and attempt_count = 1
  ),
  'simultaneous claim exclusion leaves the active worker lock untouched'
);

select public.fail_ai_generation_job(
  '00000000-0000-4000-8000-000000000202',
  'second-worker',
  (select lock_token from public.ai_generation_jobs where id = '00000000-0000-4000-8000-000000000202'),
  (select lock_version from public.ai_generation_jobs where id = '00000000-0000-4000-8000-000000000202'),
  'Transient model failure.',
  'worker_error',
  '{"name":"DependencyUnavailableError"}'::jsonb,
  true
);

select extensions.ok(
  exists (
    select 1
    from public.ai_generation_jobs
    where id = '00000000-0000-4000-8000-000000000202'
      and status = 'queued'
      and error = 'Transient model failure.'
      and failure_code = 'worker_error'
      and failure_detail = '{"name":"DependencyUnavailableError"}'::jsonb
      and locked_at is null
      and locked_by is null
      and lock_token is null
      and available_at > now()
  ),
  'retry behavior requeues retryable failures with a future availability'
);

select public.fail_ai_generation_job(
  '00000000-0000-4000-8000-000000000301',
  'failure-worker',
  '10000000-0000-4000-8000-000000000301'::uuid,
  1,
  'Validation failed.',
  'validation_error',
  '{"name":"ValidationError"}'::jsonb,
  false
);

select extensions.ok(
  exists (
    select 1
    from public.ai_generation_jobs
    where id = '00000000-0000-4000-8000-000000000301'
      and status = 'failed'
      and error = 'Validation failed.'
      and failure_code = 'validation_error'
      and failure_detail = '{"name":"ValidationError"}'::jsonb
      and locked_at is null
      and locked_by is null
      and lock_token is null
      and available_at = '1900-01-04 00:00:00+00'::timestamptz
  ),
  'retry behavior permanently fails non-retryable validation errors'
);

insert into public.ai_generation_jobs (
  id,
  entity_type,
  entity_id,
  job_type,
  status,
  prompt,
  result,
  created_by,
  idempotency_key,
  available_at
) values (
  '00000000-0000-4000-8000-000000000501',
  'course',
  'test-ai-worker-idempotent-course',
  'course_text',
  'queued',
  '{"mode":"create_course"}'::jsonb,
  '{}'::jsonb,
  :'TEST_ADMIN_USER_ID',
  'test-active-ai-generation-idempotency',
  now() + interval '1 day'
);

select extensions.throws_ok(
  $$
    insert into public.ai_generation_jobs (
      id,
      entity_type,
      entity_id,
      job_type,
      status,
      prompt,
      result,
      idempotency_key,
      available_at
    ) values (
      '00000000-0000-4000-8000-000000000502',
      'course',
      'test-ai-worker-idempotent-course',
      'course_text',
      'queued',
      '{"mode":"create_course"}'::jsonb,
      '{}'::jsonb,
      'test-active-ai-generation-idempotency',
      now() + interval '1 day'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "ai_generation_jobs_active_idempotency_key_idx"',
  'active enqueue idempotency rejects duplicate queued jobs'
);

update public.ai_generation_jobs
set status = 'completed'
where id = '00000000-0000-4000-8000-000000000501';

select extensions.lives_ok(
  $$
    insert into public.ai_generation_jobs (
      id,
      entity_type,
      entity_id,
      job_type,
      status,
      prompt,
      result,
      idempotency_key,
      available_at
    ) values (
      '00000000-0000-4000-8000-000000000503',
      'course',
      'test-ai-worker-idempotent-course',
      'course_text',
      'queued',
      '{"mode":"create_course"}'::jsonb,
      '{}'::jsonb,
      'test-active-ai-generation-idempotency',
      now() + interval '1 day'
    )
  $$,
  'completed jobs do not block a later active enqueue with the same idempotency key'
);

select extensions.throws_ok(
  $$
    select public.materialize_ai_course_text_job(
      '00000000-0000-4000-8000-000000000401'::uuid,
      'test-ai-worker-partial-course',
      '{
        "id": "test-ai-worker-partial-course",
        "slug": "test-ai-worker-partial-course",
        "title": "Partial Materialization Test",
        "description": "Synthetic rollback fixture.",
        "category": "Testing",
        "level": "beginner",
        "thumbnail": {},
        "status": "draft",
        "sort_order": 0,
        "estimated_minutes": 5,
        "ai_text_status": "draft",
        "ai_media_status": "not_started",
        "ai_publish_status": "not_ready",
        "ai_generated": true,
        "ai_generation_notes": {}
      }'::jsonb,
      null::jsonb,
      '[{
        "id": "test-ai-worker-partial-lesson",
        "course_id": "missing-ai-worker-course",
        "slug": "test-ai-worker-partial-lesson",
        "title": "Broken Lesson",
        "description": "This intentionally references a missing course.",
        "cover_image": {},
        "status": "draft",
        "sort_order": 1,
        "estimated_minutes": 5,
        "retry_mode": "anytime",
        "retry_cooldown_seconds": null,
        "retry_requires_reread": true,
        "quiz_requires_lesson_completion": true,
        "max_earning_attempts": null,
        "ai_text_status": "draft",
        "ai_media_status": "not_started",
        "ai_publish_status": "not_ready",
        "ai_generated": true,
        "ai_generation_notes": {}
      }]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '{"mode":"create_course"}'::jsonb,
      'materialize-worker',
      '10000000-0000-4000-8000-000000000401'::uuid,
      1
    )
  $$,
  '23503',
  'insert or update on table "lessons" violates foreign key constraint "lessons_course_id_fkey"',
  'no-partial-materialization failure case raises before completing the job'
);

select extensions.ok(
  not exists (
    select 1
    from public.courses
    where id = 'test-ai-worker-partial-course'
  ),
  'no-partial-materialization failure rolls back the course insert'
);

select extensions.ok(
  not exists (
    select 1
    from public.lessons
    where id = 'test-ai-worker-partial-lesson'
  ),
  'no-partial-materialization failure rolls back dependent lesson inserts'
);

select extensions.ok(
  exists (
    select 1
    from public.ai_generation_jobs
    where id = '00000000-0000-4000-8000-000000000401'
      and status = 'running'
      and completed_at is null
      and result = '{}'::jsonb
  ),
  'no-partial-materialization failure leaves the running job uncompleted for worker failure handling'
);

select extensions.ok(
  has_function_privilege('service_role', 'public.claim_ai_generation_job(text, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.claim_ai_generation_job(text, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.heartbeat_ai_generation_job(uuid, text, uuid, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.heartbeat_ai_generation_job(uuid, text, uuid, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.fail_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.fail_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, boolean)', 'execute')
  and has_function_privilege('service_role', 'public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer)', 'execute')
  and has_function_privilege('service_role', 'public.complete_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.complete_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, text)', 'execute'),
  'token-fenced worker RPCs remain service-role-only while testing worker behavior'
);

select extensions.ok(
  not has_function_privilege('service_role', 'public.fail_ai_generation_job(uuid, text, text, jsonb, boolean)', 'execute')
  and not has_function_privilege('service_role', 'public.fail_ai_generation_job(uuid, text, text, text, jsonb, boolean)', 'execute')
  and not has_function_privilege('service_role', 'public.complete_ai_generation_job(uuid, text, text, text, jsonb, text)', 'execute')
  and not has_function_privilege('service_role', 'public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text)', 'execute')
  and not has_function_privilege('service_role', 'public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text)', 'execute'),
  'unfenced worker RPC signatures are not executable by service_role'
);

select * from finish();

rollback;
