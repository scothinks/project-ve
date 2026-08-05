do $$ begin
  create type public.organization_accent_token as enum (
    'green',
    'mission',
    'store',
    'violet',
    'slate'
  );
exception when duplicate_object then null;
end $$;

alter table public.organizations
  add column if not exists short_name text,
  add column if not exists description text not null default '',
  add column if not exists logo_url text,
  add column if not exists accent_token public.organization_accent_token not null default 'green',
  add column if not exists support_email text,
  add column if not exists support_phone text;

alter table public.organizations
  drop constraint if exists organizations_short_name_length,
  add constraint organizations_short_name_length
    check (short_name is null or length(trim(short_name)) between 1 and 80),
  drop constraint if exists organizations_description_length,
  add constraint organizations_description_length
    check (length(description) <= 2000),
  drop constraint if exists organizations_logo_url_safe,
  add constraint organizations_logo_url_safe
    check (logo_url is null or (length(logo_url) <= 1000 and logo_url ~* '^https?://[^[:space:]<>]+$')),
  drop constraint if exists organizations_support_email_safe,
  add constraint organizations_support_email_safe
    check (support_email is null or (length(support_email) <= 254 and support_email ~* '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$')),
  drop constraint if exists organizations_support_phone_safe,
  add constraint organizations_support_phone_safe
    check (support_phone is null or (length(support_phone) <= 40 and support_phone ~ '^[0-9+(). -]{5,40}$'));

create index if not exists organizations_lifecycle_status_idx
  on public.organizations(lifecycle_status);

create or replace function public.organization_allows_learner_entry(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations organization
    where organization.id = p_organization_id
      and organization.status <> 'archived'
      and organization.lifecycle_status in ('trial', 'active')
  );
$$;

create or replace function public.current_user_can_enter_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.organization_allows_learner_entry(p_organization_id)
    and (
      public.current_user_is_admin()
      or public.current_user_has_organization_role(p_organization_id, null)
      or exists (
        select 1
        from public.enrolments enrolment
        where enrolment.user_id = auth.uid()
          and enrolment.organization_id = p_organization_id
          and enrolment.status in ('active', 'completed')
      )
    );
$$;

create or replace function public.current_user_can_read_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and (
        public.current_user_is_admin()
        or (
          public.current_user_has_course_enrolment(course.id)
          and (
            course.organization_id is null
            or public.organization_allows_learner_entry(course.organization_id)
          )
        )
        or (
          course.catalog_scope = 'platform'
          and course.status = 'published'
        )
        or (
          course.organization_id is not null
          and public.organization_allows_learner_entry(course.organization_id)
          and (
            public.current_user_has_organization_role(
              course.organization_id,
              array[
                'organisation_owner',
                'organisation_admin',
                'programme_manager',
                'content_editor',
                'reviewer',
                'instructor',
                'report_viewer'
              ]::public.organization_role_key[]
            )
            or (
              course.status = 'published'
              and public.current_user_has_organization_role(course.organization_id, null)
            )
          )
        )
      )
  );
$$;

create or replace function public.current_user_can_read_programme(p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programmes programme
    where programme.id = p_programme_id
      and (
        public.current_user_can_manage_organization_programmes(programme.organization_id)
        or (
          public.organization_allows_learner_entry(programme.organization_id)
          and (
            public.current_user_has_programme_enrolment(programme.id)
            or public.current_user_has_organization_role(
              programme.organization_id,
              array['content_editor', 'reviewer', 'instructor', 'report_viewer']::public.organization_role_key[]
            )
            or (
              programme.status = 'published'
              and public.current_user_has_organization_role(programme.organization_id, null)
            )
          )
        )
      )
  );
$$;

create or replace function public.current_user_can_access_reward(p_reward_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rewards reward
    where reward.id = p_reward_id
      and (
        public.current_user_is_admin()
        or (
          reward.status = 'published'
          and reward.is_enabled
          and (reward.starts_at is null or reward.starts_at <= now())
          and (reward.ends_at is null or reward.ends_at > now())
          and public.campaign_is_live(reward.campaign_id)
          and (
            coalesce(reward.owner_scope, 'platform_owned') = 'platform_owned'
            or (
              reward.owner_scope = 'organization_owned'
              and auth.uid() is not null
              and reward.organization_id is not null
              and public.organization_allows_learner_entry(reward.organization_id)
              and (
                public.current_user_has_organization_role(reward.organization_id, null)
                or exists (
                  select 1
                  from public.enrolments enrolment
                  where enrolment.user_id = auth.uid()
                    and enrolment.organization_id = reward.organization_id
                    and enrolment.status in ('active', 'completed')
                )
              )
            )
            or (
              reward.owner_scope = 'programme_sponsored'
              and auth.uid() is not null
              and reward.sponsored_programme_id is not null
              and exists (
                select 1
                from public.enrolments enrolment
                join public.programmes programme
                  on programme.id = enrolment.programme_id
                where enrolment.user_id = auth.uid()
                  and enrolment.programme_id = reward.sponsored_programme_id
                  and enrolment.status in ('active', 'completed')
                  and public.organization_allows_learner_entry(programme.organization_id)
              )
            )
          )
        )
      )
  );
