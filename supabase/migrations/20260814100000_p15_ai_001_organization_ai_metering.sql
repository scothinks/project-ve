alter table public.ai_generation_jobs
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists programme_id uuid,
  add column if not exists course_id text references public.courses(id) on delete set null,
  add column if not exists lesson_id text references public.lessons(id) on delete set null,
  add column if not exists assessment_id uuid,
  add column if not exists mission_id text,
  add column if not exists operation_type text,
  add column if not exists organization_ai_usage_record_id uuid,
  add column if not exists source_entitlement jsonb not null default '{}'::jsonb,
  add column if not exists estimated_units numeric not null default 0 check (estimated_units >= 0),
  add column if not exists reserved_units numeric not null default 0 check (reserved_units >= 0),
  add column if not exists actual_provider_model text,
  add column if not exists actual_provider_usage jsonb not null default '{}'::jsonb,
  add column if not exists actual_provider_cost numeric check (actual_provider_cost is null or actual_provider_cost >= 0),
  add column if not exists actual_internal_cost numeric check (actual_internal_cost is null or actual_internal_cost >= 0),
  add column if not exists final_charged_units numeric check (final_charged_units is null or final_charged_units >= 0),
  add column if not exists reconciliation_status text not null default 'not_required',
  add column if not exists failed_job_charge_policy text;

create table if not exists public.organization_ai_usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  source_type text not null check (source_type in ('ai_generation_job', 'ai_course_plan')),
  source_id text not null,
  idempotency_key text not null,
  operation_type text not null check (length(trim(operation_type)) > 0),
  programme_id uuid,
  course_id text references public.courses(id) on delete set null,
  lesson_id text references public.lessons(id) on delete set null,
  assessment_id uuid,
  mission_id text,
  status text not null default 'reserved' check (status in ('reserved', 'released', 'charged')),
  source_entitlement jsonb not null default '{}'::jsonb,
  estimated_units numeric not null check (estimated_units >= 0),
  reserved_units numeric not null check (reserved_units >= 0),
  actual_provider_model text,
  actual_provider_usage jsonb not null default '{}'::jsonb,
  estimated_provider_cost numeric check (estimated_provider_cost is null or estimated_provider_cost >= 0),
  actual_provider_cost numeric check (actual_provider_cost is null or actual_provider_cost >= 0),
  actual_internal_cost numeric check (actual_internal_cost is null or actual_internal_cost >= 0),
  final_charged_units numeric check (final_charged_units is null or final_charged_units >= 0),
  reconciliation_status text not null default 'reserved'
    check (reconciliation_status in ('reserved', 'released', 'charged_estimate', 'charged_actual', 'adjusted', 'blocked')),
  provider_started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failed_job_charge_policy text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

alter table public.ai_generation_jobs
  drop constraint if exists ai_generation_jobs_organization_ai_usage_record_id_fkey,
  add constraint ai_generation_jobs_organization_ai_usage_record_id_fkey
    foreign key (organization_ai_usage_record_id)
    references public.organization_ai_usage_records(id)
    on delete set null;

create index if not exists organization_ai_usage_records_org_created_idx
  on public.organization_ai_usage_records(organization_id, created_at desc);

create index if not exists organization_ai_usage_records_active_idx
  on public.organization_ai_usage_records(organization_id, status, created_at desc)
  where status = 'reserved';

create index if not exists organization_ai_usage_records_actor_day_idx
  on public.organization_ai_usage_records(organization_id, actor_user_id, created_at desc);

create index if not exists ai_generation_jobs_org_status_idx
  on public.ai_generation_jobs(organization_id, status, created_at desc)
  where organization_id is not null;

drop trigger if exists organization_ai_usage_records_set_updated_at
  on public.organization_ai_usage_records;
create trigger organization_ai_usage_records_set_updated_at
  before update on public.organization_ai_usage_records
  for each row execute function public.set_updated_at();

alter table public.organization_ai_usage_records enable row level security;

