-- Per-organisation authored recommendation sections. `recommendation_sections`
-- was platform-only editorial content; this adds a nullable organization_id
-- (null = platform/global, matching the courses.organization_id convention)
-- so organisation staff can curate their own dashboard sections the same
-- way they already curate courses and missions. id/slug stay globally
-- unique — admin_upsert_recommendation_section's existing counter-suffix
-- collision loop already de-duplicates across tenants without any schema
-- change there.

alter table public.recommendation_sections
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists recommendation_sections_organization_idx
  on public.recommendation_sections (organization_id);

drop policy if exists "Organization staff can read own recommendation sections" on public.recommendation_sections;
create policy "Organization staff can read own recommendation sections"
  on public.recommendation_sections for select
  using (
    organization_id is not null
    and public.current_user_has_organization_role(
      organization_id,
      array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
    )
  );

drop policy if exists "Organization staff can read own recommendation items" on public.recommendation_items;
create policy "Organization staff can read own recommendation items"
  on public.recommendation_items for select
  using (
    exists (
      select 1
      from public.recommendation_sections section
      where section.id = recommendation_items.section_id
        and section.organization_id is not null
        and public.current_user_has_organization_role(
          section.organization_id,
          array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
        )
    )
  );

create or replace function public.admin_upsert_recommendation_section(
  p_section_id text,
  p_title text,
  p_subtitle text,
  p_eyebrow text,
  p_status public.content_status,
  p_sort_order integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_section_id text := lower(regexp_replace(trim(coalesce(p_section_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_slug_base text := public.admin_slugify(p_title);
  v_slug text;
  v_exists boolean := false;
  v_existing_organization_id uuid;
  v_counter integer := 1;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id into v_existing_organization_id
  from public.recommendation_sections
  where id = v_section_id;

  v_exists := found;

  -- Authorize against the row's existing owner when updating (a caller
  -- cannot reassign a section by passing a different p_organization_id);
  -- against the requested owner when creating.
  if not (
    public.current_user_is_admin()
    or (
      coalesce(v_existing_organization_id, p_organization_id) is not null
      and public.current_user_has_organization_role(
        coalesce(v_existing_organization_id, p_organization_id),
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  if v_title = '' then
    raise exception 'Recommendation section title is required.';
  end if;

  if p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at then
    raise exception 'Recommendation end time must be after start time.';
  end if;

  if v_slug_base = '' then
    v_slug_base := 'recommendation';
  end if;

  if v_section_id = '' then
    v_section_id := 'rec-' || left(v_slug_base, 90);
    select exists(select 1 from public.recommendation_sections where id = v_section_id) into v_exists;
  end if;

  if not v_exists then
    v_slug := left(v_slug_base, 96);

    while exists(
      select 1
      from public.recommendation_sections
      where id = v_section_id or slug = v_slug
    ) loop
      v_counter := v_counter + 1;
      v_slug := left(v_slug_base, 90) || '-' || v_counter::text;
      v_section_id := 'rec-' || left(v_slug_base, 84) || '-' || v_counter::text;
    end loop;

    insert into public.recommendation_sections (
      id,
      slug,
      placement,
      eyebrow,
      title,
      subtitle,
      status,
      sort_order,
      starts_at,
      ends_at,
      organization_id
    )
    values (
      v_section_id,
      v_slug,
      'dashboard',
      nullif(trim(coalesce(p_eyebrow, '')), ''),
      v_title,
      nullif(trim(coalesce(p_subtitle, '')), ''),
      coalesce(p_status, 'draft'::public.content_status),
      coalesce(p_sort_order, 0),
      p_starts_at,
      p_ends_at,
      p_organization_id
    );
  else
    update public.recommendation_sections
    set eyebrow = nullif(trim(coalesce(p_eyebrow, '')), ''),
        title = v_title,
        subtitle = nullif(trim(coalesce(p_subtitle, '')), ''),
        status = coalesce(p_status, 'draft'::public.content_status),
        sort_order = coalesce(p_sort_order, 0),
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_at = now()
    where id = v_section_id;
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'recommendation_section_updated' else 'recommendation_section_created' end,
    'recommendation_section',
    v_section_id,
    jsonb_build_object('title', v_title, 'status', p_status, 'organizationId', coalesce(v_existing_organization_id, p_organization_id))
  );

  return jsonb_build_object(
    'sectionId', v_section_id,
    'status', case when v_exists then 'updated' else 'created' end
  );
end;
$$;

create or replace function public.admin_set_recommendation_section_status(
  p_section_id text,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id into v_organization_id
  from public.recommendation_sections
  where id = p_section_id;

  if not found then
    raise exception 'Recommendation section not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Recommendations can only be enabled or disabled from this control.';
  end if;

  update public.recommendation_sections
  set status = v_status,
      updated_at = now()
  where id = p_section_id;

  return jsonb_build_object('sectionId', p_section_id, 'status', v_status);
end;
$$;

create or replace function public.admin_add_recommendation_item(
  p_section_id text,
  p_item_type text,
  p_item_id text,
  p_sort_order integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_item_type text := lower(trim(coalesce(p_item_type, '')));
  v_item_id text := trim(coalesce(p_item_id, ''));
  v_item_uuid uuid;
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id into v_organization_id
  from public.recommendation_sections
  where id = p_section_id;

  if not found then
    raise exception 'Recommendation section not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  if v_item_type not in ('course', 'lesson') then
    raise exception 'Recommendation item type must be course or lesson.';
  end if;

  if v_item_type = 'course' and not exists(select 1 from public.courses where id = v_item_id) then
    raise exception 'Course not found.';
  end if;

  if v_item_type = 'lesson' and not exists(select 1 from public.lessons where id = v_item_id) then
    raise exception 'Lesson not found.';
  end if;

  insert into public.recommendation_items (
    section_id,
    item_type,
    item_id,
    sort_order
  )
  values (
    p_section_id,
    v_item_type,
    v_item_id,
    coalesce(p_sort_order, 0)
  )
  on conflict (section_id, item_type, item_id) do update
  set sort_order = excluded.sort_order
  returning id into v_item_uuid;

  return jsonb_build_object('itemId', v_item_uuid, 'status', 'saved');
end;
$$;

create or replace function public.admin_delete_recommendation_item(
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select section.organization_id into v_organization_id
  from public.recommendation_items item
  join public.recommendation_sections section on section.id = item.section_id
  where item.id = p_item_id;

  if not found then
    raise exception 'Recommendation item not found.';
  end if;

  if not (
    public.current_user_is_admin()
    or (
      v_organization_id is not null
      and public.current_user_has_organization_role(
        v_organization_id,
        array['organisation_owner', 'organisation_admin', 'programme_manager', 'content_editor']::public.organization_role_key[]
      )
    )
  ) then
    raise exception 'Only an admin or organisation manager can manage recommendations.';
  end if;

  delete from public.recommendation_items
  where id = p_item_id;

  return jsonb_build_object('itemId', p_item_id, 'status', 'deleted');
end;
$$;

drop function if exists public.admin_upsert_recommendation_section(text, text, text, text, public.content_status, integer, timestamptz, timestamptz);
revoke execute on function public.admin_upsert_recommendation_section(text, text, text, text, public.content_status, integer, timestamptz, timestamptz, uuid)
  from public, anon;
grant execute on function public.admin_upsert_recommendation_section(text, text, text, text, public.content_status, integer, timestamptz, timestamptz, uuid)
  to authenticated, service_role;

delete from private.rpc_security_classifications
where function_schema = 'public'
  and function_name = 'admin_upsert_recommendation_section'
  and identity_arguments = 'p_section_id text, p_title text, p_subtitle text, p_eyebrow text, p_status content_status, p_sort_order integer, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone';

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
  'admin_upsert_recommendation_section',
  'p_section_id text, p_title text, p_subtitle text, p_eyebrow text, p_status content_status, p_sort_order integer, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_organization_id uuid',
  'ADMIN_AUTHENTICATED',
  'Platform admins and organisation content staff curating recommendation sections.',
  'Platform admins always pass; organisation callers require current_user_has_organization_role for the section''s existing (or requested) organisation.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
