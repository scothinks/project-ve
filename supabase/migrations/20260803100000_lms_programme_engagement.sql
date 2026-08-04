do $$ begin
  create type public.lms_reward_owner_scope as enum (
    'platform_owned',
    'organization_owned',
    'programme_sponsored'
  );
exception when duplicate_object then null;
end $$;

alter table public.rewards
  add column if not exists owner_scope public.lms_reward_owner_scope not null default 'platform_owned',
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists sponsored_programme_id uuid references public.programmes(id) on delete restrict,
  add column if not exists shared_with_programmes boolean not null default false;

update public.rewards
set shared_with_programmes = true
where owner_scope = 'platform_owned'
  and organization_id is null
  and sponsored_programme_id is null;

alter table public.rewards
  drop constraint if exists rewards_lms_owner_scope_check;

alter table public.rewards
  add constraint rewards_lms_owner_scope_check
  check (
    (
      owner_scope = 'platform_owned'
      and organization_id is null
      and sponsored_programme_id is null
    )
    or (
      owner_scope = 'organization_owned'
      and organization_id is not null
      and sponsored_programme_id is null
    )
    or (
      owner_scope = 'programme_sponsored'
      and organization_id is not null
      and sponsored_programme_id is not null
    )
  );

create index if not exists rewards_lms_owner_idx
  on public.rewards(owner_scope, organization_id, sponsored_programme_id);

create index if not exists rewards_shared_programmes_idx
  on public.rewards(shared_with_programmes)
  where owner_scope = 'platform_owned';

create or replace function public.enforce_reward_lms_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme_organization_id uuid;
begin
  if new.owner_scope = 'platform_owned' then
    new.organization_id := null;
    new.sponsored_programme_id := null;
  end if;

  if new.owner_scope = 'organization_owned' then
    new.sponsored_programme_id := null;

    if new.organization_id is null
      or not exists (
        select 1
        from public.organizations organization
        where organization.id = new.organization_id
          and organization.status <> 'archived'
      )
    then
      raise exception 'Organisation-owned rewards require an active organisation.';
    end if;
  end if;

  if new.owner_scope = 'programme_sponsored' then
    if new.organization_id is null or new.sponsored_programme_id is null then
      raise exception 'Programme-sponsored rewards require an organisation and programme.';
    end if;

    select programme.organization_id
      into v_programme_organization_id
    from public.programmes programme
    where programme.id = new.sponsored_programme_id
      and programme.status <> 'archived';

    if v_programme_organization_id is null then
      raise exception 'Programme-sponsored rewards require an active programme.';
    end if;

    if v_programme_organization_id <> new.organization_id then
      raise exception 'Programme-sponsored reward organisation must match the programme organisation.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_reward_lms_ownership_trigger on public.rewards;
create trigger enforce_reward_lms_ownership_trigger
  before insert or update of owner_scope, organization_id, sponsored_programme_id on public.rewards
  for each row execute function public.enforce_reward_lms_ownership();

revoke execute on function public.enforce_reward_lms_ownership() from public, anon, authenticated, service_role;

create or replace function public.current_programme_can_use_reward(
  p_programme_id uuid,
  p_reward_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programmes programme
    join public.rewards reward
      on reward.id = p_reward_id
    where programme.id = p_programme_id
      and reward.status <> 'archived'
      and (
        (
          reward.owner_scope = 'platform_owned'
          and reward.shared_with_programmes
        )
        or (
          reward.owner_scope = 'organization_owned'
          and reward.organization_id = programme.organization_id
        )
        or (
          reward.owner_scope = 'programme_sponsored'
          and reward.sponsored_programme_id = programme.id
          and reward.organization_id = programme.organization_id
        )
      )
  );
$$;

