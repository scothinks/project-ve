alter table public.user_push_subscriptions
  add column if not exists device_key text,
  add column if not exists user_agent text,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists failure_count integer not null default 0 check (failure_count >= 0),
  add column if not exists last_error text,
  add column if not exists disabled_at timestamptz;

update public.user_push_subscriptions
set device_key = coalesce(device_key, endpoint),
    last_seen_at = coalesce(last_seen_at, created_at)
where device_key is null
   or last_seen_at is null;

alter table public.user_push_subscriptions
  alter column device_key set not null;

create unique index if not exists user_push_subscriptions_user_device_idx
  on public.user_push_subscriptions (user_id, device_key);

create table if not exists public.user_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.user_notifications(id) on delete cascade,
  subscription_id uuid not null references public.user_push_subscriptions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  response_code integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_attempted_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  unique (notification_id, subscription_id)
);

create index if not exists user_push_deliveries_pending_idx
  on public.user_push_deliveries (status, created_at)
  where status = 'pending';

create index if not exists user_push_deliveries_notification_idx
  on public.user_push_deliveries (notification_id, created_at desc);

create index if not exists user_push_deliveries_subscription_idx
  on public.user_push_deliveries (subscription_id, created_at desc);

drop trigger if exists user_push_deliveries_set_updated_at on public.user_push_deliveries;
create trigger user_push_deliveries_set_updated_at
  before update on public.user_push_deliveries
  for each row execute function public.set_updated_at();

alter table public.user_push_deliveries enable row level security;

drop policy if exists "Users can read their push deliveries" on public.user_push_deliveries;
create policy "Users can read their push deliveries"
  on public.user_push_deliveries for select
  using (
    exists (
      select 1
      from public.user_push_subscriptions ups
      where ups.id = subscription_id
        and ups.user_id = auth.uid()
    )
  );

create or replace function public.queue_push_deliveries_for_notification(
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

  perform public.queue_push_deliveries_for_notification(v_notification_id);

  return v_notification_id;
end;
$$;

create or replace function public.handle_profile_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform public.queue_user_notification(
    new.id,
    'account',
    'account_welcome',
    'Welcome',
    'Your account is ready.',
    '/profile',
    'Open profile',
    jsonb_build_object('userId', new.id),
    'account-welcome:' || new.id::text
  );

  return new;
end;
$$;

create or replace function public.accept_referral(p_referral_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_user_id uuid := auth.uid();
  v_referral_code text := lower(trim(p_referral_code));
  v_referrer_user_id uuid;
  v_existing public.referral_attributions%rowtype;
  v_created public.referral_attributions%rowtype;
begin
  if v_referred_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_referral_code is null or v_referral_code = '' then
    raise exception 'Referral code is required.';
  end if;

  select id
    into v_referrer_user_id
    from public.profiles
   where lower(referral_code) = v_referral_code
   limit 1;

  if v_referrer_user_id is null then
    raise exception 'Referral link is not valid.';
  end if;

  if v_referrer_user_id = v_referred_user_id then
    raise exception 'You cannot use your own referral link.';
  end if;

  select *
    into v_existing
    from public.referral_attributions
   where referred_user_id = v_referred_user_id
   limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'status', 'already_attributed',
      'referrerUserId', v_existing.referrer_user_id,
      'referredUserId', v_existing.referred_user_id
    );
  end if;

  insert into public.referral_attributions (
    referral_code,
    referrer_user_id,
    referred_user_id,
    status
  )
  values (
    v_referral_code,
    v_referrer_user_id,
    v_referred_user_id,
    'signed_up'
  )
  returning * into v_created;

  perform public.queue_user_notification(
    v_referred_user_id,
    'account',
    'referral_applied',
    'Referral applied',
    'Your referral code was saved.',
    '/profile',
    'Open profile',
    jsonb_build_object(
      'referrerUserId', v_referrer_user_id,
      'referredUserId', v_referred_user_id
    ),
    'referral-applied:' || v_created.id::text || ':' || v_referred_user_id::text
  );

  perform public.queue_user_notification(
    v_referrer_user_id,
    'account',
    'referral_joined',
    'New referral',
    'A new learner joined with your referral code.',
    '/profile',
    'Open profile',
    jsonb_build_object(
      'referrerUserId', v_referrer_user_id,
      'referredUserId', v_referred_user_id
    ),
    'referral-joined:' || v_created.id::text || ':' || v_referrer_user_id::text
  );

  return jsonb_build_object(
    'status', 'attributed',
    'referrerUserId', v_created.referrer_user_id,
    'referredUserId', v_created.referred_user_id
  );
end;
$$;

grant execute on function public.queue_push_deliveries_for_notification(uuid) to authenticated;
grant execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.accept_referral(text) to authenticated;
