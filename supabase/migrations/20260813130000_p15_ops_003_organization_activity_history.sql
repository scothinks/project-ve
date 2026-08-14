create index if not exists audit_events_created_at_idx
  on public.audit_events(created_at desc);

create index if not exists audit_events_event_type_created_idx
  on public.audit_events(event_type, created_at desc);

create index if not exists audit_events_metadata_organization_created_idx
  on public.audit_events((metadata ->> 'organizationId'), created_at desc)
  where metadata ? 'organizationId';

create or replace function private.prevent_audit_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  raise exception 'Audit events are immutable.' using errcode = '42501';
end;
$$;

revoke execute on function private.prevent_audit_event_mutation() from public, anon, authenticated, service_role;

drop trigger if exists audit_events_prevent_update on public.audit_events;
create trigger audit_events_prevent_update
  before update on public.audit_events
  for each row execute function private.prevent_audit_event_mutation();

drop trigger if exists audit_events_prevent_delete on public.audit_events;
create trigger audit_events_prevent_delete
  before delete on public.audit_events
  for each row execute function private.prevent_audit_event_mutation();

create or replace function private.uuid_or_null(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then
    return null;
  end if;

  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke execute on function private.uuid_or_null(text) from public, anon, authenticated, service_role;

create or replace function private.redact_audit_json(p_value jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, private
as $$
declare
  v_result jsonb;
begin
  if p_value is null then
    return 'null'::jsonb;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    select coalesce(
      jsonb_object_agg(
        key,
        case
          when lower(key) ~ '(token|secret|password|email|phone|fulfillment|claim[_-]?data|payload|voucher|qr|code|url)'
            then '"[redacted]"'::jsonb
          else private.redact_audit_json(value)
        end
      ),
      '{}'::jsonb
    )
      into v_result
    from jsonb_each(p_value);

    return v_result;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(private.redact_audit_json(value)), '[]'::jsonb)
      into v_result
    from jsonb_array_elements(p_value);

    return v_result;
  end if;

  return p_value;
end;
$$;

revoke execute on function private.redact_audit_json(jsonb) from public, anon, authenticated, service_role;

create or replace function private.audit_event_organization_id(
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_id uuid;
  v_entity_uuid uuid := private.uuid_or_null(p_entity_id);
begin
  v_id := private.uuid_or_null(p_metadata ->> 'organizationId');
  if v_id is not null then
    return v_id;
  end if;

  case p_entity_type
    when 'organization' then
      return v_entity_uuid;
    when 'organization_invitation' then
      select invitation.organization_id into v_id
      from public.organization_invitations invitation
      where invitation.id = v_entity_uuid;
    when 'organization_membership' then
      select membership.organization_id into v_id
      from public.organization_memberships membership
      where membership.id = v_entity_uuid;
    when 'organization_unit' then
      select unit.organization_id into v_id
      from public.organization_units unit
      where unit.id = v_entity_uuid;
    when 'cohort' then
      select cohort.organization_id into v_id
      from public.cohorts cohort
      where cohort.id = v_entity_uuid;
    when 'programme' then
      select programme.organization_id into v_id
      from public.programmes programme
      where programme.id = v_entity_uuid;
    when 'course' then
      select course.organization_id into v_id
      from public.courses course
      where course.id = p_entity_id;
    when 'mission' then
      select mission.organization_id into v_id
      from public.missions mission
      where mission.id = p_entity_id;
    when 'reward' then
      select reward.organization_id into v_id
      from public.rewards reward
      where reward.id = p_entity_id;
    when 'reward_redemption' then
      select reward.organization_id into v_id
      from public.reward_redemptions redemption
      join public.rewards reward on reward.id = redemption.reward_id
      where redemption.id = v_entity_uuid;
    when 'xp_account' then
      select account.organization_id into v_id
      from public.xp_accounts account
      where account.id = v_entity_uuid;
    when 'assessment_version' then
      select assessment.organization_id into v_id
      from public.assessment_versions assessment
      where assessment.id = v_entity_uuid;
    when 'mission_proof' then
      select coalesce(proof.organization_id, mission.organization_id) into v_id
      from public.mission_proofs proof
      left join public.missions mission on mission.id = proof.mission_id
      where proof.user_id = private.uuid_or_null(p_metadata ->> 'userId')
        and proof.mission_id = p_metadata ->> 'missionId'
        and proof.award_scope = p_metadata ->> 'awardScope'
      limit 1;
  else
    v_id := null;
  end case;

  if v_id is null and nullif(p_metadata ->> 'programmeId', '') is not null then
    select programme.organization_id into v_id
    from public.programmes programme
    where programme.id = private.uuid_or_null(p_metadata ->> 'programmeId');
  end if;

  if v_id is null and nullif(p_metadata ->> 'missionId', '') is not null then
    select mission.organization_id into v_id
    from public.missions mission
    where mission.id = p_metadata ->> 'missionId';
  end if;

  if v_id is null and nullif(p_metadata ->> 'rewardId', '') is not null then
    select reward.organization_id into v_id
    from public.rewards reward
    where reward.id = p_metadata ->> 'rewardId';
  end if;

  return v_id;
end;
$$;

revoke execute on function private.audit_event_organization_id(text, text, text, jsonb) from public, anon, authenticated, service_role;

create or replace function private.audit_event_object_href(
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb
)
returns text
language sql
stable
set search_path = public, private
as $$
  select case
    when p_entity_type = 'organization' and private.uuid_or_null(p_entity_id) is not null then '/admin/organizations?organizationId=' || p_entity_id
    when p_entity_type = 'programme' and private.uuid_or_null(p_entity_id) is not null then '/admin/programmes/' || p_entity_id
    when p_entity_type = 'cohort' and private.uuid_or_null(p_entity_id) is not null then '/admin/cohorts/' || p_entity_id
    when p_entity_type = 'course' and nullif(p_entity_id, '') is not null then '/admin/courses/' || p_entity_id
    when p_entity_type = 'mission' and nullif(p_entity_id, '') is not null then '/admin/missions/' || p_entity_id
    when p_entity_type = 'reward' and nullif(p_entity_id, '') is not null then '/admin/rewards/' || p_entity_id
    when p_entity_type = 'reward_redemption' and private.uuid_or_null(p_entity_id) is not null then '/admin/redemptions?redemptionId=' || p_entity_id
    when p_entity_type = 'mission_proof' then '/admin/proofs'
    when p_entity_type = 'xp_account' and private.uuid_or_null(p_metadata ->> 'organizationId') is not null then '/admin/organizations?organizationId=' || (p_metadata ->> 'organizationId')
    when p_entity_type = 'assessment_version' and private.uuid_or_null(p_entity_id) is not null then '/admin/assessments/' || p_entity_id
    else null
  end;
$$;

revoke execute on function private.audit_event_object_href(text, text, jsonb) from public, anon, authenticated, service_role;

create or replace function private.audit_event_summary(
  p_event_type text,
  p_entity_type text,
  p_metadata jsonb
)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  return case p_event_type
    when 'organization_created' then 'Organisation created: ' || coalesce(p_metadata ->> 'name', 'unnamed organisation')
    when 'organization_updated' then 'Organisation details updated'
    when 'organization_profile_updated' then 'Organisation profile updated'
    when 'organization_plan_assigned' then 'Plan changed to ' || coalesce(p_metadata ->> 'planKey', 'unknown plan') || ' / ' || coalesce(p_metadata ->> 'billingStatus', 'unknown billing status')
    when 'organization_membership_upserted' then 'Membership changed for ' || coalesce(p_metadata ->> 'role', 'member') || ' role'
    when 'organization_invitation_created' then 'Invitation created for ' || coalesce(p_metadata ->> 'role', 'member') || ' role'
    when 'organization_invitation_accepted' then 'Invitation accepted'
    when 'organization_invitation_declined' then 'Invitation declined'
    when 'organization_invitation_revoked' then 'Invitation revoked'
    when 'organization_invitation_expired' then 'Invitation expired'
    when 'course_created' then 'Course created'
    when 'course_updated' then 'Course updated'
    when 'course_enabled' then 'Course published'
    when 'course_disabled' then 'Course unpublished'
    when 'course_completion_rules_updated' then 'Course completion rules updated'
    when 'course_lessons_reordered' then 'Course lesson order changed'
    when 'mission_created' then 'Mission created'
    when 'mission_updated' then 'Mission updated'
    when 'organization_mission_created' then 'Organisation mission created'
    when 'organization_mission_updated' then 'Organisation mission updated'
    when 'organization_mission_adapted' then 'Platform mission adapted'
    when 'organization_mission_published' then 'Organisation mission published'
    when 'programme_created' then 'Programme created'
    when 'programme_updated' then 'Programme updated'
    when 'programme_status_changed' then 'Programme status changed to ' || coalesce(p_metadata ->> 'status', 'unknown')
    when 'programme_assignments_replaced' then 'Programme assignments changed'
    when 'programme_assessment_delivery_updated' then 'Programme assessment delivery updated'
    when 'programme_completion_rules_updated' then 'Programme completion rules updated'
    when 'reward_lms_ownership_updated' then 'Reward ownership changed'
    when 'organization_reward_created' then 'Organisation reward created'
    when 'organization_reward_updated' then 'Organisation reward updated'
    when 'organization_reward_published' then 'Organisation reward published'
    when 'reward_redemption_created' then 'Reward claim created'
    when 'reward_redemption_fulfilled' then 'Reward claim fulfilled'
    when 'reward_redemption_refunded' then 'Reward claim refunded'
    when 'organization_reward_redemption_created' then 'Organisation reward claim created'
    when 'organization_reward_redemption_fulfilled' then 'Organisation reward claim fulfilled'
    when 'organization_reward_redemption_refunded' then 'Organisation reward claim refunded'
    when 'organization_reward_redemption_claim_updated' then 'Organisation reward claim state changed'
    when 'reward_inventory_reallocated' then 'Reward inventory reallocated'
    when 'xp_account_adjusted' then 'Points adjusted: ' || coalesce(p_metadata ->> 'direction', 'change') || ' ' || coalesce(p_metadata ->> 'amount', '0')
    when 'xp_account_issuance_controls_updated' then 'Points issuance controls updated'
    when 'mission_proof_approved' then 'Mission proof approved'
    when 'mission_proof_rejected' then 'Mission proof rejected'
    when 'lms_intervention_created' then 'Learner intervention created'
    when 'lms_intervention_status_updated' then 'Learner intervention status updated'
    when 'instructor_scoped_notification_sent' then 'Instructor reminder sent'
    when 'assessment_version_created' then 'Assessment draft created'
    when 'assessment_version_updated' then 'Assessment draft updated'
    when 'assessment_version_published' then 'Assessment published'
    else initcap(replace(coalesce(p_event_type, p_entity_type || '_activity'), '_', ' '))
  end;
end;
$$;

revoke execute on function private.audit_event_summary(text, text, jsonb) from public, anon, authenticated, service_role;

create or replace function private.audit_event_details(p_metadata jsonb)
returns jsonb
language sql
stable
set search_path = public, private
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label',
        initcap(regexp_replace(key, '([a-z])([A-Z])', '\1 \2', 'g')),
        'value',
        case
          when jsonb_typeof(value) in ('object', 'array') then '[redacted structured value]'
          else trim(both '"' from value::text)
        end
      )
      order by key
    ),
    '[]'::jsonb
  )
  from jsonb_each(private.redact_audit_json(coalesce(p_metadata, '{}'::jsonb)))
  where key not in ('organizationId', 'before', 'after', 'beforeState', 'afterState')
    and jsonb_typeof(value) <> 'null';
