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
  v_requirement_mode text := coalesce(nullif(trim(coalesce(p_validation_config ->> 'requirementMode', '')), ''), 'all');
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

      if v_requirement_mode not in ('all', 'any') then
        raise exception 'Proof rule must be all or any.';
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

create or replace function public.mission_proof_fields_satisfy(
  p_required_fields text[],
  p_requirement_mode text,
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_allowed_statuses text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requirement_mode text := case when p_requirement_mode = 'any' then 'any' else 'all' end;
  v_valid boolean;
begin
  if coalesce(cardinality(p_required_fields), 0) = 0 then
    return false;
  end if;

  if v_requirement_mode = 'any' then
    select exists (
      select 1
      from unnest(p_required_fields) required_field
      where exists (
        select 1
        from public.mission_proofs mp
        where mp.user_id = p_user_id
          and mp.mission_id = p_mission_id
          and mp.award_scope = p_award_scope
          and mp.proof_type::text = required_field
          and mp.status::text = any(p_allowed_statuses)
      )
    )
      into v_valid;

    return coalesce(v_valid, false);
  end if;

  select bool_and(exists (
    select 1
    from public.mission_proofs mp
    where mp.user_id = p_user_id
      and mp.mission_id = p_mission_id
      and mp.award_scope = p_award_scope
      and mp.proof_type::text = required_field
      and mp.status::text = any(p_allowed_statuses)
  ))
    into v_valid
    from unnest(p_required_fields) required_field;

  return coalesce(v_valid, false);
end;
$$;

create or replace function public.award_valid_mission_xp(
  p_mission_id text,
  p_award_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_valid boolean := false;
  v_lesson_id text;
  v_course_id text;
  v_required_count integer;
  v_within_days integer;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_referred_user_id uuid;
  v_minimum_account_age_hours integer := 24;
  v_required_fields text[];
  v_requires_manual_review boolean;
  v_requirement_mode text := 'all';
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_mission
    from public.missions
   where id = p_mission_id
     and status = 'published'
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now());

  if v_mission.id is null then
    raise exception 'Mission not found.';
  end if;

  case v_mission.validation_type
    when 'lesson_completed' then
      v_lesson_id := v_mission.validation_config ->> 'lessonId';
      select public.lesson_is_complete_for_user(v_user_id, v_lesson_id)
        into v_valid;

    when 'course_completed' then
      v_course_id := v_mission.validation_config ->> 'courseId';

      select count(*)
        into v_total_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.course_id = v_course_id
         and l.status = 'published'
         and c.status = 'published';

      select count(*)
        into v_completed_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.course_id = v_course_id
         and l.status = 'published'
         and c.status = 'published'
         and public.lesson_is_complete_for_user(v_user_id, l.id);

      v_valid := v_total_lessons > 0 and v_completed_lessons >= v_total_lessons;

    when 'lesson_count_completed' then
      v_required_count := greatest(1, coalesce((v_mission.validation_config ->> 'count')::integer, 1));
      v_within_days := nullif(v_mission.validation_config ->> 'withinDays', '')::integer;

      if v_within_days is null then
        select count(*)
          into v_completed_lessons
          from public.lessons l
          join public.courses c on c.id = l.course_id
         where l.status = 'published'
           and c.status = 'published'
           and public.lesson_is_complete_for_user(v_user_id, l.id);
      else
        select count(distinct lesson_id)
          into v_completed_lessons
          from public.lesson_progress
         where user_id = v_user_id
           and completed_at is not null
           and completed_at >= now() - make_interval(days => v_within_days);
      end if;

      v_valid := v_completed_lessons >= v_required_count;

    when 'referral_friend_completed_lessons' then
      v_required_count := greatest(
        1,
        coalesce((v_mission.validation_config ->> 'requiredFriendLessonCount')::integer, 1)
      );
      v_minimum_account_age_hours := greatest(
        0,
        coalesce((v_mission.validation_config ->> 'minimumAccountAgeHours')::integer, 24)
      );

      if p_award_scope !~ '^referral:' then
        raise exception 'Invalid referral award scope.';
      end if;

      v_referred_user_id := replace(p_award_scope, 'referral:', '')::uuid;

      if not exists (
        select 1
          from public.referral_attributions
         where referrer_user_id = v_user_id
           and referred_user_id = v_referred_user_id
           and created_at <= now() - make_interval(hours => v_minimum_account_age_hours)
      ) then
        raise exception 'Referral is not eligible yet.';
      end if;

      select count(*)
        into v_completed_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.status = 'published'
         and c.status = 'published'
         and public.lesson_is_complete_for_user(v_referred_user_id, l.id);

      v_valid := v_completed_lessons >= v_required_count;

    when 'proof_upload' then
      select array_agg(value::text)
        into v_required_fields
        from jsonb_array_elements_text(
          coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
        ) as value;

      v_requires_manual_review :=
        coalesce((v_mission.validation_config ->> 'requiresManualReview')::boolean, false);
      v_requirement_mode :=
        case
          when coalesce(v_mission.validation_config ->> 'requirementMode', 'all') = 'any' then 'any'
          else 'all'
        end;

      if v_requires_manual_review then
        select public.mission_proof_fields_satisfy(
          v_required_fields,
          v_requirement_mode,
          v_user_id,
          v_mission.id,
          p_award_scope,
          array['approved']
        )
          into v_valid;
      else
        select public.mission_proof_fields_satisfy(
          v_required_fields,
          v_requirement_mode,
          v_user_id,
          v_mission.id,
          p_award_scope,
          array['submitted', 'approved']
        )
          into v_valid;
      end if;

    else
      v_valid := false;
  end case;

  v_valid := coalesce(v_valid, false);

  if not v_valid then
    raise exception 'Mission is not complete.';
  end if;

  return public.grant_mission_award(v_user_id, v_mission.id, p_award_scope);
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
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can review mission proof.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected.';
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
      'rejectionReason', p_rejection_reason
    )
  );

  if p_status = 'rejected' then
    return jsonb_build_object('status', 'rejected');
  end if;

  select array_agg(value::text)
    into v_required_fields
    from jsonb_array_elements_text(
      coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
    ) as value;

  v_requirement_mode :=
    case
      when coalesce(v_mission.validation_config ->> 'requirementMode', 'all') = 'any' then 'any'
      else 'all'
    end;

  select public.mission_proof_fields_satisfy(
    v_required_fields,
    v_requirement_mode,
    p_user_id,
    p_mission_id,
    p_award_scope,
    array['approved']
  )
    into v_valid;

  if not coalesce(v_valid, false) then
    return jsonb_build_object('status', 'approved_pending_required_fields');
  end if;

  return public.grant_mission_award(
    p_user_id,
    v_mission.id,
    p_award_scope,
    jsonb_build_object('reviewedBy', v_actor_id)
  );
end;
$$;

grant execute on function public.mission_proof_fields_satisfy(text[], text, uuid, text, text, text[]) to authenticated;