$$;

create or replace function public.admin_update_organization_profile(
  p_organization_id uuid,
  p_short_name text,
  p_description text,
  p_logo_url text,
  p_accent_token public.organization_accent_token,
  p_support_email text,
  p_support_phone text,
  p_verification_status public.organization_verification_status,
  p_lifecycle_status public.organization_lifecycle_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_short_name text := nullif(trim(coalesce(p_short_name, '')), '');
  v_description text := trim(coalesce(p_description, ''));
  v_logo_url text := nullif(trim(coalesce(p_logo_url, '')), '');
  v_support_email text := nullif(lower(trim(coalesce(p_support_email, ''))), '');
  v_support_phone text := nullif(trim(coalesce(p_support_phone, '')), '');
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only a platform admin can update organization profiles.';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required.';
  end if;

  if not exists(select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization does not exist.';
  end if;

  if v_short_name is not null and length(v_short_name) > 80 then
    raise exception 'Organization short name must be at most 80 characters.';
  end if;

  if length(v_description) > 2000 then
    raise exception 'Organization description must be at most 2000 characters.';
  end if;

  if v_logo_url is not null and (length(v_logo_url) > 1000 or v_logo_url !~* '^https?://[^[:space:]<>]+$') then
    raise exception 'Organization logo URL must be a valid HTTP or HTTPS URL.';
  end if;

  if v_support_email is not null and (length(v_support_email) > 254 or v_support_email !~* '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$') then
    raise exception 'Organization support email is invalid.';
  end if;

  if v_support_phone is not null and (length(v_support_phone) > 40 or v_support_phone !~ '^[0-9+(). -]{5,40}$') then
    raise exception 'Organization support phone is invalid.';
  end if;

  update public.organizations
  set short_name = v_short_name,
      description = v_description,
      logo_url = v_logo_url,
      accent_token = coalesce(p_accent_token, 'green'::public.organization_accent_token),
      support_email = v_support_email,
      support_phone = v_support_phone,
      verification_status = coalesce(p_verification_status, 'unverified'::public.organization_verification_status),
      lifecycle_status = coalesce(p_lifecycle_status, 'active'::public.organization_lifecycle_status),
      updated_at = now()
  where id = p_organization_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_profile_updated',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'verificationStatus', coalesce(p_verification_status, 'unverified'::public.organization_verification_status),
      'lifecycleStatus', coalesce(p_lifecycle_status, 'active'::public.organization_lifecycle_status),
      'accentToken', coalesce(p_accent_token, 'green'::public.organization_accent_token)
    )
  );

  return jsonb_build_object('organizationId', p_organization_id, 'status', 'updated');
end;
$$;

revoke execute on function public.organization_allows_learner_entry(uuid) from public, anon, authenticated, service_role;
grant execute on function public.organization_allows_learner_entry(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_enter_organization(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_enter_organization(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_course(text) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_course(text) to anon, authenticated, service_role;

revoke execute on function public.current_user_can_read_programme(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_programme(uuid) to anon, authenticated, service_role;

revoke execute on function public.current_user_can_access_reward(text) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_access_reward(text) to anon, authenticated, service_role;

revoke execute on function public.admin_update_organization_profile(uuid, text, text, text, public.organization_accent_token, text, text, public.organization_verification_status, public.organization_lifecycle_status) from public, anon, authenticated, service_role;
grant execute on function public.admin_update_organization_profile(uuid, text, text, text, public.organization_accent_token, text, text, public.organization_verification_status, public.organization_lifecycle_status) to authenticated, service_role;

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
    'organization_allows_learner_entry',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking whether an organisation lifecycle permits learner entry.',
    'Returns true only when the organisation is not content-archived and lifecycle_status is trial or active.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_enter_organization',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and learner workspace routing checking active membership or enrolment plus organisation lifecycle entry.',
    'Requires auth.uid(), an enterable organisation lifecycle and platform admin, active membership or active/completed enrolment.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_organization_profile',
    'p_organization_id uuid, p_short_name text, p_description text, p_logo_url text, p_accent_token organization_accent_token, p_support_email text, p_support_phone text, p_verification_status organization_verification_status, p_lifecycle_status organization_lifecycle_status',
    'ADMIN_AUTHENTICATED',
    'Platform admin organisation profile, restrained branding, verification and lifecycle workflow.',
    'Requires auth.uid() and public.current_user_is_admin() before updating organisation identity or lifecycle fields.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
