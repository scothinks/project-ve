-- Platform Catalog staffing: lets Project VE hand out scoped roles to manage
-- its own organization_id-null content (courses, missions, rewards,
-- recommendations) without granting full platform-admin access. Mirrors
-- organization_memberships/organization_invitations (20260802120000,
-- 20260805120000) but simplified — no target_type/target_id, since the
-- catalog has no units/programmes/cohorts of its own. Reuses the existing
-- organization_role_key/organization_membership_status/
-- organization_invitation_status enums and organization_roles label table —
-- no new enums.

create table if not exists public.platform_catalog_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role_key not null references public.organization_roles(role),
  status public.organization_membership_status not null default 'active',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists platform_catalog_memberships_user_status_idx
  on public.platform_catalog_memberships (user_id, status);

create index if not exists platform_catalog_memberships_status_idx
  on public.platform_catalog_memberships (status);

drop trigger if exists platform_catalog_memberships_set_updated_at on public.platform_catalog_memberships;
create trigger platform_catalog_memberships_set_updated_at
  before update on public.platform_catalog_memberships
  for each row execute function public.set_updated_at();

create table if not exists public.platform_catalog_invitations (
  id uuid primary key default gen_random_uuid(),
  email text,
  invited_user_id uuid references public.profiles(id) on delete cascade,
  role public.organization_role_key not null default 'content_editor' references public.organization_roles(role),
  token_hash text not null unique,
  status public.organization_invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is null or (length(email) <= 254 and email ~* '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$')),
  check (email is not null or invited_user_id is not null),
  check ((status = 'accepted' and accepted_at is not null and accepted_by is not null) or status <> 'accepted')
);

create index if not exists platform_catalog_invitations_status_idx
  on public.platform_catalog_invitations (status, created_at desc);

create index if not exists platform_catalog_invitations_user_status_idx
  on public.platform_catalog_invitations (invited_user_id, status, created_at desc)
  where invited_user_id is not null;

create index if not exists platform_catalog_invitations_email_status_idx
  on public.platform_catalog_invitations (email, status, created_at desc)
  where email is not null;

create unique index if not exists platform_catalog_invitations_pending_user_unique
  on public.platform_catalog_invitations (invited_user_id, role)
  where status = 'pending' and invited_user_id is not null;

create unique index if not exists platform_catalog_invitations_pending_email_unique
  on public.platform_catalog_invitations (email, role)
  where status = 'pending' and email is not null;

drop trigger if exists platform_catalog_invitations_set_updated_at on public.platform_catalog_invitations;
create trigger platform_catalog_invitations_set_updated_at
  before update on public.platform_catalog_invitations
  for each row execute function public.set_updated_at();

alter table public.platform_catalog_memberships enable row level security;
alter table public.platform_catalog_invitations enable row level security;

create or replace function public.current_user_has_platform_catalog_role(
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
    from public.platform_catalog_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and (p_roles is null or membership.role = any(p_roles))
  );
$$;

create or replace function public.current_user_can_manage_platform_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.current_user_has_platform_catalog_role(
      array['organisation_owner', 'organisation_admin']::public.organization_role_key[]
    );
$$;

revoke execute on function public.current_user_has_platform_catalog_role(public.organization_role_key[]) from public, anon;
grant execute on function public.current_user_has_platform_catalog_role(public.organization_role_key[]) to authenticated, service_role;

revoke execute on function public.current_user_can_manage_platform_catalog() from public, anon;
grant execute on function public.current_user_can_manage_platform_catalog() to authenticated, service_role;

create or replace function public.current_user_can_read_platform_catalog_invitation(p_invitation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_catalog_invitations invitation
      where invitation.id = p_invitation_id
        and (
          public.current_user_can_manage_platform_catalog()
          or invitation.invited_user_id = auth.uid()
          or (
            invitation.email is not null
            and invitation.email = private.authenticated_user_email()
          )
        )
    );
$$;

revoke execute on function public.current_user_can_read_platform_catalog_invitation(uuid) from public, anon;
grant execute on function public.current_user_can_read_platform_catalog_invitation(uuid) to authenticated, service_role;

