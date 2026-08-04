do $$ begin
  create type public.programme_course_requirement as enum (
    'required',
    'optional'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  title text not null check (length(trim(title)) > 0),
  objective text not null default '' check (length(objective) <= 2000),
  intended_audience text not null default '' check (length(intended_audience) <= 2000),
  status public.content_status not null default 'draft',
  schedule_starts_at timestamptz,
  schedule_ends_at timestamptz,
  completion_rules jsonb not null default '{}'::jsonb,
  reporting_config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (schedule_ends_at is null or schedule_starts_at is null or schedule_ends_at > schedule_starts_at),
  check (jsonb_typeof(completion_rules) = 'object'),
  check (jsonb_typeof(reporting_config) = 'object')
);

create table if not exists public.programme_courses (
  programme_id uuid not null references public.programmes(id) on delete cascade,
  course_id text not null references public.courses(id) on delete restrict,
  sort_order integer not null check (sort_order > 0),
  requirement public.programme_course_requirement not null default 'required',
  created_at timestamptz not null default now(),
  primary key (programme_id, course_id),
  unique (programme_id, sort_order)
);

create table if not exists public.programme_missions (
  programme_id uuid not null references public.programmes(id) on delete cascade,
  mission_id text not null references public.missions(id) on delete restrict,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  primary key (programme_id, mission_id),
  unique (programme_id, sort_order)
);

create table if not exists public.programme_rewards (
  programme_id uuid not null references public.programmes(id) on delete cascade,
  reward_id text not null references public.rewards(id) on delete restrict,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  primary key (programme_id, reward_id),
  unique (programme_id, sort_order)
);

create table if not exists public.programme_assessments (
  programme_id uuid not null references public.programmes(id) on delete cascade,
  assessment_version_id uuid not null references public.assessment_versions(id) on delete restrict,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  primary key (programme_id, assessment_version_id),
  unique (programme_id, sort_order)
);

create index if not exists programmes_organization_status_idx
  on public.programmes(organization_id, status);

create index if not exists programme_courses_course_idx
  on public.programme_courses(course_id);

create index if not exists programme_missions_mission_idx
  on public.programme_missions(mission_id);

create index if not exists programme_rewards_reward_idx
  on public.programme_rewards(reward_id);

create index if not exists programme_assessments_assessment_idx
  on public.programme_assessments(assessment_version_id);

drop trigger if exists programmes_set_updated_at on public.programmes;
create trigger programmes_set_updated_at
  before update on public.programmes
  for each row execute function public.set_updated_at();

alter table public.programmes enable row level security;
alter table public.programme_courses enable row level security;
alter table public.programme_missions enable row level security;
alter table public.programme_rewards enable row level security;
alter table public.programme_assessments enable row level security;

create or replace function public.current_user_can_manage_organization_programmes(p_organization_id uuid)
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

create or replace function public.current_user_can_read_programme(p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programmes programme
    where programme.id = p_programme_id
      and (
        public.current_user_can_manage_organization_programmes(programme.organization_id)
        or public.current_user_has_organization_role(
          programme.organization_id,
          array['content_editor', 'reviewer', 'instructor', 'report_viewer']::public.organization_role_key[]
        )
        or (
          programme.status = 'published'
          and public.current_user_has_organization_role(programme.organization_id, null)
        )
      )
  );
$$;

create or replace function public.current_user_can_manage_programme(p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programmes programme
    where programme.id = p_programme_id
      and public.current_user_can_manage_organization_programmes(programme.organization_id)
  );
$$;

