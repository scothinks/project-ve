-- Keep platform-catalog invitation reads and responses inside their public
-- security-definer boundaries. Calling the private email helper from these
-- functions made their behavior depend on the deployed function-owner ACL.
-- The signed JWT email claim is sufficient for this caller-self check and
-- leaves the private helper unavailable to API roles.

create or replace function public.current_user_can_read_platform_catalog_invitation(p_invitation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
            and invitation.email = nullif(lower(auth.jwt() ->> 'email'), '')
          )
        )
    );
$$;

revoke execute on function public.current_user_can_read_platform_catalog_invitation(uuid) from public, anon;
grant execute on function public.current_user_can_read_platform_catalog_invitation(uuid) to authenticated, service_role;

create or replace function public.respond_platform_catalog_invitation(
  p_invitation_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text := nullif(lower(auth.jwt() ->> 'email'), '');
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

revoke execute on function public.respond_platform_catalog_invitation(uuid, text) from public, anon;
grant execute on function public.respond_platform_catalog_invitation(uuid, text) to authenticated, service_role;

update private.rpc_security_classifications
set authorization_rule = case function_name
      when 'current_user_can_read_platform_catalog_invitation'
        then 'Security-definer boundary checks manager access, invited_user_id, or the caller''s signed JWT email claim without exposing private helpers.'
      else 'Caller must be the invited user (by id or matching signed JWT email claim).'
    end,
    reviewed_at = now()
where function_schema = 'public'
  and (
    (function_name = 'current_user_can_read_platform_catalog_invitation' and identity_arguments = 'p_invitation_id uuid')
    or (function_name = 'respond_platform_catalog_invitation' and identity_arguments = 'p_invitation_id uuid, p_action text')
  );