drop policy if exists "Members and managers can read platform catalog staff" on public.platform_catalog_memberships;
create policy "Members and managers can read platform catalog staff"
  on public.platform_catalog_memberships for select
  using (user_id = auth.uid() or public.current_user_can_manage_platform_catalog());

drop policy if exists "Participants can read platform catalog invitations" on public.platform_catalog_invitations;
create policy "Participants can read platform catalog invitations"
  on public.platform_catalog_invitations for select
  using (public.current_user_can_read_platform_catalog_invitation(id));

revoke insert, update, delete on public.platform_catalog_memberships from anon, authenticated;
grant select on public.platform_catalog_memberships to authenticated;
grant all on public.platform_catalog_memberships to service_role;

revoke insert, update, delete on public.platform_catalog_invitations from anon, authenticated;
grant select on public.platform_catalog_invitations to authenticated;
grant all on public.platform_catalog_invitations to service_role;

create or replace function public.admin_upsert_platform_catalog_membership(
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
  if v_actor_id is null or not public.current_user_can_manage_platform_catalog() then
    raise exception 'Platform catalog manager access required.' using errcode = '42501';
  end if;

  if p_user_id is null or p_role is null then
    raise exception 'User and role are required.';
  end if;

  if not exists(select 1 from public.profiles where id = p_user_id) then
    raise exception 'User does not exist.';
  end if;

  insert into public.platform_catalog_memberships (
    user_id,
    role,
    status,
    invited_by
  )
  values (
    p_user_id,
    p_role,
    coalesce(p_status, 'active'::public.organization_membership_status),
    v_actor_id
  )
  on conflict (user_id, role) do update
    set status = excluded.status,
        invited_by = excluded.invited_by,
        updated_at = now()
  returning id into v_membership_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_catalog_membership_upserted',
    'platform_catalog_membership',
    v_membership_id::text,
    jsonb_build_object(
      'userId', p_user_id,
      'role', p_role,
      'status', coalesce(p_status, 'active'::public.organization_membership_status)
    )
  );

  return jsonb_build_object('membershipId', v_membership_id, 'status', 'upserted');
end;
$$;

create or replace function public.admin_create_platform_catalog_invitation(
  p_email text,
  p_invited_user_id uuid,
  p_role public.organization_role_key,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_email text := private.normalized_invitation_email(p_email);
  v_invited_user_id uuid := p_invited_user_id;
  v_invited_user_email text;
  v_expires_at timestamptz := coalesce(p_expires_at, now() + interval '14 days');
  v_role public.organization_role_key := coalesce(p_role, 'content_editor'::public.organization_role_key);
  v_existing_id uuid;
  v_invitation_id uuid;
  v_token_hash text;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not public.current_user_can_manage_platform_catalog() then
    raise exception 'Platform catalog manager access required.' using errcode = '42501';
  end if;

  if v_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future.';
  end if;

  if v_invited_user_id is not null then
    if not exists(select 1 from public.profiles where id = v_invited_user_id) then
      raise exception 'Invited user does not exist.';
    end if;

    select lower(auth_user.email)
      into v_invited_user_email
    from auth.users auth_user
    where auth_user.id = v_invited_user_id;

    v_email := coalesce(v_email, v_invited_user_email);
  end if;

  if v_email is null and v_invited_user_id is null then
    raise exception 'Invite by email or existing user.';
  end if;

  if v_email is not null and (length(v_email) > 254 or v_email !~* '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$') then
    raise exception 'Invitation email is invalid.';
  end if;

  select invitation.id
    into v_existing_id
  from public.platform_catalog_invitations invitation
  where invitation.role = v_role
    and invitation.status = 'pending'
    and (
      (v_invited_user_id is not null and invitation.invited_user_id = v_invited_user_id)
      or (v_invited_user_id is null and invitation.email = v_email)
    )
  limit 1;

  v_token_hash := encode(
    extensions.digest(
      gen_random_uuid()::text || ':' || coalesce(v_email, '') || ':' || clock_timestamp()::text,
      'sha256'
    ),
    'hex'
  );

  if v_existing_id is not null then
    update public.platform_catalog_invitations
    set email = v_email,
        invited_user_id = v_invited_user_id,
        invited_by = v_actor_id,
        expires_at = v_expires_at,
        token_hash = v_token_hash
    where id = v_existing_id
    returning id into v_invitation_id;
  else
    insert into public.platform_catalog_invitations (
      email,
      invited_user_id,
      role,
      token_hash,
      expires_at,
      invited_by
    )
    values (
      v_email,
      v_invited_user_id,
      v_role,
      v_token_hash,
      v_expires_at,
      v_actor_id
    )
    returning id into v_invitation_id;
  end if;

  if v_invited_user_id is not null then
    perform private.queue_user_notification(
      v_invited_user_id,
      'account',
      'platform_catalog_invitation',
      'Platform catalogue invitation',
      'Project VE invited you to help manage its platform catalogue.',
      '/org/my',
      'Review invitation',
      jsonb_build_object(
        'invitationId', v_invitation_id,
        'role', v_role,
        'expiresAt', v_expires_at
      ),
      'platform-catalog-invitation:' || v_invitation_id::text
    );
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_catalog_invitation_created',
    'platform_catalog_invitation',
    v_invitation_id::text,
    jsonb_build_object(
      'invitedUserId', v_invited_user_id,
      'emailPresent', v_email is not null,
      'role', v_role,
      'expiresAt', v_expires_at
    )
  );

  return jsonb_build_object(
    'invitationId', v_invitation_id,
    'role', v_role,
    'status', 'pending'
  );
