create or replace function public.current_user_can_manage_organization_audience(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.current_user_has_organization_role(
      p_organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager'
      ]::public.organization_role_key[]
    );
$$;

create or replace function public.current_user_can_read_organization_audience(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_manage_organization_audience(p_organization_id)
    or public.current_user_has_organization_role(
      p_organization_id,
      array['content_editor', 'reviewer', 'report_viewer']::public.organization_role_key[]
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
set search_path = public
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
set search_path = public
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
    );
$$;

revoke execute on function public.current_user_can_act_on_scoped_learner(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_act_on_scoped_learner(uuid, uuid) to authenticated, service_role;

create or replace function public.current_user_can_read_cohort(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cohorts cohort
    where cohort.id = p_cohort_id
      and (
        public.current_user_can_read_organization_audience(cohort.organization_id)
        or exists (
          select 1
          from public.cohort_members member
          where member.cohort_id = cohort.id
            and member.user_id = auth.uid()
            and member.status = 'active'
        )
        or exists (
          select 1
          from public.cohort_units cohort_unit
          where cohort_unit.cohort_id = cohort.id
            and public.current_user_can_supervise_organization_unit(cohort_unit.unit_id)
        )
      )
  );
$$;

create or replace function public.admin_get_instructor_workspace(
  p_organization_id uuid,
  p_unit_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  v_can_read_all := public.current_user_can_read_organization_audience(p_organization_id);
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
    ),
    'readOnly', not (v_can_act_all or exists (
      select 1
      from public.organization_unit_members member
      where member.organization_id = p_organization_id
        and member.user_id = v_actor_id
        and member.status = 'active'
        and member.role = 'instructor'
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

create or replace function public.admin_create_instructor_intervention(
  p_organization_id uuid,
  p_user_id uuid,
  p_programme_id uuid,
  p_cohort_id uuid,
  p_intervention_type public.lms_intervention_type,
  p_severity public.lms_intervention_severity,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_enrolment public.enrolments%rowtype;
  v_intervention public.lms_interventions%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if v_reason = '' then
    raise exception 'Intervention reason is required.';
  end if;

  if not public.current_user_can_act_on_scoped_learner(p_organization_id, p_user_id) then
    raise exception 'Scoped instructor access required.' using errcode = '42501';
  end if;

  select *
    into v_enrolment
  from public.enrolments enrolment
  where enrolment.organization_id = p_organization_id
    and enrolment.user_id = p_user_id
    and (p_programme_id is null or enrolment.programme_id = p_programme_id or enrolment.metadata ->> 'programmeId' = p_programme_id::text)
    and (p_cohort_id is null or enrolment.metadata ->> 'cohortId' = p_cohort_id::text)
  order by enrolment.updated_at desc
  limit 1;

  if not found then
    raise exception 'Scoped enrolment not found.';
  end if;

  insert into public.lms_interventions (
    organization_id,
    programme_id,
    cohort_id,
    user_id,
    enrolment_id,
    intervention_type,
    status,
    severity,
    reason,
    due_at,
    last_activity_at,
    metadata
  )
  values (
    p_organization_id,
    coalesce(p_programme_id, v_enrolment.programme_id, (v_enrolment.metadata ->> 'programmeId')::uuid),
    p_cohort_id,
    p_user_id,
    v_enrolment.id,
    p_intervention_type,
    'open',
    p_severity,
    v_reason,
    v_enrolment.due_at,
    v_enrolment.updated_at,
    jsonb_build_object('createdByInstructorWorkspace', true, 'createdBy', v_actor_id)
  )
  on conflict (enrolment_id, intervention_type)
    where enrolment_id is not null and status in ('open', 'acknowledged')
  do update
    set status = 'open',
        severity = excluded.severity,
        reason = excluded.reason,
        due_at = excluded.due_at,
        last_activity_at = excluded.last_activity_at,
        metadata = public.lms_interventions.metadata || excluded.metadata,
        updated_at = now()
  returning *
    into v_intervention;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'lms_intervention_created',
    'lms_intervention',
    v_intervention.id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'userId', p_user_id,
      'programmeId', v_intervention.programme_id,
      'cohortId', p_cohort_id,
      'type', p_intervention_type,
      'severity', p_severity
    )
  );

  return to_jsonb(v_intervention);
end;
$$;

create or replace function public.admin_send_instructor_scoped_notification(
  p_organization_id uuid,
  p_unit_id uuid default null,
  p_user_ids uuid[] default '{}'::uuid[],
  p_title text default 'Reminder from your instructor',
  p_body text default 'Please check your assigned learning.',
  p_cta_href text default '/notifications'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_created_count integer := 0;
  v_notification_id uuid;
  v_user_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if v_title = '' or v_body = '' then
    raise exception 'Notification title and body are required.';
  end if;

  create temporary table if not exists pg_temp.instructor_notification_targets (
    user_id uuid primary key
  ) on commit drop;

  truncate table pg_temp.instructor_notification_targets;

  insert into pg_temp.instructor_notification_targets (user_id)
  select distinct selected_user_id
  from unnest(coalesce(p_user_ids, '{}'::uuid[])) as selected_user_id
  where selected_user_id is not null;

  if not exists(select 1 from pg_temp.instructor_notification_targets) then
    raise exception 'At least one learner is required.';
  end if;

  if exists (
    select 1
    from pg_temp.instructor_notification_targets target
    where not public.current_user_can_act_on_scoped_learner(p_organization_id, target.user_id)
  ) then
    raise exception 'Scoped instructor access required.' using errcode = '42501';
  end if;

  if p_unit_id is not null and not (
    public.current_user_can_read_organization_audience(p_organization_id)
    or public.current_user_can_supervise_organization_unit(p_unit_id)
  ) then
    raise exception 'Scoped instructor access required.' using errcode = '42501';
  end if;

  for v_user_id in
    select target.user_id
    from pg_temp.instructor_notification_targets target
  loop
    select private.queue_user_notification(
      v_user_id,
      'system',
      'instructor_scoped_reminder',
      v_title,
      v_body,
      coalesce(nullif(trim(coalesce(p_cta_href, '')), ''), '/notifications'),
      'Open',
      jsonb_build_object('organizationId', p_organization_id, 'unitId', p_unit_id, 'sentBy', v_actor_id),
      null
    )
      into v_notification_id;

    if v_notification_id is not null then
      v_created_count := v_created_count + 1;
    end if;
  end loop;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'instructor_scoped_notification_sent',
    'user_notification',
    p_organization_id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'unitId', p_unit_id,
      'targetCount', (select count(*) from pg_temp.instructor_notification_targets),
      'createdCount', v_created_count
    )
  );

  return jsonb_build_object('createdCount', v_created_count);
end;
$$;

create or replace function public.admin_update_lms_intervention_status(
  p_intervention_id uuid,
  p_status public.lms_intervention_status,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_intervention public.lms_interventions%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select *
    into v_intervention
  from public.lms_interventions
  where id = p_intervention_id;

  if not found then
    raise exception 'Intervention not found.';
  end if;

  if not public.current_user_can_act_on_scoped_learner(v_intervention.organization_id, v_intervention.user_id) then
    raise exception 'Scoped instructor access required.' using errcode = '42501';
  end if;

  update public.lms_interventions
  set status = p_status,
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
      resolved_by = case when p_status in ('resolved', 'dismissed') then v_actor_id else null end,
      metadata = metadata || jsonb_build_object(
        'lastActionBy', v_actor_id,
        'lastActionAt', now(),
        'lastActionNote', nullif(trim(coalesce(p_note, '')), '')
      )
  where id = p_intervention_id
  returning *
    into v_intervention;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'lms_intervention_status_updated',
    'lms_intervention',
    p_intervention_id::text,
    jsonb_build_object('status', p_status, 'note', nullif(trim(coalesce(p_note, '')), ''))
  );

  return to_jsonb(v_intervention);
end;
$$;

create or replace function public.admin_review_mission_proof_submission(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_status public.review_status,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_required_fields text[];
  v_valid boolean := false;
  v_requirement_mode text := 'all';
  v_organization_id uuid;
  v_programme_id uuid;
  v_programme_mission_id text;
begin
  if v_actor_id is null then
    raise exception 'Only an admin can review mission proof.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected.';
  end if;

  select organization_id, programme_id, programme_mission_id
    into v_organization_id, v_programme_id, v_programme_mission_id
  from public.mission_proofs
  where user_id = p_user_id
    and mission_id = p_mission_id
    and award_scope = p_award_scope
  order by created_at asc
  limit 1;

  if not found then
    raise exception 'Mission proof submission was not found.';
  end if;

  if v_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Only a platform admin can review public mission proof.';
    end if;
  elsif not (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(
      v_organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'reviewer'
      ]::public.organization_role_key[]
    )
    or public.current_user_can_act_on_scoped_learner(v_organization_id, p_user_id)
  ) then
    raise exception 'Only organization proof reviewers can review this mission proof.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found or v_mission.validation_type <> 'proof_upload' then
    raise exception 'Mission proof submission was not found.';
  end if;

  update public.mission_proofs
  set status = p_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '') else null end,
      updated_at = now()
  where user_id = p_user_id
    and mission_id = p_mission_id
    and award_scope = p_award_scope;

  if not found then
    raise exception 'Mission proof submission was not found.';
  end if;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_proof_' || p_status::text,
    'mission_proof',
    p_user_id::text || ':' || p_mission_id || ':' || p_award_scope,
    jsonb_build_object(
      'userId', p_user_id,
      'missionId', p_mission_id,
      'awardScope', p_award_scope,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id,
      'rejectionReason', p_rejection_reason
    )
  );

  if p_status = 'rejected' then
    return jsonb_build_object('status', 'rejected');
  end if;

  select array_agg(value::text)
    into v_required_fields
    from jsonb_array_elements_text(
      coalesce(v_mission.validation_config -> 'requiredProofFields', '[]'::jsonb)
    ) as value;

  v_requirement_mode := coalesce(v_mission.validation_config ->> 'proofRequirementMode', 'all');

  select public.mission_proof_fields_satisfy(
    coalesce(v_required_fields, '{}'::text[]),
    coalesce(
      array_agg(proof.proof_type order by proof.proof_type)
        filter (where proof.status = 'approved'),
      '{}'::text[]
    ),
    v_requirement_mode
  )
    into v_valid
  from public.mission_proofs proof
  where proof.user_id = p_user_id
    and proof.mission_id = p_mission_id
    and proof.award_scope = p_award_scope;

  if not v_valid then
    return jsonb_build_object('status', 'approved', 'award', 'pending_more_proof');
  end if;

  return public.award_valid_mission_xp(p_user_id, p_mission_id, p_award_scope);
