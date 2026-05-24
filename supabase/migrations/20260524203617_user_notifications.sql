create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('missions', 'rewards', 'account', 'system')),
  event_type text not null,
  title text not null,
  body text not null,
  cta_href text,
  cta_label text,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  web_push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_push_subscriptions_user_idx
  on public.user_push_subscriptions (user_id, updated_at desc);

insert into public.notification_preferences (user_id)
select p.id
from public.profiles p
where not exists (
  select 1
  from public.notification_preferences np
  where np.user_id = p.id
);

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

  return new;
end;
$$;

drop trigger if exists profiles_create_notification_preferences on public.profiles;
create trigger profiles_create_notification_preferences
  after insert on public.profiles
  for each row execute function public.handle_profile_notification_preferences();

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
begin
  if p_user_id is null then
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

create or replace function public.notify_reward_redemption_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward_title text := coalesce(new.reward_title_snapshot, 'Reward');
  v_body text;
  v_title text;
begin
  if tg_op = 'INSERT' then
    v_title := case
      when new.claim_state = 'fulfilled' then 'Reward applied'
      else 'Reward unlocked'
    end;

    v_body := case
      when coalesce(new.user_message, '') <> '' then new.user_message
      when new.claim_state = 'fulfilled' then v_reward_title || ' was applied to your account.'
      else v_reward_title || ' is ready in your rewards inbox.'
    end;

    perform public.queue_user_notification(
      new.user_id,
      'rewards',
      'reward_redemption_created',
      v_title,
      v_body,
      '/xp-store',
      'View reward',
      jsonb_build_object(
        'redemptionId', new.id,
        'rewardId', new.reward_id,
        'claimState', new.claim_state
      ),
      'reward-redemption-created:' || new.id::text
    );

    return new;
  end if;

  if old.claim_state is distinct from new.claim_state then
    if new.claim_state = 'fulfilled' then
      perform public.queue_user_notification(
        new.user_id,
        'rewards',
        'reward_redemption_fulfilled',
        'Reward fulfilled',
        coalesce(new.user_message, v_reward_title || ' has been fulfilled.'),
        '/xp-store',
        'Open reward',
        jsonb_build_object(
          'redemptionId', new.id,
          'rewardId', new.reward_id,
          'claimState', new.claim_state
        ),
        'reward-redemption-fulfilled:' || new.id::text
      );
    elsif new.claim_state = 'refunded' then
      perform public.queue_user_notification(
        new.user_id,
        'rewards',
        'reward_redemption_refunded',
        'Reward refunded',
        coalesce(new.user_message, 'This reward was refunded and your XP was returned.'),
        '/xp-store',
        'Review reward',
        jsonb_build_object(
          'redemptionId', new.id,
          'rewardId', new.reward_id,
          'claimState', new.claim_state
        ),
        'reward-redemption-refunded:' || new.id::text
      );
    elsif new.claim_state = 'expired' then
      perform public.queue_user_notification(
        new.user_id,
        'rewards',
        'reward_redemption_expired',
        'Reward expired',
        coalesce(new.user_message, v_reward_title || ' expired before it was claimed.'),
        '/xp-store',
        'View rewards',
        jsonb_build_object(
          'redemptionId', new.id,
          'rewardId', new.reward_id,
          'claimState', new.claim_state
        ),
        'reward-redemption-expired:' || new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reward_redemptions_notify_event on public.reward_redemptions;
create trigger reward_redemptions_notify_event
  after insert or update on public.reward_redemptions
  for each row execute function public.notify_reward_redemption_event();

create or replace function public.notify_mission_proof_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission_title text := 'Mission';
  v_body text;
begin
  if new.status not in ('approved', 'rejected') or old.status is not distinct from new.status then
    return new;
  end if;

  select title
    into v_mission_title
  from public.missions
  where id = new.mission_id;

  if new.status = 'approved' then
    v_body := v_mission_title || ' was approved. Your reward is now available.';
  else
    v_body := case
      when coalesce(new.rejection_reason, '') <> '' then new.rejection_reason
      else v_mission_title || ' needs another proof submission.'
    end;
  end if;

  perform public.queue_user_notification(
    new.user_id,
    'missions',
    'mission_proof_' || new.status::text,
    case
      when new.status = 'approved' then 'Mission approved'
      else 'Mission needs changes'
    end,
    v_body,
    '/missions',
    'Open missions',
    jsonb_build_object(
      'missionId', new.mission_id,
      'awardScope', new.award_scope,
      'status', new.status
    ),
    'mission-proof:' || new.user_id::text || ':' || new.mission_id || ':' || new.award_scope || ':' || new.status::text
  );

  return new;
end;
$$;

drop trigger if exists mission_proofs_notify_event on public.mission_proofs;
create trigger mission_proofs_notify_event
  after update on public.mission_proofs
  for each row execute function public.notify_mission_proof_event();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists user_push_subscriptions_set_updated_at on public.user_push_subscriptions;
create trigger user_push_subscriptions_set_updated_at
  before update on public.user_push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.user_notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_push_subscriptions enable row level security;

drop policy if exists "Users can read their notifications" on public.user_notifications;
create policy "Users can read their notifications"
  on public.user_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their notifications" on public.user_notifications;
create policy "Users can update their notifications"
  on public.user_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their notification preferences" on public.notification_preferences;
create policy "Users can read their notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their notification preferences" on public.notification_preferences;
create policy "Users can insert their notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their notification preferences" on public.notification_preferences;
create policy "Users can update their notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their push subscriptions" on public.user_push_subscriptions;
create policy "Users can read their push subscriptions"
  on public.user_push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their push subscriptions" on public.user_push_subscriptions;
create policy "Users can insert their push subscriptions"
  on public.user_push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their push subscriptions" on public.user_push_subscriptions;
create policy "Users can update their push subscriptions"
  on public.user_push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their push subscriptions" on public.user_push_subscriptions;
create policy "Users can delete their push subscriptions"
  on public.user_push_subscriptions for delete
  using (auth.uid() = user_id);

grant execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) to authenticated;
