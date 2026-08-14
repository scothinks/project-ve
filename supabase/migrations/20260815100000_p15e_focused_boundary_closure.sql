create or replace function private.organization_unit_member_has_active_org_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role_key
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.role = p_role
      and membership.status = 'active'
  );
$$;

revoke execute on function private.organization_unit_member_has_active_org_membership(
  uuid, uuid, public.organization_role_key
) from public, anon, authenticated, service_role;

create or replace function public.current_user_can_supervise_organization_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select public.current_user_is_admin()
    or exists (
      select 1
      from public.organization_unit_members member
      join public.organization_units unit
        on unit.id = member.unit_id
      where member.unit_id = p_unit_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and unit.status <> 'archived'
        and member.role in (
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'instructor',
          'report_viewer'
        )
        and private.organization_unit_member_has_active_org_membership(
          member.organization_id,
          member.user_id,
          member.role
        )
    );
$$;

create or replace function public.current_user_can_read_organization_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.organization_units unit
    where unit.id = p_unit_id
      and (
        public.current_user_can_read_organization_audience(unit.organization_id)
        or exists (
          select 1
          from public.organization_unit_members member
          where member.unit_id = unit.id
            and member.user_id = auth.uid()
            and member.status = 'active'
            and private.organization_unit_member_has_active_org_membership(
              member.organization_id,
              member.user_id,
              member.role
            )
        )
      )
  );
$$;

