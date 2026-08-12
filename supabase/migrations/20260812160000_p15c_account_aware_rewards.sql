alter table public.rewards
  add column if not exists xp_account_id uuid references public.xp_accounts(id) on delete restrict;

alter table public.reward_redemptions
  add column if not exists xp_account_id uuid references public.xp_accounts(id) on delete restrict;

update public.rewards reward
set xp_account_id = case
  when reward.organization_id is null then '00000000-0000-4000-8000-00000000e001'::uuid
  else (
    select account.id
    from public.xp_accounts account
    where account.organization_id = reward.organization_id
      and account.is_default
      and account.status = 'active'
    limit 1
  )
end
where reward.xp_account_id is null;

update public.reward_redemptions redemption
set xp_account_id = transaction.xp_account_id
from public.xp_transactions transaction
where transaction.id = redemption.xp_transaction_id
  and redemption.xp_account_id is null;

create or replace function private.enforce_reward_xp_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.xp_account_id is null then
    if new.organization_id is null then
      new.xp_account_id := '00000000-0000-4000-8000-00000000e001'::uuid;
    else
      select account.id into new.xp_account_id
      from public.xp_accounts account
      where account.organization_id = new.organization_id
        and account.is_default
        and account.status = 'active';
    end if;
  end if;

  if new.xp_account_id is null then
    raise exception 'Rewards require an XP account.';
  end if;

  if new.organization_id is null then
    if new.xp_account_id <> '00000000-0000-4000-8000-00000000e001'::uuid then
      raise exception 'Platform rewards must use the Project Ve XP account.';
    end if;
  elsif not exists (
    select 1 from public.xp_accounts account
    where account.id = new.xp_account_id
      and account.scope = 'organization'
      and account.organization_id = new.organization_id
      and account.status = 'active'
  ) then
    raise exception 'Reward XP account must be active and owned by the reward organisation.';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_reward_xp_account_ownership() from public, anon, authenticated, service_role;

drop trigger if exists rewards_enforce_xp_account_ownership on public.rewards;
create trigger rewards_enforce_xp_account_ownership
  before insert or update of xp_account_id, organization_id on public.rewards
  for each row execute function private.enforce_reward_xp_account_ownership();

alter function public.redeem_reward(text) rename to redeem_reward_legacy;

create function public.redeem_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reward public.rewards%rowtype;
  v_account_balance integer;
  v_result jsonb;
  v_redemption_id uuid;
  v_temporary_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'You need an account to exchange XP for rewards.';
  end if;

  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found or not public.current_user_can_access_reward(p_reward_id) then
    raise exception 'This reward is not available right now.';
  end if;

  select balance_cached into v_account_balance
  from public.user_xp_balances
  where user_id = v_user_id and xp_account_id = v_reward.xp_account_id
  for update;

  if coalesce(v_account_balance, 0) < v_reward.cost_xp then
    raise exception 'You need more XP to exchange for this reward.';
  end if;

  if v_reward.xp_account_id <> '00000000-0000-4000-8000-00000000e001'::uuid then
    -- The established redemption workflow reads the platform compatibility cache.
    -- Offset it with a ledger-backed, transaction-local bridge and remove it below.
    v_temporary_transaction_id := private.post_xp_transaction(
      v_user_id,
      '00000000-0000-4000-8000-00000000e001'::uuid,
      'earn', v_reward.cost_xp, 'adjustment', 'reward-account-bridge:' || gen_random_uuid()::text,
      null, jsonb_build_object('internal', true)
    );
  end if;

  v_result := public.redeem_reward_legacy(p_reward_id);
  v_redemption_id := (v_result ->> 'id')::uuid;

  if v_temporary_transaction_id is not null then
    update public.xp_transactions transaction
    set xp_account_id = v_reward.xp_account_id,
        metadata = transaction.metadata || jsonb_build_object('xpAccountId', v_reward.xp_account_id)
    where transaction.id = (
      select redemption.xp_transaction_id from public.reward_redemptions redemption where redemption.id = v_redemption_id
    );

    delete from public.xp_transactions where id = v_temporary_transaction_id;
  end if;

  update public.reward_redemptions
  set xp_account_id = v_reward.xp_account_id
  where id = v_redemption_id;

  return v_result || jsonb_build_object('xpAccountId', v_reward.xp_account_id);
end;
$$;

revoke execute on function public.redeem_reward_legacy(text) from public, anon, authenticated, service_role;
revoke execute on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;

alter function public.refund_reward_redemption(uuid, text) rename to refund_reward_redemption_legacy;

create function public.refund_reward_redemption(p_redemption_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_result jsonb;
  v_refund_transaction_id uuid;
begin
  select xp_account_id into v_account_id from public.reward_redemptions where id = p_redemption_id for update;
  v_result := public.refund_reward_redemption_legacy(p_redemption_id, p_reason);
  v_refund_transaction_id := nullif(v_result ->> 'refundXpTransactionId', '')::uuid;

  if v_account_id is not null and v_refund_transaction_id is not null then
    update public.xp_transactions transaction
    set xp_account_id = v_account_id,
        metadata = transaction.metadata || jsonb_build_object('xpAccountId', v_account_id)
    where transaction.id = v_refund_transaction_id
      and transaction.xp_account_id <> v_account_id;
  end if;

  return v_result || jsonb_build_object('xpAccountId', coalesce(v_account_id, '00000000-0000-4000-8000-00000000e001'::uuid));
end;
$$;

revoke execute on function public.refund_reward_redemption_legacy(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.refund_reward_redemption(uuid, text) from public, anon;
grant execute on function public.refund_reward_redemption(uuid, text) to authenticated;

insert into private.rpc_security_classifications (function_schema, function_name, identity_arguments, classification, intended_callers, authorization_rule, execute_roles)
values
  ('public', 'redeem_reward_legacy', 'p_reward_id text', 'INTERNAL_HELPER', 'Account-aware reward redemption wrapper.', 'No direct execution; caller account selection is derived from the configured reward.', array[]::text[]),
  ('public', 'refund_reward_redemption_legacy', 'p_redemption_id uuid, p_reason text', 'INTERNAL_HELPER', 'Account-aware reward refund wrapper.', 'No direct execution; refunds retain the redemption account.', array[]::text[])
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification, intended_callers = excluded.intended_callers, authorization_rule = excluded.authorization_rule, execute_roles = excluded.execute_roles, reviewed_at = now();
