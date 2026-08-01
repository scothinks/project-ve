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
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  if not found or v_job.status <> 'running' then
    raise exception 'AI generation job is not running.';
  end if;

  if v_job.locked_by is distinct from p_worker_id then
    raise exception 'AI generation job lease is not held by this worker.'
      using errcode = '42501';
  end if;

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
end;
$$;

create or replace function public.complete_ai_generation_job(
  p_job_id uuid,
  p_worker_id text,
  p_entity_id text,
  p_status text,
  p_result jsonb,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  if p_status not in ('completed', 'failed') then
    raise exception 'AI generation job completion status must be completed or failed.';
  end if;

  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  if not found or v_job.status <> 'running' then
    raise exception 'AI generation job is not running.';
  end if;

  if v_job.locked_by is distinct from p_worker_id then
    raise exception 'AI generation job lease is not held by this worker.'
      using errcode = '42501';
  end if;

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
      completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_job_id;
end;
$$;

create or replace function public.fail_ai_generation_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_failure_code text default 'worker_error',
  p_failure_detail jsonb default '{}'::jsonb,
  p_retry boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ai_generation_jobs%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  if not found or v_job.status <> 'running' then
    raise exception 'AI generation job is not running.';
  end if;

  if v_job.locked_by is distinct from p_worker_id then
    raise exception 'AI generation job lease is not held by this worker.'
      using errcode = '42501';
  end if;

  update public.ai_generation_jobs
  set status = case when p_retry then 'queued' else 'failed' end,
      error = p_error,
      failure_code = p_failure_code,
      failure_detail = coalesce(p_failure_detail, '{}'::jsonb),
      locked_at = null,
      locked_by = null,
      heartbeat_at = now(),
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
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_status public.content_status;
  v_job public.ai_generation_jobs%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  select *
  into v_job
  from public.ai_generation_jobs
  where id = p_job_id
  for update;

  if not found or v_job.status <> 'running' then
    raise exception 'AI generation job is not running.';
  end if;

  if v_job.locked_by is distinct from p_worker_id then
    raise exception 'AI generation job lease is not held by this worker.'
      using errcode = '42501';
  end if;

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
end;
$$;

revoke execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.fail_ai_generation_job(uuid, text, text, jsonb, boolean) from public, anon, authenticated, service_role;

revoke execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) to service_role;

revoke execute on function public.complete_ai_generation_job(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_ai_generation_job(uuid, text, text, text, jsonb, text) to service_role;

revoke execute on function public.fail_ai_generation_job(uuid, text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.fail_ai_generation_job(uuid, text, text, text, jsonb, boolean) to service_role;

revoke execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text) to service_role;

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
    'p_job_id uuid, p_entity_id text, p_course_row jsonb, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb',
    'INTERNAL_HELPER',
    'Fenced AI generation worker RPC only.',
    'Unfenced implementation helper retained for the fenced wrapper. No API role may execute it directly.',
    array[]::text[]
  ),
  (
    'public',
    'replace_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb',
    'INTERNAL_HELPER',
    'Fenced AI generation worker RPC only.',
    'Unfenced implementation helper retained for the fenced wrapper. No API role may execute it directly.',
    array[]::text[]
  ),
  (
    'public',
    'fail_ai_generation_job',
    'p_job_id uuid, p_error text, p_failure_code text, p_failure_detail jsonb, p_retry boolean',
    'INTERNAL_HELPER',
    'Fenced AI generation worker RPC only.',
    'Unfenced implementation helper retained only for signature compatibility during migration history replay. No API role may execute it directly.',
    array[]::text[]
  ),
  (
    'public',
    'materialize_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_row jsonb, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb, p_worker_id text',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Transactionally materializes generated course text rows and marks the job completed only when the caller supplies the worker id that currently holds the lease. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'complete_ai_generation_job',
    'p_job_id uuid, p_worker_id text, p_entity_id text, p_status text, p_result jsonb, p_error text',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Marks non-materialization AI generation jobs completed or failed only when the caller supplies the worker id that currently holds the lease. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'fail_ai_generation_job',
    'p_job_id uuid, p_worker_id text, p_error text, p_failure_code text, p_failure_detail jsonb, p_retry boolean',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Marks a running AI generation job failed or requeued only when the caller supplies the worker id that currently holds the lease. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'replace_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb, p_worker_id text',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Transactionally replaces generated course text rows and marks the job completed only when the caller supplies the worker id that currently holds the lease. No client role may execute it.',
    array['service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
