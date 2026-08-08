create or replace function private.resolve_organization_entitlements_unchecked(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_entitlements jsonb;
  v_overrides jsonb;
begin
  if p_organization_id is null then
    raise exception 'Organization is required.';
  end if;

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
    select plan.entitlements
      into v_entitlements
    from public.organization_plans plan
    where plan.key = 'starter';
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

revoke execute on function private.resolve_organization_entitlements_unchecked(uuid) from public, anon, authenticated, service_role;

create or replace function private.organization_entitlement_integer_unchecked(
  p_organization_id uuid,
  p_entitlement_key text
)
returns bigint
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_value jsonb;
begin
  v_value := private.resolve_organization_entitlements_unchecked(p_organization_id) -> p_entitlement_key;

  if v_value is null or jsonb_typeof(v_value) <> 'number' then
    return 0;
  end if;

  return greatest((v_value #>> '{}')::bigint, 0);
end;
$$;

revoke execute on function private.organization_entitlement_integer_unchecked(uuid, text) from public, anon, authenticated, service_role;

create or replace function private.organization_entitlement_text_array_contains_unchecked(
  p_organization_id uuid,
  p_entitlement_key text,
  p_requested_value text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_value jsonb;
begin
  if p_requested_value is null or length(trim(p_requested_value)) = 0 then
    return false;
  end if;

  v_value := private.resolve_organization_entitlements_unchecked(p_organization_id) -> p_entitlement_key;

  if v_value is null or jsonb_typeof(v_value) <> 'array' then
    return false;
  end if;

  return exists (
    select 1
    from jsonb_array_elements_text(v_value) allowed(value)
    where allowed.value = p_requested_value
  );
end;
$$;

revoke execute on function private.organization_entitlement_text_array_contains_unchecked(uuid, text, text) from public, anon, authenticated, service_role;

create or replace function private.learning_media_asset_storage_size(p_metadata jsonb)
returns bigint
language plpgsql
immutable
set search_path = public, private
as $$
declare
  v_size_text text;
begin
  if p_metadata is null
     or jsonb_typeof(p_metadata) <> 'object'
     or not (p_metadata ? 'size') then
    return 0;
  end if;

  v_size_text := p_metadata ->> 'size';

  if v_size_text is null or v_size_text !~ '^[0-9]+$' then
    return 0;
  end if;

  return greatest(v_size_text::bigint, 0);
end;
$$;

revoke execute on function private.learning_media_asset_storage_size(jsonb) from public, anon, authenticated, service_role;

create or replace function private.learning_media_asset_organization_id(
  p_course_id text,
  p_lesson_id text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_course_org_id uuid;
  v_lesson_org_id uuid;
  v_lesson_course_id text;
begin
  if p_course_id is not null then
    select course.organization_id
      into v_course_org_id
    from public.courses course
    where course.id = p_course_id;
  end if;

  if p_lesson_id is not null then
    select course.organization_id, lesson.course_id
      into v_lesson_org_id, v_lesson_course_id
    from public.lessons lesson
    join public.courses course
      on course.id = lesson.course_id
    where lesson.id = p_lesson_id;
  end if;

  if p_course_id is not null
     and p_lesson_id is not null
     and v_lesson_course_id is not null
     and v_lesson_course_id <> p_course_id then
    raise exception 'Media asset course and lesson must belong to the same course.'
      using errcode = 'check_violation';
  end if;

  return coalesce(v_lesson_org_id, v_course_org_id);
end;
$$;

revoke execute on function private.learning_media_asset_organization_id(text, text) from public, anon, authenticated, service_role;

create or replace function private.organization_learning_storage_bytes_unchecked(p_organization_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(sum(private.learning_media_asset_storage_size(asset.metadata)), 0)::bigint
  from public.learning_media_assets asset
  left join public.courses direct_course
    on direct_course.id = asset.course_id
  left join public.lessons lesson
    on lesson.id = asset.lesson_id
  left join public.courses lesson_course
    on lesson_course.id = lesson.course_id
  where coalesce(lesson_course.organization_id, direct_course.organization_id) = p_organization_id
    and asset.storage_path is not null
    and asset.asset_type in ('image', 'infographic', 'thumbnail', 'cover');
$$;

revoke execute on function private.organization_learning_storage_bytes_unchecked(uuid) from public, anon, authenticated, service_role;

create or replace function public.organization_learning_storage_bytes(p_organization_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if p_organization_id is null then
    raise exception 'Organization is required.';
  end if;

  if auth.uid() is null
     or not (
       public.current_user_is_admin()
       or public.current_user_has_organization_role(p_organization_id, null)
       or public.current_user_can_manage_organization(p_organization_id)
     ) then
    raise exception 'You cannot read organization storage usage.';
  end if;

  return private.organization_learning_storage_bytes_unchecked(p_organization_id);
end;
$$;

revoke execute on function public.organization_learning_storage_bytes(uuid) from public, anon, authenticated, service_role;
grant execute on function public.organization_learning_storage_bytes(uuid) to authenticated, service_role;

create or replace function private.enforce_organization_course_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_existing_count bigint;
  v_max_courses bigint;
begin
  if new.organization_id is null
     or new.catalog_scope = 'platform'
     or coalesce(new.status::text, 'draft') = 'archived' then
    return new;
  end if;

  v_max_courses := private.organization_entitlement_integer_unchecked(new.organization_id, 'max_courses');

  select count(*)
    into v_existing_count
  from public.courses course
  where course.organization_id = new.organization_id
    and course.catalog_scope <> 'platform'
    and coalesce(course.status::text, 'draft') <> 'archived'
    and (tg_op = 'INSERT' or course.id <> old.id);

  if v_existing_count + 1 > v_max_courses then
    if v_max_courses = 1 then
      raise exception 'You have used your Starter course allowance. Upgrade to create another course.'
        using errcode = 'check_violation';
    end if;

    raise exception 'This organisation can create up to % courses on its current plan.', v_max_courses
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_organization_course_entitlements() from public, anon, authenticated, service_role;

create or replace function private.enforce_organization_lesson_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_organization_id uuid;
  v_existing_count bigint;
  v_max_lessons bigint;
begin
  if coalesce(new.status::text, 'draft') = 'archived' then
    return new;
  end if;

  select course.organization_id
    into v_organization_id
  from public.courses course
  where course.id = new.course_id;

  if v_organization_id is null then
    return new;
  end if;

  v_max_lessons := private.organization_entitlement_integer_unchecked(v_organization_id, 'max_total_lessons');

  select count(*)
    into v_existing_count
  from public.lessons lesson
  join public.courses course
    on course.id = lesson.course_id
  where course.organization_id = v_organization_id
    and course.catalog_scope <> 'platform'
    and coalesce(course.status::text, 'draft') <> 'archived'
    and coalesce(lesson.status::text, 'draft') <> 'archived'
    and (tg_op = 'INSERT' or lesson.id <> old.id);

  if v_existing_count + 1 > v_max_lessons then
    if v_max_lessons = 5 then
      raise exception 'Starter organisations can create up to five lessons.'
        using errcode = 'check_violation';
    end if;

    raise exception 'This organisation can create up to % lessons on its current plan.', v_max_lessons
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_organization_lesson_entitlements() from public, anon, authenticated, service_role;

create or replace function private.enforce_organization_lesson_block_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_organization_id uuid;
  v_block_type text := new.block_type::text;
begin
  select course.organization_id
    into v_organization_id
  from public.lesson_pages page
  join public.lessons lesson
    on lesson.id = page.lesson_id
  join public.courses course
    on course.id = lesson.course_id
  where page.id = new.page_id;

  if v_organization_id is null then
    return new;
  end if;

  if not private.organization_entitlement_text_array_contains_unchecked(
    v_organization_id,
    'allowed_lesson_block_types',
    v_block_type
  ) then
    if v_block_type in ('video', 'audio') then
      raise exception 'Video and audio lessons are available on paid organisation plans.'
        using errcode = 'check_violation';
    end if;

    raise exception 'This lesson block type is not available on the organisation plan.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_organization_lesson_block_entitlements() from public, anon, authenticated, service_role;

create or replace function private.enforce_organization_learning_media_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_organization_id uuid;
  v_old_organization_id uuid;
  v_current_storage_bytes bigint;
  v_max_storage_bytes bigint;
  v_new_storage_bytes bigint := 0;
  v_old_storage_bytes bigint := 0;
begin
  v_organization_id := private.learning_media_asset_organization_id(new.course_id, new.lesson_id);

  if v_organization_id is null then
    return new;
  end if;

  if new.asset_type in ('video', 'audio')
     and not private.organization_entitlement_text_array_contains_unchecked(
       v_organization_id,
       'allowed_lesson_block_types',
       new.asset_type
     ) then
    raise exception 'Video and audio lessons are available on paid organisation plans.'
      using errcode = 'check_violation';
  end if;

  if new.storage_path is not null
     and new.asset_type in ('image', 'infographic', 'thumbnail', 'cover') then
    v_new_storage_bytes := private.learning_media_asset_storage_size(new.metadata);
  end if;

  if tg_op = 'UPDATE' then
    v_old_organization_id := private.learning_media_asset_organization_id(old.course_id, old.lesson_id);
    if v_old_organization_id = v_organization_id
       and old.storage_path is not null
       and old.asset_type in ('image', 'infographic', 'thumbnail', 'cover') then
      v_old_storage_bytes := private.learning_media_asset_storage_size(old.metadata);
    end if;
  end if;

  v_current_storage_bytes := private.organization_learning_storage_bytes_unchecked(v_organization_id);
  v_max_storage_bytes := private.organization_entitlement_integer_unchecked(v_organization_id, 'max_storage_bytes');

  if v_current_storage_bytes - v_old_storage_bytes + v_new_storage_bytes > v_max_storage_bytes then
    if v_max_storage_bytes = 104857600 then
      raise exception 'Starter organisations include 100 MB of image storage.'
        using errcode = 'check_violation';
    end if;

    raise exception 'This upload exceeds the organisation storage allowance.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_organization_learning_media_entitlements() from public, anon, authenticated, service_role;

drop trigger if exists organization_course_entitlements_enforced on public.courses;
create trigger organization_course_entitlements_enforced
  before insert or update of organization_id, catalog_scope, status on public.courses
  for each row execute function private.enforce_organization_course_entitlements();

drop trigger if exists organization_lesson_entitlements_enforced on public.lessons;
create trigger organization_lesson_entitlements_enforced
  before insert or update of course_id, status on public.lessons
  for each row execute function private.enforce_organization_lesson_entitlements();

drop trigger if exists organization_lesson_block_entitlements_enforced on public.lesson_content_blocks;
create trigger organization_lesson_block_entitlements_enforced
  before insert or update of page_id, block_type on public.lesson_content_blocks
  for each row execute function private.enforce_organization_lesson_block_entitlements();

drop trigger if exists organization_learning_media_entitlements_enforced on public.learning_media_assets;
create trigger organization_learning_media_entitlements_enforced
  before insert or update of course_id, lesson_id, asset_type, storage_path, metadata on public.learning_media_assets
  for each row execute function private.enforce_organization_learning_media_entitlements();

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
  'organization_learning_storage_bytes',
  'p_organization_id uuid',
  'PUBLIC_AUTHENTICATED_SELF',
  'Authenticated app and server actions displaying current organization media storage usage.',
  'Requires auth.uid() and platform admin, active organisation membership or organisation manager access for the requested organisation.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
