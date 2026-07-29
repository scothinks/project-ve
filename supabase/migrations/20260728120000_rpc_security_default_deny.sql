create schema if not exists private;

revoke usage on schema private from public;
revoke usage on schema private from anon;
revoke usage on schema private from authenticated;

create table if not exists private.rpc_security_classifications (
  function_schema text not null,
  function_name text not null,
  identity_arguments text not null,
  classification text not null check (
    classification in (
      'PUBLIC_ANON',
      'PUBLIC_AUTHENTICATED_SELF',
      'ADMIN_AUTHENTICATED',
      'SERVICE_ROLE_ONLY',
      'INTERNAL_HELPER',
      'TRIGGER_ONLY'
    )
  ),
  intended_callers text not null,
  authorization_rule text not null,
  execute_roles text[] not null default '{}',
  reviewed_at timestamptz not null default now(),
  primary key (function_schema, function_name, identity_arguments)
);

alter table private.rpc_security_classifications enable row level security;

revoke all on private.rpc_security_classifications from public;
revoke all on private.rpc_security_classifications from anon;
revoke all on private.rpc_security_classifications from authenticated;

create or replace function public.admin_reset_ai_course_tree(
  p_course_id text,
  p_text_status text default 'draft'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Admin access required.';
  end if;

  if p_text_status not in ('draft', 'changes_requested') then
    raise exception 'Unsupported AI text reset status.';
  end if;

  update public.courses
  set ai_text_status = p_text_status,
      ai_media_status = 'not_started',
      ai_publish_status = 'not_ready',
      text_approved_at = null,
      text_approved_by = null,
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where id = p_course_id
    and ai_generated = true;

  update public.lessons
  set ai_text_status = p_text_status,
      ai_media_status = 'not_started',
      ai_publish_status = 'not_ready',
      text_approved_at = null,
      text_approved_by = null,
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where course_id = p_course_id
    and ai_generated = true;

  update public.quizzes q
  set ai_text_status = p_text_status,
      text_approved_at = null,
      text_approved_by = null,
      updated_at = now()
  from public.lessons l
  where q.lesson_id = l.id
    and l.course_id = p_course_id
    and q.ai_generated = true;
end;
$$;

create or replace function public.admin_reset_ai_course_media(
  p_course_id text,
  p_lesson_id text default null,
  p_media_status text default 'draft'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Admin access required.';
  end if;

  if p_media_status not in ('draft', 'changes_requested') then
    raise exception 'Unsupported AI media reset status.';
  end if;

  update public.courses
  set ai_media_status = p_media_status,
      ai_publish_status = 'not_ready',
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where id = p_course_id
    and ai_generated = true;

  if p_lesson_id is null then
    update public.lessons
    set ai_media_status = p_media_status,
        ai_publish_status = 'not_ready',
        media_approved_at = null,
        media_approved_by = null,
        updated_at = now()
    where course_id = p_course_id
      and ai_generated = true;
  else
    update public.lessons
    set ai_media_status = p_media_status,
        ai_publish_status = 'not_ready',
        media_approved_at = null,
        media_approved_by = null,
        updated_at = now()
    where id = p_lesson_id
      and course_id = p_course_id
      and ai_generated = true;
  end if;
end;
$$;

create or replace function public.find_existing_reward_inventory_values(
  p_reward_id text,
  p_item_type text,
  p_values jsonb
)
returns table(value text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Admin access required.';
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
$$;

create or replace function public.admin_reward_assignment_counts(p_reward_ids text[] default null)
returns table(
  reward_id text,
  total_available integer,
  direct_available integer,
  assigned_available integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Admin access required.';
  end if;

  return query
  with reward_scope as (
    select r.id
    from public.rewards r
    where p_reward_ids is null or r.id = any(p_reward_ids)
  ),
  item_counts as (
    select
      rii.reward_id,
      count(*) filter (
        where rii.status = 'available'
          and (rii.available_from is null or rii.available_from <= now())
          and (rii.expires_at is null or rii.expires_at > now())
          and public.campaign_is_live(rii.campaign_id)
      )::integer as total_available,
      count(*) filter (
        where rii.status = 'available'
          and rii.perk_prize_id is null
          and (rii.available_from is null or rii.available_from <= now())
          and (rii.expires_at is null or rii.expires_at > now())
          and public.campaign_is_live(rii.campaign_id)
      )::integer as direct_available,
      count(*) filter (
        where rii.status = 'available'
          and rii.perk_prize_id is not null
          and (rii.available_from is null or rii.available_from <= now())
          and (rii.expires_at is null or rii.expires_at > now())
          and public.campaign_is_live(rii.campaign_id)
      )::integer as assigned_available
    from public.reward_inventory_items rii
    where p_reward_ids is null or rii.reward_id = any(p_reward_ids)
    group by rii.reward_id
  ),
  quantity_counts as (
    select
      rqa.reward_id,
      coalesce(sum(rqa.quantity_available) filter (
        where (rqa.available_from is null or rqa.available_from <= now())
          and (rqa.expires_at is null or rqa.expires_at > now())
          and public.campaign_is_live(rqa.campaign_id)
      ), 0)::integer as total_available,
      coalesce(sum(rqa.quantity_available) filter (
        where rqa.perk_prize_id is null
          and (rqa.available_from is null or rqa.available_from <= now())
          and (rqa.expires_at is null or rqa.expires_at > now())
          and public.campaign_is_live(rqa.campaign_id)
      ), 0)::integer as direct_available,
      coalesce(sum(rqa.quantity_available) filter (
        where rqa.perk_prize_id is not null
          and (rqa.available_from is null or rqa.available_from <= now())
          and (rqa.expires_at is null or rqa.expires_at > now())
          and public.campaign_is_live(rqa.campaign_id)
      ), 0)::integer as assigned_available
    from public.reward_quantity_allocations rqa
    where p_reward_ids is null or rqa.reward_id = any(p_reward_ids)
    group by rqa.reward_id
  )
  select
    reward_scope.id as reward_id,
    coalesce(item_counts.total_available, quantity_counts.total_available, 0) as total_available,
    coalesce(item_counts.direct_available, quantity_counts.direct_available, 0) as direct_available,
    coalesce(item_counts.assigned_available, quantity_counts.assigned_available, 0) as assigned_available
  from reward_scope
  left join item_counts on item_counts.reward_id = reward_scope.id
  left join quantity_counts on quantity_counts.reward_id = reward_scope.id;
end;
$$;

create or replace function public.admin_perk_prize_assignment_counts(p_prize_ids uuid[] default null)
returns table(
  prize_id uuid,
  assigned_available integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Admin access required.';
  end if;

  return query
  with item_counts as (
    select
      rii.perk_prize_id as prize_id,
      count(*) filter (
        where rii.status = 'available'
          and (rii.available_from is null or rii.available_from <= now())
          and (rii.expires_at is null or rii.expires_at > now())
          and public.campaign_is_live(rii.campaign_id)
      )::integer as assigned_available
    from public.reward_inventory_items rii
    where rii.perk_prize_id is not null
      and (p_prize_ids is null or rii.perk_prize_id = any(p_prize_ids))
    group by rii.perk_prize_id
  ),
  quantity_counts as (
    select
      rqa.perk_prize_id as prize_id,
      coalesce(sum(rqa.quantity_available) filter (
        where (rqa.available_from is null or rqa.available_from <= now())
          and (rqa.expires_at is null or rqa.expires_at > now())
          and public.campaign_is_live(rqa.campaign_id)
      ), 0)::integer as assigned_available
    from public.reward_quantity_allocations rqa
    where rqa.perk_prize_id is not null
      and (p_prize_ids is null or rqa.perk_prize_id = any(p_prize_ids))
    group by rqa.perk_prize_id
  )
  select
    coalesce(item_counts.prize_id, quantity_counts.prize_id) as prize_id,
    coalesce(item_counts.assigned_available, quantity_counts.assigned_available, 0) as assigned_available
  from item_counts
  full outer join quantity_counts
    on quantity_counts.prize_id = item_counts.prize_id;
end;
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

revoke execute on function public.increment_profile_xp(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_profile_xp(uuid, integer) to service_role;

revoke execute on function public.apply_native_reward_effect(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_native_reward_effect(uuid, uuid, text, jsonb) to service_role;

revoke execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) to service_role;

revoke execute on function public.queue_push_deliveries_for_notification(uuid) from public, anon, authenticated;
grant execute on function public.queue_push_deliveries_for_notification(uuid) to service_role;

revoke execute on function public.generate_continue_learning_reminders() from public, anon, authenticated;
grant execute on function public.generate_continue_learning_reminders() to service_role;

revoke execute on function public.refresh_reward_item_inventory_counts(text) from public, anon, authenticated;
grant execute on function public.refresh_reward_item_inventory_counts(text) to service_role;

revoke execute on function public.admin_reset_ai_course_tree(text, text) from public, anon, authenticated;
grant execute on function public.admin_reset_ai_course_tree(text, text) to authenticated;

revoke execute on function public.admin_reset_ai_course_media(text, text, text) from public, anon, authenticated;
grant execute on function public.admin_reset_ai_course_media(text, text, text) to authenticated;

revoke execute on function public.find_existing_reward_inventory_values(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.find_existing_reward_inventory_values(text, text, jsonb) to authenticated;

revoke execute on function public.admin_reward_assignment_counts(text[]) from public, anon, authenticated;
grant execute on function public.admin_reward_assignment_counts(text[]) to authenticated;

revoke execute on function public.admin_perk_prize_assignment_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_perk_prize_assignment_counts(uuid[]) to authenticated;

revoke execute on function public.queue_broadcast_notification(text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
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
select
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  case
    when p.proname in ('handle_new_user', 'handle_profile_notification_preferences', 'notify_reward_redemption_event', 'notify_mission_proof_event', 'notify_first_earned_xp', 'enforce_reward_redemption_unlock', 'set_updated_at') then 'TRIGGER_ONLY'
    when p.proname in ('increment_profile_xp', 'apply_native_reward_effect', 'queue_user_notification', 'queue_push_deliveries_for_notification', 'refresh_reward_item_inventory_counts', 'grant_mission_award', 'refresh_reward_quantity_inventory_counts', 'upsert_ad_frequency_counter', 'aggregate_ad_events_daily') then 'INTERNAL_HELPER'
    when p.proname in ('generate_continue_learning_reminders', 'track_referral_link_visit') then 'SERVICE_ROLE_ONLY'
    when p.proname like 'admin_%' or p.proname in ('queue_broadcast_notification', 'refresh_ad_billing_snapshot', 'create_ad_make_good_recommendations', 'purge_old_ad_runtime_data') then 'ADMIN_AUTHENTICATED'
    when p.proname in ('record_signup_attempt', 'record_ad_event', 'record_ad_house_fallback_event', 'submit_ad_sponsor_inquiry', 'get_ad_click_target', 'current_user_is_admin') then 'PUBLIC_ANON'
    else 'PUBLIC_AUTHENTICATED_SELF'
  end,
  case
    when p.proname in ('handle_new_user', 'handle_profile_notification_preferences', 'notify_reward_redemption_event', 'notify_mission_proof_event', 'notify_first_earned_xp', 'enforce_reward_redemption_unlock', 'set_updated_at') then 'Database triggers only.'
    when p.proname in ('increment_profile_xp', 'apply_native_reward_effect', 'queue_user_notification', 'queue_push_deliveries_for_notification', 'refresh_reward_item_inventory_counts', 'grant_mission_award', 'refresh_reward_quantity_inventory_counts', 'upsert_ad_frequency_counter', 'aggregate_ad_events_daily') then 'Trusted database functions or service maintenance jobs.'
    when p.proname in ('generate_continue_learning_reminders', 'track_referral_link_visit') then 'Server-side operational endpoints.'
    when p.proname like 'admin_%' or p.proname in ('queue_broadcast_notification', 'refresh_ad_billing_snapshot', 'create_ad_make_good_recommendations', 'purge_old_ad_runtime_data') then 'Authenticated admin workflows.'
    when p.proname in ('record_signup_attempt', 'record_ad_event', 'record_ad_house_fallback_event', 'submit_ad_sponsor_inquiry', 'get_ad_click_target', 'current_user_is_admin') then 'Public application endpoints with constrained inputs.'
    else 'Authenticated user use-case RPCs scoped to auth.uid().'
  end,
  case
    when p.proname in ('handle_new_user', 'handle_profile_notification_preferences', 'notify_reward_redemption_event', 'notify_mission_proof_event', 'notify_first_earned_xp', 'enforce_reward_redemption_unlock', 'set_updated_at') then 'No client role should receive EXECUTE.'
    when p.proname in ('increment_profile_xp', 'apply_native_reward_effect', 'queue_user_notification', 'queue_push_deliveries_for_notification', 'refresh_reward_item_inventory_counts') then 'Not browser-executable; callable by trusted definer code and service_role only.'
    when p.proname in ('generate_continue_learning_reminders', 'track_referral_link_visit') then 'Only service_role may execute directly.'
    when p.proname like 'admin_%' or p.proname in ('queue_broadcast_notification', 'refresh_ad_billing_snapshot', 'create_ad_make_good_recommendations', 'purge_old_ad_runtime_data') then 'Must check auth.uid() is present and public.current_user_is_admin() is true before side effects or privileged reads.'
    when p.proname in ('record_signup_attempt', 'record_ad_event', 'record_ad_house_fallback_event', 'submit_ad_sponsor_inquiry', 'get_ad_click_target', 'current_user_is_admin') then 'Must not trust caller identity for privileged state; writes are constrained to public telemetry/inquiry use cases.'
    else 'Must derive user identity from auth.uid() and operate only on that user or public data.'
  end,
  case
    when p.proname in ('increment_profile_xp', 'apply_native_reward_effect', 'queue_user_notification', 'queue_push_deliveries_for_notification', 'refresh_reward_item_inventory_counts', 'generate_continue_learning_reminders', 'track_referral_link_visit') then array['service_role']
    when p.proname like 'admin_%' or p.proname in ('queue_broadcast_notification', 'refresh_ad_billing_snapshot', 'create_ad_make_good_recommendations', 'purge_old_ad_runtime_data') then array['authenticated', 'service_role']
    when p.proname in ('record_signup_attempt', 'record_ad_event', 'record_ad_house_fallback_event', 'submit_ad_sponsor_inquiry', 'get_ad_click_target', 'current_user_is_admin') then array['anon', 'authenticated', 'service_role']
    when p.proname in ('handle_new_user', 'handle_profile_notification_preferences', 'notify_reward_redemption_event', 'notify_mission_proof_event', 'notify_first_earned_xp', 'enforce_reward_redemption_unlock', 'set_updated_at') then array[]::text[]
    else array['authenticated', 'service_role']
  end
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();

do $$
declare
  v_function private.rpc_security_classifications%rowtype;
  v_role text;
begin
  for v_function in
    select *
    from private.rpc_security_classifications
    where function_schema = 'public'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated, service_role',
      v_function.function_schema,
      v_function.function_name,
      v_function.identity_arguments
    );

    foreach v_role in array v_function.execute_roles loop
      execute format(
        'grant execute on function %I.%I(%s) to %I',
        v_function.function_schema,
        v_function.function_name,
        v_function.identity_arguments,
        v_role
      );
    end loop;
  end loop;
end;
$$;
