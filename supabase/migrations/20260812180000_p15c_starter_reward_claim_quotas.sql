create or replace function private.enforce_organization_reward_quotas()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max integer; v_active integer; begin
  if new.organization_id is null then return new; end if;
  if new.fulfillment_type <> 'manual' then
    raise exception 'Organisation Starter rewards support manual fulfilment only.';
  end if;
  v_max := private.organization_entitlement_integer_unchecked(new.organization_id, 'max_active_rewards');
  if new.status = 'published' and new.is_enabled then
    select count(*) into v_active from public.rewards reward
    where reward.organization_id = new.organization_id and reward.id <> new.id
      and reward.status = 'published' and reward.is_enabled;
    if v_active >= coalesce(v_max, 0) then raise exception 'Organisation active reward limit reached.'; end if;
  end if;
  return new;
end; $$;
revoke execute on function private.enforce_organization_reward_quotas() from public, anon, authenticated, service_role;
drop trigger if exists rewards_enforce_organization_quotas on public.rewards;
create trigger rewards_enforce_organization_quotas before insert or update of status, is_enabled, fulfillment_type, organization_id on public.rewards for each row execute function private.enforce_organization_reward_quotas();

create or replace function private.enforce_organization_claim_quotas()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_open integer; v_month integer; v_open_cap integer; v_month_cap integer; begin
  select organization_id into v_org from public.rewards where id = new.reward_id;
  if v_org is null then return new; end if;
  v_open_cap := private.organization_entitlement_integer_unchecked(v_org, 'max_open_reward_claims');
  if tg_op = 'INSERT' then
    select count(*) into v_open from public.reward_redemptions redemption join public.rewards reward on reward.id = redemption.reward_id
    where reward.organization_id = v_org and redemption.claim_state not in ('fulfilled','rejected','cancelled','refunded','expired');
    if v_open >= coalesce(v_open_cap, 0) then raise exception 'Organisation open reward claim limit reached.'; end if;
  elsif new.claim_state = 'fulfilled' and old.claim_state is distinct from 'fulfilled' then
    v_month_cap := private.organization_entitlement_integer_unchecked(v_org, 'max_fulfilled_reward_claims_per_month');
    select count(*) into v_month from public.reward_redemptions redemption join public.rewards reward on reward.id = redemption.reward_id
    where reward.organization_id = v_org and redemption.claim_state = 'fulfilled' and redemption.fulfilled_at >= date_trunc('month', now());
    if v_month >= coalesce(v_month_cap, 0) then raise exception 'Organisation monthly fulfilled reward claim limit reached.'; end if;
  end if;
  return new;
end; $$;
revoke execute on function private.enforce_organization_claim_quotas() from public, anon, authenticated, service_role;
drop trigger if exists reward_redemptions_enforce_organization_claim_quotas on public.reward_redemptions;
create trigger reward_redemptions_enforce_organization_claim_quotas before insert or update of claim_state on public.reward_redemptions for each row execute function private.enforce_organization_claim_quotas();
