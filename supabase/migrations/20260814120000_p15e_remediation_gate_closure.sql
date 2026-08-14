create or replace function private.resolve_organization_entitlements_unchecked(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entitlements jsonb;
  v_overrides jsonb;
  v_grant record;
begin
  select plan.entitlements
    into v_entitlements
  from public.organization_plan_assignments assignment
  join public.organization_plans plan
    on plan.key = assignment.plan_key
  where assignment.organization_id = p_organization_id
    and assignment.ended_at is null
    and plan.status = 'active'
  order by assignment.starts_at desc
  limit 1;

  if v_entitlements is null then
    select entitlements
      into v_entitlements
    from public.organization_plans
    where key = 'starter';
  end if;

  v_entitlements := coalesce(v_entitlements, '{}'::jsonb);

  for v_grant in
    select
      temp_grant.grant_type,
      temp_grant.entitlement_delta,
      plan.entitlements as source_plan_entitlements
    from public.organization_temporary_entitlement_grants temp_grant
    left join public.organization_plans plan
      on plan.key = temp_grant.source_plan_key
      and plan.status = 'active'
    where temp_grant.organization_id = p_organization_id
      and temp_grant.starts_at <= now()
      and (temp_grant.expires_at is null or temp_grant.expires_at > now())
      and temp_grant.revoked_at is null
      and temp_grant.grant_type <> 'additive_allocation'::public.organization_temporary_entitlement_grant_type
    order by temp_grant.starts_at asc, temp_grant.created_at asc, temp_grant.id asc
  loop
    if v_grant.source_plan_entitlements is not null then
      v_entitlements := private.merge_organization_entitlement_delta(
        v_entitlements,
        v_grant.source_plan_entitlements,
        false
      );
    end if;

    v_entitlements := private.merge_organization_entitlement_delta(
      v_entitlements,
      v_grant.entitlement_delta,
      false
    );
  end loop;

  for v_grant in
    select temp_grant.entitlement_delta
    from public.organization_temporary_entitlement_grants temp_grant
    where temp_grant.organization_id = p_organization_id
      and temp_grant.starts_at <= now()
      and (temp_grant.expires_at is null or temp_grant.expires_at > now())
      and temp_grant.revoked_at is null
      and temp_grant.grant_type = 'additive_allocation'::public.organization_temporary_entitlement_grant_type
    order by temp_grant.starts_at asc, temp_grant.created_at asc, temp_grant.id asc
  loop
    v_entitlements := private.merge_organization_entitlement_delta(
      v_entitlements,
      v_grant.entitlement_delta,
      true
    );
  end loop;

  select override.entitlements
    into v_overrides
  from public.organization_entitlement_overrides override
  where override.organization_id = p_organization_id
    and override.ended_at is null
  order by override.starts_at desc
  limit 1;

  v_entitlements := private.merge_organization_entitlement_delta(
    v_entitlements,
    coalesce(v_overrides, '{}'::jsonb),
    false
  );

  return private.apply_organization_entitlement_safety(v_entitlements);
end;
$$;

revoke execute on function private.resolve_organization_entitlements_unchecked(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.admin_get_lms_reporting(
  p_organization_id uuid default null,
  p_programme_id uuid default null,
  p_cohort_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_mission_completion jsonb;
  v_reward_usage jsonb;
  v_mission_awards integer;
  v_reward_redemptions integer;
begin
  v_result := public.admin_get_lms_reporting(
    p_organization_id,
    p_programme_id,
    p_cohort_id,
    null::uuid,
    p_limit
  );

  if p_programme_id is null then
    return v_result;
  end if;

  select coalesce(jsonb_agg(mission order by mission ->> 'title'), '[]'::jsonb)
    into v_mission_completion
  from jsonb_array_elements(coalesce(v_result -> 'missionCompletion', '[]'::jsonb)) mission
  where exists (
    select 1
    from public.programme_missions programme_mission
    where programme_mission.programme_id = p_programme_id
      and programme_mission.mission_id = mission ->> 'missionId'
  );

  select coalesce(sum((mission ->> 'awards')::integer), 0)
    into v_mission_awards
  from jsonb_array_elements(coalesce(v_mission_completion, '[]'::jsonb)) mission;

  select coalesce(jsonb_agg(reward order by reward ->> 'title'), '[]'::jsonb)
    into v_reward_usage
  from jsonb_array_elements(coalesce(v_result -> 'rewardUsage', '[]'::jsonb)) reward
  where exists (
    select 1
    from public.programme_rewards programme_reward
    where programme_reward.programme_id = p_programme_id
      and programme_reward.reward_id = reward ->> 'rewardId'
  )
  or exists (
    select 1
    from public.rewards scoped_reward
    where scoped_reward.id = reward ->> 'rewardId'
      and scoped_reward.sponsored_programme_id = p_programme_id
  );

  select coalesce(sum((reward ->> 'redemptions')::integer), 0)
    into v_reward_redemptions
  from jsonb_array_elements(coalesce(v_reward_usage, '[]'::jsonb)) reward;

  return jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          v_result,
          '{missionCompletion}',
          coalesce(v_mission_completion, '[]'::jsonb),
          true
        ),
        '{rewardUsage}',
        coalesce(v_reward_usage, '[]'::jsonb),
        true
      ),
      '{summary,missionAwards}',
      to_jsonb(coalesce(v_mission_awards, 0)),
      true
    ),
    '{summary,rewardRedemptions}',
    to_jsonb(coalesce(v_reward_redemptions, 0)),
    true
  );
