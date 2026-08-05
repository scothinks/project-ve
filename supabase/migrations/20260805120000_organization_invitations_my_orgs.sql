do $$ begin
  create type public.organization_invitation_target_type as enum (
    'organization',
    'programme',
    'cohort'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.organization_invitation_status as enum (
    'pending',
    'accepted',
    'expired',
    'revoked',
    'declined'
  );
exception when duplicate_object then null;
end $$;

create or replace function private.normalized_invitation_email(p_email text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(lower(trim(coalesce(p_email, ''))), '');
$$;

revoke execute on function private.normalized_invitation_email(text) from public, anon, authenticated, service_role;

create or replace function private.authenticated_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(auth_user.email)
  from auth.users auth_user
  where auth_user.id = auth.uid();
$$;

revoke execute on function private.authenticated_user_email() from public, anon, authenticated, service_role;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_type public.organization_invitation_target_type not null,
  target_id uuid,
  email text,
  invited_user_id uuid references public.profiles(id) on delete cascade,
  role public.organization_role_key not null default 'learner' references public.organization_roles(role),
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
  check ((target_type = 'organization' and target_id is null) or (target_type <> 'organization' and target_id is not null)),
  check ((status = 'accepted' and accepted_at is not null and accepted_by is not null) or status <> 'accepted')
);

create index if not exists organization_invitations_org_status_idx
  on public.organization_invitations(organization_id, status, created_at desc);

create index if not exists organization_invitations_user_status_idx
  on public.organization_invitations(invited_user_id, status, created_at desc)
  where invited_user_id is not null;

create index if not exists organization_invitations_email_status_idx
  on public.organization_invitations(email, status, created_at desc)
  where email is not null;

create unique index if not exists organization_invitations_pending_user_unique
  on public.organization_invitations(
    organization_id,
    target_type,
    coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid),
    invited_user_id,
    role
  )
  where status = 'pending' and invited_user_id is not null;

create unique index if not exists organization_invitations_pending_email_unique
  on public.organization_invitations(
    organization_id,
    target_type,
    coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid),
    email,
    role
  )
  where status = 'pending' and email is not null;

drop trigger if exists organization_invitations_set_updated_at on public.organization_invitations;
create trigger organization_invitations_set_updated_at
  before update on public.organization_invitations
  for each row execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;

revoke insert, update, delete on public.organization_invitations from anon, authenticated;
grant select on public.organization_invitations to authenticated;
grant all on public.organization_invitations to service_role;

create or replace function public.current_user_can_read_organization_invitation(p_invitation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
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
            and invitation.email = private.authenticated_user_email()
          )
        )
    );
$$;

create or replace function public.current_user_can_manage_organization_invitation(p_invitation_id uuid)
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
        and public.current_user_can_manage_organization_audience(invitation.organization_id)
    );
$$;

revoke execute on function public.current_user_can_read_organization_invitation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_organization_invitation(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_manage_organization_invitation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_manage_organization_invitation(uuid) to authenticated, service_role;

drop policy if exists "Invitation participants can read invitations" on public.organization_invitations;
create policy "Invitation participants can read invitations"
  on public.organization_invitations for select
  using (public.current_user_can_read_organization_invitation(id));

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
      or exists (
        select 1
        from public.cohort_members member
        join public.cohorts cohort
          on cohort.id = member.cohort_id
        where member.user_id = auth.uid()
          and member.status = 'active'
          and cohort.organization_id = p_organization_id
      )
    );
$$;

drop policy if exists "Admins and members can read organizations" on public.organizations;
create policy "Admins and members can read organizations"
  on public.organizations for select
  using (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(id, null)
    or public.current_user_can_enter_organization(id)
  );

