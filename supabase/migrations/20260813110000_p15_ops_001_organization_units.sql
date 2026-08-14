create table if not exists public.organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_unit_id uuid references public.organization_units(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  unit_type text not null check (length(trim(unit_type)) > 0 and length(trim(unit_type)) <= 80),
  status public.content_status not null default 'published',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, parent_unit_id, name),
  check (parent_unit_id is null or parent_unit_id <> id)
);

create table if not exists public.organization_unit_members (
  unit_id uuid not null references public.organization_units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role_key not null default 'learner',
  status public.organization_membership_status not null default 'active',
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (unit_id, user_id, role)
);

create table if not exists public.cohort_units (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  unit_id uuid not null references public.organization_units(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (cohort_id, unit_id)
);

create index if not exists organization_units_org_parent_idx
  on public.organization_units(organization_id, parent_unit_id, status);

create index if not exists organization_unit_members_user_status_idx
  on public.organization_unit_members(user_id, status);

create index if not exists organization_unit_members_org_role_status_idx
  on public.organization_unit_members(organization_id, role, status);

create index if not exists cohort_units_unit_idx
  on public.cohort_units(unit_id);

drop trigger if exists organization_units_set_updated_at on public.organization_units;
create trigger organization_units_set_updated_at
  before update on public.organization_units
  for each row execute function public.set_updated_at();

drop trigger if exists organization_unit_members_set_updated_at on public.organization_unit_members;
create trigger organization_unit_members_set_updated_at
  before update on public.organization_unit_members
  for each row execute function public.set_updated_at();

create or replace function public.enforce_organization_unit_boundaries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.organization_units%rowtype;
  v_depth integer := 1;
begin
  new.name := trim(new.name);
  new.unit_type := trim(new.unit_type);

  if new.parent_unit_id is null then
    return new;
  end if;

  select *
    into v_parent
  from public.organization_units
  where id = new.parent_unit_id;

  if not found then
    raise exception 'Parent unit not found.';
  end if;

  if v_parent.organization_id <> new.organization_id then
    raise exception 'Organisation units cannot cross organisations.' using errcode = '23514';
  end if;

  with recursive ancestors as (
    select parent.id, parent.parent_unit_id, 2 as depth
    from public.organization_units parent
    where parent.id = new.parent_unit_id
    union all
    select parent.id, parent.parent_unit_id, ancestors.depth + 1
    from ancestors
    join public.organization_units parent
      on parent.id = ancestors.parent_unit_id
  )
  select max(depth)
    into v_depth
  from ancestors;

  if coalesce(v_depth, 1) > 3 then
    raise exception 'Organisation units support a maximum depth of 3 during Phase 1.5.' using errcode = '23514';
  end if;

  if exists (
    with recursive ancestors as (
      select parent.id, parent.parent_unit_id
      from public.organization_units parent
      where parent.id = new.parent_unit_id
      union all
      select parent.id, parent.parent_unit_id
      from ancestors
      join public.organization_units parent
        on parent.id = ancestors.parent_unit_id
    )
    select 1
    from ancestors
    where ancestors.id = new.id
  ) then
    raise exception 'Organisation units cannot contain cycles.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_organization_unit_boundaries_trigger on public.organization_units;
create trigger enforce_organization_unit_boundaries_trigger
  before insert or update on public.organization_units
  for each row execute function public.enforce_organization_unit_boundaries();

create or replace function public.enforce_organization_unit_member_boundaries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.organization_units%rowtype;
begin
  select *
    into v_unit
  from public.organization_units
  where id = new.unit_id;

  if not found then
    raise exception 'Organisation unit not found.';
  end if;

  if v_unit.organization_id <> new.organization_id then
    raise exception 'Unit members cannot cross organisations.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = new.organization_id
      and membership.user_id = new.user_id
      and membership.role = new.role
      and membership.status in ('active', 'invited')
  ) then
    raise exception 'Unit members must have a matching organisation membership.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_organization_unit_member_boundaries_trigger on public.organization_unit_members;
create trigger enforce_organization_unit_member_boundaries_trigger
  before insert or update on public.organization_unit_members
  for each row execute function public.enforce_organization_unit_member_boundaries();