revoke execute on function public.current_user_can_manage_organization_programmes(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_manage_organization_programmes(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_programme(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_programme(uuid) to anon, authenticated, service_role;

revoke execute on function public.current_user_can_manage_programme(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_manage_programme(uuid) to authenticated, service_role;

drop policy if exists "Organization members can read programmes" on public.programmes;
create policy "Organization members can read programmes"
  on public.programmes for select
  using (public.current_user_can_read_programme(id));

drop policy if exists "Programmes can be inserted by managers" on public.programmes;
create policy "Programmes can be inserted by managers"
  on public.programmes for insert
  with check (public.current_user_can_manage_organization_programmes(organization_id));

drop policy if exists "Programmes can be updated by managers" on public.programmes;
create policy "Programmes can be updated by managers"
  on public.programmes for update
  using (public.current_user_can_manage_organization_programmes(organization_id))
  with check (public.current_user_can_manage_organization_programmes(organization_id));

drop policy if exists "Programme courses readable through programme" on public.programme_courses;
create policy "Programme courses readable through programme"
  on public.programme_courses for select
  using (public.current_user_can_read_programme(programme_id));

drop policy if exists "Programme missions readable through programme" on public.programme_missions;
create policy "Programme missions readable through programme"
  on public.programme_missions for select
  using (public.current_user_can_read_programme(programme_id));

drop policy if exists "Programme rewards readable through programme" on public.programme_rewards;
create policy "Programme rewards readable through programme"
  on public.programme_rewards for select
  using (public.current_user_can_read_programme(programme_id));

drop policy if exists "Programme assessments readable through programme" on public.programme_assessments;
create policy "Programme assessments readable through programme"
  on public.programme_assessments for select
  using (public.current_user_can_read_programme(programme_id));

drop policy if exists "Programme courses writable by managers" on public.programme_courses;
create policy "Programme courses writable by managers"
  on public.programme_courses for all
  using (public.current_user_can_manage_programme(programme_id))
  with check (public.current_user_can_manage_programme(programme_id));

drop policy if exists "Programme missions writable by managers" on public.programme_missions;
create policy "Programme missions writable by managers"
  on public.programme_missions for all
  using (public.current_user_can_manage_programme(programme_id))
  with check (public.current_user_can_manage_programme(programme_id));

drop policy if exists "Programme rewards writable by managers" on public.programme_rewards;
create policy "Programme rewards writable by managers"
  on public.programme_rewards for all
  using (public.current_user_can_manage_programme(programme_id))
  with check (public.current_user_can_manage_programme(programme_id));

drop policy if exists "Programme assessments writable by managers" on public.programme_assessments;
create policy "Programme assessments writable by managers"
  on public.programme_assessments for all
  using (public.current_user_can_manage_programme(programme_id))
  with check (public.current_user_can_manage_programme(programme_id));

create or replace function public.enforce_programme_course_catalog_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes%rowtype;
  v_course public.courses%rowtype;
begin
  select *
    into v_programme
  from public.programmes
  where id = new.programme_id;

  if not found then
    raise exception 'Programme not found.';
  end if;

  select *
    into v_course
  from public.courses
  where id = new.course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  if v_course.status = 'archived' then
    raise exception 'Archived courses cannot be added to programmes.';
  end if;

  if v_course.catalog_scope <> 'platform'
    and v_course.organization_id <> v_programme.organization_id
  then
    raise exception 'Organisation-owned courses can only be used by programmes in the same organisation.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_programme_course_catalog_scope_trigger on public.programme_courses;
create trigger enforce_programme_course_catalog_scope_trigger
  before insert or update on public.programme_courses
  for each row execute function public.enforce_programme_course_catalog_scope();

revoke execute on function public.enforce_programme_course_catalog_scope() from public, anon, authenticated, service_role;

create or replace function public.admin_upsert_programme(
  p_programme_id uuid,
  p_organization_id uuid,
  p_title text,
  p_slug text,
  p_objective text,
  p_intended_audience text,
  p_status public.content_status,
  p_schedule_starts_at timestamptz,
  p_schedule_ends_at timestamptz,
  p_completion_rules jsonb,
  p_course_ids text[],
  p_mission_ids text[],
  p_reward_ids text[],
  p_assessment_version_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_programme_id uuid := coalesce(p_programme_id, gen_random_uuid());
  v_title text := trim(coalesce(p_title, ''));
  v_slug text := public.admin_slugify(coalesce(nullif(trim(coalesce(p_slug, '')), ''), p_title));
  v_objective text := trim(coalesce(p_objective, ''));
  v_intended_audience text := trim(coalesce(p_intended_audience, ''));
  v_completion_rules jsonb := coalesce(p_completion_rules, '{}'::jsonb);
  v_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
  v_course_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_programmes(p_organization_id) then
    raise exception 'Programme manager access required.';
  end if;

  if not exists(select 1 from public.organizations where id = p_organization_id and status <> 'archived') then
    raise exception 'Organization not found.';
  end if;

  if v_title = '' then
    raise exception 'Programme title is required.';
  end if;

  if v_slug = '' then
    v_slug := 'programme';
  end if;

  if jsonb_typeof(v_completion_rules) <> 'object' then
    raise exception 'Completion rules must be a JSON object.';
  end if;

  if p_schedule_ends_at is not null
    and p_schedule_starts_at is not null
    and p_schedule_ends_at <= p_schedule_starts_at
  then
    raise exception 'Programme schedule end must be after the start.';
  end if;

  select count(*)::integer
    into v_course_count
  from (
    select distinct course_id
    from unnest(coalesce(p_course_ids, '{}'::text[])) as course_id
    where trim(course_id) <> ''
  ) selected_courses;

  if v_status = 'published' and v_course_count = 0 then
    raise exception 'Published programmes require at least one course.';
  end if;

  if v_status = 'published' and (v_objective = '' or v_intended_audience = '') then
    raise exception 'Published programmes require an objective and intended audience.';
  end if;

  if p_programme_id is not null then
    if not exists(select 1 from public.programmes where id = p_programme_id) then
      raise exception 'Programme not found.';
    end if;

    if not public.current_user_can_manage_programme(p_programme_id) then
      raise exception 'Programme manager access required.';
    end if;
  end if;

  insert into public.programmes (
    id,
    organization_id,
    slug,
    title,
    objective,
    intended_audience,
    status,
    schedule_starts_at,
    schedule_ends_at,
    completion_rules,
    reporting_config,
    created_by
  )
  values (
    v_programme_id,
    p_organization_id,
    v_slug,
    v_title,
    v_objective,
    v_intended_audience,
    v_status,
    p_schedule_starts_at,
    p_schedule_ends_at,
    v_completion_rules,
    jsonb_build_object('version', 1),
    v_actor_id
  )
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        slug = excluded.slug,
        title = excluded.title,
        objective = excluded.objective,
        intended_audience = excluded.intended_audience,
        status = excluded.status,
        schedule_starts_at = excluded.schedule_starts_at,
        schedule_ends_at = excluded.schedule_ends_at,
        completion_rules = excluded.completion_rules;

  delete from public.programme_courses
  where programme_id = v_programme_id;

  insert into public.programme_courses (
    programme_id,
    course_id,
    sort_order,
    requirement
  )
  select
    v_programme_id,
    selected.course_id,
    row_number() over (order by selected.first_order)::integer,
    'required'
  from (
    select course_id, min(item_order) as first_order
    from unnest(coalesce(p_course_ids, '{}'::text[])) with ordinality as input(course_id, item_order)
    where trim(course_id) <> ''
    group by course_id
  ) selected
  join public.courses course
    on course.id = selected.course_id
  where course.status <> 'archived'
    and (
      course.catalog_scope = 'platform'
      or course.organization_id = p_organization_id
    )
  order by selected.first_order;

  if v_course_count <> (select count(*)::integer from public.programme_courses where programme_id = v_programme_id) then
    raise exception 'Programme courses must be active platform courses or organisation-owned courses for the same organisation.';
  end if;

  delete from public.programme_missions
  where programme_id = v_programme_id;

  insert into public.programme_missions (
    programme_id,
    mission_id,
    sort_order
  )
  select
    v_programme_id,
    selected.mission_id,
    row_number() over (order by selected.first_order)::integer
  from (
    select mission_id, min(item_order) as first_order
    from unnest(coalesce(p_mission_ids, '{}'::text[])) with ordinality as input(mission_id, item_order)
    where trim(mission_id) <> ''
    group by mission_id
  ) selected
  join public.missions mission
    on mission.id = selected.mission_id
  where mission.status <> 'archived'
  order by selected.first_order;

  if (
    select count(*)::integer
    from (
      select distinct mission_id
      from unnest(coalesce(p_mission_ids, '{}'::text[])) as mission_id
      where trim(mission_id) <> ''
    ) selected_missions
  ) <> (select count(*)::integer from public.programme_missions where programme_id = v_programme_id) then
    raise exception 'Programme missions must reference active missions.';
  end if;

  delete from public.programme_rewards
  where programme_id = v_programme_id;

  insert into public.programme_rewards (
    programme_id,
    reward_id,
    sort_order
  )
  select
    v_programme_id,
    selected.reward_id,
    row_number() over (order by selected.first_order)::integer
  from (
    select reward_id, min(item_order) as first_order
    from unnest(coalesce(p_reward_ids, '{}'::text[])) with ordinality as input(reward_id, item_order)
    where trim(reward_id) <> ''
    group by reward_id
  ) selected
  join public.rewards reward
    on reward.id = selected.reward_id
  where reward.status <> 'archived'
  order by selected.first_order;

  if (
    select count(*)::integer
    from (
      select distinct reward_id
      from unnest(coalesce(p_reward_ids, '{}'::text[])) as reward_id
      where trim(reward_id) <> ''
    ) selected_rewards
  ) <> (select count(*)::integer from public.programme_rewards where programme_id = v_programme_id) then
    raise exception 'Programme rewards must reference active rewards.';
  end if;

  delete from public.programme_assessments
  where programme_id = v_programme_id;

  insert into public.programme_assessments (
    programme_id,
    assessment_version_id,
    sort_order
  )
  select
    v_programme_id,
    selected.assessment_version_id,
    row_number() over (order by selected.first_order)::integer
  from (
    select assessment_version_id, min(item_order) as first_order
    from unnest(coalesce(p_assessment_version_ids, '{}'::uuid[])) with ordinality as input(assessment_version_id, item_order)
    where assessment_version_id is not null
    group by assessment_version_id
  ) selected
  join public.assessment_versions assessment
    on assessment.id = selected.assessment_version_id
  where assessment.status <> 'archived'
  order by selected.first_order;

  if (
    select count(*)::integer
    from (
      select distinct assessment_version_id
      from unnest(coalesce(p_assessment_version_ids, '{}'::uuid[])) as assessment_version_id
      where assessment_version_id is not null
    ) selected_assessments
  ) <> (select count(*)::integer from public.programme_assessments where programme_id = v_programme_id) then
    raise exception 'Programme assessments must reference active assessment versions.';
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when p_programme_id is null then 'programme_created' else 'programme_updated' end,
    'programme',
    v_programme_id::text,
    jsonb_build_object('organizationId', p_organization_id, 'status', v_status)
  );

  return jsonb_build_object('programmeId', v_programme_id, 'status', v_status);
end;
$$;

create or replace function public.admin_set_programme_status(
  p_programme_id uuid,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_programme public.programmes%rowtype;
begin
  if v_actor_id is null or not public.current_user_can_manage_programme(p_programme_id) then
    raise exception 'Programme manager access required.';
  end if;

  select *
    into v_programme
  from public.programmes
  where id = p_programme_id;

  if not found then
    raise exception 'Programme not found.';
  end if;

  if p_status = 'published' then
    if trim(v_programme.objective) = '' or trim(v_programme.intended_audience) = '' then
      raise exception 'Published programmes require an objective and intended audience.';
    end if;

    if not exists(select 1 from public.programme_courses where programme_id = p_programme_id) then
      raise exception 'Published programmes require at least one course.';
    end if;
  end if;

  update public.programmes
  set status = p_status
  where id = p_programme_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'programme_status_changed',
    'programme',
    p_programme_id::text,
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('programmeId', p_programme_id, 'status', p_status);
end;
$$;

revoke execute on function public.admin_upsert_programme(uuid, uuid, text, text, text, text, public.content_status, timestamptz, timestamptz, jsonb, text[], text[], text[], uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_programme(uuid, uuid, text, text, text, text, public.content_status, timestamptz, timestamptz, jsonb, text[], text[], text[], uuid[]) to authenticated, service_role;

revoke execute on function public.admin_set_programme_status(uuid, public.content_status) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_programme_status(uuid, public.content_status) to authenticated, service_role;

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
    'current_user_can_manage_organization_programmes',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, RLS policies and LMS programme RPCs checking contextual programme management rights.',
    'Allows platform admins or active organisation_owner, organisation_admin or programme_manager memberships for the requested organization id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_read_programme',
    'p_programme_id uuid',
    'PUBLIC_ANON',
    'Authenticated app and RLS policies checking programme visibility within an organisation.',
    'Allows programme managers, content/review/reporting staff, and active organisation members for published programmes; anonymous callers have no organisation membership and receive false.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_manage_programme',
    'p_programme_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, RLS policies and LMS programme RPCs checking programme management rights.',
    'Allows platform admins or active organisation_owner, organisation_admin or programme_manager memberships for the owning organisation.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_programme',
    'p_programme_id uuid, p_organization_id uuid, p_title text, p_slug text, p_objective text, p_intended_audience text, p_status content_status, p_schedule_starts_at timestamp with time zone, p_schedule_ends_at timestamp with time zone, p_completion_rules jsonb, p_course_ids text[], p_mission_ids text[], p_reward_ids text[], p_assessment_version_ids uuid[]',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation programme manager programme builder workflow.',
    'Requires auth.uid(), programme management rights in the organisation, and validates linked courses, missions, rewards and assessments before replacing programme relationships transactionally.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_set_programme_status',
    'p_programme_id uuid, p_status content_status',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation programme manager programme lifecycle workflow.',
    'Requires auth.uid(), programme management rights on the owning organisation, and enforces minimum publish readiness checks.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'enforce_programme_course_catalog_scope',
    '',
    'TRIGGER_ONLY',
    'Programme course ownership enforcement trigger.',
    'Runs only as a table trigger to ensure organisation-owned courses cannot be attached to programmes from another organisation.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