$$;

revoke execute on function private.audit_event_details(jsonb) from public, anon, authenticated, service_role;

create or replace function private.audit_event_change_set(p_metadata jsonb)
returns jsonb
language sql
stable
set search_path = public, private
as $$
  select jsonb_build_object(
    'before',
    private.redact_audit_json(coalesce(p_metadata -> 'before', p_metadata -> 'beforeState', '{}'::jsonb)),
    'after',
    private.redact_audit_json(coalesce(p_metadata -> 'after', p_metadata -> 'afterState', '{}'::jsonb))
  );
$$;

revoke execute on function private.audit_event_change_set(jsonb) from public, anon, authenticated, service_role;

create or replace function private.audit_reward_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_changed boolean := false;
  v_event_type text;
begin
  if (tg_op = 'INSERT' and new.organization_id is null)
     or (tg_op = 'UPDATE' and coalesce(new.organization_id, old.organization_id) is null) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_changed := true;
    v_event_type := case when new.status = 'published' then 'organization_reward_published' else 'organization_reward_created' end;
  elsif tg_op = 'UPDATE' then
    v_changed :=
      old.title is distinct from new.title
      or old.cost_xp is distinct from new.cost_xp
      or old.status is distinct from new.status
      or old.is_enabled is distinct from new.is_enabled
      or old.fulfillment_type is distinct from new.fulfillment_type
      or old.owner_scope is distinct from new.owner_scope
      or old.xp_account_id is distinct from new.xp_account_id;
    v_event_type := case
      when old.status is distinct from new.status and new.status = 'published' then 'organization_reward_published'
      else 'organization_reward_updated'
    end;
  end if;

  if v_changed then
    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (
      v_actor_id,
      v_event_type,
      'reward',
      new.id,
      jsonb_build_object(
        'organizationId', new.organization_id,
        'title', new.title,
        'before', case when tg_op = 'UPDATE' then jsonb_build_object(
          'costXp', old.cost_xp,
          'status', old.status,
          'isEnabled', old.is_enabled,
          'fulfillmentType', old.fulfillment_type,
          'xpAccountId', old.xp_account_id
        ) else '{}'::jsonb end,
        'after', jsonb_build_object(
          'costXp', new.cost_xp,
          'status', new.status,
          'isEnabled', new.is_enabled,
          'fulfillmentType', new.fulfillment_type,
          'xpAccountId', new.xp_account_id
        )
      )
    );
  end if;

  return new;