create or replace function public.enforce_cohort_unit_boundaries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort public.cohorts%rowtype;
  v_unit public.organization_units%rowtype;
begin
  select *
    into v_cohort
  from public.cohorts
  where id = new.cohort_id;

  if not found then
    raise exception 'Cohort not found.';
  end if;

  select *
    into v_unit
  from public.organization_units
  where id = new.unit_id;

  if not found then
    raise exception 'Organisation unit not found.';
  end if;

  if v_cohort.organization_id <> new.organization_id
     or v_unit.organization_id <> new.organization_id then
    raise exception 'Cohort units cannot cross organisations.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_cohort_unit_boundaries_trigger on public.cohort_units;
create trigger enforce_cohort_unit_boundaries_trigger
  before insert or update on public.cohort_units
  for each row execute function public.enforce_cohort_unit_boundaries();

revoke execute on function public.enforce_organization_unit_boundaries() from public, anon, authenticated, service_role;
revoke execute on function public.enforce_organization_unit_member_boundaries() from public, anon, authenticated, service_role;
revoke execute on function public.enforce_cohort_unit_boundaries() from public, anon, authenticated, service_role;

alter table public.organization_units enable row level security;
alter table public.organization_unit_members enable row level security;
alter table public.cohort_units enable row level security;

create or replace function public.current_user_can_supervise_organization_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
    );
$$;

create or replace function public.current_user_can_read_organization_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

