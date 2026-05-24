create or replace function public.finalize_oauth_signup(
  p_ip_hash text,
  p_device_hash text,
  p_captcha_passed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  update public.profiles
  set fraud_flags = coalesce(fraud_flags, '{}'::jsonb) || jsonb_strip_nulls(
        jsonb_build_object(
          'signupDeviceHash', p_device_hash,
          'signupIpHash', p_ip_hash,
          'captchaPassed', p_captcha_passed,
          'oauthGoogleSignupVerifiedAt', now()
        )
      ),
      updated_at = now()
  where id = v_user_id;

  insert into public.user_risk_events (
    user_id,
    event_type,
    severity,
    metadata
  )
  values (
    v_user_id,
    'oauth_signup_verified',
    1,
    jsonb_strip_nulls(
      jsonb_build_object(
        'captchaPassed', p_captcha_passed,
        'signupDeviceHash', p_device_hash,
        'signupIpHash', p_ip_hash
      )
    )
  );

  return jsonb_build_object(
    'userId', v_user_id,
    'captchaPassed', p_captcha_passed
  );
end;
$$;

grant execute on function public.finalize_oauth_signup(text, text, boolean) to authenticated;