end;
$$;

revoke execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_lms_reporting(uuid, uuid, uuid, integer)
  to authenticated, service_role;

create or replace function public.admin_review_mission_proof_submission(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_status public.review_status,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_required_fields text[];
  v_valid boolean := false;
  v_requirement_mode text := 'all';
  v_organization_id uuid;
  v_programme_id uuid;
  v_programme_mission_id text;
begin
  if v_actor_id is null then
    raise exception 'Only an admin can review mission proof.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected.';
  end if;

  select organization_id, programme_id, programme_mission_id
    into v_organization_id, v_programme_id, v_programme_mission_id
  from public.mission_proofs
  where user_id = p_user_id
    and mission_id = p_mission_id
    and award_scope = p_award_scope
  order by created_at asc
  limit 1;

  if not found then
    raise exception 'Mission proof submission was not found.';
  end if;

  if v_organization_id is null then
    if not public.current_user_is_admin() then
      raise exception 'Only a platform admin can review public mission proof.';
    end if;
  elsif not (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(
      v_organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'reviewer'
      ]::public.organization_role_key[]
    )
    or public.current_user_can_act_on_scoped_learner(v_organization_id, p_user_id)
  ) then
    raise exception 'Only organization proof reviewers can review this mission proof.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found or v_mission.validation_type <> 'proof_upload' then
    raise exception 'Mission proof submission was not found.';
  end if;

  update public.mission_proofs
  set status = p_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '') else null end,
      updated_at = now()
  where user_id = p_user_id
    and mission_id = p_mission_id
    and award_scope = p_award_scope;

  if not found then
    raise exception 'Mission proof submission was not found.';
  end if;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_proof_' || p_status::text,
    'mission_proof',
    p_user_id::text || ':' || p_mission_id || ':' || p_award_scope,
    jsonb_build_object(
      'userId', p_user_id,
      'missionId', p_mission_id,
      'awardScope', p_award_scope,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id,
      'rejectionReason', p_rejection_reason
    )
  );

  if p_status = 'rejected' then
    return jsonb_build_object('status', 'rejected');
  end if;

  select array_agg(value::text)
    into v_required_fields
    from jsonb_array_elements_text(
      coalesce(
        v_mission.validation_config -> 'requiredFields',
        v_mission.validation_config -> 'requiredProofFields',
        '[]'::jsonb
      )
    ) as value;

  v_requirement_mode := coalesce(
    v_mission.validation_config ->> 'requirementMode',
    v_mission.validation_config ->> 'proofRequirementMode',
    'all'
  );

  v_valid := public.mission_proof_fields_satisfy(
    coalesce(v_required_fields, '{}'::text[]),
    v_requirement_mode,
    p_user_id,
    p_mission_id,
    p_award_scope,
    array['approved']::text[]
  );

  if not coalesce(v_valid, false) then
    return jsonb_build_object('status', 'approved_pending_required_fields');
  end if;

  return public.grant_mission_award(
    p_user_id,
    v_mission.id,
    p_award_scope,
    jsonb_build_object(
      'reviewedBy', v_actor_id,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id
    )
  );
