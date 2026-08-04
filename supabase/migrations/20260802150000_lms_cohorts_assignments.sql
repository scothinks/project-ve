do $$ begin
  create type public.lms_participation_status as enum (
    'active',
    'completed',
    'withdrawn'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lms_assignment_source as enum (
    'manual',
    'cohort',
    'programme'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  title text not null check (length(trim(title)) > 0),
  description text not null default '' check (length(description) <= 2000),
  status public.content_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.cohort_members (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.lms_participation_status not null default 'active',
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

create table if not exists public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  course_id text not null references public.courses(id) on delete restrict,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  assignment_source public.lms_assignment_source not null,
  due_at timestamptz,
  status public.lms_participation_status not null default 'active',
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cohort_id is not null)::integer + (user_id is not null)::integer = 1),
  check (
    (assignment_source = 'manual' and user_id is not null and cohort_id is null)
    or (assignment_source = 'cohort' and cohort_id is not null and user_id is null)
  )
);

create unique index if not exists course_assignments_unique_user_target
  on public.course_assignments(organization_id, course_id, user_id)
  where user_id is not null;

create unique index if not exists course_assignments_unique_cohort_target
  on public.course_assignments(organization_id, course_id, cohort_id)
  where cohort_id is not null;

create table if not exists public.programme_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  programme_id uuid not null references public.programmes(id) on delete restrict,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  assignment_source public.lms_assignment_source not null,
  intake_starts_at timestamptz,
  due_at timestamptz,
  status public.lms_participation_status not null default 'active',
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cohort_id is not null)::integer + (user_id is not null)::integer = 1),
  check (
    (assignment_source = 'manual' and user_id is not null and cohort_id is null)
    or (assignment_source = 'cohort' and cohort_id is not null and user_id is null)
  )
);

create unique index if not exists programme_assignments_unique_user_target
  on public.programme_assignments(organization_id, programme_id, user_id)
  where user_id is not null;

create unique index if not exists programme_assignments_unique_cohort_target
  on public.programme_assignments(organization_id, programme_id, cohort_id)
  where cohort_id is not null;

create table if not exists public.enrolments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text references public.courses(id) on delete restrict,
  programme_id uuid references public.programmes(id) on delete restrict,
  course_assignment_id uuid references public.course_assignments(id) on delete set null,
  programme_assignment_id uuid references public.programme_assignments(id) on delete set null,
  assignment_source public.lms_assignment_source not null,
  status public.lms_participation_status not null default 'active',
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  withdrawn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((course_id is not null)::integer + (programme_id is not null)::integer = 1),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (status = 'completed' and completed_at is not null and withdrawn_at is null)
    or (status = 'withdrawn' and completed_at is null and withdrawn_at is not null)
    or (status = 'active' and completed_at is null and withdrawn_at is null)
  )
);

create unique index if not exists enrolments_unique_user_course_org
  on public.enrolments(organization_id, user_id, course_id)
  where course_id is not null;

create unique index if not exists enrolments_unique_user_programme_org
  on public.enrolments(organization_id, user_id, programme_id)
  where programme_id is not null;

create index if not exists cohorts_organization_status_idx
  on public.cohorts(organization_id, status);

create index if not exists cohort_members_user_status_idx
  on public.cohort_members(user_id, status);

create index if not exists course_assignments_org_status_idx
  on public.course_assignments(organization_id, status);

create index if not exists programme_assignments_org_status_idx
  on public.programme_assignments(organization_id, status);

create index if not exists enrolments_user_status_idx
  on public.enrolments(user_id, status);

drop trigger if exists cohorts_set_updated_at on public.cohorts;
create trigger cohorts_set_updated_at
  before update on public.cohorts
  for each row execute function public.set_updated_at();

drop trigger if exists cohort_members_set_updated_at on public.cohort_members;
create trigger cohort_members_set_updated_at
  before update on public.cohort_members
  for each row execute function public.set_updated_at();

