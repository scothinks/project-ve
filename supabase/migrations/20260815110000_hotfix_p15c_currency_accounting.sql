alter table public.xp_accounts
  alter column accounting_currency drop default,
  alter column accounting_currency drop not null;

alter table public.xp_accounts
  drop constraint if exists xp_accounts_accounting_currency_check;

update public.xp_accounts
set accounting_currency = null,
    updated_at = now()
where accounting_currency = 'XP';

alter table public.xp_accounts
  add constraint xp_accounts_accounting_currency_iso_check
  check (accounting_currency is null or accounting_currency ~ '^[A-Z]{3}$');

create or replace function private.ensure_default_organization_xp_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.xp_accounts (
    scope,
    organization_id,
    name,
    plural_name,
    short_label,
    status,
    is_default,
    accounting_value_per_unit
  )
  values (
    'organization',
    new.id,
    new.name || ' Points',
    new.name || ' Points',
    'PTS',
    'active',
    true,
    0
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.admin_update_xp_account_controls(
  p_xp_account_id uuid,
  p_accounting_currency text,
  p_accounting_value_per_unit numeric,
  p_issuance_period_days integer,
  p_issuance_cap_per_period integer,
  p_issuance_cap_per_user integer,
  p_funded_reward_budget numeric default null,
  p_exposure_warning_threshold numeric default null,
  p_exposure_hard_threshold numeric default null
)
returns public.xp_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_accounting_currency text := nullif(upper(btrim(coalesce(p_accounting_currency, ''))), '');
  v_before public.xp_accounts%rowtype;
  v_account public.xp_accounts%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_before from public.xp_accounts where id = p_xp_account_id for update;
  if not found or v_before.scope <> 'organization' or v_before.organization_id is null then
    raise exception 'Organisation XP account not found.' using errcode = '42501';
  end if;
  if not public.current_user_is_admin()
     and not public.current_user_has_organization_role(
       v_before.organization_id,
       array['organisation_owner', 'organisation_admin']::public.organization_role_key[]
     ) then
    raise exception 'Organisation XP account access is required.' using errcode = '42501';
  end if;
  if v_accounting_currency is not null and v_accounting_currency !~ '^[A-Z]{3}$' then
    raise exception 'Accounting currency must be a three-letter ISO currency code.';
  end if;
  if p_accounting_value_per_unit is null or p_accounting_value_per_unit < 0 then
    raise exception 'Accounting value per unit is required.';
  end if;
  if p_issuance_period_days is null or p_issuance_period_days <= 0 then
    raise exception 'Issuance period must be at least 1 day.';
  end if;
  if p_issuance_cap_per_period is null or p_issuance_cap_per_period < 0 then
    raise exception 'Period issuance cap is required.';
  end if;
  if p_issuance_cap_per_user is null or p_issuance_cap_per_user < 0 then
    raise exception 'Per-user issuance cap is required.';
  end if;
  if p_funded_reward_budget is not null and p_funded_reward_budget < 0 then
    raise exception 'Funded reward budget must be zero or greater.';
  end if;
  if p_exposure_warning_threshold is not null and p_exposure_warning_threshold < 0 then
    raise exception 'Exposure warning threshold must be zero or greater.';
  end if;
  if p_exposure_hard_threshold is not null and p_exposure_hard_threshold < 0 then
    raise exception 'Exposure hard threshold must be zero or greater.';
  end if;
  if p_exposure_warning_threshold is not null
     and p_exposure_hard_threshold is not null
     and p_exposure_hard_threshold < p_exposure_warning_threshold then
    raise exception 'Exposure hard threshold cannot be below the warning threshold.';
  end if;

  update public.xp_accounts
  set accounting_currency = v_accounting_currency,
      accounting_value_per_unit = p_accounting_value_per_unit,
      issuance_period_days = p_issuance_period_days,
      issuance_cap_per_period = p_issuance_cap_per_period,
      issuance_cap_per_user = p_issuance_cap_per_user,
      funded_reward_budget = p_funded_reward_budget,
      exposure_warning_threshold = p_exposure_warning_threshold,
      exposure_hard_threshold = p_exposure_hard_threshold,
      updated_at = now()
  where id = p_xp_account_id
  returning * into v_account;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'xp_account_issuance_controls_updated',
    'xp_account',
    v_account.id::text,
    jsonb_build_object(
      'organizationId', v_account.organization_id,
      'before', jsonb_build_object(
        'accountingCurrency', v_before.accounting_currency,
        'accountingValuePerUnit', v_before.accounting_value_per_unit,
        'issuancePeriodDays', v_before.issuance_period_days,
        'issuanceCapPerPeriod', v_before.issuance_cap_per_period,
        'issuanceCapPerUser', v_before.issuance_cap_per_user,
        'fundedRewardBudget', v_before.funded_reward_budget,
        'exposureWarningThreshold', v_before.exposure_warning_threshold,
        'exposureHardThreshold', v_before.exposure_hard_threshold
      ),
      'after', jsonb_build_object(
        'accountingCurrency', v_account.accounting_currency,
        'accountingValuePerUnit', v_account.accounting_value_per_unit,
        'issuancePeriodDays', v_account.issuance_period_days,
        'issuanceCapPerPeriod', v_account.issuance_cap_per_period,
        'issuanceCapPerUser', v_account.issuance_cap_per_user,
        'fundedRewardBudget', v_account.funded_reward_budget,
        'exposureWarningThreshold', v_account.exposure_warning_threshold,
        'exposureHardThreshold', v_account.exposure_hard_threshold
      )
    )
  );

  return v_account;
