alter table public.notification_preferences
  add column if not exists in_app_enabled boolean not null default true,
  add column if not exists rewards_enabled boolean not null default true,
  add column if not exists missions_enabled boolean not null default true,
  add column if not exists account_enabled boolean not null default true,
  add column if not exists system_enabled boolean not null default true;

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

  return v_notification_id;
end;
$$;

grant execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) to authenticated;