drop trigger if exists course_assignments_set_updated_at on public.course_assignments;
create trigger course_assignments_set_updated_at
  before update on public.course_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists programme_assignments_set_updated_at on public.programme_assignments;
create trigger programme_assignments_set_updated_at
  before update on public.programme_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists enrolments_set_updated_at on public.enrolments;
create trigger enrolments_set_updated_at
  before update on public.enrolments
  for each row execute function public.set_updated_at();

alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;
alter table public.course_assignments enable row level security;
alter table public.programme_assignments enable row level security;
alter table public.enrolments enable row level security;

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
        'programme_manager',
        'instructor'
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
      )
  );
$$;

revoke execute on function public.current_user_can_manage_organization_audience(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_manage_organization_audience(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_organization_audience(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_organization_audience(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_cohort(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_cohort(uuid) to authenticated, service_role;

drop policy if exists "Organization audience can read cohorts" on public.cohorts;
create policy "Organization audience can read cohorts"
  on public.cohorts for select
  using (public.current_user_can_read_cohort(id));

drop policy if exists "Organization audience managers can write cohorts" on public.cohorts;
create policy "Organization audience managers can write cohorts"
  on public.cohorts for all
  using (public.current_user_can_manage_organization_audience(organization_id))
  with check (public.current_user_can_manage_organization_audience(organization_id));

drop policy if exists "Managers and members can read cohort members" on public.cohort_members;
create policy "Managers and members can read cohort members"
  on public.cohort_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.cohorts cohort
      where cohort.id = cohort_members.cohort_id
        and public.current_user_can_read_organization_audience(cohort.organization_id)
    )
  );

drop policy if exists "Organization audience managers can write cohort members" on public.cohort_members;
create policy "Organization audience managers can write cohort members"
  on public.cohort_members for all
  using (
    exists (
      select 1
      from public.cohorts cohort
      where cohort.id = cohort_members.cohort_id
        and public.current_user_can_manage_organization_audience(cohort.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.cohorts cohort
      where cohort.id = cohort_members.cohort_id
        and public.current_user_can_manage_organization_audience(cohort.organization_id)
    )
  );

drop policy if exists "Course assignments are readable by audience" on public.course_assignments;
create policy "Course assignments are readable by audience"
  on public.course_assignments for select
  using (
    public.current_user_can_read_organization_audience(organization_id)
    or user_id = auth.uid()
    or (
      cohort_id is not null
      and exists (
        select 1
        from public.cohort_members member
        where member.cohort_id = course_assignments.cohort_id
          and member.user_id = auth.uid()
          and member.status = 'active'
      )
    )
  );

drop policy if exists "Programme assignments are readable by audience" on public.programme_assignments;
create policy "Programme assignments are readable by audience"
  on public.programme_assignments for select
  using (
    public.current_user_can_read_organization_audience(organization_id)
    or user_id = auth.uid()
    or (
      cohort_id is not null
      and exists (
        select 1
        from public.cohort_members member
        where member.cohort_id = programme_assignments.cohort_id
          and member.user_id = auth.uid()
          and member.status = 'active'
      )
    )
  );

drop policy if exists "Enrolments are readable by audience" on public.enrolments;
create policy "Enrolments are readable by audience"
  on public.enrolments for select
  using (
    public.current_user_can_read_organization_audience(organization_id)
    or user_id = auth.uid()
  );

drop policy if exists "Organization audience managers can write course assignments" on public.course_assignments;
create policy "Organization audience managers can write course assignments"
  on public.course_assignments for all
  using (public.current_user_can_manage_organization_audience(organization_id))
  with check (public.current_user_can_manage_organization_audience(organization_id));

drop policy if exists "Organization audience managers can write programme assignments" on public.programme_assignments;
create policy "Organization audience managers can write programme assignments"
  on public.programme_assignments for all
  using (public.current_user_can_manage_organization_audience(organization_id))
  with check (public.current_user_can_manage_organization_audience(organization_id));

drop policy if exists "Organization audience managers can write enrolments" on public.enrolments;
create policy "Organization audience managers can write enrolments"
  on public.enrolments for all
  using (public.current_user_can_manage_organization_audience(organization_id))
  with check (public.current_user_can_manage_organization_audience(organization_id));

create or replace function public.enforce_lms_assignment_boundaries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_programme public.programmes%rowtype;
  v_cohort public.cohorts%rowtype;
begin
  if tg_table_name = 'course_assignments' then
    select *
      into v_course
    from public.courses
    where id = new.course_id;

    if not found then
      raise exception 'Course not found.';
    end if;

    if v_course.status = 'archived' then
      raise exception 'Archived courses cannot be assigned.';
    end if;

    if v_course.catalog_scope <> 'platform'
      and v_course.organization_id <> new.organization_id
    then
      raise exception 'Organisation-owned courses can only be assigned inside the same organisation.';
    end if;
  end if;

  if tg_table_name = 'programme_assignments' then
    select *
      into v_programme
    from public.programmes
    where id = new.programme_id;

    if not found then
      raise exception 'Programme not found.';
    end if;

    if v_programme.organization_id <> new.organization_id then
      raise exception 'Programmes can only be assigned inside their owning organisation.';
    end if;
  end if;

  if new.cohort_id is not null then
    select *
      into v_cohort
    from public.cohorts
    where id = new.cohort_id;

    if not found then
      raise exception 'Cohort not found.';
    end if;

    if v_cohort.organization_id <> new.organization_id then
      raise exception 'Cohorts can only receive assignments inside their owning organisation.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_course_assignment_boundaries_trigger on public.course_assignments;
create trigger enforce_course_assignment_boundaries_trigger
  before insert or update on public.course_assignments
  for each row execute function public.enforce_lms_assignment_boundaries();

drop trigger if exists enforce_programme_assignment_boundaries_trigger on public.programme_assignments;
create trigger enforce_programme_assignment_boundaries_trigger
  before insert or update on public.programme_assignments
  for each row execute function public.enforce_lms_assignment_boundaries();

revoke execute on function public.enforce_lms_assignment_boundaries() from public, anon, authenticated, service_role;

create or replace function public.admin_upsert_cohort(
  p_cohort_id uuid,
  p_organization_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_status public.content_status,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_cohort_id uuid := coalesce(p_cohort_id, gen_random_uuid());
  v_title text := trim(coalesce(p_title, ''));
  v_slug text := public.admin_slugify(coalesce(nullif(trim(coalesce(p_slug, '')), ''), p_title));
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_audience(p_organization_id) then
    raise exception 'Audience manager access required.';
  end if;

  if not exists(select 1 from public.organizations where id = p_organization_id and status <> 'archived') then
    raise exception 'Organization not found.';
  end if;

  if v_title = '' then
    raise exception 'Cohort title is required.';
  end if;

  if v_slug = '' then
    v_slug := 'cohort';
  end if;

  if p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at then
    raise exception 'Cohort end must be after the start.';
  end if;

  if p_cohort_id is not null and not exists(select 1 from public.cohorts where id = p_cohort_id) then
    raise exception 'Cohort not found.';
  end if;

  insert into public.cohorts (
    id,
    organization_id,
    slug,
    title,
    description,
    status,
    starts_at,
    ends_at,
    created_by
  )
  values (
    v_cohort_id,
    p_organization_id,
    v_slug,
    v_title,
    trim(coalesce(p_description, '')),
    coalesce(p_status, 'draft'::public.content_status),
    p_starts_at,
    p_ends_at,
    v_actor_id
  )
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        slug = excluded.slug,
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when p_cohort_id is null then 'cohort_created' else 'cohort_updated' end,
    'cohort',
    v_cohort_id::text,
    jsonb_build_object('organizationId', p_organization_id)
  );

  return jsonb_build_object('cohortId', v_cohort_id, 'status', coalesce(p_status, 'draft'::public.content_status));
end;
$$;

create or replace function public.admin_replace_cohort_members(
  p_cohort_id uuid,
  p_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_cohort public.cohorts%rowtype;
  v_selected_count integer := 0;
begin
  select *
    into v_cohort
  from public.cohorts
  where id = p_cohort_id;

  if not found then
    raise exception 'Cohort not found.';
  end if;

  if v_actor_id is null or not public.current_user_can_manage_organization_audience(v_cohort.organization_id) then
    raise exception 'Audience manager access required.';
  end if;

  create temporary table if not exists pg_temp.admin_cohort_member_selection (
    user_id uuid primary key
  ) on commit drop;

  truncate table pg_temp.admin_cohort_member_selection;

  insert into pg_temp.admin_cohort_member_selection (user_id)
  select distinct user_id
  from unnest(coalesce(p_user_ids, '{}'::uuid[])) as user_id
  where user_id is not null;

  select count(*)::integer
    into v_selected_count
  from pg_temp.admin_cohort_member_selection;

  if v_selected_count <> (
    select count(*)::integer
    from pg_temp.admin_cohort_member_selection selected
    join public.profiles profile
      on profile.id = selected.user_id
  ) then
    raise exception 'Cohort members must reference existing users.';
  end if;

  update public.cohort_members member
  set status = 'withdrawn',
      updated_at = now()
  where member.cohort_id = p_cohort_id
    and not exists (
      select 1
      from pg_temp.admin_cohort_member_selection selected
      where selected.user_id = member.user_id
    );

  insert into public.cohort_members (
    cohort_id,
    user_id,
    status,
    added_by
  )
  select
    p_cohort_id,
    selected.user_id,
    'active',
    v_actor_id
  from pg_temp.admin_cohort_member_selection selected
  on conflict (cohort_id, user_id) do update
    set status = 'active',
        added_by = excluded.added_by,
        updated_at = now();

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'cohort_members_replaced',
    'cohort',
    p_cohort_id::text,
    jsonb_build_object('memberCount', v_selected_count)
  );

  return jsonb_build_object('cohortId', p_cohort_id, 'memberCount', v_selected_count);
end;
$$;

create or replace function public.admin_assign_course(
  p_organization_id uuid,
  p_course_id text,
  p_user_ids uuid[],
  p_cohort_ids uuid[],
  p_due_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_manual_assignment_count integer := 0;
  v_cohort_assignment_count integer := 0;
  v_enrolment_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_audience(p_organization_id) then
    raise exception 'Audience manager access required.';
  end if;

  create temporary table if not exists pg_temp.admin_course_assignment_users (
    user_id uuid primary key,
    course_assignment_id uuid
  ) on commit drop;

  create temporary table if not exists pg_temp.admin_course_assignment_cohorts (
    cohort_id uuid primary key,
    course_assignment_id uuid
  ) on commit drop;

  truncate table pg_temp.admin_course_assignment_users, pg_temp.admin_course_assignment_cohorts;

  insert into pg_temp.admin_course_assignment_users (user_id)
  select distinct user_id
  from unnest(coalesce(p_user_ids, '{}'::uuid[])) as user_id
  where user_id is not null;

  insert into pg_temp.admin_course_assignment_cohorts (cohort_id)
  select distinct cohort_id
  from unnest(coalesce(p_cohort_ids, '{}'::uuid[])) as cohort_id
  where cohort_id is not null;

  if exists (
    select 1
    from pg_temp.admin_course_assignment_users selected
    left join public.profiles profile
      on profile.id = selected.user_id
    where profile.id is null
  ) then
    raise exception 'Course assignment users must reference existing users.';
  end if;

  if exists (
    select 1
    from pg_temp.admin_course_assignment_cohorts selected
    left join public.cohorts cohort
      on cohort.id = selected.cohort_id
     and cohort.organization_id = p_organization_id
    where cohort.id is null
  ) then
    raise exception 'Course assignment cohorts must belong to the selected organisation.';
  end if;

  insert into public.course_assignments (
    organization_id,
    course_id,
    user_id,
    assignment_source,
    due_at,
    assigned_by
  )
  select
    p_organization_id,
    p_course_id,
    selected.user_id,
    'manual',
    p_due_at,
    v_actor_id
  from pg_temp.admin_course_assignment_users selected
  on conflict (organization_id, course_id, user_id)
    where user_id is not null
  do update
    set due_at = excluded.due_at,
        status = 'active',
        assigned_by = excluded.assigned_by,
        updated_at = now();

  update pg_temp.admin_course_assignment_users selected
  set course_assignment_id = assignment.id
  from public.course_assignments assignment
  where assignment.organization_id = p_organization_id
    and assignment.course_id = p_course_id
    and assignment.user_id = selected.user_id;

  get diagnostics v_manual_assignment_count = row_count;

  insert into public.course_assignments (
    organization_id,
    course_id,
    cohort_id,
    assignment_source,
    due_at,
    assigned_by
  )
  select
    p_organization_id,
    p_course_id,
    selected.cohort_id,
    'cohort',
    p_due_at,
    v_actor_id
  from pg_temp.admin_course_assignment_cohorts selected
  on conflict (organization_id, course_id, cohort_id)
    where cohort_id is not null
  do update
    set due_at = excluded.due_at,
        status = 'active',
        assigned_by = excluded.assigned_by,
        updated_at = now();

  update pg_temp.admin_course_assignment_cohorts selected
  set course_assignment_id = assignment.id
  from public.course_assignments assignment
  where assignment.organization_id = p_organization_id
    and assignment.course_id = p_course_id
    and assignment.cohort_id = selected.cohort_id;

  get diagnostics v_cohort_assignment_count = row_count;

  insert into public.enrolments (
    organization_id,
    user_id,
    course_id,
    course_assignment_id,
    assignment_source,
    due_at,
    metadata
  )
  select
    p_organization_id,
    selected.user_id,
    p_course_id,
    selected.course_assignment_id,
    'manual'::public.lms_assignment_source,
    p_due_at,
    '{}'::jsonb
  from pg_temp.admin_course_assignment_users selected
  union all
  select
    p_organization_id,
    member.user_id,
    p_course_id,
    selected.course_assignment_id,
    'cohort'::public.lms_assignment_source,
    p_due_at,
    jsonb_build_object('cohortId', selected.cohort_id)
  from pg_temp.admin_course_assignment_cohorts selected
  join public.cohort_members member
    on member.cohort_id = selected.cohort_id
   and member.status = 'active'
  on conflict (organization_id, user_id, course_id)
    where course_id is not null
  do update
    set course_assignment_id = excluded.course_assignment_id,
        assignment_source = excluded.assignment_source,
        status = 'active',
        due_at = excluded.due_at,
        metadata = enrolments.metadata || excluded.metadata,
        updated_at = now();

  get diagnostics v_enrolment_count = row_count;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'course_assigned',
    'course',
    p_course_id,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'manualAssignments', v_manual_assignment_count,
      'cohortAssignments', v_cohort_assignment_count,
      'enrolments', v_enrolment_count
    )
  );

  return jsonb_build_object(
    'courseId', p_course_id,
    'manualAssignments', v_manual_assignment_count,
    'cohortAssignments', v_cohort_assignment_count,
    'enrolments', v_enrolment_count
  );
end;
$$;

create or replace function public.admin_assign_programme(
  p_programme_id uuid,
  p_user_ids uuid[],
  p_cohort_ids uuid[],
  p_intake_starts_at timestamptz,
  p_due_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_programme public.programmes%rowtype;
  v_manual_assignment_count integer := 0;
  v_cohort_assignment_count integer := 0;
  v_programme_enrolment_count integer := 0;
  v_course_enrolment_count integer := 0;
begin
  select *
    into v_programme
  from public.programmes
  where id = p_programme_id;

  if not found then
    raise exception 'Programme not found.';
  end if;

  if v_actor_id is null or not public.current_user_can_manage_organization_audience(v_programme.organization_id) then
    raise exception 'Audience manager access required.';
  end if;

  create temporary table if not exists pg_temp.admin_programme_assignment_users (
    user_id uuid primary key,
    programme_assignment_id uuid
  ) on commit drop;

  create temporary table if not exists pg_temp.admin_programme_assignment_cohorts (
    cohort_id uuid primary key,
    programme_assignment_id uuid
  ) on commit drop;

  truncate table pg_temp.admin_programme_assignment_users, pg_temp.admin_programme_assignment_cohorts;

  insert into pg_temp.admin_programme_assignment_users (user_id)
  select distinct user_id
  from unnest(coalesce(p_user_ids, '{}'::uuid[])) as user_id
  where user_id is not null;

  insert into pg_temp.admin_programme_assignment_cohorts (cohort_id)
  select distinct cohort_id
  from unnest(coalesce(p_cohort_ids, '{}'::uuid[])) as cohort_id
  where cohort_id is not null;

  if exists (
    select 1
    from pg_temp.admin_programme_assignment_users selected
    left join public.profiles profile
      on profile.id = selected.user_id
    where profile.id is null
  ) then
    raise exception 'Programme assignment users must reference existing users.';
  end if;

  if exists (
    select 1
    from pg_temp.admin_programme_assignment_cohorts selected
    left join public.cohorts cohort
      on cohort.id = selected.cohort_id
     and cohort.organization_id = v_programme.organization_id
    where cohort.id is null
  ) then
    raise exception 'Programme assignment cohorts must belong to the programme organisation.';
  end if;

  insert into public.programme_assignments (
    organization_id,
    programme_id,
    user_id,
    assignment_source,
    intake_starts_at,
    due_at,
    assigned_by
  )
  select
    v_programme.organization_id,
    p_programme_id,
    selected.user_id,
    'manual',
    p_intake_starts_at,
    p_due_at,
    v_actor_id
  from pg_temp.admin_programme_assignment_users selected
  on conflict (organization_id, programme_id, user_id)
    where user_id is not null
  do update
    set intake_starts_at = excluded.intake_starts_at,
        due_at = excluded.due_at,
        status = 'active',
        assigned_by = excluded.assigned_by,
        updated_at = now();

  update pg_temp.admin_programme_assignment_users selected
  set programme_assignment_id = assignment.id
  from public.programme_assignments assignment
  where assignment.organization_id = v_programme.organization_id
    and assignment.programme_id = p_programme_id
    and assignment.user_id = selected.user_id;

  get diagnostics v_manual_assignment_count = row_count;

  insert into public.programme_assignments (
    organization_id,
    programme_id,
    cohort_id,
    assignment_source,
    intake_starts_at,
    due_at,
    assigned_by
  )
  select
    v_programme.organization_id,
    p_programme_id,
    selected.cohort_id,
    'cohort',
    p_intake_starts_at,
    p_due_at,
    v_actor_id
  from pg_temp.admin_programme_assignment_cohorts selected
  on conflict (organization_id, programme_id, cohort_id)
    where cohort_id is not null
  do update
    set intake_starts_at = excluded.intake_starts_at,
        due_at = excluded.due_at,
        status = 'active',
        assigned_by = excluded.assigned_by,
        updated_at = now();

  update pg_temp.admin_programme_assignment_cohorts selected
  set programme_assignment_id = assignment.id
  from public.programme_assignments assignment
  where assignment.organization_id = v_programme.organization_id
    and assignment.programme_id = p_programme_id
    and assignment.cohort_id = selected.cohort_id;

  get diagnostics v_cohort_assignment_count = row_count;

  insert into public.enrolments (
    organization_id,
    user_id,
    programme_id,
    programme_assignment_id,
    assignment_source,
    due_at,
    metadata
  )
  select
    v_programme.organization_id,
    selected.user_id,
    p_programme_id,
    selected.programme_assignment_id,
    'manual'::public.lms_assignment_source,
    p_due_at,
    jsonb_build_object('intakeStartsAt', p_intake_starts_at)
  from pg_temp.admin_programme_assignment_users selected
  union all
  select
    v_programme.organization_id,
    member.user_id,
    p_programme_id,
    selected.programme_assignment_id,
    'cohort'::public.lms_assignment_source,
    p_due_at,
    jsonb_build_object('cohortId', selected.cohort_id, 'intakeStartsAt', p_intake_starts_at)
  from pg_temp.admin_programme_assignment_cohorts selected
  join public.cohort_members member
    on member.cohort_id = selected.cohort_id
   and member.status = 'active'
  on conflict (organization_id, user_id, programme_id)
    where programme_id is not null
  do update
    set programme_assignment_id = excluded.programme_assignment_id,
        assignment_source = excluded.assignment_source,
        status = 'active',
        due_at = excluded.due_at,
        metadata = enrolments.metadata || excluded.metadata,
        updated_at = now();

  get diagnostics v_programme_enrolment_count = row_count;

  insert into public.enrolments (
    organization_id,
    user_id,
    course_id,
    programme_assignment_id,
    assignment_source,
    due_at,
    metadata
  )
  select
    v_programme.organization_id,
    enrolment_users.user_id,
    programme_course.course_id,
    enrolment_users.programme_assignment_id,
    'programme'::public.lms_assignment_source,
    p_due_at,
    jsonb_build_object('programmeId', p_programme_id, 'intakeStartsAt', p_intake_starts_at)
  from (
    select selected.user_id, selected.programme_assignment_id
    from pg_temp.admin_programme_assignment_users selected
    union
    select member.user_id, selected.programme_assignment_id
    from pg_temp.admin_programme_assignment_cohorts selected
    join public.cohort_members member
      on member.cohort_id = selected.cohort_id
     and member.status = 'active'
  ) enrolment_users
  join public.programme_courses programme_course
    on programme_course.programme_id = p_programme_id
  on conflict (organization_id, user_id, course_id)
    where course_id is not null
  do update
    set programme_assignment_id = excluded.programme_assignment_id,
        assignment_source = excluded.assignment_source,
        status = 'active',
        due_at = excluded.due_at,
        metadata = enrolments.metadata || excluded.metadata,
        updated_at = now();

  get diagnostics v_course_enrolment_count = row_count;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'programme_assigned',
    'programme',
    p_programme_id::text,
    jsonb_build_object(
      'organizationId', v_programme.organization_id,
      'manualAssignments', v_manual_assignment_count,
      'cohortAssignments', v_cohort_assignment_count,
      'programmeEnrolments', v_programme_enrolment_count,
      'courseEnrolments', v_course_enrolment_count
    )
  );

  return jsonb_build_object(
    'programmeId', p_programme_id,
    'manualAssignments', v_manual_assignment_count,
    'cohortAssignments', v_cohort_assignment_count,
    'programmeEnrolments', v_programme_enrolment_count,
    'courseEnrolments', v_course_enrolment_count
  );
end;
$$;

create or replace function public.admin_update_enrolment_status(
  p_enrolment_id uuid,
  p_status public.lms_participation_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_enrolment public.enrolments%rowtype;
begin
  select *
    into v_enrolment
  from public.enrolments
  where id = p_enrolment_id;

  if not found then
    raise exception 'Enrolment not found.';
  end if;

  if v_actor_id is null or not public.current_user_can_manage_organization_audience(v_enrolment.organization_id) then
    raise exception 'Audience manager access required.';
  end if;

  update public.enrolments
  set status = p_status,
      completed_at = case when p_status = 'completed' then coalesce(completed_at, now()) else null end,
      withdrawn_at = case when p_status = 'withdrawn' then coalesce(withdrawn_at, now()) else null end
  where id = p_enrolment_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'enrolment_status_changed',
    'enrolment',
    p_enrolment_id::text,
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('enrolmentId', p_enrolment_id, 'status', p_status);
end;
$$;

revoke execute on function public.admin_upsert_cohort(uuid, uuid, text, text, text, public.content_status, timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_cohort(uuid, uuid, text, text, text, public.content_status, timestamptz, timestamptz) to authenticated, service_role;

revoke execute on function public.admin_replace_cohort_members(uuid, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_replace_cohort_members(uuid, uuid[]) to authenticated, service_role;

revoke execute on function public.admin_assign_course(uuid, text, uuid[], uuid[], timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_assign_course(uuid, text, uuid[], uuid[], timestamptz) to authenticated, service_role;

revoke execute on function public.admin_assign_programme(uuid, uuid[], uuid[], timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_assign_programme(uuid, uuid[], uuid[], timestamptz, timestamptz) to authenticated, service_role;

revoke execute on function public.admin_update_enrolment_status(uuid, public.lms_participation_status) from public, anon, authenticated, service_role;
grant execute on function public.admin_update_enrolment_status(uuid, public.lms_participation_status) to authenticated, service_role;

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
    'current_user_can_manage_organization_audience',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, RLS policies and LMS audience RPCs checking contextual audience management rights.',
    'Allows platform admins or active organisation_owner, organisation_admin, programme_manager or instructor memberships for the requested organization id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_read_organization_audience',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking audience-operation visibility.',
    'Allows audience managers plus active content_editor, reviewer or report_viewer memberships for the requested organization id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_read_cohort',
    'p_cohort_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking cohort visibility.',
    'Allows organisation audience readers or the active cohort member themselves.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_cohort',
    'p_cohort_id uuid, p_organization_id uuid, p_title text, p_slug text, p_description text, p_status content_status, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation audience manager cohort builder workflow.',
    'Requires auth.uid() and audience management rights in the organisation before creating or updating a cohort.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_replace_cohort_members',
    'p_cohort_id uuid, p_user_ids uuid[]',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation audience manager bulk cohort membership workflow.',
    'Requires auth.uid(), audience management rights for the cohort organisation and existing user ids before replacing active cohort membership.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_assign_course',
    'p_organization_id uuid, p_course_id text, p_user_ids uuid[], p_cohort_ids uuid[], p_due_at timestamp with time zone',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation audience manager course assignment workflow.',
    'Requires auth.uid(), audience management rights, valid users/cohorts and a platform or same-organisation course before creating assignment and enrolment rows transactionally.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_assign_programme',
    'p_programme_id uuid, p_user_ids uuid[], p_cohort_ids uuid[], p_intake_starts_at timestamp with time zone, p_due_at timestamp with time zone',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation audience manager programme assignment workflow.',
    'Requires auth.uid(), audience management rights for the programme organisation and valid users/cohorts before creating programme and course enrolment rows transactionally.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_enrolment_status',
    'p_enrolment_id uuid, p_status lms_participation_status',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation audience manager enrolment status workflow.',
    'Requires auth.uid() and audience management rights for the enrolment organisation before changing active, completed or withdrawn status.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'enforce_lms_assignment_boundaries',
    '',
    'TRIGGER_ONLY',
    'LMS assignment tenant boundary trigger.',
    'Runs only as table triggers to ensure assignments stay inside organisation, programme and course ownership boundaries.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
