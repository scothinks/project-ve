create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := public.email_domain(new.email);
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
    jsonb_build_object('captchaPassed', false)
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
    2,
    jsonb_build_object(
      'emailDomain', v_domain,
      'captchaPassed', false,
      'metadataCaptchaIgnored', new.raw_user_meta_data ? 'captcha_passed'
    )
  );

  return new;
end;
$$;
