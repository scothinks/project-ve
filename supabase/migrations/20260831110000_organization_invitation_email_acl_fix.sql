-- Complete the invitation email ACL repair for organisation invitations. The
-- public security-definer boundaries must not depend on EXECUTE access to the
-- deliberately private authenticated-user email helper. Use the signed JWT
-- email claim for caller-self matching and leave the helper unavailable to API
-- roles.

create or replace function public.current_user_can_read_organization_invitation(p_invitation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.organization_invitations invitation
      where invitation.id = p_invitation_id
        and (
          public.current_user_can_manage_organization_audience(invitation.organization_id)
          or invitation.invited_user_id = auth.uid()
          or (
            invitation.email is not null
            and invitation.email = nullif(lower(auth.jwt() ->> 'email'), '')
          )
        )
    );
$$;

revoke execute on function public.current_user_can_read_organization_invitation(uuid) from public, anon;
grant execute on function public.current_user_can_read_organization_invitation(uuid) to authenticated, service_role;

create or replace function public.get_my_pending_organization_invitations()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  organization_short_name text,
  organization_slug text,
  organization_logo_url text,
  organization_accent_token public.organization_accent_token,
  organization_lifecycle_status public.organization_lifecycle_status,
  organization_verification_status public.organization_verification_status,
  target_type public.organization_invitation_target_type,
  target_id uuid,
  target_label text,
  email text,
  role public.organization_role_key,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    invitation.id,
    invitation.organization_id,
    organization.name as organization_name,
    organization.short_name as organization_short_name,
    organization.slug as organization_slug,
    organization.logo_url as organization_logo_url,
    organization.accent_token as organization_accent_token,
    organization.lifecycle_status as organization_lifecycle_status,
    organization.verification_status as organization_verification_status,
    invitation.target_type,
    invitation.target_id,
    case
      when invitation.target_type = 'programme' then coalesce(programme.title, 'Programme invitation')
      when invitation.target_type = 'cohort' then coalesce(cohort.title, 'Cohort invitation')
      else coalesce(organization.short_name, organization.name)
    end as target_label,
    invitation.email,
    invitation.role,
    invitation.expires_at,
    invitation.created_at
  from public.organization_invitations invitation
  join public.organizations organization
    on organization.id = invitation.organization_id
  left join public.programmes programme
    on programme.id = invitation.target_id
   and invitation.target_type = 'programme'
   and programme.organization_id = invitation.organization_id
  left join public.cohorts cohort
    on cohort.id = invitation.target_id
   and invitation.target_type = 'cohort'
   and cohort.organization_id = invitation.organization_id
  where auth.uid() is not null
    and invitation.status = 'pending'
    and invitation.expires_at > now()
    and (
      invitation.invited_user_id = auth.uid()
      or (
        invitation.email is not null
        and invitation.email = nullif(lower(auth.jwt() ->> 'email'), '')
      )
    )
  order by invitation.created_at desc;
$$;

revoke execute on function public.get_my_pending_organization_invitations() from public, anon;
grant execute on function public.get_my_pending_organization_invitations() to authenticated, service_role;

do $migration$
declare
  v_definition text;
  v_helper_call constant text := 'private.authenticated_user_email()';
  v_jwt_expression constant text := 'nullif(lower(auth.jwt() ->> ''email''), '''')';
begin
  select pg_get_functiondef('public.respond_organization_invitation(uuid,text)'::regprocedure)
  into v_definition;

  if position(v_helper_call in v_definition) = 0 then
    raise exception 'respond_organization_invitation no longer contains the expected private email helper call';
  end if;

  if length(v_definition) - length(replace(v_definition, v_helper_call, '')) <> length(v_helper_call) then
    raise exception 'respond_organization_invitation contains more than one private email helper call';
  end if;

  execute replace(v_definition, v_helper_call, v_jwt_expression);
end;
$migration$;

alter function public.respond_organization_invitation(uuid, text)
  set search_path = public;

revoke execute on function public.respond_organization_invitation(uuid, text) from public, anon;
grant execute on function public.respond_organization_invitation(uuid, text) to authenticated, service_role;

update private.rpc_security_classifications
set authorization_rule = case function_name
      when 'current_user_can_read_organization_invitation'
        then 'Security-definer boundary checks audience-management access, invited_user_id, or the caller''s signed JWT email claim without exposing private helpers.'
      when 'get_my_pending_organization_invitations'
        then 'Requires auth.uid(); returns only pending, unexpired invitations addressed to the caller by invited_user_id or signed JWT email, with limited organisation identity fields.'
      else 'Caller must be the invited user by id or matching signed JWT email claim; acceptance derives all organisation, target, role and enrolment effects from the locked invitation row.'
    end,
    reviewed_at = now()
where function_schema = 'public'
  and (
    (function_name = 'current_user_can_read_organization_invitation' and identity_arguments = 'p_invitation_id uuid')
    or (function_name = 'get_my_pending_organization_invitations' and identity_arguments = '')
    or (function_name = 'respond_organization_invitation' and identity_arguments = 'p_invitation_id uuid, p_action text')
  );
