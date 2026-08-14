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
  v_usage public.organization_ai_usage_records%rowtype;
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

  v_usage := private.reconcile_organization_ai_usage_for_job(
    v_job,
    'completed',
    coalesce(p_job_result, '{}'::jsonb),
    null,
    null,
    false
  );

  update public.ai_generation_jobs
  set lock_token = null,
      course_id = coalesce(course_id, p_entity_id),
      actual_provider_model = v_usage.actual_provider_model,
      actual_provider_usage = coalesce(v_usage.actual_provider_usage, '{}'::jsonb),
      actual_provider_cost = v_usage.actual_provider_cost,
      actual_internal_cost = v_usage.actual_internal_cost,
      final_charged_units = v_usage.final_charged_units,
      reconciliation_status = coalesce(v_usage.reconciliation_status, reconciliation_status),
      failed_job_charge_policy = v_usage.failed_job_charge_policy
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
  v_usage public.organization_ai_usage_records%rowtype;
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

  v_usage := private.reconcile_organization_ai_usage_for_job(
    v_job,
    'completed',
    coalesce(p_job_result, '{}'::jsonb),
    null,
    null,
    false
  );

  update public.ai_generation_jobs
  set lock_token = null,
      course_id = coalesce(course_id, p_entity_id),
      actual_provider_model = v_usage.actual_provider_model,
      actual_provider_usage = coalesce(v_usage.actual_provider_usage, '{}'::jsonb),
      actual_provider_cost = v_usage.actual_provider_cost,
      actual_internal_cost = v_usage.actual_internal_cost,
      final_charged_units = v_usage.final_charged_units,
      reconciliation_status = coalesce(v_usage.reconciliation_status, reconciliation_status),
      failed_job_charge_policy = v_usage.failed_job_charge_policy
  where id = p_job_id;
end;
$$;

revoke execute on function public.materialize_ai_course_text_job(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer
) from public, anon, authenticated;
grant execute on function public.materialize_ai_course_text_job(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer
) to service_role;

revoke execute on function public.replace_ai_course_text_job(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer
) from public, anon, authenticated;
grant execute on function public.replace_ai_course_text_job(
  uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, integer
) to service_role;
