alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.sanitize_url_value(input text)
returns text
language plpgsql
immutable
as $$
declare
  v_value text := public.sanitize_text_value(input);
begin
  if v_value is null or v_value = '' then
    return null;
  end if;

  if v_value !~* '^https?://[^[:space:]]{3,1000}$' then
    return null;
  end if;

  return substr(v_value, 1, 1000);
end;
$$;

create or replace function public.sanitize_profile_text_fields()
returns trigger
language plpgsql
as $$
begin
  new.display_name := public.sanitize_text_value(new.display_name);
  new.avatar_url := public.sanitize_url_value(new.avatar_url);
  return new;
end;
$$;

drop trigger if exists sanitize_profile_text_fields_trigger on public.profiles;
create trigger sanitize_profile_text_fields_trigger
  before insert or update of display_name, avatar_url on public.profiles
  for each row execute function public.sanitize_profile_text_fields();

drop policy if exists "Users can update their profile" on public.profiles;
revoke update on public.profiles from anon;
revoke update on public.profiles from authenticated;

create or replace function public.update_my_profile(
  p_display_name text,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text := public.sanitize_text_value(p_display_name);
  v_avatar_url text := public.sanitize_url_value(p_avatar_url);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_display_name is null or length(v_display_name) < 2 then
    raise exception 'Enter your name.';
  end if;

  update public.profiles
  set display_name = v_display_name,
      avatar_url = v_avatar_url,
      updated_at = now()
  where id = v_user_id;

  return jsonb_build_object(
    'id', v_user_id,
    'displayName', v_display_name,
    'avatarUrl', v_avatar_url
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
  v_display_name text := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.email
  );
  v_avatar_url text := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );
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
    avatar_url,
    referral_code,
    redemption_unlocked_at,
    fraud_flags
  )
  values (
    new.id,
    public.sanitize_text_value(v_display_name),
    public.sanitize_url_value(v_avatar_url),
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

grant execute on function public.update_my_profile(text, text) to authenticated;