end;
$$;

revoke execute on function public.admin_update_xp_account_controls(uuid, text, numeric, integer, integer, integer, numeric, numeric, numeric)
  from public, anon;
grant execute on function public.admin_update_xp_account_controls(uuid, text, numeric, integer, integer, integer, numeric, numeric, numeric)
  to authenticated, service_role;

revoke execute on function public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric)
  from public, anon, authenticated, service_role;
drop function if exists public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric);

create or replace function public.admin_get_xp_account_overview(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
  v_period_start timestamptz;
  v_circulation bigint;
  v_issuance bigint;
  v_redemptions bigint;
  v_adjustments bigint;
  v_period_issuance bigint;
  v_estimated_liability numeric(14, 2);
  v_rewards jsonb;
  v_history jsonb;
  v_programme_issuance jsonb;
  v_user_issuance jsonb;
begin
  if p_organization_id is null or not public.current_user_can_manage_organization(p_organization_id) then
    raise exception 'Organisation XP account access is required.' using errcode = '42501';
  end if;

  select * into v_account
  from public.xp_accounts
  where organization_id = p_organization_id and scope = 'organization' and is_default
  order by status = 'active' desc
  limit 1;
  if not found then raise exception 'Organisation XP account not found.'; end if;

  v_period_start := now() - make_interval(days => v_account.issuance_period_days);

  select coalesce(sum(balance_cached), 0) into v_circulation
  from public.user_xp_balances where xp_account_id = v_account.id;
  select coalesce(sum(amount) filter (
           where direction = 'earn'
             and not private.is_reward_refund_restoration(source_type::text, award_scope)
         ), 0),
         coalesce(sum(amount) filter (where direction = 'spend'), 0),
         coalesce(sum(amount) filter (where source_type = 'adjustment'), 0),
         coalesce(sum(amount) filter (
           where direction = 'earn'
             and created_at >= v_period_start
             and not private.is_reward_refund_restoration(source_type::text, award_scope)
         ), 0)
    into v_issuance, v_redemptions, v_adjustments, v_period_issuance
  from public.xp_transactions where xp_account_id = v_account.id;
  select coalesce(sum(balance_cached), 0) * v_account.accounting_value_per_unit
    into v_estimated_liability
  from public.user_xp_balances where xp_account_id = v_account.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'programmeId', issuance.programme_id,
    'programmeName', programme.title,
    'issued', issuance.issued
  ) order by issuance.issued desc), '[]'::jsonb)
    into v_programme_issuance
  from (
    select transaction.programme_id, sum(transaction.amount)::bigint as issued
    from public.xp_transactions transaction
    where transaction.xp_account_id = v_account.id
      and transaction.direction = 'earn'
      and transaction.programme_id is not null
      and not private.is_reward_refund_restoration(transaction.source_type::text, transaction.award_scope)
    group by transaction.programme_id
  ) issuance
  join public.programmes programme on programme.id = issuance.programme_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', issuance.user_id,
    'displayName', coalesce(profile.display_name, 'Unnamed learner'),
    'issued', issuance.issued
  ) order by issuance.issued desc), '[]'::jsonb)
    into v_user_issuance
  from (
    select transaction.user_id, sum(transaction.amount)::bigint as issued
    from public.xp_transactions transaction
    where transaction.xp_account_id = v_account.id
      and transaction.direction = 'earn'
      and not private.is_reward_refund_restoration(transaction.source_type::text, transaction.award_scope)
    group by transaction.user_id
  ) issuance
  left join public.profiles profile on profile.id = issuance.user_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', reward.id, 'title', reward.title, 'costXp', reward.cost_xp, 'status', reward.status, 'isEnabled', reward.is_enabled) order by reward.title), '[]'::jsonb)
    into v_rewards
  from public.rewards reward where reward.xp_account_id = v_account.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', transaction.id, 'userId', transaction.user_id, 'amount', transaction.amount, 'direction', transaction.direction, 'sourceType', transaction.source_type, 'sourceId', transaction.source_id, 'createdAt', transaction.created_at) order by transaction.created_at desc), '[]'::jsonb)
    into v_history
  from (select * from public.xp_transactions where xp_account_id = v_account.id order by created_at desc limit 50) transaction;

  return jsonb_build_object(
    'account', jsonb_build_object('id', v_account.id, 'name', v_account.name, 'pluralName', v_account.plural_name, 'shortLabel', v_account.short_label, 'icon', coalesce(v_account.icon_url, v_account.icon), 'displayFormat', v_account.display_format, 'status', v_account.status),
    'circulation', v_circulation,
    'issuance', v_issuance,
    'redemptions', v_redemptions,
    'adjustments', v_adjustments,
    'controls', jsonb_build_object(
      'accountingCurrency', v_account.accounting_currency,
      'accountingValuePerUnit', v_account.accounting_value_per_unit,
      'issuancePeriodDays', v_account.issuance_period_days,
      'issuanceCapPerPeriod', v_account.issuance_cap_per_period,
      'issuanceCapPerUser', v_account.issuance_cap_per_user,
      'fundedRewardBudget', v_account.funded_reward_budget,
      'exposureWarningThreshold', v_account.exposure_warning_threshold,
      'exposureHardThreshold', v_account.exposure_hard_threshold,
      'periodIssued', v_period_issuance,
      'periodRemaining', greatest(v_account.issuance_cap_per_period - v_period_issuance, 0)
    ),
    'exposure', jsonb_build_object(
      'estimatedUnredeemedLiability', v_estimated_liability,
      'warning', v_account.exposure_warning_threshold is not null and v_estimated_liability >= v_account.exposure_warning_threshold,
      'hardBlocked', v_account.exposure_hard_threshold is not null and v_estimated_liability >= v_account.exposure_hard_threshold
    ),
    'programmeIssuance', v_programme_issuance,
    'userIssuance', v_user_issuance,
    'rewards', v_rewards,
    'transactions', v_history
  );