revoke execute on function public.current_user_can_supervise_organization_unit(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_supervise_organization_unit(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_organization_unit(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_organization_unit(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_unit_learner(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_unit_learner(uuid, uuid) to authenticated, service_role;

drop policy if exists "Organisation audience can read units" on public.organization_units;
create policy "Organisation audience can read units"
  on public.organization_units for select
  using (public.current_user_can_read_organization_unit(id));

drop policy if exists "Organisation audience managers can write units" on public.organization_units;
create policy "Organisation audience managers can write units"
  on public.organization_units for all
  using (public.current_user_can_manage_organization_audience(organization_id))
  with check (public.current_user_can_manage_organization_audience(organization_id));

drop policy if exists "Organisation audience can read unit members" on public.organization_unit_members;
create policy "Organisation audience can read unit members"
  on public.organization_unit_members for select
  using (
    user_id = auth.uid()
    or public.current_user_can_read_organization_audience(organization_id)
    or public.current_user_can_supervise_organization_unit(unit_id)
  );

drop policy if exists "Organisation audience managers can write unit members" on public.organization_unit_members;
create policy "Organisation audience managers can write unit members"
  on public.organization_unit_members for all
  using (public.current_user_can_manage_organization_audience(organization_id))
  with check (public.current_user_can_manage_organization_audience(organization_id));

drop policy if exists "Organisation audience can read cohort units" on public.cohort_units;
create policy "Organisation audience can read cohort units"
  on public.cohort_units for select
  using (
    public.current_user_can_read_organization_audience(organization_id)
    or public.current_user_can_supervise_organization_unit(unit_id)
  );

drop policy if exists "Organisation audience managers can write cohort units" on public.cohort_units;
create policy "Organisation audience managers can write cohort units"
  on public.cohort_units for all
  using (public.current_user_can_manage_organization_audience(organization_id))
  with check (public.current_user_can_manage_organization_audience(organization_id));

create or replace function public.admin_upsert_organization_unit(
  p_unit_id uuid,
  p_organization_id uuid,
  p_parent_unit_id uuid,
  p_name text,
  p_unit_type text,
  p_status public.content_status default 'published'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_unit_id uuid := coalesce(p_unit_id, gen_random_uuid());
  v_name text := trim(coalesce(p_name, ''));
  v_unit_type text := trim(coalesce(p_unit_type, ''));
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_audience(p_organization_id) then
    raise exception 'Audience manager access required.' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'Unit name is required.';
  end if;

  if v_unit_type = '' then
    raise exception 'Unit type is required.';
  end if;

  insert into public.organization_units (
    id,
    organization_id,
    parent_unit_id,
    name,
    unit_type,
    status,
    created_by
  )
  values (
    v_unit_id,
    p_organization_id,
    p_parent_unit_id,
    v_name,
    v_unit_type,
    coalesce(p_status, 'published'::public.content_status),
    v_actor_id
  )
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        parent_unit_id = excluded.parent_unit_id,
        name = excluded.name,
        unit_type = excluded.unit_type,
        status = excluded.status;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when p_unit_id is null then 'organization_unit_created' else 'organization_unit_updated' end,
    'organization_unit',
    v_unit_id::text,
    jsonb_build_object('organizationId', p_organization_id, 'parentUnitId', p_parent_unit_id)
  );

  return jsonb_build_object('unitId', v_unit_id, 'status', coalesce(p_status, 'published'::public.content_status));
end;
$$;

create or replace function public.admin_replace_organization_unit_members(
  p_unit_id uuid,
  p_members jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_unit public.organization_units%rowtype;
  v_member_count integer := 0;
begin
  select *
    into v_unit
  from public.organization_units
  where id = p_unit_id;

  if not found then
    raise exception 'Organisation unit not found.';
  end if;

  if v_actor_id is null or not public.current_user_can_manage_organization_audience(v_unit.organization_id) then
    raise exception 'Audience manager access required.' using errcode = '42501';
  end if;

  create temporary table if not exists pg_temp.admin_unit_member_selection (
    user_id uuid not null,
    role public.organization_role_key not null,
    primary key (user_id, role)
  ) on commit drop;

  truncate table pg_temp.admin_unit_member_selection;

  insert into pg_temp.admin_unit_member_selection (user_id, role)
  select distinct
    (member_row ->> 'userId')::uuid,
    coalesce(nullif(member_row ->> 'role', ''), 'learner')::public.organization_role_key
  from jsonb_array_elements(coalesce(p_members, '[]'::jsonb)) as member_row
  where member_row ->> 'userId' is not null;

  select count(*)::integer
    into v_member_count
  from pg_temp.admin_unit_member_selection;

  if exists (
    select 1
    from pg_temp.admin_unit_member_selection selected
    left join public.organization_memberships membership
      on membership.organization_id = v_unit.organization_id
     and membership.user_id = selected.user_id
     and membership.role = selected.role
     and membership.status in ('active', 'invited')
    where membership.id is null
  ) then
    raise exception 'Unit members must have matching organisation memberships.';
  end if;

  update public.organization_unit_members member
  set status = 'removed',
      updated_at = now()
  where member.unit_id = p_unit_id
    and not exists (
      select 1
      from pg_temp.admin_unit_member_selection selected
      where selected.user_id = member.user_id
        and selected.role = member.role
    );

  insert into public.organization_unit_members (
    unit_id,
    organization_id,
    user_id,
    role,
    status,
    assigned_by
  )
  select
    p_unit_id,
    v_unit.organization_id,
    selected.user_id,
    selected.role,
    'active',
    v_actor_id
  from pg_temp.admin_unit_member_selection selected
  on conflict (unit_id, user_id, role) do update
    set organization_id = excluded.organization_id,
        status = 'active',
        assigned_by = excluded.assigned_by,
        updated_at = now();

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_unit_members_replaced',
    'organization_unit',
    p_unit_id::text,
    jsonb_build_object('memberCount', v_member_count)
  );

  return jsonb_build_object('unitId', p_unit_id, 'memberCount', v_member_count);
end;
$$;

create or replace function public.admin_replace_cohort_units(
  p_cohort_id uuid,
  p_unit_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_cohort public.cohorts%rowtype;
  v_unit_count integer := 0;
begin
  select *
    into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort not found.';
  end if;

  if v_actor_id is null or not public.current_user_can_manage_organization_audience(v_cohort.organization_id) then
    raise exception 'Audience manager access required.' using errcode = '42501';
  end if;

  create temporary table if not exists pg_temp.admin_cohort_unit_selection (
    unit_id uuid primary key
  ) on commit drop;

  truncate table pg_temp.admin_cohort_unit_selection;

  insert into pg_temp.admin_cohort_unit_selection (unit_id)
  select distinct unit_id
  from unnest(coalesce(p_unit_ids, '{}'::uuid[])) as unit_id
  where unit_id is not null;

  if exists (
    select 1
    from pg_temp.admin_cohort_unit_selection selected
    left join public.organization_units unit
      on unit.id = selected.unit_id
     and unit.organization_id = v_cohort.organization_id
     and unit.status <> 'archived'
    where unit.id is null
  ) then
    raise exception 'Cohort units must belong to the selected organisation.';
  end if;

  select count(*)::integer
    into v_unit_count
  from pg_temp.admin_cohort_unit_selection;

  delete from public.cohort_units cohort_unit
  where cohort_unit.cohort_id = p_cohort_id
    and not exists (
      select 1
      from pg_temp.admin_cohort_unit_selection selected
      where selected.unit_id = cohort_unit.unit_id
    );

  insert into public.cohort_units (
    cohort_id,
    unit_id,
    organization_id,
    assigned_by
  )
  select
    p_cohort_id,
    selected.unit_id,
    v_cohort.organization_id,
    v_actor_id
  from pg_temp.admin_cohort_unit_selection selected
  on conflict (cohort_id, unit_id) do update
    set organization_id = excluded.organization_id,
        assigned_by = excluded.assigned_by;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'cohort_units_replaced',
    'cohort',
    p_cohort_id::text,
    jsonb_build_object('unitCount', v_unit_count)
  );

  return jsonb_build_object('cohortId', p_cohort_id, 'unitCount', v_unit_count);
end;
$$;

revoke execute on function public.admin_upsert_organization_unit(uuid, uuid, uuid, text, text, public.content_status) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_organization_unit(uuid, uuid, uuid, text, text, public.content_status) to authenticated, service_role;

revoke execute on function public.admin_replace_organization_unit_members(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.admin_replace_organization_unit_members(uuid, jsonb) to authenticated, service_role;

revoke execute on function public.admin_replace_cohort_units(uuid, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_replace_cohort_units(uuid, uuid[]) to authenticated, service_role;

create or replace function public.admin_get_lms_reporting(
  p_organization_id uuid default null,
  p_programme_id uuid default null,
  p_cohort_id uuid default null,
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
  v_organization_id uuid := p_organization_id;
  v_programme public.programmes%rowtype;
  v_cohort public.cohorts%rowtype;
  v_unit public.organization_units%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_summary jsonb := '{}'::jsonb;
  v_cohort_comparison jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_quiz_scores jsonb := '[]'::jsonb;
  v_mission_completion jsonb := '[]'::jsonb;
  v_reward_usage jsonb := '[]'::jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_programme_id is not null then
    select *
      into v_programme
    from public.programmes
    where id = p_programme_id;

    if not found then
      raise exception 'Programme not found.';
    end if;

    if v_organization_id is not null and v_organization_id <> v_programme.organization_id then
      raise exception 'Programme does not belong to the selected organisation.';
    end if;

    v_organization_id := v_programme.organization_id;
  end if;

  if p_cohort_id is not null then
    select *
      into v_cohort
    from public.cohorts
    where id = p_cohort_id;

    if not found then
      raise exception 'Cohort not found.';
    end if;

    if v_organization_id is not null and v_organization_id <> v_cohort.organization_id then
      raise exception 'Cohort does not belong to the selected organisation.';
    end if;

    v_organization_id := v_cohort.organization_id;
  end if;

  if p_unit_id is not null then
    select *
      into v_unit
    from public.organization_units
    where id = p_unit_id;

    if not found then
      raise exception 'Organisation unit not found.';
    end if;

    if v_organization_id is not null and v_organization_id <> v_unit.organization_id then
      raise exception 'Organisation unit does not belong to the selected organisation.';
    end if;

    v_organization_id := v_unit.organization_id;
  end if;

  if v_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Reporting access required.' using errcode = '42501';
    end if;
  elsif p_unit_id is not null then
    if not (
      public.current_user_can_read_organization_audience(v_organization_id)
      or public.current_user_can_supervise_organization_unit(p_unit_id)
    ) then
      raise exception 'Reporting access required.' using errcode = '42501';
    end if;
  elsif not public.current_user_can_read_organization_audience(v_organization_id) then
    raise exception 'Reporting access required.' using errcode = '42501';
  end if;

  drop table if exists pg_temp.lms_reporting_enrolments;
  create temporary table pg_temp.lms_reporting_enrolments on commit drop as
  select enrolment.*
  from public.enrolments enrolment
  where (v_organization_id is null or enrolment.organization_id = v_organization_id)
    and (
      p_programme_id is null
      or enrolment.programme_id = p_programme_id
      or enrolment.metadata ->> 'programmeId' = p_programme_id::text
    )
    and (
      p_cohort_id is null
      or enrolment.metadata ->> 'cohortId' = p_cohort_id::text
    )
    and (
      p_unit_id is null
      or exists (
        select 1
        from public.organization_unit_members member
        where member.unit_id = p_unit_id
          and member.organization_id = enrolment.organization_id
          and member.user_id = enrolment.user_id
          and member.role = 'learner'
          and member.status = 'active'
      )
      or exists (
        select 1
        from public.cohort_units cohort_unit
        where cohort_unit.unit_id = p_unit_id
          and cohort_unit.organization_id = enrolment.organization_id
          and enrolment.metadata ->> 'cohortId' = cohort_unit.cohort_id::text
      )
    )
    and (
      v_organization_id is null
      or public.current_user_can_read_organization_audience(v_organization_id)
      or public.current_user_can_read_unit_learner(v_organization_id, enrolment.user_id)
    );

  drop table if exists pg_temp.lms_reporting_users;
  create temporary table pg_temp.lms_reporting_users on commit drop as
  select distinct enrolment.user_id
  from pg_temp.lms_reporting_enrolments enrolment;

  drop table if exists pg_temp.lms_reporting_quiz_attempt_scores;
  create temporary table pg_temp.lms_reporting_quiz_attempt_scores on commit drop as
  select
    attempt.id as attempt_id,
    attempt.user_id,
    attempt.quiz_id,
    quiz.title as quiz_title,
    lesson.course_id,
    case
      when count(answer.id) = 0 then 0
      else round(avg(case when answer.is_correct then 100::numeric else 0::numeric end))::integer
    end as score
  from public.quiz_attempts attempt
  join public.quizzes quiz
    on quiz.id = attempt.quiz_id
  join public.lessons lesson
    on lesson.id = attempt.lesson_id
  join pg_temp.lms_reporting_users scoped_user
    on scoped_user.user_id = attempt.user_id
  left join public.quiz_answers answer
    on answer.attempt_id = attempt.id
   and answer.user_id = attempt.user_id
  where attempt.status <> 'in_progress'
    and exists (
      select 1
      from pg_temp.lms_reporting_enrolments enrolment
      where enrolment.user_id = attempt.user_id
        and enrolment.course_id = lesson.course_id
    )
  group by attempt.id, attempt.user_id, attempt.quiz_id, quiz.title, lesson.course_id;

  select jsonb_build_object(
    'organizationId', v_organization_id,
    'programmeId', p_programme_id,
    'cohortId', p_cohort_id,
    'unitId', p_unit_id,
    'assignedLearners', coalesce(count(distinct enrolment.user_id), 0),
    'startedLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.started_at is not null
        or course_completion.progress_percent > 0
        or programme_completion.progress_percent > 0
    ), 0),
    'inProgressLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'active'
        and (
          enrolment.started_at is not null
          or course_completion.progress_percent > 0
          or programme_completion.progress_percent > 0
        )
        and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
    ), 0),
    'completedLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'completed'
        or course_completion.status = 'completed'
        or programme_completion.status = 'completed'
    ), 0),
    'overdueLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'active'
        and enrolment.due_at is not null
        and enrolment.due_at < now()
        and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
    ), 0),
    'averageCourseProgress', coalesce(round(avg(course_completion.progress_percent))::integer, 0),
    'averageProgrammeProgress', coalesce(round(avg(programme_completion.progress_percent))::integer, 0),
    'averageQuizScore', coalesce((select round(avg(score))::integer from pg_temp.lms_reporting_quiz_attempt_scores), 0),
    'missionAwards', coalesce((select count(*)::integer from public.mission_awards award join pg_temp.lms_reporting_users scoped_user on scoped_user.user_id = award.user_id), 0),
    'rewardRedemptions', coalesce((select count(*)::integer from public.reward_redemptions redemption join pg_temp.lms_reporting_users scoped_user on scoped_user.user_id = redemption.user_id), 0),
    'generatedAt', now()
  )
    into v_summary
  from pg_temp.lms_reporting_enrolments enrolment
  left join public.course_completions course_completion
    on course_completion.user_id = enrolment.user_id
   and course_completion.course_id = enrolment.course_id
  left join public.programme_completions programme_completion
    on programme_completion.user_id = enrolment.user_id
   and programme_completion.programme_id = enrolment.programme_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cohortId', cohort.id,
      'title', cohort.title,
      'activeMembers', coalesce(member_counts.active_members, 0),
      'assignedLearners', coalesce(enrolment_counts.assigned_learners, 0),
      'completedLearners', coalesce(enrolment_counts.completed_learners, 0),
      'overdueLearners', coalesce(enrolment_counts.overdue_learners, 0),
      'averageProgress', coalesce(enrolment_counts.average_progress, 0)
    )
    order by cohort.title
  ), '[]'::jsonb)
    into v_cohort_comparison
  from public.cohorts cohort
  left join lateral (
    select count(*)::integer as active_members
    from public.cohort_members member
    where member.cohort_id = cohort.id
      and member.status = 'active'
  ) member_counts on true
  left join lateral (
    select
      count(distinct enrolment.user_id)::integer as assigned_learners,
      count(distinct enrolment.user_id) filter (
        where enrolment.status = 'completed'
          or course_completion.status = 'completed'
          or programme_completion.status = 'completed'
      )::integer as completed_learners,
      count(distinct enrolment.user_id) filter (
        where enrolment.status = 'active'
          and enrolment.due_at is not null
          and enrolment.due_at < now()
          and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
      )::integer as overdue_learners,
      round(avg(coalesce(course_completion.progress_percent, programme_completion.progress_percent, 0)))::integer as average_progress
    from pg_temp.lms_reporting_enrolments enrolment
    left join public.course_completions course_completion
      on course_completion.user_id = enrolment.user_id
     and course_completion.course_id = enrolment.course_id
    left join public.programme_completions programme_completion
      on programme_completion.user_id = enrolment.user_id
     and programme_completion.programme_id = enrolment.programme_id
    where enrolment.metadata ->> 'cohortId' = cohort.id::text
  ) enrolment_counts on true
  where (v_organization_id is null or cohort.organization_id = v_organization_id)
    and (p_cohort_id is null or cohort.id = p_cohort_id)
    and (
      p_unit_id is null
      or exists (
        select 1
        from public.cohort_units cohort_unit
        where cohort_unit.cohort_id = cohort.id
          and cohort_unit.unit_id = p_unit_id
      )
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', learner.user_id,
      'displayName', profile.display_name,
      'cohorts', coalesce(learner.cohorts, '[]'::jsonb),
      'assignedCount', learner.assigned_count,
      'startedCount', learner.started_count,
      'completedCount', learner.completed_count,
      'overdueCount', learner.overdue_count,
      'averageCourseProgress', learner.average_course_progress,
      'averageProgrammeProgress', learner.average_programme_progress,
      'averageQuizScore', learner.average_quiz_score,
      'missionAwards', learner.mission_awards,
      'rewardRedemptions', learner.reward_redemptions,
      'lastActivityAt', learner.last_activity_at
    )
    order by learner.last_activity_at desc nulls last, profile.display_name asc nulls last
  ), '[]'::jsonb)
    into v_learners
  from (
    select
      scoped_user.user_id,
      count(distinct enrolment.id)::integer as assigned_count,
      count(distinct enrolment.id) filter (
        where enrolment.started_at is not null
          or course_completion.progress_percent > 0
          or programme_completion.progress_percent > 0
      )::integer as started_count,
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
      coalesce(round(avg(course_completion.progress_percent))::integer, 0) as average_course_progress,
      coalesce(round(avg(programme_completion.progress_percent))::integer, 0) as average_programme_progress,
      coalesce(quiz_scores.average_quiz_score, 0) as average_quiz_score,
      coalesce(mission_counts.mission_awards, 0) as mission_awards,
      coalesce(redemption_counts.reward_redemptions, 0) as reward_redemptions,
      coalesce(max(enrolment.updated_at), max(course_completion.evaluated_at), max(programme_completion.evaluated_at)) as last_activity_at,
      coalesce(cohort_memberships.cohorts, '[]'::jsonb) as cohorts
    from pg_temp.lms_reporting_users scoped_user
    join pg_temp.lms_reporting_enrolments enrolment
      on enrolment.user_id = scoped_user.user_id
    left join public.course_completions course_completion
      on course_completion.user_id = enrolment.user_id
     and course_completion.course_id = enrolment.course_id
    left join public.programme_completions programme_completion
      on programme_completion.user_id = enrolment.user_id
     and programme_completion.programme_id = enrolment.programme_id
    left join lateral (
      select round(avg(score))::integer as average_quiz_score
      from pg_temp.lms_reporting_quiz_attempt_scores attempt_score
      where attempt_score.user_id = scoped_user.user_id
    ) quiz_scores on true
    left join lateral (
      select count(*)::integer as mission_awards
      from public.mission_awards award
      where award.user_id = scoped_user.user_id
    ) mission_counts on true
    left join lateral (
      select count(*)::integer as reward_redemptions
      from public.reward_redemptions redemption
      where redemption.user_id = scoped_user.user_id
    ) redemption_counts on true
    left join lateral (
      select coalesce(jsonb_agg(
        jsonb_build_object('cohortId', cohort.id, 'title', cohort.title)
        order by cohort.title
      ), '[]'::jsonb) as cohorts
      from public.cohort_members member
      join public.cohorts cohort
        on cohort.id = member.cohort_id
      where member.user_id = scoped_user.user_id
        and member.status = 'active'
        and (v_organization_id is null or cohort.organization_id = v_organization_id)
        and (p_cohort_id is null or cohort.id = p_cohort_id)
        and (
          p_unit_id is null
          or exists (
            select 1
            from public.cohort_units cohort_unit
            where cohort_unit.cohort_id = cohort.id
              and cohort_unit.unit_id = p_unit_id
          )
        )
    ) cohort_memberships on true
    group by
      scoped_user.user_id,
      quiz_scores.average_quiz_score,
      mission_counts.mission_awards,
      redemption_counts.reward_redemptions,
      cohort_memberships.cohorts
    order by last_activity_at desc nulls last
    limit v_limit
  ) learner
  join public.profiles profile
    on profile.id = learner.user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'quizId', quiz_id,
      'title', quiz_title,
      'attempts', attempts,
      'averageScore', average_score
    )
    order by quiz_title
  ), '[]'::jsonb)
    into v_quiz_scores
  from (
    select
      quiz_id,
      quiz_title,
      count(*)::integer as attempts,
      round(avg(score))::integer as average_score
    from pg_temp.lms_reporting_quiz_attempt_scores
    group by quiz_id, quiz_title
    order by quiz_title
    limit v_limit
  ) quiz_report;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'missionId', mission.id,
      'title', mission.title,
      'awards', coalesce(award_counts.awards, 0),
      'assignedLearners', (v_summary ->> 'assignedLearners')::integer,
      'completionRate', case
        when (v_summary ->> 'assignedLearners')::integer = 0 then 0
        else round((coalesce(award_counts.awards, 0)::numeric / (v_summary ->> 'assignedLearners')::integer::numeric) * 100)::integer
      end
    )
    order by mission.title
  ), '[]'::jsonb)
    into v_mission_completion
  from public.missions mission
  join (
    select distinct mission_id
    from public.programme_missions programme_mission
    join public.programmes programme
      on programme.id = programme_mission.programme_id
    where (v_organization_id is null or programme.organization_id = v_organization_id)
      and (p_programme_id is null or programme.id = p_programme_id)
    union
    select distinct award.mission_id
    from public.mission_awards award
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = award.user_id
  ) scoped_missions
    on scoped_missions.mission_id = mission.id
  left join lateral (
    select count(*)::integer as awards
    from public.mission_awards award
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = award.user_id
    where award.mission_id = mission.id
  ) award_counts on true
  limit v_limit;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rewardId', reward.id,
      'title', reward.title,
      'redemptions', reward_report.redemptions,
      'fulfilled', reward_report.fulfilled,
      'requested', reward_report.requested
    )
    order by reward.title
  ), '[]'::jsonb)
    into v_reward_usage
  from (
    select
      redemption.reward_id,
      count(*)::integer as redemptions,
      count(*) filter (where redemption.status in ('fulfilled', 'approved'))::integer as fulfilled,
      count(*) filter (where redemption.status = 'requested')::integer as requested
    from public.reward_redemptions redemption
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = redemption.user_id
    group by redemption.reward_id
    order by count(*) desc
    limit v_limit
  ) reward_report
  join public.rewards reward
    on reward.id = reward_report.reward_id;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'cohortComparison', v_cohort_comparison,
    'learners', v_learners,
    'quizScores', v_quiz_scores,
    'missionCompletion', v_mission_completion,
    'rewardUsage', v_reward_usage
  );
