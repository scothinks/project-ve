do $$ begin
  create type public.lms_intervention_type as enum (
    'upcoming_due',
    'overdue',
    'inactive'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lms_intervention_status as enum (
    'open',
    'acknowledged',
    'resolved',
    'dismissed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lms_intervention_severity as enum (
    'info',
    'warning',
    'critical'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.lms_interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enrolment_id uuid references public.enrolments(id) on delete set null,
  intervention_type public.lms_intervention_type not null,
  status public.lms_intervention_status not null default 'open',
  severity public.lms_intervention_severity not null default 'warning',
  reason text not null check (length(trim(reason)) > 0),
  due_at timestamptz,
  last_activity_at timestamptz,
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (status in ('resolved', 'dismissed') and resolved_at is not null)
    or (status in ('open', 'acknowledged') and resolved_at is null)
  )
);

create index if not exists lms_interventions_org_status_idx
  on public.lms_interventions(organization_id, status, triggered_at desc);

create index if not exists lms_interventions_programme_status_idx
  on public.lms_interventions(programme_id, status, triggered_at desc);

create index if not exists lms_interventions_user_status_idx
  on public.lms_interventions(user_id, status, triggered_at desc);

create unique index if not exists lms_interventions_active_enrolment_type_idx
  on public.lms_interventions(enrolment_id, intervention_type)
  where enrolment_id is not null
    and status in ('open', 'acknowledged');

drop trigger if exists lms_interventions_set_updated_at on public.lms_interventions;
create trigger lms_interventions_set_updated_at
  before update on public.lms_interventions
  for each row execute function public.set_updated_at();

alter table public.lms_interventions enable row level security;

drop policy if exists "LMS interventions readable by audience staff" on public.lms_interventions;
create policy "LMS interventions readable by audience staff"
  on public.lms_interventions for select
  using (
    public.current_user_is_admin()
    or public.current_user_can_read_organization_audience(organization_id)
  );

drop policy if exists "LMS interventions writable by audience managers" on public.lms_interventions;
create policy "LMS interventions writable by audience managers"
  on public.lms_interventions for all
  using (
    public.current_user_is_admin()
    or public.current_user_can_manage_organization_audience(organization_id)
  )
  with check (
    public.current_user_is_admin()
    or public.current_user_can_manage_organization_audience(organization_id)
  );

create or replace function public.queue_lms_programme_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes%rowtype;
  v_organization_name text := 'your organisation';