create or replace function public.admin_create_organization_invitation(
  p_organization_id uuid,
  p_target_type public.organization_invitation_target_type,
  p_target_id uuid,
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
  v_role public.organization_role_key := coalesce(p_role, 'learner'::public.organization_role_key);
  v_existing_id uuid;
  v_invitation_id uuid;
  v_organization_name text;
  v_target_label text := 'organisation';
  v_token_hash text;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_organization_id is null or p_target_type is null then
    raise exception 'Organisation and invitation target are required.';
  end if;

  if not public.current_user_can_manage_organization_audience(p_organization_id) then
    raise exception 'Audience manager access required.' using errcode = '42501';
  end if;

  select organization.name
    into v_organization_name
  from public.organizations organization
  where organization.id = p_organization_id
    and public.organization_allows_learner_entry(organization.id);

  if v_organization_name is null then
    raise exception 'Organisation is not available for invitations.';
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

  if p_target_type = 'organization' then
    if p_target_id is not null then
      raise exception 'Organisation invitations do not use a target id.';
    end if;

    if v_role <> 'learner' and not public.current_user_can_manage_organization(p_organization_id) then
      raise exception 'Only organisation managers can invite staff roles.' using errcode = '42501';
    end if;
  elsif p_target_type = 'programme' then
    if v_role <> 'learner' then
      raise exception 'Programme invitations must use the learner role.';
    end if;

    select programme.title
      into v_target_label
    from public.programmes programme
    where programme.id = p_target_id
      and programme.organization_id = p_organization_id
      and programme.status <> 'archived';

    if v_target_label is null then
      raise exception 'Programme target is not available for this organisation.';
    end if;
  elsif p_target_type = 'cohort' then
    if v_role <> 'learner' then
      raise exception 'Cohort invitations must use the learner role.';
    end if;

    select cohort.title
      into v_target_label
    from public.cohorts cohort
    where cohort.id = p_target_id
      and cohort.organization_id = p_organization_id
      and cohort.status <> 'archived';

    if v_target_label is null then
      raise exception 'Cohort target is not available for this organisation.';
    end if;
  else
    raise exception 'Unsupported invitation target.';
  end if;

  select invitation.id
    into v_existing_id
  from public.organization_invitations invitation
  where invitation.organization_id = p_organization_id
    and invitation.target_type = p_target_type
    and coalesce(invitation.target_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_target_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and invitation.role = v_role
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
    update public.organization_invitations
    set email = v_email,
        invited_user_id = v_invited_user_id,
        invited_by = v_actor_id,
        expires_at = v_expires_at,
        token_hash = v_token_hash
    where id = v_existing_id
    returning id into v_invitation_id;
  else
    insert into public.organization_invitations (
      organization_id,
      target_type,
      target_id,
      email,
      invited_user_id,
      role,
      token_hash,
      expires_at,
      invited_by
    )
    values (
      p_organization_id,
      p_target_type,
      p_target_id,
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
      'organization_invitation',
      'Organisation invitation',
      v_organization_name || ' invited you to ' || v_target_label || '.',
      '/org/my',
      'Review invitation',
      jsonb_build_object(
        'organizationId', p_organization_id,
        'invitationId', v_invitation_id,
        'targetType', p_target_type,
        'targetId', p_target_id,
        'role', v_role,
        'expiresAt', v_expires_at
      ),
      'organization-invitation:' || v_invitation_id::text
    );
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_invitation_created',
    'organization_invitation',
    v_invitation_id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'targetType', p_target_type,
      'targetId', p_target_id,
      'invitedUserId', v_invited_user_id,
      'emailPresent', v_email is not null,
      'role', v_role,
      'expiresAt', v_expires_at
    )
  );

  return jsonb_build_object(
    'invitationId', v_invitation_id,
    'organizationId', p_organization_id,
    'targetType', p_target_type,
    'targetId', p_target_id,
    'role', v_role,
    'status', 'pending'
  );
end;
$$;

