drop function if exists public.admin_create_organization_mission(
  uuid,
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  text,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer
);

create or replace function public.admin_create_organization_mission(
  p_organization_id uuid,
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_xp integer,
  p_repeatability public.mission_repeatability,
  p_mission_type_key text,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_presentation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0,
  p_delivery_scope text default 'catalog_only'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
  v_delivery_scope text := lower(trim(coalesce(p_delivery_scope, 'catalog_only')));
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_missions(p_organization_id) then
    raise exception 'Organization mission manager access required.';
  end if;

  if v_mission_id is null then
    raise exception 'Mission id is required.';
  end if;

  if v_delivery_scope not in ('catalog_only', 'organization') then
    raise exception 'Organization missions can only be catalogue-only or organisation-wide from this workflow.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  if p_reward_xp <= 0 then
    raise exception 'Reward XP must be greater than 0.';
  end if;

  if jsonb_typeof(coalesce(p_presentation_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Presentation configuration must be a JSON object.';
  end if;

  perform public.admin_assert_valid_mission_config(
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb)
  );

  insert into public.missions (
    id,
    title,
    description,
    category,
    reward_type,
    reward_xp,
    reward_id,
    repeatability,
    validation_type,
    validation_config,
    starts_at,
    ends_at,
    status,
    sort_order,
    catalog_scope,
    organization_id,
    mission_type_key,
    presentation_config,
    reward_mode,
    delivery_scope,
    local_changes
  )
  values (
    v_mission_id,
    trim(p_title),
    trim(p_description),
    p_category,
    'xp',
    p_reward_xp,
    null,
    p_repeatability,
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb),
    p_starts_at,
    p_ends_at,
    p_status,
    coalesce(p_sort_order, 0),
    'organization_private',
    p_organization_id,
    p_mission_type_key,
    coalesce(p_presentation_config, '{}'::jsonb),
    'organization_xp',
    v_delivery_scope,
    jsonb_build_object('createdFrom', 'organization_private')
  );

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_mission_created',
    'mission',
    v_mission_id,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'missionTypeKey', p_mission_type_key,
      'status', p_status,
      'deliveryScope', v_delivery_scope
    )
  );

  return jsonb_build_object(
    'missionId', v_mission_id,
    'organizationId', p_organization_id,
    'deliveryScope', v_delivery_scope
  );
end;
$$;

drop function if exists public.admin_update_organization_mission(
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer
);

create or replace function public.admin_update_organization_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_xp integer,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_presentation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0,
  p_delivery_scope text default 'catalog_only'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_mission_type_key text := private.mission_type_key_for_validation(p_validation_type);
  v_next_category public.mission_category := p_category;
  v_next_reward_xp integer := p_reward_xp;
  v_next_repeatability public.mission_repeatability := p_repeatability;
  v_next_validation_type public.mission_validation_type := p_validation_type;
  v_next_validation_config jsonb := coalesce(p_validation_config, '{}'::jsonb);
  v_delivery_scope text := lower(trim(coalesce(p_delivery_scope, 'catalog_only')));
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(coalesce(p_mission_id, '')), '') is null then
    raise exception 'Mission id is required.';
  end if;

  if v_delivery_scope not in ('catalog_only', 'organization') then
    raise exception 'Organization missions can only be catalogue-only or organisation-wide from this workflow.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if v_mission.catalog_scope not in (
    'organization_private'::public.mission_catalog_scope,
    'adapted_platform'::public.mission_catalog_scope
  ) then
    raise exception 'Use platform mission workflows for platform missions.';
  end if;

  if not public.current_user_can_manage_organization_missions(v_mission.organization_id) then
    raise exception 'Organization mission manager access required.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  if jsonb_typeof(coalesce(p_presentation_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Presentation configuration must be a JSON object.';
  end if;

  if v_mission.catalog_scope = 'adapted_platform'::public.mission_catalog_scope then
    v_next_category := v_mission.category;
    v_next_reward_xp := coalesce(v_mission.reward_xp, 1);
    v_next_repeatability := v_mission.repeatability;
    v_next_validation_type := v_mission.validation_type;
    v_next_validation_config := v_mission.validation_config;
    v_mission_type_key := v_mission.mission_type_key;
  else
    if p_reward_xp <= 0 then
      raise exception 'Reward XP must be greater than 0.';
    end if;

    perform public.admin_assert_valid_mission_config(
      p_validation_type,
      coalesce(p_validation_config, '{}'::jsonb)
    );
  end if;

  update public.missions
  set title = trim(p_title),
      description = trim(p_description),
      category = v_next_category,
      reward_type = 'xp',
      reward_xp = v_next_reward_xp,
      reward_id = null,
      repeatability = v_next_repeatability,
      validation_type = v_next_validation_type,
      validation_config = v_next_validation_config,
      presentation_config = coalesce(p_presentation_config, '{}'::jsonb),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      sort_order = coalesce(p_sort_order, 0),
      mission_type_key = v_mission_type_key,
      reward_mode = 'organization_xp',
      delivery_scope = v_delivery_scope,
      local_changes = coalesce(local_changes, '{}'::jsonb)
        || jsonb_build_object(
          'updatedFrom', v_mission.catalog_scope,
          'updatedAt', now()
        ),
      configuration_version = configuration_version + 1,
      updated_at = now()
  where id = p_mission_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'organization_mission_updated',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'organizationId', v_mission.organization_id,
      'catalogScope', v_mission.catalog_scope,
      'missionTypeKey', v_mission_type_key,
      'status', p_status,
      'sourceMissionId', v_mission.source_mission_id,
      'deliveryScope', v_delivery_scope
    )
  );

  return jsonb_build_object(
    'missionId', p_mission_id,
    'organizationId', v_mission.organization_id,
    'catalogScope', v_mission.catalog_scope,
    'deliveryScope', v_delivery_scope
  );
