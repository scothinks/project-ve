alter table public.xp_accounts
  add column if not exists issuance_period_days integer not null default 30,
  add column if not exists issuance_cap_per_period integer not null default 10000,
  add column if not exists issuance_cap_per_user integer not null default 1000,
  add column if not exists funded_reward_budget numeric(14, 2),
  add column if not exists exposure_warning_threshold numeric(14, 2),
  add column if not exists exposure_hard_threshold numeric(14, 2);

do $$ begin
  alter table public.xp_accounts
    add constraint xp_accounts_issuance_period_days_check
    check (issuance_period_days between 1 and 366);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.xp_accounts
    add constraint xp_accounts_issuance_caps_check
    check (issuance_cap_per_period >= 0 and issuance_cap_per_user >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.xp_accounts
    add constraint xp_accounts_exposure_controls_check
    check (
      (funded_reward_budget is null or funded_reward_budget >= 0)
      and (exposure_warning_threshold is null or exposure_warning_threshold >= 0)
      and (exposure_hard_threshold is null or exposure_hard_threshold >= 0)
      and (
        exposure_warning_threshold is null
        or exposure_hard_threshold is null
        or exposure_hard_threshold >= exposure_warning_threshold
      )
    );
exception when duplicate_object then null;
end $$;

alter table public.xp_transactions
  add column if not exists programme_id uuid references public.programmes(id) on delete set null;

create index if not exists xp_transactions_account_programme_issued_idx
  on public.xp_transactions(xp_account_id, programme_id, created_at desc)
  where direction = 'earn';

create or replace function private.populate_xp_transaction_programme_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_organization_id uuid;
  v_programme_id uuid;
  v_attempt_id uuid;
  v_redemption_id uuid;
begin
  if new.xp_account_id is null then
    return new;
  end if;

  select organization_id
    into v_account_organization_id
  from public.xp_accounts
  where id = new.xp_account_id
    and scope = 'organization';

  if v_account_organization_id is null then
    new.programme_id := null;
    return new;
  end if;

  if coalesce(new.metadata, '{}'::jsonb) ->> 'programmeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_programme_id := (new.metadata ->> 'programmeId')::uuid;
  end if;

  if v_programme_id is null
     and new.source_type = 'quiz_question'
     and coalesce(new.metadata, '{}'::jsonb) ->> 'attemptId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_attempt_id := (new.metadata ->> 'attemptId')::uuid;
    select programme_id
      into v_programme_id
    from public.quiz_attempts
    where id = v_attempt_id
      and user_id = new.user_id;
  end if;

  if v_programme_id is null
     and new.source_type = 'assessment'
     and coalesce(new.metadata, '{}'::jsonb) ->> 'attemptId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_attempt_id := (new.metadata ->> 'attemptId')::uuid;
    select programme_id
      into v_programme_id
    from public.user_assessment_attempts
    where id = v_attempt_id
      and user_id = new.user_id;
  end if;

  if v_programme_id is null
     and new.source_type = 'reward_redemption'
     and new.source_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_redemption_id := new.source_id::uuid;
    if coalesce(new.metadata, '{}'::jsonb) ->> 'programmeId' is null then
      select reward.sponsored_programme_id
        into v_programme_id
      from public.reward_redemptions redemption
      join public.rewards reward on reward.id = redemption.reward_id
      where redemption.id = v_redemption_id
        and redemption.user_id = new.user_id;
    end if;
  end if;

  if v_programme_id is not null
     and exists (
       select 1
       from public.programmes programme
       where programme.id = v_programme_id
         and programme.organization_id = v_account_organization_id
     ) then
    new.programme_id := v_programme_id;
  else
    new.programme_id := null;
  end if;

  return new;
end;
$$;

revoke execute on function private.populate_xp_transaction_programme_id()
  from public, anon, authenticated, service_role;

drop trigger if exists xp_transactions_populate_programme_id on public.xp_transactions;
create trigger xp_transactions_populate_programme_id
  before insert on public.xp_transactions
  for each row execute function private.populate_xp_transaction_programme_id();

update public.xp_transactions as xp_tx
set programme_id = (xp_tx.metadata ->> 'programmeId')::uuid
from public.xp_accounts account,
     public.programmes programme
where programme.id = (xp_tx.metadata ->> 'programmeId')::uuid
  and programme.organization_id = account.organization_id
  and xp_tx.xp_account_id = account.id
  and account.scope = 'organization'
  and xp_tx.programme_id is null
  and xp_tx.metadata ->> 'programmeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

create or replace function private.enforce_xp_account_issuance_controls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.xp_accounts%rowtype;
  v_period_start timestamptz;
  v_issued_period bigint;
  v_issued_user bigint;
  v_current_exposure numeric(14, 2);
  v_projected_exposure numeric(14, 2);
begin
  if new.direction <> 'earn' then
    return new;
  end if;

  select *
    into v_account
  from public.xp_accounts
  where id = new.xp_account_id
  for update;

  if not found or v_account.scope <> 'organization' then
    return new;
  end if;

  if new.award_scope is not null and exists (
    select 1
    from public.xp_transactions transaction
    where transaction.user_id = new.user_id
      and transaction.xp_account_id = new.xp_account_id
      and transaction.direction = 'earn'
      and transaction.award_scope = new.award_scope
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('xp-issuance:' || new.xp_account_id::text, 0));
  v_period_start := now() - make_interval(days => v_account.issuance_period_days);

  select coalesce(sum(amount), 0)
    into v_issued_period
  from public.xp_transactions
  where xp_account_id = new.xp_account_id
    and direction = 'earn'
    and created_at >= v_period_start;

  if v_account.issuance_cap_per_period is not null
     and v_issued_period + new.amount > v_account.issuance_cap_per_period then
    raise exception 'XP account period issuance cap reached. % XP remains.',
      greatest(v_account.issuance_cap_per_period - v_issued_period, 0);
  end if;

  select coalesce(sum(amount), 0)
    into v_issued_user
  from public.xp_transactions
  where xp_account_id = new.xp_account_id
    and user_id = new.user_id
    and direction = 'earn'
    and created_at >= v_period_start;

  if v_account.issuance_cap_per_user is not null
     and v_issued_user + new.amount > v_account.issuance_cap_per_user then
    raise exception 'XP account learner issuance cap reached. % XP remains.',
      greatest(v_account.issuance_cap_per_user - v_issued_user, 0);
  end if;

  if v_account.exposure_hard_threshold is not null then
    select coalesce(sum(balance_cached), 0) * v_account.accounting_value_per_unit
      into v_current_exposure
    from public.user_xp_balances
    where xp_account_id = new.xp_account_id;

    v_projected_exposure := v_current_exposure + new.amount * v_account.accounting_value_per_unit;
    if v_projected_exposure > v_account.exposure_hard_threshold then
      raise exception 'XP account exposure hard threshold reached. Estimated liability is %.',
        v_current_exposure;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_xp_account_issuance_controls()
  from public, anon, authenticated, service_role;

drop trigger if exists xp_transactions_enforce_issuance_controls on public.xp_transactions;
create trigger xp_transactions_enforce_issuance_controls
  before insert on public.xp_transactions
  for each row execute function private.enforce_xp_account_issuance_controls();

create or replace function private.sync_xp_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profile cascades remove the balance row before its ledger rows. There is
  -- no balance projection left to reverse during that same delete cascade.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.profiles where id = old.user_id) then
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform private.apply_xp_balance_delta(
      new.user_id,
      new.xp_account_id,
      case when new.direction = 'earn' then new.amount else -new.amount end
    );
  elsif tg_op = 'DELETE' then
    perform private.apply_xp_balance_delta(
      old.user_id,
      old.xp_account_id,
      case when old.direction = 'earn' then -old.amount else old.amount end
    );
  else
    perform private.apply_xp_balance_delta(
      old.user_id,
      old.xp_account_id,
      case when old.direction = 'earn' then -old.amount else old.amount end
    );
    perform private.apply_xp_balance_delta(
      new.user_id,
      new.xp_account_id,
      case when new.direction = 'earn' then new.amount else -new.amount end
    );
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.sync_xp_transaction_balance()
  from public, anon, authenticated, service_role;

