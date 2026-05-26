create or replace function public.admin_upsert_lesson_page(
  p_page_id text,
  p_lesson_id text,
  p_title text,
  p_subtitle text,
  p_page_type public.lesson_page_type,
  p_page_number integer,
  p_cover_image jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_page_id text := lower(regexp_replace(trim(coalesce(p_page_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_title text := trim(coalesce(p_title, ''));
  v_exists boolean := false;
  v_counter integer := 1;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lesson content.';
  end if;

  if not exists(select 1 from public.lessons where id = p_lesson_id) then
    raise exception 'Lesson not found.';
  end if;

  if v_title = '' then
    raise exception 'Page title is required.';
  end if;

  if v_page_id = '' then
    v_page_id := public.admin_slugify(v_title);
    if v_page_id = '' then
      v_page_id := 'page';
    end if;
    v_page_id := 'page-' || left(v_page_id, 90);
  end if;

  select exists(select 1 from public.lesson_pages where id = v_page_id) into v_exists;

  if not v_exists then
    while exists(select 1 from public.lesson_pages where id = v_page_id) loop
      v_counter := v_counter + 1;
      v_page_id := left(v_page_id, 96) || '-' || v_counter::text;
    end loop;
  end if;

  insert into public.lesson_pages (
    id,
    lesson_id,
    page_number,
    title,
    subtitle,
    page_type,
    cover_image
  )
  values (
    v_page_id,
    p_lesson_id,
    greatest(1, coalesce(p_page_number, 1)),
    v_title,
    nullif(trim(coalesce(p_subtitle, '')), ''),
    coalesce(p_page_type, 'concept'::public.lesson_page_type),
    coalesce(p_cover_image, '{}'::jsonb)
  )
  on conflict (id) do update
  set lesson_id = excluded.lesson_id,
      page_number = excluded.page_number,
      title = excluded.title,
      subtitle = excluded.subtitle,
      page_type = excluded.page_type,
      cover_image = excluded.cover_image,
      updated_at = now();

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'lesson_page_updated' else 'lesson_page_created' end,
    'lesson_page',
    v_page_id,
    jsonb_build_object('lessonId', p_lesson_id, 'title', v_title)
  );

  return jsonb_build_object('pageId', v_page_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;

create or replace function public.admin_upsert_lesson_block(
  p_block_id uuid,
  p_page_id text,
  p_block_type public.lesson_content_block_type,
  p_sort_order integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_block_id uuid := coalesce(p_block_id, gen_random_uuid());
  v_exists boolean := false;
  v_existing_page_id text;
  v_existing_sort_order integer;
  v_resolved_sort_order integer := coalesce(p_sort_order, 0);
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lesson content.';
  end if;

  if not exists(select 1 from public.lesson_pages where id = p_page_id) then
    raise exception 'Lesson page not found.';
  end if;

  select page_id, sort_order
    into v_existing_page_id, v_existing_sort_order
  from public.lesson_content_blocks
  where id = v_block_id;

  v_exists := found;

  if v_exists then
    if v_existing_page_id = p_page_id then
      v_resolved_sort_order := v_existing_sort_order;
    else
      select coalesce(max(sort_order), 0) + 1
        into v_resolved_sort_order
      from public.lesson_content_blocks
      where page_id = p_page_id;
    end if;
  elsif exists(
    select 1
    from public.lesson_content_blocks
    where page_id = p_page_id
      and sort_order = v_resolved_sort_order
  ) then
    select coalesce(max(sort_order), 0) + 1
      into v_resolved_sort_order
    from public.lesson_content_blocks
    where page_id = p_page_id;
  end if;

  insert into public.lesson_content_blocks (
    id,
    page_id,
    block_type,
    sort_order,
    payload
  )
  values (
    v_block_id,
    p_page_id,
    coalesce(p_block_type, 'text'::public.lesson_content_block_type),
    v_resolved_sort_order,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (id) do update
  set page_id = excluded.page_id,
      block_type = excluded.block_type,
      sort_order = excluded.sort_order,
      payload = excluded.payload,
      updated_at = now();

  return jsonb_build_object('blockId', v_block_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;