end;
$$;

revoke execute on function private.audit_reward_change() from public, anon, authenticated, service_role;

drop trigger if exists rewards_audit_organization_activity on public.rewards;
create trigger rewards_audit_organization_activity
  after insert or update of title, cost_xp, status, is_enabled, fulfillment_type, owner_scope, xp_account_id, organization_id
  on public.rewards
  for each row execute function private.audit_reward_change();

create or replace function private.audit_reward_redemption_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid;
begin
  select reward.organization_id into v_organization_id
  from public.rewards reward
  where reward.id = coalesce(new.reward_id, old.reward_id);

  if v_organization_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (
      v_actor_id,
      'organization_reward_redemption_created',
      'reward_redemption',
      new.id::text,
      jsonb_build_object(
        'organizationId', v_organization_id,
        'rewardId', new.reward_id,
        'userId', new.user_id,
        'claimState', new.claim_state,
        'xpCost', new.xp_cost_at_redemption
      )
    );
  elsif old.claim_state is distinct from new.claim_state
     or old.status is distinct from new.status
     or old.fulfilled_at is distinct from new.fulfilled_at
     or old.refunded_at is distinct from new.refunded_at then
    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (
      v_actor_id,
      case
        when new.claim_state = 'fulfilled' then 'organization_reward_redemption_fulfilled'
        when new.claim_state = 'refunded' then 'organization_reward_redemption_refunded'
        else 'organization_reward_redemption_claim_updated'
      end,
      'reward_redemption',
      new.id::text,
      jsonb_build_object(
        'organizationId', v_organization_id,
        'rewardId', new.reward_id,
        'userId', new.user_id,
        'before', jsonb_build_object('claimState', old.claim_state, 'status', old.status),
        'after', jsonb_build_object('claimState', new.claim_state, 'status', new.status),
        'xpCost', new.xp_cost_at_redemption
      )
    );
  end if;

  return new;
