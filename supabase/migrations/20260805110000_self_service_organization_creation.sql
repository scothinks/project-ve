create or replace function private.normalize_organization_slug(
  p_name text,
  p_slug text default null
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_source text := trim(coalesce(nullif(p_slug, ''), p_name, ''));
  v_slug text;
begin
  v_slug := lower(regexp_replace(v_source, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  if length(v_slug) < 3 then
    raise exception 'Organization slug must be at least 3 characters.';
  end if;

  if length(v_slug) > 80 then
    raise exception 'Organization slug must be at most 80 characters.';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then
    raise exception 'Organization slug is invalid.';
  end if;

  return v_slug;
end;
$$;

revoke execute on function private.normalize_organization_slug(text, text) from public, anon, authenticated, service_role;

create table if not exists public.organization_creation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  attempted_slug text not null,
  succeeded boolean not null default false,
  blocked_reason text,
  created_at timestamptz not null default now()
);

create index if not exists organization_creation_attempts_user_created_idx
  on public.organization_creation_attempts(user_id, created_at desc);

alter table public.organization_creation_attempts enable row level security;

drop policy if exists "Users can read their organization creation attempts" on public.organization_creation_attempts;
create policy "Users can read their organization creation attempts"
  on public.organization_creation_attempts for select
  using (user_id = auth.uid());

drop policy if exists "Admins can read organization creation attempts" on public.organization_creation_attempts;
create policy "Admins can read organization creation attempts"
  on public.organization_creation_attempts for select
  using (public.current_user_is_admin());

create or replace function public.admin_upsert_organization(
  p_organization_id uuid,
  p_name text,
  p_slug text,
  p_status public.content_status default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid := p_organization_id;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_exists boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can manage organizations.';
  end if;

  if v_name = '' then
    raise exception 'Organization name is required.';
  end if;

  v_slug := private.normalize_organization_slug(v_name, p_slug);

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

  return jsonb_build_object(
    'organizationId', v_id,
    'slug', v_slug,
    'status', case when v_exists then 'updated' else 'created' end
  );
exception when unique_violation then
  raise exception 'Organization slug is already in use.';
end;
$$;

create or replace function public.create_self_service_organization(
  p_name text,
  p_slug text,
  p_short_name text,
  p_description text,
  p_support_email text,
  p_terms_accepted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_organization_id uuid := gen_random_uuid();
  v_membership_id uuid;
  v_assignment_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_short_name text := nullif(trim(coalesce(p_short_name, '')), '');
  v_description text := trim(coalesce(p_description, ''));
  v_support_email text := nullif(lower(trim(coalesce(p_support_email, ''))), '');
  v_slug text;
  v_recent_successful_creations integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Sign in to create an organization.';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = v_actor_id;

  if v_profile.id is null then
    raise exception 'Complete your profile before creating an organization.';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'Accept the organization terms to continue.';
  end if;

  if v_name = '' then
    raise exception 'Organization name is required.';
  end if;

  if length(v_name) > 160 then
    raise exception 'Organization name must be at most 160 characters.';
  end if;

  if v_short_name is not null and length(v_short_name) > 80 then
    raise exception 'Organization short name must be at most 80 characters.';
  end if;

  if length(v_description) > 2000 then
    raise exception 'Organization description must be at most 2000 characters.';
  end if;

  if v_support_email is not null and (length(v_support_email) > 254 or v_support_email !~* '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$') then
    raise exception 'Organization support email is invalid.';
  end if;

  v_slug := private.normalize_organization_slug(v_name, p_slug);

  select count(*)::integer
    into v_recent_successful_creations
  from public.organization_creation_attempts attempt
  where attempt.user_id = v_actor_id
    and attempt.succeeded
    and attempt.created_at >= now() - interval '1 day';

  if v_recent_successful_creations >= 3 then
    insert into public.organization_creation_attempts (
      user_id,
      attempted_slug,
      succeeded,
      blocked_reason
    )
    values (
      v_actor_id,
      v_slug,
      false,
      'too_many_organizations'
    );

    raise exception 'Organization creation is temporarily limited. Please try again later.';
  end if;

  if exists(select 1 from public.organizations where slug = v_slug) then
    insert into public.organization_creation_attempts (
      user_id,
      attempted_slug,
      succeeded,
      blocked_reason
    )
    values (
      v_actor_id,
      v_slug,
      false,
      'slug_taken'
    );

    raise exception 'Organization slug is already in use.';
  end if;

  insert into public.organizations (
    id,
    slug,
    name,
    status,
    created_by,
    creation_source,
    verification_status,
    lifecycle_status,
    short_name,
    description,
    support_email
  )
  values (
    v_organization_id,
    v_slug,
    v_name,
    'published',
    v_actor_id,
    'self_service',
    'unverified',
    'active',
    v_short_name,
    v_description,
    v_support_email
  );

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    v_organization_id,
    v_actor_id,
    'organisation_owner',
    'active',
    null
  )
  returning id into v_membership_id;

  insert into public.organization_plan_assignments (
    organization_id,
    plan_key,
    billing_status,
    assigned_by
  )
  values (
    v_organization_id,
    'starter',
    'free',
    v_actor_id
  )
  returning id into v_assignment_id;

  insert into public.organization_creation_attempts (
    user_id,
    organization_id,
    attempted_slug,
    succeeded
  )
  values (
    v_actor_id,
    v_organization_id,
    v_slug,
    true
  );

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_self_service_created',
    'organization',
    v_organization_id::text,
    jsonb_build_object(
      'name', v_name,
      'slug', v_slug,
      'shortName', v_short_name,
      'creationSource', 'self_service',
      'verificationStatus', 'unverified',
      'lifecycleStatus', 'active',
      'defaultPlanKey', 'starter',
      'billingStatus', 'free',
      'membershipId', v_membership_id,
      'assignmentId', v_assignment_id
    )
  );

  return jsonb_build_object(
    'organizationId', v_organization_id,
    'membershipId', v_membership_id,
    'assignmentId', v_assignment_id,
    'slug', v_slug,
    'shortName', v_short_name,
    'planKey', 'starter',
    'billingStatus', 'free',
    'verificationStatus', 'unverified',
    'lifecycleStatus', 'active',
    'status', 'created'
  );
exception when unique_violation then
  raise exception 'Organization slug is already in use.';
end;
$$;

revoke execute on function public.create_self_service_organization(text, text, text, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.create_self_service_organization(text, text, text, text, text, boolean) to authenticated, service_role;

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
    'create_self_service_organization',
    'p_name text, p_slug text, p_short_name text, p_description text, p_support_email text, p_terms_accepted boolean',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners creating their own Starter organisation workspace.',
    'Derives creator from auth.uid(), requires an existing profile and accepted terms, enforces per-user creation limits, assigns only Starter/free, sets unverified self_service identity, and creates an active organisation_owner membership for the caller.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