end;
$$;

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
  v_actor_id uuid := auth.uid();
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
      'before', jsonb_build_object(
        'accountingValuePerUnit', v_before.accounting_value_per_unit,
        'issuancePeriodDays', v_before.issuance_period_days,
        'issuanceCapPerPeriod', v_before.issuance_cap_per_period,
        'issuanceCapPerUser', v_before.issuance_cap_per_user,
        'fundedRewardBudget', v_before.funded_reward_budget,
        'exposureWarningThreshold', v_before.exposure_warning_threshold,
        'exposureHardThreshold', v_before.exposure_hard_threshold
      ),
      'after', jsonb_build_object(
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
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_account public.xp_accounts%rowtype;
  v_before_balance integer := 0;
  v_after_balance integer := 0;
  v_direction public.xp_direction := coalesce(p_direction, 'earn'::public.xp_direction);
  v_source_id text := 'org-adjustment:' || gen_random_uuid()::text;
  v_transaction_id uuid;
begin
  if v_actor_id is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
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

  select coalesce(balance_cached, 0) into v_before_balance
  from public.user_xp_balances
  where user_id = p_target_user_id
    and xp_account_id = v_account.id
  for update;
  v_before_balance := coalesce(v_before_balance, 0);

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

  select coalesce(balance_cached, 0) into v_after_balance
  from public.user_xp_balances
  where user_id = p_target_user_id
    and xp_account_id = v_account.id;
  v_after_balance := coalesce(v_after_balance, 0);

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'xp_account_adjusted',
    'xp_account',
    v_account.id::text,
    jsonb_build_object(
      'organizationId', v_account.organization_id,
      'targetUserId', p_target_user_id,
      'amount', p_amount,
      'direction', v_direction,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'transactionId', v_transaction_id,
      'before', jsonb_build_object('balance', v_before_balance),
      'after', jsonb_build_object('balance', v_after_balance)
    )
  );

  return jsonb_build_object(
    'transactionId', v_transaction_id,
    'xpAccountId', v_account.id,
    'beforeBalance', v_before_balance,
    'afterBalance', v_after_balance
  );
end;
$$;

revoke execute on function public.enforce_organization_unit_boundaries() from public, anon, authenticated, service_role;
revoke execute on function public.enforce_organization_unit_member_boundaries() from public, anon, authenticated, service_role;
revoke execute on function public.enforce_cohort_unit_boundaries() from public, anon, authenticated, service_role;

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
    'enforce_organization_unit_boundaries',
    '',
    'TRIGGER_ONLY',
    'Organisation unit integrity trigger.',
    'Runs only from organization_units triggers to enforce same-organisation parentage and shallow unit depth.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_organization_unit_member_boundaries',
    '',
    'TRIGGER_ONLY',
    'Organisation unit member integrity trigger.',
    'Runs only from organization_unit_members triggers to keep unit member rows inside their organisation membership boundary.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_cohort_unit_boundaries',
    '',
    'TRIGGER_ONLY',
    'Cohort unit integrity trigger.',
    'Runs only from cohort_units triggers to keep cohort-unit associations inside one organisation.',
    array[]::text[]
  ),
  (
    'public',
    'current_user_can_read_unit_learner',
    'p_organization_id uuid, p_user_id uuid',
    'ADMIN_AUTHENTICATED',
    'Authenticated app and reporting scopes checking whether the caller can read a learner through shared unit supervision.',
    'Uses auth.uid(); allows organisation audience readers or active supervisor-capable unit members sharing a unit with the target learner.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_act_on_scoped_learner',
    'p_organization_id uuid, p_user_id uuid',
    'ADMIN_AUTHENTICATED',
    'Authenticated instructor and intervention scopes checking whether the caller may act on a learner through organisation management or shared unit supervision.',
    'Uses auth.uid(); allows platform/org audience managers or active instructor unit members sharing a unit with the target learner.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_get_lms_reporting',
    'p_organization_id uuid, p_programme_id uuid, p_cohort_id uuid, p_limit integer',
    'ADMIN_AUTHENTICATED',
    'Compatibility reporting RPC for the original P1 LMS reporting contract.',
    'Requires auth.uid() and delegates to the unit-aware reporting RPC with no unit filter.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'reconcile_organization_ai_usage',
    'p_usage_record_id uuid, p_status text, p_actual_provider_model text, p_actual_provider_usage jsonb, p_actual_provider_cost numeric, p_actual_internal_cost numeric, p_final_charged_units numeric, p_failure_code text, p_failed_job_charge_policy text, p_metadata jsonb',
    'SERVICE_ROLE_ONLY',
    'Trusted server-side AI usage reconciliation workflow.',
    'Requires service_role; reserved organisation AI usage records are released or charged once with audit history after provider/job outcome is known.',
    array['service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
