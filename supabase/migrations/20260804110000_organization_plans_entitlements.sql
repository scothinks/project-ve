do $$ begin
  create type public.organization_plan_status as enum (
    'active',
    'retired'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.organization_creation_source as enum (
    'platform_admin',
    'self_service',
    'sales_assisted',
    'imported'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.organization_billing_status as enum (
    'free',
    'trial',
    'active',
    'past_due',
    'cancelled',
    'sponsored'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.organization_verification_status as enum (
    'unverified',
    'verification_pending',
    'verified',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.organization_lifecycle_status as enum (
    'trial',
    'active',
    'suspended',
    'archived'
  );
exception when duplicate_object then null;
end $$;

alter table public.organizations
  add column if not exists creation_source public.organization_creation_source not null default 'platform_admin',
  add column if not exists verification_status public.organization_verification_status not null default 'unverified',
  add column if not exists lifecycle_status public.organization_lifecycle_status not null default 'active';

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
    if v_key <> all(v_required_keys) then
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
      'max_fulfilled_reward_claims_per_month'
    ) then
      if jsonb_typeof(p_entitlements -> v_key) <> 'number'
         or (p_entitlements ->> v_key)::bigint < 0 then
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
      'allowed_reward_fulfillment_types'
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

revoke execute on function private.organization_entitlements_are_valid(jsonb, boolean) from public, anon, authenticated, service_role;

create table if not exists public.organization_plans (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  status public.organization_plan_status not null default 'active',
  entitlements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_plans_entitlements_valid
    check (private.organization_entitlements_are_valid(entitlements, true))
);

create table if not exists public.organization_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_key text not null references public.organization_plans(key),
  billing_status public.organization_billing_status not null default 'free',
  assigned_by uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_plan_assignments_time_order
    check (ended_at is null or ended_at > starts_at)
);

create unique index if not exists organization_plan_assignments_one_active_idx
  on public.organization_plan_assignments(organization_id)
  where ended_at is null;

create index if not exists organization_plan_assignments_plan_idx
  on public.organization_plan_assignments(plan_key)
  where ended_at is null;

create table if not exists public.organization_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entitlements jsonb not null default '{}'::jsonb,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  starts_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_entitlement_overrides_valid
    check (private.organization_entitlements_are_valid(entitlements, false)),
  constraint organization_entitlement_overrides_time_order
    check (ended_at is null or ended_at > starts_at)
);

create unique index if not exists organization_entitlement_overrides_one_active_idx
  on public.organization_entitlement_overrides(organization_id)
  where ended_at is null;

drop trigger if exists organization_plans_set_updated_at on public.organization_plans;
create trigger organization_plans_set_updated_at
  before update on public.organization_plans
  for each row execute function public.set_updated_at();

drop trigger if exists organization_plan_assignments_set_updated_at on public.organization_plan_assignments;
create trigger organization_plan_assignments_set_updated_at
  before update on public.organization_plan_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists organization_entitlement_overrides_set_updated_at on public.organization_entitlement_overrides;
create trigger organization_entitlement_overrides_set_updated_at
  before update on public.organization_entitlement_overrides
  for each row execute function public.set_updated_at();

alter table public.organization_plans enable row level security;
alter table public.organization_plan_assignments enable row level security;
alter table public.organization_entitlement_overrides enable row level security;

insert into public.organization_plans (key, name, description, status, entitlements)
values
  (
    'starter',
    'Starter',
    'Self-service organisation pilot plan with private learning, basic reporting and constrained points-to-reward workflows.',
    'active',
    jsonb_build_object(
      'max_courses', 1,
      'max_total_lessons', 5,
      'allowed_lesson_block_types', jsonb_build_array('text', 'image', 'table', 'callout'),
      'max_storage_bytes', 104857600,
      'ai_authoring_enabled', false,
      'max_active_missions', 2,
      'allowed_mission_types', jsonb_build_array('course_completed', 'lesson_count_completed'),
      'allowed_mission_reward_modes', jsonb_build_array('organization_xp'),
      'max_xp_accounts', 1,
      'max_active_rewards', 1,
      'allowed_reward_fulfillment_types', jsonb_build_array('manual_claim_form'),
      'max_open_reward_claims', 25,
      'max_fulfilled_reward_claims_per_month', 25,
      'assessment_capability', 'assigned_only',
      'reporting_level', 'basic'
    )
  ),
  (
    'team',
    'Team',
    'Expanded organisation learning plan with more private content, larger limits and template-based assessments.',
    'active',
    jsonb_build_object(
      'max_courses', 5,
      'max_total_lessons', 50,
      'allowed_lesson_block_types', jsonb_build_array('text', 'image', 'table', 'callout', 'video', 'audio'),
      'max_storage_bytes', 1073741824,
      'ai_authoring_enabled', false,
      'max_active_missions', 10,
      'allowed_mission_types', jsonb_build_array('course_completed', 'lesson_completed', 'lesson_count_completed'),
      'allowed_mission_reward_modes', jsonb_build_array('organization_xp', 'manual_reward'),
      'max_xp_accounts', 1,
      'max_active_rewards', 5,
      'allowed_reward_fulfillment_types', jsonb_build_array('manual_claim_form', 'external_link'),
      'max_open_reward_claims', 100,
      'max_fulfilled_reward_claims_per_month', 100,
      'assessment_capability', 'template_use',
      'reporting_level', 'standard'
    )
  ),
  (
    'professional',
    'Professional',
    'Institutional operations plan with advanced missions, adapted assessments, AI access and expanded reporting.',
    'active',
    jsonb_build_object(
      'max_courses', 25,
      'max_total_lessons', 500,
      'allowed_lesson_block_types', jsonb_build_array('text', 'image', 'table', 'callout', 'video', 'audio'),
      'max_storage_bytes', 10737418240,
      'ai_authoring_enabled', true,
      'max_active_missions', 50,
      'allowed_mission_types', jsonb_build_array('course_completed', 'lesson_completed', 'lesson_count_completed', 'referral', 'proof_submission', 'manual_approval'),
      'allowed_mission_reward_modes', jsonb_build_array('organization_xp', 'manual_reward', 'direct_reward'),
      'max_xp_accounts', 3,
      'max_active_rewards', 25,
      'allowed_reward_fulfillment_types', jsonb_build_array('manual_claim_form', 'external_link', 'voucher_code', 'qr_code'),
      'max_open_reward_claims', 500,
      'max_fulfilled_reward_claims_per_month', 500,
      'assessment_capability', 'template_adaptation',
      'reporting_level', 'advanced'
    )
  ),
  (
    'enterprise',
    'Enterprise',
    'Custom institutional plan for advanced governance, integrations and deployment requirements.',
    'active',
    jsonb_build_object(
      'max_courses', 100,
      'max_total_lessons', 2000,
      'allowed_lesson_block_types', jsonb_build_array('text', 'image', 'table', 'callout', 'video', 'audio'),
      'max_storage_bytes', 107374182400,
      'ai_authoring_enabled', true,
      'max_active_missions', 200,
      'allowed_mission_types', jsonb_build_array('course_completed', 'lesson_completed', 'lesson_count_completed', 'referral', 'proof_submission', 'manual_approval'),
      'allowed_mission_reward_modes', jsonb_build_array('organization_xp', 'manual_reward', 'direct_reward'),
      'max_xp_accounts', 10,
      'max_active_rewards', 100,
      'allowed_reward_fulfillment_types', jsonb_build_array('manual_claim_form', 'external_link', 'voucher_code', 'qr_code', 'native_reward'),
      'max_open_reward_claims', 5000,
      'max_fulfilled_reward_claims_per_month', 5000,
      'assessment_capability', 'custom',
      'reporting_level', 'enterprise'
    )
  )
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      entitlements = excluded.entitlements,
      updated_at = now();

insert into public.organization_plan_assignments (
  organization_id,
  plan_key,
  billing_status,
  assigned_by,
  starts_at
)
select organization.id, 'starter', 'free', organization.created_by, now()
from public.organizations organization
where not exists (
  select 1
  from public.organization_plan_assignments assignment
  where assignment.organization_id = organization.id
    and assignment.ended_at is null
);

drop policy if exists "Organization plans are readable" on public.organization_plans;
create policy "Organization plans are readable"
  on public.organization_plans for select
  using (auth.uid() is not null);

drop policy if exists "Organization plan assignments are readable by organization participants" on public.organization_plan_assignments;
create policy "Organization plan assignments are readable by organization participants"
  on public.organization_plan_assignments for select
  using (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(organization_id, null)
  );

drop policy if exists "Organization entitlement overrides are readable by organization managers" on public.organization_entitlement_overrides;
create policy "Organization entitlement overrides are readable by organization managers"
  on public.organization_entitlement_overrides for select
  using (
    public.current_user_is_admin()
    or public.current_user_can_manage_organization(organization_id)
  );

create or replace function public.resolve_organization_entitlements(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entitlements jsonb;
  v_overrides jsonb;
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

  select override.entitlements
    into v_overrides
  from public.organization_entitlement_overrides override
  where override.organization_id = p_organization_id
    and override.ended_at is null
  order by override.starts_at desc
  limit 1;

  return coalesce(v_entitlements, '{}'::jsonb) || coalesce(v_overrides, '{}'::jsonb);
end;
$$;

create or replace function public.organization_entitlement_value(
  p_organization_id uuid,
  p_entitlement_key text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.resolve_organization_entitlements(p_organization_id) -> p_entitlement_key;
$$;

create or replace function public.organization_entitlement_allows_integer(
  p_organization_id uuid,
  p_entitlement_key text,
  p_requested_value integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value jsonb;
begin
  if p_requested_value is null or p_requested_value < 0 then
    return false;
  end if;

  v_value := public.organization_entitlement_value(p_organization_id, p_entitlement_key);

  if v_value is null or jsonb_typeof(v_value) <> 'number' then
    return false;
  end if;

  return p_requested_value <= (v_value #>> '{}')::integer;
end;
$$;

create or replace function public.admin_assign_organization_plan(
  p_organization_id uuid,
  p_plan_key text,
  p_billing_status public.organization_billing_status default 'free',
  p_entitlement_overrides jsonb default '{}'::jsonb,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assignment_id uuid;
  v_override_id uuid;
  v_entitlements jsonb;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can assign organization plans.';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization does not exist.';
  end if;

  if not exists (
    select 1
    from public.organization_plans
    where key = p_plan_key
      and status = 'active'
  ) then
    raise exception 'Organization plan is not available.';
  end if;

  if not private.organization_entitlements_are_valid(coalesce(p_entitlement_overrides, '{}'::jsonb), false) then
    raise exception 'Entitlement overrides are invalid.';
  end if;

  update public.organization_plan_assignments
  set ended_at = greatest(clock_timestamp(), starts_at + interval '1 microsecond'),
      updated_at = now()
  where organization_id = p_organization_id
    and ended_at is null;

  insert into public.organization_plan_assignments (
    organization_id,
    plan_key,
    billing_status,
    assigned_by
  )
  values (
    p_organization_id,
    p_plan_key,
    coalesce(p_billing_status, 'free'::public.organization_billing_status),
    v_actor_id
  )
  returning id into v_assignment_id;

  update public.organization_entitlement_overrides
  set ended_at = greatest(clock_timestamp(), starts_at + interval '1 microsecond'),
      updated_at = now()
  where organization_id = p_organization_id
    and ended_at is null;

  if coalesce(p_entitlement_overrides, '{}'::jsonb) <> '{}'::jsonb then
    insert into public.organization_entitlement_overrides (
      organization_id,
      entitlements,
      reason,
      created_by
    )
    values (
      p_organization_id,
      p_entitlement_overrides,
      nullif(trim(coalesce(p_override_reason, '')), ''),
      v_actor_id
    )
    returning id into v_override_id;
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_plan_assigned',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'planKey', p_plan_key,
      'billingStatus', coalesce(p_billing_status, 'free'::public.organization_billing_status),
      'assignmentId', v_assignment_id,
      'overrideId', v_override_id
    )
  );

  v_entitlements := public.resolve_organization_entitlements(p_organization_id);

  return jsonb_build_object(
    'assignmentId', v_assignment_id,
    'overrideId', v_override_id,
    'organizationId', p_organization_id,
    'planKey', p_plan_key,
    'billingStatus', coalesce(p_billing_status, 'free'::public.organization_billing_status),
    'entitlements', v_entitlements
  );
end;
$$;

create or replace function public.admin_upsert_organization(
  p_organization_id uuid,
  p_name text,
  p_slug text,
  p_status public.content_status default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid := p_organization_id;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-zA-Z0-9]+', '-', 'g'));
  v_exists boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can manage organizations.';
  end if;

  if v_name = '' then
    raise exception 'Organization name is required.';
  end if;

  if v_slug = '' then
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  end if;

  v_slug := trim(both '-' from v_slug);

  if length(v_slug) < 3 then
    raise exception 'Organization slug must be at least 3 characters.';
  end if;

  if v_id is not null then
    select exists(select 1 from public.organizations where id = v_id) into v_exists;
  end if;

  if v_exists then
    update public.organizations
    set name = v_name,
        slug = v_slug,
        status = coalesce(p_status, 'draft'::public.content_status),
        updated_at = now()
    where id = v_id;
  else
    v_id := coalesce(v_id, gen_random_uuid());

    insert into public.organizations (
      id,
      slug,
      name,
      status,
      created_by,
      creation_source,
      verification_status,
      lifecycle_status
    )
    values (
      v_id,
      v_slug,
      v_name,
      coalesce(p_status, 'draft'::public.content_status),
      v_actor_id,
      'platform_admin',
      'unverified',
      'active'
    );
  end if;

  insert into public.organization_plan_assignments (
    organization_id,
    plan_key,
    billing_status,
    assigned_by
  )
  values (
    v_id,
    'starter',
    'free',
    v_actor_id
  )
  on conflict (organization_id) where ended_at is null do nothing;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'organization_updated' else 'organization_created' end,
    'organization',
    v_id::text,
    jsonb_build_object(
      'name', v_name,
      'slug', v_slug,
      'status', coalesce(p_status, 'draft'::public.content_status),
      'defaultPlanKey', 'starter'
    )
  );

  return jsonb_build_object('organizationId', v_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;

revoke execute on function public.resolve_organization_entitlements(uuid) from public, anon, authenticated, service_role;
grant execute on function public.resolve_organization_entitlements(uuid) to authenticated, service_role;

revoke execute on function public.organization_entitlement_value(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.organization_entitlement_value(uuid, text) to authenticated, service_role;

revoke execute on function public.organization_entitlement_allows_integer(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.organization_entitlement_allows_integer(uuid, text, integer) to authenticated, service_role;

revoke execute on function public.admin_assign_organization_plan(uuid, text, public.organization_billing_status, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_assign_organization_plan(uuid, text, public.organization_billing_status, jsonb, text) to authenticated, service_role;

revoke execute on function public.admin_upsert_organization(uuid, text, text, public.content_status) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_organization(uuid, text, text, public.content_status) to authenticated, service_role;

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
    'resolve_organization_entitlements',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, server actions and entitlement-aware RPCs resolving the current organisation capability contract.',
    'Requires auth.uid() and platform admin, active organisation membership or organisation manager access for the requested organisation.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'organization_entitlement_value',
    'p_organization_id uuid, p_entitlement_key text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and entitlement-aware RPCs reading one entitlement value through the central resolver.',
    'Delegates authorization and plan/override merging to resolve_organization_entitlements.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'organization_entitlement_allows_integer',
    'p_organization_id uuid, p_entitlement_key text, p_requested_value integer',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and entitlement-aware RPCs checking integer plan limits server-side.',
    'Delegates authorization to resolve_organization_entitlements and compares the requested value against a numeric entitlement.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_assign_organization_plan',
    'p_organization_id uuid, p_plan_key text, p_billing_status organization_billing_status, p_entitlement_overrides jsonb, p_override_reason text',
    'ADMIN_AUTHENTICATED',
    'Platform admin organisation plan and pilot entitlement override assignment workflow.',
    'Requires auth.uid() and public.current_user_is_admin() before replacing the active plan assignment or active entitlement override.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
