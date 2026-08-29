-- Retrofit: everywhere organization_id-null (platform/catalog) content
-- authorization currently falls back to current_user_is_admin() alone, add
-- current_user_has_platform_catalog_role([...]) as an alternative, so the
-- staffing system just shipped (platform_catalog_memberships) actually lets
-- catalog staff do something. Business logic is unchanged in every
-- function below — only the authorization check widens.

-- ===== Courses / lessons (lessons/lesson_pages delegate to these) =====

create or replace function public.current_user_can_read_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and (
        public.current_user_is_admin()
        or (
          public.current_user_has_course_enrolment(course.id)
          and (
            course.organization_id is null
            or public.organization_allows_learner_entry(course.organization_id)
          )
        )
        or (
          course.catalog_scope = 'platform'
          and (
            course.status = 'published'
            or public.current_user_has_platform_catalog_role(
              array[
                'organisation_owner',
                'organisation_admin',
                'programme_manager',
                'content_editor',
                'reviewer'
              ]::public.organization_role_key[]
            )
          )
        )
        or (
          course.organization_id is not null
          and public.organization_allows_learner_entry(course.organization_id)
          and (
            public.current_user_has_organization_role(
              course.organization_id,
              array[
                'organisation_owner',
                'organisation_admin',
                'programme_manager',
                'content_editor',
                'reviewer',
                'instructor',
                'report_viewer'
              ]::public.organization_role_key[]
            )
            or (
              course.status = 'published'
              and (
                public.current_user_has_organization_role(course.organization_id, null)
                or exists (
                  select 1
                  from public.programme_courses programme_course
                  join public.programmes programme
                    on programme.id = programme_course.programme_id
                  join public.enrolments enrolment
                    on enrolment.programme_id = programme.id
                   and enrolment.organization_id = programme.organization_id
                  where programme_course.course_id = course.id
                    and programme.organization_id = course.organization_id
                    and programme.status = 'published'
                    and enrolment.user_id = auth.uid()
                    and enrolment.status in ('active', 'completed')
                )
              )
            )
          )
        )
      )
  );
$$;

create or replace function public.current_user_can_edit_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and (
        public.current_user_is_admin()
        or (
          course.catalog_scope = 'platform'
          and public.current_user_has_platform_catalog_role(
            array[
              'organisation_owner',
              'organisation_admin',
              'programme_manager',
              'content_editor'
            ]::public.organization_role_key[]
          )
        )
        or (
          course.catalog_scope <> 'platform'
          and course.organization_id is not null
          and public.current_user_can_edit_organization_content(course.organization_id)
        )
      )
  );
$$;