create or replace function public.current_user_can_read_unit_learner(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select public.current_user_can_read_organization_audience(p_organization_id)
    or exists (
      select 1
      from public.organization_unit_members supervisor
      join public.organization_unit_members learner
        on learner.unit_id = supervisor.unit_id
       and learner.organization_id = supervisor.organization_id
       and learner.user_id = p_user_id
       and learner.role = 'learner'
       and learner.status = 'active'
      where supervisor.organization_id = p_organization_id
        and supervisor.user_id = auth.uid()
        and supervisor.status = 'active'
        and supervisor.role in (
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'instructor',
          'report_viewer'
        )
        and private.organization_unit_member_has_active_org_membership(
          supervisor.organization_id,
          supervisor.user_id,
          supervisor.role
        )
        and private.organization_unit_member_has_active_org_membership(
          learner.organization_id,
          learner.user_id,
          learner.role
        )
    );
$$;

create or replace function public.current_user_can_act_on_scoped_learner(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select public.current_user_can_manage_organization_audience(p_organization_id)
    or exists (
      select 1
      from public.organization_unit_members supervisor
      join public.organization_unit_members learner
        on learner.unit_id = supervisor.unit_id
       and learner.organization_id = supervisor.organization_id
       and learner.user_id = p_user_id
       and learner.role = 'learner'
       and learner.status = 'active'
      where supervisor.organization_id = p_organization_id
        and supervisor.user_id = auth.uid()
        and supervisor.status = 'active'
        and supervisor.role in ('instructor', 'organisation_owner', 'organisation_admin', 'programme_manager')
        and private.organization_unit_member_has_active_org_membership(
          supervisor.organization_id,
          supervisor.user_id,
          supervisor.role
        )
        and private.organization_unit_member_has_active_org_membership(
          learner.organization_id,
          learner.user_id,
          learner.role
        )
    );
$$;

create or replace function public.current_user_can_read_instructor_workspace_audience(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_manage_organization_audience(p_organization_id)
    or public.current_user_has_organization_role(
      p_organization_id,
      array['reviewer', 'report_viewer']::public.organization_role_key[]
    );
$$;

revoke execute on function public.current_user_can_supervise_organization_unit(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_supervise_organization_unit(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_organization_unit(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_organization_unit(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_unit_learner(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_unit_learner(uuid, uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_act_on_scoped_learner(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_act_on_scoped_learner(uuid, uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_instructor_workspace_audience(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_instructor_workspace_audience(uuid) to authenticated, service_role;

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
  if p_organization_id is null then
    raise exception 'Organization is required for organization AI usage.';
  end if;

  perform 1
  from public.organizations
  where id = p_organization_id
  for update;

  if not found then
    raise exception 'Organization not found.';
  end if;

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
  v_allocation numeric;
  v_cap numeric;
  v_used numeric;
  v_user_limit numeric;
  v_user_count integer;
  v_concurrency_limit numeric;
  v_reserved_count integer;
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
    and actor_user_id = p_job.created_by
    and operation_type = p_job.operation_type
    and status = 'reserved';

  if v_usage.id is null then
    return false;
  end if;

  v_entitlements := private.resolve_organization_entitlements_unchecked(p_job.organization_id);
  v_allocation := private.organization_ai_entitlement_allocation(v_entitlements);
  v_cap := private.organization_ai_effective_cap(v_entitlements);

  if coalesce((v_entitlements ->> 'ai_authoring_enabled')::boolean, false) is not true
     or v_allocation <= 0
     or v_cap <= 0 then
    return false;
  end if;

  if v_entitlements ? 'allowed_ai_operation_types'
     and jsonb_typeof(v_entitlements -> 'allowed_ai_operation_types') = 'array'
     and jsonb_array_length(v_entitlements -> 'allowed_ai_operation_types') > 0
     and not private.jsonb_text_array_contains(v_entitlements -> 'allowed_ai_operation_types', p_job.operation_type) then
    return false;
  end if;

  if not private.actor_has_allowed_ai_role(
    p_job.organization_id,
    p_job.created_by,
    v_entitlements -> 'allowed_ai_roles'
  ) then
    return false;
  end if;

  v_user_limit := private.organization_entitlement_number(v_entitlements, 'ai_user_rate_limit_per_day');
  if v_user_limit > 0 then
    select count(*)::integer
      into v_user_count
    from public.organization_ai_usage_records usage
    where usage.organization_id = p_job.organization_id
      and usage.actor_user_id = p_job.created_by
      and usage.created_at >= date_trunc('day', now())
      and usage.status in ('reserved', 'charged')
      and usage.id <> v_usage.id;

    if v_user_count >= v_user_limit then
      return false;
    end if;
  end if;

  v_concurrency_limit := private.organization_entitlement_number(v_entitlements, 'ai_organization_concurrency_limit');
  if v_concurrency_limit > 0 then
    select count(*)::integer
      into v_reserved_count
    from public.organization_ai_usage_records usage
    where usage.organization_id = p_job.organization_id
      and usage.status = 'reserved'
      and usage.id <> v_usage.id;

    if v_reserved_count >= v_concurrency_limit then
      return false;
    end if;
  end if;

  v_used := private.organization_ai_reserved_or_charged_units(p_job.organization_id);
  if v_usage.created_at >= private.organization_ai_month_start() then
    v_used := greatest(0, v_used - v_usage.reserved_units);
  end if;

  if v_used + v_usage.reserved_units > v_cap then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

revoke execute on function private.organization_ai_job_can_run(public.ai_generation_jobs)
  from public, anon, authenticated, service_role;

create or replace function public.admin_get_instructor_workspace(
  p_organization_id uuid,
  p_unit_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 250);
  v_can_read_all boolean := false;
  v_can_act_all boolean := false;
  v_units jsonb := '[]'::jsonb;
  v_cohorts jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_inactive jsonb := '[]'::jsonb;
  v_overdue jsonb := '[]'::jsonb;
  v_proofs jsonb := '[]'::jsonb;
  v_interventions jsonb := '[]'::jsonb;
  v_reminder_targets jsonb := '[]'::jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organisation is required.';
  end if;

  if not exists(select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organisation not found.';
  end if;

  v_can_read_all := public.current_user_can_read_instructor_workspace_audience(p_organization_id);
  v_can_act_all := public.current_user_can_manage_organization_audience(p_organization_id);

  if not (
    v_can_read_all
    or exists (
      select 1
      from public.organization_unit_members member
      where member.organization_id = p_organization_id
        and member.user_id = v_actor_id
        and member.status = 'active'
        and member.role in ('instructor', 'report_viewer')
        and private.organization_unit_member_has_active_org_membership(
          member.organization_id,
          member.user_id,
          member.role
        )
    )
  ) then
    raise exception 'Instructor workspace access required.' using errcode = '42501';
  end if;

  if p_unit_id is not null and not exists (
    select 1
    from public.organization_units unit
    where unit.id = p_unit_id
      and unit.organization_id = p_organization_id
      and (
        v_can_read_all
        or public.current_user_can_supervise_organization_unit(unit.id)
      )
  ) then
    raise exception 'Instructor workspace access required.' using errcode = '42501';
  end if;

  create temporary table if not exists pg_temp.instructor_workspace_units (
    unit_id uuid primary key
  ) on commit drop;

  create temporary table if not exists pg_temp.instructor_workspace_cohorts (
    cohort_id uuid primary key
  ) on commit drop;

  create temporary table if not exists pg_temp.instructor_workspace_enrolments (
    id uuid primary key,
    organization_id uuid,
    user_id uuid,
    course_id text,
    programme_id uuid,
    due_at timestamptz,
    status public.lms_participation_status,
    started_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz,
    metadata jsonb
  ) on commit drop;

  truncate table
    pg_temp.instructor_workspace_units,
    pg_temp.instructor_workspace_cohorts,
    pg_temp.instructor_workspace_enrolments;

  insert into pg_temp.instructor_workspace_units (unit_id)
  select unit.id
  from public.organization_units unit
  where unit.organization_id = p_organization_id
    and unit.status <> 'archived'
    and (p_unit_id is null or unit.id = p_unit_id)
    and (
      v_can_read_all
      or public.current_user_can_supervise_organization_unit(unit.id)
    );

  insert into pg_temp.instructor_workspace_cohorts (cohort_id)
  select distinct cohort.id
  from public.cohorts cohort
  where cohort.organization_id = p_organization_id
    and (
      v_can_read_all and p_unit_id is null
      or exists (
        select 1
        from public.cohort_units cohort_unit
        join pg_temp.instructor_workspace_units scoped_unit
          on scoped_unit.unit_id = cohort_unit.unit_id
        where cohort_unit.cohort_id = cohort.id
      )
    );

  insert into pg_temp.instructor_workspace_enrolments (
    id,
    organization_id,
    user_id,
    course_id,
    programme_id,
    due_at,
    status,
    started_at,
    completed_at,
    updated_at,
    metadata
  )
  select distinct
    enrolment.id,
    enrolment.organization_id,
    enrolment.user_id,
    enrolment.course_id,
    enrolment.programme_id,
    enrolment.due_at,
    enrolment.status,
    enrolment.started_at,
    enrolment.completed_at,
    enrolment.updated_at,
    enrolment.metadata
  from public.enrolments enrolment
  where enrolment.organization_id = p_organization_id
    and (
      v_can_read_all and p_unit_id is null
      or exists (
        select 1
        from pg_temp.instructor_workspace_cohorts scoped_cohort
        where enrolment.metadata ->> 'cohortId' = scoped_cohort.cohort_id::text
      )
      or exists (
        select 1
        from public.organization_unit_members unit_member
        join pg_temp.instructor_workspace_units scoped_unit
          on scoped_unit.unit_id = unit_member.unit_id
        where unit_member.organization_id = enrolment.organization_id
          and unit_member.user_id = enrolment.user_id
          and unit_member.role = 'learner'
          and unit_member.status = 'active'
          and private.organization_unit_member_has_active_org_membership(
            unit_member.organization_id,
            unit_member.user_id,
            unit_member.role
          )
      )
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', unit.id,
      'name', unit.name,
      'unitType', unit.unit_type,
      'parentUnitId', unit.parent_unit_id
    )
    order by unit.name
  ), '[]'::jsonb)
    into v_units
  from public.organization_units unit
  join pg_temp.instructor_workspace_units scoped_unit
    on scoped_unit.unit_id = unit.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', cohort.id,
      'title', cohort.title,
      'status', cohort.status,
      'startsAt', cohort.starts_at,
      'endsAt', cohort.ends_at,
      'activeMembers', coalesce(member_counts.active_members, 0),
      'assignedLearners', coalesce(enrolment_counts.assigned_learners, 0),
      'units', coalesce(unit_labels.units, '[]'::jsonb)
    )
    order by cohort.title
  ), '[]'::jsonb)
    into v_cohorts
  from public.cohorts cohort
  join pg_temp.instructor_workspace_cohorts scoped_cohort
    on scoped_cohort.cohort_id = cohort.id
  left join lateral (
    select count(*)::integer as active_members
    from public.cohort_members member
    where member.cohort_id = cohort.id
      and member.status = 'active'
  ) member_counts on true
  left join lateral (
    select count(distinct enrolment.user_id)::integer as assigned_learners
    from pg_temp.instructor_workspace_enrolments enrolment
    where enrolment.metadata ->> 'cohortId' = cohort.id::text
  ) enrolment_counts on true
  left join lateral (
    select coalesce(jsonb_agg(
      jsonb_build_object('id', unit.id, 'name', unit.name, 'unitType', unit.unit_type)
      order by unit.name
    ), '[]'::jsonb) as units
    from public.cohort_units cohort_unit
    join public.organization_units unit
      on unit.id = cohort_unit.unit_id
    where cohort_unit.cohort_id = cohort.id
  ) unit_labels on true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', learner.user_id,
      'displayName', profile.display_name,
      'cohorts', learner.cohorts,
      'assignedCount', learner.assigned_count,
      'completedCount', learner.completed_count,
      'overdueCount', learner.overdue_count,
      'averageProgress', learner.average_progress,
      'lastActivityAt', learner.last_activity_at
    )
    order by learner.last_activity_at desc nulls last, profile.display_name asc nulls last
  ), '[]'::jsonb)
    into v_learners
  from (
    select
      enrolment.user_id,
      count(distinct enrolment.id)::integer as assigned_count,
      count(distinct enrolment.id) filter (
        where enrolment.status = 'completed'
          or course_completion.status = 'completed'
          or programme_completion.status = 'completed'
      )::integer as completed_count,
      count(distinct enrolment.id) filter (
        where enrolment.status = 'active'
          and enrolment.due_at is not null
          and enrolment.due_at < now()
          and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
      )::integer as overdue_count,
      coalesce(round(avg(coalesce(course_completion.progress_percent, programme_completion.progress_percent, 0)))::integer, 0) as average_progress,
      coalesce(max(enrolment.updated_at), max(course_completion.evaluated_at), max(programme_completion.evaluated_at)) as last_activity_at,
      coalesce(cohort_labels.cohorts, '[]'::jsonb) as cohorts
    from pg_temp.instructor_workspace_enrolments enrolment
    left join public.course_completions course_completion
      on course_completion.user_id = enrolment.user_id
     and course_completion.course_id = enrolment.course_id
    left join public.programme_completions programme_completion
      on programme_completion.user_id = enrolment.user_id
     and programme_completion.programme_id = enrolment.programme_id
    left join lateral (
      select coalesce(jsonb_agg(distinct jsonb_build_object('id', cohort.id, 'title', cohort.title)), '[]'::jsonb) as cohorts
      from public.cohorts cohort
      where exists (
        select 1
        from pg_temp.instructor_workspace_enrolments cohort_enrolment
        where cohort_enrolment.user_id = enrolment.user_id
          and cohort_enrolment.metadata ->> 'cohortId' = cohort.id::text
      )
    ) cohort_labels on true
    group by enrolment.user_id, cohort_labels.cohorts
    limit v_limit
  ) learner
  join public.profiles profile
    on profile.id = learner.user_id;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.last_activity_at asc nulls first), '[]'::jsonb)
    into v_inactive
  from (
    select
      learner_row ->> 'userId' as "userId",
      learner_row ->> 'displayName' as "displayName",
      nullif(learner_row ->> 'lastActivityAt', '') as last_activity_at,
      (learner_row ->> 'averageProgress')::integer as "averageProgress"
    from jsonb_array_elements(v_learners) learner_row
    where learner_row ->> 'lastActivityAt' is null
      or (learner_row ->> 'lastActivityAt')::timestamptz < now() - interval '14 days'
    limit v_limit
  ) row_data;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', enrolment.user_id,
      'displayName', profile.display_name,
      'programmeId', enrolment.programme_id,
      'courseId', enrolment.course_id,
      'dueAt', enrolment.due_at,
      'cohortId', enrolment.metadata ->> 'cohortId'
    )
    order by enrolment.due_at asc
  ), '[]'::jsonb)
    into v_overdue
  from pg_temp.instructor_workspace_enrolments enrolment
  join public.profiles profile
    on profile.id = enrolment.user_id
  left join public.course_completions course_completion
    on course_completion.user_id = enrolment.user_id
   and course_completion.course_id = enrolment.course_id
  left join public.programme_completions programme_completion
    on programme_completion.user_id = enrolment.user_id
   and programme_completion.programme_id = enrolment.programme_id
  where enrolment.status = 'active'
    and enrolment.due_at is not null
    and enrolment.due_at < now()
    and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
  limit v_limit;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', proof.user_id,
      'displayName', profile.display_name,
      'missionId', proof.mission_id,
      'missionTitle', mission.title,
      'awardScope', proof.award_scope,
      'organizationId', proof.organization_id,
      'programmeId', proof.programme_id,
      'programmeMissionId', proof.programme_mission_id,
      'proofType', proof.proof_type,
      'value', proof.value,
      'status', proof.status,
      'createdAt', proof.created_at
    )
    order by proof.created_at desc
  ), '[]'::jsonb)
    into v_proofs
  from public.mission_proofs proof
  join public.profiles profile
    on profile.id = proof.user_id
  left join public.missions mission
    on mission.id = proof.mission_id
  where proof.organization_id = p_organization_id
    and proof.status = 'submitted'
    and exists (
      select 1
      from pg_temp.instructor_workspace_enrolments enrolment
      where enrolment.user_id = proof.user_id
    )
  limit v_limit;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', intervention.id,
      'userId', intervention.user_id,
      'displayName', profile.display_name,
      'programmeId', intervention.programme_id,
      'programmeTitle', programme.title,
      'cohortId', intervention.cohort_id,
      'type', intervention.intervention_type,
      'status', intervention.status,
      'severity', intervention.severity,
      'reason', intervention.reason,
      'dueAt', intervention.due_at,
      'lastActivityAt', intervention.last_activity_at,
      'triggeredAt', intervention.triggered_at
    )
    order by case intervention.severity when 'critical' then 1 when 'warning' then 2 else 3 end,
             intervention.triggered_at desc
  ), '[]'::jsonb)
    into v_interventions
  from public.lms_interventions intervention
  join public.profiles profile
    on profile.id = intervention.user_id
  join public.programmes programme
    on programme.id = intervention.programme_id
  where intervention.organization_id = p_organization_id
    and intervention.status in ('open', 'acknowledged')
    and exists (
      select 1
      from pg_temp.instructor_workspace_enrolments enrolment
      where enrolment.user_id = intervention.user_id
    )
  limit v_limit;

  select coalesce(jsonb_agg(distinct target), '[]'::jsonb)
    into v_reminder_targets
  from (
    select jsonb_build_object(
      'userId', row_data ->> 'userId',
      'displayName', row_data ->> 'displayName',
      'reason', 'inactive'
    ) as target
    from jsonb_array_elements(v_inactive) row_data
    union all
    select jsonb_build_object(
      'userId', row_data ->> 'userId',
      'displayName', row_data ->> 'displayName',
      'reason', 'overdue'
    ) as target
    from jsonb_array_elements(v_overdue) row_data
  ) targets;

  return jsonb_build_object(
    'organizationId', p_organization_id,
    'unitId', p_unit_id,
    'canAct', v_can_act_all or exists (
      select 1
      from public.organization_unit_members member
      where member.organization_id = p_organization_id
        and member.user_id = v_actor_id
        and member.status = 'active'
        and member.role = 'instructor'
        and private.organization_unit_member_has_active_org_membership(
          member.organization_id,
          member.user_id,
          member.role
        )
    ),
    'readOnly', not (v_can_act_all or exists (
      select 1
      from public.organization_unit_members member
      where member.organization_id = p_organization_id
        and member.user_id = v_actor_id
        and member.status = 'active'
        and member.role = 'instructor'
        and private.organization_unit_member_has_active_org_membership(
          member.organization_id,
          member.user_id,
          member.role
        )
    )),
    'units', v_units,
    'cohorts', v_cohorts,
    'learners', v_learners,
    'inactiveLearners', v_inactive,
    'overdueLearners', v_overdue,
    'missionEvidence', v_proofs,
    'openInterventions', v_interventions,
    'reminderTargets', v_reminder_targets,
    'generatedAt', now()
  );
end;
$$;

revoke execute on function public.admin_get_instructor_workspace(uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_instructor_workspace(uuid, uuid, integer) to authenticated, service_role;

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
    'current_user_can_read_instructor_workspace_audience',
    'p_organization_id uuid',
    'ADMIN_AUTHENTICATED',
    'Instructor workspace application and RPC authorization checks.',
    'Uses auth.uid(); permits platform admins and active organisation owner/admin/programme_manager/reviewer/report_viewer roles, deliberately excluding content_editor.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_get_instructor_workspace',
    'p_organization_id uuid, p_unit_id uuid, p_limit integer',
    'ADMIN_AUTHENTICATED',
    'Instructor and supervisor workspace aggregate data.',
    'Requires auth.uid(); broad workspace read is limited to instructor-workspace roles while assignment-scoped instructor/report_viewer access also requires active organisation membership and active unit assignment.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