create or replace function public.admin_update_xp_account_controls(
  p_xp_account_id uuid,
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
  v_account public.xp_accounts%rowtype;
  v_actor_id uuid := auth.uid();
begin
  select * into v_account
  from public.xp_accounts
  where id = p_xp_account_id
  for update;

  if not found then
    raise exception 'XP account not found.';
  end if;

  if v_account.scope <> 'organization'
     or v_account.organization_id is null
     or not public.current_user_can_manage_organization(v_account.organization_id) then
    raise exception 'Organisation XP account access is required.' using errcode = '42501';
  end if;

  if p_accounting_value_per_unit is null or p_accounting_value_per_unit < 0 then
    raise exception 'Accounting value per unit must be zero or greater.';
  end if;
  if p_issuance_period_days is null or p_issuance_period_days not between 1 and 366 then
    raise exception 'Issuance period must be between 1 and 366 days.';
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
  set accounting_value_per_unit = p_accounting_value_per_unit,
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
      'accountingValuePerUnit', p_accounting_value_per_unit,
      'issuancePeriodDays', p_issuance_period_days,
      'issuanceCapPerPeriod', p_issuance_cap_per_period,
      'issuanceCapPerUser', p_issuance_cap_per_user,
      'fundedRewardBudget', p_funded_reward_budget,
      'exposureWarningThreshold', p_exposure_warning_threshold,
      'exposureHardThreshold', p_exposure_hard_threshold
    )
  );

  return v_account;
end;
$$;

revoke execute on function public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric)
  from public, anon;
grant execute on function public.admin_update_xp_account_controls(uuid, numeric, integer, integer, integer, numeric, numeric, numeric)
  to authenticated;

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
  select coalesce(sum(amount) filter (where direction = 'earn'), 0),
         coalesce(sum(amount) filter (where direction = 'spend'), 0),
         coalesce(sum(amount) filter (where source_type = 'adjustment'), 0),
         coalesce(sum(amount) filter (where direction = 'earn' and created_at >= v_period_start), 0)
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

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values (
  'public', 'admin_update_xp_account_controls', 'p_xp_account_id uuid, p_accounting_value_per_unit numeric, p_issuance_period_days integer, p_issuance_cap_per_period integer, p_issuance_cap_per_user integer, p_funded_reward_budget numeric, p_exposure_warning_threshold numeric, p_exposure_hard_threshold numeric',
  'ADMIN_AUTHENTICATED', 'Organisation managers configuring their organisation XP issuance and exposure controls.',
  'Requires organisation management access; platform accounts and account ownership remain immutable through this path.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();

update private.rpc_security_classifications
set authorization_rule = 'Requires organisation management access and returns only the selected organisation account, including issuance, exposure, programme and learner summaries.',
    reviewed_at = now()
where function_schema = 'public'
  and function_name = 'admin_get_xp_account_overview'
  and identity_arguments = 'p_organization_id uuid';