drop policy if exists "Organization AI usage records are readable by organization managers"
  on public.organization_ai_usage_records;
create policy "Organization AI usage records are readable by organization managers"
  on public.organization_ai_usage_records for select
  using (
    public.current_user_is_admin()
    or public.current_user_can_manage_organization(organization_id)
  );

revoke all on public.organization_ai_usage_records from anon, authenticated;
grant select on public.organization_ai_usage_records to authenticated;
grant all on public.organization_ai_usage_records to service_role;

create or replace function private.current_request_is_service_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

revoke execute on function private.current_request_is_service_role()
  from public, anon, authenticated, service_role;

create or replace function private.organization_ai_entitlement_allocation(p_entitlements jsonb)
returns numeric
language sql
immutable
set search_path = public, private
as $$
  select
    private.organization_entitlement_number(p_entitlements, 'ai_monthly_allocation')
    + private.organization_entitlement_number(p_entitlements, 'ai_temporary_allocation')
    + private.organization_entitlement_number(p_entitlements, 'ai_top_up_allocation');
$$;

revoke execute on function private.organization_ai_entitlement_allocation(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.organization_ai_effective_cap(p_entitlements jsonb)
returns numeric
language plpgsql
immutable
set search_path = public, private
as $$
declare
  v_allocation numeric := private.organization_ai_entitlement_allocation(p_entitlements);
  v_hard_limit numeric := private.organization_entitlement_number(p_entitlements, 'ai_hard_limit');
begin
  if v_hard_limit > 0 then
    return least(v_allocation, v_hard_limit);
  end if;

  return v_allocation;
end;
$$;

revoke execute on function private.organization_ai_effective_cap(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.jsonb_text_array_contains(
  p_values jsonb,
  p_value text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_values, '[]'::jsonb)) as item(value)
    where item.value = p_value
  );
$$;

revoke execute on function private.jsonb_text_array_contains(jsonb, text)
  from public, anon, authenticated, service_role;

