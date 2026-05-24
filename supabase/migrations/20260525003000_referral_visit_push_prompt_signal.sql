create table if not exists public.referral_link_visits (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  visitor_key text not null,
  user_agent text,
  visit_count integer not null default 1 check (visit_count > 0),
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  unique (referrer_user_id, visitor_key)
);

create index if not exists referral_link_visits_referrer_idx
  on public.referral_link_visits (referrer_user_id, last_visited_at desc);

alter table public.referral_link_visits enable row level security;

drop policy if exists "Users can read their referral link visits" on public.referral_link_visits;
create policy "Users can read their referral link visits"
  on public.referral_link_visits for select
  using (auth.uid() = referrer_user_id);

create or replace function public.track_referral_link_visit(
  p_referral_code text,
  p_visitor_key text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral_code text := lower(trim(coalesce(p_referral_code, '')));
  v_visitor_key text := nullif(trim(coalesce(p_visitor_key, '')), '');
  v_referrer_user_id uuid;
  v_existing public.referral_link_visits%rowtype;
  v_created public.referral_link_visits%rowtype;
begin
  if v_referral_code = '' or v_visitor_key is null then
    return jsonb_build_object('status', 'ignored');
  end if;

  select id
    into v_referrer_user_id
  from public.profiles
  where lower(referral_code) = v_referral_code
  limit 1;

  if v_referrer_user_id is null then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  select *
    into v_existing
  from public.referral_link_visits
  where referrer_user_id = v_referrer_user_id
    and visitor_key = v_visitor_key
  limit 1;

  if v_existing.id is not null then
    update public.referral_link_visits
    set referral_code = v_referral_code,
        user_agent = coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), user_agent),
        visit_count = visit_count + 1,
        last_visited_at = now()
    where id = v_existing.id
    returning * into v_created;

    return jsonb_build_object(
      'status', 'updated',
      'referrerUserId', v_referrer_user_id,
      'visitId', v_created.id
    );
  end if;

  insert into public.referral_link_visits (
    referral_code,
    referrer_user_id,
    visitor_key,
    user_agent
  )
  values (
    v_referral_code,
    v_referrer_user_id,
    v_visitor_key,
    nullif(trim(coalesce(p_user_agent, '')), '')
  )
  returning * into v_created;

  perform public.queue_user_notification(
    v_referrer_user_id,
    'account',
    'referral_link_visited',
    'Invite link opened',
    'Someone opened your invite link.',
    '/missions',
    'Open missions',
    jsonb_build_object(
      'referralCode', v_referral_code,
      'visitId', v_created.id
    ),
    'referral-link-visited:' || v_created.id::text
  );

  return jsonb_build_object(
    'status', 'created',
    'referrerUserId', v_referrer_user_id,
    'visitId', v_created.id
  );
end;
$$;

grant execute on function public.track_referral_link_visit(text, text, text) to authenticated;
