create or replace function public.admin_get_lms_reporting(
  p_organization_id uuid default null,
  p_programme_id uuid default null,
  p_cohort_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := p_organization_id;
  v_programme public.programmes%rowtype;
  v_cohort public.cohorts%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_summary jsonb := '{}'::jsonb;
  v_cohort_comparison jsonb := '[]'::jsonb;
  v_learners jsonb := '[]'::jsonb;
  v_quiz_scores jsonb := '[]'::jsonb;
  v_mission_completion jsonb := '[]'::jsonb;
  v_reward_usage jsonb := '[]'::jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_programme_id is not null then
    select *
      into v_programme
    from public.programmes
    where id = p_programme_id;

    if not found then
      raise exception 'Programme not found.';
    end if;

    if v_organization_id is not null and v_organization_id <> v_programme.organization_id then
      raise exception 'Programme does not belong to the selected organisation.';
    end if;

    v_organization_id := v_programme.organization_id;
  end if;

  if p_cohort_id is not null then
    select *
      into v_cohort
    from public.cohorts
    where id = p_cohort_id;

    if not found then
      raise exception 'Cohort not found.';
    end if;

    if v_organization_id is not null and v_organization_id <> v_cohort.organization_id then
      raise exception 'Cohort does not belong to the selected organisation.';
    end if;

    v_organization_id := v_cohort.organization_id;
  end if;

  if v_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Reporting access required.' using errcode = '42501';
    end if;
  elsif not public.current_user_can_read_organization_audience(v_organization_id) then
    raise exception 'Reporting access required.' using errcode = '42501';
  end if;

  drop table if exists pg_temp.lms_reporting_enrolments;
  create temporary table pg_temp.lms_reporting_enrolments on commit drop as
  select enrolment.*
  from public.enrolments enrolment
  where (v_organization_id is null or enrolment.organization_id = v_organization_id)
    and (
      p_programme_id is null
      or enrolment.programme_id = p_programme_id
      or enrolment.metadata ->> 'programmeId' = p_programme_id::text
    )
    and (
      p_cohort_id is null
      or enrolment.metadata ->> 'cohortId' = p_cohort_id::text
    );

  drop table if exists pg_temp.lms_reporting_users;
  create temporary table pg_temp.lms_reporting_users on commit drop as
  select distinct enrolment.user_id
  from pg_temp.lms_reporting_enrolments enrolment;

  drop table if exists pg_temp.lms_reporting_quiz_attempt_scores;
  create temporary table pg_temp.lms_reporting_quiz_attempt_scores on commit drop as
  select
    attempt.id as attempt_id,
    attempt.user_id,
    attempt.quiz_id,
    quiz.title as quiz_title,
    lesson.course_id,
    case
      when count(answer.id) = 0 then 0
      else round(avg(case when answer.is_correct then 100::numeric else 0::numeric end))::integer
    end as score
  from public.quiz_attempts attempt
  join public.quizzes quiz
    on quiz.id = attempt.quiz_id
  join public.lessons lesson
    on lesson.id = attempt.lesson_id
  join pg_temp.lms_reporting_users scoped_user
    on scoped_user.user_id = attempt.user_id
  left join public.quiz_answers answer
    on answer.attempt_id = attempt.id
   and answer.user_id = attempt.user_id
  where attempt.status <> 'in_progress'
    and exists (
      select 1
      from pg_temp.lms_reporting_enrolments enrolment
      where enrolment.user_id = attempt.user_id
        and enrolment.course_id = lesson.course_id
    )
  group by attempt.id, attempt.user_id, attempt.quiz_id, quiz.title, lesson.course_id;

  select jsonb_build_object(
    'organizationId', v_organization_id,
    'programmeId', p_programme_id,
    'cohortId', p_cohort_id,
    'assignedLearners', coalesce(count(distinct enrolment.user_id), 0),
    'startedLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.started_at is not null
        or course_completion.progress_percent > 0
        or programme_completion.progress_percent > 0
    ), 0),
    'inProgressLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'active'
        and (
          enrolment.started_at is not null
          or course_completion.progress_percent > 0
          or programme_completion.progress_percent > 0
        )
        and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
    ), 0),
    'completedLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'completed'
        or course_completion.status = 'completed'
        or programme_completion.status = 'completed'
    ), 0),
    'overdueLearners', coalesce(count(distinct enrolment.user_id) filter (
      where enrolment.status = 'active'
        and enrolment.due_at is not null
        and enrolment.due_at < now()
        and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
    ), 0),
    'averageCourseProgress', coalesce(round(avg(course_completion.progress_percent))::integer, 0),
    'averageProgrammeProgress', coalesce(round(avg(programme_completion.progress_percent))::integer, 0),
    'averageQuizScore', coalesce((select round(avg(score))::integer from pg_temp.lms_reporting_quiz_attempt_scores), 0),
    'missionAwards', coalesce((select count(*)::integer from public.mission_awards award join pg_temp.lms_reporting_users scoped_user on scoped_user.user_id = award.user_id), 0),
    'rewardRedemptions', coalesce((select count(*)::integer from public.reward_redemptions redemption join pg_temp.lms_reporting_users scoped_user on scoped_user.user_id = redemption.user_id), 0),
    'generatedAt', now()
  )
    into v_summary
  from pg_temp.lms_reporting_enrolments enrolment
  left join public.course_completions course_completion
    on course_completion.user_id = enrolment.user_id
   and course_completion.course_id = enrolment.course_id
  left join public.programme_completions programme_completion
    on programme_completion.user_id = enrolment.user_id
   and programme_completion.programme_id = enrolment.programme_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cohortId', cohort.id,
      'title', cohort.title,
      'activeMembers', coalesce(member_counts.active_members, 0),
      'assignedLearners', coalesce(enrolment_counts.assigned_learners, 0),
      'completedLearners', coalesce(enrolment_counts.completed_learners, 0),
      'overdueLearners', coalesce(enrolment_counts.overdue_learners, 0),
      'averageProgress', coalesce(enrolment_counts.average_progress, 0)
    )
    order by cohort.title
  ), '[]'::jsonb)
    into v_cohort_comparison
  from public.cohorts cohort
  left join lateral (
    select count(*)::integer as active_members
    from public.cohort_members member
    where member.cohort_id = cohort.id
      and member.status = 'active'
  ) member_counts on true
  left join lateral (
    select
      count(distinct enrolment.user_id)::integer as assigned_learners,
      count(distinct enrolment.user_id) filter (
        where enrolment.status = 'completed'
          or course_completion.status = 'completed'
          or programme_completion.status = 'completed'
      )::integer as completed_learners,
      count(distinct enrolment.user_id) filter (
        where enrolment.status = 'active'
          and enrolment.due_at is not null
          and enrolment.due_at < now()
          and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
      )::integer as overdue_learners,
      round(avg(coalesce(course_completion.progress_percent, programme_completion.progress_percent, 0)))::integer as average_progress
    from pg_temp.lms_reporting_enrolments enrolment
    left join public.course_completions course_completion
      on course_completion.user_id = enrolment.user_id
     and course_completion.course_id = enrolment.course_id
    left join public.programme_completions programme_completion
      on programme_completion.user_id = enrolment.user_id
     and programme_completion.programme_id = enrolment.programme_id
    where enrolment.metadata ->> 'cohortId' = cohort.id::text
  ) enrolment_counts on true
  where (v_organization_id is null or cohort.organization_id = v_organization_id)
    and (p_cohort_id is null or cohort.id = p_cohort_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', learner.user_id,
      'displayName', profile.display_name,
      'cohorts', coalesce(learner.cohorts, '[]'::jsonb),
      'assignedCount', learner.assigned_count,
      'startedCount', learner.started_count,
      'completedCount', learner.completed_count,
      'overdueCount', learner.overdue_count,
      'averageCourseProgress', learner.average_course_progress,
      'averageProgrammeProgress', learner.average_programme_progress,
      'averageQuizScore', learner.average_quiz_score,
      'missionAwards', learner.mission_awards,
      'rewardRedemptions', learner.reward_redemptions,
      'lastActivityAt', learner.last_activity_at
    )
    order by learner.last_activity_at desc nulls last, profile.display_name asc nulls last
  ), '[]'::jsonb)
    into v_learners
  from (
    select
      scoped_user.user_id,
      count(distinct enrolment.id)::integer as assigned_count,
      count(distinct enrolment.id) filter (
        where enrolment.started_at is not null
          or course_completion.progress_percent > 0
          or programme_completion.progress_percent > 0
      )::integer as started_count,
      count(distinct enrolment.id) filter (
        where enrolment.status = 'completed'
          or course_completion.status = 'completed'
          or programme_completion.status = 'completed'
      )::integer as completed_count,
      count(distinct enrolment.id) filter (
        where enrolment.status = 'active'
          and enrolment.due_at is not null
          and enrolment.due_at < now()
          and coalesce(course_completion.status::text, programme_completion.status::text, 'in_progress') <> 'completed'
      )::integer as overdue_count,
      coalesce(round(avg(course_completion.progress_percent))::integer, 0) as average_course_progress,
      coalesce(round(avg(programme_completion.progress_percent))::integer, 0) as average_programme_progress,
      coalesce(quiz_scores.average_quiz_score, 0) as average_quiz_score,
      coalesce(mission_counts.mission_awards, 0) as mission_awards,
      coalesce(redemption_counts.reward_redemptions, 0) as reward_redemptions,
      coalesce(max(enrolment.updated_at), max(course_completion.evaluated_at), max(programme_completion.evaluated_at)) as last_activity_at,
      coalesce(cohort_memberships.cohorts, '[]'::jsonb) as cohorts
    from pg_temp.lms_reporting_users scoped_user
    join pg_temp.lms_reporting_enrolments enrolment
      on enrolment.user_id = scoped_user.user_id
    left join public.course_completions course_completion
      on course_completion.user_id = enrolment.user_id
     and course_completion.course_id = enrolment.course_id
    left join public.programme_completions programme_completion
      on programme_completion.user_id = enrolment.user_id
     and programme_completion.programme_id = enrolment.programme_id
    left join lateral (
      select round(avg(score))::integer as average_quiz_score
      from pg_temp.lms_reporting_quiz_attempt_scores attempt_score
      where attempt_score.user_id = scoped_user.user_id
    ) quiz_scores on true
    left join lateral (
      select count(*)::integer as mission_awards
      from public.mission_awards award
      where award.user_id = scoped_user.user_id
    ) mission_counts on true
    left join lateral (
      select count(*)::integer as reward_redemptions
      from public.reward_redemptions redemption
      where redemption.user_id = scoped_user.user_id
    ) redemption_counts on true
    left join lateral (
      select coalesce(jsonb_agg(
        jsonb_build_object('cohortId', cohort.id, 'title', cohort.title)
        order by cohort.title
      ), '[]'::jsonb) as cohorts
      from public.cohort_members member
      join public.cohorts cohort
        on cohort.id = member.cohort_id
      where member.user_id = scoped_user.user_id
        and member.status = 'active'
        and (v_organization_id is null or cohort.organization_id = v_organization_id)
        and (p_cohort_id is null or cohort.id = p_cohort_id)
    ) cohort_memberships on true
    group by
      scoped_user.user_id,
      quiz_scores.average_quiz_score,
      mission_counts.mission_awards,
      redemption_counts.reward_redemptions,
      cohort_memberships.cohorts
    order by last_activity_at desc nulls last
    limit v_limit
  ) learner
  join public.profiles profile
    on profile.id = learner.user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'quizId', quiz_id,
      'title', quiz_title,
      'attempts', attempts,
      'averageScore', average_score
    )
    order by quiz_title
  ), '[]'::jsonb)
    into v_quiz_scores
  from (
    select
      quiz_id,
      quiz_title,
      count(*)::integer as attempts,
      round(avg(score))::integer as average_score
    from pg_temp.lms_reporting_quiz_attempt_scores
    group by quiz_id, quiz_title
    order by quiz_title
    limit v_limit
  ) quiz_report;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'missionId', mission.id,
      'title', mission.title,
      'awards', coalesce(award_counts.awards, 0),
      'assignedLearners', (v_summary ->> 'assignedLearners')::integer,
      'completionRate', case
        when (v_summary ->> 'assignedLearners')::integer = 0 then 0
        else round((coalesce(award_counts.awards, 0)::numeric / (v_summary ->> 'assignedLearners')::integer::numeric) * 100)::integer
      end
    )
    order by mission.title
  ), '[]'::jsonb)
    into v_mission_completion
  from public.missions mission
  join (
    select distinct mission_id
    from public.programme_missions programme_mission
    join public.programmes programme
      on programme.id = programme_mission.programme_id
    where (v_organization_id is null or programme.organization_id = v_organization_id)
      and (p_programme_id is null or programme.id = p_programme_id)
    union
    select distinct award.mission_id
    from public.mission_awards award
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = award.user_id
  ) scoped_missions
    on scoped_missions.mission_id = mission.id
  left join lateral (
    select count(*)::integer as awards
    from public.mission_awards award
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = award.user_id
    where award.mission_id = mission.id
  ) award_counts on true
  limit v_limit;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rewardId', reward.id,
      'title', reward.title,
      'redemptions', reward_report.redemptions,
      'fulfilled', reward_report.fulfilled,
      'requested', reward_report.requested
    )
    order by reward.title
  ), '[]'::jsonb)
    into v_reward_usage
  from (
    select
      redemption.reward_id,
      count(*)::integer as redemptions,
      count(*) filter (where redemption.status in ('fulfilled', 'approved'))::integer as fulfilled,
      count(*) filter (where redemption.status = 'requested')::integer as requested
    from public.reward_redemptions redemption
    join pg_temp.lms_reporting_users scoped_user
      on scoped_user.user_id = redemption.user_id
    group by redemption.reward_id
    order by count(*) desc
    limit v_limit
  ) reward_report
  join public.rewards reward
    on reward.id = reward_report.reward_id;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'cohortComparison', v_cohort_comparison,
    'learners', v_learners,
    'quizScores', v_quiz_scores,
    'missionCompletion', v_mission_completion,
    'rewardUsage', v_reward_usage
  );
end;
$$;

revoke execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, integer) to authenticated, service_role;

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
  'admin_get_lms_reporting',
  'p_organization_id uuid, p_programme_id uuid, p_cohort_id uuid, p_limit integer',
  'ADMIN_AUTHENTICATED',
  'Platform admin or contextual organisation report viewer reading LMS programme, cohort and learner reporting.',
  'Requires auth.uid() and either platform admin rights for cross-organisation reporting or organisation audience read rights, including report_viewer, for the selected organisation. Programme and cohort filters are validated against the organisation before reporting rows are returned.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