create or replace function public.admin_upsert_course(
  p_course_id text,
  p_title text,
  p_description text,
  p_intended_audience text,
  p_learning_outcomes text[],
  p_category text,
  p_level public.course_level,
  p_status public.content_status,
  p_thumbnail jsonb,
  p_sort_order integer,
  p_estimated_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_course_id text := lower(regexp_replace(trim(coalesce(p_course_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_slug_base text := public.admin_slugify(p_title);
  v_slug text;
  v_exists boolean := false;
  v_counter integer := 1;
  v_learning_outcomes text[] := array(
    select outcome
    from unnest(coalesce(p_learning_outcomes, '{}'::text[])) as outcome
    where trim(outcome) <> ''
  );
begin
  if v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if v_title = '' then
    raise exception 'Course title is required.';
  end if;

  select exists(select 1 from public.courses where id = v_course_id) into v_exists;

  if v_exists then
    if not public.current_user_can_edit_course(v_course_id) then
      raise exception 'Course editor access required.';
    end if;

    update public.courses
    set title = v_title,
        description = nullif(trim(coalesce(p_description, '')), ''),
        intended_audience = trim(coalesce(p_intended_audience, '')),
        learning_outcomes = v_learning_outcomes,
        category = nullif(trim(coalesce(p_category, '')), ''),
        level = coalesce(p_level, 'beginner'::public.course_level),
        status = coalesce(p_status, 'draft'::public.content_status),
        thumbnail = coalesce(p_thumbnail, '{}'::jsonb),
        sort_order = coalesce(p_sort_order, 0),
        estimated_minutes = greatest(0, coalesce(p_estimated_minutes, 0)),
        updated_at = now()
    where id = v_course_id;
  else
    if not (
      public.current_user_is_admin()
      or public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'content_editor'
        ]::public.organization_role_key[]
      )
    ) then
      raise exception 'Only a platform admin or platform catalog staff can create platform courses.';
    end if;

    if v_slug_base = '' then
      v_slug_base := 'course';
    end if;

    v_slug := left(v_slug_base, 96);
    v_course_id := 'course-' || left(v_slug_base, 86);

    while exists(select 1 from public.courses where id = v_course_id or slug = v_slug) loop
      v_counter := v_counter + 1;
      v_slug := left(v_slug_base, 90) || '-' || v_counter::text;
      v_course_id := 'course-' || left(v_slug_base, 80) || '-' || v_counter::text;
    end loop;

    insert into public.courses (
      id,
      slug,
      title,
      description,
      intended_audience,
      learning_outcomes,
      category,
      level,
      status,
      thumbnail,
      sort_order,
      estimated_minutes
    )
    values (
      v_course_id,
      v_slug,
      v_title,
      nullif(trim(coalesce(p_description, '')), ''),
      trim(coalesce(p_intended_audience, '')),
      v_learning_outcomes,
      coalesce(nullif(trim(coalesce(p_category, '')), ''), 'Values Education'),
      coalesce(p_level, 'beginner'::public.course_level),
      coalesce(p_status, 'draft'::public.content_status),
      coalesce(p_thumbnail, '{}'::jsonb),
      coalesce(p_sort_order, 0),
      greatest(0, coalesce(p_estimated_minutes, 0))
    );
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'course_updated' else 'course_created' end,
    'course',
    v_course_id,
    jsonb_build_object('title', v_title, 'status', p_status)
  );

  return jsonb_build_object('courseId', v_course_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;
-- ===== Missions =====

CREATE OR REPLACE FUNCTION public.admin_create_mission(p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_xp integer, p_repeatability mission_repeatability, p_validation_type mission_validation_type, p_validation_config jsonb DEFAULT '{}'::jsonb, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status content_status DEFAULT 'draft'::content_status, p_sort_order integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
begin
  if v_actor_id is null or not (public.current_user_is_admin() or public.current_user_has_platform_catalog_role(array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[])) then
    raise exception 'Only an admin or platform catalog staff can create a mission.';
  end if;

  if v_mission_id is null then
    raise exception 'Mission id is required.';
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

  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

  insert into public.missions (
    id,
    title,
    description,
    category,
    reward_xp,
    repeatability,
    validation_type,
    validation_config,
    starts_at,
    ends_at,
    status,
    sort_order
  )
  values (
    v_mission_id,
    trim(p_title),
    trim(p_description),
    p_category,
    p_reward_xp,
    p_repeatability,
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb),
    p_starts_at,
    p_ends_at,
    p_status,
    coalesce(p_sort_order, 0)
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_created',
    'mission',
    v_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'status', p_status
    )
  );

  return jsonb_build_object('missionId', v_mission_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_mission(p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_type text, p_reward_xp integer, p_reward_id text, p_repeatability mission_repeatability, p_validation_type mission_validation_type, p_validation_config jsonb DEFAULT '{}'::jsonb, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status content_status DEFAULT 'draft'::content_status, p_sort_order integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
  v_mission_type_key text := private.mission_type_key_for_validation(p_validation_type);
begin
  if v_actor_id is null or not (public.current_user_is_admin() or public.current_user_has_platform_catalog_role(array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[])) then
    raise exception 'Only an admin or platform catalog staff can create a mission.';
  end if;

  if v_mission_id is null then
    raise exception 'Mission id is required.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  perform public.admin_assert_valid_mission_reward(p_reward_type, p_reward_xp, v_reward_id);
  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

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
    mission_type_key,
    reward_mode
  )
  values (
    v_mission_id,
    trim(p_title),
    trim(p_description),
    p_category,
    p_reward_type,
    case when p_reward_type = 'xp' then p_reward_xp else null end,
    case when p_reward_type = 'reward' then v_reward_id else null end,
    p_repeatability,
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb),
    p_starts_at,
    p_ends_at,
    p_status,
    coalesce(p_sort_order, 0),
    'platform',
    v_mission_type_key,
    case when p_reward_type = 'reward' then 'direct_reward' else 'platform_xp' end
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_created',
    'mission',
    v_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'missionTypeKey', v_mission_type_key,
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  return jsonb_build_object('missionId', v_mission_id);
end;
$function$;


CREATE OR REPLACE FUNCTION public.admin_update_mission(p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_xp integer, p_repeatability mission_repeatability, p_validation_type mission_validation_type, p_validation_config jsonb DEFAULT '{}'::jsonb, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status content_status DEFAULT 'draft'::content_status, p_sort_order integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not (public.current_user_is_admin() or public.current_user_has_platform_catalog_role(array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[])) then
    raise exception 'Only an admin or platform catalog staff can update a mission.';
  end if;

  if nullif(trim(coalesce(p_mission_id, '')), '') is null then
    raise exception 'Mission id is required.';
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

  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

  update public.missions
  set title = trim(p_title),
      description = trim(p_description),
      category = p_category,
      reward_xp = p_reward_xp,
      repeatability = p_repeatability,
      validation_type = p_validation_type,
      validation_config = coalesce(p_validation_config, '{}'::jsonb),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      sort_order = coalesce(p_sort_order, 0),
      updated_at = now()
  where id = p_mission_id;

  if not found then
    raise exception 'Mission not found.';
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
    'mission_updated',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'status', p_status
    )
  );

  return jsonb_build_object('missionId', p_mission_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_mission(p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_type text, p_reward_xp integer, p_reward_id text, p_repeatability mission_repeatability, p_validation_type mission_validation_type, p_validation_config jsonb DEFAULT '{}'::jsonb, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_status content_status DEFAULT 'draft'::content_status, p_sort_order integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
  v_mission public.missions%rowtype;
  v_mission_type_key text := private.mission_type_key_for_validation(p_validation_type);
begin
  if v_actor_id is null or not (public.current_user_is_admin() or public.current_user_has_platform_catalog_role(array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[])) then
    raise exception 'Only an admin or platform catalog staff can update a mission.';
  end if;

  if nullif(trim(coalesce(p_mission_id, '')), '') is null then
    raise exception 'Mission id is required.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if v_mission.catalog_scope <> 'platform' then
    raise exception 'Use organization mission workflows for organization-owned missions.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  perform public.admin_assert_valid_mission_reward(p_reward_type, p_reward_xp, v_reward_id);
  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

  update public.missions
  set title = trim(p_title),
      description = trim(p_description),
      category = p_category,
      reward_type = p_reward_type,
      reward_xp = case when p_reward_type = 'xp' then p_reward_xp else null end,
      reward_id = case when p_reward_type = 'reward' then v_reward_id else null end,
      repeatability = p_repeatability,
      validation_type = p_validation_type,
      validation_config = coalesce(p_validation_config, '{}'::jsonb),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      sort_order = coalesce(p_sort_order, 0),
      mission_type_key = v_mission_type_key,
      reward_mode = case when p_reward_type = 'reward' then 'direct_reward' else 'platform_xp' end,
      configuration_version = configuration_version + 1,
      updated_at = now()
  where id = p_mission_id;

  update public.missions
  set upstream_update_available = true
  where source_mission_id = p_mission_id
    and source_catalog_version < (
      select configuration_version
      from public.missions
      where id = p_mission_id
    );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_updated',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'missionTypeKey', v_mission_type_key,
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  return jsonb_build_object('missionId', p_mission_id);
end;
$function$;



-- ===== Rewards / perks =====

drop policy if exists "Platform catalog staff can read platform rewards" on public.rewards;
create policy "Platform catalog staff can read platform rewards"
  on public.rewards for select
  using (
    organization_id is null
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
    )
  );

drop policy if exists "Platform catalog staff can read platform perk prizes" on public.perk_bundle_prizes;
create policy "Platform catalog staff can read platform perk prizes"
  on public.perk_bundle_prizes for select
  using (
    exists (
      select 1
      from public.rewards bundle_reward
      where bundle_reward.id = perk_bundle_prizes.bundle_reward_id
        and bundle_reward.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
        )
    )
  );

drop policy if exists "Platform catalog staff can read platform perk draws" on public.perk_bundle_draws;
create policy "Platform catalog staff can read platform perk draws"
  on public.perk_bundle_draws for select
  using (
    exists (
      select 1
      from public.rewards bundle_reward
      where bundle_reward.id = perk_bundle_draws.bundle_reward_id
        and bundle_reward.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
        )
    )
  );

-- ===== Redemptions =====

drop policy if exists "Platform catalog staff can read platform redemptions" on public.reward_redemptions;
create policy "Platform catalog staff can read platform redemptions"
  on public.reward_redemptions for select
  using (
    exists (
      select 1
      from public.rewards r
      where r.id = coalesce(reward_redemptions.awarded_reward_id, reward_redemptions.reward_id)
        and r.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
        )
    )
  );

