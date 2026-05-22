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
  v_required_fields text[];
  v_requires_manual_review boolean;
  v_transaction_id uuid;
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
      select exists (
        select 1
          from public.lesson_progress
         where user_id = v_user_id
           and lesson_id = v_lesson_id
           and completed_at is not null
      ) into v_valid;

    when 'course_completed' then
      v_course_id := v_mission.validation_config ->> 'courseId';

      select count(*)
        into v_total_lessons
        from public.lessons
       where course_id = v_course_id
         and status = 'published';

      select count(distinct lp.lesson_id)
        into v_completed_lessons
        from public.lesson_progress lp
        join public.lessons l on l.id = lp.lesson_id
       where lp.user_id = v_user_id
         and lp.completed_at is not null
         and l.course_id = v_course_id
         and l.status = 'published';

      v_valid := v_total_lessons > 0 and v_completed_lessons >= v_total_lessons;

    when 'lesson_count_completed' then
      v_required_count := greatest(1, coalesce((v_mission.validation_config ->> 'count')::integer, 1));
      v_within_days := nullif(v_mission.validation_config ->> 'withinDays', '')::integer;

      select count(distinct lesson_id)
        into v_completed_lessons
        from public.lesson_progress
       where user_id = v_user_id
         and completed_at is not null
         and (
           v_within_days is null
           or completed_at >= now() - make_interval(days => v_within_days)
         );

      v_valid := v_completed_lessons >= v_required_count;

    when 'referral_friend_completed_lessons' then
      v_required_count := greatest(
        1,
        coalesce((v_mission.validation_config ->> 'requiredFriendLessonCount')::integer, 1)
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
      ) then
        raise exception 'Referral is not attributed to this user.';
      end if;

      select count(distinct lesson_id)
        into v_completed_lessons
        from public.lesson_progress
       where user_id = v_referred_user_id
         and completed_at is not null;

      v_valid := v_completed_lessons >= v_required_count;

    when 'proof_upload' then
      select array_agg(value::text)
        into v_required_fields
        from jsonb_array_elements_text(
          coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
        ) as value;

      v_requires_manual_review :=
        coalesce((v_mission.validation_config ->> 'requiresManualReview')::boolean, false);

      if v_requires_manual_review then
        select bool_and(exists (
          select 1
            from public.mission_proofs mp
           where mp.user_id = v_user_id
             and mp.mission_id = v_mission.id
             and mp.award_scope = p_award_scope
             and mp.proof_type::text = required_field
             and mp.status = 'approved'
        ))
          into v_valid
          from unnest(v_required_fields) required_field;
      else
        select bool_and(exists (
          select 1
            from public.mission_proofs mp
           where mp.user_id = v_user_id
             and mp.mission_id = v_mission.id
             and mp.award_scope = p_award_scope
             and mp.proof_type::text = required_field
             and mp.status in ('submitted', 'approved')
        ))
          into v_valid
          from unnest(v_required_fields) required_field;
      end if;

    else
      v_valid := false;
  end case;

  v_valid := coalesce(v_valid, false);

  if not v_valid then
    raise exception 'Mission is not complete.';
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
    v_user_id,
    v_mission.reward_xp,
    'earn',
    'mission',
    v_mission.id,
    'mission:' || v_mission.id || ':' || p_award_scope,
    jsonb_build_object('missionId', v_mission.id, 'awardScope', p_award_scope)
  )
  on conflict (user_id, award_scope)
    where direction = 'earn' and award_scope is not null
    do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    return jsonb_build_object('status', 'already_awarded');
  end if;

  insert into public.mission_awards (
    user_id,
    mission_id,
    award_scope,
    xp_transaction_id
  )
  values (
    v_user_id,
    v_mission.id,
    p_award_scope,
    v_transaction_id
  )
  on conflict (user_id, mission_id, award_scope) do nothing;

  perform public.increment_profile_xp(v_user_id, v_mission.reward_xp);

  return jsonb_build_object(
    'status', 'awarded',
    'missionId', v_mission.id,
    'awardScope', p_award_scope,
    'awardedXp', v_mission.reward_xp
  );
end;
$$;

grant execute on function public.award_valid_mission_xp(text, text) to authenticated;
