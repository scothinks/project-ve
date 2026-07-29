create or replace function private.post_xp_transaction(
  p_user_id uuid,
  p_direction public.xp_direction,
  p_amount integer,
  p_source_type public.xp_source_type,
  p_source_id text,
  p_award_scope text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_inserted boolean := false;
begin
  if p_user_id is null then
    raise exception 'XP user is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'XP amount must be positive.';
  end if;

  if p_direction is null then
    raise exception 'XP direction is required.';
  end if;

  if p_source_type is null or nullif(trim(coalesce(p_source_id, '')), '') is null then
    raise exception 'XP source is required.';
  end if;

  if p_direction = 'earn' and nullif(trim(coalesce(p_award_scope, '')), '') is not null then
    insert into public.xp_transactions (
      user_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      p_user_id,
      p_amount,
      p_direction,
      p_source_type,
      p_source_id,
      p_award_scope,
      coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (user_id, award_scope)
      where direction = 'earn' and award_scope is not null
      do nothing
    returning id into v_transaction_id;

    v_inserted := v_transaction_id is not null;

    if v_transaction_id is null then
      select id
        into v_transaction_id
      from public.xp_transactions
      where user_id = p_user_id
        and direction = 'earn'
        and award_scope = p_award_scope;
    end if;
  else
    insert into public.xp_transactions (
      user_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      p_user_id,
      p_amount,
      p_direction,
      p_source_type,
      p_source_id,
      p_award_scope,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_transaction_id;

    v_inserted := true;
  end if;

  if v_inserted then
    update public.profiles
    set xp = greatest(0, xp + case when p_direction = 'earn' then p_amount else -p_amount end),
        xp_balance_cached = greatest(
          0,
          xp_balance_cached + case when p_direction = 'earn' then p_amount else -p_amount end
        ),
        updated_at = now()
    where id = p_user_id;

    if not found then
      raise exception 'XP profile not found.';
    end if;
  end if;

  return v_transaction_id;
end;
$$;

create or replace function public.increment_profile_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'XP user is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'XP amount must be positive.';
  end if;

  if not exists (
    select 1
    from public.xp_transactions
    where user_id = p_user_id
      and direction = 'earn'
      and amount = p_amount
      and created_at = transaction_timestamp()
  ) then
    raise exception 'XP balance updates must be backed by a same-transaction ledger entry.';
  end if;

  update public.profiles
  set xp = xp + p_amount,
      xp_balance_cached = xp_balance_cached + p_amount,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'XP profile not found.';
  end if;
end;
$$;

revoke execute on function private.post_xp_transaction(uuid, public.xp_direction, integer, public.xp_source_type, text, text, jsonb) from public, anon, authenticated, service_role;

revoke execute on function public.increment_profile_xp(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_profile_xp(uuid, integer) to service_role;

revoke execute on function public.apply_native_reward_effect(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_native_reward_effect(uuid, uuid, text, jsonb) to service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'public',
    'increment_profile_xp',
    'p_user_id uuid, p_amount integer',
    'INTERNAL_HELPER',
    'Legacy trusted XP workflows only.',
    'No browser role may execute. The function refuses to update a profile unless a matching earn ledger row exists in the same transaction.',
    array['service_role']
  ),
  (
    'public',
    'apply_native_reward_effect',
    'p_user_id uuid, p_redemption_id uuid, p_source_reward_id text, p_config jsonb',
    'INTERNAL_HELPER',
    'Trusted reward redemption workflows only.',
    'No browser role may execute. Reward effect data must come from persisted reward configuration.',
    array['service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
