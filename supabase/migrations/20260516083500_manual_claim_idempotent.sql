create or replace function public.submit_manual_redemption_details(
  p_redemption_id uuid,
  p_claim_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_redemption public.reward_redemptions%rowtype;
  v_field jsonb;
  v_field_id text;
  v_field_type text;
  v_value text;
  v_sanitized_claim_data jsonb := public.sanitize_jsonb_strings(coalesce(p_claim_data, '{}'::jsonb));
begin
  if v_user_id is null then
    raise exception 'You need an account to submit reward details.';
  end if;

  select *
    into v_redemption
  from public.reward_redemptions
  where id = p_redemption_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'We could not find this reward purchase.';
  end if;

  if v_redemption.fulfillment_type <> 'manual' then
    raise exception 'This reward does not need a details form.';
  end if;

  if v_redemption.redemption_expires_at is not null
     and v_redemption.redemption_expires_at <= now() then
    update public.reward_redemptions
    set claim_state = 'expired',
        expired_at = now(),
        expiry_reason = 'redemption_window_expired',
        user_message = 'This reward redemption has expired.'
    where id = p_redemption_id;

    raise exception 'This reward redemption has expired.';
  end if;

  if v_redemption.claim_state = 'details_submitted' then
    return jsonb_build_object(
      'id', p_redemption_id,
      'claimState', 'details_submitted',
      'alreadySubmitted', true
    );
  end if;

  if v_redemption.claim_state = 'fulfilled' then
    return jsonb_build_object(
      'id', p_redemption_id,
      'claimState', 'fulfilled',
      'alreadySubmitted', true
    );
  end if;

  if v_redemption.claim_state in ('cancelled', 'refunded', 'expired') then
    raise exception 'This reward has already moved past the details step.';
  end if;

  for v_field in
    select value
    from jsonb_array_elements(coalesce(v_redemption.fulfillment_config_snapshot -> 'fields', '[]'::jsonb))
  loop
    v_field_id := v_field ->> 'id';
    v_field_type := coalesce(v_field ->> 'type', 'text');

    if v_field_id is not null and v_sanitized_claim_data ? v_field_id then
      v_value := trim(coalesce(v_sanitized_claim_data ->> v_field_id, ''));

      if v_field_type = 'email'
         and v_value <> ''
         and v_value !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
        raise exception 'Please enter a valid email address.';
      end if;

      if v_field_type = 'tel'
         and v_value <> ''
         and v_value !~ '^[0-9+(). -]{7,25}$' then
        raise exception 'Please enter a valid phone number.';
      end if;
    end if;

    if coalesce((v_field ->> 'required')::boolean, false) then
      if v_field_id is null
         or not v_sanitized_claim_data ? v_field_id
         or length(trim(coalesce(v_sanitized_claim_data ->> v_field_id, ''))) = 0 then
        raise exception 'Please complete all required reward details.';
      end if;
    end if;
  end loop;

  update public.reward_redemptions
  set claim_data = v_sanitized_claim_data,
      claim_state = 'details_submitted',
      claim_started_at = coalesce(claim_started_at, now()),
      claim_submitted_at = now(),
      user_message = 'Submitted for processing.'
  where id = p_redemption_id;

  return jsonb_build_object(
    'id', p_redemption_id,
    'claimState', 'details_submitted'
  );
end;
$$;

grant execute on function public.submit_manual_redemption_details(uuid, jsonb) to authenticated;