end;
$$;

revoke execute on function private.audit_reward_redemption_change() from public, anon, authenticated, service_role;

drop trigger if exists reward_redemptions_audit_organization_activity on public.reward_redemptions;
create trigger reward_redemptions_audit_organization_activity
  after insert or update of claim_state, status, fulfilled_at, refunded_at
  on public.reward_redemptions
  for each row execute function private.audit_reward_redemption_change();

create or replace function private.audit_assessment_version_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_event_type text;
begin
  if (tg_op = 'INSERT' and new.organization_id is null)
     or (tg_op = 'UPDATE' and coalesce(new.organization_id, old.organization_id) is null) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_event_type := case when new.status = 'published' then 'assessment_version_published' else 'assessment_version_created' end;
  elsif old.title is not distinct from new.title
    and old.status is not distinct from new.status
    and old.xp_award is not distinct from new.xp_award then
    return new;
  else
    v_event_type := case
      when old.status is distinct from new.status and new.status = 'published' then 'assessment_version_published'
      else 'assessment_version_updated'
    end;
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    v_event_type,
    'assessment_version',
    new.id::text,
    jsonb_build_object(
      'organizationId', new.organization_id,
      'title', new.title,
      'before', case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'xpAward', old.xp_award) else '{}'::jsonb end,
      'after', jsonb_build_object('status', new.status, 'xpAward', new.xp_award)
    )
  );

  return new;