end;
$$;

create or replace function public.respond_platform_catalog_invitation(
  p_invitation_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text := private.authenticated_user_email();
  v_invitation public.platform_catalog_invitations%rowtype;
  v_membership_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select *
    into v_invitation
  from public.platform_catalog_invitations
  where id = p_invitation_id
  for update;

  if not found
    or not (
      v_invitation.invited_user_id = v_actor_id
      or (
        v_invitation.email is not null
        and v_invitation.email = v_actor_email
      )
    )
  then
    raise exception 'Invitation not found.' using errcode = '42501';
  end if;

  if v_invitation.status = 'accepted' then
    if v_invitation.accepted_by = v_actor_id or v_invitation.invited_user_id = v_actor_id then
      return jsonb_build_object('invitationId', v_invitation.id, 'status', 'accepted', 'idempotent', true);
    end if;

    raise exception 'Invitation already accepted.' using errcode = '42501';
  end if;

  if v_invitation.status in ('revoked', 'declined', 'expired') then
    raise exception 'Invitation is no longer available.' using errcode = '42501';
  end if;

  if v_invitation.expires_at <= now() then
    update public.platform_catalog_invitations
    set status = 'expired'
    where id = v_invitation.id;

    raise exception 'Invitation has expired.' using errcode = '42501';
  end if;

  if lower(trim(coalesce(p_action, ''))) = 'decline' then
    update public.platform_catalog_invitations
    set status = 'declined',
        invited_user_id = coalesce(invited_user_id, v_actor_id)
    where id = v_invitation.id;

    return jsonb_build_object('invitationId', v_invitation.id, 'status', 'declined');
  end if;

  if lower(trim(coalesce(p_action, ''))) <> 'accept' then
    raise exception 'Unsupported invitation response.';
  end if;

  insert into public.platform_catalog_memberships (
    user_id,
    role,
    status,
    invited_by
  )
  values (
    v_actor_id,
    v_invitation.role,
    'active',
    v_invitation.invited_by
  )
  on conflict (user_id, role) do update
    set status = 'active',
        invited_by = excluded.invited_by,
        updated_at = now()
  returning id into v_membership_id;

  update public.platform_catalog_invitations
  set status = 'accepted',
      accepted_by = v_actor_id,
      accepted_at = now(),
      invited_user_id = coalesce(invited_user_id, v_actor_id)
  where id = v_invitation.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_catalog_invitation_accepted',
    'platform_catalog_invitation',
    v_invitation.id::text,
    jsonb_build_object('membershipId', v_membership_id, 'role', v_invitation.role)
  );

  return jsonb_build_object('invitationId', v_invitation.id, 'membershipId', v_membership_id, 'status', 'accepted');
