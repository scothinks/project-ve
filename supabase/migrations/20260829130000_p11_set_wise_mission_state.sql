create or replace function public.get_dashboard_mission_state(
  p_deliveries jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deliveries jsonb := coalesce(p_deliveries, '[]'::jsonb);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if jsonb_typeof(v_deliveries) <> 'array' then
    raise exception 'Mission deliveries must be a JSON array.';
  end if;

  if jsonb_array_length(v_deliveries) > 100 then
    raise exception 'Mission delivery limit exceeded.';
  end if;

  with requested_deliveries as (
    select
      delivery.ordinality::integer as request_order,
      nullif(trim(delivery.item ->> 'deliveryId'), '') as requested_delivery_id,
      nullif(trim(delivery.item ->> 'missionId'), '') as mission_id,
      nullif(trim(delivery.item ->> 'organizationId'), '')::uuid as organization_id,
      nullif(trim(delivery.item ->> 'programmeId'), '')::uuid as programme_id,
      nullif(trim(delivery.item ->> 'programmeMissionId'), '') as programme_mission_id
    from jsonb_array_elements(v_deliveries) with ordinality as delivery(item, ordinality)
  ),
  authorized_deliveries as (
    select
      requested.request_order,
      case
        when requested.programme_id is not null
          then requested.programme_id::text || ':' || mission.id
        when requested.organization_id is not null
          then requested.organization_id::text || ':' || mission.id
        else mission.id
      end as delivery_id,
      mission.id as mission_id,
      mission.repeatability,
      mission.validation_type,
      mission.validation_config,
      mission.starts_at,
      mission.ends_at,
      requested.organization_id,
      requested.programme_id,
      case
        when requested.programme_id is not null then programme_mission.mission_id
        else null
      end as programme_mission_id,
      case
        when mission.repeatability = 'daily' then
          'day:' || (timezone('Africa/Lagos', now()))::date::text
        when mission.repeatability = 'weekly' then
          'week:' || date_trunc('week', timezone('Africa/Lagos', now()))::date::text
        when mission.repeatability = 'campaign' then
          'campaign:'
          || coalesce(to_char(mission.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'open')
          || ':'
          || coalesce(to_char(mission.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'open')
        when mission.repeatability = 'per_referral' then 'referral'
        else 'lifetime'
      end as period_scope
    from requested_deliveries requested
    join public.missions mission
      on mission.id = requested.mission_id
     and mission.status = 'published'
     and (mission.starts_at is null or mission.starts_at <= now())
     and (mission.ends_at is null or mission.ends_at > now())
    left join public.programmes programme
      on programme.id = requested.programme_id
     and programme.organization_id = requested.organization_id
     and programme.status = 'published'
    left join public.programme_missions programme_mission
      on programme_mission.programme_id = programme.id
     and programme_mission.mission_id = mission.id
    where requested.mission_id is not null
      and (
        (
          requested.organization_id is null
          and requested.programme_id is null
          and mission.catalog_scope = 'platform'
        )
        or (
          requested.organization_id is not null
          and requested.programme_id is null
          and mission.organization_id = requested.organization_id
          and mission.catalog_scope in ('organization_private', 'adapted_platform')
          and mission.delivery_scope = 'organization'
          and exists (
            select 1
            from public.organization_memberships membership
            where membership.organization_id = requested.organization_id
              and membership.user_id = v_user_id
              and membership.status = 'active'
          )
        )
        or (
          requested.organization_id is not null
          and requested.programme_id is not null
          and programme.id is not null
          and programme_mission.mission_id is not null
          and public.current_user_can_read_programme(programme.id)
          and (programme_mission.starts_at is null or programme_mission.starts_at <= now())
          and (programme_mission.due_at is null or programme_mission.due_at > now())
          and (
            mission.catalog_scope = 'platform'
            or mission.organization_id = requested.organization_id
          )
        )
      )
  ),
  scoped_deliveries as (
    select
      delivery.*,
      case
        when delivery.repeatability = 'per_referral' then delivery.period_scope
        when delivery.programme_id is not null then
          'programme:' || delivery.programme_id::text || ':' || delivery.period_scope
        when delivery.organization_id is not null then
          'organization:' || delivery.organization_id::text || ':' || delivery.period_scope
        else delivery.period_scope
      end as award_scope
    from authorized_deliveries delivery
  ),
  lesson_catalog as (
    select
      lesson.id,
      lesson.course_id,
      count(page.id)::integer as page_count
    from public.lessons lesson
    join public.courses course
      on course.id = lesson.course_id
     and course.status = 'published'
    left join public.lesson_pages page
      on page.lesson_id = lesson.id
    where lesson.status = 'published'
    group by lesson.id, lesson.course_id
  ),
  referral_rows as (
    select attribution.*
    from public.referral_attributions attribution
    where attribution.referrer_user_id = v_user_id
  ),
  progress_users as (
    select v_user_id as user_id
    union
    select referral.referred_user_id from referral_rows referral
  ),
  public_completed_lessons as (
    select completion.user_id, catalog.id as lesson_id, catalog.course_id
    from progress_users progress_user
    join public.lesson_page_completions completion
      on completion.user_id = progress_user.user_id
    join lesson_catalog catalog
      on catalog.id = completion.lesson_id
    where catalog.page_count > 0
    group by completion.user_id, catalog.id, catalog.course_id, catalog.page_count
    having count(distinct completion.page_id) >= catalog.page_count
  ),
  programme_completed_lessons as (
    select completion.programme_id, catalog.id as lesson_id, catalog.course_id
    from public.programme_lesson_page_completions completion
    join lesson_catalog catalog
      on catalog.id = completion.lesson_id
    where completion.user_id = v_user_id
      and catalog.page_count > 0
    group by completion.programme_id, catalog.id, catalog.course_id, catalog.page_count
    having count(distinct completion.page_id) >= catalog.page_count
  ),
  state_rows as (
    select
      delivery.request_order,
      delivery.delivery_id,
      delivery.mission_id,
      delivery.validation_type,
      delivery.repeatability,
      delivery.organization_id,
      delivery.programme_id,
      delivery.programme_mission_id,
      delivery.award_scope,
      award_state.awarded_count,
      case
        when delivery.repeatability = 'per_referral' then award_state.awarded_count > 0
        else award_state.has_current_award
      end as has_current_award,
      progress.progress_count,
      progress.target_count,
      progress.is_valid,
      proof.review_status,
      proof.required_fields,
      proof.requirement_mode,
      proof.field_statuses,
      referral.invited_count,
      referral.qualified_count,
      referral.qualified_ids,
      referral_token.token as referral_token
    from scoped_deliveries delivery
    cross join lateral (
      select
        count(award.id)::integer as awarded_count,
        coalesce(bool_or(award.award_scope = delivery.award_scope), false) as has_current_award
      from public.mission_awards award
      where award.user_id = v_user_id
        and award.mission_id = delivery.mission_id
        and award.organization_id is not distinct from delivery.organization_id
        and award.programme_id is not distinct from delivery.programme_id
        and award.programme_mission_id is not distinct from delivery.programme_mission_id
    ) award_state
    cross join lateral (
      select
        case delivery.validation_type
          when 'lesson_completed' then case when lesson_progress.completed then 1 else 0 end
          when 'course_completed' then course_progress.completed_count
          when 'lesson_count_completed' then lesson_count_progress.completed_count
          when 'referral_friend_completed_lessons' then referral_progress.qualified_count
          when 'proof_upload' then proof_progress.progress_count
          else 0
        end::integer as progress_count,
        case delivery.validation_type
          when 'course_completed' then greatest(1, course_progress.total_count)
          when 'lesson_count_completed' then lesson_count_progress.target_count
          when 'proof_upload' then proof_progress.target_count
          else 1
        end::integer as target_count,
        case delivery.validation_type
          when 'lesson_completed' then lesson_progress.completed
          when 'course_completed' then course_progress.total_count > 0
            and course_progress.completed_count >= course_progress.total_count
          when 'lesson_count_completed' then
            lesson_count_progress.completed_count >= lesson_count_progress.target_count
          when 'referral_friend_completed_lessons' then referral_progress.qualified_count > 0
          when 'proof_upload' then proof_progress.is_valid
          else false
        end as is_valid
      from lateral (
        select exists (
          select 1
          from lesson_catalog catalog
          where catalog.id = delivery.validation_config ->> 'lessonId'
            and (
              delivery.programme_id is null
              or exists (
                select 1 from public.programme_courses programme_course
                where programme_course.programme_id = delivery.programme_id
                  and programme_course.course_id = catalog.course_id
              )
            )
            and (
              (delivery.programme_id is null and exists (
                select 1 from public_completed_lessons completed
                where completed.user_id = v_user_id and completed.lesson_id = catalog.id
              ))
              or (delivery.programme_id is not null and exists (
                select 1 from programme_completed_lessons completed
                where completed.programme_id = delivery.programme_id and completed.lesson_id = catalog.id
              ))
            )
        ) as completed
      ) lesson_progress
      cross join lateral (
        select
          count(*)::integer as total_count,
          count(*) filter (where
            (delivery.programme_id is null and exists (
              select 1 from public_completed_lessons completed
              where completed.user_id = v_user_id and completed.lesson_id = catalog.id
            ))
            or (delivery.programme_id is not null and exists (
              select 1 from programme_completed_lessons completed
              where completed.programme_id = delivery.programme_id and completed.lesson_id = catalog.id
            ))
          )::integer as completed_count
        from lesson_catalog catalog
        where catalog.course_id = delivery.validation_config ->> 'courseId'
          and (
            delivery.programme_id is null
            or exists (
              select 1 from public.programme_courses programme_course
              where programme_course.programme_id = delivery.programme_id
                and programme_course.course_id = catalog.course_id
            )
          )
      ) course_progress
      cross join lateral (
        select
          greatest(1, coalesce(nullif(delivery.validation_config ->> 'count', '')::integer, 1)) as target_count,
          case
            when delivery.programme_id is not null
              and nullif(delivery.validation_config ->> 'withinDays', '') is not null
            then (
              select count(*)::integer
              from lesson_catalog catalog
              where exists (
                select 1 from public.programme_courses programme_course
                where programme_course.programme_id = delivery.programme_id
                  and programme_course.course_id = catalog.course_id
              )
                and catalog.page_count > 0
                and not exists (
                  select 1
                  from public.lesson_pages page
                  where page.lesson_id = catalog.id
                    and not exists (
                      select 1
                      from public.programme_lesson_page_completions completion
                      where completion.user_id = v_user_id
                        and completion.programme_id = delivery.programme_id
                        and completion.lesson_id = catalog.id
                        and completion.page_id = page.id
                        and completion.completed_at >= now() - make_interval(
                          days => nullif(delivery.validation_config ->> 'withinDays', '')::integer
                        )
                    )
                )
            )
            when delivery.programme_id is not null then (
              select count(*)::integer
              from programme_completed_lessons completed
              where completed.programme_id = delivery.programme_id
                and exists (
                  select 1 from public.programme_courses programme_course
                  where programme_course.programme_id = delivery.programme_id
                    and programme_course.course_id = completed.course_id
                )
            )
            when nullif(delivery.validation_config ->> 'withinDays', '') is not null then (
              select count(distinct progress.lesson_id)::integer
              from public.lesson_progress progress
              join lesson_catalog catalog on catalog.id = progress.lesson_id
              where progress.user_id = v_user_id
                and progress.completed_at is not null
                and progress.completed_at >= now() - make_interval(
                  days => nullif(delivery.validation_config ->> 'withinDays', '')::integer
                )
            )
            else (
              select count(*)::integer
              from public_completed_lessons completed
              where completed.user_id = v_user_id
            )
          end as completed_count
      ) lesson_count_progress
      cross join lateral (
        select
          count(*)::integer as invited_count,
          count(*) filter (where
            referral.created_at <= now() - make_interval(
              hours => greatest(
                0,
                coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24)
              )
            )
            and (
              select count(*)
              from public_completed_lessons completed
              where completed.user_id = referral.referred_user_id
                and (
                  delivery.programme_id is null
                  or exists (
                    select 1 from public.programme_courses programme_course
                    where programme_course.programme_id = delivery.programme_id
                      and programme_course.course_id = completed.course_id
                  )
                )
            ) >= greatest(
              1,
              coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1)
            )
          )::integer as qualified_count,
          coalesce(
            jsonb_agg(referral.referred_user_id order by referral.created_at)
              filter (where
                referral.created_at <= now() - make_interval(
                  hours => greatest(
                    0,
                    coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24)
                  )
                )
                and (
                  select count(*)
                  from public_completed_lessons completed
                  where completed.user_id = referral.referred_user_id
                    and (
                      delivery.programme_id is null
                      or exists (
                        select 1 from public.programme_courses programme_course
                        where programme_course.programme_id = delivery.programme_id
                          and programme_course.course_id = completed.course_id
                      )
                    )
                ) >= greatest(
                  1,
                  coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1)
                )
              ),
            '[]'::jsonb
          ) as qualified_ids
        from referral_rows referral
        where referral.organization_id is not distinct from delivery.organization_id
          and referral.programme_id is not distinct from delivery.programme_id
          and referral.programme_mission_id is not distinct from delivery.programme_mission_id
      ) referral_progress
      cross join lateral (
        select
          coalesce(proof_summary.progress_count, 0)::integer as progress_count,
          case when proof_config.requirement_mode = 'any' then 1 else proof_config.required_count end::integer as target_count,
          case
            when proof_config.requires_manual_review then coalesce(proof_summary.approved_count, 0) >=
              case when proof_config.requirement_mode = 'any' then 1 else proof_config.required_count end
            else coalesce(proof_summary.present_count, 0) >=
              case when proof_config.requirement_mode = 'any' then 1 else proof_config.required_count end
          end as is_valid
        from lateral (
          select
            case when coalesce(delivery.validation_config ->> 'requirementMode', 'all') = 'any' then 'any' else 'all' end as requirement_mode,
            coalesce((delivery.validation_config ->> 'requiresManualReview')::boolean, false) as requires_manual_review,
            greatest(1, jsonb_array_length(coalesce(delivery.validation_config -> 'requiredFields', '["text"]'::jsonb))) as required_count
        ) proof_config
        left join lateral (
          select
            count(*) filter (where field_state.status <> 'pending')::integer as progress_count,
            count(*) filter (where field_state.status <> 'pending')::integer as present_count,
            count(*) filter (where field_state.status = 'approved')::integer as approved_count
          from (
            select required_field.field,
              case
                when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'approved') then 'approved'
                when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'submitted') then 'submitted'
                when (
                  proof_config.requirement_mode <> 'any'
                  or not exists (
                    select 1 from public.mission_proofs submitted_proof
                    where submitted_proof.user_id = v_user_id
                      and submitted_proof.mission_id = delivery.mission_id
                      and submitted_proof.award_scope = delivery.award_scope
                      and submitted_proof.status = 'submitted'
                  )
                )
                  and exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'rejected') then 'rejected'
                else 'pending'
              end as status
            from jsonb_array_elements_text(coalesce(delivery.validation_config -> 'requiredFields', '["text"]'::jsonb)) required_field(field)
          ) field_state
        ) proof_summary on true
      ) proof_progress
    ) progress
    cross join lateral (
      select
        case
          when delivery.validation_type <> 'proof_upload' then null
          when bool_or(field_state.status = 'rejected') then 'rejected'
          when proof_config.requires_manual_review
            and count(*) filter (where field_state.status = 'approved') >=
              case
                when proof_config.requirement_mode = 'any' then 1
                else jsonb_array_length(proof_config.required_fields)
              end
            then 'approved'
          when proof_config.requires_manual_review and bool_or(field_state.status in ('submitted', 'approved')) then 'submitted'
          else null
        end as review_status,
        case when delivery.validation_type = 'proof_upload' then proof_config.required_fields else null end as required_fields,
        case when delivery.validation_type = 'proof_upload' then proof_config.requirement_mode else null end as requirement_mode,
        case
          when delivery.validation_type = 'proof_upload' then coalesce(jsonb_object_agg(field_state.field, field_state.status), '{}'::jsonb)
          else null
        end as field_statuses
      from lateral (
        select
          case when coalesce(delivery.validation_config ->> 'requirementMode', 'all') = 'any' then 'any' else 'all' end as requirement_mode,
          coalesce((delivery.validation_config ->> 'requiresManualReview')::boolean, false) as requires_manual_review,
          coalesce(delivery.validation_config -> 'requiredFields', '["text"]'::jsonb) as required_fields
      ) proof_config
      left join lateral (
        select required_field.field,
          case
            when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'approved') then 'approved'
            when exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'submitted') then 'submitted'
            when (
              proof_config.requirement_mode <> 'any'
              or not exists (
                select 1 from public.mission_proofs submitted_proof
                where submitted_proof.user_id = v_user_id
                  and submitted_proof.mission_id = delivery.mission_id
                  and submitted_proof.award_scope = delivery.award_scope
                  and submitted_proof.status = 'submitted'
              )
            )
              and exists (select 1 from public.mission_proofs proof where proof.user_id = v_user_id and proof.mission_id = delivery.mission_id and proof.award_scope = delivery.award_scope and proof.proof_type::text = required_field.field and proof.status = 'rejected') then 'rejected'
            else 'pending'
          end as status
        from jsonb_array_elements_text(proof_config.required_fields) required_field(field)
      ) field_state on true
      group by proof_config.requirement_mode, proof_config.requires_manual_review, proof_config.required_fields
    ) proof
    cross join lateral (
      select
        referral_progress.invited_count,
        referral_progress.qualified_count,
        referral_progress.qualified_ids
      from (
        select
          count(*)::integer as invited_count,
          count(*) filter (where
            referral.created_at <= now() - make_interval(
              hours => greatest(0, coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24))
            )
            and (
              select count(*) from public_completed_lessons completed
              where completed.user_id = referral.referred_user_id
                and (
                  delivery.programme_id is null
                  or exists (
                    select 1 from public.programme_courses programme_course
                    where programme_course.programme_id = delivery.programme_id
                      and programme_course.course_id = completed.course_id
                  )
                )
            ) >= greatest(1, coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1))
          )::integer as qualified_count,
          coalesce(jsonb_agg(referral.referred_user_id) filter (where
            referral.created_at <= now() - make_interval(
              hours => greatest(0, coalesce(nullif(delivery.validation_config ->> 'minimumAccountAgeHours', '')::integer, 24))
            )
            and (
              select count(*) from public_completed_lessons completed
              where completed.user_id = referral.referred_user_id
                and (
                  delivery.programme_id is null
                  or exists (
                    select 1 from public.programme_courses programme_course
                    where programme_course.programme_id = delivery.programme_id
                      and programme_course.course_id = completed.course_id
                  )
                )
            ) >= greatest(1, coalesce(nullif(delivery.validation_config ->> 'requiredFriendLessonCount', '')::integer, 1))
          ), '[]'::jsonb) as qualified_ids
        from referral_rows referral
        where referral.organization_id is not distinct from delivery.organization_id
          and referral.programme_id is not distinct from delivery.programme_id
          and referral.programme_mission_id is not distinct from delivery.programme_mission_id
      ) referral_progress
    ) referral
    left join lateral (
      select token.token
      from public.contextual_referral_tokens token
      where delivery.validation_type = 'referral_friend_completed_lessons'
        and delivery.programme_id is not null
        and token.referrer_user_id = v_user_id
        and token.organization_id = delivery.organization_id
        and token.programme_id = delivery.programme_id
        and token.programme_mission_id = delivery.programme_mission_id
        and token.status = 'published'
        and (token.expires_at is null or token.expires_at > now())
      order by token.created_at desc
      limit 1
    ) referral_token on true
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'deliveryId', state.delivery_id,
        'missionId', state.mission_id,
        'awardedCount', state.awarded_count,
        'hasCurrentAward', state.has_current_award,
        'progressCount', state.progress_count,
        'targetCount', state.target_count,
        'valid', state.is_valid,
        'reviewStatus', state.review_status,
        'proofRequiredFields', state.required_fields,
        'proofRequirementMode', state.requirement_mode,
        'proofFieldStatuses', state.field_statuses,
        'referralInvitedCount', state.invited_count,
        'referralQualifiedCount', state.qualified_count,
        'referralQualifiedIds', state.qualified_ids,
        'referralToken', state.referral_token,
        'organizationId', state.organization_id,
        'programmeId', state.programme_id,
        'programmeMissionId', state.programme_mission_id,
        'awardScope', state.award_scope
      )
      order by state.request_order
    ),
    '[]'::jsonb
  )
  into v_result
  from state_rows state;

  return v_result;
end;
$$;

revoke execute on function public.get_dashboard_mission_state(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.get_dashboard_mission_state(jsonb)
  to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values (
  'public',
  'get_dashboard_mission_state',
  'p_deliveries jsonb',
  'PUBLIC_AUTHENTICATED_SELF',
  'Authenticated learner mission lists evaluating the current caller state in one read-only database operation.',
  'Derives identity only from auth.uid(); revalidates public, active-membership organisation, or readable-programme delivery scope; returns only the current caller award/proof/referral progress and existing contextual invite token.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
