create or replace function public.admin_adjust_xp_account(
  p_xp_account_id uuid,
  p_target_user_id uuid,
  p_amount integer,
  p_direction public.xp_direction,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_account public.xp_accounts%rowtype;
  v_transaction_id uuid;
  v_direction public.xp_direction := p_direction;
  v_source_id text := gen_random_uuid()::text;
begin
  if v_actor_id is null then raise exception 'Authentication is required.'; end if;
  if p_target_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'A positive adjustment amount and target learner are required.';
  end if;
  if v_direction not in ('earn', 'spend') then raise exception 'Adjustment direction is invalid.'; end if;

  select * into v_account from public.xp_accounts
  where id = p_xp_account_id and status = 'active' for update;
  if not found or v_account.scope <> 'organization' then
    raise exception 'An active organisation XP account is required.';
  end if;
  if not public.current_user_is_admin()
     and not public.current_user_has_organization_role(
       v_account.organization_id,
       array['organisation_owner', 'organisation_admin']::public.organization_role_key[]
     ) then
    raise exception 'You cannot adjust this organisation XP account.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_account.organization_id
      and membership.user_id = p_target_user_id
      and membership.status = 'active'
  ) and not exists (
    select 1
    from public.enrolments enrolment
    join public.programmes programme
      on programme.id = enrolment.programme_id
    where enrolment.organization_id = v_account.organization_id
      and programme.organization_id = v_account.organization_id
      and enrolment.user_id = p_target_user_id
      and enrolment.status in ('active', 'completed')
  ) then
    raise exception 'The target learner is not active in this organisation.';
  end if;

  v_transaction_id := private.post_xp_transaction(
    p_target_user_id,
    v_account.id,
    v_direction,
    p_amount,
    'adjustment',
    v_source_id,
    'admin_adjustment:' || v_source_id,
    jsonb_build_object(
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'organizationId', v_account.organization_id,
      'xpAccountId', v_account.id,
      'adjustedBy', v_actor_id
    )
  );

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id, 'xp_account_adjusted', 'xp_account', v_account.id::text,
    jsonb_build_object(
      'organizationId', v_account.organization_id,
      'targetUserId', p_target_user_id,
      'amount', p_amount,
      'direction', v_direction,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'transactionId', v_transaction_id
    )
  );

  return jsonb_build_object('transactionId', v_transaction_id, 'xpAccountId', v_account.id);
end;
$$;

revoke execute on function public.admin_adjust_xp_account(uuid, uuid, integer, public.xp_direction, text)
  from public, anon;
grant execute on function public.admin_adjust_xp_account(uuid, uuid, integer, public.xp_direction, text)
  to authenticated;
