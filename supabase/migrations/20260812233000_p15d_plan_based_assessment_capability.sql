alter table public.assessment_versions
  add column if not exists owner_scope text not null default 'platform'
    check (owner_scope in ('platform', 'organization')),
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists source_assessment_version_id uuid references public.assessment_versions(id) on delete restrict,
  add column if not exists version_number integer not null default 1 check (version_number > 0),
  add column if not exists introduction_copy text not null default '',
  add column if not exists completion_copy text not null default '',
  add column if not exists scoring_config jsonb not null default '{}'::jsonb;

alter table public.assessment_versions
  drop constraint if exists assessment_versions_owner_scope_shape,
  add constraint assessment_versions_owner_scope_shape
  check (
    (owner_scope = 'platform' and organization_id is null)
    or (owner_scope = 'organization' and organization_id is not null)
  );

alter table public.assessment_versions
  drop constraint if exists assessment_versions_scoring_config_object,
  add constraint assessment_versions_scoring_config_object
  check (jsonb_typeof(scoring_config) = 'object');

create index if not exists assessment_versions_owner_scope_idx
  on public.assessment_versions(owner_scope, organization_id, status);

create index if not exists assessment_versions_source_idx
  on public.assessment_versions(source_assessment_version_id, version_number);

alter table public.programme_assessments
  add column if not exists is_required boolean not null default true,
  add column if not exists introduction_copy text not null default '',
  add column if not exists completion_copy text not null default '',
  add column if not exists delivery_config jsonb not null default '{}'::jsonb;

alter table public.programme_assessments
  drop constraint if exists programme_assessments_delivery_config_object,
  add constraint programme_assessments_delivery_config_object
  check (jsonb_typeof(delivery_config) = 'object');

create or replace function private.organization_assessment_capability_unchecked(
  p_organization_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    private.resolve_organization_entitlements_unchecked(p_organization_id) ->> 'assessment_capability',
    'assigned_only'
  );
$$;

