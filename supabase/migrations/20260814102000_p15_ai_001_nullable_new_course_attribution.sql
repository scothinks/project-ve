create or replace function public.create_organization_ai_generation_job(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_job_type text,
  p_prompt jsonb,
  p_entity_id text,
  p_idempotency_key text,
  p_operation_type text,
  p_estimated_units numeric,
  p_estimated_provider_cost numeric default null,
  p_programme_id uuid default null,
  p_course_id text default null,
  p_lesson_id text default null,
  p_assessment_id uuid default null,
  p_mission_id text default null,
  p_status text default 'queued'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_job_id uuid := gen_random_uuid();
  v_existing_job public.ai_generation_jobs%rowtype;
  v_record public.organization_ai_usage_records%rowtype;
  v_course_id text := nullif(coalesce(p_course_id, p_entity_id), '');
begin
  if auth.uid() is null
     or auth.uid() <> p_actor_user_id
     or not (
       public.current_user_is_admin()
       or public.current_user_can_manage_organization(p_organization_id)
     ) then
    raise exception 'You cannot create organization AI jobs.';
  end if;

  if p_job_type not in ('course_text', 'media_assets') then
    raise exception 'Unsupported AI generation job type.';
  end if;

  if p_status not in ('queued', 'running') then
    raise exception 'Unsupported AI generation job status.';
  end if;

  if v_course_id is not null
     and not exists (select 1 from public.courses where id = v_course_id) then
    v_course_id := null;
  end if;

  select *
    into v_existing_job
  from public.ai_generation_jobs
  where idempotency_key = p_idempotency_key
    and status in ('queued', 'running')
  order by created_at asc
  limit 1;

  if v_existing_job.id is not null then
    return jsonb_build_object(
      'jobId', v_existing_job.id,
      'usageRecordId', v_existing_job.organization_ai_usage_record_id,
      'existing', true
    );
  end if;

  v_record := private.reserve_organization_ai_usage_unchecked(
    p_organization_id,
    p_actor_user_id,
    'ai_generation_job',
    v_job_id::text,
    'ai_generation_job:' || p_idempotency_key,
    p_operation_type,
    p_estimated_units,
    p_estimated_provider_cost,
    p_programme_id,
    v_course_id,
    p_lesson_id,
    p_assessment_id,
    p_mission_id,
    jsonb_build_object('jobType', p_job_type)
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
    organization_id,
    programme_id,
    course_id,
    lesson_id,
    assessment_id,
    mission_id,
    operation_type,
    organization_ai_usage_record_id,
    source_entitlement,
    estimated_units,
    reserved_units
  )
  values (
    v_job_id,
    'course',
    nullif(p_entity_id, ''),
    p_job_type,
    p_status,
    coalesce(p_prompt, '{}'::jsonb),
    '{}'::jsonb,
    p_actor_user_id,
    p_idempotency_key,
    p_organization_id,
    p_programme_id,
    v_course_id,
    p_lesson_id,
    p_assessment_id,
    p_mission_id,
    p_operation_type,
    v_record.id,
    v_record.source_entitlement,
    p_estimated_units,
    p_estimated_units
  );

  return jsonb_build_object(
    'jobId', v_job_id,
    'usageRecordId', v_record.id,
    'existing', false
  );
end;
$$;

revoke execute on function public.create_organization_ai_generation_job(
  uuid, uuid, text, jsonb, text, text, text, numeric, numeric, uuid, text, text, uuid, text, text
) from public, anon;
grant execute on function public.create_organization_ai_generation_job(
  uuid, uuid, text, jsonb, text, text, text, numeric, numeric, uuid, text, text, uuid, text, text
) to authenticated, service_role;
