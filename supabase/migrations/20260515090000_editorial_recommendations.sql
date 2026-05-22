create table if not exists public.recommendation_sections (
  id text primary key,
  slug text not null unique,
  placement text not null default 'dashboard',
  eyebrow text,
  title text not null,
  subtitle text,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommendation_items (
  id uuid primary key default gen_random_uuid(),
  section_id text not null references public.recommendation_sections(id) on delete cascade,
  item_type text not null check (item_type in ('course', 'lesson')),
  item_id text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (section_id, item_type, item_id)
);

create index if not exists recommendation_sections_placement_idx
  on public.recommendation_sections (placement, status, sort_order);

create index if not exists recommendation_items_section_idx
  on public.recommendation_items (section_id, sort_order);

alter table public.recommendation_sections enable row level security;
alter table public.recommendation_items enable row level security;

drop policy if exists "Published recommendation sections are readable" on public.recommendation_sections;
create policy "Published recommendation sections are readable"
  on public.recommendation_sections for select
  using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "Published recommendation items are readable" on public.recommendation_items;
create policy "Published recommendation items are readable"
  on public.recommendation_items for select
  using (
    exists (
      select 1
      from public.recommendation_sections section
      where section.id = recommendation_items.section_id
        and section.status = 'published'
        and (section.starts_at is null or section.starts_at <= now())
        and (section.ends_at is null or section.ends_at >= now())
    )
  );

drop policy if exists "Admins can read recommendation sections" on public.recommendation_sections;
create policy "Admins can read recommendation sections"
  on public.recommendation_sections for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read recommendation items" on public.recommendation_items;
create policy "Admins can read recommendation items"
  on public.recommendation_items for select
  using (public.current_user_is_admin());

create or replace function public.admin_upsert_recommendation_section(
  p_section_id text,
  p_title text,
  p_subtitle text,
  p_eyebrow text,
  p_status public.content_status,
  p_sort_order integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
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
  v_counter integer := 1;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage recommendations.';
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
  end if;

  select exists(select 1 from public.recommendation_sections where id = v_section_id) into v_exists;

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
      ends_at
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
      p_ends_at
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
    jsonb_build_object('title', v_title, 'status', p_status)
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
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage recommendations.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Recommendations can only be enabled or disabled from this control.';
  end if;

  update public.recommendation_sections
  set status = v_status,
      updated_at = now()
  where id = p_section_id;

  if not found then
    raise exception 'Recommendation section not found.';
  end if;

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
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage recommendations.';
  end if;

  if not exists(select 1 from public.recommendation_sections where id = p_section_id) then
    raise exception 'Recommendation section not found.';
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
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage recommendations.';
  end if;

  delete from public.recommendation_items
  where id = p_item_id;

  if not found then
    raise exception 'Recommendation item not found.';
  end if;

  return jsonb_build_object('itemId', p_item_id, 'status', 'deleted');
end;
$$;

grant execute on function public.admin_upsert_recommendation_section(text, text, text, text, public.content_status, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_set_recommendation_section_status(text, public.content_status) to authenticated;
grant execute on function public.admin_add_recommendation_item(text, text, text, integer) to authenticated;
grant execute on function public.admin_delete_recommendation_item(uuid) to authenticated;
