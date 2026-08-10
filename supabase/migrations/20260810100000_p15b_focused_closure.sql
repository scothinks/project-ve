update public.organization_plans
set entitlements = jsonb_set(
      entitlements,
      '{allowed_mission_reward_modes}',
      '["organization_xp"]'::jsonb,
      true
    ),
    updated_at = now()
where key in ('team', 'professional', 'enterprise')
  and status = 'active'
  and entitlements ? 'allowed_mission_reward_modes';

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
          and (
            public.current_user_has_organization_role(programme.organization_id, null)
            or exists (
              select 1
              from public.enrolments enrolment
              where enrolment.programme_id = programme.id
                and enrolment.organization_id = programme.organization_id
                and enrolment.user_id = auth.uid()
                and enrolment.status in ('active', 'completed')
            )
          )
        )
      )
  );
$$;

revoke execute on function public.current_user_can_read_programme(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_programme(uuid) to anon, authenticated, service_role;

drop policy if exists "Programme learners can read attached organization missions" on public.missions;
create policy "Programme learners can read attached organization missions"
  on public.missions for select
  using (
    catalog_scope in ('organization_private', 'adapted_platform')
    and status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and exists (
      select 1
      from public.programme_missions programme_mission
      join public.programmes programme
        on programme.id = programme_mission.programme_id
      where programme_mission.mission_id = missions.id
        and programme.organization_id = missions.organization_id
        and public.current_user_can_read_programme(programme.id)
    )
  );

create or replace function public.enforce_organization_mission_content_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id text := nullif(trim(coalesce(new.validation_config ->> 'courseId', '')), '');
  v_lesson_id text := nullif(trim(coalesce(new.validation_config ->> 'lessonId', '')), '');
  v_course public.courses%rowtype;
begin
  if new.organization_id is null then
    return new;
  end if;

  if v_lesson_id is not null then
    select course.*
      into v_course
    from public.lessons lesson
    join public.courses course
      on course.id = lesson.course_id
    where lesson.id = v_lesson_id;

    if not found then
      raise exception 'Mission lesson reference was not found.';
    end if;
  elsif v_course_id is not null then
    select *
      into v_course
    from public.courses
    where id = v_course_id;

    if not found then
      raise exception 'Mission course reference was not found.';
    end if;
  else
    return new;
  end if;

  if v_course.catalog_scope <> 'platform'
     and v_course.organization_id is distinct from new.organization_id then
    raise exception 'Organization missions cannot reference private content from another organization.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_organization_mission_content_scope_trigger on public.missions;
create trigger enforce_organization_mission_content_scope_trigger
  before insert or update on public.missions
  for each row execute function public.enforce_organization_mission_content_scope();

revoke execute on function public.enforce_organization_mission_content_scope()
  from public, anon, authenticated, service_role;

create or replace function public.accept_contextual_referral(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_user_id uuid := auth.uid();
  v_token text := trim(coalesce(p_token, ''));
  v_referral public.contextual_referral_tokens%rowtype;
  v_created public.referral_attributions%rowtype;
  v_enrolment_policy text;
  v_access_status text := 'not_required';
  v_programme public.programmes%rowtype;
  v_course record;
  v_programme_enrolment_created boolean := false;
begin
  if v_referred_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_token = '' then
    raise exception 'Referral token is required.';
  end if;

  select *
    into v_referral
  from public.contextual_referral_tokens
  where token = v_token
    and status = 'published'
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Referral link is not available.';
  end if;

  if v_referral.referrer_user_id = v_referred_user_id then
    raise exception 'You cannot use your own referral link.';
  end if;

  v_enrolment_policy := coalesce(
    nullif(trim(v_referral.eligibility_policy ->> 'enrolmentPolicy'), ''),
    nullif(trim(v_referral.eligibility_policy ->> 'enrollmentPolicy'), ''),
    'automatic'
  );

  if v_enrolment_policy not in ('automatic', 'manual_approval', 'existing_members_only') then
    raise exception 'Referral enrolment policy is not supported.';
  end if;

  if v_referral.organization_id is not null
     and v_enrolment_policy = 'existing_members_only'
     and not public.current_user_has_organization_role(v_referral.organization_id, null) then
    raise exception 'Referral requires an existing organization relationship.';
  end if;

  if exists (
    select 1
    from public.referral_attributions attribution
    where attribution.referred_user_id = v_referred_user_id
      and (
        attribution.contextual_referral_token_id = v_referral.id
        or (
          attribution.organization_id is not distinct from v_referral.organization_id
          and attribution.programme_id is not distinct from v_referral.programme_id
          and attribution.programme_mission_id is not distinct from v_referral.programme_mission_id
        )
      )
  ) then
    raise exception 'A referral has already been applied for this context.';
  end if;

  insert into public.referral_attributions (
    referral_code,
    referrer_user_id,
    referred_user_id,
    status,
    contextual_referral_token_id,
    organization_id,
    programme_id,
    programme_mission_id,
    destination,
    eligibility_policy
  )
  values (
    v_referral.token,
    v_referral.referrer_user_id,
    v_referred_user_id,
    case when v_enrolment_policy = 'manual_approval' then 'in_progress'::public.referral_status else 'signed_up'::public.referral_status end,
    v_referral.id,
    v_referral.organization_id,
    v_referral.programme_id,
    v_referral.programme_mission_id,
    v_referral.destination,
    v_referral.eligibility_policy
  )
  returning * into v_created;

  if v_referral.programme_id is not null
     and v_enrolment_policy in ('automatic', 'existing_members_only') then
    select *
      into v_programme
    from public.programmes
    where id = v_referral.programme_id
      and organization_id = v_referral.organization_id
      and status = 'published';

    if not found then
      raise exception 'Referral programme is not available.';
    end if;

    insert into public.enrolments (
      organization_id,
      user_id,
      programme_id,
      assignment_source,
      status,
      metadata
    )
    values (
      v_programme.organization_id,
      v_referred_user_id,
      v_programme.id,
      'programme',
      'active',
      jsonb_build_object(
        'source', 'contextual_referral',
        'contextualReferralAttributionId', v_created.id,
        'contextualReferralTokenId', v_referral.id
      )
    )
    on conflict (organization_id, user_id, programme_id) where programme_id is not null
    do update
      set status = 'active',
          withdrawn_at = null,
          metadata = enrolments.metadata || excluded.metadata,
          updated_at = now();

    v_programme_enrolment_created := true;

    for v_course in
      select course_id
      from public.programme_courses
      where programme_id = v_programme.id
    loop
      insert into public.enrolments (
        organization_id,
        user_id,
        course_id,
        assignment_source,
        status,
        metadata
      )
      values (
        v_programme.organization_id,
        v_referred_user_id,
        v_course.course_id,
        'programme',
        'active',
        jsonb_build_object(
          'source', 'contextual_referral',
          'programmeId', v_programme.id,
          'contextualReferralAttributionId', v_created.id,
          'contextualReferralTokenId', v_referral.id
        )
      )
      on conflict (organization_id, user_id, course_id) where course_id is not null
      do update
        set status = 'active',
            withdrawn_at = null,
            metadata = enrolments.metadata || excluded.metadata,
            updated_at = now();
    end loop;

    v_access_status := 'granted';
  elsif v_enrolment_policy = 'manual_approval' then
    v_access_status := 'pending';
  elsif v_referral.organization_id is not null then
    v_access_status := case when public.current_user_can_enter_organization(v_referral.organization_id) then 'granted' else 'not_granted' end;
  else
    v_access_status := 'granted';
  end if;

  return jsonb_build_object(
    'status', case when v_access_status = 'pending' then 'pending_access' else 'accepted' end,
    'accessStatus', v_access_status,
    'programmeEnrolmentCreated', v_programme_enrolment_created,
    'referralAttributionId', v_created.id,
    'organizationId', v_created.organization_id,
    'programmeId', v_created.programme_id,
    'programmeMissionId', v_created.programme_mission_id,
    'destination', case when v_access_status = 'granted' then v_created.destination else null end
  );
end;
$$;

revoke execute on function public.accept_contextual_referral(text)
  from public, anon, authenticated, service_role;
grant execute on function public.accept_contextual_referral(text)
  to authenticated, service_role;

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
  v_programme_id uuid;
  v_programme public.programmes%rowtype;
  v_programme_mission public.programme_missions%rowtype;
  v_metadata jsonb := '{}'::jsonb;
  v_award_scope_payload text := p_award_scope;
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

  if p_award_scope ~ '^programme:' then
    v_programme_id := split_part(p_award_scope, ':', 2)::uuid;

    select *
      into v_programme
    from public.programmes
    where id = v_programme_id
      and status = 'published';

    if not found or not public.current_user_can_read_programme(v_programme.id) then
      raise exception 'Programme mission context is not available.';
    end if;

    select *
      into v_programme_mission
    from public.programme_missions
    where programme_id = v_programme_id
      and mission_id = p_mission_id;

    if not found then
      raise exception 'Programme mission context is not available.';
    end if;

    if v_programme_mission.starts_at is not null and v_programme_mission.starts_at > now() then
      raise exception 'Programme mission is not available yet.';
    end if;

    if v_programme_mission.due_at is not null and v_programme_mission.due_at <= now() then
      raise exception 'Programme mission is past its due date.';
    end if;

    v_metadata := jsonb_build_object(
      'organizationId', v_programme.organization_id,
      'programmeId', v_programme.id,
      'programmeMissionId', v_programme_mission.mission_id,
      'xpAccountId', v_programme_mission.xp_account_id,
      'rewardXpOverride', v_programme_mission.reward_xp_override
    );
    v_award_scope_payload := regexp_replace(p_award_scope, '^programme:[^:]+:', '');
  end if;

  case v_mission.validation_type
    when 'lesson_completed' then
      v_lesson_id := v_mission.validation_config ->> 'lessonId';

      select exists (
        select 1
        from public.lessons lesson
        join public.courses course
          on course.id = lesson.course_id
        where lesson.id = v_lesson_id
          and lesson.status = 'published'
          and course.status = 'published'
          and (
            v_programme_id is null
            or exists (
              select 1
              from public.programme_courses programme_course
              where programme_course.programme_id = v_programme_id
                and programme_course.course_id = lesson.course_id
            )
          )
          and public.lesson_is_complete_for_user(v_user_id, lesson.id)
      )
        into v_valid;

    when 'course_completed' then
      v_course_id := v_mission.validation_config ->> 'courseId';

      select count(*)
        into v_total_lessons
        from public.lessons lesson
        join public.courses course on course.id = lesson.course_id
       where lesson.course_id = v_course_id
         and lesson.status = 'published'
         and course.status = 'published'
         and (
           v_programme_id is null
           or exists (
             select 1
             from public.programme_courses programme_course
             where programme_course.programme_id = v_programme_id
               and programme_course.course_id = lesson.course_id
           )
         );

      select count(*)
        into v_completed_lessons
        from public.lessons lesson
        join public.courses course on course.id = lesson.course_id
       where lesson.course_id = v_course_id
         and lesson.status = 'published'
         and course.status = 'published'
         and (
           v_programme_id is null
           or exists (
             select 1
             from public.programme_courses programme_course
             where programme_course.programme_id = v_programme_id
               and programme_course.course_id = lesson.course_id
           )
         )
         and public.lesson_is_complete_for_user(v_user_id, lesson.id);

      v_valid := v_total_lessons > 0 and v_completed_lessons >= v_total_lessons;

    when 'lesson_count_completed' then
      v_required_count := greatest(1, coalesce((v_mission.validation_config ->> 'count')::integer, 1));
      v_within_days := nullif(v_mission.validation_config ->> 'withinDays', '')::integer;

      if v_within_days is null then
        select count(*)
          into v_completed_lessons
          from public.lessons lesson
          join public.courses course on course.id = lesson.course_id
         where lesson.status = 'published'
           and course.status = 'published'
           and (
             v_programme_id is null
             or exists (
               select 1
               from public.programme_courses programme_course
               where programme_course.programme_id = v_programme_id
                 and programme_course.course_id = lesson.course_id
             )
           )
           and public.lesson_is_complete_for_user(v_user_id, lesson.id);
      else
        select count(distinct progress.lesson_id)
          into v_completed_lessons
          from public.lesson_progress progress
          join public.lessons lesson on lesson.id = progress.lesson_id
          join public.courses course on course.id = lesson.course_id
         where progress.user_id = v_user_id
           and progress.completed_at is not null
           and progress.completed_at >= now() - make_interval(days => v_within_days)
           and lesson.status = 'published'
           and course.status = 'published'
           and (
             v_programme_id is null
             or exists (
               select 1
               from public.programme_courses programme_course
               where programme_course.programme_id = v_programme_id
                 and programme_course.course_id = lesson.course_id
             )
           );
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

      if v_award_scope_payload !~ '^referral:' then
        raise exception 'Invalid referral award scope.';
      end if;

      v_referred_user_id := replace(v_award_scope_payload, 'referral:', '')::uuid;

      if not exists (
        select 1
          from public.referral_attributions
         where referrer_user_id = v_user_id
           and referred_user_id = v_referred_user_id
           and created_at <= now() - make_interval(hours => v_minimum_account_age_hours)
           and (
             (
               v_programme_id is null
               and organization_id is null
               and programme_id is null
               and programme_mission_id is null
             )
             or (
               v_programme_id is not null
               and organization_id = v_programme.organization_id
               and programme_id = v_programme.id
               and programme_mission_id = v_programme_mission.mission_id
             )
           )
      ) then
        raise exception 'Referral is not eligible yet.';
      end if;

      select count(*)
        into v_completed_lessons
        from public.lessons lesson
        join public.courses course on course.id = lesson.course_id
       where lesson.status = 'published'
         and course.status = 'published'
         and (
           v_programme_id is null
           or exists (
             select 1
             from public.programme_courses programme_course
             where programme_course.programme_id = v_programme_id
               and programme_course.course_id = lesson.course_id
           )
         )
         and public.lesson_is_complete_for_user(v_referred_user_id, lesson.id);

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

  return public.grant_mission_award(v_user_id, v_mission.id, p_award_scope, v_metadata);
end;
$$;

grant execute on function public.award_valid_mission_xp(text, text) to authenticated;

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
  v_organization_id uuid;
  v_programme_id uuid;
  v_programme_mission_id text;
begin
  if v_actor_id is null then
    raise exception 'Only an admin can review mission proof.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected.';
  end if;

  select organization_id, programme_id, programme_mission_id
    into v_organization_id, v_programme_id, v_programme_mission_id
  from public.mission_proofs
  where user_id = p_user_id
    and mission_id = p_mission_id
    and award_scope = p_award_scope
  order by created_at asc
  limit 1;

  if not found then
    raise exception 'Mission proof submission was not found.';
  end if;

  if v_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Only a platform admin can review public mission proof.';
    end if;
  elsif not (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(
      v_organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'reviewer',
        'instructor'
      ]::public.organization_role_key[]
    )
  ) then
    raise exception 'Only organization proof reviewers can review this mission proof.';
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
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id,
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
    jsonb_build_object(
      'reviewedBy', v_actor_id,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id
    )
  );
end;
$$;

grant execute on function public.admin_review_mission_proof_submission(
  uuid,
  text,
  text,
  public.review_status,
  text
) to authenticated;

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
    'enforce_organization_mission_content_scope',
    '',
    'TRIGGER_ONLY',
    'Organization mission content tenant boundary enforcement trigger.',
    'Runs only as a table trigger to reject organization mission course or lesson references to another tenant private content.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