end;
$$;

delete from private.rpc_security_classifications
where function_schema = 'public'
  and function_name = 'admin_update_xp_account_controls'
  and identity_arguments = 'p_xp_account_id uuid, p_accounting_value_per_unit numeric, p_issuance_period_days integer, p_issuance_cap_per_period integer, p_issuance_cap_per_user integer, p_funded_reward_budget numeric, p_exposure_warning_threshold numeric, p_exposure_hard_threshold numeric';

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values (
  'public', 'admin_update_xp_account_controls', 'p_xp_account_id uuid, p_accounting_currency text, p_accounting_value_per_unit numeric, p_issuance_period_days integer, p_issuance_cap_per_period integer, p_issuance_cap_per_user integer, p_funded_reward_budget numeric, p_exposure_warning_threshold numeric, p_exposure_hard_threshold numeric',
  'ADMIN_AUTHENTICATED', 'Organisation managers configuring their organisation XP issuance, accounting currency and exposure controls.',
  'Requires organisation management access; platform accounts and account ownership remain immutable through this path. Accounting currency is nullable and, when configured, must be a canonical three-letter uppercase accounting currency code.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();

update private.rpc_security_classifications
set authorization_rule = 'Requires organisation management access and returns only the selected organisation account, including accounting currency, issuance, exposure, programme and learner summaries.',
    reviewed_at = now()
where function_schema = 'public'
  and function_name = 'admin_get_xp_account_overview'
  and identity_arguments = 'p_organization_id uuid';
