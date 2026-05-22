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

  return jsonb_build_object(
    'status', 'attributed',
    'referrerUserId', v_created.referrer_user_id,
    'referredUserId', v_created.referred_user_id
  );
end;
$$;

grant execute on function public.accept_referral(text) to authenticated;