end;
$$;

revoke execute on function public.admin_get_instructor_workspace(uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_instructor_workspace(uuid, uuid, integer) to authenticated, service_role;

revoke execute on function public.admin_create_instructor_intervention(uuid, uuid, uuid, uuid, public.lms_intervention_type, public.lms_intervention_severity, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_instructor_intervention(uuid, uuid, uuid, uuid, public.lms_intervention_type, public.lms_intervention_severity, text) to authenticated, service_role;

revoke execute on function public.admin_send_instructor_scoped_notification(uuid, uuid, uuid[], text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_send_instructor_scoped_notification(uuid, uuid, uuid[], text, text, text) to authenticated, service_role;

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
    'current_user_can_act_on_scoped_learner',
    'p_organization_id uuid, p_user_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and instructor operations checking whether the caller may act on a learner through organisation management or shared unit supervision.',
    'Uses auth.uid(); allows platform/org audience managers or active instructor unit members sharing a unit with the learner.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_get_instructor_workspace',
    'p_organization_id uuid, p_unit_id uuid, p_limit integer',
    'ADMIN_AUTHENTICATED',
    'Instructor, supervisor, report viewer, reviewer and programme manager workspace composition.',
    'Requires auth.uid(); managers and read roles can read organisation-scoped workspace data while instructors/report viewers without broad roles are restricted to units they supervise.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_create_instructor_intervention',
    'p_organization_id uuid, p_user_id uuid, p_programme_id uuid, p_cohort_id uuid, p_intervention_type lms_intervention_type, p_severity lms_intervention_severity, p_reason text',
    'ADMIN_AUTHENTICATED',
    'Scoped instructor intervention creation.',
    'Requires auth.uid() and current_user_can_act_on_scoped_learner for the target learner before inserting or updating an LMS intervention row.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_send_instructor_scoped_notification',
    'p_organization_id uuid, p_unit_id uuid, p_user_ids uuid[], p_title text, p_body text, p_cta_href text',
    'ADMIN_AUTHENTICATED',
    'Scoped instructor announcements and reminders.',
    'Requires auth.uid() and current_user_can_act_on_scoped_learner for every target learner, then queues notifications through the private canonical notification primitive.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();

update private.rpc_security_classifications
set authorization_rule = 'Allows platform admins or active organisation_owner, organisation_admin or programme_manager memberships for the requested organization id; instructors are handled through unit-scoped instructor operations.',
    reviewed_at = now()
where function_schema = 'public'
  and function_name = 'current_user_can_manage_organization_audience'
  and identity_arguments = 'p_organization_id uuid';

update private.rpc_security_classifications
set authorization_rule = 'Allows platform admins, organisation audience managers, content editors, reviewers or report viewers for the requested organization id; instructors are handled through unit-scoped instructor operations.',
    reviewed_at = now()
where function_schema = 'public'
  and function_name = 'current_user_can_read_organization_audience'
  and identity_arguments = 'p_organization_id uuid';
