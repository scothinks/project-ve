alter table public.ai_generation_jobs
  drop constraint if exists ai_generation_jobs_status_check;

alter table public.ai_generation_jobs
  alter column status set default 'queued',
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists failure_code text,
  add column if not exists failure_detail jsonb not null default '{}'::jsonb,
  add column if not exists idempotency_key text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

update public.ai_generation_jobs
set status = 'queued'
where status = 'pending';

alter table public.ai_generation_jobs
  add constraint ai_generation_jobs_status_check
    check (status in ('queued', 'running', 'completed', 'failed'));

create unique index if not exists ai_generation_jobs_idempotency_key_idx
  on public.ai_generation_jobs (idempotency_key)
  where idempotency_key is not null;

create index if not exists ai_generation_jobs_queue_idx
  on public.ai_generation_jobs (status, available_at, created_at)
  where status in ('queued', 'running');

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
  attempt_count integer
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
            j.locked_at is null
            or j.locked_at < now() - make_interval(secs => p_lease_seconds)
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
        started_at = coalesce(j.started_at, now()),
        error = null,
        failure_code = null,
        failure_detail = '{}'::jsonb
    from candidate
    where j.id = candidate.id
    returning j.id, j.entity_type, j.entity_id, j.job_type, j.prompt, j.attempt_count
  )
  select claimed.id,
         claimed.entity_type,
         claimed.entity_id,
         claimed.job_type,
         claimed.prompt,
         claimed.attempt_count
  from claimed;
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
  p_job_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.ai_generation_jobs
    where id = p_job_id
      and status = 'running'
  ) then
    raise exception 'AI generation job is not running.';
  end if;

  if p_course_row is not null and jsonb_typeof(p_course_row) = 'object' then
    insert into public.courses (
      id,
      slug,
      title,
      description,
      category,
      level,
      thumbnail,
      status,
      sort_order,
      estimated_minutes,
      ai_text_status,
      ai_media_status,
      ai_publish_status,
      ai_generated,
      ai_generation_notes
    )
    select id,
           slug,
           title,
           description,
           category,
           level,
           coalesce(thumbnail, '{}'::jsonb),
           status,
           sort_order,
           estimated_minutes,
           ai_text_status,
           ai_media_status,
           ai_publish_status,
           ai_generated,
           coalesce(ai_generation_notes, '{}'::jsonb)
    from jsonb_to_record(p_course_row) as course_row (
      id text,
      slug text,
      title text,
      description text,
      category text,
      level public.course_level,
      thumbnail jsonb,
      status public.content_status,
      sort_order integer,
      estimated_minutes integer,
      ai_text_status text,
      ai_media_status text,
      ai_publish_status text,
      ai_generated boolean,
      ai_generation_notes jsonb
    );
  end if;

  if p_course_update is not null and jsonb_typeof(p_course_update) = 'object' then
    update public.courses
    set ai_generated = coalesce((p_course_update ->> 'ai_generated')::boolean, ai_generated),
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

    if not found then
      raise exception 'Course not found for AI generation job.';
    end if;
  end if;

  if jsonb_array_length(coalesce(p_lesson_rows, '[]'::jsonb)) > 0 then
    insert into public.lessons (
      id,
      course_id,
      slug,
      title,
      description,
      cover_image,
      status,
      sort_order,
      estimated_minutes,
      retry_mode,
      retry_cooldown_seconds,
      retry_requires_reread,
      quiz_requires_lesson_completion,
      max_earning_attempts,
      ai_text_status,
      ai_media_status,
      ai_publish_status,
      ai_generated,
      ai_generation_notes
    )
    select id,
           course_id,
           slug,
           title,
           description,
           coalesce(cover_image, '{}'::jsonb),
           status,
           sort_order,
           estimated_minutes,
           retry_mode,
           retry_cooldown_seconds,
           retry_requires_reread,
           quiz_requires_lesson_completion,
           max_earning_attempts,
           ai_text_status,
           ai_media_status,
           ai_publish_status,
           ai_generated,
           coalesce(ai_generation_notes, '{}'::jsonb)
    from jsonb_to_recordset(p_lesson_rows) as lesson_row (
      id text,
      course_id text,
      slug text,
      title text,
      description text,
      cover_image jsonb,
      status public.content_status,
      sort_order integer,
      estimated_minutes integer,
      retry_mode public.lesson_retry_mode,
      retry_cooldown_seconds integer,
      retry_requires_reread boolean,
      quiz_requires_lesson_completion boolean,
      max_earning_attempts integer,
      ai_text_status text,
      ai_media_status text,
      ai_publish_status text,
      ai_generated boolean,
      ai_generation_notes jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_page_rows, '[]'::jsonb)) > 0 then
    insert into public.lesson_pages (
      id,
      lesson_id,
      page_number,
      title,
      subtitle,
      page_type,
      cover_image
    )
    select id,
           lesson_id,
           page_number,
           title,
           subtitle,
           page_type,
           coalesce(cover_image, '{}'::jsonb)
    from jsonb_to_recordset(p_page_rows) as page_row (
      id text,
      lesson_id text,
      page_number integer,
      title text,
      subtitle text,
      page_type public.lesson_page_type,
      cover_image jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_block_rows, '[]'::jsonb)) > 0 then
    insert into public.lesson_content_blocks (
      id,
      page_id,
      block_type,
      sort_order,
      payload
    )
    select id,
           page_id,
           block_type,
           sort_order,
           coalesce(payload, '{}'::jsonb)
    from jsonb_to_recordset(p_block_rows) as block_row (
      id uuid,
      page_id text,
      block_type public.lesson_content_block_type,
      sort_order integer,
      payload jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_quiz_rows, '[]'::jsonb)) > 0 then
    insert into public.quizzes (
      id,
      lesson_id,
      title,
      version,
      status,
      ai_text_status,
      ai_generated,
      ai_generation_notes
    )
    select id,
           lesson_id,
           title,
           version,
           status,
           ai_text_status,
           ai_generated,
           coalesce(ai_generation_notes, '{}'::jsonb)
    from jsonb_to_recordset(p_quiz_rows) as quiz_row (
      id text,
      lesson_id text,
      title text,
      version integer,
      status public.content_status,
      ai_text_status text,
      ai_generated boolean,
      ai_generation_notes jsonb
    );
  end if;

  if jsonb_array_length(coalesce(p_question_rows, '[]'::jsonb)) > 0 then
    insert into public.quiz_questions (
      id,
      quiz_id,
      question_order,
      question_type,
      prompt,
      explanation,
      xp
    )
    select id,
           quiz_id,
           question_order,
           question_type,
           prompt,
           explanation,
           xp
    from jsonb_to_recordset(p_question_rows) as question_row (
      id text,
      quiz_id text,
      question_order integer,
      question_type public.quiz_question_type,
      prompt text,
      explanation text,
      xp integer
    );
  end if;

  if jsonb_array_length(coalesce(p_option_rows, '[]'::jsonb)) > 0 then
    insert into public.quiz_options (
      id,
      question_id,
      option_order,
      label,
      is_correct
    )
    select id,
           question_id,
           option_order,
           label,
           is_correct
    from jsonb_to_recordset(p_option_rows) as option_row (
      id text,
      question_id text,
      option_order integer,
      label text,
      is_correct boolean
    );
  end if;

  if jsonb_array_length(coalesce(p_media_rows, '[]'::jsonb)) > 0 then
    insert into public.learning_media_assets (
      course_id,
      lesson_id,
      asset_type,
      placement,
      source,
      prompt,
      script,
      url,
      storage_path,
      provider,
      model,
      alt_text,
      caption,
      metadata,
      review_status,
      generation_status,
      generation_error,
      sort_order
    )
    select course_id,
           lesson_id,
           asset_type,
           placement,
           source,
           prompt,
           script,
           url,
           storage_path,
           provider,
           model,
           alt_text,
           caption,
           coalesce(metadata, '{}'::jsonb),
           review_status,
           generation_status,
           generation_error,
           sort_order
    from jsonb_to_recordset(p_media_rows) as media_row (
      course_id text,
      lesson_id text,
      asset_type text,
      placement text,
      source text,
      prompt text,
      script text,
      url text,
      storage_path text,
      provider text,
      model text,
      alt_text text,
      caption text,
      metadata jsonb,
      review_status text,
      generation_status text,
      generation_error text,
      sort_order integer
    );
  end if;

  update public.ai_generation_jobs
  set entity_id = p_entity_id,
      status = 'completed',
      result = coalesce(p_job_result, '{}'::jsonb),
      error = null,
      failure_code = null,
      failure_detail = '{}'::jsonb,
      locked_at = null,
      locked_by = null,
      heartbeat_at = now(),
      completed_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.fail_ai_generation_job(
  p_job_id uuid,
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
begin
  update public.ai_generation_jobs
  set status = case when p_retry then 'queued' else 'failed' end,
      error = p_error,
      failure_code = p_failure_code,
      failure_detail = coalesce(p_failure_detail, '{}'::jsonb),
      locked_at = null,
      locked_by = null,
      heartbeat_at = now(),
      available_at = case when p_retry then now() + interval '5 minutes' else available_at end
  where id = p_job_id
    and status = 'running';
end;
$$;

revoke execute on function public.claim_ai_generation_job(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_generation_job(text, integer, integer) to service_role;

revoke execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.materialize_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

revoke execute on function public.fail_ai_generation_job(uuid, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.fail_ai_generation_job(uuid, text, text, jsonb, boolean) to service_role;

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
    'claim_ai_generation_job',
    'p_worker_id text, p_lease_seconds integer, p_max_attempts integer',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Claims one queued or stale AI generation job with FOR UPDATE SKIP LOCKED. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'materialize_ai_course_text_job',
    'p_job_id uuid, p_entity_id text, p_course_row jsonb, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Transactionally materializes generated course text rows and marks the job completed. No client role may execute it.',
    array['service_role']
  ),
  (
    'public',
    'fail_ai_generation_job',
    'p_job_id uuid, p_error text, p_failure_code text, p_failure_detail jsonb, p_retry boolean',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Marks a running AI generation job failed or requeued after a worker failure. No client role may execute it.',
    array['service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
