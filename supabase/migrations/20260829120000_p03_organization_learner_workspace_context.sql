create or replace function public.get_organization_learner_workspace_context(
  p_organization_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with target_organization as (
    select
      organization.id,
      organization.slug,
      organization.name,
      organization.short_name,
      organization.logo_url,
      organization.accent_token
    from public.organizations organization
    where auth.uid() is not null
      and organization.slug = nullif(trim(p_organization_slug), '')
      and public.current_user_can_enter_organization(organization.id)
    limit 1
  ),
  active_roles as (
    select membership.role
    from public.organization_memberships membership
    join target_organization organization
      on organization.id = membership.organization_id
    where membership.user_id = auth.uid()
      and membership.status = 'active'
  ),
  active_enrolments as (
    select enrolment.course_id, enrolment.programme_id
    from public.enrolments enrolment
    join target_organization organization
      on organization.id = enrolment.organization_id
    where enrolment.user_id = auth.uid()
      and enrolment.status in ('active', 'completed')
  ),
  enrolled_programmes as (
    select distinct enrolment.programme_id
    from active_enrolments enrolment
    where enrolment.programme_id is not null
  ),
  programme_deliveries as (
    select
      programme_course.course_id,
      programme.id as programme_id,
      programme.title as programme_title
    from enrolled_programmes enrolled
    join public.programmes programme
      on programme.id = enrolled.programme_id
    join target_organization organization
      on organization.id = programme.organization_id
    join public.programme_courses programme_course
      on programme_course.programme_id = programme.id
  ),
  organization_course_ids as (
    select course.id as course_id
    from public.courses course
    join target_organization organization
      on organization.id = course.organization_id
    where course.status = 'published'
      and exists (select 1 from active_roles)

    union

    select enrolment.course_id
    from active_enrolments enrolment
    where enrolment.programme_id is null
      and enrolment.course_id is not null
  ),
  workspace_course_ids as (
    select enrolment.course_id
    from active_enrolments enrolment
    where enrolment.course_id is not null

    union

    select delivery.course_id
    from programme_deliveries delivery

    union

    select organization_course.course_id
    from organization_course_ids organization_course
  ),
  course_deliveries as (
    select
      delivery.course_id,
      delivery.programme_title as label,
      delivery.programme_id,
      'programme'::text as scope
    from programme_deliveries delivery

    union all

    select
      organization_course.course_id,
      'Organisation learning'::text as label,
      null::uuid as programme_id,
      'organization'::text as scope
    from organization_course_ids organization_course
    where not exists (
      select 1
      from programme_deliveries delivery
      where delivery.course_id = organization_course.course_id
    )
  ),
  default_xp_account as (
    select
      account.id,
      account.display_name_plural,
      account.short_label,
      account.display_format
    from public.xp_accounts account
    join target_organization organization
      on organization.id = account.organization_id
    where account.scope = 'organization'
      and account.is_default
      and account.status = 'active'
    limit 1
  )
  select jsonb_build_object(
    'accessSource', case
      when exists (
        select 1 from active_roles where role = 'organisation_owner'
      ) then 'owner'
      when exists (select 1 from active_roles) then 'membership'
      when exists (select 1 from enrolled_programmes) then 'programme_enrolment'
      else 'course_enrolment'
    end,
    'branding', jsonb_build_object(
      'accentToken', organization.accent_token,
      'logoUrl', organization.logo_url,
      'name', organization.name,
      'shortName', organization.short_name
    ),
    'courseDeliveries', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'courseId', delivery.course_id,
            'label', delivery.label,
            'organizationId', organization.id,
            'programmeId', delivery.programme_id,
            'scope', delivery.scope
          )
          order by delivery.course_id, delivery.scope, delivery.label, delivery.programme_id
        )
        from course_deliveries delivery
      ),
      '[]'::jsonb
    ),
    'courseIds', coalesce(
      (
        select jsonb_agg(course.course_id order by course.course_id)
        from workspace_course_ids course
      ),
      '[]'::jsonb
    ),
    'membershipRoles', coalesce(
      (
        select jsonb_agg(role.role order by role.role::text)
        from active_roles role
      ),
      '[]'::jsonb
    ),
    'organizationId', organization.id,
    'organizationSlug', organization.slug,
    'programmeIds', coalesce(
      (
        select jsonb_agg(programme.programme_id order by programme.programme_id)
        from enrolled_programmes programme
      ),
      '[]'::jsonb
    ),
    'type', 'organization',
    'xpAccount', jsonb_build_object(
      'balance', coalesce(
        (
          select balance.balance_cached
          from public.user_xp_balances balance
          where balance.user_id = auth.uid()
            and balance.xp_account_id = account.id
        ),
        0
      ),
      'id', account.id,
      'label', case
        when account.display_format = 'amount_short_label' then account.short_label
        else account.display_name_plural
      end,
      'type', 'organization'
    )
  )
  from target_organization organization
  cross join default_xp_account account;
$$;

revoke execute on function public.get_organization_learner_workspace_context(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_organization_learner_workspace_context(text)
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
values (
  'public',
  'get_organization_learner_workspace_context',
  'p_organization_slug text',
  'PUBLIC_AUTHENTICATED_SELF',
  'Authenticated organisation learner routes resolving the current caller workspace once per route request.',
  'Derives identity only from auth.uid(), requires current_user_can_enter_organization for the slug-resolved organisation, and returns only branding, role, enrolment/delivery identifiers, and the current caller organization XP account state.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
