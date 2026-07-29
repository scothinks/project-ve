create or replace function private.queue_push_deliveries_for_notification(
  p_notification_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.user_notifications%rowtype;
  v_inserted_count integer := 0;
begin
  select *
    into v_notification
  from public.user_notifications
  where id = p_notification_id;

  if not found then
    return 0;
  end if;

  if not public.notification_event_supports_push(v_notification.event_type) then
    return 0;
  end if;

  if not exists (
    select 1
    from public.notification_preferences np
    where np.user_id = v_notification.user_id
      and np.web_push_enabled = true
  ) then
    return 0;
  end if;

  insert into public.user_push_deliveries (
    notification_id,
    subscription_id
  )
  select
    v_notification.id,
    ups.id
  from public.user_push_subscriptions ups
  where ups.user_id = v_notification.user_id
    and ups.disabled_at is null
  on conflict (notification_id, subscription_id) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

create or replace function private.queue_user_notification(
  p_user_id uuid,
  p_category text,
  p_event_type text,
  p_title text,
  p_body text,
  p_cta_href text default null,
  p_cta_label text default null,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid := gen_random_uuid();
  v_dedupe_key text := coalesce(nullif(trim(coalesce(p_dedupe_key, '')), ''), gen_random_uuid()::text);
  v_preferences public.notification_preferences%rowtype;
  v_category_enabled boolean := true;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.notification_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
    into v_preferences
  from public.notification_preferences
  where user_id = p_user_id;

  if not coalesce(v_preferences.in_app_enabled, true) then
    return null;
  end if;

  v_category_enabled := case p_category
    when 'rewards' then coalesce(v_preferences.rewards_enabled, true)
    when 'missions' then coalesce(v_preferences.missions_enabled, true)
    when 'account' then coalesce(v_preferences.account_enabled, true)
    when 'system' then coalesce(v_preferences.system_enabled, true)
    else true
  end;

  if not v_category_enabled then
    return null;
  end if;

  insert into public.user_notifications (
    id,
    user_id,
    category,
    event_type,
    title,
    body,
    cta_href,
    cta_label,
    data,
    dedupe_key
  )
  values (
    v_notification_id,
    p_user_id,
    p_category,
    p_event_type,
    p_title,
    p_body,
    p_cta_href,
    p_cta_label,
    coalesce(p_data, '{}'::jsonb),
    v_dedupe_key
  )
  on conflict (dedupe_key) do nothing;

  if not found then
    return null;
  end if;

  perform private.queue_push_deliveries_for_notification(v_notification_id);

  return v_notification_id;
end;
$$;

create or replace function public.queue_push_deliveries_for_notification(
  p_notification_id uuid
)
returns integer
language sql
security definer
set search_path = public
as $$
  select private.queue_push_deliveries_for_notification(p_notification_id);
$$;

create or replace function public.queue_user_notification(
  p_user_id uuid,
  p_category text,
  p_event_type text,
  p_title text,
  p_body text,
  p_cta_href text default null,
  p_cta_label text default null,
  p_data jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select private.queue_user_notification(
    p_user_id,
    p_category,
    p_event_type,
    p_title,
    p_body,
    p_cta_href,
    p_cta_label,
    p_data,
    p_dedupe_key
  );
$$;

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
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Admin access required.';
  end if;

  for v_user_id in
    select id
    from public.profiles
    where role = 'learner'
  loop
    select private.queue_user_notification(
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
    select private.queue_user_notification(
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

revoke execute on function private.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated, service_role;
revoke execute on function private.queue_push_deliveries_for_notification(uuid) from public, anon, authenticated, service_role;

revoke execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) to service_role;

revoke execute on function public.queue_push_deliveries_for_notification(uuid) from public, anon, authenticated;
grant execute on function public.queue_push_deliveries_for_notification(uuid) to service_role;

revoke execute on function public.generate_continue_learning_reminders() from public, anon, authenticated;
grant execute on function public.generate_continue_learning_reminders() to service_role;

revoke execute on function public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text) to authenticated;

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
    'queue_user_notification',
    'p_user_id uuid, p_category text, p_event_type text, p_title text, p_body text, p_cta_href text, p_cta_label text, p_data jsonb, p_dedupe_key text',
    'INTERNAL_HELPER',
    'Trusted domain workflows and service maintenance only.',
    'Direct browser callers must not create arbitrary notifications.',
    array['service_role']
  ),
  (
    'public',
    'queue_push_deliveries_for_notification',
    'p_notification_id uuid',
    'INTERNAL_HELPER',
    'Trusted notification workflows and service maintenance only.',
    'Direct browser callers must not enqueue push deliveries.',
    array['service_role']
  ),
  (
    'public',
    'generate_continue_learning_reminders',
    '',
    'SERVICE_ROLE_ONLY',
    'Server-side notification dispatch job.',
    'Direct execution requires service role.',
    array['service_role']
  ),
  (
    'public',
    'queue_broadcast_notification',
    'p_category text, p_event_type text, p_title text, p_body text, p_cta_href text, p_cta_label text, p_data jsonb, p_dedupe_key_prefix text',
    'ADMIN_AUTHENTICATED',
    'Authenticated admin broadcast workflows.',
    'Requires auth.uid() and public.current_user_is_admin().',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
