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
set search_path = public, private
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
        and invitation.email = private.authenticated_user_email()
      )
    )
  order by invitation.created_at desc;
$$;

revoke execute on function public.get_my_pending_organization_invitations() from public, anon, authenticated, service_role;
grant execute on function public.get_my_pending_organization_invitations() to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values (
  'public',
  'get_my_pending_organization_invitations',
  '',
  'PUBLIC_AUTHENTICATED_SELF',
  'Authenticated learners listing their own pending organisation invitations for /org/my.',
  'Requires auth.uid(); returns only pending, unexpired invitations addressed to the caller by invited_user_id or authenticated email, with limited organisation identity fields needed to render the invitation.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