end;
$$;

revoke execute on function private.audit_assessment_version_change() from public, anon, authenticated, service_role;

drop trigger if exists assessment_versions_audit_organization_activity on public.assessment_versions;
create trigger assessment_versions_audit_organization_activity
  after insert or update of title, status, xp_award, organization_id
  on public.assessment_versions
  for each row execute function private.audit_assessment_version_change();

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
    raise exception 'You cannot manage this organisation XP account.' using errcode = '42501';
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
  ) then
    raise exception 'The target learner is not an active organisation member.';
  end if;

  select coalesce(balance, 0) into v_before_balance
  from public.user_xp_account_balances
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

  select coalesce(balance, 0) into v_after_balance
  from public.user_xp_account_balances
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

  return jsonb_build_object('transactionId', v_transaction_id, 'xpAccountId', v_account.id);
end;
$$;

create or replace function public.admin_get_organization_activity(
  p_organization_id uuid default null,
  p_actor_user_id uuid default null,
  p_event_type text default null,
  p_entity_type text default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_can_read_all boolean := false;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  v_can_read_all := public.current_user_is_admin();

  if p_organization_id is null and not v_can_read_all then
    raise exception 'Organisation is required.' using errcode = '42501';
  end if;

  if p_organization_id is not null
     and not v_can_read_all
     and not public.current_user_has_organization_role(
       p_organization_id,
       array['organisation_owner', 'organisation_admin']::public.organization_role_key[]
     ) then
    raise exception 'Organisation activity access required.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'events',
    coalesce((
      with scoped_events as (
        select
          event.id,
          event.actor_user_id,
          event.event_type,
          event.entity_type,
          event.entity_id,
          event.metadata,
          event.created_at,
          private.audit_event_organization_id(event.event_type, event.entity_type, event.entity_id, event.metadata) as organization_id
        from public.audit_events event
        where (p_actor_user_id is null or event.actor_user_id = p_actor_user_id)
          and (nullif(trim(coalesce(p_event_type, '')), '') is null or event.event_type = p_event_type)
          and (nullif(trim(coalesce(p_entity_type, '')), '') is null or event.entity_type = p_entity_type)
          and (p_date_from is null or event.created_at >= p_date_from)
          and (p_date_to is null or event.created_at <= p_date_to)
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', scoped.id,
          'createdAt', scoped.created_at,
          'organizationId', scoped.organization_id,
          'organizationName', organization.name,
          'actorUserId', scoped.actor_user_id,
          'actorName', coalesce(actor.display_name, 'System'),
          'eventType', scoped.event_type,
          'actionLabel', initcap(replace(scoped.event_type, '_', ' ')),
          'entityType', scoped.entity_type,
          'entityId', scoped.entity_id,
          'objectLabel', coalesce(scoped.metadata ->> 'title', scoped.metadata ->> 'name', scoped.entity_type || ' ' || left(scoped.entity_id, 8)),
          'objectHref', private.audit_event_object_href(scoped.entity_type, scoped.entity_id, scoped.metadata),
          'summary', private.audit_event_summary(scoped.event_type, scoped.entity_type, scoped.metadata),
          'details', private.audit_event_details(scoped.metadata),
          'changes', private.audit_event_change_set(scoped.metadata),
          'hasChanges', coalesce(scoped.metadata ? 'before', false) or coalesce(scoped.metadata ? 'after', false) or coalesce(scoped.metadata ? 'beforeState', false) or coalesce(scoped.metadata ? 'afterState', false)
        )
        order by scoped.created_at desc
      )
      from (
        select *
        from scoped_events
        where organization_id is not null
          and (p_organization_id is null or organization_id = p_organization_id)
          and (v_can_read_all or organization_id = p_organization_id)
        order by created_at desc
        limit v_limit
      ) scoped
      left join public.organizations organization on organization.id = scoped.organization_id
      left join public.profiles actor on actor.id = scoped.actor_user_id
    ), '[]'::jsonb),
    'filters',
    coalesce((
      with scoped_events as (
        select
          event.actor_user_id,
          event.event_type,
          event.entity_type,
          private.audit_event_organization_id(event.event_type, event.entity_type, event.entity_id, event.metadata) as organization_id
        from public.audit_events event
      )
      select jsonb_build_object(
        'eventTypes', coalesce(jsonb_agg(distinct event_type) filter (where event_type is not null), '[]'::jsonb),
        'entityTypes', coalesce(jsonb_agg(distinct entity_type) filter (where entity_type is not null), '[]'::jsonb),
        'actors', coalesce(jsonb_agg(distinct jsonb_build_object('id', actor_user_id, 'name', coalesce(actor.display_name, 'System'))) filter (where actor_user_id is not null), '[]'::jsonb)
      )
      from scoped_events
      left join public.profiles actor on actor.id = scoped_events.actor_user_id
      where organization_id is not null
        and (p_organization_id is null or organization_id = p_organization_id)
        and (v_can_read_all or organization_id = p_organization_id)
    ), jsonb_build_object('eventTypes', '[]'::jsonb, 'entityTypes', '[]'::jsonb, 'actors', '[]'::jsonb))
  );