revoke execute on function private.organization_assessment_capability_unchecked(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.assessment_capability_rank(p_capability text)
returns integer
language sql
immutable
security definer
set search_path = public
as $$
  select case p_capability
    when 'assigned_only' then 0
    when 'template_use' then 1
    when 'template_adaptation' then 2
    when 'custom' then 3
    else 0
  end;
$$;

revoke execute on function private.assessment_capability_rank(text)
  from public, anon, authenticated, service_role;

create or replace function private.organization_has_assessment_capability_unchecked(
  p_organization_id uuid,
  p_required_capability text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.assessment_capability_rank(private.organization_assessment_capability_unchecked(p_organization_id))
    >= private.assessment_capability_rank(p_required_capability);
$$;

revoke execute on function private.organization_has_assessment_capability_unchecked(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_can_read_assessment_version(
  p_assessment_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessment_versions version
    where version.id = p_assessment_version_id
      and (
        (
          version.owner_scope = 'platform'
          and version.status = 'published'
        )
        or public.current_user_is_admin()
        or (
          version.owner_scope = 'organization'
          and version.organization_id is not null
          and (
            public.current_user_has_organization_role(version.organization_id, null)
            or public.current_user_can_manage_organization_programmes(version.organization_id)
          )
        )
      )
  );
$$;

revoke execute on function public.current_user_can_read_assessment_version(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_assessment_version(uuid)
  to anon, authenticated, service_role;

create or replace function public.current_programme_can_use_assessment(
  p_programme_id uuid,
  p_assessment_version_id uuid
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
    join public.assessment_versions assessment
      on assessment.id = p_assessment_version_id
    where programme.id = p_programme_id
      and programme.status <> 'archived'
      and assessment.status = 'published'
      and (
        (
          assessment.owner_scope = 'platform'
          and assessment.organization_id is null
          and private.organization_has_assessment_capability_unchecked(programme.organization_id, 'template_use')
        )
        or (
          assessment.owner_scope = 'organization'
          and assessment.organization_id = programme.organization_id
          and private.organization_has_assessment_capability_unchecked(programme.organization_id, 'template_adaptation')
        )
      )
  );
$$;

revoke execute on function public.current_programme_can_use_assessment(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.enforce_programme_assessment_capability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_programme_can_use_assessment(new.programme_id, new.assessment_version_id) then
    raise exception 'Programme assessments require a Team or higher plan and must use published Project Ve templates or organisation assessments available to this programme.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_programme_assessment_capability_trigger on public.programme_assessments;
create trigger enforce_programme_assessment_capability_trigger
  before insert or update of programme_id, assessment_version_id on public.programme_assessments
  for each row execute function public.enforce_programme_assessment_capability();

revoke execute on function public.enforce_programme_assessment_capability()
  from public, anon, authenticated, service_role;

create or replace function public.enforce_published_assessment_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment_status text;
begin
  if tg_table_name = 'assessment_versions' then
    if tg_op = 'DELETE' and old.status = 'published' then
      raise exception 'Published assessment versions are immutable.';
    end if;

    if tg_op = 'UPDATE' and old.status = 'published' then
      raise exception 'Published assessment versions are immutable.';
    end if;

    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_table_name = 'assessment_questions' then
    select status into v_assessment_status
    from public.assessment_versions
    where id = coalesce(new.assessment_version_id, old.assessment_version_id);
  elsif tg_table_name = 'assessment_question_options' then
    select version.status into v_assessment_status
    from public.assessment_questions question
    join public.assessment_versions version
      on version.id = question.assessment_version_id
    where question.id = coalesce(new.question_id, old.question_id);
  elsif tg_table_name = 'assessment_option_dimension_weights' then
    select version.status into v_assessment_status
    from public.assessment_question_options option
    join public.assessment_questions question
      on question.id = option.question_id
    join public.assessment_versions version
      on version.id = question.assessment_version_id
    where option.id = coalesce(new.option_id, old.option_id);
  end if;

  if v_assessment_status = 'published' then
    raise exception 'Published assessment versions are immutable.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists assessment_versions_immutable_published on public.assessment_versions;
create trigger assessment_versions_immutable_published
  before update or delete on public.assessment_versions
  for each row execute function public.enforce_published_assessment_immutability();

drop trigger if exists assessment_questions_immutable_published on public.assessment_questions;
create trigger assessment_questions_immutable_published
  before insert or update or delete on public.assessment_questions
  for each row execute function public.enforce_published_assessment_immutability();

drop trigger if exists assessment_question_options_immutable_published on public.assessment_question_options;
create trigger assessment_question_options_immutable_published
  before insert or update or delete on public.assessment_question_options
  for each row execute function public.enforce_published_assessment_immutability();

drop trigger if exists assessment_option_weights_immutable_published on public.assessment_option_dimension_weights;
create trigger assessment_option_weights_immutable_published
  before insert or update or delete on public.assessment_option_dimension_weights
  for each row execute function public.enforce_published_assessment_immutability();

revoke execute on function public.enforce_published_assessment_immutability()
  from public, anon, authenticated, service_role;

drop policy if exists "Published assessment versions are readable" on public.assessment_versions;
create policy "Readable assessment versions follow owner scope"
  on public.assessment_versions for select
  using (public.current_user_can_read_assessment_version(id));

drop policy if exists "Published assessment questions are readable" on public.assessment_questions;
create policy "Readable assessment questions follow version scope"
  on public.assessment_questions for select
  using (public.current_user_can_read_assessment_version(assessment_version_id));

drop policy if exists "Published assessment options are readable" on public.assessment_question_options;
create policy "Readable assessment options follow version scope"
  on public.assessment_question_options for select
  using (
    exists (
      select 1
      from public.assessment_questions question
      where question.id = assessment_question_options.question_id
        and public.current_user_can_read_assessment_version(question.assessment_version_id)
    )
  );

drop policy if exists "Published assessment weights are readable" on public.assessment_option_dimension_weights;
create policy "Readable assessment weights follow version scope"
  on public.assessment_option_dimension_weights for select
  using (
    exists (
      select 1
      from public.assessment_question_options option
      join public.assessment_questions question
        on question.id = option.question_id
      where option.id = assessment_option_dimension_weights.option_id
        and public.current_user_can_read_assessment_version(question.assessment_version_id)
    )
  );

create or replace function public.admin_create_organization_assessment_revision(
  p_organization_id uuid,
  p_source_assessment_version_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_introduction_copy text,
  p_completion_copy text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_source public.assessment_versions%rowtype;
  v_new_assessment_id uuid := gen_random_uuid();
  v_new_question_id uuid;
  v_new_option_id uuid;
  v_question record;
  v_option record;
  v_title text := trim(coalesce(p_title, ''));
  v_slug text := public.admin_slugify(coalesce(nullif(trim(coalesce(p_slug, '')), ''), p_title));
  v_version_number integer := 1;
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_programmes(p_organization_id) then
    raise exception 'Programme manager access required.';
  end if;

  if not private.organization_has_assessment_capability_unchecked(p_organization_id, 'template_adaptation') then
    raise exception 'Assessment adaptation requires a Professional or higher organization plan.';
  end if;

  select *
    into v_source
  from public.assessment_versions
  where id = p_source_assessment_version_id
    and status = 'published';

  if not found then
    raise exception 'Source assessment version must be published.';
  end if;

  if v_source.owner_scope = 'organization' and v_source.organization_id <> p_organization_id then
    raise exception 'Organization assessment versions can only be revised by their owning organization.';
  end if;

  if v_title = '' then
    raise exception 'Assessment title is required.';
  end if;

  if v_slug = '' then
    v_slug := 'assessment';
  end if;

  if exists(select 1 from public.assessment_versions where slug = v_slug) then
    raise exception 'Assessment slug is already in use.';
  end if;

  if v_source.owner_scope = 'organization' then
    select coalesce(max(version_number), 0) + 1
      into v_version_number
    from public.assessment_versions
    where owner_scope = 'organization'
      and organization_id = p_organization_id
      and coalesce(source_assessment_version_id, id) = coalesce(v_source.source_assessment_version_id, v_source.id);
  end if;

  insert into public.assessment_versions (
    id,
    slug,
    title,
    description,
    xp_award,
    status,
    owner_scope,
    organization_id,
    source_assessment_version_id,
    version_number,
    introduction_copy,
    completion_copy,
    scoring_config
  )
  values (
    v_new_assessment_id,
    v_slug,
    v_title,
    nullif(trim(coalesce(p_description, '')), ''),
    v_source.xp_award,
    'draft',
    'organization',
    p_organization_id,
    v_source.id,
    v_version_number,
    trim(coalesce(p_introduction_copy, '')),
    trim(coalesce(p_completion_copy, '')),
    coalesce(v_source.scoring_config, '{}'::jsonb)
  );

  for v_question in
    select *
    from public.assessment_questions
    where assessment_version_id = v_source.id
    order by sort_order, id
  loop
    insert into public.assessment_questions (
      assessment_version_id,
      prompt,
      helper_text,
      question_type,
      sort_order
    )
    values (
      v_new_assessment_id,
      v_question.prompt,
      v_question.helper_text,
      v_question.question_type,
      v_question.sort_order
    )
    returning id into v_new_question_id;

    for v_option in
      select *
      from public.assessment_question_options
      where question_id = v_question.id
      order by sort_order, id
    loop
      insert into public.assessment_question_options (
        question_id,
        label,
        description,
        sort_order
      )
      values (
        v_new_question_id,
        v_option.label,
        v_option.description,
        v_option.sort_order
      )
      returning id into v_new_option_id;

      insert into public.assessment_option_dimension_weights (
        option_id,
        dimension_id,
        weight
      )
      select
        v_new_option_id,
        weight.dimension_id,
        weight.weight
      from public.assessment_option_dimension_weights weight
      where weight.option_id = v_option.id;
    end loop;
  end loop;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_assessment_revision_created',
    'assessment_version',
    v_new_assessment_id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'sourceAssessmentVersionId', v_source.id,
      'versionNumber', v_version_number
    )
  );

  return jsonb_build_object(
    'assessmentVersionId', v_new_assessment_id,
    'status', 'draft',
    'versionNumber', v_version_number
  );
end;
$$;

revoke execute on function public.admin_create_organization_assessment_revision(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_create_organization_assessment_revision(uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;

create or replace function public.admin_publish_organization_assessment_version(
  p_assessment_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assessment public.assessment_versions%rowtype;
  v_question_count integer := 0;
begin
  select *
    into v_assessment
  from public.assessment_versions
  where id = p_assessment_version_id;

  if not found then
    raise exception 'Assessment version not found.';
  end if;

  if v_actor_id is null
    or v_assessment.owner_scope <> 'organization'
    or not public.current_user_can_manage_organization_programmes(v_assessment.organization_id)
  then
    raise exception 'Programme manager access required.';
  end if;

  if not private.organization_has_assessment_capability_unchecked(v_assessment.organization_id, 'template_adaptation') then
    raise exception 'Assessment adaptation requires a Professional or higher organization plan.';
  end if;

  if v_assessment.status <> 'draft' then
    raise exception 'Only draft organization assessment versions can be published.';
  end if;

  select count(*)::integer
    into v_question_count
  from public.assessment_questions
  where assessment_version_id = v_assessment.id;

  if v_question_count = 0 then
    raise exception 'Assessment requires at least one question before publishing.';
  end if;

  if exists (
    select 1
    from public.assessment_questions question
    left join lateral (
      select count(*)::integer as option_count
      from public.assessment_question_options option
      where option.question_id = question.id
    ) options on true
    where question.assessment_version_id = v_assessment.id
      and coalesce(options.option_count, 0) < 2
  ) then
    raise exception 'Every assessment question requires at least two options before publishing.';
  end if;

  update public.assessment_versions
  set status = 'published',
      published_at = coalesce(published_at, now())
  where id = v_assessment.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_assessment_published',
    'assessment_version',
    v_assessment.id::text,
    jsonb_build_object('organizationId', v_assessment.organization_id)
  );

  return jsonb_build_object('assessmentVersionId', v_assessment.id, 'status', 'published');
end;
$$;

revoke execute on function public.admin_publish_organization_assessment_version(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_publish_organization_assessment_version(uuid)
  to authenticated, service_role;

create or replace function public.admin_update_programme_assessment_delivery(
  p_programme_id uuid,
  p_assessment_delivery_configs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_config record;
  v_payload jsonb;
  v_delivery_config jsonb;
  v_updated_count integer := 0;
  v_assessment_id uuid;
begin
  if v_actor_id is null or not public.current_user_can_manage_programme(p_programme_id) then
    raise exception 'Programme manager access required.';
  end if;

  if not exists(select 1 from public.programmes where id = p_programme_id and status <> 'archived') then
    raise exception 'Programme not found.';
  end if;

  if jsonb_typeof(coalesce(p_assessment_delivery_configs, '{}'::jsonb)) <> 'object' then
    raise exception 'Programme assessment delivery configuration must be a JSON object.';
  end if;

  for v_config in
    select key as assessment_version_id, value as payload
    from jsonb_each(coalesce(p_assessment_delivery_configs, '{}'::jsonb))
  loop
    v_assessment_id := nullif(trim(v_config.assessment_version_id), '')::uuid;

    if v_assessment_id is null then
      raise exception 'Programme assessment delivery config must reference attached assessments.';
    end if;

    if not exists (
      select 1
      from public.programme_assessments
      where programme_id = p_programme_id
        and assessment_version_id = v_assessment_id
    ) then
      raise exception 'Programme assessment delivery config must reference attached assessments.';
    end if;

    v_payload := coalesce(v_config.payload, '{}'::jsonb);

    if jsonb_typeof(v_payload) <> 'object' then
      raise exception 'Programme assessment delivery configuration must be a JSON object.';
    end if;

    v_delivery_config := coalesce(v_payload -> 'deliveryConfig', '{}'::jsonb);

    if jsonb_typeof(v_delivery_config) <> 'object' then
      raise exception 'Programme assessment delivery configuration must be a JSON object.';
    end if;

    update public.programme_assessments
    set is_required = coalesce((v_payload ->> 'isRequired')::boolean, true),
        introduction_copy = trim(coalesce(v_payload ->> 'introductionCopy', '')),
        completion_copy = trim(coalesce(v_payload ->> 'completionCopy', '')),
        delivery_config = v_delivery_config
    where programme_id = p_programme_id
      and assessment_version_id = v_assessment_id;

    v_updated_count := v_updated_count + 1;
  end loop;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'programme_assessment_delivery_updated',
    'programme',
    p_programme_id::text,
    jsonb_build_object('assessmentCount', v_updated_count)
  );

  return jsonb_build_object('programmeId', p_programme_id, 'assessmentCount', v_updated_count);
end;
$$;

revoke execute on function public.admin_update_programme_assessment_delivery(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_update_programme_assessment_delivery(uuid, jsonb)
  to authenticated, service_role;

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
  where public.current_programme_can_use_assessment(v_programme_id, assessment.id)
  order by selected.first_order;

  if (
    select count(*)::integer
    from (
      select distinct assessment_version_id
      from unnest(coalesce(p_assessment_version_ids, '{}'::uuid[])) as assessment_version_id
      where assessment_version_id is not null
    ) selected_assessments
  ) <> (select count(*)::integer from public.programme_assessments where programme_id = v_programme_id) then
    raise exception 'Programme assessments require a Team or higher plan and must use published Project Ve templates or organisation assessments available to this programme.';
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
    'current_user_can_read_assessment_version',
    'p_assessment_version_id uuid',
    'PUBLIC_ANON',
    'Assessment RLS policies and public learner assessment reads.',
    'Allows published platform templates, platform admins, and active members or managers of the owning organisation for organisation assessment versions.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'current_programme_can_use_assessment',
    'p_programme_id uuid, p_assessment_version_id uuid',
    'INTERNAL_HELPER',
    'Programme assessment attachment enforcement internals.',
    'Revoked from API roles; checks plan assessment capability, assessment publication status, and platform-versus-organisation ownership.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_programme_assessment_capability',
    '',
    'TRIGGER_ONLY',
    'Programme assessment attachment enforcement trigger.',
    'Runs only as a table trigger to prevent Starter or cross-tenant assessment attachment.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_published_assessment_immutability',
    '',
    'TRIGGER_ONLY',
    'Published assessment immutability trigger.',
    'Runs only as table triggers across assessment versions, questions, options and weights.',
    array[]::text[]
  ),
  (
    'public',
    'admin_create_organization_assessment_revision',
    'p_organization_id uuid, p_source_assessment_version_id uuid, p_title text, p_slug text, p_description text, p_introduction_copy text, p_completion_copy text',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment adaptation workflow.',
    'Requires auth.uid(), programme management rights in the organisation, Professional-or-higher assessment capability, and a published platform or same-organisation source version.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_publish_organization_assessment_version',
    'p_assessment_version_id uuid',
    'ADMIN_AUTHENTICATED',
    'Professional or Enterprise organisation assessment publish workflow.',
    'Requires auth.uid(), programme management rights in the owning organisation, Professional-or-higher assessment capability, draft status, and minimum question readiness.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_programme_assessment_delivery',
    'p_programme_id uuid, p_assessment_delivery_configs jsonb',
    'ADMIN_AUTHENTICATED',
    'Team-or-higher programme assessment presentation and requirement configuration.',
    'Requires programme management rights and only updates assessment versions already attached through the plan-enforced programme builder.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
