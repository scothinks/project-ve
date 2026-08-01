alter table public.ai_generation_jobs
  add column if not exists lock_token uuid,
  add column if not exists lock_version integer not null default 0 check (lock_version >= 0);

drop index if exists ai_generation_jobs_idempotency_key_idx;

create unique index if not exists ai_generation_jobs_active_idempotency_key_idx
  on public.ai_generation_jobs (idempotency_key)
  where idempotency_key is not null
    and status in ('queued', 'running');

create or replace function private.assert_ai_generation_job_lease(
  p_job public.ai_generation_jobs,
  p_worker_id text,
  p_lock_token uuid,
  p_lock_version integer,
  p_lease_seconds integer default 1800
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  if p_lock_token is null then
    raise exception 'AI generation job lock token is required.';
  end if;

  if p_lock_version is null then
    raise exception 'AI generation job lock version is required.';
  end if;

  if p_job.id is null or p_job.status <> 'running' then
    raise exception 'AI generation job is not running.';
  end if;

  if p_job.locked_by is distinct from p_worker_id
    or p_job.lock_token is distinct from p_lock_token
    or p_job.lock_version is distinct from p_lock_version then
    raise exception 'AI generation job lease is not held by this worker.'
      using errcode = '42501';
  end if;

  if coalesce(p_job.heartbeat_at, p_job.locked_at) < now() - make_interval(secs => p_lease_seconds) then
    raise exception 'AI generation job lease has expired.'
      using errcode = '42501';
  end if;
end;
$$;

drop function if exists public.claim_ai_generation_job(text, integer, integer);

create or replace function public.claim_ai_generation_job(
  p_worker_id text,
  p_lease_seconds integer default 1800,
  p_max_attempts integer default 3
)
returns table (
  id uuid,
  entity_type text,
  entity_id text,
  job_type text,
  prompt jsonb,
  attempt_count integer,
  lock_token uuid,
  lock_version integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  return query
  with candidate as (
    select j.id
    from public.ai_generation_jobs j
    where j.status in ('queued', 'running')
      and j.available_at <= now()
      and j.attempt_count < p_max_attempts
      and (
        j.status = 'queued'
        or (
          j.status = 'running'
          and (
            coalesce(j.heartbeat_at, j.locked_at) is null
            or coalesce(j.heartbeat_at, j.locked_at) < now() - make_interval(secs => p_lease_seconds)
          )
        )
      )
    order by j.available_at asc, j.created_at asc
    for update skip locked
    limit 1
  ),
  claimed as (
    update public.ai_generation_jobs j
    set status = 'running',
        attempt_count = j.attempt_count + 1,
        locked_at = now(),
        locked_by = p_worker_id,
        heartbeat_at = now(),
        lock_token = gen_random_uuid(),
        lock_version = j.lock_version + 1,
        started_at = coalesce(j.started_at, now()),
        error = null,
        failure_code = null,
        failure_detail = '{}'::jsonb
    from candidate
    where j.id = candidate.id
    returning j.id,
              j.entity_type,
              j.entity_id,
              j.job_type,
              j.prompt,
              j.attempt_count,
              j.lock_token,
              j.lock_version
  )
  select claimed.id,
         claimed.entity_type,
         claimed.entity_id,
         claimed.job_type,
         claimed.prompt,
         claimed.attempt_count,
         claimed.lock_token,
         claimed.lock_version
  from claimed;
end;
$$;

create or replace function public.heartbeat_ai_generation_job(
  p_job_id uuid,
  p_worker_id text,
  p_lock_token uuid,
  p_lock_version integer,
  p_lease_seconds integer default 1800
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
begin
  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  perform private.assert_ai_generation_job_lease(
    v_job,
    p_worker_id,
    p_lock_token,
    p_lock_version,
    p_lease_seconds
  );

  update public.ai_generation_jobs
  set heartbeat_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.materialize_ai_course_text_job(
  p_job_id uuid,
  p_entity_id text,
  p_course_row jsonb,
  p_course_update jsonb,
  p_lesson_rows jsonb,
  p_page_rows jsonb,
  p_block_rows jsonb,
  p_quiz_rows jsonb,
  p_question_rows jsonb,
  p_option_rows jsonb,
  p_media_rows jsonb,
  p_job_result jsonb,
  p_worker_id text,
  p_lock_token uuid,
  p_lock_version integer
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
begin
  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  perform private.assert_ai_generation_job_lease(
    v_job,
    p_worker_id,
    p_lock_token,
    p_lock_version
  );

  perform public.materialize_ai_course_text_job(
    p_job_id,
    p_entity_id,
    p_course_row,
    p_course_update,
    p_lesson_rows,
    p_page_rows,
    p_block_rows,
    p_quiz_rows,
    p_question_rows,
    p_option_rows,
    p_media_rows,
    p_job_result
  );

  update public.ai_generation_jobs
  set lock_token = null
  where id = p_job_id;
end;
$$;

create or replace function public.complete_ai_generation_job(
  p_job_id uuid,
  p_worker_id text,
  p_lock_token uuid,
  p_lock_version integer,
  p_entity_id text,
  p_status text,
  p_result jsonb,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'AI generation job completion status must be completed or failed.';
  end if;

  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  perform private.assert_ai_generation_job_lease(
    v_job,
    p_worker_id,
    p_lock_token,
    p_lock_version
  );

  update public.ai_generation_jobs
  set entity_id = p_entity_id,
      status = p_status,
      result = coalesce(p_result, '{}'::jsonb),
      error = p_error,
      failure_code = case when p_status = 'completed' then null else failure_code end,
      failure_detail = case when p_status = 'completed' then '{}'::jsonb else failure_detail end,
      locked_at = null,
      locked_by = null,
      heartbeat_at = now(),
      lock_token = null,
      completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_job_id;
end;
$$;

create or replace function public.fail_ai_generation_job(
  p_job_id uuid,
  p_worker_id text,
  p_lock_token uuid,
  p_lock_version integer,
  p_error text,
  p_failure_code text default 'worker_error',
  p_failure_detail jsonb default '{}'::jsonb,
  p_retry boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
begin
  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  perform private.assert_ai_generation_job_lease(
    v_job,
    p_worker_id,
    p_lock_token,
    p_lock_version
  );

  update public.ai_generation_jobs
  set status = case when p_retry then 'queued' else 'failed' end,
      error = p_error,
      failure_code = p_failure_code,
      failure_detail = coalesce(p_failure_detail, '{}'::jsonb),
      locked_at = null,
      locked_by = null,
      heartbeat_at = now(),
      lock_token = null,
      available_at = case when p_retry then now() + interval '5 minutes' else available_at end
  where id = p_job_id;
end;
$$;

create or replace function public.replace_ai_course_text_job(
  p_job_id uuid,
  p_entity_id text,
  p_course_update jsonb,
  p_lesson_rows jsonb,
  p_page_rows jsonb,
  p_block_rows jsonb,
  p_quiz_rows jsonb,
  p_question_rows jsonb,
  p_option_rows jsonb,
  p_media_rows jsonb,
  p_job_result jsonb,
  p_worker_id text,
  p_lock_token uuid,
  p_lock_version integer
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_course_status public.content_status;
  v_job public.ai_generation_jobs%rowtype;
begin
  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  perform private.assert_ai_generation_job_lease(
    v_job,
    p_worker_id,
    p_lock_token,
    p_lock_version
  );

  select status
  into v_course_status
  from public.courses
  where id = p_entity_id
  for update;

  if not found then
    raise exception 'Course not found for AI text revision job.';
  end if;

  if v_course_status = 'published' then
    raise exception 'Disable the course before revising AI text because published courses do not have a separate draft version yet.';
  end if;

  delete from public.learning_media_assets
  where course_id = p_entity_id;

  delete from public.lessons
  where course_id = p_entity_id;

  update public.courses
  set title = coalesce(p_course_update ->> 'title', title),
      description = coalesce(p_course_update ->> 'description', description),
      category = coalesce(p_course_update ->> 'category', category),
      level = coalesce(nullif(p_course_update ->> 'level', '')::public.course_level, level),
      estimated_minutes = coalesce((p_course_update ->> 'estimated_minutes')::integer, estimated_minutes),
      ai_generated = coalesce((p_course_update ->> 'ai_generated')::boolean, ai_generated),
      ai_text_status = coalesce(p_course_update ->> 'ai_text_status', ai_text_status),
      ai_media_status = coalesce(p_course_update ->> 'ai_media_status', ai_media_status),
      ai_publish_status = coalesce(p_course_update ->> 'ai_publish_status', ai_publish_status),
      text_approved_at = case
        when p_course_update ? 'text_approved_at' then nullif(p_course_update ->> 'text_approved_at', '')::timestamptz
        else text_approved_at
      end,
      text_approved_by = case
        when p_course_update ? 'text_approved_by' then nullif(p_course_update ->> 'text_approved_by', '')::uuid
        else text_approved_by
      end,
      media_approved_at = case
        when p_course_update ? 'media_approved_at' then nullif(p_course_update ->> 'media_approved_at', '')::timestamptz
        else media_approved_at
      end,
      media_approved_by = case
        when p_course_update ? 'media_approved_by' then nullif(p_course_update ->> 'media_approved_by', '')::uuid
        else media_approved_by
      end,
      ai_generation_notes = case
        when p_course_update ? 'ai_generation_notes' then coalesce(p_course_update -> 'ai_generation_notes', '{}'::jsonb)
        else ai_generation_notes
      end
  where id = p_entity_id;

  perform public.materialize_ai_course_text_job(
    p_job_id,
    p_entity_id,
    null,
    null,
    p_lesson_rows,
    p_page_rows,
    p_block_rows,
    p_quiz_rows,
    p_question_rows,
    p_option_rows,
    p_media_rows,
    p_job_result
  );

  update public.ai_generation_jobs
  set lock_token = null
  where id = p_job_id;
end;
$$;

revoke execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated, service_role;
revoke execute on function public.complete_ai_generation_job(uuid, text, text, text, jsonb, text) from public, anon, authenticated, service_role;
revoke execute on function public.fail_ai_generation_job(uuid, text, text, text, jsonb, boolean) from public, anon, authenticated, service_role;
revoke execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated, service_role;

revoke execute on function public.claim_ai_generation_job(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_generation_job(text, integer, integer) to service_role;

revoke execute on function public.heartbeat_ai_generation_job(uuid, text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.heartbeat_ai_generation_job(uuid, text, uuid, integer, integer) to service_role;

revoke execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer) to service_role;

revoke execute on function public.complete_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, text) to service_role;

revoke execute on function public.fail_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.fail_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, boolean) to service_role;

revoke execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer) to service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'public',
    'materialize_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_row jsonb, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb, p_worker_id text',
    'INTERNAL_HELPER',
    'Fenced AI generation worker RPC only.',
    'Superseded by the claim-token/lock-version signature. No API role may execute it directly.',
    array[]::text[]
  ),
  (
    'public',
    'complete_ai_generation_job',
    'p_job_id uuid, p_worker_id text, p_entity_id text, p_status text, p_result jsonb, p_error text',
    'INTERNAL_HELPER',
    'Fenced AI generation worker RPC only.',
    'Superseded by the claim-token/lock-version signature. No API role may execute it directly.',
    array[]::text[]
  ),
  (
    'public',
    'fail_ai_generation_job',
    'p_job_id uuid, p_worker_id text, p_error text, p_failure_code text, p_failure_detail jsonb, p_retry boolean',
    'INTERNAL_HELPER',
    'Fenced AI generation worker RPC only.',
    'Superseded by the claim-token/lock-version signature. No API role may execute it directly.',
    array[]::text[]
  ),
  (
    'public',
    'replace_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb, p_worker_id text',
    'INTERNAL_HELPER',
    'Fenced AI generation worker RPC only.',
    'Superseded by the claim-token/lock-version signature. No API role may execute it directly.',
    array[]::text[]
  ),
  (
    'public',
    'heartbeat_ai_generation_job',
    'p_job_id uuid, p_worker_id text, p_lock_token uuid, p_lock_version integer, p_lease_seconds integer',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Refreshes a running worker lease only when the caller supplies the current worker id, claim token, and lock version. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'materialize_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_row jsonb, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb, p_worker_id text, p_lock_token uuid, p_lock_version integer',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Transactionally materializes generated course text rows and marks the job completed only when the caller supplies the current worker id, claim token, and lock version. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'complete_ai_generation_job',
    'p_job_id uuid, p_worker_id text, p_lock_token uuid, p_lock_version integer, p_entity_id text, p_status text, p_result jsonb, p_error text',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Marks non-materialization AI generation jobs completed or failed only when the caller supplies the current worker id, claim token, and lock version. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'fail_ai_generation_job',
    'p_job_id uuid, p_worker_id text, p_lock_token uuid, p_lock_version integer, p_error text, p_failure_code text, p_failure_detail jsonb, p_retry boolean',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Marks a running AI generation job failed or requeued only when the caller supplies the current worker id, claim token, and lock version. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'replace_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb, p_worker_id text, p_lock_token uuid, p_lock_version integer',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Transactionally replaces generated course text rows and marks the job completed only when the caller supplies the current worker id, claim token, and lock version. No client role may execute it.',
    array['service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