end;
$$;

revoke execute on function public.admin_get_organization_activity(uuid, uuid, text, text, timestamptz, timestamptz, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_organization_activity(uuid, uuid, text, text, timestamptz, timestamptz, integer)
  to authenticated, service_role;

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
    'admin_get_organization_activity',
    'p_organization_id uuid, p_actor_user_id uuid, p_event_type text, p_entity_type text, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_limit integer',
    'ADMIN_AUTHENTICATED',
    'Platform and organisation-owner/admin activity history inspection.',
    'Requires auth.uid(); platform admins may inspect all organisations, while organisation owners/admins must provide and can only read their own organisation activity. Raw metadata is normalized and redacted before return.',
    array['authenticated', 'service_role']
  ),
  (
    'private',
    'prevent_audit_event_mutation',
    '',
    'TRIGGER_ONLY',
    'Audit event immutability enforcement.',
    'Runs only as an audit_events table trigger and raises on update or delete.',
    array[]::text[]
  ),
  (
    'private',
    'audit_reward_change',
    '',
    'TRIGGER_ONLY',
    'Organisation reward audit coverage.',
    'Runs only as a rewards table trigger and records organisation reward configuration and publish changes with redacted before/after context.',
    array[]::text[]
  ),
  (
    'private',
    'audit_reward_redemption_change',
    '',
    'TRIGGER_ONLY',
    'Organisation reward claim audit coverage.',
    'Runs only as a reward_redemptions table trigger and records organisation claim creation and fulfilment state changes.',
    array[]::text[]
  ),
  (
    'private',
    'audit_assessment_version_change',
    '',
    'TRIGGER_ONLY',
    'Organisation assessment audit coverage.',
    'Runs only as an assessment_versions table trigger and records organisation assessment draft and publish changes.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
