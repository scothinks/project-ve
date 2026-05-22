create or replace function public.admin_assert_valid_mission_config(
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required_fields text[];
  v_field text;
begin
  case p_validation_type
    when 'course_completed' then
      if nullif(trim(coalesce(p_validation_config ->> 'courseId', '')), '') is null then
        raise exception 'Choose a course.';
      end if;
    when 'lesson_completed' then
      if nullif(trim(coalesce(p_validation_config ->> 'lessonId', '')), '') is null then
        raise exception 'Choose a lesson.';
      end if;
    when 'lesson_count_completed' then
      if greatest(1, coalesce((p_validation_config ->> 'count')::integer, 0)) <= 0 then
        raise exception 'Lesson count must be at least 1.';
      end if;
      if coalesce(nullif(p_validation_config ->> 'withinDays', ''), '0') <> '0'
         and coalesce((p_validation_config ->> 'withinDays')::integer, 0) <= 0 then
        raise exception 'Within days must be at least 1 when set.';
      end if;
    when 'referral_friend_completed_lessons' then
      if greatest(1, coalesce((p_validation_config ->> 'requiredFriendLessonCount')::integer, 0)) <= 0 then
        raise exception 'Required friend lesson count must be at least 1.';
      end if;
      if coalesce((p_validation_config ->> 'minimumAccountAgeHours')::integer, 24) < 0 then
        raise exception 'Minimum account age hours cannot be negative.';
      end if;
    when 'proof_upload' then
      select coalesce(array_agg(value::text), '{}')
        into v_required_fields
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(p_validation_config -> 'requiredFields', '[]'::jsonb)) = 'array'
            then coalesce(p_validation_config -> 'requiredFields', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as value;

      if cardinality(v_required_fields) = 0 then
        raise exception 'Choose at least one required proof field.';
      end if;

      foreach v_field in array v_required_fields loop
        if v_field not in ('image', 'video', 'text', 'link', 'location') then
          raise exception 'Unsupported proof field: %', v_field;
        end if;
      end loop;
    when 'manual_review' then
      if nullif(trim(coalesce(p_validation_config ->> 'instructions', '')), '') is null then
        raise exception 'Add manual review instructions.';
      end if;
  end case;
end;
$$;

create or replace function public.admin_create_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_xp integer,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can create a mission.';
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
$$;

create or replace function public.admin_update_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_xp integer,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update a mission.';
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
$$;

create or replace function public.admin_set_mission_status(
  p_mission_id text,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update mission status.';
  end if;

  update public.missions
  set status = p_status,
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
    'mission_status_changed',
    'mission',
    p_mission_id,
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('missionId', p_mission_id, 'status', p_status);
end;
$$;