begin
  if new.programme_id is null or new.status <> 'active' then
    return new;
  end if;

  select *
    into v_programme
  from public.programmes
  where id = new.programme_id;

  if not found then
    return new;
  end if;

  select name
    into v_organization_name
  from public.organizations
  where id = new.organization_id;

  perform private.queue_user_notification(
    new.user_id,
    'system',
    'lms_programme_assigned',
    'Programme assigned',
    coalesce(v_organization_name, 'Your organisation') || ' assigned ' || v_programme.title || '.',
    '/profile/transcript',
    'View assignment',
    jsonb_build_object(
      'organizationId', new.organization_id,
      'programmeId', new.programme_id,
      'enrolmentId', new.id,
      'dueAt', new.due_at,
      'assignmentSource', new.assignment_source
    ),
    'lms-programme-assigned:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists enrolments_programme_assignment_notification on public.enrolments;
create trigger enrolments_programme_assignment_notification
  after insert on public.enrolments
  for each row
  when (new.programme_id is not null)
  execute function public.queue_lms_programme_assignment_notification();

create or replace function public.queue_lms_programme_completion_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme_title text;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new;
  end if;

  select title
    into v_programme_title
  from public.programmes
  where id = new.programme_id;

  perform private.queue_user_notification(
    new.user_id,
    'system',
    'lms_programme_completed',
    'Programme completed',
    'You completed ' || coalesce(v_programme_title, 'your programme') || '.',
    '/profile/transcript',
    'View transcript',
    jsonb_build_object(
      'organizationId', new.organization_id,
      'programmeId', new.programme_id,
      'completionId', new.id,
      'completedAt', new.completed_at
    ),
    'lms-programme-completed:' || new.id::text
  );

  update public.lms_interventions intervention
  set status = 'resolved',
      resolved_at = coalesce(new.completed_at, now()),
      metadata = intervention.metadata || jsonb_build_object('resolvedByCompletionId', new.id)
  where intervention.user_id = new.user_id
    and intervention.programme_id = new.programme_id
    and intervention.status in ('open', 'acknowledged');

  return new;
end;
$$;

drop trigger if exists programme_completions_completion_notification on public.programme_completions;
create trigger programme_completions_completion_notification
  after insert or update of status on public.programme_completions
  for each row
  when (new.status = 'completed')
  execute function public.queue_lms_programme_completion_notification();

create or replace function public.upsert_lms_intervention(
  p_organization_id uuid,
  p_programme_id uuid,
  p_cohort_id uuid,
  p_user_id uuid,
  p_enrolment_id uuid,
  p_intervention_type public.lms_intervention_type,
  p_severity public.lms_intervention_severity,
  p_reason text,
  p_due_at timestamptz,
  p_last_activity_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intervention_id uuid;
begin
  insert into public.lms_interventions (
    organization_id,
    programme_id,
    cohort_id,
    user_id,
    enrolment_id,
    intervention_type,
    severity,
    reason,
    due_at,
    last_activity_at,
    triggered_at,
    metadata
  )
  values (
    p_organization_id,
    p_programme_id,
    p_cohort_id,
    p_user_id,
    p_enrolment_id,
    p_intervention_type,
    p_severity,
    trim(p_reason),
    p_due_at,
    p_last_activity_at,
    now(),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (enrolment_id, intervention_type)
    where enrolment_id is not null
      and status in ('open', 'acknowledged')
  do update
    set cohort_id = excluded.cohort_id,
        severity = excluded.severity,
        reason = excluded.reason,
        due_at = excluded.due_at,
        last_activity_at = excluded.last_activity_at,
        triggered_at = excluded.triggered_at,
        metadata = public.lms_interventions.metadata || excluded.metadata
  returning id
    into v_intervention_id;

  return v_intervention_id;
end;
$$;

create or replace function public.generate_lms_programme_notifications(
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_count integer := 0;
  v_due_soon_count integer := 0;
  v_overdue_count integer := 0;
  v_inactive_count integer := 0;
  v_intervention_count integer := 0;
  v_notification_id uuid;
  v_intervention_id uuid;
  v_local_date text := to_char((coalesce(p_now, now()) at time zone 'Africa/Lagos')::date, 'YYYYMMDD');
  v_row record;
begin
  for v_row in
    select
      enrolment.id as enrolment_id,
      enrolment.organization_id,
      enrolment.user_id,
      enrolment.programme_id,
      enrolment.due_at,
      enrolment.assigned_at,
      programme.title as programme_title,
      organization.name as organization_name,
      (enrolment.metadata ->> 'cohortId')::uuid as cohort_id,
      activity.last_activity_at
    from public.enrolments enrolment
    join public.programmes programme
      on programme.id = enrolment.programme_id
    join public.organizations organization
      on organization.id = enrolment.organization_id
    left join public.programme_completions completion
      on completion.user_id = enrolment.user_id
     and completion.programme_id = enrolment.programme_id
     and completion.status = 'completed'
    left join lateral (
      select max(activity_at) as last_activity_at
      from (
        select max(greatest(coalesce(progress.updated_at, progress.started_at), progress.started_at)) as activity_at
        from public.lesson_progress progress
        join public.programme_courses programme_course
          on programme_course.programme_id = enrolment.programme_id
        join public.lessons lesson
          on lesson.id = progress.lesson_id
         and lesson.course_id = programme_course.course_id
        where progress.user_id = enrolment.user_id

        union all

        select max(completion.completed_at) as activity_at
        from public.lesson_page_completions completion
        join public.programme_courses programme_course
          on programme_course.programme_id = enrolment.programme_id
        join public.lessons lesson
          on lesson.id = completion.lesson_id
         and lesson.course_id = programme_course.course_id
        where completion.user_id = enrolment.user_id

        union all

        select max(coalesce(attempt.ended_at, attempt.started_at, attempt.created_at)) as activity_at
        from public.quiz_attempts attempt
        join public.quizzes quiz
          on quiz.id = attempt.quiz_id
        join public.lessons lesson
          on lesson.id = quiz.lesson_id
        join public.programme_courses programme_course
          on programme_course.programme_id = enrolment.programme_id
         and programme_course.course_id = lesson.course_id
        where attempt.user_id = enrolment.user_id

        union all

        select max(greatest(coalesce(course_completion.completed_at, course_completion.evaluated_at), course_completion.evaluated_at)) as activity_at
        from public.course_completions course_completion
        join public.programme_courses programme_course
          on programme_course.programme_id = enrolment.programme_id
         and programme_course.course_id = course_completion.course_id
        where course_completion.user_id = enrolment.user_id
      ) activity
    ) activity on true
    where enrolment.programme_id is not null
      and enrolment.status = 'active'
      and completion.id is null
  loop
    select private.queue_user_notification(
      v_row.user_id,
      'system',
      'lms_programme_assigned',
      'Programme assigned',
      coalesce(v_row.organization_name, 'Your organisation') || ' assigned ' || v_row.programme_title || '.',
      '/profile/transcript',
      'View assignment',
      jsonb_build_object(
        'organizationId', v_row.organization_id,
        'programmeId', v_row.programme_id,
        'enrolmentId', v_row.enrolment_id,
        'dueAt', v_row.due_at,
        'assignmentSource', 'programme'
      ),
      'lms-programme-assigned:' || v_row.enrolment_id::text
    )
    into v_notification_id;

    if v_notification_id is not null then
      v_assignment_count := v_assignment_count + 1;
    end if;

    if v_row.due_at is not null
      and v_row.due_at >= coalesce(p_now, now())
      and v_row.due_at < coalesce(p_now, now()) + interval '3 days'
    then
      select private.queue_user_notification(
        v_row.user_id,
        'system',
        'lms_programme_due_soon',
        'Programme due soon',
        v_row.programme_title || ' is due soon.',
        '/profile/transcript',
        'Review progress',
        jsonb_build_object(
          'organizationId', v_row.organization_id,
          'programmeId', v_row.programme_id,
          'enrolmentId', v_row.enrolment_id,
          'dueAt', v_row.due_at
        ),
        'lms-programme-due-soon:' || v_row.enrolment_id::text || ':' || to_char((v_row.due_at at time zone 'Africa/Lagos')::date, 'YYYYMMDD')
      )
      into v_notification_id;

      if v_notification_id is not null then
        v_due_soon_count := v_due_soon_count + 1;
      end if;
    end if;

    if v_row.due_at is not null
      and v_row.due_at < coalesce(p_now, now())
    then
      select private.queue_user_notification(
        v_row.user_id,
        'system',
        'lms_programme_overdue',
        'Programme overdue',
        v_row.programme_title || ' is overdue.',
        '/profile/transcript',
        'Review assignment',
        jsonb_build_object(
          'organizationId', v_row.organization_id,
          'programmeId', v_row.programme_id,
          'enrolmentId', v_row.enrolment_id,
          'dueAt', v_row.due_at
        ),
        'lms-programme-overdue:' || v_row.enrolment_id::text || ':' || v_local_date
      )
      into v_notification_id;

      if v_notification_id is not null then
        v_overdue_count := v_overdue_count + 1;
      end if;

      select public.upsert_lms_intervention(
        v_row.organization_id,
        v_row.programme_id,
        v_row.cohort_id,
        v_row.user_id,
        v_row.enrolment_id,
        'overdue',
        'critical',
        v_row.programme_title || ' is overdue.',
        v_row.due_at,
        v_row.last_activity_at,
        jsonb_build_object('generatedBy', 'generate_lms_programme_notifications')
      )
      into v_intervention_id;

      if v_intervention_id is not null then
        v_intervention_count := v_intervention_count + 1;
      end if;
    end if;

    if coalesce(v_row.last_activity_at, v_row.assigned_at) <= coalesce(p_now, now()) - interval '7 days' then
      select private.queue_user_notification(
        v_row.user_id,
        'system',
        'lms_programme_inactive',
        'Programme check-in',
        'You have not made recent progress in ' || v_row.programme_title || '.',
        '/profile/transcript',
        'Continue',
        jsonb_build_object(
          'organizationId', v_row.organization_id,
          'programmeId', v_row.programme_id,
          'enrolmentId', v_row.enrolment_id,
          'lastActivityAt', v_row.last_activity_at
        ),
        'lms-programme-inactive:' || v_row.enrolment_id::text || ':' || v_local_date
      )
      into v_notification_id;

      if v_notification_id is not null then
        v_inactive_count := v_inactive_count + 1;
      end if;

      select public.upsert_lms_intervention(
        v_row.organization_id,
        v_row.programme_id,
        v_row.cohort_id,
        v_row.user_id,
        v_row.enrolment_id,
        'inactive',
        'warning',
        'No recent progress in ' || v_row.programme_title || '.',
        v_row.due_at,
        v_row.last_activity_at,
        jsonb_build_object('generatedBy', 'generate_lms_programme_notifications')
      )
      into v_intervention_id;

      if v_intervention_id is not null then
        v_intervention_count := v_intervention_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'assignmentNotifications', v_assignment_count,
    'upcomingDueReminders', v_due_soon_count,
    'overdueReminders', v_overdue_count,
    'inactivityReminders', v_inactive_count,
    'interventions', v_intervention_count
  );
end;
$$;

create or replace function public.get_lms_intervention_queue(
  p_organization_id uuid default null,
  p_programme_id uuid default null,
  p_status public.lms_intervention_status default 'open',
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := p_organization_id;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_rows jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_programme_id is not null then
    select programme.organization_id
      into v_organization_id
    from public.programmes programme
    where programme.id = p_programme_id;

    if v_organization_id is null then
      raise exception 'Programme not found.';
    end if;

    if p_organization_id is not null and p_organization_id <> v_organization_id then
      raise exception 'Programme does not belong to the selected organization.';
    end if;
  end if;

  if v_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Platform admin access is required for cross-organization interventions.' using errcode = '42501';
    end if;
  elsif not public.current_user_can_read_organization_audience(v_organization_id) then
    raise exception 'Audience reporting access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', intervention.id,
      'organizationId', intervention.organization_id,
      'organizationName', organization.name,
      'programmeId', intervention.programme_id,
      'programmeTitle', programme.title,
      'cohortId', intervention.cohort_id,
      'cohortTitle', cohort.title,
      'userId', intervention.user_id,
      'displayName', profile.display_name,
      'enrolmentId', intervention.enrolment_id,
      'type', intervention.intervention_type,
      'status', intervention.status,
      'severity', intervention.severity,
      'reason', intervention.reason,
      'dueAt', intervention.due_at,
      'lastActivityAt', intervention.last_activity_at,
      'triggeredAt', intervention.triggered_at,
      'resolvedAt', intervention.resolved_at,
      'metadata', intervention.metadata
    )
    order by
      case intervention.severity when 'critical' then 1 when 'warning' then 2 else 3 end,
      intervention.triggered_at desc
  ), '[]'::jsonb)
    into v_rows
  from (
    select *
    from public.lms_interventions intervention
    where (v_organization_id is null or intervention.organization_id = v_organization_id)
      and (p_programme_id is null or intervention.programme_id = p_programme_id)
      and (p_status is null or intervention.status = p_status)
    order by
      case intervention.severity when 'critical' then 1 when 'warning' then 2 else 3 end,
      intervention.triggered_at desc
    limit v_limit
  ) intervention
  join public.organizations organization
    on organization.id = intervention.organization_id
  join public.programmes programme
    on programme.id = intervention.programme_id
  join public.profiles profile
    on profile.id = intervention.user_id
  left join public.cohorts cohort
    on cohort.id = intervention.cohort_id;

  return jsonb_build_object('items', v_rows);
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

  if not public.current_user_can_manage_organization_audience(v_intervention.organization_id) then
    raise exception 'Audience manager access required.' using errcode = '42501';
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

revoke execute on function public.queue_lms_programme_assignment_notification() from public, anon, authenticated, service_role;
revoke execute on function public.queue_lms_programme_completion_notification() from public, anon, authenticated, service_role;
revoke execute on function public.upsert_lms_intervention(uuid, uuid, uuid, uuid, uuid, public.lms_intervention_type, public.lms_intervention_severity, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated, service_role;

revoke execute on function public.generate_lms_programme_notifications(timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.generate_lms_programme_notifications(timestamptz) to service_role;

revoke execute on function public.get_lms_intervention_queue(uuid, uuid, public.lms_intervention_status, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_lms_intervention_queue(uuid, uuid, public.lms_intervention_status, integer) to authenticated, service_role;

revoke execute on function public.admin_update_lms_intervention_status(uuid, public.lms_intervention_status, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_update_lms_intervention_status(uuid, public.lms_intervention_status, text) to authenticated, service_role;

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
    'queue_lms_programme_assignment_notification',
    '',
    'TRIGGER_ONLY',
    'Database trigger on programme enrolments.',
    'Trigger function only; queues deduplicated assignment notifications through the secured notification primitive.',
    array[]::text[]
  ),
  (
    'public',
    'queue_lms_programme_completion_notification',
    '',
    'TRIGGER_ONLY',
    'Database trigger on programme completions.',
    'Trigger function only; queues deduplicated completion notifications and resolves related intervention rows.',
    array[]::text[]
  ),
  (
    'public',
    'upsert_lms_intervention',
    'p_organization_id uuid, p_programme_id uuid, p_cohort_id uuid, p_user_id uuid, p_enrolment_id uuid, p_intervention_type lms_intervention_type, p_severity lms_intervention_severity, p_reason text, p_due_at timestamp with time zone, p_last_activity_at timestamp with time zone, p_metadata jsonb',
    'INTERNAL_HELPER',
    'Trusted LMS reminder generation workflows.',
    'No browser role may execute directly; trusted definer code records deduplicated programme-manager intervention rows.',
    array[]::text[]
  ),
  (
    'public',
    'generate_lms_programme_notifications',
    'p_now timestamp with time zone',
    'SERVICE_ROLE_ONLY',
    'Notification dispatch service job.',
    'Only service_role may execute directly; generates assignment catch-up, due soon, overdue and inactivity notifications using canonical enrolment and completion state.',
    array['service_role']
  ),
  (
    'public',
    'get_lms_intervention_queue',
    'p_organization_id uuid, p_programme_id uuid, p_status lms_intervention_status, p_limit integer',
    'ADMIN_AUTHENTICATED',
    'Platform admins and contextual organisation audience readers.',
    'Requires auth.uid(); cross-organization reads require platform admin, scoped reads require organisation audience visibility.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_lms_intervention_status',
    'p_intervention_id uuid, p_status lms_intervention_status, p_note text',
    'ADMIN_AUTHENTICATED',
    'Platform admins and contextual organisation audience managers.',
    'Requires auth.uid() and organisation audience manager rights for the intervention organization.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