end;
$$;

drop function if exists public.admin_get_lms_reporting(uuid, uuid, uuid, integer);

revoke execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, uuid, integer) to authenticated, service_role;

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
    'current_user_can_supervise_organization_unit',
    'p_unit_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking whether the caller supervises one organisation unit.',
    'Uses auth.uid() and active organization_unit_members rows with supervisor-capable contextual roles for the requested unit.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_read_organization_unit',
    'p_unit_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking whether the caller can read one organisation unit.',
    'Allows organisation audience readers or active unit members for the requested unit.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_read_unit_learner',
    'p_organization_id uuid, p_user_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and reporting scopes checking whether the caller can read a learner through shared unit supervision.',
    'Allows organisation audience readers or active supervisor-capable unit members sharing a unit with the learner.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_organization_unit',
    'p_unit_id uuid, p_organization_id uuid, p_parent_unit_id uuid, p_name text, p_unit_type text, p_status content_status',
    'ADMIN_AUTHENTICATED',
    'Organisation audience managers creating or updating shallow institution units.',
    'Requires auth.uid() and current_user_can_manage_organization_audience for the requested organisation; trigger-enforced parent boundary and depth rules prevent cross-organisation or deep unit trees.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_replace_organization_unit_members',
    'p_unit_id uuid, p_members jsonb',
    'ADMIN_AUTHENTICATED',
    'Organisation audience managers replacing learner and staff unit assignments.',
    'Requires auth.uid() and organisation audience manager rights for the unit organisation; every selected user-role pair must have a matching organisation membership.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_replace_cohort_units',
    'p_cohort_id uuid, p_unit_ids uuid[]',
    'ADMIN_AUTHENTICATED',
    'Organisation audience managers associating cohorts with organisation units.',
    'Requires auth.uid() and organisation audience manager rights for the cohort organisation; every unit must belong to that same organisation.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_get_lms_reporting',
    'p_organization_id uuid, p_programme_id uuid, p_cohort_id uuid, p_unit_id uuid, p_limit integer',
    'ADMIN_AUTHENTICATED',
    'Platform admin, contextual organisation report viewer, or unit supervisor reading LMS programme, cohort, unit and learner reporting.',
    'Requires auth.uid(); platform admins may read cross-organisation reporting, organisation audience readers may read selected organisation reporting, and unit supervisors may read only learners connected to the requested unit.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();

delete from private.rpc_security_classifications
where function_schema = 'public'
  and function_name = 'admin_get_lms_reporting'
  and identity_arguments = 'p_organization_id uuid, p_programme_id uuid, p_cohort_id uuid, p_limit integer';
