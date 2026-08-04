do $$ begin
  create type public.organization_role_key as enum (
    'organisation_owner',
    'organisation_admin',
    'programme_manager',
    'content_editor',
    'reviewer',
    'instructor',
    'report_viewer',
    'learner'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.organization_membership_status as enum (
    'active',
    'invited',
    'suspended',
    'removed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  name text not null check (length(trim(name)) > 0),
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_roles (
  role public.organization_role_key primary key,
  label text not null,
  description text not null,
  sort_order integer not null unique
);

insert into public.organization_roles (role, label, description, sort_order)
values
  ('organisation_owner', 'Organisation owner', 'Owns organisation setup, membership, programmes and tenant governance.', 10),
  ('organisation_admin', 'Organisation admin', 'Manages organisation settings and day-to-day operations.', 20),
  ('programme_manager', 'Programme manager', 'Builds and manages programmes, cohorts and assignments.', 30),
  ('content_editor', 'Content editor', 'Creates and adapts organisation learning content.', 40),
  ('reviewer', 'Reviewer', 'Reviews organisation-owned or adapted content before publishing.', 50),
  ('instructor', 'Instructor', 'Facilitates assigned cohorts and learner interventions.', 60),
  ('report_viewer', 'Report viewer', 'Reads programme, cohort and learner reporting.', 70),
  ('learner', 'Learner', 'Learns within an organisation context.', 80)
on conflict (role) do update
  set label = excluded.label,
      description = excluded.description,
      sort_order = excluded.sort_order;

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role_key not null references public.organization_roles(role),
  status public.organization_membership_status not null default 'active',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, role)
);

create index if not exists organizations_status_idx
  on public.organizations(status);

create index if not exists organization_memberships_user_status_idx
  on public.organization_memberships(user_id, status);

create index if not exists organization_memberships_org_status_idx
  on public.organization_memberships(organization_id, status);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists organization_memberships_set_updated_at on public.organization_memberships;
create trigger organization_memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_roles enable row level security;
alter table public.organization_memberships enable row level security;

create or replace function public.current_user_has_organization_role(
  p_organization_id uuid,
  p_roles public.organization_role_key[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and (p_roles is null or membership.role = any(p_roles))
  );
$$;

create or replace function public.current_user_can_manage_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.current_user_has_organization_role(
      p_organization_id,
      array['organisation_owner', 'organisation_admin']::public.organization_role_key[]
    );
$$;

revoke execute on function public.current_user_has_organization_role(uuid, public.organization_role_key[]) from public, anon, authenticated, service_role;
grant execute on function public.current_user_has_organization_role(uuid, public.organization_role_key[]) to authenticated, service_role;

revoke execute on function public.current_user_can_manage_organization(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_manage_organization(uuid) to authenticated, service_role;

drop policy if exists "Organization roles are readable" on public.organization_roles;
create policy "Organization roles are readable"
  on public.organization_roles for select
  using (auth.uid() is not null);

drop policy if exists "Admins and members can read organizations" on public.organizations;
create policy "Admins and members can read organizations"
  on public.organizations for select
  using (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(id, null)
  );

drop policy if exists "Admins and managers can read organization memberships" on public.organization_memberships;
create policy "Admins and managers can read organization memberships"
  on public.organization_memberships for select
  using (
    user_id = auth.uid()
    or public.current_user_can_manage_organization(organization_id)
  );

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
      created_by
    )
    values (
      v_id,
      v_slug,
      v_name,
      coalesce(p_status, 'draft'::public.content_status),
      v_actor_id
    );
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'organization_updated' else 'organization_created' end,
    'organization',
    v_id::text,
    jsonb_build_object('name', v_name, 'slug', v_slug, 'status', coalesce(p_status, 'draft'::public.content_status))
  );

  return jsonb_build_object('organizationId', v_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;

create or replace function public.admin_upsert_organization_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role_key,
  p_status public.organization_membership_status default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_membership_id uuid;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can manage organization memberships.';
  end if;

  if p_organization_id is null or p_user_id is null or p_role is null then
    raise exception 'Organization, user and role are required.';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    p_organization_id,
    p_user_id,
    p_role,
    coalesce(p_status, 'active'::public.organization_membership_status),
    v_actor_id
  )
  on conflict (organization_id, user_id, role) do update
    set status = excluded.status,
        invited_by = excluded.invited_by,
        updated_at = now()
  returning id into v_membership_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_membership_upserted',
    'organization_membership',
    v_membership_id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'userId', p_user_id,
      'role', p_role,
      'status', coalesce(p_status, 'active'::public.organization_membership_status)
    )
  );

  return jsonb_build_object('membershipId', v_membership_id, 'status', 'upserted');
end;
$$;

revoke execute on function public.admin_upsert_organization(uuid, text, text, public.content_status) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_organization(uuid, text, text, public.content_status) to authenticated, service_role;

revoke execute on function public.admin_upsert_organization_membership(uuid, uuid, public.organization_role_key, public.organization_membership_status) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_organization_membership(uuid, uuid, public.organization_role_key, public.organization_membership_status) to authenticated, service_role;

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
    'current_user_has_organization_role',
    'p_organization_id uuid, p_roles organization_role_key[]',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking the caller membership in one organisation.',
    'Uses auth.uid() and active organization_memberships rows for the current user; does not accept a target user id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_manage_organization',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking whether the caller can administer one organisation.',
    'Allows platform admins or active organisation_owner/organisation_admin memberships for the requested organization id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_organization',
    'p_organization_id uuid, p_name text, p_slug text, p_status content_status',
    'ADMIN_AUTHENTICATED',
    'Platform admin organisation management workflow.',
    'Requires auth.uid() and public.current_user_is_admin() before inserting or updating an organization.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_organization_membership',
    'p_organization_id uuid, p_user_id uuid, p_role organization_role_key, p_status organization_membership_status',
    'ADMIN_AUTHENTICATED',
    'Platform admin contextual membership management workflow.',
    'Requires auth.uid() and public.current_user_is_admin() before inserting or updating a contextual organization membership.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
