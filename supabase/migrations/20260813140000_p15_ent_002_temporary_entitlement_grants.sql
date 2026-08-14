do $$ begin
  create type public.organization_temporary_entitlement_grant_type as enum (
    'plan_trial',
    'temporary_plan',
    'granular_override',
    'additive_allocation'
  );
exception when duplicate_object then null;
end $$;

create or replace function private.organization_entitlements_are_valid(
  p_entitlements jsonb,
  p_require_all boolean default true
)
returns boolean
language plpgsql
immutable
set search_path = public, private
as $$
declare
  v_required_keys text[] := array[
    'max_courses',
    'max_total_lessons',
    'allowed_lesson_block_types',
    'max_storage_bytes',
    'ai_authoring_enabled',
    'max_active_missions',
    'allowed_mission_types',
    'allowed_mission_reward_modes',
    'max_xp_accounts',
    'max_active_rewards',
    'allowed_reward_fulfillment_types',
    'max_open_reward_claims',
    'max_fulfilled_reward_claims_per_month',
    'assessment_capability',
    'reporting_level'
  ];
  v_optional_keys text[] := array[
    'ai_monthly_allocation',
    'ai_temporary_allocation',
    'ai_top_up_allocation',
    'ai_warning_threshold',
    'ai_hard_limit',
    'ai_user_rate_limit_per_day',
    'ai_organization_concurrency_limit',
    'allowed_ai_operation_types',
    'allowed_ai_roles'
  ];
  v_key text;
begin
  if p_entitlements is null or jsonb_typeof(p_entitlements) <> 'object' then
    return false;
  end if;

  if p_require_all then
    foreach v_key in array v_required_keys loop
      if not p_entitlements ? v_key then
        return false;
      end if;
    end loop;
  end if;

  for v_key in select jsonb_object_keys(p_entitlements) loop
    if v_key <> all(v_required_keys) and v_key <> all(v_optional_keys) then
      return false;
    end if;

    if v_key in (
      'max_courses',
      'max_total_lessons',
      'max_storage_bytes',
      'max_active_missions',
      'max_xp_accounts',
      'max_active_rewards',
      'max_open_reward_claims',
      'max_fulfilled_reward_claims_per_month',
      'ai_monthly_allocation',
      'ai_temporary_allocation',
      'ai_top_up_allocation',
      'ai_warning_threshold',
      'ai_hard_limit',
      'ai_user_rate_limit_per_day',
      'ai_organization_concurrency_limit'
    ) then
      if jsonb_typeof(p_entitlements -> v_key) <> 'number'
         or (p_entitlements ->> v_key)::numeric < 0 then
        return false;
      end if;
    elsif v_key = 'ai_authoring_enabled' then
      if jsonb_typeof(p_entitlements -> v_key) <> 'boolean' then
        return false;
      end if;
    elsif v_key in (
      'allowed_lesson_block_types',
      'allowed_mission_types',
      'allowed_mission_reward_modes',
      'allowed_reward_fulfillment_types',
      'allowed_ai_operation_types',
      'allowed_ai_roles'
    ) then
      if jsonb_typeof(p_entitlements -> v_key) <> 'array' then
        return false;
      end if;
    elsif v_key in ('assessment_capability', 'reporting_level') then
      if jsonb_typeof(p_entitlements -> v_key) <> 'string'
         or length(trim(p_entitlements ->> v_key)) = 0 then
        return false;
      end if;
    end if;
  end loop;

  return true;
exception when others then
  return false;
end;
$$;

revoke execute on function private.organization_entitlements_are_valid(jsonb, boolean)
  from public, anon, authenticated, service_role;

create table if not exists public.organization_temporary_entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  grant_type public.organization_temporary_entitlement_grant_type not null,
  source_plan_key text references public.organization_plans(key),
  entitlement_delta jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  expired_audited_at timestamptz,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_temporary_entitlement_grants_has_capability
    check (source_plan_key is not null or entitlement_delta <> '{}'::jsonb),
  constraint organization_temporary_entitlement_grants_delta_valid
    check (private.organization_entitlements_are_valid(entitlement_delta, false)),
  constraint organization_temporary_entitlement_grants_expiry_order
    check (expires_at is null or expires_at > starts_at),
  constraint organization_temporary_entitlement_grants_revoked_order
    check (revoked_at is null or revoked_at >= starts_at)
);