-- ===== Recommendations =====

drop policy if exists "Platform catalog staff can read platform rec sections" on public.recommendation_sections;
create policy "Platform catalog staff can read platform rec sections"
  on public.recommendation_sections for select
  using (
    organization_id is null
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
    )
  );

drop policy if exists "Platform catalog staff can read platform recommendation items" on public.recommendation_items;
create policy "Platform catalog staff can read platform recommendation items"
  on public.recommendation_items for select
  using (
    exists (
      select 1
      from public.recommendation_sections section
      where section.id = recommendation_items.section_id
        and section.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
        )
    )
  );

-- ===== Redemptions / Inventory / Points / Recommendations RPCs =====

CREATE OR REPLACE FUNCTION public.admin_mark_reward_redemption_fulfilled(p_redemption_id uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_redemption public.reward_redemptions%rowtype;
  v_inventory_reward_id text;
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'We could not find this reward redemption.';
  end if;

  select organization_id
    into v_organization_id
  from public.rewards
  where id = coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can fulfill reward redemptions.';
  end if;

  if v_redemption.claim_state in ('refunded', 'cancelled', 'expired') then
    raise exception 'This redemption can no longer be fulfilled.';
  end if;

  update public.reward_redemptions
  set status = 'fulfilled',
      claim_state = 'fulfilled',
      fulfilled_at = coalesce(fulfilled_at, now()),
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_note, '')), ''),
      user_message = 'This reward has been fulfilled.'
  where id = p_redemption_id;

  update public.reward_inventory_items
  set status = 'redeemed',
      redeemed_at = now()
  where redemption_id = p_redemption_id
    and status = 'reserved';

  v_inventory_reward_id := coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);
  perform public.refresh_reward_item_inventory_counts(v_inventory_reward_id);

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_redemption_fulfilled',
    'reward_redemption',
    p_redemption_id::text,
    jsonb_build_object('rewardId', v_redemption.reward_id, 'awardedRewardId', v_redemption.awarded_reward_id, 'note', p_note)
  );

  return jsonb_build_object('id', p_redemption_id, 'claimState', 'fulfilled');
