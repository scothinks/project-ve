create or replace function public.queue_broadcast_notification(
  p_category text,
  p_event_type text,
  p_title text,
  p_body text,
  p_cta_href text default null,
  p_cta_label text default null,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key_prefix text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_count integer := 0;
  v_notification_id uuid;
  v_user_id uuid;
begin
  for v_user_id in
    select id
    from public.profiles
    where role = 'learner'
  loop
    select public.queue_user_notification(
      v_user_id,
      p_category,
      p_event_type,
      p_title,
      p_body,
      p_cta_href,
      p_cta_label,
      coalesce(p_data, '{}'::jsonb),
      case
        when nullif(trim(coalesce(p_dedupe_key_prefix, '')), '') is null then null
        else trim(p_dedupe_key_prefix) || ':' || v_user_id::text
      end
    )
    into v_notification_id;

    if v_notification_id is not null then
      v_created_count := v_created_count + 1;
    end if;
  end loop;

  return v_created_count;
end;
$$;

create or replace function public.generate_continue_learning_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_count integer := 0;
  v_notification_id uuid;
  v_user_id uuid;
  v_last_activity_at timestamptz;
  v_local_date text := to_char((now() at time zone 'Africa/Lagos')::date, 'YYYYMMDD');
begin
  for v_user_id, v_last_activity_at in
    with unfinished_lessons as (
      select
        lp.user_id,
        max(greatest(coalesce(lp.updated_at, lp.started_at), lp.started_at)) as last_started_at
      from public.lesson_progress lp
      join public.lessons l
        on l.id = lp.lesson_id
       and l.status = 'published'
      join public.courses c
        on c.id = l.course_id
       and c.status = 'published'
      where lp.completed_at is null
      group by lp.user_id
    ),
    learning_activity as (
      select
        activity.user_id,
        max(activity.activity_at) as last_activity_at
      from (
        select
          lp.user_id,
          max(greatest(coalesce(lp.updated_at, lp.started_at), lp.started_at)) as activity_at
        from public.lesson_progress lp
        group by lp.user_id

        union all

        select
          lpc.user_id,
          max(lpc.completed_at) as activity_at
        from public.lesson_page_completions lpc
        group by lpc.user_id

        union all

        select
          qa.user_id,
          max(coalesce(qa.ended_at, qa.started_at, qa.created_at)) as activity_at
        from public.quiz_attempts qa
        group by qa.user_id
      ) activity
      group by activity.user_id
    )
    select
      p.id,
      coalesce(la.last_activity_at, ul.last_started_at) as last_activity_at
    from unfinished_lessons ul
    join public.profiles p
      on p.id = ul.user_id
     and p.role = 'learner'
    left join learning_activity la
      on la.user_id = ul.user_id
    where coalesce(la.last_activity_at, ul.last_started_at) <= now() - interval '3 days'
      and not exists (
        select 1
        from public.user_notifications un
        where un.user_id = ul.user_id
          and un.event_type = 'continue_learning'
          and un.created_at >= now() - interval '3 days'
      )
  loop
    select public.queue_user_notification(
      v_user_id,
      'system',
      'continue_learning',
      'Continue learning',
      'You have unfinished lessons waiting and more XP to earn.',
      '/dashboard',
      'Continue',
      jsonb_build_object('lastActivityAt', v_last_activity_at),
      'continue-learning:' || v_user_id::text || ':' || v_local_date
    )
    into v_notification_id;

    if v_notification_id is not null then
      v_created_count := v_created_count + 1;
    end if;
  end loop;

  return v_created_count;
end;
$$;

create or replace function public.admin_grant_user_xp(
  p_target_user_id uuid,
  p_amount integer,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text := 'Admin';
  v_local_date date := (now() at time zone 'Africa/Lagos')::date;
  v_daily_limit integer := 500;
  v_granted_today integer := 0;
  v_transaction_id uuid := gen_random_uuid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select coalesce(display_name, 'Admin')
    into v_actor_name
  from public.profiles
  where id = v_actor_id
    and role = 'admin';

  if not found then
    raise exception 'Admin access required.';
  end if;

  if p_target_user_id is null then
    raise exception 'Choose a user to grant XP.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Grant amount must be greater than 0.';
  end if;

  select coalesce(admin_manual_grant_daily_limit, 500)
    into v_daily_limit
  from public.xp_settings
  where id = 1;

  select coalesce(sum(amount), 0)
    into v_granted_today
  from public.xp_transactions
  where direction = 'earn'
    and source_type = 'adjustment'
    and source_id = 'admin_user_grant'
    and metadata->>'kind' = 'admin_user_grant'
    and metadata->>'granted_by' = v_actor_id::text
    and (created_at at time zone 'Africa/Lagos')::date = v_local_date;

  if v_granted_today + p_amount > v_daily_limit then
    raise exception 'Daily admin grant limit reached. % XP remaining today.', greatest(v_daily_limit - v_granted_today, 0);
  end if;

  update public.profiles
  set xp_balance_cached = xp_balance_cached + p_amount
  where id = p_target_user_id;

  if not found then
    raise exception 'User not found.';
  end if;

  insert into public.xp_transactions (
    id,
    user_id,
    amount,
    direction,
    source_type,
    source_id,
    metadata
  ) values (
    v_transaction_id,
    p_target_user_id,
    p_amount,
    'earn',
    'adjustment',
    'admin_user_grant',
    jsonb_build_object(
      'kind', 'admin_user_grant',
      'granted_by', v_actor_id,
      'granted_by_name', v_actor_name,
      'target_user_id', p_target_user_id,
      'reason', coalesce(v_reason, 'Admin manual grant'),
      'local_date', v_local_date
    )
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    'admin_user_xp_granted',
    'profile',
    p_target_user_id::text,
    jsonb_build_object(
      'xp_amount', p_amount,
      'reason', coalesce(v_reason, 'Admin manual grant'),
      'xp_transaction_id', v_transaction_id,
      'local_date', v_local_date
    )
  );

  perform public.queue_user_notification(
    p_target_user_id,
    'account',
    'free_xp_grant',
    'Free XP added',
    case
      when v_reason is null then 'You received ' || p_amount::text || ' XP.'
      else 'You received ' || p_amount::text || ' XP. ' || v_reason
    end,
    '/xp-store',
    'Use XP',
    jsonb_build_object(
      'amount', p_amount,
      'reason', v_reason,
      'xpTransactionId', v_transaction_id
    ),
    'free-xp-grant:' || v_transaction_id::text
  );

  return v_transaction_id;
end;
$$;

create or replace function public.admin_set_course_status(
  p_course_id text,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
  v_course public.courses%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage course visibility.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Courses can only be enabled or disabled from this control.';
  end if;

  select *
    into v_course
  from public.courses
  where id = p_course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  update public.courses
  set status = v_status,
      updated_at = now()
  where id = p_course_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_status = 'published' then 'course_enabled' else 'course_disabled' end,
    'course',
    p_course_id,
    jsonb_build_object('status', v_status)
  );

  if v_course.status is distinct from 'published'::public.content_status
    and v_status = 'published'::public.content_status
  then
    perform public.queue_broadcast_notification(
      'system',
      'new_course',
      'New course',
      'A new course is live. Earn more XP.',
      '/courses/' || v_course.id,
      'Open course',
      jsonb_build_object('courseId', v_course.id, 'courseSlug', v_course.slug),
      'broadcast-new-course:' || v_course.id
    );
  end if;

  return jsonb_build_object('courseId', p_course_id, 'status', v_status);
end;
$$;

create or replace function public.admin_set_lesson_status(
  p_lesson_id text,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
  v_lesson public.lessons%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lesson visibility.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Lessons can only be enabled or disabled from this control.';
  end if;

  select * into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    raise exception 'Lesson not found.';
  end if;

  if v_lesson.ai_generated
    and v_status = 'published'::public.content_status
    and coalesce(v_lesson.ai_publish_status, 'not_ready') not in ('ready', 'published')
  then
    raise exception 'AI-generated lessons can only be published after that lesson''s approved text and media.';
  end if;

  update public.lessons
  set status = v_status,
      updated_at = now()
  where id = p_lesson_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_status = 'published' then 'lesson_enabled' else 'lesson_disabled' end,
    'lesson',
    p_lesson_id,
    jsonb_build_object('status', v_status)
  );

  if v_lesson.status is distinct from 'published'::public.content_status
    and v_status = 'published'::public.content_status
  then
    perform public.queue_broadcast_notification(
      'system',
      'new_lesson',
      'New lesson',
      'A new lesson is ready. Earn more XP.',
      '/lessons/' || v_lesson.id,
      'Open lesson',
      jsonb_build_object('lessonId', v_lesson.id, 'courseId', v_lesson.course_id),
      'broadcast-new-lesson:' || v_lesson.id
    );
  end if;

  return jsonb_build_object('lessonId', p_lesson_id, 'status', v_status);
end;
$$;

create or replace function public.admin_create_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_type text,
  p_reward_xp integer,
  p_reward_id text,
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
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
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
    sort_order
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
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  if p_status = 'published'::public.content_status then
    perform public.queue_broadcast_notification(
      'missions',
      'new_mission',
      'New mission',
      'A new mission is ready. Earn more XP.',
      '/missions',
      'View mission',
      jsonb_build_object('missionId', v_mission_id),
      'broadcast-new-mission:' || v_mission_id
    );
  end if;

  return jsonb_build_object('missionId', v_mission_id);
end;
$$;

create or replace function public.admin_update_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_type text,
  p_reward_xp integer,
  p_reward_id text,
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
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
  v_existing public.missions%rowtype;
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

  select *
    into v_existing
  from public.missions
  where id = p_mission_id;

  if not found then
    raise exception 'Mission not found.';
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
    'mission_updated',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  if v_existing.status is distinct from 'published'::public.content_status
    and p_status = 'published'::public.content_status
  then
    perform public.queue_broadcast_notification(
      'missions',
      'new_mission',
      'New mission',
      'A new mission is ready. Earn more XP.',
      '/missions',
      'View mission',
      jsonb_build_object('missionId', p_mission_id),
      'broadcast-new-mission:' || p_mission_id
    );
  end if;

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
  v_mission public.missions%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update mission status.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id;

  if not found then
    raise exception 'Mission not found.';
  end if;

  update public.missions
  set status = p_status,
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
    'mission_status_changed',
    'mission',
    p_mission_id,
    jsonb_build_object('status', p_status)
  );

  if v_mission.status is distinct from 'published'::public.content_status
    and p_status = 'published'::public.content_status
  then
    perform public.queue_broadcast_notification(
      'missions',
      'new_mission',
      'New mission',
      'A new mission is ready. Earn more XP.',
      '/missions',
      'View mission',
      jsonb_build_object('missionId', p_mission_id),
      'broadcast-new-mission:' || p_mission_id
    );
  end if;

  return jsonb_build_object('missionId', p_mission_id, 'status', p_status);
end;
$$;

create or replace function public.admin_update_reward(
  p_reward_id text,
  p_title text,
  p_description text,
  p_cost_xp integer,
  p_status public.content_status,
  p_is_enabled boolean,
  p_thumbnail jsonb,
  p_offer_expires_at timestamptz,
  p_terms text,
  p_claim_steps jsonb,
  p_distribution_mode text,
  p_fulfillment_type text,
  p_visibility_mode text,
  p_fulfillment_config jsonb,
  p_per_user_limit integer,
  p_limit_period text,
  p_redemption_window_days integer,
  p_sort_order integer,
  p_campaign_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_effective_fulfillment_type text;
  v_existing public.rewards%rowtype;
  v_was_notifiable boolean := false;
  v_is_notifiable boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update rewards.';
  end if;

  if p_cost_xp is null or p_cost_xp <= 0 then
    raise exception 'Reward XP cost must be greater than zero.';
  end if;

  if p_per_user_limit is null or p_per_user_limit <= 0 then
    raise exception 'Per-user limit must be greater than zero.';
  end if;

  if p_distribution_mode not in ('direct', 'perk_bundle') then
    raise exception 'Unsupported reward mode.';
  end if;

  if p_fulfillment_type not in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native') then
    raise exception 'Unsupported fulfillment type.';
  end if;

  if p_visibility_mode not in ('store', 'system_only', 'campaign_only', 'hidden') then
    raise exception 'Unsupported reward visibility mode.';
  end if;

  if p_limit_period not in ('none', 'lifetime', 'daily', 'weekly', 'monthly', 'campaign') then
    raise exception 'Unsupported reward limit period.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  select *
    into v_existing
  from public.rewards
  where id = p_reward_id;

  if not found then
    raise exception 'Reward not found.';
  end if;

  v_was_notifiable := (
    v_existing.status = 'published'::public.content_status
    and coalesce(v_existing.is_enabled, false)
    and coalesce(v_existing.visibility_mode, 'store') = 'store'
  );

  v_effective_fulfillment_type := case
    when p_distribution_mode = 'perk_bundle' then 'manual'
    else p_fulfillment_type
  end;

  update public.rewards
  set title = nullif(trim(p_title), ''),
      description = nullif(trim(coalesce(p_description, '')), ''),
      cost_xp = p_cost_xp,
      status = p_status,
      is_enabled = coalesce(p_is_enabled, false),
      thumbnail = coalesce(p_thumbnail, '{}'::jsonb),
      offer_expires_at = p_offer_expires_at,
      terms = nullif(trim(coalesce(p_terms, '')), ''),
      claim_steps = coalesce(p_claim_steps, '[]'::jsonb),
      distribution_mode = p_distribution_mode,
      fulfillment_type = v_effective_fulfillment_type,
      visibility_mode = p_visibility_mode,
      fulfillment_config = coalesce(p_fulfillment_config, '{}'::jsonb),
      per_user_limit = p_per_user_limit,
      limit_period = p_limit_period,
      redemption_window_days = p_redemption_window_days,
      sort_order = coalesce(p_sort_order, 0),
      campaign_id = p_campaign_id,
      updated_at = now()
  where id = p_reward_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'reward_updated',
    'reward',
    p_reward_id,
    jsonb_build_object(
      'title', p_title,
      'status', p_status,
      'isEnabled', p_is_enabled,
      'costXp', p_cost_xp,
      'campaignId', p_campaign_id,
      'distributionMode', p_distribution_mode,
      'visibilityMode', p_visibility_mode,
      'fulfillmentType', v_effective_fulfillment_type
    )
  );

  v_is_notifiable := (
    p_status = 'published'::public.content_status
    and coalesce(p_is_enabled, false)
    and p_visibility_mode = 'store'
  );

  if not v_was_notifiable and v_is_notifiable then
    perform public.queue_broadcast_notification(
      'rewards',
      'new_reward',
      'New reward',
      'A new reward is available in the XP store.',
      '/xp-store',
      'View reward',
      jsonb_build_object('rewardId', p_reward_id),
      'broadcast-new-reward:' || p_reward_id
    );
  end if;

  return jsonb_build_object('status', 'updated', 'rewardId', p_reward_id);
end;
$$;

create or replace function public.admin_create_reward(
  p_reward_id text,
  p_title text,
  p_description text,
  p_cost_xp integer,
  p_status public.content_status,
  p_is_enabled boolean,
  p_thumbnail jsonb,
  p_offer_expires_at timestamptz,
  p_terms text,
  p_claim_steps jsonb,
  p_distribution_mode text,
  p_fulfillment_type text,
  p_visibility_mode text,
  p_fulfillment_config jsonb,
  p_per_user_limit integer,
  p_limit_period text,
  p_redemption_window_days integer,
  p_sort_order integer,
  p_total_available integer,
  p_campaign_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward_id text := lower(regexp_replace(trim(coalesce(p_reward_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_total_available integer := greatest(0, coalesce(p_total_available, 0));
  v_effective_fulfillment_type text;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can create rewards.';
  end if;

  if v_reward_id = '' then
    v_reward_id := 'reward-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Reward name is required.';
  end if;

  if p_cost_xp is null or p_cost_xp <= 0 then
    raise exception 'Reward XP cost must be greater than zero.';
  end if;

  if p_per_user_limit is null or p_per_user_limit <= 0 then
    raise exception 'Per-user limit must be greater than zero.';
  end if;

  if p_distribution_mode not in ('direct', 'perk_bundle') then
    raise exception 'Unsupported reward mode.';
  end if;

  if p_fulfillment_type not in ('manual', 'voucher_code', 'qr_code', 'external_link', 'native') then
    raise exception 'Unsupported fulfillment type.';
  end if;

  if p_visibility_mode not in ('store', 'system_only', 'campaign_only', 'hidden') then
    raise exception 'Unsupported reward visibility mode.';
  end if;

  if p_limit_period not in ('none', 'lifetime', 'daily', 'weekly', 'monthly', 'campaign') then
    raise exception 'Unsupported reward limit period.';
  end if;

  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'Campaign not found.';
  end if;

  v_effective_fulfillment_type := case
    when p_distribution_mode = 'perk_bundle' then 'manual'
    else p_fulfillment_type
  end;

  insert into public.rewards (
    id,
    title,
    description,
    cost_xp,
    inventory_count,
    starts_at,
    ends_at,
    status,
    thumbnail,
    offer_expires_at,
    terms,
    claim_steps,
    distribution_mode,
    fulfillment_type,
    visibility_mode,
    fulfillment_config,
    per_user_limit,
    limit_period,
    redemption_window_days,
    sort_order,
    is_enabled,
    total_uploaded,
    total_available,
    campaign_id
  )
  values (
    v_reward_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_cost_xp,
    v_total_available,
    now(),
    null,
    p_status,
    coalesce(p_thumbnail, '{}'::jsonb),
    p_offer_expires_at,
    nullif(trim(coalesce(p_terms, '')), ''),
    coalesce(p_claim_steps, '[]'::jsonb),
    p_distribution_mode,
    v_effective_fulfillment_type,
    p_visibility_mode,
    coalesce(p_fulfillment_config, '{}'::jsonb),
    p_per_user_limit,
    p_limit_period,
    p_redemption_window_days,
    coalesce(p_sort_order, 0),
    coalesce(p_is_enabled, false),
    v_total_available,
    v_total_available,
    p_campaign_id
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
    'reward_created',
    'reward',
    v_reward_id,
    jsonb_build_object(
      'title', p_title,
      'status', p_status,
      'costXp', p_cost_xp,
      'campaignId', p_campaign_id,
      'distributionMode', p_distribution_mode,
      'visibilityMode', p_visibility_mode,
      'fulfillmentType', v_effective_fulfillment_type
    )
  );

  if p_status = 'published'::public.content_status
    and coalesce(p_is_enabled, false)
    and p_visibility_mode = 'store'
  then
    perform public.queue_broadcast_notification(
      'rewards',
      'new_reward',
      'New reward',
      'A new reward is available in the XP store.',
      '/xp-store',
      'View reward',
      jsonb_build_object('rewardId', v_reward_id),
      'broadcast-new-reward:' || v_reward_id
    );
  end if;

  return jsonb_build_object('status', 'created', 'rewardId', v_reward_id);
end;
$$;

grant execute on function public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.generate_continue_learning_reminders() to authenticated;
grant execute on function public.admin_grant_user_xp(uuid, integer, text) to authenticated;