create index if not exists organization_temporary_entitlement_grants_active_idx
  on public.organization_temporary_entitlement_grants(organization_id, starts_at, expires_at)
  where revoked_at is null;

create index if not exists organization_temporary_entitlement_grants_expiry_idx
  on public.organization_temporary_entitlement_grants(expires_at)
  where revoked_at is null and expired_audited_at is null;

drop trigger if exists organization_temporary_entitlement_grants_set_updated_at
  on public.organization_temporary_entitlement_grants;
create trigger organization_temporary_entitlement_grants_set_updated_at
  before update on public.organization_temporary_entitlement_grants
  for each row execute function public.set_updated_at();

alter table public.organization_temporary_entitlement_grants enable row level security;

drop policy if exists "Temporary entitlement grants are readable by organization managers"
  on public.organization_temporary_entitlement_grants;
create policy "Temporary entitlement grants are readable by organization managers"
  on public.organization_temporary_entitlement_grants for select
  using (
    public.current_user_is_admin()
    or public.current_user_can_manage_organization(organization_id)
  );

revoke all on public.organization_temporary_entitlement_grants from anon, authenticated;
grant select on public.organization_temporary_entitlement_grants to authenticated;
grant all on public.organization_temporary_entitlement_grants to service_role;

create or replace function private.organization_entitlement_number(
  p_entitlements jsonb,
  p_key text
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_entitlements ? p_key and jsonb_typeof(p_entitlements -> p_key) = 'number' then
    return greatest(0, (p_entitlements ->> p_key)::numeric);
  end if;

  return 0;
exception when others then
  return 0;
end;
$$;

revoke execute on function private.organization_entitlement_number(jsonb, text)
  from public, anon, authenticated, service_role;

create or replace function private.merge_organization_entitlement_delta(
  p_current jsonb,
  p_delta jsonb,
  p_additive boolean default false
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result jsonb := coalesce(p_current, '{}'::jsonb);
  v_delta jsonb := coalesce(p_delta, '{}'::jsonb);
  v_numeric_additive_keys text[] := array[
    'max_courses',
    'max_total_lessons',
    'max_storage_bytes',
    'max_active_missions',
    'max_xp_accounts',
    'max_active_rewards',
    'max_open_reward_claims',
    'max_fulfilled_reward_claims_per_month',
    'ai_monthly_allocation',
    'ai_temporary_allocation',
    'ai_top_up_allocation'
  ];
  v_key text;
  v_value jsonb;
  v_sum numeric;
begin
  if jsonb_typeof(v_result) <> 'object' or jsonb_typeof(v_delta) <> 'object' then
    return v_result;
  end if;

  for v_key, v_value in select key, value from jsonb_each(v_delta) loop
    if p_additive
       and v_key = any(v_numeric_additive_keys)
       and jsonb_typeof(v_value) = 'number' then
      v_sum := private.organization_entitlement_number(v_result, v_key) + (v_value #>> '{}')::numeric;
      v_result := jsonb_set(v_result, array[v_key], to_jsonb(v_sum), true);
    else
      v_result := jsonb_set(v_result, array[v_key], v_value, true);
    end if;
  end loop;

  return v_result;
end;
$$;

revoke execute on function private.merge_organization_entitlement_delta(jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.apply_organization_entitlement_safety(
  p_entitlements jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result jsonb := coalesce(p_entitlements, '{}'::jsonb);
  v_ai_allocation numeric;
begin
  if jsonb_typeof(v_result) <> 'object' then
    return '{}'::jsonb;
  end if;

  v_ai_allocation :=
    private.organization_entitlement_number(v_result, 'ai_monthly_allocation')
    + private.organization_entitlement_number(v_result, 'ai_temporary_allocation')
    + private.organization_entitlement_number(v_result, 'ai_top_up_allocation');

  if coalesce((v_result ->> 'ai_authoring_enabled')::boolean, false)
     and v_ai_allocation <= 0 then
    v_result := jsonb_set(v_result, '{ai_authoring_enabled}', 'false'::jsonb, true);
  end if;

  return v_result;
exception when others then
  return jsonb_set(coalesce(p_entitlements, '{}'::jsonb), '{ai_authoring_enabled}', 'false'::jsonb, true);
end;
$$;

revoke execute on function private.apply_organization_entitlement_safety(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.temporary_entitlement_grant_is_coherent(
  p_grant_type public.organization_temporary_entitlement_grant_type,
  p_source_plan_key text,
  p_entitlement_delta jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_entitlements jsonb := '{}'::jsonb;
  v_effective_grant jsonb := '{}'::jsonb;
  v_ai_allocation numeric;
begin
  if p_source_plan_key is not null then
    select entitlements
      into v_plan_entitlements
    from public.organization_plans
    where key = p_source_plan_key
      and status = 'active';

    if v_plan_entitlements is null then
      return false;
    end if;
  end if;

  v_effective_grant := private.merge_organization_entitlement_delta(
    coalesce(v_plan_entitlements, '{}'::jsonb),
    coalesce(p_entitlement_delta, '{}'::jsonb),
    p_grant_type = 'additive_allocation'::public.organization_temporary_entitlement_grant_type
  );

  v_ai_allocation :=
    private.organization_entitlement_number(v_effective_grant, 'ai_monthly_allocation')
    + private.organization_entitlement_number(v_effective_grant, 'ai_temporary_allocation')
    + private.organization_entitlement_number(v_effective_grant, 'ai_top_up_allocation');

  if coalesce((v_effective_grant ->> 'ai_authoring_enabled')::boolean, false)
     and v_ai_allocation <= 0 then
    return false;
  end if;

  if coalesce(p_entitlement_delta, '{}'::jsonb) ? 'allowed_lesson_block_types'
     and exists (
       select 1
       from jsonb_array_elements_text(coalesce(p_entitlement_delta -> 'allowed_lesson_block_types', '[]'::jsonb)) as block_type(value)
       where block_type.value in ('video', 'audio')
     )
     and not (
       coalesce(p_entitlement_delta, '{}'::jsonb) ? 'max_storage_bytes'
       and private.organization_entitlement_number(p_entitlement_delta, 'max_storage_bytes') > 0
     ) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

revoke execute on function private.temporary_entitlement_grant_is_coherent(
  public.organization_temporary_entitlement_grant_type,
  text,
  jsonb
) from public, anon, authenticated, service_role;

create or replace function private.validate_temporary_entitlement_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.temporary_entitlement_grant_is_coherent(
    new.grant_type,
    new.source_plan_key,
    new.entitlement_delta
  ) then
    raise exception 'Temporary entitlement grant is incoherent.';
  end if;

  if new.revoked_at is not null and new.revoked_by is null then
    new.revoked_by := auth.uid();
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_temporary_entitlement_grant()
  from public, anon, authenticated, service_role;

drop trigger if exists organization_temporary_entitlement_grants_validate
  on public.organization_temporary_entitlement_grants;
create trigger organization_temporary_entitlement_grants_validate
  before insert or update on public.organization_temporary_entitlement_grants
  for each row execute function private.validate_temporary_entitlement_grant();

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
      v_grant.grant_type = 'additive_allocation'::public.organization_temporary_entitlement_grant_type
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

create or replace function public.resolve_organization_entitlements(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_organization_id is null then
    raise exception 'Organization is required.';
  end if;

  if auth.uid() is null
     or not (
       public.current_user_is_admin()
       or public.current_user_has_organization_role(p_organization_id, null)
       or public.current_user_can_manage_organization(p_organization_id)
     ) then
    raise exception 'You cannot read organization entitlements.';
  end if;

  return private.resolve_organization_entitlements_unchecked(p_organization_id);
end;
$$;

create or replace function public.admin_upsert_organization_temporary_entitlement_grant(
  p_grant_id uuid,
  p_organization_id uuid,
  p_grant_type public.organization_temporary_entitlement_grant_type,
  p_source_plan_key text default null,
  p_entitlement_delta jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_grant_id uuid := p_grant_id;
  v_existing public.organization_temporary_entitlement_grants%rowtype;
  v_result public.organization_temporary_entitlement_grants%rowtype;
  v_starts_at timestamptz := coalesce(p_starts_at, now());
  v_delta jsonb := coalesce(p_entitlement_delta, '{}'::jsonb);
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can manage temporary entitlement grants.';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization does not exist.';
  end if;

  if not private.organization_entitlements_are_valid(v_delta, false) then
    raise exception 'Temporary entitlement delta is invalid.';
  end if;

  if p_source_plan_key is not null and not exists (
    select 1
    from public.organization_plans
    where key = p_source_plan_key
      and status = 'active'
  ) then
    raise exception 'Source plan is not available.';
  end if;

  if p_source_plan_key is null and v_delta = '{}'::jsonb then
    raise exception 'A source plan or entitlement delta is required.';
  end if;

  if p_expires_at is not null and p_expires_at <= v_starts_at then
    raise exception 'Grant expiry must be after its start time.';
  end if;

  if not private.temporary_entitlement_grant_is_coherent(
    p_grant_type,
    p_source_plan_key,
    v_delta
  ) then
    raise exception 'Temporary entitlement grant is incoherent.';
  end if;

  if v_grant_id is not null then
    select *
      into v_existing
    from public.organization_temporary_entitlement_grants
    where id = v_grant_id
    for update;

    if v_existing.id is null then
      raise exception 'Temporary entitlement grant does not exist.';
    end if;

    if v_existing.revoked_at is not null then
      raise exception 'Revoked temporary entitlement grants cannot be updated.';
    end if;

    update public.organization_temporary_entitlement_grants
    set organization_id = p_organization_id,
        grant_type = p_grant_type,
        source_plan_key = p_source_plan_key,
        entitlement_delta = v_delta,
        starts_at = v_starts_at,
        expires_at = p_expires_at,
        reason = nullif(trim(coalesce(p_reason, '')), '')
    where id = v_grant_id
    returning * into v_result;
  else
    insert into public.organization_temporary_entitlement_grants (
      organization_id,
      grant_type,
      source_plan_key,
      entitlement_delta,
      starts_at,
      expires_at,
      reason,
      created_by
    )
    values (
      p_organization_id,
      p_grant_type,
      p_source_plan_key,
      v_delta,
      v_starts_at,
      p_expires_at,
      nullif(trim(coalesce(p_reason, '')), ''),
      v_actor_id
    )
    returning * into v_result;
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when p_grant_id is null
      then 'organization_temporary_entitlement_grant_created'
      else 'organization_temporary_entitlement_grant_updated'
    end,
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'grantId', v_result.id,
      'grantType', v_result.grant_type,
      'sourcePlanKey', v_result.source_plan_key,
      'entitlementDelta', v_result.entitlement_delta,
      'startsAt', v_result.starts_at,
      'expiresAt', v_result.expires_at,
      'reason', v_result.reason,
      'previousGrant', case when v_existing.id is null then null else to_jsonb(v_existing) end
    )
  );

  return jsonb_build_object(
    'grantId', v_result.id,
    'organizationId', v_result.organization_id,
    'grantType', v_result.grant_type,
    'sourcePlanKey', v_result.source_plan_key,
    'startsAt', v_result.starts_at,
    'expiresAt', v_result.expires_at,
    'revokedAt', v_result.revoked_at,
    'entitlements', private.resolve_organization_entitlements_unchecked(p_organization_id)
  );
end;
$$;

create or replace function public.admin_revoke_organization_temporary_entitlement_grant(
  p_grant_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_grant public.organization_temporary_entitlement_grants%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can revoke temporary entitlement grants.';
  end if;

  if p_grant_id is null then
    raise exception 'Temporary entitlement grant is required.';
  end if;

  select *
    into v_grant
  from public.organization_temporary_entitlement_grants
  where id = p_grant_id
  for update;

  if v_grant.id is null then
    raise exception 'Temporary entitlement grant does not exist.';
  end if;

  if v_grant.revoked_at is null then
    update public.organization_temporary_entitlement_grants
    set revoked_at = now(),
        revoked_by = v_actor_id,
        reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), reason)
    where id = p_grant_id
    returning * into v_grant;

    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (
      v_actor_id,
      'organization_temporary_entitlement_grant_revoked',
      'organization',
      v_grant.organization_id::text,
      jsonb_build_object(
        'grantId', v_grant.id,
        'grantType', v_grant.grant_type,
        'sourcePlanKey', v_grant.source_plan_key,
        'revokedAt', v_grant.revoked_at,
        'reason', coalesce(nullif(trim(coalesce(p_reason, '')), ''), v_grant.reason)
      )
    );
  end if;

  return jsonb_build_object(
    'grantId', v_grant.id,
    'organizationId', v_grant.organization_id,
    'revokedAt', v_grant.revoked_at,
    'entitlements', private.resolve_organization_entitlements_unchecked(v_grant.organization_id)
  );
end;
$$;

create or replace function public.admin_record_expired_organization_temporary_entitlement_grants(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_count integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can audit expired temporary entitlement grants.';
  end if;

  with expired as (
    update public.organization_temporary_entitlement_grants expiring_grant
    set expired_audited_at = now()
    where expiring_grant.id in (
      select candidate.id
      from public.organization_temporary_entitlement_grants candidate
      where candidate.revoked_at is null
        and candidate.expires_at is not null
        and candidate.expires_at <= now()
        and candidate.expired_audited_at is null
      order by candidate.expires_at asc, candidate.created_at asc
      limit greatest(1, least(coalesce(p_limit, 100), 1000))
    )
    returning expiring_grant.*
  ),
  audit_insert as (
    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    select
      v_actor_id,
      'organization_temporary_entitlement_grant_expired',
      'organization',
      expired.organization_id::text,
      jsonb_build_object(
        'grantId', expired.id,
        'grantType', expired.grant_type,
        'sourcePlanKey', expired.source_plan_key,
        'expiresAt', expired.expires_at,
        'expiredAuditedAt', expired.expired_audited_at
      )
    from expired
    returning 1
  )
  select count(*)::integer into v_count from audit_insert;

  return coalesce(v_count, 0);
end;
$$;

revoke execute on function public.resolve_organization_entitlements(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_organization_entitlements(uuid)
  to authenticated, service_role;

revoke execute on function public.admin_upsert_organization_temporary_entitlement_grant(
  uuid,
  uuid,
  public.organization_temporary_entitlement_grant_type,
  text,
  jsonb,
  timestamptz,
  timestamptz,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_organization_temporary_entitlement_grant(
  uuid,
  uuid,
  public.organization_temporary_entitlement_grant_type,
  text,
  jsonb,
  timestamptz,
  timestamptz,
  text
) to authenticated, service_role;

revoke execute on function public.admin_revoke_organization_temporary_entitlement_grant(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_revoke_organization_temporary_entitlement_grant(uuid, text)
  to authenticated, service_role;

revoke execute on function public.admin_record_expired_organization_temporary_entitlement_grants(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_record_expired_organization_temporary_entitlement_grants(integer)
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
    'admin_upsert_organization_temporary_entitlement_grant',
    'p_grant_id uuid, p_organization_id uuid, p_grant_type organization_temporary_entitlement_grant_type, p_source_plan_key text, p_entitlement_delta jsonb, p_starts_at timestamp with time zone, p_expires_at timestamp with time zone, p_reason text',
    'ADMIN_AUTHENTICATED',
    'Platform admin temporary entitlement grant creation and update workflow.',
    'Requires auth.uid() and public.current_user_is_admin(); validates organisation, source plan, entitlement keys, capability dependencies and expiry order before writing.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_revoke_organization_temporary_entitlement_grant',
    'p_grant_id uuid, p_reason text',
    'ADMIN_AUTHENTICATED',
    'Platform admin temporary entitlement grant revocation workflow.',
    'Requires auth.uid() and public.current_user_is_admin(); marks the grant revoked instead of deleting historical state.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_record_expired_organization_temporary_entitlement_grants',
    'p_limit integer',
    'ADMIN_AUTHENTICATED',
    'Platform admin expiry audit processor for temporary entitlement grants.',
    'Requires auth.uid() and public.current_user_is_admin(); records expiry audit events for already-expired non-revoked grants without deleting them.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