end;
$function$;



CREATE OR REPLACE FUNCTION public.refund_reward_redemption_legacy(p_redemption_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid;
  v_redemption public.reward_redemptions%rowtype;
  v_refund_transaction_id uuid;
  v_restored_inventory boolean := false;
  v_inventory_reward_id text;
  v_draw public.perk_bundle_draws%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    raise exception 'We could not find this reward redemption.';
  end if;

  select organization_id
    into v_organization_id
  from public.rewards
  where id = coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can refund reward redemptions.';
  end if;

  if v_redemption.refunded_at is not null or v_redemption.claim_state = 'refunded' then
    return jsonb_build_object('id', p_redemption_id, 'claimState', 'refunded', 'alreadyRefunded', true);
  end if;

  if v_redemption.fulfilled_at is not null then
    raise exception 'Fulfilled rewards cannot be automatically refunded.';
  end if;

  v_inventory_reward_id := coalesce(v_redemption.awarded_reward_id, v_redemption.reward_id);

  if v_redemption.inventory_item_id is not null then
    update public.reward_inventory_items
    set status = case
          when expires_at is not null and expires_at <= now() then 'expired'
          else 'available'
        end,
        redemption_id = null,
        assigned_at = null
    where id = v_redemption.inventory_item_id
      and redemption_id = p_redemption_id
      and status = 'reserved';

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_item_inventory_counts(v_inventory_reward_id);
    end if;
  elsif v_redemption.quantity_allocation_id is not null then
    update public.reward_quantity_allocations
    set quantity_available = least(quantity_total, quantity_available + 1),
        updated_at = now()
    where id = v_redemption.quantity_allocation_id;

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_quantity_inventory_counts(v_inventory_reward_id);
    end if;
  end if;

  select *
    into v_draw
  from public.perk_bundle_draws
  where redemption_id = p_redemption_id
  for update;

  if found and v_draw.bundle_quantity_allocation_id is not null then
    update public.reward_quantity_allocations
    set quantity_available = least(quantity_total, quantity_available + 1),
        updated_at = now()
    where id = v_draw.bundle_quantity_allocation_id;

    if found then
      v_restored_inventory := true;
      perform public.refresh_reward_quantity_inventory_counts(v_draw.bundle_reward_id);
    end if;

    update public.perk_bundle_draws
    set award_status = 'refunded'
    where id = v_draw.id;
  end if;

  insert into public.xp_transactions (
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    award_scope,
    metadata
  )
  values (
    v_redemption.user_id,
    coalesce(v_redemption.xp_cost_at_redemption, 0),
    'earn',
    'reward_redemption',
    p_redemption_id::text,
    'reward_refund:' || p_redemption_id::text,
    jsonb_build_object(
      'reason', coalesce(p_reason, 'admin_refund'),
      'inventoryRestored', v_restored_inventory
    )
  )
  returning id into v_refund_transaction_id;

  update public.profiles
  set xp = xp + coalesce(v_redemption.xp_cost_at_redemption, 0),
      xp_balance_cached = xp_balance_cached + coalesce(v_redemption.xp_cost_at_redemption, 0),
      updated_at = now()
  where id = v_redemption.user_id;

  update public.reward_redemptions
  set status = 'cancelled',
      claim_state = 'refunded',
      refunded_at = now(),
      refund_xp_transaction_id = v_refund_transaction_id,
      admin_note = p_reason,
      user_message = 'This reward was refunded. The XP has been returned to your balance.'
  where id = p_redemption_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_redemption_refunded',
    'reward_redemption',
    p_redemption_id::text,
    jsonb_build_object(
      'rewardId', v_redemption.reward_id,
      'awardedRewardId', v_redemption.awarded_reward_id,
      'reason', p_reason,
      'inventoryRestored', v_restored_inventory,
      'inventoryItemId', v_redemption.inventory_item_id,
      'quantityAllocationId', v_redemption.quantity_allocation_id
    )
  );

  return jsonb_build_object(
    'id', p_redemption_id,
    'claimState', 'refunded',
    'inventoryRestored', v_restored_inventory,
    'refundXpTransactionId', v_refund_transaction_id
  );
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_set_reward_quantity(p_reward_id text, p_total_available integer, p_reason text, p_campaign_id text DEFAULT NULL::text, p_batch_label text DEFAULT NULL::text, p_partner_reference text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_total_available, 0));
  v_allocation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_reward.organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can set reward quantity.';
  end if;

  if v_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    raise exception 'Voucher and QR rewards require item batch upload.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Expiry must be after available from.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  insert into public.reward_quantity_allocations (
    reward_id,
    campaign_id,
    batch_label,
    partner_reference,
    quantity_total,
    quantity_available,
    available_from,
    expires_at,
    reason,
    created_by
  )
  values (
    p_reward_id,
    coalesce(p_campaign_id, v_reward.campaign_id),
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    v_quantity,
    v_quantity,
    p_available_from,
    p_expires_at,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Admin quantity allocation'),
    v_actor_id
  )
  returning id into v_allocation_id;

  insert into public.reward_inventory_adjustments (
    reward_id,
    campaign_id,
    batch_label,
    partner_reference,
    delta,
    reason,
    created_by,
    available_from,
    expires_at
  )
  values (
    p_reward_id,
    coalesce(p_campaign_id, v_reward.campaign_id),
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    v_quantity,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Admin quantity allocation'),
    v_actor_id,
    p_available_from,
    p_expires_at
  );

  perform public.refresh_reward_quantity_inventory_counts(p_reward_id);

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_quantity_allocated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'allocationId', v_allocation_id,
      'quantity', v_quantity,
      'campaignId', p_campaign_id,
      'batchLabel', p_batch_label,
      'partnerReference', p_partner_reference,
      'availableFrom', p_available_from,
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object(
    'status', 'allocated',
    'rewardId', p_reward_id,
    'allocationId', v_allocation_id,
    'quantity', v_quantity
  );
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_reallocate_reward_inventory(p_reward_id text, p_from_campaign_id text, p_to_campaign_id text, p_quantity integer, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_quantity integer := greatest(0, coalesce(p_quantity, 0));
  v_item_ids uuid[] := array[]::uuid[];
  v_moved integer := 0;
  v_remaining integer;
  v_take integer;
  v_allocation record;
  v_from_allocation_ids uuid[] := array[]::uuid[];
  v_to_allocation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_from_campaign_id is null or p_to_campaign_id is null or p_from_campaign_id = p_to_campaign_id then
    raise exception 'Choose different source and destination campaigns.';
  end if;

  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Expiry must be after available from.';
  end if;

  if not exists (select 1 from public.campaigns where id = p_from_campaign_id) then
    raise exception 'Source campaign not found.';
  end if;

  if not exists (select 1 from public.campaigns where id = p_to_campaign_id) then
    raise exception 'Destination campaign not found.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_reward.organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can reallocate inventory.';
  end if;

  if v_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    select coalesce(array_agg(id), array[]::uuid[])
      into v_item_ids
    from (
      select id
      from public.reward_inventory_items
      where reward_id = p_reward_id
        and campaign_id = p_from_campaign_id
        and status = 'available'
        and (expires_at is null or expires_at > now())
      order by coalesce(available_from, uploaded_at), uploaded_at
      for update skip locked
      limit v_quantity
    ) items;

    v_moved := coalesce(array_length(v_item_ids, 1), 0);

    if v_moved < v_quantity then
      raise exception 'Only % unused item(s) are available to reallocate.', v_moved;
    end if;

    update public.reward_inventory_items
    set campaign_id = p_to_campaign_id,
        available_from = p_available_from,
        expires_at = p_expires_at
    where id = any(v_item_ids);

    perform public.refresh_reward_item_inventory_counts(p_reward_id);
  else
    v_remaining := v_quantity;

    for v_allocation in
      select *
      from public.reward_quantity_allocations
      where reward_id = p_reward_id
        and campaign_id = p_from_campaign_id
        and quantity_available > 0
        and (expires_at is null or expires_at > now())
      order by coalesce(available_from, created_at), created_at
      for update skip locked
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, v_allocation.quantity_available);

      update public.reward_quantity_allocations
      set quantity_available = quantity_available - v_take,
          updated_at = now()
      where id = v_allocation.id;

      v_from_allocation_ids := array_append(v_from_allocation_ids, v_allocation.id);
      v_moved := v_moved + v_take;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_moved < v_quantity then
      raise exception 'Only % unused quantity is available to reallocate.', v_moved;
    end if;

    insert into public.reward_quantity_allocations (
      reward_id,
      campaign_id,
      quantity_total,
      quantity_available,
      available_from,
      expires_at,
      reason,
      created_by,
      allocation_type,
      source_allocation_id
    )
    values (
      p_reward_id,
      p_to_campaign_id,
      v_quantity,
      v_quantity,
      p_available_from,
      p_expires_at,
      coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Inventory reallocation'),
      v_actor_id,
      'reallocation',
      v_from_allocation_ids[1]
    )
    returning id into v_to_allocation_id;

    perform public.refresh_reward_quantity_inventory_counts(p_reward_id);
  end if;

  insert into public.reward_inventory_reallocations (
    reward_id,
    inventory_type,
    from_campaign_id,
    to_campaign_id,
    quantity,
    inventory_item_ids,
    from_quantity_allocation_ids,
    to_quantity_allocation_id,
    available_from,
    expires_at,
    reason,
    created_by
  )
  values (
    p_reward_id,
    case when v_reward.fulfillment_type in ('voucher_code', 'qr_code') then v_reward.fulfillment_type else 'quantity' end,
    p_from_campaign_id,
    p_to_campaign_id,
    v_quantity,
    coalesce(to_jsonb(v_item_ids), '[]'::jsonb),
    coalesce(to_jsonb(v_from_allocation_ids), '[]'::jsonb),
    v_to_allocation_id,
    p_available_from,
    p_expires_at,
    coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Inventory reallocation'),
    v_actor_id
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_inventory_reallocated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'fromCampaignId', p_from_campaign_id,
      'toCampaignId', p_to_campaign_id,
      'quantity', v_quantity
    )
  );

  return jsonb_build_object(
    'status', 'reallocated',
    'rewardId', p_reward_id,
    'quantity', v_quantity,
    'fromCampaignId', p_from_campaign_id,
    'toCampaignId', p_to_campaign_id
  );
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_create_reward_inventory_batch(p_reward_id text, p_campaign_id text, p_batch_label text, p_partner_reference text, p_source text, p_original_filename text, p_available_from timestamp with time zone, p_expires_at timestamp with time zone, p_total_rows integer, p_valid_rows integer, p_invalid_rows integer, p_duplicate_rows integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_batch_id uuid := gen_random_uuid();
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_reward.organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can create inventory batches.';
  end if;

  if v_reward.fulfillment_type not in ('voucher_code', 'qr_code') then
    raise exception 'Inventory batches only support voucher and QR rewards.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  insert into public.reward_inventory_batches (
    id,
    reward_id,
    campaign_id,
    item_type,
    batch_label,
    partner_reference,
    source,
    original_filename,
    available_from,
    expires_at,
    status,
    total_rows,
    valid_rows,
    invalid_rows,
    duplicate_rows,
    created_by
  )
  values (
    v_batch_id,
    p_reward_id,
    p_campaign_id,
    v_reward.fulfillment_type,
    nullif(trim(coalesce(p_batch_label, '')), ''),
    nullif(trim(coalesce(p_partner_reference, '')), ''),
    coalesce(nullif(p_source, ''), 'partner'),
    nullif(trim(coalesce(p_original_filename, '')), ''),
    p_available_from,
    p_expires_at,
    'importing',
    greatest(0, coalesce(p_total_rows, 0)),
    greatest(0, coalesce(p_valid_rows, 0)),
    greatest(0, coalesce(p_invalid_rows, 0)),
    greatest(0, coalesce(p_duplicate_rows, 0)),
    v_actor_id
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_inventory_batch_created',
    'reward_inventory_batch',
    v_batch_id::text,
    jsonb_build_object(
      'rewardId', p_reward_id,
      'campaignId', p_campaign_id,
      'totalRows', p_total_rows,
      'validRows', p_valid_rows,
      'invalidRows', p_invalid_rows,
      'duplicateRows', p_duplicate_rows
    )
  );

  return jsonb_build_object('batchId', v_batch_id, 'itemType', v_reward.fulfillment_type);
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_upload_reward_inventory(p_reward_id text, p_item_type text, p_items jsonb, p_expires_at timestamp with time zone, p_campaign_id text DEFAULT NULL::text, p_batch_label text DEFAULT NULL::text, p_partner_reference text DEFAULT NULL::text, p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_item jsonb;
  v_value text;
  v_row_campaign_id text;
  v_row_available_from timestamptz;
  v_row_expires_at timestamptz;
  v_row_partner_reference text;
  v_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_item_type not in ('voucher_code', 'qr_code') then
    raise exception 'Inventory upload only supports voucher and QR rewards.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Reward not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_reward.organization_id is not null
      and public.current_user_has_organization_role(
        v_reward.organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_reward.organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can upload reward inventory.';
  end if;

  if v_reward.fulfillment_type <> p_item_type then
    raise exception 'Inventory type must match the reward fulfillment type.';
  end if;

  if p_batch_id is not null
     and not exists (
      select 1
      from public.reward_inventory_batches
      where id = p_batch_id
        and reward_id = p_reward_id
        and item_type = p_item_type
     ) then
    raise exception 'Inventory batch not found.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_value := nullif(trim(coalesce(v_item ->> 'value', '')), '');
    v_row_campaign_id := coalesce(nullif(v_item ->> 'campaignId', ''), p_campaign_id, v_reward.campaign_id);
    v_row_partner_reference := coalesce(nullif(v_item ->> 'partnerReference', ''), p_partner_reference);
    v_row_available_from := coalesce(nullif(v_item ->> 'availableFrom', '')::timestamptz, p_available_from, now());
    v_row_expires_at := coalesce(nullif(v_item ->> 'expiresAt', '')::timestamptz, p_expires_at);

    if v_row_campaign_id is not null
       and not exists (select 1 from public.campaigns where id = v_row_campaign_id) then
      raise exception 'Campaign not found for inventory row.';
    end if;

    if v_value is not null
       and not exists (
         select 1
         from public.reward_inventory_items
         where reward_id = p_reward_id
           and item_type = p_item_type
           and case
             when p_item_type = 'voucher_code' then payload ->> 'code'
             else payload ->> 'qrPayload'
           end = v_value
       ) then
      insert into public.reward_inventory_items (
        reward_id,
        batch_id,
        campaign_id,
        batch_label,
        partner_reference,
        item_type,
        payload,
        available_from,
        expires_at,
        uploaded_by
      )
      values (
        p_reward_id,
        p_batch_id,
        v_row_campaign_id,
        nullif(trim(coalesce(p_batch_label, '')), ''),
        nullif(trim(coalesce(v_row_partner_reference, '')), ''),
        p_item_type,
        case
          when p_item_type = 'voucher_code' then jsonb_build_object('code', v_value)
          else jsonb_build_object('qrPayload', v_value)
        end,
        v_row_available_from,
        v_row_expires_at,
        v_actor_id
      );

      v_count := v_count + 1;
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'No new inventory items were provided.';
  end if;

  perform public.refresh_reward_item_inventory_counts(p_reward_id);

  if p_batch_id is not null then
    update public.reward_inventory_batches
    set imported_rows = imported_rows + v_count,
        updated_at = now()
    where id = p_batch_id;
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
    'reward_inventory_uploaded',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'itemType', p_item_type,
      'count', v_count,
      'batchId', p_batch_id,
      'campaignId', p_campaign_id,
      'batchLabel', p_batch_label,
      'partnerReference', p_partner_reference,
      'availableFrom', p_available_from,
      'expiresAt', p_expires_at
    )
  );

  return jsonb_build_object('status', 'uploaded', 'rewardId', p_reward_id, 'batchId', p_batch_id, 'count', v_count);
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_complete_reward_inventory_batch(p_batch_id uuid, p_status text DEFAULT 'completed'::text, p_error_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_batch public.reward_inventory_batches%rowtype;
  v_reward_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_batch
  from public.reward_inventory_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'Inventory batch not found.';
  end if;

  select organization_id
    into v_reward_organization_id
  from public.rewards
  where id = v_batch.reward_id;

  if not (
    public.current_user_is_admin()
    or (
      v_reward_organization_id is not null
      and public.current_user_has_organization_role(
        v_reward_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_reward_organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can complete inventory batches.';
  end if;

  update public.reward_inventory_batches
  set status = case when p_status in ('completed', 'failed', 'cancelled') then p_status else 'completed' end,
      error_message = p_error_message,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object('batchId', p_batch_id, 'status', p_status);
end;
$function$;



CREATE OR REPLACE FUNCTION public.find_existing_reward_inventory_values(p_reward_id text, p_item_type text, p_values jsonb)
 RETURNS TABLE(value text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reward_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id
    into v_reward_organization_id
  from public.rewards
  where id = p_reward_id;

  if not (
    public.current_user_is_admin()
    or (
      v_reward_organization_id is not null
      and public.current_user_has_organization_role(
        v_reward_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )

    or (
      v_reward_organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Admin or organisation manager access required.';
  end if;

  return query
  with requested_values as (
    select distinct trim(requested.raw_value) as requested_value
    from jsonb_array_elements_text(coalesce(p_values, '[]'::jsonb)) as requested(raw_value)
    where trim(requested.raw_value) <> ''
  )
  select requested_values.requested_value
  from requested_values
  where exists (
    select 1
    from public.reward_inventory_items
    where reward_inventory_items.reward_id = p_reward_id
      and reward_inventory_items.item_type = p_item_type
      and case
        when p_item_type = 'voucher_code' then reward_inventory_items.payload ->> 'code'
        else reward_inventory_items.payload ->> 'qrPayload'
      end = requested_values.requested_value
  );
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_list_xp_account_transactions(p_organization_id uuid, p_direction text DEFAULT NULL::text, p_source_type text DEFAULT NULL::text, p_user_ids uuid[] DEFAULT NULL::uuid[], p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, user_id uuid, amount integer, direction xp_direction, source_type xp_source_type, source_id text, award_scope text, metadata jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_account public.xp_accounts%rowtype;
begin
  if p_organization_id is null then
    if not public.current_user_can_manage_platform_catalog() then
      raise exception 'Platform XP ledger access is required.' using errcode = '42501';
    end if;

    select * into v_account
    from public.xp_accounts
    where scope = 'platform' and is_default
    order by status = 'active' desc
    limit 1;
  else
    if not public.current_user_can_manage_organization(p_organization_id) then
      raise exception 'Organisation XP account access is required.' using errcode = '42501';
    end if;

    select * into v_account
    from public.xp_accounts
    where organization_id = p_organization_id and scope = 'organization' and is_default
    order by status = 'active' desc
    limit 1;
  end if;

  if not found then
    raise exception 'XP account not found.';
  end if;

  return query
  select
    transaction.id,
    transaction.user_id,
    transaction.amount,
    transaction.direction,
    transaction.source_type,
    transaction.source_id,
    transaction.award_scope,
    transaction.metadata,
    transaction.created_at
  from public.xp_transactions transaction
  where transaction.xp_account_id = v_account.id
    and (p_direction is null or transaction.direction = p_direction::public.xp_direction)
    and (p_source_type is null or transaction.source_type = p_source_type::public.xp_source_type)
    and (p_user_ids is null or transaction.user_id = any(p_user_ids))
    and (p_date_from is null or transaction.created_at >= p_date_from)
    and (p_date_to is null or transaction.created_at <= p_date_to)
  order by transaction.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_upsert_recommendation_section(p_section_id text, p_title text, p_subtitle text, p_eyebrow text, p_status content_status, p_sort_order integer, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_section_id text := lower(regexp_replace(trim(coalesce(p_section_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_slug_base text := public.admin_slugify(p_title);
  v_slug text;
  v_exists boolean := false;
  v_existing_organization_id uuid;
  v_counter integer := 1;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id into v_existing_organization_id
  from public.recommendation_sections
  where id = v_section_id;

  v_exists := found;

  -- Authorize against the row's existing owner when updating (a caller
  -- cannot reassign a section by passing a different p_organization_id);
  -- against the requested owner when creating.
  if not (
    public.current_user_is_admin()
    or (
      coalesce(v_existing_organization_id, p_organization_id) is not null
      and public.current_user_has_organization_role(
        coalesce(v_existing_organization_id, p_organization_id),
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
    or (
      coalesce(v_existing_organization_id, p_organization_id) is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  if v_title = '' then
    raise exception 'Recommendation section title is required.';
  end if;

  if p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at then
    raise exception 'Recommendation end time must be after start time.';
  end if;

  if v_slug_base = '' then
    v_slug_base := 'recommendation';
  end if;

  if v_section_id = '' then
    v_section_id := 'rec-' || left(v_slug_base, 90);
    select exists(select 1 from public.recommendation_sections where id = v_section_id) into v_exists;
  end if;

  if not v_exists then
    v_slug := left(v_slug_base, 96);

    while exists(
      select 1
      from public.recommendation_sections
      where id = v_section_id or slug = v_slug
    ) loop
      v_counter := v_counter + 1;
      v_slug := left(v_slug_base, 90) || '-' || v_counter::text;
      v_section_id := 'rec-' || left(v_slug_base, 84) || '-' || v_counter::text;
    end loop;

    insert into public.recommendation_sections (
      id,
      slug,
      placement,
      eyebrow,
      title,
      subtitle,
      status,
      sort_order,
      starts_at,
      ends_at,
      organization_id
    )
    values (
      v_section_id,
      v_slug,
      'dashboard',
      nullif(trim(coalesce(p_eyebrow, '')), ''),
      v_title,
      nullif(trim(coalesce(p_subtitle, '')), ''),
      coalesce(p_status, 'draft'::public.content_status),
      coalesce(p_sort_order, 0),
      p_starts_at,
      p_ends_at,
      p_organization_id
    );
  else
    update public.recommendation_sections
    set eyebrow = nullif(trim(coalesce(p_eyebrow, '')), ''),
        title = v_title,
        subtitle = nullif(trim(coalesce(p_subtitle, '')), ''),
        status = coalesce(p_status, 'draft'::public.content_status),
        sort_order = coalesce(p_sort_order, 0),
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_at = now()
    where id = v_section_id;
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'recommendation_section_updated' else 'recommendation_section_created' end,
    'recommendation_section',
    v_section_id,
    jsonb_build_object('title', v_title, 'status', p_status, 'organizationId', coalesce(v_existing_organization_id, p_organization_id))
  );

  return jsonb_build_object(
    'sectionId', v_section_id,
    'status', case when v_exists then 'updated' else 'created' end
  );
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_set_recommendation_section_status(p_section_id text, p_status content_status)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id into v_organization_id
  from public.recommendation_sections
  where id = p_section_id;

  if not found then
    raise exception 'Recommendation section not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )

    or (
      v_organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Recommendations can only be enabled or disabled from this control.';
  end if;

  update public.recommendation_sections
  set status = v_status,
      updated_at = now()
  where id = p_section_id;

  return jsonb_build_object('sectionId', p_section_id, 'status', v_status);
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_add_recommendation_item(p_section_id text, p_item_type text, p_item_id text, p_sort_order integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
  v_item_id text := trim(coalesce(p_item_id, ''));
  v_item_uuid uuid;
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id into v_organization_id
  from public.recommendation_sections
  where id = p_section_id;

  if not found then
    raise exception 'Recommendation section not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )

    or (
      v_organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  if v_item_type not in ('course', 'lesson') then
    raise exception 'Recommendation item type must be course or lesson.';
  end if;

  if v_item_type = 'course' and not exists(select 1 from public.courses where id = v_item_id) then
    raise exception 'Course not found.';
  end if;

  if v_item_type = 'lesson' and not exists(select 1 from public.lessons where id = v_item_id) then
    raise exception 'Lesson not found.';
  end if;

  insert into public.recommendation_items (
    section_id,
    item_type,
    item_id,
    sort_order
  )
  values (
    p_section_id,
    v_item_type,
    v_item_id,
    coalesce(p_sort_order, 0)
  )
  on conflict (section_id, item_type, item_id) do update
  set sort_order = excluded.sort_order
  returning id into v_item_uuid;

  return jsonb_build_object('itemId', v_item_uuid, 'status', 'saved');
end;
$function$;



CREATE OR REPLACE FUNCTION public.admin_delete_recommendation_item(p_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select section.organization_id into v_organization_id
  from public.recommendation_items item
  join public.recommendation_sections section on section.id = item.section_id
  where item.id = p_item_id;

  if not found then
    raise exception 'Recommendation item not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )

    or (
      v_organization_id is null
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  delete from public.recommendation_items
  where id = p_item_id;

  return jsonb_build_object('itemId', p_item_id, 'status', 'deleted');
end;
$function$;




-- ===== Missions read (drafts) =====

drop policy if exists "Platform catalog staff can read platform missions" on public.missions;
create policy "Platform catalog staff can read platform missions"
  on public.missions for select
  using (
    catalog_scope = 'platform'
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
    )
  );