create or replace function private.actor_has_allowed_ai_role(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_allowed_roles jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_allowed_roles is null
     or jsonb_typeof(p_allowed_roles) <> 'array'
     or jsonb_array_length(p_allowed_roles) = 0 then
    return true;
  end if;

  if exists (
    select 1
    from public.profiles
    where id = p_actor_user_id
      and role = 'admin'
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.organization_memberships membership
    join jsonb_array_elements_text(p_allowed_roles) allowed(role)
      on allowed.role = membership.role::text
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_user_id
      and membership.status = 'active'
  );
end;
$$;

revoke execute on function private.actor_has_allowed_ai_role(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.organization_ai_month_start()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('month', now());
$$;

create or replace function private.organization_ai_reserved_or_charged_units(p_organization_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case usage.status
      when 'reserved' then usage.reserved_units
      when 'charged' then coalesce(usage.final_charged_units, usage.reserved_units)
      else 0
    end
  ), 0)
  from public.organization_ai_usage_records usage
  where usage.organization_id = p_organization_id
    and usage.created_at >= private.organization_ai_month_start()
    and usage.status in ('reserved', 'charged');
$$;

revoke execute on function private.organization_ai_reserved_or_charged_units(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.validate_organization_ai_reservation(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_operation_type text,
  p_estimated_units numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_entitlements jsonb;
  v_allocation numeric;
  v_cap numeric;
  v_used numeric;
  v_user_limit numeric;
  v_user_count integer;
  v_concurrency_limit numeric;
  v_reserved_count integer;
begin
  if p_organization_id is null then
    raise exception 'Organization is required for organization AI usage.';
  end if;

  if p_actor_user_id is null then
    raise exception 'Actor user is required for organization AI usage.';
  end if;

  if trim(coalesce(p_operation_type, '')) = '' then
    raise exception 'AI operation type is required.';
  end if;

  if p_estimated_units is null or p_estimated_units <= 0 then
    raise exception 'AI usage estimate must be greater than zero.';
  end if;

  v_entitlements := private.resolve_organization_entitlements_unchecked(p_organization_id);
  v_allocation := private.organization_ai_entitlement_allocation(v_entitlements);
  v_cap := private.organization_ai_effective_cap(v_entitlements);

  if coalesce((v_entitlements ->> 'ai_authoring_enabled')::boolean, false) is not true
     or v_allocation <= 0
     or v_cap <= 0 then
    raise exception 'Organization AI access is not enabled with an active allocation.';
  end if;

  if v_entitlements ? 'allowed_ai_operation_types'
     and jsonb_typeof(v_entitlements -> 'allowed_ai_operation_types') = 'array'
     and jsonb_array_length(v_entitlements -> 'allowed_ai_operation_types') > 0
     and not private.jsonb_text_array_contains(v_entitlements -> 'allowed_ai_operation_types', p_operation_type) then
    raise exception 'AI operation is not allowed for this organization.';
  end if;

  if not private.actor_has_allowed_ai_role(
    p_organization_id,
    p_actor_user_id,
    v_entitlements -> 'allowed_ai_roles'
  ) then
    raise exception 'Actor role is not allowed to use organization AI.';
  end if;

  v_user_limit := private.organization_entitlement_number(v_entitlements, 'ai_user_rate_limit_per_day');
  if v_user_limit > 0 then
    select count(*)::integer
      into v_user_count
    from public.organization_ai_usage_records usage
    where usage.organization_id = p_organization_id
      and usage.actor_user_id = p_actor_user_id
      and usage.created_at >= date_trunc('day', now())
      and usage.status in ('reserved', 'charged');

    if v_user_count >= v_user_limit then
      raise exception 'User AI rate limit has been reached for this organization.';
    end if;
  end if;

  v_concurrency_limit := private.organization_entitlement_number(v_entitlements, 'ai_organization_concurrency_limit');
  if v_concurrency_limit > 0 then
    select count(*)::integer
      into v_reserved_count
    from public.organization_ai_usage_records usage
    where usage.organization_id = p_organization_id
      and usage.status = 'reserved';

    if v_reserved_count >= v_concurrency_limit then
      raise exception 'Organization AI concurrency limit has been reached.';
    end if;
  end if;

  v_used := private.organization_ai_reserved_or_charged_units(p_organization_id);
  if v_used + p_estimated_units > v_cap then
    raise exception 'Organization AI hard limit would be exceeded.';
  end if;

  return jsonb_build_object(
    'entitlements', v_entitlements,
    'allocation', v_allocation,
    'hardCap', v_cap,
    'usedOrReserved', v_used,
    'remaining', greatest(0, v_cap - v_used)
  );
end;
$$;

revoke execute on function private.validate_organization_ai_reservation(uuid, uuid, text, numeric)
  from public, anon, authenticated, service_role;

create or replace function private.reserve_organization_ai_usage_unchecked(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_operation_type text,
  p_estimated_units numeric,
  p_estimated_provider_cost numeric default null,
  p_programme_id uuid default null,
  p_course_id text default null,
  p_lesson_id text default null,
  p_assessment_id uuid default null,
  p_mission_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.organization_ai_usage_records
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_existing public.organization_ai_usage_records%rowtype;
  v_validation jsonb;
  v_record public.organization_ai_usage_records%rowtype;
begin
  select *
    into v_existing
  from public.organization_ai_usage_records
  where idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    return v_existing;
  end if;

  v_validation := private.validate_organization_ai_reservation(
    p_organization_id,
    p_actor_user_id,
    p_operation_type,
    p_estimated_units
  );

  insert into public.organization_ai_usage_records (
    organization_id,
    actor_user_id,
    source_type,
    source_id,
    idempotency_key,
    operation_type,
    programme_id,
    course_id,
    lesson_id,
    assessment_id,
    mission_id,
    source_entitlement,
    estimated_units,
    reserved_units,
    estimated_provider_cost,
    metadata
  )
  values (
    p_organization_id,
    p_actor_user_id,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    p_operation_type,
    p_programme_id,
    p_course_id,
    p_lesson_id,
    p_assessment_id,
    p_mission_id,
    v_validation,
    p_estimated_units,
    p_estimated_units,
    p_estimated_provider_cost,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_record;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    p_actor_user_id,
    'organization_ai_usage_reserved',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'usageRecordId', v_record.id,
      'sourceType', p_source_type,
      'sourceId', p_source_id,
      'operationType', p_operation_type,
      'estimatedUnits', p_estimated_units,
      'courseId', p_course_id,
      'lessonId', p_lesson_id,
      'remainingBeforeReservation', v_validation -> 'remaining'
    )
  );

  return v_record;
end;
$$;

revoke execute on function private.reserve_organization_ai_usage_unchecked(
  uuid, uuid, text, text, text, text, numeric, numeric, uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.reserve_organization_ai_usage(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_operation_type text,
  p_estimated_units numeric,
  p_estimated_provider_cost numeric default null,
  p_programme_id uuid default null,
  p_course_id text default null,
  p_lesson_id text default null,
  p_assessment_id uuid default null,
  p_mission_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_record public.organization_ai_usage_records%rowtype;
begin
  if auth.uid() is null
     or auth.uid() <> p_actor_user_id
     or not (
       public.current_user_is_admin()
       or public.current_user_can_manage_organization(p_organization_id)
     ) then
    raise exception 'You cannot reserve organization AI usage.';
  end if;

  v_record := private.reserve_organization_ai_usage_unchecked(
    p_organization_id,
    p_actor_user_id,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    p_operation_type,
    p_estimated_units,
    p_estimated_provider_cost,
    p_programme_id,
    p_course_id,
    p_lesson_id,
    p_assessment_id,
    p_mission_id,
    p_metadata
  );

  return jsonb_build_object(
    'usageRecordId', v_record.id,
    'status', v_record.status,
    'reservedUnits', v_record.reserved_units,
    'sourceEntitlement', v_record.source_entitlement
  );
end;
$$;

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
    coalesce(p_course_id, p_entity_id),
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
    p_entity_id,
    p_job_type,
    p_status,
    coalesce(p_prompt, '{}'::jsonb),
    '{}'::jsonb,
    p_actor_user_id,
    p_idempotency_key,
    p_organization_id,
    p_programme_id,
    coalesce(p_course_id, p_entity_id),
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

create or replace function private.organization_ai_job_can_run(p_job public.ai_generation_jobs)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_entitlements jsonb;
  v_usage public.organization_ai_usage_records%rowtype;
begin
  if p_job.organization_id is null then
    return true;
  end if;

  if p_job.organization_ai_usage_record_id is null then
    return false;
  end if;

  select *
    into v_usage
  from public.organization_ai_usage_records
  where id = p_job.organization_ai_usage_record_id
    and organization_id = p_job.organization_id
    and status = 'reserved';

  if v_usage.id is null then
    return false;
  end if;

  v_entitlements := private.resolve_organization_entitlements_unchecked(p_job.organization_id);

  if coalesce((v_entitlements ->> 'ai_authoring_enabled')::boolean, false) is not true
     or private.organization_ai_entitlement_allocation(v_entitlements) <= 0 then
    return false;
  end if;

  if v_entitlements ? 'allowed_ai_operation_types'
     and jsonb_typeof(v_entitlements -> 'allowed_ai_operation_types') = 'array'
     and jsonb_array_length(v_entitlements -> 'allowed_ai_operation_types') > 0
     and not private.jsonb_text_array_contains(v_entitlements -> 'allowed_ai_operation_types', p_job.operation_type) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

revoke execute on function private.organization_ai_job_can_run(public.ai_generation_jobs)
  from public, anon, authenticated, service_role;

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
set search_path = public, private
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'Worker id is required.';
  end if;

  if not private.current_request_is_service_role() then
    raise exception 'Only the AI worker may claim generation jobs.';
  end if;

  return query
  with candidate as (
    select j.id
    from public.ai_generation_jobs j
    where j.status in ('queued', 'running')
      and j.available_at <= now()
      and j.attempt_count < p_max_attempts
      and private.organization_ai_job_can_run(j)
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

create or replace function private.reconcile_organization_ai_usage_for_job(
  p_job public.ai_generation_jobs,
  p_status text,
  p_result jsonb,
  p_error text,
  p_failure_code text,
  p_retry boolean default false
)
returns public.organization_ai_usage_records
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  v_usage public.organization_ai_usage_records%rowtype;
  v_actual_units numeric;
  v_actual_provider_cost numeric;
  v_actual_internal_cost numeric;
  v_final_charged_units numeric;
  v_provider_model text;
  v_provider_usage jsonb;
  v_policy text;
  v_reconciliation_status text;
  v_status text;
begin
  if p_job.organization_ai_usage_record_id is null then
    return null;
  end if;

  select *
    into v_usage
  from public.organization_ai_usage_records
  where id = p_job.organization_ai_usage_record_id
  for update;

  if v_usage.id is null or v_usage.status <> 'reserved' then
    return v_usage;
  end if;

  v_provider_model := nullif(p_result ->> 'actualProviderModel', '');
  v_provider_usage := coalesce(p_result -> 'actualProviderUsage', '{}'::jsonb);
  v_actual_units := coalesce(nullif(p_result ->> 'actualUnits', '')::numeric, null);
  v_actual_provider_cost := coalesce(nullif(p_result ->> 'actualProviderCost', '')::numeric, null);
  v_actual_internal_cost := coalesce(nullif(p_result ->> 'actualInternalCost', '')::numeric, null);

  if p_retry then
    return v_usage;
  end if;

  if p_status = 'completed' then
    v_final_charged_units := coalesce(v_actual_units, v_usage.reserved_units);
    v_status := 'charged';
    v_policy := 'charge_actual_when_available_else_reserved_estimate';
    v_reconciliation_status := case
      when v_actual_units is null then 'charged_estimate'
      when v_actual_units = v_usage.reserved_units then 'charged_actual'
      else 'adjusted'
    end;
  elsif p_failure_code = 'validation_error' then
    v_final_charged_units := 0;
    v_status := 'released';
    v_policy := 'release_validation_failure_before_provider_work';
    v_reconciliation_status := 'released';
  else
    v_final_charged_units := v_usage.reserved_units;
    v_status := 'charged';
    v_policy := 'charge_reserved_estimate_after_worker_start';
    v_reconciliation_status := 'charged_estimate';
  end if;

  update public.organization_ai_usage_records
  set status = v_status,
      actual_provider_model = v_provider_model,
      actual_provider_usage = v_provider_usage,
      actual_provider_cost = v_actual_provider_cost,
      actual_internal_cost = coalesce(v_actual_internal_cost, v_final_charged_units),
      final_charged_units = v_final_charged_units,
      reconciliation_status = v_reconciliation_status,
      completed_at = now(),
      failure_code = p_failure_code,
      failed_job_charge_policy = v_policy,
      metadata = metadata || jsonb_build_object(
        'jobStatus', p_status,
        'jobError', p_error,
        'retry', p_retry
      )
  where id = v_usage.id
  returning * into v_usage;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_usage.actor_user_id,
    'organization_ai_usage_reconciled',
    'organization',
    v_usage.organization_id::text,
    jsonb_build_object(
      'usageRecordId', v_usage.id,
      'sourceType', v_usage.source_type,
      'sourceId', v_usage.source_id,
      'operationType', v_usage.operation_type,
      'status', v_usage.status,
      'reservedUnits', v_usage.reserved_units,
      'finalChargedUnits', v_usage.final_charged_units,
      'reconciliationStatus', v_usage.reconciliation_status,
      'failedJobChargePolicy', v_usage.failed_job_charge_policy
    )
  );

  return v_usage;
end;
$$;

revoke execute on function private.reconcile_organization_ai_usage_for_job(
  public.ai_generation_jobs, text, jsonb, text, text, boolean
) from public, anon, authenticated, service_role;

create or replace function public.reconcile_organization_ai_usage(
  p_usage_record_id uuid,
  p_status text,
  p_actual_provider_model text default null,
  p_actual_provider_usage jsonb default '{}'::jsonb,
  p_actual_provider_cost numeric default null,
  p_actual_internal_cost numeric default null,
  p_final_charged_units numeric default null,
  p_failure_code text default null,
  p_failed_job_charge_policy text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_usage public.organization_ai_usage_records%rowtype;
  v_actor_id uuid := auth.uid();
begin
  select *
    into v_usage
  from public.organization_ai_usage_records
  where id = p_usage_record_id
  for update;

  if v_usage.id is null then
    raise exception 'AI usage record does not exist.';
  end if;

  if not private.current_request_is_service_role()
     and (
       v_actor_id is null
       or v_actor_id is distinct from v_usage.actor_user_id
       or not (
         public.current_user_is_admin()
         or public.current_user_can_manage_organization(v_usage.organization_id)
       )
     ) then
    raise exception 'You cannot reconcile organization AI usage.';
  end if;

  if v_usage.status <> 'reserved' then
    return jsonb_build_object(
      'usageRecordId', v_usage.id,
      'status', v_usage.status,
      'finalChargedUnits', v_usage.final_charged_units,
      'reconciliationStatus', v_usage.reconciliation_status
    );
  end if;

  if p_status not in ('released', 'charged') then
    raise exception 'AI usage reconciliation status must be released or charged.';
  end if;

  update public.organization_ai_usage_records
  set status = p_status,
      actual_provider_model = nullif(trim(coalesce(p_actual_provider_model, '')), ''),
      actual_provider_usage = coalesce(p_actual_provider_usage, '{}'::jsonb),
      actual_provider_cost = p_actual_provider_cost,
      actual_internal_cost = p_actual_internal_cost,
      final_charged_units = case when p_status = 'released' then 0 else coalesce(p_final_charged_units, reserved_units) end,
      reconciliation_status = case
        when p_status = 'released' then 'released'
        when p_final_charged_units is null then 'charged_estimate'
        when p_final_charged_units = reserved_units then 'charged_actual'
        else 'adjusted'
      end,
      completed_at = now(),
      failure_code = p_failure_code,
      failed_job_charge_policy = p_failed_job_charge_policy,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = v_usage.id
  returning * into v_usage;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_usage.actor_user_id,
    'organization_ai_usage_reconciled',
    'organization',
    v_usage.organization_id::text,
    jsonb_build_object(
      'usageRecordId', v_usage.id,
      'sourceType', v_usage.source_type,
      'sourceId', v_usage.source_id,
      'operationType', v_usage.operation_type,
      'status', v_usage.status,
      'reservedUnits', v_usage.reserved_units,
      'finalChargedUnits', v_usage.final_charged_units,
      'reconciliationStatus', v_usage.reconciliation_status,
      'failedJobChargePolicy', v_usage.failed_job_charge_policy
    )
  );

  return jsonb_build_object(
    'usageRecordId', v_usage.id,
    'status', v_usage.status,
    'finalChargedUnits', v_usage.final_charged_units,
    'reconciliationStatus', v_usage.reconciliation_status
  );
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
  v_usage public.organization_ai_usage_records%rowtype;
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

  v_usage := private.reconcile_organization_ai_usage_for_job(
    v_job,
    p_status,
    coalesce(p_result, '{}'::jsonb),
    p_error,
    case when p_status = 'completed' then null else coalesce(v_job.failure_code, 'worker_failed') end,
    false
  );

  update public.ai_generation_jobs
  set entity_id = p_entity_id,
      course_id = coalesce(course_id, p_entity_id),
      status = p_status,
      result = coalesce(p_result, '{}'::jsonb),
      error = p_error,
      failure_code = case when p_status = 'completed' then null else failure_code end,
      failure_detail = case when p_status = 'completed' then '{}'::jsonb else failure_detail end,
      locked_at = null,
      locked_by = null,
      heartbeat_at = now(),
      lock_token = null,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
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

  v_usage := private.reconcile_organization_ai_usage_for_job(
    v_job,
    'failed',
    coalesce(p_failure_detail, '{}'::jsonb),
    p_error,
    coalesce(p_failure_code, 'worker_error'),
    p_retry
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
      available_at = case when p_retry then now() + interval '5 minutes' else available_at end,
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

revoke execute on function public.reserve_organization_ai_usage(
  uuid, uuid, text, text, text, text, numeric, numeric, uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.reserve_organization_ai_usage(
  uuid, uuid, text, text, text, text, numeric, numeric, uuid, text, text, uuid, text, jsonb
) to authenticated, service_role;

revoke execute on function public.reconcile_organization_ai_usage(
  uuid, text, text, jsonb, numeric, numeric, numeric, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_organization_ai_usage(
  uuid, text, text, jsonb, numeric, numeric, numeric, text, text, jsonb
) to authenticated, service_role;

revoke execute on function public.create_organization_ai_generation_job(
  uuid, uuid, text, jsonb, text, text, text, numeric, numeric, uuid, text, text, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_organization_ai_generation_job(
  uuid, uuid, text, jsonb, text, text, text, numeric, numeric, uuid, text, text, uuid, text, text
) to authenticated, service_role;

revoke execute on function public.claim_ai_generation_job(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_generation_job(text, integer, integer) to service_role;

revoke execute on function public.complete_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.complete_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, text)
  to service_role;

revoke execute on function public.fail_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_ai_generation_job(uuid, text, uuid, integer, text, text, jsonb, boolean)
  to service_role;

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
    'reserve_organization_ai_usage',
    'p_organization_id uuid, p_actor_user_id uuid, p_source_type text, p_source_id text, p_idempotency_key text, p_operation_type text, p_estimated_units numeric, p_estimated_provider_cost numeric, p_programme_id uuid, p_course_id text, p_lesson_id text, p_assessment_id uuid, p_mission_id text, p_metadata jsonb',
    'ADMIN_AUTHENTICATED',
    'Organisation admin AI planner and direct provider-call reservation workflow.',
    'Requires the current authenticated actor, platform admin or organisation manager access, effective AI entitlement, active allocation, operation allowlist, role allowance, per-user rate limit, organisation concurrency limit and hard cap.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'reconcile_organization_ai_usage',
    'p_usage_record_id uuid, p_status text, p_actual_provider_model text, p_actual_provider_usage jsonb, p_actual_provider_cost numeric, p_actual_internal_cost numeric, p_final_charged_units numeric, p_failure_code text, p_failed_job_charge_policy text, p_metadata jsonb',
    'ADMIN_AUTHENTICATED',
    'Organisation admin AI planner and service worker usage reconciliation workflow.',
    'Requires the original authenticated actor with organisation management access or service role; reserved records are released or charged once with audit history.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'create_organization_ai_generation_job',
    'p_organization_id uuid, p_actor_user_id uuid, p_job_type text, p_prompt jsonb, p_entity_id text, p_idempotency_key text, p_operation_type text, p_estimated_units numeric, p_estimated_provider_cost numeric, p_programme_id uuid, p_course_id text, p_lesson_id text, p_assessment_id uuid, p_mission_id text, p_status text',
    'ADMIN_AUTHENTICATED',
    'Organisation admin AI generation job enqueue workflow with idempotent reservation.',
    'Requires the current authenticated actor, platform admin or organisation manager access, effective AI entitlement, allocation and budget/rate/concurrency checks before queueing.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'claim_ai_generation_job',
    'p_worker_id text, p_lease_seconds integer, p_max_attempts integer',
    'SERVICE_ROLE_ONLY',
    'AI generation worker endpoint using the service role.',
    'Requires service_role and only claims organisation jobs whose reservation and effective AI entitlement remain valid.',
    array['service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