end;
$$;

create or replace function public.admin_revoke_platform_catalog_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation public.platform_catalog_invitations%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select *
    into v_invitation
  from public.platform_catalog_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found.';
  end if;

  if not public.current_user_can_manage_platform_catalog() then
    raise exception 'Platform catalog manager access required.' using errcode = '42501';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Only pending invitations can be revoked.';
  end if;

  update public.platform_catalog_invitations
  set status = 'revoked'
  where id = p_invitation_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_catalog_invitation_revoked',
    'platform_catalog_invitation',
    p_invitation_id::text,
    '{}'::jsonb
  );

  return jsonb_build_object('invitationId', p_invitation_id, 'status', 'revoked');
end;
$$;

revoke execute on function public.admin_upsert_platform_catalog_membership(uuid, public.organization_role_key, public.organization_membership_status) from public, anon;
grant execute on function public.admin_upsert_platform_catalog_membership(uuid, public.organization_role_key, public.organization_membership_status) to authenticated, service_role;

revoke execute on function public.admin_create_platform_catalog_invitation(text, uuid, public.organization_role_key, timestamptz) from public, anon;
grant execute on function public.admin_create_platform_catalog_invitation(text, uuid, public.organization_role_key, timestamptz) to authenticated, service_role;

revoke execute on function public.respond_platform_catalog_invitation(uuid, text) from public, anon;
grant execute on function public.respond_platform_catalog_invitation(uuid, text) to authenticated, service_role;

revoke execute on function public.admin_revoke_platform_catalog_invitation(uuid) from public, anon;
grant execute on function public.admin_revoke_platform_catalog_invitation(uuid) to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
)
values
  (
    'public', 'current_user_has_platform_catalog_role', 'p_roles organization_role_key[]',
    'PUBLIC_AUTHENTICATED_SELF', 'Any authenticated caller checking their own platform catalog role.',
    'Reads only the caller''s own membership row (auth.uid()).', array['authenticated', 'service_role']
  ),
  (
    'public', 'current_user_can_manage_platform_catalog', '',
    'PUBLIC_AUTHENTICATED_SELF', 'Any authenticated caller checking their own manage-level access.',
    'True platform admin, or an active organisation_owner/organisation_admin platform catalog membership.', array['authenticated', 'service_role']
  ),
  (
    'public', 'current_user_can_read_platform_catalog_invitation', 'p_invitation_id uuid',
    'PUBLIC_AUTHENTICATED_SELF', 'Authenticated platform catalog invitation participants and catalog managers.',
    'Security-definer boundary checks manager access, invited_user_id, or the caller''s authenticated email without exposing private helpers.', array['authenticated', 'service_role']
  ),
  (
    'public', 'admin_upsert_platform_catalog_membership', 'p_user_id uuid, p_role organization_role_key, p_status organization_membership_status',
    'ADMIN_AUTHENTICATED', 'Platform admins and platform catalog owner/admin staff managing catalog staffing.',
    'Requires current_user_can_manage_platform_catalog(); handles invite-by-id, role change, suspend and remove.', array['authenticated', 'service_role']
  ),
  (
    'public', 'admin_create_platform_catalog_invitation', 'p_email text, p_invited_user_id uuid, p_role organization_role_key, p_expires_at timestamp with time zone',
    'ADMIN_AUTHENTICATED', 'Platform admins and platform catalog owner/admin staff inviting new catalog staff.',
    'Requires current_user_can_manage_platform_catalog().', array['authenticated', 'service_role']
  ),
  (
    'public', 'respond_platform_catalog_invitation', 'p_invitation_id uuid, p_action text',
    'PUBLIC_AUTHENTICATED_SELF', 'The invited user accepting or declining their own invitation.',
    'Caller must be the invited user (by id or matching authenticated email).', array['authenticated', 'service_role']
  ),
  (
    'public', 'admin_revoke_platform_catalog_invitation', 'p_invitation_id uuid',
    'ADMIN_AUTHENTICATED', 'Platform admins and platform catalog owner/admin staff revoking a pending invitation.',
    'Requires current_user_can_manage_platform_catalog().', array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
