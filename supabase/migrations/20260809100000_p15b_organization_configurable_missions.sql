do $$ begin
  create type public.mission_type_status as enum (
    'active',
    'retired'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_catalog_scope as enum (
    'platform',
    'organization_private',
    'adapted_platform'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.mission_types (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  status public.mission_type_status not null default 'active',
  configuration_schema jsonb not null default '{}'::jsonb,
  supported_repeatability public.mission_repeatability[] not null,
  supported_reward_modes text[] not null default array['platform_xp']::text[],
  learner_interaction_type text not null default 'automatic',
  handler_version integer not null default 1 check (handler_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_types_configuration_schema_object
    check (jsonb_typeof(configuration_schema) = 'object'),
  constraint mission_types_supported_reward_modes_known
    check (supported_reward_modes <@ array['platform_xp', 'organization_xp', 'direct_reward', 'manual_reward']::text[])
);

drop trigger if exists mission_types_set_updated_at on public.mission_types;
create trigger mission_types_set_updated_at
  before update on public.mission_types
  for each row execute function public.set_updated_at();

alter table public.mission_types enable row level security;

drop policy if exists "Active mission types are readable" on public.mission_types;
create policy "Active mission types are readable"
  on public.mission_types for select
  using (status = 'active' or public.current_user_is_admin());

insert into public.mission_types (
  key,
  name,
  description,
  status,
  configuration_schema,
  supported_repeatability,
  supported_reward_modes,
  learner_interaction_type,
  handler_version
)
values
  (
    'course_completed',
    'Course completed',
    'Awards a mission after the learner completes every published lesson in a configured course.',
    'active',
    jsonb_build_object('required', jsonb_build_array('courseId')),
    array['once', 'campaign']::public.mission_repeatability[],
    array['platform_xp', 'organization_xp', 'direct_reward']::text[],
    'automatic',
    1
  ),
  (
    'lesson_completed',
    'Lesson completed',
    'Awards a mission after the learner completes a configured lesson.',
    'active',
    jsonb_build_object('required', jsonb_build_array('lessonId')),
    array['once', 'daily', 'weekly', 'campaign']::public.mission_repeatability[],
    array['platform_xp', 'organization_xp', 'direct_reward']::text[],
    'automatic',
    1
  ),
  (
    'lesson_count_completed',
    'Lesson count completed',
    'Awards a mission after the learner completes a configured number of lessons.',
    'active',
    jsonb_build_object('required', jsonb_build_array('count'), 'optional', jsonb_build_array('withinDays')),
    array['once', 'daily', 'weekly', 'campaign']::public.mission_repeatability[],
    array['platform_xp', 'organization_xp', 'direct_reward']::text[],
    'automatic',
    1
  ),
  (
    'referral',
    'Referral',
    'Awards a mission after an attributed referred learner meets configured qualification rules.',
    'active',
    jsonb_build_object('required', jsonb_build_array('requiredFriendLessonCount')),
    array['per_referral']::public.mission_repeatability[],
    array['platform_xp', 'organization_xp', 'manual_reward']::text[],
    'referral',
    1
  ),
  (
    'proof_submission',
    'Proof submission',
    'Awards a mission after the learner submits the configured proof fields and any required review passes.',
    'active',
    jsonb_build_object('required', jsonb_build_array('requiredFields')),
    array['once', 'campaign']::public.mission_repeatability[],
    array['platform_xp', 'organization_xp', 'manual_reward']::text[],
    'proof',
    1
  ),
  (
    'manual_approval',
    'Manual approval',
    'Represents a staff-reviewed mission outcome whose award is granted after authorised approval.',
    'active',
    jsonb_build_object('required', jsonb_build_array('instructions')),
    array['once', 'campaign']::public.mission_repeatability[],
    array['platform_xp', 'organization_xp', 'manual_reward']::text[],
    'manual_review',
    1
  )
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      configuration_schema = excluded.configuration_schema,
      supported_repeatability = excluded.supported_repeatability,
      supported_reward_modes = excluded.supported_reward_modes,
      learner_interaction_type = excluded.learner_interaction_type,
      handler_version = excluded.handler_version,
      updated_at = now();

create or replace function private.mission_type_key_for_validation(
  p_validation_type public.mission_validation_type
)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_validation_type
    when 'course_completed' then 'course_completed'
    when 'lesson_completed' then 'lesson_completed'
    when 'lesson_count_completed' then 'lesson_count_completed'
    when 'referral_friend_completed_lessons' then 'referral'
    when 'proof_upload' then 'proof_submission'
    when 'manual_review' then 'manual_approval'
  end;
$$;

revoke execute on function private.mission_type_key_for_validation(public.mission_validation_type)
  from public, anon, authenticated, service_role;

alter table public.missions
  add column if not exists catalog_scope public.mission_catalog_scope not null default 'platform',
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists source_mission_id text references public.missions(id) on delete restrict,
  add column if not exists source_catalog_version integer not null default 1 check (source_catalog_version > 0),
  add column if not exists local_changes jsonb not null default '{}'::jsonb,
  add column if not exists upstream_update_available boolean not null default false,
  add column if not exists mission_type_key text references public.mission_types(key),
  add column if not exists presentation_config jsonb not null default '{}'::jsonb,
  add column if not exists configuration_version integer not null default 1 check (configuration_version > 0),
  add column if not exists reward_mode text not null default 'platform_xp';

update public.missions
set mission_type_key = private.mission_type_key_for_validation(validation_type)
where mission_type_key is null;

alter table public.missions
  alter column mission_type_key set not null;

do $$ begin
  alter table public.missions
    add constraint missions_p15b_catalog_scope_valid
    check (
      (
        catalog_scope = 'platform'
        and organization_id is null
        and source_mission_id is null
      )
      or (
        catalog_scope = 'organization_private'
        and organization_id is not null
        and source_mission_id is null
      )
      or (
        catalog_scope = 'adapted_platform'
        and organization_id is not null
        and source_mission_id is not null
        and source_mission_id <> id
      )
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.missions
    add constraint missions_p15b_config_json_valid
    check (
      jsonb_typeof(local_changes) = 'object'
      and jsonb_typeof(presentation_config) = 'object'
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.missions
    add constraint missions_p15b_reward_mode_valid
    check (reward_mode in ('platform_xp', 'organization_xp', 'direct_reward', 'manual_reward'));
exception when duplicate_object then null;
end $$;

create index if not exists missions_catalog_scope_idx
  on public.missions(catalog_scope, organization_id, status);

create index if not exists missions_mission_type_idx
  on public.missions(mission_type_key);

create table if not exists public.organization_mission_type_entitlements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_type_key text not null references public.mission_types(key) on delete restrict,
  status public.content_status not null default 'published',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, mission_type_key)
);

drop trigger if exists organization_mission_type_entitlements_set_updated_at
  on public.organization_mission_type_entitlements;
create trigger organization_mission_type_entitlements_set_updated_at
  before update on public.organization_mission_type_entitlements
  for each row execute function public.set_updated_at();

alter table public.organization_mission_type_entitlements enable row level security;

drop policy if exists "Organization mission type entitlements readable by members"
  on public.organization_mission_type_entitlements;
create policy "Organization mission type entitlements readable by members"
  on public.organization_mission_type_entitlements for select
  using (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(organization_id, null)
  );

drop policy if exists "Organization mission type entitlements writable by platform admins"
  on public.organization_mission_type_entitlements;
create policy "Organization mission type entitlements writable by platform admins"
  on public.organization_mission_type_entitlements for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function private.resolve_organization_entitlements_unchecked(p_organization_id uuid)
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

revoke execute on function private.resolve_organization_entitlements_unchecked(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.organization_entitlement_contains_text(
  p_organization_id uuid,
  p_entitlement_key text,
  p_value text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(private.resolve_organization_entitlements_unchecked(p_organization_id) -> p_entitlement_key, '[]'::jsonb)
    ) as entitlement(value)
    where entitlement.value = p_value
  );
$$;

revoke execute on function private.organization_entitlement_contains_text(uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function private.organization_integer_entitlement(
  p_organization_id uuid,
  p_entitlement_key text
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value jsonb := private.resolve_organization_entitlements_unchecked(p_organization_id) -> p_entitlement_key;
begin
  if v_value is null or jsonb_typeof(v_value) <> 'number' then
    return 0;
  end if;

  return greatest(0, (v_value #>> '{}')::integer);
exception when others then
  return 0;
end;
$$;

revoke execute on function private.organization_integer_entitlement(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_can_manage_organization_missions(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.current_user_has_organization_role(
      p_organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'content_editor'
      ]::public.organization_role_key[]
    );
$$;

revoke execute on function public.current_user_can_manage_organization_missions(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_manage_organization_missions(uuid)
  to authenticated, service_role;

create or replace function private.organization_mission_type_is_allowed(
  p_organization_id uuid,
  p_mission_type_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_mission_type_entitlements entitlement
    where entitlement.organization_id = p_organization_id
      and entitlement.mission_type_key = p_mission_type_key
      and entitlement.status = 'published'
  )
  or private.organization_entitlement_contains_text(
    p_organization_id,
    'allowed_mission_types',
    p_mission_type_key
  );
$$;

revoke execute on function private.organization_mission_type_is_allowed(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.organization_mission_reward_mode_is_allowed(
  p_organization_id uuid,
  p_reward_mode text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.organization_entitlement_contains_text(
    p_organization_id,
    'allowed_mission_reward_modes',
    p_reward_mode
  );
$$;

revoke execute on function private.organization_mission_reward_mode_is_allowed(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.enforce_mission_catalog_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_type_key text := private.mission_type_key_for_validation(new.validation_type);
  v_type public.mission_types%rowtype;
  v_active_org_mission_count integer := 0;
  v_max_active_org_missions integer := 0;
begin
  if new.mission_type_key is null then
    new.mission_type_key := v_expected_type_key;
  end if;

  if new.mission_type_key <> v_expected_type_key then
    raise exception 'Mission type does not match validation capability.';
  end if;

  select *
    into v_type
  from public.mission_types
  where key = new.mission_type_key
    and status = 'active';

  if not found then
    raise exception 'Mission type is not available.';
  end if;

  if not (new.repeatability = any(v_type.supported_repeatability)) then
    raise exception 'Mission repeatability is not supported by this mission type.';
  end if;

  if not (new.reward_mode = any(v_type.supported_reward_modes)) then
    raise exception 'Mission reward mode is not supported by this mission type.';
  end if;

  if new.catalog_scope = 'platform' then
    if new.reward_mode = 'organization_xp' then
      raise exception 'Platform missions cannot use organization XP reward mode.';
    end if;

    new.organization_id := null;
    new.source_mission_id := null;
  else
    if not private.organization_mission_type_is_allowed(new.organization_id, new.mission_type_key) then
      raise exception 'Organization is not entitled to this mission type.';
    end if;

    if not private.organization_mission_reward_mode_is_allowed(new.organization_id, new.reward_mode) then
      raise exception 'Organization is not entitled to this mission reward mode.';
    end if;

    if new.status = 'published' then
      select count(*)::integer
        into v_active_org_mission_count
      from public.missions mission
      where mission.organization_id = new.organization_id
        and mission.catalog_scope in ('organization_private', 'adapted_platform')
        and mission.status = 'published'
        and mission.id <> new.id;

      v_max_active_org_missions :=
        private.organization_integer_entitlement(new.organization_id, 'max_active_missions');

      if v_active_org_mission_count + 1 > v_max_active_org_missions then
        raise exception 'Organization active mission limit reached.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_mission_catalog_contract_trigger on public.missions;
create trigger enforce_mission_catalog_contract_trigger
  before insert or update on public.missions
  for each row execute function public.enforce_mission_catalog_contract();

revoke execute on function public.enforce_mission_catalog_contract()
  from public, anon, authenticated, service_role;

drop policy if exists "Published missions are readable" on public.missions;
create policy "Published missions are readable"
  on public.missions for select
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and catalog_scope = 'platform'
  );

drop policy if exists "Organization missions readable by organization members" on public.missions;
create policy "Organization missions readable by organization members"
  on public.missions for select
  using (
    catalog_scope in ('organization_private', 'adapted_platform')
    and status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and public.current_user_has_organization_role(organization_id, null)
  );

drop policy if exists "Organization missions readable by organization mission managers" on public.missions;
create policy "Organization missions readable by organization mission managers"
  on public.missions for select
  using (
    catalog_scope in ('organization_private', 'adapted_platform')
    and public.current_user_can_manage_organization_missions(organization_id)
  );

alter table public.programme_missions
  add column if not exists starts_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists is_required boolean not null default false,
  add column if not exists xp_account_id uuid,
  add column if not exists reward_xp_override integer check (reward_xp_override is null or reward_xp_override > 0),
  add column if not exists presentation_overrides jsonb not null default '{}'::jsonb,
  add column if not exists delivery_config jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.programme_missions
    add constraint programme_missions_p15b_config_json_valid
    check (
      jsonb_typeof(presentation_overrides) = 'object'
      and jsonb_typeof(delivery_config) = 'object'
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.programme_missions
    add constraint programme_missions_p15b_dates_valid
    check (due_at is null or starts_at is null or due_at > starts_at);
exception when duplicate_object then null;
end $$;

alter table public.mission_awards
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists programme_id uuid references public.programmes(id) on delete set null,
  add column if not exists programme_mission_id text,
  add column if not exists xp_account_id uuid;

create index if not exists mission_awards_org_programme_idx
  on public.mission_awards(organization_id, programme_id, programme_mission_id);

alter table public.mission_proofs
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists programme_id uuid references public.programmes(id) on delete set null,
  add column if not exists programme_mission_id text,
  add column if not exists xp_account_id uuid;

create index if not exists mission_proofs_org_programme_idx
  on public.mission_proofs(organization_id, programme_id, programme_mission_id, status);

drop policy if exists "Organization mission awards readable by organization report users"
  on public.mission_awards;
create policy "Organization mission awards readable by organization report users"
  on public.mission_awards for select
  using (
    organization_id is not null
    and public.current_user_has_organization_role(
      organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'instructor',
        'report_viewer'
      ]::public.organization_role_key[]
    )
  );

drop policy if exists "Organization mission proofs readable by organization staff"
  on public.mission_proofs;
create policy "Organization mission proofs readable by organization staff"
  on public.mission_proofs for select
  using (
    organization_id is not null
    and public.current_user_has_organization_role(
      organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'content_editor',
        'reviewer',
        'instructor'
      ]::public.organization_role_key[]
    )
  );

create table if not exists public.contextual_referral_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[a-zA-Z0-9_-]{16,96}$'),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  programme_id uuid references public.programmes(id) on delete cascade,
  programme_mission_id text,
  destination text not null default '/dashboard',
  eligibility_policy jsonb not null default '{}'::jsonb,
  presentation_config jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  status public.content_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contextual_referral_tokens_config_json_valid
    check (
      jsonb_typeof(eligibility_policy) = 'object'
      and jsonb_typeof(presentation_config) = 'object'
    ),
  constraint contextual_referral_tokens_programme_context
    check (
      programme_id is null
      or organization_id is not null
    )
);

create index if not exists contextual_referral_tokens_referrer_idx
  on public.contextual_referral_tokens(referrer_user_id, organization_id, programme_id);

drop trigger if exists contextual_referral_tokens_set_updated_at
  on public.contextual_referral_tokens;
create trigger contextual_referral_tokens_set_updated_at
  before update on public.contextual_referral_tokens
  for each row execute function public.set_updated_at();

alter table public.contextual_referral_tokens enable row level security;

drop policy if exists "Contextual referral tokens readable by owner and organization staff"
  on public.contextual_referral_tokens;
create policy "Contextual referral tokens readable by owner and organization staff"
  on public.contextual_referral_tokens for select
  using (
    auth.uid() = referrer_user_id
    or public.current_user_is_admin()
    or (
      organization_id is not null
      and public.current_user_has_organization_role(
        organization_id,
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'instructor',
          'report_viewer'
        ]::public.organization_role_key[]
      )
    )
  );

drop policy if exists "Contextual referral tokens writable by organization mission managers"
  on public.contextual_referral_tokens;
create policy "Contextual referral tokens writable by organization mission managers"
  on public.contextual_referral_tokens for all
  using (
    organization_id is not null
    and public.current_user_can_manage_organization_missions(organization_id)
  )
  with check (
    organization_id is not null
    and public.current_user_can_manage_organization_missions(organization_id)
  );

alter table public.referral_attributions
  add column if not exists contextual_referral_token_id uuid references public.contextual_referral_tokens(id) on delete set null,
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists programme_id uuid references public.programmes(id) on delete set null,
  add column if not exists programme_mission_id text,
  add column if not exists destination text,
  add column if not exists eligibility_policy jsonb not null default '{}'::jsonb;

alter table public.referral_attributions
  drop constraint if exists referral_attributions_referred_user_id_key;

create unique index if not exists referral_attributions_public_referred_once_idx
  on public.referral_attributions(referred_user_id)
  where organization_id is null
    and programme_id is null
    and programme_mission_id is null;

create unique index if not exists referral_attributions_context_referred_once_idx
  on public.referral_attributions(
    referred_user_id,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(programme_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(programme_mission_id, '')
  )
  where organization_id is not null
    or programme_id is not null
    or programme_mission_id is not null;

create index if not exists referral_attributions_context_idx
  on public.referral_attributions(organization_id, programme_id, programme_mission_id, referrer_user_id);

drop policy if exists "Organization referral attributions readable by organization staff"
  on public.referral_attributions;
create policy "Organization referral attributions readable by organization staff"
  on public.referral_attributions for select
  using (
    organization_id is not null
    and public.current_user_has_organization_role(
      organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'instructor',
        'report_viewer'
      ]::public.organization_role_key[]
    )
  );

create or replace function public.accept_contextual_referral(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_user_id uuid := auth.uid();
  v_token text := trim(coalesce(p_token, ''));
  v_referral public.contextual_referral_tokens%rowtype;
  v_created public.referral_attributions%rowtype;
begin
  if v_referred_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_token = '' then
    raise exception 'Referral token is required.';
  end if;

  select *
    into v_referral
  from public.contextual_referral_tokens
  where token = v_token
    and status = 'published'
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Referral link is not available.';
  end if;

  if v_referral.referrer_user_id = v_referred_user_id then
    raise exception 'You cannot use your own referral link.';
  end if;

  if exists (
    select 1
    from public.referral_attributions attribution
    where attribution.referred_user_id = v_referred_user_id
      and (
        attribution.contextual_referral_token_id = v_referral.id
        or (
          attribution.organization_id is not distinct from v_referral.organization_id
          and attribution.programme_id is not distinct from v_referral.programme_id
          and attribution.programme_mission_id is not distinct from v_referral.programme_mission_id
        )
      )
  ) then
    raise exception 'A referral has already been applied for this context.';
  end if;

  insert into public.referral_attributions (
    referral_code,
    referrer_user_id,
    referred_user_id,
    status,
    contextual_referral_token_id,
    organization_id,
    programme_id,
    programme_mission_id,
    destination,
    eligibility_policy
  )
  values (
    v_referral.token,
    v_referral.referrer_user_id,
    v_referred_user_id,
    'signed_up',
    v_referral.id,
    v_referral.organization_id,
    v_referral.programme_id,
    v_referral.programme_mission_id,
    v_referral.destination,
    v_referral.eligibility_policy
  )
  returning * into v_created;

  return jsonb_build_object(
    'status', 'accepted',
    'referralAttributionId', v_created.id,
    'organizationId', v_created.organization_id,
    'programmeId', v_created.programme_id,
    'programmeMissionId', v_created.programme_mission_id,
    'destination', v_created.destination
  );
end;
$$;

revoke execute on function public.accept_contextual_referral(text)
  from public, anon, authenticated, service_role;
grant execute on function public.accept_contextual_referral(text)
  to authenticated, service_role;

create or replace function public.ensure_contextual_referral_token(
  p_programme_id uuid,
  p_programme_mission_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_user_id uuid := auth.uid();
  v_programme public.programmes%rowtype;
  v_organization public.organizations%rowtype;
  v_programme_mission public.programme_missions%rowtype;
  v_mission public.missions%rowtype;
  v_existing public.contextual_referral_tokens%rowtype;
  v_created public.contextual_referral_tokens%rowtype;
  v_token text;
  v_destination text;
begin
  if v_referrer_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if p_programme_id is null then
    raise exception 'Programme id is required.';
  end if;

  if nullif(trim(coalesce(p_programme_mission_id, '')), '') is null then
    raise exception 'Programme mission id is required.';
  end if;

  select *
    into v_programme
  from public.programmes
  where id = p_programme_id
    and status = 'published';

  if not found or not public.current_user_can_enter_organization(v_programme.organization_id) then
    raise exception 'Programme mission context is not available.';
  end if;

  select *
    into v_organization
  from public.organizations
  where id = v_programme.organization_id;

  if not found then
    raise exception 'Programme mission context is not available.';
  end if;

  select *
    into v_programme_mission
  from public.programme_missions
  where programme_id = p_programme_id
    and mission_id = p_programme_mission_id;

  if not found then
    raise exception 'Programme mission context is not available.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_programme_mission_id
    and status = 'published'
    and validation_type = 'referral_friend_completed_lessons';

  if not found then
    raise exception 'Programme mission is not a referral mission.';
  end if;

  select *
    into v_existing
  from public.contextual_referral_tokens
  where referrer_user_id = v_referrer_user_id
    and organization_id = v_programme.organization_id
    and programme_id = p_programme_id
    and programme_mission_id = p_programme_mission_id
    and status = 'published'
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'available',
      'token', v_existing.token,
      'destination', v_existing.destination,
      'organizationId', v_existing.organization_id,
      'programmeId', v_existing.programme_id,
      'programmeMissionId', v_existing.programme_mission_id
    );
  end if;

  v_destination := '/o/' || v_organization.slug || '/missions';

  loop
    v_token := 'ctx_' || encode(extensions.gen_random_bytes(12), 'hex');

    begin
      insert into public.contextual_referral_tokens (
        token,
        referrer_user_id,
        organization_id,
        programme_id,
        programme_mission_id,
        destination,
        eligibility_policy,
        presentation_config,
        status
      )
      values (
        v_token,
        v_referrer_user_id,
        v_programme.organization_id,
        p_programme_id,
        p_programme_mission_id,
        v_destination,
        coalesce(v_mission.validation_config, '{}'::jsonb)
          || jsonb_build_object(
            'missionId', v_mission.id,
            'programmeId', p_programme_id,
            'programmeMissionId', p_programme_mission_id
          ),
        coalesce(v_mission.presentation_config, '{}'::jsonb)
          || coalesce(v_programme_mission.presentation_overrides, '{}'::jsonb),
        'published'
      )
      returning * into v_created;

      exit;
    exception
      when unique_violation then
        v_created := null;
    end;
  end loop;

  return jsonb_build_object(
    'status', 'created',
    'token', v_created.token,
    'destination', v_created.destination,
    'organizationId', v_created.organization_id,
    'programmeId', v_created.programme_id,
    'programmeMissionId', v_created.programme_mission_id
  );
end;
$$;

revoke execute on function public.ensure_contextual_referral_token(uuid, text)
  from public, anon;
grant execute on function public.ensure_contextual_referral_token(uuid, text)
  to authenticated, service_role;

create or replace function public.resolve_referral_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_public_token text := lower(trim(coalesce(p_token, '')));
  v_referral public.contextual_referral_tokens%rowtype;
  v_organization public.organizations%rowtype;
  v_referrer_user_id uuid;
  v_destination text;
begin
  if v_token = '' then
    return jsonb_build_object('kind', 'unknown', 'status', 'invalid');
  end if;

  select *
    into v_referral
  from public.contextual_referral_tokens
  where token = v_token
    and status = 'published'
    and (expires_at is null or expires_at > now())
  limit 1;

  if found then
    if v_referral.destination ~ '^/[A-Za-z0-9/_?&=.%#:+-]*$'
      and v_referral.destination !~ '^//'
    then
      v_destination := v_referral.destination;
    else
      v_destination := '/dashboard';
    end if;

    if v_referral.organization_id is not null then
      select *
        into v_organization
      from public.organizations
      where id = v_referral.organization_id;
    end if;

    return jsonb_build_object(
      'kind', 'contextual',
      'status', 'available',
      'token', v_referral.token,
      'destination', v_destination,
      'organizationId', v_referral.organization_id,
      'organizationSlug', v_organization.slug,
      'organizationName', coalesce(nullif(v_organization.short_name, ''), v_organization.name),
      'programmeId', v_referral.programme_id,
      'programmeMissionId', v_referral.programme_mission_id,
      'presentationConfig', v_referral.presentation_config,
      'expiresAt', v_referral.expires_at
    );
  end if;

  select id
    into v_referrer_user_id
  from public.profiles
  where lower(referral_code) = v_public_token
  limit 1;

  if v_referrer_user_id is not null then
    return jsonb_build_object(
      'kind', 'public',
      'status', 'available',
      'token', v_public_token,
      'destination', '/dashboard',
      'presentationConfig', '{}'::jsonb
    );
  end if;

  return jsonb_build_object('kind', 'unknown', 'status', 'invalid');
end;
$$;

revoke execute on function public.resolve_referral_invite(text)
  from public;
grant execute on function public.resolve_referral_invite(text)
  to anon, authenticated, service_role;

create or replace function public.grant_mission_award(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission public.missions%rowtype;
  v_reward public.rewards%rowtype;
  v_transaction_id uuid;
  v_redemption_id uuid := gen_random_uuid();
  v_inventory_item public.reward_inventory_items%rowtype;
  v_quantity_allocation public.reward_quantity_allocations%rowtype;
  v_payload jsonb := '{}'::jsonb;
  v_redemption_expires_at timestamptz;
  v_limit_start timestamptz;
  v_existing_count integer := 0;
  v_context jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_organization_id uuid := nullif(v_context ->> 'organizationId', '')::uuid;
  v_programme_id uuid := nullif(v_context ->> 'programmeId', '')::uuid;
  v_programme_mission_id text := nullif(trim(coalesce(v_context ->> 'programmeMissionId', '')), '');
  v_xp_account_id uuid := nullif(v_context ->> 'xpAccountId', '')::uuid;
  v_effective_reward_xp integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      coalesce(p_user_id::text, '') || ':' || coalesce(p_mission_id, '') || ':' || coalesce(p_award_scope, ''),
      0
    )
  );

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if exists (
    select 1
    from public.mission_awards
    where user_id = p_user_id
      and mission_id = p_mission_id
      and award_scope = p_award_scope
  ) then
    return jsonb_build_object('status', 'already_awarded');
  end if;

  v_effective_reward_xp := greatest(
    1,
    coalesce(nullif(v_context ->> 'rewardXpOverride', '')::integer, v_mission.reward_xp, 1)
  );

  if v_mission.reward_type = 'xp' then
    insert into public.xp_transactions (
      user_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      p_user_id,
      v_effective_reward_xp,
      'earn',
      'mission',
      v_mission.id,
      'mission:' || v_mission.id || ':' || p_award_scope,
      v_context || jsonb_build_object(
        'missionId', v_mission.id,
        'awardScope', p_award_scope,
        'organizationId', v_organization_id,
        'programmeId', v_programme_id,
        'programmeMissionId', v_programme_mission_id,
        'xpAccountId', v_xp_account_id,
        'awardedXp', v_effective_reward_xp
      )
    )
    on conflict (user_id, award_scope)
      where direction = 'earn' and award_scope is not null
      do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then
      return jsonb_build_object('status', 'already_awarded');
    end if;

    insert into public.mission_awards (
      user_id,
      mission_id,
      award_scope,
      xp_transaction_id,
      organization_id,
      programme_id,
      programme_mission_id,
      xp_account_id
    )
    values (
      p_user_id,
      v_mission.id,
      p_award_scope,
      v_transaction_id,
      v_organization_id,
      v_programme_id,
      v_programme_mission_id,
      v_xp_account_id
    );

    perform private.increment_profile_xp(p_user_id, v_effective_reward_xp);

    return jsonb_build_object(
      'status', 'awarded',
      'missionId', v_mission.id,
      'awardScope', p_award_scope,
      'rewardType', 'xp',
      'awardedXp', v_effective_reward_xp,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id
    );
  end if;

  if nullif(trim(coalesce(v_mission.reward_id, '')), '') is null then
    raise exception 'Mission reward is not configured.';
  end if;

  select *
    into v_reward
  from public.rewards
  where id = v_mission.reward_id
  for update;

  if not found
     or v_reward.status <> 'published'
     or not v_reward.is_enabled
     or (v_reward.starts_at is not null and v_reward.starts_at > now())
     or (v_reward.ends_at is not null and v_reward.ends_at <= now())
     or not public.campaign_is_live(v_reward.campaign_id)
     or coalesce(v_reward.distribution_mode, 'direct') = 'perk_bundle' then
    raise exception 'Configured mission reward is not available right now.';
  end if;

  if v_reward.offer_expires_at is not null and v_reward.offer_expires_at <= now() then
    raise exception 'Configured mission reward is not available right now.';
  end if;

  if v_reward.limit_period <> 'none' then
    if v_reward.limit_period = 'daily' then
      v_limit_start := ((now() at time zone 'Africa/Lagos')::date at time zone 'Africa/Lagos');
    elsif v_reward.limit_period = 'weekly' then
      v_limit_start := (
        ((now() at time zone 'Africa/Lagos')::date
          - (((extract(dow from (now() at time zone 'Africa/Lagos')::date)::integer + 6) % 7))::integer)
        at time zone 'Africa/Lagos'
      );
    elsif v_reward.limit_period = 'monthly' then
      v_limit_start := date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
    elsif v_reward.limit_period = 'campaign' then
      v_limit_start := coalesce(v_reward.starts_at, '-infinity'::timestamptz);
    end if;

    select count(*)
      into v_existing_count
    from public.reward_redemptions
    where user_id = p_user_id
      and reward_id = v_reward.id
      and claim_state not in ('cancelled', 'refunded')
      and (
        v_reward.limit_period = 'lifetime'
        or requested_at >= coalesce(v_limit_start, '-infinity'::timestamptz)
      );

    if v_existing_count >= v_reward.per_user_limit then
      raise exception 'This mission reward is not available for this account right now.';
    end if;
  end if;

  if v_reward.redemption_window_days is not null then
    v_redemption_expires_at := now() + make_interval(days => v_reward.redemption_window_days);
  end if;

  if v_reward.fulfillment_type in ('voucher_code', 'qr_code') then
    select *
      into v_inventory_item
    from public.reward_inventory_items
    where reward_id = v_reward.id
      and perk_prize_id is null
      and item_type = v_reward.fulfillment_type
      and status = 'available'
      and (available_from is null or available_from <= now())
      and (expires_at is null or expires_at > now())
      and public.campaign_is_live(campaign_id)
    order by coalesce(available_from, uploaded_at) asc, uploaded_at asc
    for update skip locked
    limit 1;

    if v_inventory_item.id is null then
      raise exception 'Configured mission reward is currently sold out.';
    end if;

    v_payload := v_inventory_item.payload;
  else
    select *
      into v_quantity_allocation
    from public.reward_quantity_allocations
    where reward_id = v_reward.id
      and perk_prize_id is null
      and quantity_available > 0
      and (available_from is null or available_from <= now())
      and (expires_at is null or expires_at > now())
      and public.campaign_is_live(campaign_id)
    order by coalesce(available_from, created_at) asc, created_at asc
    for update skip locked
    limit 1;

    if v_quantity_allocation.id is null then
      raise exception 'Configured mission reward is currently sold out.';
    end if;
  end if;

  if v_reward.fulfillment_type = 'external_link' then
    v_payload := jsonb_build_object(
      'url',
      v_reward.fulfillment_config ->> 'url',
      'label',
      coalesce(v_reward.fulfillment_config ->> 'buttonLabel', 'Open reward')
    );
  elsif v_reward.fulfillment_type = 'qr_code' and v_inventory_item.id is not null then
    v_payload := coalesce(
      v_inventory_item.payload,
      jsonb_build_object(
        'qrPayload',
        v_redemption_id::text,
        'reference',
        'qr:' || v_redemption_id::text
      )
    );
  end if;

  if v_quantity_allocation.id is not null then
    update public.reward_quantity_allocations
    set quantity_available = greatest(0, quantity_available - 1),
        updated_at = now()
    where id = v_quantity_allocation.id;

    perform public.refresh_reward_quantity_inventory_counts(v_reward.id);
  end if;

  insert into public.reward_redemptions (
    id,
    user_id,
    reward_id,
    status,
    xp_transaction_id,
    xp_cost_at_redemption,
    fulfillment_type,
    fulfillment_payload,
    inventory_item_id,
    quantity_allocation_id,
    claim_state,
    user_message,
    reward_title_snapshot,
    reward_description_snapshot,
    reward_thumbnail_snapshot,
    claim_steps_snapshot,
    fulfillment_config_snapshot,
    redemption_expires_at,
    claim_data
  )
  values (
    v_redemption_id,
    p_user_id,
    v_reward.id,
    'requested',
    null,
    0,
    v_reward.fulfillment_type,
    v_payload,
    v_inventory_item.id,
    v_quantity_allocation.id,
    case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    case
      when v_reward.fulfillment_type = 'manual' then 'Your reward has been added to history. Complete the claim form when you are ready.'
      when v_reward.fulfillment_type = 'voucher_code' then 'Your voucher code is ready.'
      when v_reward.fulfillment_type = 'qr_code' then 'Your QR pass is ready.'
      when v_reward.fulfillment_type = 'external_link' then 'Your reward is ready.'
      else 'Your reward is ready.'
    end,
    v_reward.title,
    v_reward.description,
    coalesce(v_reward.thumbnail, '{}'::jsonb),
    coalesce(v_reward.claim_steps, '[]'::jsonb),
    coalesce(v_reward.fulfillment_config, '{}'::jsonb),
    v_redemption_expires_at,
    v_context || jsonb_build_object(
      'missionId', v_mission.id,
      'rewardGrantedBy', 'mission',
      'awardScope', p_award_scope,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id,
      'xpAccountId', v_xp_account_id
    )
  );

  if v_inventory_item.id is not null then
    update public.reward_inventory_items
    set status = 'reserved',
        redemption_id = v_redemption_id,
        assigned_at = now()
    where id = v_inventory_item.id;

    perform public.refresh_reward_item_inventory_counts(v_reward.id);
  end if;

  if v_reward.fulfillment_type = 'native' then
    perform public.apply_native_reward_effect(
      p_user_id,
      v_redemption_id,
      v_reward.id,
      coalesce(v_reward.fulfillment_config, '{}'::jsonb)
    );
  end if;

  insert into public.mission_awards (
    user_id,
    mission_id,
    award_scope,
    reward_redemption_id,
    organization_id,
    programme_id,
    programme_mission_id,
    xp_account_id
  )
  values (
    p_user_id,
    v_mission.id,
    p_award_scope,
    v_redemption_id,
    v_organization_id,
    v_programme_id,
    v_programme_mission_id,
    v_xp_account_id
  );

  return jsonb_build_object(
    'status', 'awarded',
    'missionId', v_mission.id,
    'awardScope', p_award_scope,
    'rewardType', 'reward',
    'rewardId', v_reward.id,
    'rewardTitle', v_reward.title,
    'rewardRedemptionId', v_redemption_id,
    'claimState', case when v_reward.fulfillment_type = 'native' then 'fulfilled' else 'purchased' end,
    'organizationId', v_organization_id,
    'programmeId', v_programme_id,
    'programmeMissionId', v_programme_mission_id
  );
end;
$$;

create or replace function public.award_valid_mission_xp(
  p_mission_id text,
  p_award_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_valid boolean := false;
  v_lesson_id text;
  v_course_id text;
  v_required_count integer;
  v_within_days integer;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_referred_user_id uuid;
  v_minimum_account_age_hours integer := 24;
  v_required_fields text[];
  v_requires_manual_review boolean;
  v_requirement_mode text := 'all';
  v_programme_id uuid;
  v_programme public.programmes%rowtype;
  v_programme_mission public.programme_missions%rowtype;
  v_metadata jsonb := '{}'::jsonb;
  v_award_scope_payload text := p_award_scope;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_mission
    from public.missions
   where id = p_mission_id
     and status = 'published'
     and (starts_at is null or starts_at <= now())
     and (ends_at is null or ends_at > now());

  if v_mission.id is null then
    raise exception 'Mission not found.';
  end if;

  if p_award_scope ~ '^programme:' then
    v_programme_id := split_part(p_award_scope, ':', 2)::uuid;

    select *
      into v_programme
    from public.programmes
    where id = v_programme_id
      and status = 'published';

    if not found or not public.current_user_can_enter_organization(v_programme.organization_id) then
      raise exception 'Programme mission context is not available.';
    end if;

    select *
      into v_programme_mission
    from public.programme_missions
    where programme_id = v_programme_id
      and mission_id = p_mission_id;

    if not found then
      raise exception 'Programme mission context is not available.';
    end if;

    if v_programme_mission.starts_at is not null and v_programme_mission.starts_at > now() then
      raise exception 'Programme mission is not available yet.';
    end if;

    if v_programme_mission.due_at is not null and v_programme_mission.due_at <= now() then
      raise exception 'Programme mission is past its due date.';
    end if;

    v_metadata := jsonb_build_object(
      'organizationId', v_programme.organization_id,
      'programmeId', v_programme.id,
      'programmeMissionId', v_programme_mission.mission_id,
      'xpAccountId', v_programme_mission.xp_account_id,
      'rewardXpOverride', v_programme_mission.reward_xp_override
    );
    v_award_scope_payload := regexp_replace(p_award_scope, '^programme:[^:]+:', '');
  end if;

  case v_mission.validation_type
    when 'lesson_completed' then
      v_lesson_id := v_mission.validation_config ->> 'lessonId';
      select public.lesson_is_complete_for_user(v_user_id, v_lesson_id)
        into v_valid;

    when 'course_completed' then
      v_course_id := v_mission.validation_config ->> 'courseId';

      select count(*)
        into v_total_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.course_id = v_course_id
         and l.status = 'published'
         and c.status = 'published';

      select count(*)
        into v_completed_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.course_id = v_course_id
         and l.status = 'published'
         and c.status = 'published'
         and public.lesson_is_complete_for_user(v_user_id, l.id);

      v_valid := v_total_lessons > 0 and v_completed_lessons >= v_total_lessons;

    when 'lesson_count_completed' then
      v_required_count := greatest(1, coalesce((v_mission.validation_config ->> 'count')::integer, 1));
      v_within_days := nullif(v_mission.validation_config ->> 'withinDays', '')::integer;

      if v_within_days is null then
        select count(*)
          into v_completed_lessons
          from public.lessons l
          join public.courses c on c.id = l.course_id
         where l.status = 'published'
           and c.status = 'published'
           and public.lesson_is_complete_for_user(v_user_id, l.id);
      else
        select count(distinct lesson_id)
          into v_completed_lessons
          from public.lesson_progress
         where user_id = v_user_id
           and completed_at is not null
           and completed_at >= now() - make_interval(days => v_within_days);
      end if;

      v_valid := v_completed_lessons >= v_required_count;

    when 'referral_friend_completed_lessons' then
      v_required_count := greatest(
        1,
        coalesce((v_mission.validation_config ->> 'requiredFriendLessonCount')::integer, 1)
      );
      v_minimum_account_age_hours := greatest(
        0,
        coalesce((v_mission.validation_config ->> 'minimumAccountAgeHours')::integer, 24)
      );

      if v_award_scope_payload !~ '^referral:' then
        raise exception 'Invalid referral award scope.';
      end if;

      v_referred_user_id := replace(v_award_scope_payload, 'referral:', '')::uuid;

      if not exists (
        select 1
          from public.referral_attributions
         where referrer_user_id = v_user_id
           and referred_user_id = v_referred_user_id
           and created_at <= now() - make_interval(hours => v_minimum_account_age_hours)
           and (
             (
               v_programme_id is null
               and organization_id is null
               and programme_id is null
               and programme_mission_id is null
             )
             or (
               v_programme_id is not null
               and organization_id = v_programme.organization_id
               and programme_id = v_programme.id
               and programme_mission_id = v_programme_mission.mission_id
             )
           )
      ) then
        raise exception 'Referral is not eligible yet.';
      end if;

      select count(*)
        into v_completed_lessons
        from public.lessons l
        join public.courses c on c.id = l.course_id
       where l.status = 'published'
         and c.status = 'published'
         and public.lesson_is_complete_for_user(v_referred_user_id, l.id);

      v_valid := v_completed_lessons >= v_required_count;

    when 'proof_upload' then
      select array_agg(value::text)
        into v_required_fields
        from jsonb_array_elements_text(
          coalesce(v_mission.validation_config -> 'requiredFields', '["text"]'::jsonb)
        ) as value;

      v_requires_manual_review :=
        coalesce((v_mission.validation_config ->> 'requiresManualReview')::boolean, false);
      v_requirement_mode :=
        case
          when coalesce(v_mission.validation_config ->> 'requirementMode', 'all') = 'any' then 'any'
          else 'all'
        end;

      if v_requires_manual_review then
        select public.mission_proof_fields_satisfy(
          v_required_fields,
          v_requirement_mode,
          v_user_id,
          v_mission.id,
          p_award_scope,
          array['approved']
        )
          into v_valid;
      else
        select public.mission_proof_fields_satisfy(
          v_required_fields,
          v_requirement_mode,
          v_user_id,
          v_mission.id,
          p_award_scope,
          array['submitted', 'approved']
        )
          into v_valid;
      end if;

    else
      v_valid := false;
  end case;

  v_valid := coalesce(v_valid, false);

  if not v_valid then
    raise exception 'Mission is not complete.';
  end if;

  return public.grant_mission_award(v_user_id, v_mission.id, p_award_scope, v_metadata);
end;
$$;

create or replace function public.admin_create_organization_mission(
  p_organization_id uuid,
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_xp integer,
  p_repeatability public.mission_repeatability,
  p_mission_type_key text,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_presentation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_missions(p_organization_id) then
    raise exception 'Organization mission manager access required.';
  end if;

  if v_mission_id is null then
    raise exception 'Mission id is required.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  if p_reward_xp <= 0 then
    raise exception 'Reward XP must be greater than 0.';
  end if;

  if jsonb_typeof(coalesce(p_presentation_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Presentation configuration must be a JSON object.';
  end if;

  perform public.admin_assert_valid_mission_config(
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb)
  );

  insert into public.missions (
    id,
    title,
    description,
    category,
    reward_type,
    reward_xp,
    reward_id,
    repeatability,
    validation_type,
    validation_config,
    starts_at,
    ends_at,
    status,
    sort_order,
    catalog_scope,
    organization_id,
    mission_type_key,
    presentation_config,
    reward_mode,
    local_changes
  )
  values (
    v_mission_id,
    trim(p_title),
    trim(p_description),
    p_category,
    'xp',
    p_reward_xp,
    null,
    p_repeatability,
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb),
    p_starts_at,
    p_ends_at,
    p_status,
    coalesce(p_sort_order, 0),
    'organization_private',
    p_organization_id,
    p_mission_type_key,
    coalesce(p_presentation_config, '{}'::jsonb),
    'organization_xp',
    jsonb_build_object('createdFrom', 'organization_private')
  );

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_mission_created',
    'mission',
    v_mission_id,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'missionTypeKey', p_mission_type_key,
      'status', p_status
    )
  );

  return jsonb_build_object('missionId', v_mission_id, 'organizationId', p_organization_id);
end;
$$;

create or replace function public.admin_adapt_platform_mission(
  p_organization_id uuid,
  p_source_mission_id text,
  p_mission_id text,
  p_title text default null,
  p_description text default null,
  p_presentation_config jsonb default '{}'::jsonb,
  p_status public.content_status default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_source public.missions%rowtype;
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
begin
  if v_actor_id is null or not public.current_user_can_manage_organization_missions(p_organization_id) then
    raise exception 'Organization mission manager access required.';
  end if;

  if v_mission_id is null then
    raise exception 'Mission id is required.';
  end if;

  select *
    into v_source
  from public.missions
  where id = p_source_mission_id
    and catalog_scope = 'platform'
    and status <> 'archived';

  if not found then
    raise exception 'Platform mission not found.';
  end if;

  if jsonb_typeof(coalesce(p_presentation_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Presentation configuration must be a JSON object.';
  end if;

  insert into public.missions (
    id,
    title,
    description,
    category,
    reward_type,
    reward_xp,
    reward_id,
    repeatability,
    validation_type,
    validation_config,
    starts_at,
    ends_at,
    status,
    sort_order,
    catalog_scope,
    organization_id,
    source_mission_id,
    source_catalog_version,
    mission_type_key,
    presentation_config,
    reward_mode,
    local_changes
  )
  values (
    v_mission_id,
    coalesce(nullif(trim(p_title), ''), v_source.title),
    coalesce(nullif(trim(p_description), ''), v_source.description),
    v_source.category,
    'xp',
    coalesce(v_source.reward_xp, 1),
    null,
    v_source.repeatability,
    v_source.validation_type,
    v_source.validation_config,
    v_source.starts_at,
    v_source.ends_at,
    p_status,
    v_source.sort_order,
    'adapted_platform',
    p_organization_id,
    v_source.id,
    v_source.configuration_version,
    v_source.mission_type_key,
    coalesce(p_presentation_config, '{}'::jsonb),
    'organization_xp',
    jsonb_build_object(
      'sourceTitle', v_source.title,
      'sourceDescription', v_source.description
    )
  );

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_mission_adapted',
    'mission',
    v_mission_id,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'sourceMissionId', v_source.id,
      'missionTypeKey', v_source.mission_type_key,
      'status', p_status
    )
  );

  return jsonb_build_object(
    'missionId', v_mission_id,
    'organizationId', p_organization_id,
    'sourceMissionId', v_source.id
  );
end;
$$;

revoke execute on function public.admin_create_organization_mission(
  uuid,
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  text,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer
) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_organization_mission(
  uuid,
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  text,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer
) to authenticated, service_role;

revoke execute on function public.admin_adapt_platform_mission(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  public.content_status
) from public, anon, authenticated, service_role;
grant execute on function public.admin_adapt_platform_mission(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  public.content_status
) to authenticated, service_role;

create or replace function public.admin_assert_valid_mission_config(
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required_fields text[];
  v_field text;
begin
  if not exists (
    select 1
    from public.mission_types
    where key = private.mission_type_key_for_validation(p_validation_type)
      and status = 'active'
  ) then
    raise exception 'Mission type is not available.';
  end if;

  if jsonb_typeof(coalesce(p_validation_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Mission configuration must be a JSON object.';
  end if;

  case p_validation_type
    when 'course_completed' then
      if nullif(trim(coalesce(p_validation_config ->> 'courseId', '')), '') is null then
        raise exception 'Choose a course.';
      end if;
    when 'lesson_completed' then
      if nullif(trim(coalesce(p_validation_config ->> 'lessonId', '')), '') is null then
        raise exception 'Choose a lesson.';
      end if;
    when 'lesson_count_completed' then
      if greatest(1, coalesce((p_validation_config ->> 'count')::integer, 0)) <= 0 then
        raise exception 'Lesson count must be at least 1.';
      end if;
      if coalesce(nullif(p_validation_config ->> 'withinDays', ''), '0') <> '0'
         and coalesce((p_validation_config ->> 'withinDays')::integer, 0) <= 0 then
        raise exception 'Within days must be at least 1 when set.';
      end if;
    when 'referral_friend_completed_lessons' then
      if greatest(1, coalesce((p_validation_config ->> 'requiredFriendLessonCount')::integer, 0)) <= 0 then
        raise exception 'Required friend lesson count must be at least 1.';
      end if;
      if coalesce((p_validation_config ->> 'minimumAccountAgeHours')::integer, 24) < 0 then
        raise exception 'Minimum account age hours cannot be negative.';
      end if;
    when 'proof_upload' then
      select coalesce(array_agg(value::text), '{}')
        into v_required_fields
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(coalesce(p_validation_config -> 'requiredFields', '[]'::jsonb)) = 'array'
            then coalesce(p_validation_config -> 'requiredFields', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as value;

      if cardinality(v_required_fields) = 0 then
        raise exception 'Choose at least one required proof field.';
      end if;

      foreach v_field in array v_required_fields loop
        if v_field not in ('image', 'video', 'text', 'link', 'location') then
          raise exception 'Unsupported proof field: %', v_field;
        end if;
      end loop;
    when 'manual_review' then
      if nullif(trim(coalesce(p_validation_config ->> 'instructions', '')), '') is null then
        raise exception 'Add manual review instructions.';
      end if;
  end case;
end;
$$;

create or replace function public.admin_create_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_type text,
  p_reward_xp integer,
  p_reward_id text,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission_id text := nullif(trim(coalesce(p_mission_id, '')), '');
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
  v_mission_type_key text := private.mission_type_key_for_validation(p_validation_type);
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can create a mission.';
  end if;

  if v_mission_id is null then
    raise exception 'Mission id is required.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  perform public.admin_assert_valid_mission_reward(p_reward_type, p_reward_xp, v_reward_id);
  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

  insert into public.missions (
    id,
    title,
    description,
    category,
    reward_type,
    reward_xp,
    reward_id,
    repeatability,
    validation_type,
    validation_config,
    starts_at,
    ends_at,
    status,
    sort_order,
    catalog_scope,
    mission_type_key,
    reward_mode
  )
  values (
    v_mission_id,
    trim(p_title),
    trim(p_description),
    p_category,
    p_reward_type,
    case when p_reward_type = 'xp' then p_reward_xp else null end,
    case when p_reward_type = 'reward' then v_reward_id else null end,
    p_repeatability,
    p_validation_type,
    coalesce(p_validation_config, '{}'::jsonb),
    p_starts_at,
    p_ends_at,
    p_status,
    coalesce(p_sort_order, 0),
    'platform',
    v_mission_type_key,
    case when p_reward_type = 'reward' then 'direct_reward' else 'platform_xp' end
  );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_created',
    'mission',
    v_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'missionTypeKey', v_mission_type_key,
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  return jsonb_build_object('missionId', v_mission_id);
end;
$$;

create or replace function public.admin_update_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_type text,
  p_reward_xp integer,
  p_reward_id text,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reward_id text := nullif(trim(coalesce(p_reward_id, '')), '');
  v_mission public.missions%rowtype;
  v_mission_type_key text := private.mission_type_key_for_validation(p_validation_type);
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update a mission.';
  end if;

  if nullif(trim(coalesce(p_mission_id, '')), '') is null then
    raise exception 'Mission id is required.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if v_mission.catalog_scope <> 'platform' then
    raise exception 'Use organization mission workflows for organization-owned missions.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  perform public.admin_assert_valid_mission_reward(p_reward_type, p_reward_xp, v_reward_id);
  perform public.admin_assert_valid_mission_config(p_validation_type, coalesce(p_validation_config, '{}'::jsonb));

  update public.missions
  set title = trim(p_title),
      description = trim(p_description),
      category = p_category,
      reward_type = p_reward_type,
      reward_xp = case when p_reward_type = 'xp' then p_reward_xp else null end,
      reward_id = case when p_reward_type = 'reward' then v_reward_id else null end,
      repeatability = p_repeatability,
      validation_type = p_validation_type,
      validation_config = coalesce(p_validation_config, '{}'::jsonb),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      sort_order = coalesce(p_sort_order, 0),
      mission_type_key = v_mission_type_key,
      reward_mode = case when p_reward_type = 'reward' then 'direct_reward' else 'platform_xp' end,
      configuration_version = configuration_version + 1,
      updated_at = now()
  where id = p_mission_id;

  update public.missions
  set upstream_update_available = true
  where source_mission_id = p_mission_id
    and source_catalog_version < (
      select configuration_version
      from public.missions
      where id = p_mission_id
    );

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_updated',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'category', p_category,
      'repeatability', p_repeatability,
      'validationType', p_validation_type,
      'missionTypeKey', v_mission_type_key,
      'status', p_status,
      'rewardType', p_reward_type,
      'rewardId', v_reward_id
    )
  );

  return jsonb_build_object('missionId', p_mission_id);
end;
$$;

create or replace function public.admin_update_organization_mission(
  p_mission_id text,
  p_title text,
  p_description text,
  p_category public.mission_category,
  p_reward_xp integer,
  p_repeatability public.mission_repeatability,
  p_validation_type public.mission_validation_type,
  p_validation_config jsonb default '{}'::jsonb,
  p_presentation_config jsonb default '{}'::jsonb,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_status public.content_status default 'draft',
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_mission_type_key text := private.mission_type_key_for_validation(p_validation_type);
  v_next_category public.mission_category := p_category;
  v_next_reward_xp integer := p_reward_xp;
  v_next_repeatability public.mission_repeatability := p_repeatability;
  v_next_validation_type public.mission_validation_type := p_validation_type;
  v_next_validation_config jsonb := coalesce(p_validation_config, '{}'::jsonb);
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(coalesce(p_mission_id, '')), '') is null then
    raise exception 'Mission id is required.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if v_mission.catalog_scope not in (
    'organization_private'::public.mission_catalog_scope,
    'adapted_platform'::public.mission_catalog_scope
  ) then
    raise exception 'Use platform mission workflows for platform missions.';
  end if;

  if not public.current_user_can_manage_organization_missions(v_mission.organization_id) then
    raise exception 'Organization mission manager access required.';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Mission title is required.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Mission description is required.';
  end if;

  if jsonb_typeof(coalesce(p_presentation_config, '{}'::jsonb)) <> 'object' then
    raise exception 'Presentation configuration must be a JSON object.';
  end if;

  if v_mission.catalog_scope = 'adapted_platform'::public.mission_catalog_scope then
    v_next_category := v_mission.category;
    v_next_reward_xp := coalesce(v_mission.reward_xp, 1);
    v_next_repeatability := v_mission.repeatability;
    v_next_validation_type := v_mission.validation_type;
    v_next_validation_config := v_mission.validation_config;
    v_mission_type_key := v_mission.mission_type_key;
  else
    if p_reward_xp <= 0 then
      raise exception 'Reward XP must be greater than 0.';
    end if;

    perform public.admin_assert_valid_mission_config(
      p_validation_type,
      coalesce(p_validation_config, '{}'::jsonb)
    );
  end if;

  update public.missions
  set title = trim(p_title),
      description = trim(p_description),
      category = v_next_category,
      reward_type = 'xp',
      reward_xp = v_next_reward_xp,
      reward_id = null,
      repeatability = v_next_repeatability,
      validation_type = v_next_validation_type,
      validation_config = v_next_validation_config,
      presentation_config = coalesce(p_presentation_config, '{}'::jsonb),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      sort_order = coalesce(p_sort_order, 0),
      mission_type_key = v_mission_type_key,
      reward_mode = 'organization_xp',
      local_changes = coalesce(local_changes, '{}'::jsonb)
        || jsonb_build_object(
          'updatedFrom', v_mission.catalog_scope,
          'updatedAt', now()
        ),
      configuration_version = configuration_version + 1,
      updated_at = now()
  where id = p_mission_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'organization_mission_updated',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'organizationId', v_mission.organization_id,
      'catalogScope', v_mission.catalog_scope,
      'missionTypeKey', v_mission_type_key,
      'status', p_status,
      'sourceMissionId', v_mission.source_mission_id
    )
  );

  return jsonb_build_object(
    'missionId', p_mission_id,
    'organizationId', v_mission.organization_id,
    'catalogScope', v_mission.catalog_scope
  );
end;
$$;

revoke execute on function public.admin_update_organization_mission(
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer
) from public, anon;
grant execute on function public.admin_update_organization_mission(
  text,
  text,
  text,
  public.mission_category,
  integer,
  public.mission_repeatability,
  public.mission_validation_type,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  public.content_status,
  integer
) to authenticated, service_role;

drop trigger if exists enforce_programme_mission_catalog_scope_trigger on public.programme_missions;

create or replace function public.enforce_programme_mission_catalog_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes%rowtype;
  v_mission public.missions%rowtype;
begin
  select *
    into v_programme
  from public.programmes
  where id = new.programme_id;

  if not found then
    raise exception 'Programme not found.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = new.mission_id;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if v_mission.status = 'archived' then
    raise exception 'Archived missions cannot be added to programmes.';
  end if;

  if v_mission.catalog_scope <> 'platform'
    and v_mission.organization_id <> v_programme.organization_id
  then
    raise exception 'Organisation-owned missions can only be used by programmes in the same organisation.';
  end if;

  return new;
end;
$$;

create trigger enforce_programme_mission_catalog_scope_trigger
  before insert or update on public.programme_missions
  for each row execute function public.enforce_programme_mission_catalog_scope();

revoke execute on function public.enforce_programme_mission_catalog_scope()
  from public, anon, authenticated, service_role;

create or replace function public.admin_set_mission_status(
  p_mission_id text,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Missions can only be published or moved to draft from this control.';
  end if;

  select *
    into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if not found then
    raise exception 'Mission not found.';
  end if;

  if v_mission.catalog_scope = 'platform'::public.mission_catalog_scope then
    if not public.current_user_is_admin() then
      raise exception 'Only a platform admin can update platform mission status.';
    end if;
  elsif not public.current_user_can_manage_organization_missions(v_mission.organization_id) then
    raise exception 'Organization mission manager access required.';
  end if;

  update public.missions
  set status = v_status,
      updated_at = now()
  where id = p_mission_id;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'mission_status_changed',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'status', v_status,
      'previousStatus', v_mission.status,
      'catalogScope', v_mission.catalog_scope,
      'organizationId', v_mission.organization_id
    )
  );

  if v_mission.catalog_scope = 'platform'::public.mission_catalog_scope
    and v_mission.status is distinct from 'published'::public.content_status
    and v_status = 'published'::public.content_status
  then
    perform public.queue_broadcast_notification(
      'missions',
      'new_mission',
      'New mission',
      'A new mission is ready. Earn more XP.',
      '/missions',
      'View mission',
      jsonb_build_object('missionId', p_mission_id),
      'broadcast-new-mission:' || p_mission_id
    );
  end if;

  return jsonb_build_object('missionId', p_mission_id, 'status', v_status);
end;
$$;

revoke execute on function public.admin_set_mission_status(text, public.content_status)
  from public, anon;
grant execute on function public.admin_set_mission_status(text, public.content_status)
  to authenticated, service_role;

create or replace function public.admin_update_programme_mission_delivery(
  p_programme_id uuid,
  p_mission_delivery_configs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_config record;
  v_payload jsonb;
  v_starts_at timestamptz;
  v_due_at timestamptz;
  v_is_required boolean;
  v_reward_xp_override integer;
  v_presentation_overrides jsonb;
  v_delivery_config jsonb;
  v_updated_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_can_manage_programme(p_programme_id) then
    raise exception 'Programme manager access required.';
  end if;

  if not exists(select 1 from public.programmes where id = p_programme_id and status <> 'archived') then
    raise exception 'Programme not found.';
  end if;

  if jsonb_typeof(coalesce(p_mission_delivery_configs, '{}'::jsonb)) <> 'object' then
    raise exception 'Programme mission delivery configuration must be a JSON object.';
  end if;

  for v_config in
    select key as mission_id, value as payload
    from jsonb_each(coalesce(p_mission_delivery_configs, '{}'::jsonb))
  loop
    if trim(v_config.mission_id) = '' then
      raise exception 'Programme mission delivery config must reference attached missions.';
    end if;

    if not exists (
      select 1
      from public.programme_missions
      where programme_id = p_programme_id
        and mission_id = v_config.mission_id
    ) then
      raise exception 'Programme mission delivery config must reference attached missions.';
    end if;

    v_payload := coalesce(v_config.payload, '{}'::jsonb);

    if jsonb_typeof(v_payload) <> 'object' then
      raise exception 'Programme mission delivery configuration must be a JSON object.';
    end if;

    if nullif(trim(coalesce(v_payload ->> 'xpAccountId', '')), '') is not null then
      raise exception 'Programme mission XP account selection is not available until organization XP accounts are enabled.';
    end if;

    v_starts_at := nullif(trim(coalesce(v_payload ->> 'startsAt', '')), '')::timestamptz;
    v_due_at := nullif(trim(coalesce(v_payload ->> 'dueAt', '')), '')::timestamptz;
    v_is_required := coalesce((v_payload ->> 'isRequired')::boolean, false);
    v_reward_xp_override := nullif(trim(coalesce(v_payload ->> 'rewardXpOverride', '')), '')::integer;
    v_presentation_overrides := coalesce(v_payload -> 'presentationOverrides', '{}'::jsonb);
    v_delivery_config := coalesce(v_payload -> 'deliveryConfig', '{}'::jsonb);

    if v_due_at is not null and v_starts_at is not null and v_due_at <= v_starts_at then
      raise exception 'Programme mission due date must be after its start date.';
    end if;

    if v_reward_xp_override is not null and v_reward_xp_override <= 0 then
      raise exception 'Programme mission point override must be positive.';
    end if;

    if jsonb_typeof(v_presentation_overrides) <> 'object'
      or jsonb_typeof(v_delivery_config) <> 'object'
    then
      raise exception 'Programme mission delivery configuration must be a JSON object.';
    end if;

    update public.programme_missions
    set starts_at = v_starts_at,
        due_at = v_due_at,
        is_required = v_is_required,
        xp_account_id = null,
        reward_xp_override = v_reward_xp_override,
        presentation_overrides = v_presentation_overrides,
        delivery_config = v_delivery_config
    where programme_id = p_programme_id
      and mission_id = v_config.mission_id;

    v_updated_count := v_updated_count + 1;
  end loop;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'programme_mission_delivery_updated',
    'programme',
    p_programme_id::text,
    jsonb_build_object('missionCount', v_updated_count)
  );

  return jsonb_build_object('programmeId', p_programme_id, 'missionCount', v_updated_count);
end;
$$;

revoke execute on function public.admin_update_programme_mission_delivery(uuid, jsonb)
  from public, anon;
grant execute on function public.admin_update_programme_mission_delivery(uuid, jsonb)
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
values
  (
    'public',
    'current_user_can_manage_organization_missions',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, RLS policies and mission RPCs checking contextual organisation mission management rights.',
    'Allows platform admins or active organisation_owner, organisation_admin, programme_manager or content_editor memberships for the requested organization id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_create_organization_mission',
    'p_organization_id uuid, p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_xp integer, p_repeatability mission_repeatability, p_mission_type_key text, p_validation_type mission_validation_type, p_validation_config jsonb, p_presentation_config jsonb, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_status content_status, p_sort_order integer',
    'ADMIN_AUTHENTICATED',
    'Contextual organisation mission manager workflow for creating organisation-private missions from entitled mission types.',
    'Requires auth.uid(), organisation mission management rights, plan/mission-type entitlement checks and central mission configuration validation before insertion.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_adapt_platform_mission',
    'p_organization_id uuid, p_source_mission_id text, p_mission_id text, p_title text, p_description text, p_presentation_config jsonb, p_status content_status',
    'ADMIN_AUTHENTICATED',
    'Contextual organisation mission manager workflow for adapting canonical Project Ve missions without modifying the source mission.',
    'Requires auth.uid(), organisation mission management rights, a platform source mission and plan/mission-type entitlement checks before insertion.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_organization_mission',
    'p_mission_id text, p_title text, p_description text, p_category mission_category, p_reward_xp integer, p_repeatability mission_repeatability, p_validation_type mission_validation_type, p_validation_config jsonb, p_presentation_config jsonb, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_status content_status, p_sort_order integer',
    'ADMIN_AUTHENTICATED',
    'Contextual organisation mission manager workflow for editing organisation-private missions and local presentation on adapted platform missions.',
    'Requires auth.uid(); authorization is resolved from the stored mission organization, organisation-private missions may update executable configuration, and adapted platform missions preserve source handler configuration.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_set_mission_status',
    'p_mission_id text, p_status content_status',
    'ADMIN_AUTHENTICATED',
    'Contextual mission publishing workflow for platform admins and organisation mission managers.',
    'Requires auth.uid(); platform missions require platform admin rights, while organisation-owned missions require contextual organisation mission management rights for the mission organization.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_programme_mission_delivery',
    'p_programme_id uuid, p_mission_delivery_configs jsonb',
    'ADMIN_AUTHENTICATED',
    'Programme manager workflow for programme-specific mission dates, required status, presentation overrides and point overrides.',
    'Requires auth.uid() and contextual programme manager rights; every configured mission must already be attached to the programme, and client-supplied XP account ids are rejected until organisation XP accounts are enabled.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'accept_contextual_referral',
    'p_token text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learner contextual referral acceptance workflow.',
    'Requires auth.uid(), a published unexpired contextual referral token, rejects self-referral and prevents duplicate attribution in the same organisation/programme/mission context.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'ensure_contextual_referral_token',
    'p_programme_id uuid, p_programme_mission_id text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learner/referrer workflow for obtaining a contextual invite token for a referral programme mission they can access.',
    'Requires auth.uid(), a published programme, current_user_can_enter_organization for the programme organization, and an attached published referral mission before returning or creating a token.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'resolve_referral_invite',
    'p_token text',
    'PUBLIC_ANON',
    'Invite landing page resolver for public referral codes and published contextual referral tokens.',
    'Returns only safe destination and presentation metadata for available invites; attribution still requires authenticated accept_referral or accept_contextual_referral.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'enforce_mission_catalog_contract',
    '',
    'TRIGGER_ONLY',
    'Mission catalogue, mission-type and organisation entitlement enforcement trigger.',
    'Runs only as a table trigger to ensure missions map to registered active mission types and organisation-owned missions stay within entitlements.',
    array[]::text[]
  ),
  (
    'public',
    'enforce_programme_mission_catalog_scope',
    '',
    'TRIGGER_ONLY',
    'Programme mission ownership enforcement trigger.',
    'Runs only as a table trigger to ensure organisation-owned missions cannot be attached to programmes from another organisation.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