create or replace function public.respond_organization_invitation(
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
  v_invitation public.organization_invitations%rowtype;
  v_membership_id uuid;
  v_programme_assignment_id uuid;
  v_programme_enrolment_count integer := 0;
  v_course_enrolment_count integer := 0;
  v_added_course_enrolment_count integer := 0;
  v_cohort_member_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select *
    into v_invitation
  from public.organization_invitations
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
      return jsonb_build_object(
        'invitationId', v_invitation.id,
        'organizationId', v_invitation.organization_id,
        'targetType', v_invitation.target_type,
        'targetId', v_invitation.target_id,
        'status', 'accepted',
        'idempotent', true
      );
    end if;

    raise exception 'Invitation already accepted.' using errcode = '42501';
  end if;

  if v_invitation.status in ('revoked', 'declined', 'expired') then
    raise exception 'Invitation is no longer available.' using errcode = '42501';
  end if;

  if v_invitation.expires_at <= now() then
    update public.organization_invitations
    set status = 'expired'
    where id = v_invitation.id;

    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (
      v_actor_id,
      'organization_invitation_expired',
      'organization_invitation',
      v_invitation.id::text,
      jsonb_build_object('organizationId', v_invitation.organization_id)
    );

    raise exception 'Invitation has expired.' using errcode = '42501';
  end if;

  if lower(trim(coalesce(p_action, ''))) = 'decline' then
    update public.organization_invitations
    set status = 'declined',
        invited_user_id = coalesce(invited_user_id, v_actor_id)
    where id = v_invitation.id;

    insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (
      v_actor_id,
      'organization_invitation_declined',
      'organization_invitation',
      v_invitation.id::text,
      jsonb_build_object(
        'organizationId', v_invitation.organization_id,
        'targetType', v_invitation.target_type,
        'targetId', v_invitation.target_id
      )
    );

    return jsonb_build_object('invitationId', v_invitation.id, 'status', 'declined');
  end if;

  if lower(trim(coalesce(p_action, ''))) <> 'accept' then
    raise exception 'Unsupported invitation response.';
  end if;

  if not public.organization_allows_learner_entry(v_invitation.organization_id) then
    raise exception 'Organisation is not available.' using errcode = '42501';
  end if;

  if v_invitation.target_type = 'organization' then
    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status,
      invited_by
    )
    values (
      v_invitation.organization_id,
      v_actor_id,
      v_invitation.role,
      'active',
      v_invitation.invited_by
    )
    on conflict (organization_id, user_id, role) do update
      set status = 'active',
          invited_by = excluded.invited_by,
          updated_at = now()
    returning id into v_membership_id;
  elsif v_invitation.target_type = 'programme' then
    if not exists (
      select 1
      from public.programmes programme
      where programme.id = v_invitation.target_id
        and programme.organization_id = v_invitation.organization_id
        and programme.status <> 'archived'
    ) then
      raise exception 'Programme invitation target is no longer available.';
    end if;

    insert into public.programme_assignments (
      organization_id,
      programme_id,
      user_id,
      assignment_source,
      intake_starts_at,
      status,
      assigned_by
    )
    values (
      v_invitation.organization_id,
      v_invitation.target_id,
      v_actor_id,
      'manual',
      now(),
      'active',
      v_invitation.invited_by
    )
    on conflict (organization_id, programme_id, user_id)
      where user_id is not null
    do update
      set status = 'active',
          assigned_by = excluded.assigned_by,
          updated_at = now()
    returning id into v_programme_assignment_id;

    insert into public.enrolments (
      organization_id,
      user_id,
      programme_id,
      programme_assignment_id,
      assignment_source,
      metadata
    )
    values (
      v_invitation.organization_id,
      v_actor_id,
      v_invitation.target_id,
      v_programme_assignment_id,
      'manual',
      jsonb_build_object('invitationId', v_invitation.id)
    )
    on conflict (organization_id, user_id, programme_id)
      where programme_id is not null
    do update
      set programme_assignment_id = excluded.programme_assignment_id,
          assignment_source = excluded.assignment_source,
          status = 'active',
          metadata = enrolments.metadata || excluded.metadata,
          updated_at = now();

    get diagnostics v_programme_enrolment_count = row_count;

    insert into public.enrolments (
      organization_id,
      user_id,
      course_id,
      programme_assignment_id,
      assignment_source,
      metadata
    )
    select
      v_invitation.organization_id,
      v_actor_id,
      programme_course.course_id,
      v_programme_assignment_id,
      'programme'::public.lms_assignment_source,
      jsonb_build_object('programmeId', v_invitation.target_id, 'invitationId', v_invitation.id)
    from public.programme_courses programme_course
    where programme_course.programme_id = v_invitation.target_id
    on conflict (organization_id, user_id, course_id)
      where course_id is not null
    do update
      set programme_assignment_id = excluded.programme_assignment_id,
          assignment_source = excluded.assignment_source,
          status = 'active',
          metadata = enrolments.metadata || excluded.metadata,
          updated_at = now();

    get diagnostics v_course_enrolment_count = row_count;
  elsif v_invitation.target_type = 'cohort' then
    if not exists (
      select 1
      from public.cohorts cohort
      where cohort.id = v_invitation.target_id
        and cohort.organization_id = v_invitation.organization_id
        and cohort.status <> 'archived'
    ) then
      raise exception 'Cohort invitation target is no longer available.';
    end if;

    insert into public.cohort_members (
      cohort_id,
      user_id,
      status,
      added_by
    )
    values (
      v_invitation.target_id,
      v_actor_id,
      'active',
      v_invitation.invited_by
    )
    on conflict (cohort_id, user_id) do update
      set status = 'active',
          added_by = excluded.added_by,
          updated_at = now();

    get diagnostics v_cohort_member_count = row_count;

    insert into public.enrolments (
      organization_id,
      user_id,
      course_id,
      course_assignment_id,
      assignment_source,
      due_at,
      metadata
    )
    select
      assignment.organization_id,
      v_actor_id,
      assignment.course_id,
      assignment.id,
      'cohort'::public.lms_assignment_source,
      assignment.due_at,
      jsonb_build_object('cohortId', v_invitation.target_id, 'invitationId', v_invitation.id)
    from public.course_assignments assignment
    where assignment.cohort_id = v_invitation.target_id
      and assignment.status = 'active'
    on conflict (organization_id, user_id, course_id)
      where course_id is not null
    do update
      set course_assignment_id = excluded.course_assignment_id,
          assignment_source = excluded.assignment_source,
          status = 'active',
          due_at = excluded.due_at,
          metadata = enrolments.metadata || excluded.metadata,
          updated_at = now();

    get diagnostics v_course_enrolment_count = row_count;

    insert into public.enrolments (
      organization_id,
      user_id,
      programme_id,
      programme_assignment_id,
      assignment_source,
      due_at,
      metadata
    )
    select
      assignment.organization_id,
      v_actor_id,
      assignment.programme_id,
      assignment.id,
      'cohort'::public.lms_assignment_source,
      assignment.due_at,
      jsonb_build_object('cohortId', v_invitation.target_id, 'invitationId', v_invitation.id)
    from public.programme_assignments assignment
    where assignment.cohort_id = v_invitation.target_id
      and assignment.status = 'active'
    on conflict (organization_id, user_id, programme_id)
      where programme_id is not null
    do update
      set programme_assignment_id = excluded.programme_assignment_id,
          assignment_source = excluded.assignment_source,
          status = 'active',
          due_at = excluded.due_at,
          metadata = enrolments.metadata || excluded.metadata,
          updated_at = now();

    get diagnostics v_programme_enrolment_count = row_count;

    insert into public.enrolments (
      organization_id,
      user_id,
      course_id,
      programme_assignment_id,
      assignment_source,
      due_at,
      metadata
    )
    select
      assignment.organization_id,
      v_actor_id,
      programme_course.course_id,
      assignment.id,
      'programme'::public.lms_assignment_source,
      assignment.due_at,
      jsonb_build_object(
        'cohortId', v_invitation.target_id,
        'programmeId', assignment.programme_id,
        'invitationId', v_invitation.id
      )
    from public.programme_assignments assignment
    join public.programme_courses programme_course
      on programme_course.programme_id = assignment.programme_id
    where assignment.cohort_id = v_invitation.target_id
      and assignment.status = 'active'
    on conflict (organization_id, user_id, course_id)
      where course_id is not null
    do update
      set programme_assignment_id = excluded.programme_assignment_id,
          assignment_source = excluded.assignment_source,
          status = 'active',
          due_at = excluded.due_at,
          metadata = enrolments.metadata || excluded.metadata,
          updated_at = now();

    get diagnostics v_added_course_enrolment_count = row_count;
    v_course_enrolment_count := v_course_enrolment_count + v_added_course_enrolment_count;
  end if;

  update public.organization_invitations
  set status = 'accepted',
      invited_user_id = coalesce(invited_user_id, v_actor_id),
      accepted_by = v_actor_id,
      accepted_at = now()
  where id = v_invitation.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_invitation_accepted',
    'organization_invitation',
    v_invitation.id::text,
    jsonb_build_object(
      'organizationId', v_invitation.organization_id,
      'targetType', v_invitation.target_type,
      'targetId', v_invitation.target_id,
      'role', v_invitation.role,
      'membershipId', v_membership_id,
      'programmeEnrolments', v_programme_enrolment_count,
      'courseEnrolments', v_course_enrolment_count,
      'cohortMembers', v_cohort_member_count
    )
  );

  return jsonb_build_object(
    'invitationId', v_invitation.id,
    'organizationId', v_invitation.organization_id,
    'targetType', v_invitation.target_type,
    'targetId', v_invitation.target_id,
    'role', v_invitation.role,
    'membershipId', v_membership_id,
    'programmeEnrolments', v_programme_enrolment_count,
    'courseEnrolments', v_course_enrolment_count,
    'cohortMembers', v_cohort_member_count,
    'status', 'accepted'
  );
