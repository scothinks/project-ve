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
  p_job_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_status public.content_status;
begin
  if not exists (
    select 1
    from public.ai_generation_jobs
    where id = p_job_id
      and status = 'running'
  ) then
    raise exception 'AI generation job is not running.';
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

revoke execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_ai_course_text_job(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values (
  'public',
  'replace_ai_course_text_job',
  'p_job_id uuid, p_entity_id text, p_course_update jsonb, p_lesson_rows jsonb, p_page_rows jsonb, p_block_rows jsonb, p_quiz_rows jsonb, p_question_rows jsonb, p_option_rows jsonb, p_media_rows jsonb, p_job_result jsonb',
  'SERVICE_ROLE_ONLY',
  'AI generation worker endpoint using the service role.',
  'Transactionally replaces generated course text rows for an unpublished AI course and marks the job completed. No client role may execute it.',
  array['service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