revoke execute on function public.current_programme_can_use_reward(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.enforce_programme_reward_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_programme_can_use_reward(new.programme_id, new.reward_id) then
    raise exception 'Programme rewards must be shared platform rewards, organisation-owned rewards for the same organisation, or rewards sponsored by this programme.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_programme_reward_scope_trigger on public.programme_rewards;
create trigger enforce_programme_reward_scope_trigger
  before insert or update on public.programme_rewards
  for each row execute function public.enforce_programme_reward_scope();

revoke execute on function public.enforce_programme_reward_scope() from public, anon, authenticated, service_role;

create or replace function public.enforce_programme_mission_reward_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_id text;
begin
  select mission.reward_id
    into v_reward_id
  from public.missions mission
  where mission.id = new.mission_id;

  if v_reward_id is not null
    and not public.current_programme_can_use_reward(new.programme_id, v_reward_id)
  then
    raise exception 'Programme missions with reward grants must use rewards available to the programme.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_programme_mission_reward_scope_trigger on public.programme_missions;
create trigger enforce_programme_mission_reward_scope_trigger
  before insert or update on public.programme_missions
  for each row execute function public.enforce_programme_mission_reward_scope();

revoke execute on function public.enforce_programme_mission_reward_scope() from public, anon, authenticated, service_role;

create or replace function public.admin_set_reward_lms_ownership(
  p_reward_id text,
  p_owner_scope public.lms_reward_owner_scope,
  p_organization_id uuid,
  p_sponsored_programme_id uuid,
  p_shared_with_programmes boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_organization_id uuid := p_organization_id;
  v_sponsored_programme_id uuid := p_sponsored_programme_id;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage reward ownership.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if p_owner_scope = 'platform_owned' then
    v_organization_id := null;
    v_sponsored_programme_id := null;
  elsif p_owner_scope = 'organization_owned' then
    v_sponsored_programme_id := null;
  elsif p_owner_scope = 'programme_sponsored' and v_organization_id is null then
    select programme.organization_id
      into v_organization_id
    from public.programmes programme
    where programme.id = v_sponsored_programme_id;
  end if;

  update public.rewards
  set owner_scope = coalesce(p_owner_scope, 'platform_owned'::public.lms_reward_owner_scope),
      organization_id = v_organization_id,
      sponsored_programme_id = v_sponsored_programme_id,
      shared_with_programmes = case
        when coalesce(p_owner_scope, 'platform_owned'::public.lms_reward_owner_scope) = 'platform_owned'
          then coalesce(p_shared_with_programmes, false)
        else false
      end,
      updated_at = now()
  where id = p_reward_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'reward_lms_ownership_updated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'ownerScope', p_owner_scope,
      'organizationId', v_organization_id,
      'sponsoredProgrammeId', v_sponsored_programme_id,
      'sharedWithProgrammes', coalesce(p_shared_with_programmes, false)
    )
  );

  return jsonb_build_object('rewardId', p_reward_id, 'status', 'saved');
end;
$$;

revoke execute on function public.admin_set_reward_lms_ownership(text, public.lms_reward_owner_scope, uuid, uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_reward_lms_ownership(text, public.lms_reward_owner_scope, uuid, uuid, boolean) to authenticated, service_role;

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
    and public.current_programme_can_use_reward(v_programme_id, reward.id)
  order by selected.first_order;

  if (
    select count(*)::integer
    from (
      select distinct reward_id
      from unnest(coalesce(p_reward_ids, '{}'::text[])) as reward_id
      where trim(reward_id) <> ''
    ) selected_rewards
  ) <> (select count(*)::integer from public.programme_rewards where programme_id = v_programme_id) then
    raise exception 'Programme rewards must be shared platform rewards, organisation-owned rewards for the same organisation, or rewards sponsored by this programme.';
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
    'admin_set_reward_lms_ownership',
    'p_reward_id text, p_owner_scope lms_reward_owner_scope, p_organization_id uuid, p_sponsored_programme_id uuid, p_shared_with_programmes boolean',
    'ADMIN_AUTHENTICATED',
    'Platform admin configuring reward ownership and programme sharing for LMS engagement.',
    'Requires auth.uid() and platform admin rights, then validates ownership shape through the reward ownership trigger.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_programme_can_use_reward',
    'p_programme_id uuid, p_reward_id text',
    'INTERNAL_HELPER',
    'Programme engagement ownership enforcement internals.',
    'Revoked from API roles; used by programme reward and mission-reward triggers plus programme builder validation.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_reward_lms_ownership',
    '',
    'TRIGGER_ONLY',
    'Reward ownership shape enforcement trigger.',
    'Runs only as a table trigger to keep reward ownership, organisation and sponsored programme references coherent.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_programme_reward_scope',
    '',
    'TRIGGER_ONLY',
    'Programme reward ownership enforcement trigger.',
    'Runs only as a table trigger to prevent programmes from attaching rewards outside their permitted ownership scope.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_programme_mission_reward_scope',
    '',
    'TRIGGER_ONLY',
    'Programme mission reward ownership enforcement trigger.',
    'Runs only as a table trigger to ensure reward-granting missions attached to programmes use rewards available to that programme.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