end;
$$;

revoke execute on function public.admin_create_organization_mission(
  uuid,
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  text,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_organization_mission(
  uuid,
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  text,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer,
  text
) to authenticated, service_role;

revoke execute on function public.admin_update_organization_mission(
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_update_organization_mission(
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer,
  text
) to authenticated, service_role;

drop policy if exists "Programme managers can read pending contextual access profiles" on public.profiles;
create policy "Programme managers can read pending contextual access profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.enrolments enrolment
      where enrolment.user_id = profiles.id
        and enrolment.status = 'pending'
        and enrolment.programme_id is not null
        and enrolment.metadata ->> 'source' = 'contextual_referral'
        and public.current_user_can_manage_organization_programmes(enrolment.organization_id)
    )
  );

comment on policy "Programme managers can read pending contextual access profiles" on public.profiles is
  'Allows programme managers to identify learners with pending contextual referral access requests without granting global profile visibility.';

delete from private.rpc_security_classifications
where function_schema = 'public'
  and function_name in (
    'admin_create_organization_mission',
    'admin_update_organization_mission'
  );

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
    'admin_create_organization_mission',
    'p_organization_id uuid, p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_xp integer, p_repeatability mission_repeatability, p_mission_type_key text, p_validation_type mission_validation_type, p_validation_config jsonb, p_presentation_config jsonb, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_status content_status, p_sort_order integer, p_delivery_scope text',
    'ADMIN_AUTHENTICATED',
    'Contextual organisation mission manager workflow for creating organisation-private missions from entitled mission types and selecting catalogue-only or organisation-wide delivery.',
    'Requires auth.uid(), organisation mission management rights, plan/mission-type entitlement checks, central mission configuration validation and a catalogue-only or organisation-wide delivery scope before insertion.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_organization_mission',
    'p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_xp integer, p_repeatability mission_repeatability, p_validation_type mission_validation_type, p_validation_config jsonb, p_presentation_config jsonb, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_status content_status, p_sort_order integer, p_delivery_scope text',
    'ADMIN_AUTHENTICATED',
    'Contextual organisation mission manager workflow for editing organisation-private missions, local presentation on adapted platform missions and catalogue-only or organisation-wide delivery.',
    'Requires auth.uid(); authorization is resolved from the stored mission organization, organisation-private missions may update executable configuration, adapted platform missions preserve source handler configuration and delivery scope is constrained to catalogue-only or organisation-wide.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