end;
$$;

create or replace function public.admin_revoke_organization_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation public.organization_invitations%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select *
    into v_invitation
  from public.organization_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found.';
  end if;

  if not public.current_user_can_manage_organization_audience(v_invitation.organization_id) then
    raise exception 'Audience manager access required.' using errcode = '42501';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Only pending invitations can be revoked.';
  end if;

  update public.organization_invitations
  set status = 'revoked'
  where id = p_invitation_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_invitation_revoked',
    'organization_invitation',
    p_invitation_id::text,
    jsonb_build_object(
      'organizationId', v_invitation.organization_id,
      'targetType', v_invitation.target_type,
      'targetId', v_invitation.target_id
    )
  );

  return jsonb_build_object('invitationId', p_invitation_id, 'status', 'revoked');
end;
$$;

revoke execute on function public.admin_create_organization_invitation(uuid, public.organization_invitation_target_type, uuid, text, uuid, public.organization_role_key, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_organization_invitation(uuid, public.organization_invitation_target_type, uuid, text, uuid, public.organization_role_key, timestamptz) to authenticated, service_role;

revoke execute on function public.respond_organization_invitation(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.respond_organization_invitation(uuid, text) to authenticated, service_role;

revoke execute on function public.admin_revoke_organization_invitation(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_revoke_organization_invitation(uuid) to authenticated, service_role;

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
    'current_user_can_read_organization_invitation',
    'p_invitation_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking whether the caller can see an organisation invitation.',
    'Allows invitation read only to organisation audience managers, the invited user, or an authenticated user whose email matches the invitation email.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_manage_organization_invitation',
    'p_invitation_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app and RLS policies checking invitation management rights.',
    'Allows invitation management only to audience managers in the invitation organisation.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_create_organization_invitation',
    'p_organization_id uuid, p_target_type organization_invitation_target_type, p_target_id uuid, p_email text, p_invited_user_id uuid, p_role organization_role_key, p_expires_at timestamp with time zone',
    'ADMIN_AUTHENTICATED',
    'Platform admins and contextual organisation audience managers creating invitation-first access.',
    'Requires auth.uid(), audience management rights in the target organisation, valid target ownership, future expiry, and either an invited user id or email; staff-role organisation invitations require organisation manager rights.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'respond_organization_invitation',
    'p_invitation_id uuid, p_action text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated invited learner accepting or declining their own organisation invitation.',
    'Requires auth.uid() to match invited_user_id or invitation email; expired/revoked invitations cannot be accepted; acceptance creates only the access implied by target_type.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_revoke_organization_invitation',
    'p_invitation_id uuid',
    'ADMIN_AUTHENTICATED',
    'Platform admins and contextual organisation audience managers revoking pending invitations.',
    'Requires auth.uid() and audience management rights in the invitation organisation; only pending invitations can be revoked.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
