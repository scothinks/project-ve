create table if not exists public.blocked_email_domains (
  domain text primary key,
  reason text not null default 'disposable_email',
  created_at timestamptz not null default now()
);

insert into public.blocked_email_domains (domain, reason)
values
  ('10minutemail.com', 'disposable_email'),
  ('guerrillamail.com', 'disposable_email'),
  ('mailinator.com', 'disposable_email'),
  ('tempmail.com', 'disposable_email'),
  ('temp-mail.org', 'disposable_email'),
  ('yopmail.com', 'disposable_email'),
  ('throwawaymail.com', 'disposable_email'),
  ('sharklasers.com', 'disposable_email'),
  ('getnada.com', 'disposable_email')
on conflict (domain) do nothing;

create table if not exists public.user_risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  severity integer not null default 1 check (severity between 1 and 5),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_risk_events_user_created_idx
  on public.user_risk_events (user_id, created_at desc);

create index if not exists user_risk_events_type_created_idx
  on public.user_risk_events (event_type, created_at desc);

alter table public.user_risk_events enable row level security;

drop policy if exists "Admins can read risk events" on public.user_risk_events;
create policy "Admins can read risk events"
  on public.user_risk_events for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create table if not exists public.signup_attempts (
  id uuid primary key default gen_random_uuid(),
  email_domain text not null,
  ip_hash text,
  device_hash text,
  captcha_passed boolean not null default false,
  blocked boolean not null default false,
  block_reason text,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_created_idx
  on public.signup_attempts (ip_hash, created_at desc)
  where ip_hash is not null;

create index if not exists signup_attempts_device_created_idx
  on public.signup_attempts (device_hash, created_at desc)
  where device_hash is not null;

alter table public.signup_attempts enable row level security;

drop policy if exists "Admins can read signup attempts" on public.signup_attempts;
create policy "Admins can read signup attempts"
  on public.signup_attempts for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create or replace function public.email_domain(email text)
returns text
language sql
immutable
as $$
  select lower(split_part(coalesce(email, ''), '@', 2));
$$;

create or replace function public.is_blocked_email_domain(email text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.blocked_email_domains
    where domain = public.email_domain(email)
  );
$$;

create or replace function public.record_signup_attempt(
  p_email_domain text,
  p_ip_hash text,
  p_device_hash text,
  p_captcha_passed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_domain text := lower(trim(coalesce(p_email_domain, '')));
  v_ip_count integer := 0;
  v_device_count integer := 0;
  v_blocked boolean := false;
  v_reason text;
begin
  if v_email_domain = '' then
    raise exception 'Email address is required.';
  end if;

  if exists (select 1 from public.blocked_email_domains where domain = v_email_domain) then
    v_blocked := true;
    v_reason := 'disposable_email';
  end if;

  if p_ip_hash is not null then
    select count(*)
      into v_ip_count
    from public.signup_attempts
    where ip_hash = p_ip_hash
      and created_at >= now() - interval '1 day';

    if v_ip_count >= 10 then
      v_blocked := true;
      v_reason := coalesce(v_reason, 'too_many_accounts_same_ip');
    end if;
  end if;

  if p_device_hash is not null then
    select count(*)
      into v_device_count
    from public.signup_attempts
    where device_hash = p_device_hash
      and created_at >= now() - interval '1 day';

    if v_device_count >= 5 then
      v_blocked := true;
      v_reason := coalesce(v_reason, 'too_many_accounts_same_device');
    end if;
  end if;

  insert into public.signup_attempts (
    email_domain,
    ip_hash,
    device_hash,
    captcha_passed,
    blocked,
    block_reason
  )
  values (
    v_email_domain,
    p_ip_hash,
    p_device_hash,
    p_captcha_passed,
    v_blocked,
    v_reason
  );

  if v_blocked then
    raise exception 'We could not create this account. Please use a different email or try again later.';
  end if;

  return jsonb_build_object(
    'status', 'allowed',
    'ipAttemptsToday', v_ip_count + 1,
    'deviceAttemptsToday', v_device_count + 1
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := public.email_domain(new.email);
  v_captcha_passed boolean :=
    coalesce((new.raw_user_meta_data ->> 'captcha_passed')::boolean, false);
begin
  if public.is_blocked_email_domain(new.email) then
    insert into public.user_risk_events (
      user_id,
      event_type,
      severity,
      metadata
    )
    values (
      new.id,
      'blocked_signup_disposable_email',
      4,
      jsonb_build_object('emailDomain', v_domain)
    );

    raise exception 'Please use a regular email address to create an account.';
  end if;

  insert into public.profiles (
    id,
    display_name,
    referral_code,
    redemption_unlocked_at,
    fraud_flags
  )
  values (
    new.id,
    public.sanitize_text_value(coalesce(new.raw_user_meta_data ->> 'display_name', new.email)),
    public.generate_referral_code(new.id),
    now() + interval '24 hours',
    jsonb_build_object(
      'signupDeviceHash', new.raw_user_meta_data ->> 'signup_device_hash',
      'signupIpHash', new.raw_user_meta_data ->> 'signup_ip_hash',
      'captchaPassed', v_captcha_passed
    )
  )
  on conflict (id) do nothing;

  insert into public.user_risk_events (
    user_id,
    event_type,
    severity,
    metadata
  )
  values (
    new.id,
    'account_created',
    case when v_captcha_passed then 1 else 2 end,
    jsonb_build_object(
      'emailDomain', v_domain,
      'captchaPassed', v_captcha_passed,
      'signupDeviceHash', new.raw_user_meta_data ->> 'signup_device_hash',
      'signupIpHash', new.raw_user_meta_data ->> 'signup_ip_hash'
    )
  );

  return new;
end;
$$;

grant execute on function public.record_signup_attempt(text, text, text, boolean) to anon;
grant execute on function public.record_signup_attempt(text, text, text, boolean) to authenticated;
