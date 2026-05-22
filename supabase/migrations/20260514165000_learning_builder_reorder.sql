create or replace function public.admin_reorder_lesson_page(
  p_lesson_id text,
  p_page_id text,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current record;
  v_target record;
  v_temp_number integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can reorder lesson pages.';
  end if;

  select id, page_number
  into v_current
  from public.lesson_pages
  where id = p_page_id and lesson_id = p_lesson_id;

  if v_current.id is null then
    raise exception 'Lesson page not found.';
  end if;

  if p_direction = 'up' then
    select id, page_number
    into v_target
    from public.lesson_pages
    where lesson_id = p_lesson_id and page_number < v_current.page_number
    order by page_number desc
    limit 1;
  else
    select id, page_number
    into v_target
    from public.lesson_pages
    where lesson_id = p_lesson_id and page_number > v_current.page_number
    order by page_number asc
    limit 1;
  end if;

  if v_target.id is null then
    return jsonb_build_object('status', 'unchanged', 'pageId', p_page_id);
  end if;

  v_temp_number := 1000000 + v_current.page_number;

  update public.lesson_pages
  set page_number = v_temp_number,
      updated_at = now()
  where id = v_current.id;

  update public.lesson_pages
  set page_number = v_current.page_number,
      updated_at = now()
  where id = v_target.id;

  update public.lesson_pages
  set page_number = v_target.page_number,
      updated_at = now()
  where id = v_current.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'lesson_page_reordered',
    'lesson_page',
    p_page_id,
    jsonb_build_object('lessonId', p_lesson_id, 'direction', p_direction)
  );

  return jsonb_build_object('status', 'updated', 'pageId', p_page_id);
end;
$$;

create or replace function public.admin_reorder_lesson_block(
  p_page_id text,
  p_block_id uuid,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current record;
  v_target record;
  v_temp_order integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can reorder lesson blocks.';
  end if;

  select id, sort_order
  into v_current
  from public.lesson_content_blocks
  where id = p_block_id and page_id = p_page_id;

  if v_current.id is null then
    raise exception 'Lesson block not found.';
  end if;

  if p_direction = 'up' then
    select id, sort_order
    into v_target
    from public.lesson_content_blocks
    where page_id = p_page_id and sort_order < v_current.sort_order
    order by sort_order desc
    limit 1;
  else
    select id, sort_order
    into v_target
    from public.lesson_content_blocks
    where page_id = p_page_id and sort_order > v_current.sort_order
    order by sort_order asc
    limit 1;
  end if;

  if v_target.id is null then
    return jsonb_build_object('status', 'unchanged', 'blockId', p_block_id);
  end if;

  v_temp_order := 1000000 + v_current.sort_order;

  update public.lesson_content_blocks
  set sort_order = v_temp_order,
      updated_at = now()
  where id = v_current.id;

  update public.lesson_content_blocks
  set sort_order = v_current.sort_order,
      updated_at = now()
  where id = v_target.id;

  update public.lesson_content_blocks
  set sort_order = v_target.sort_order,
      updated_at = now()
  where id = v_current.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'lesson_block_reordered',
    'lesson_content_block',
    p_block_id::text,
    jsonb_build_object('pageId', p_page_id, 'direction', p_direction)
  );

  return jsonb_build_object('status', 'updated', 'blockId', p_block_id);
end;
$$;

grant execute on function public.admin_reorder_lesson_page(text, text, text) to authenticated;
grant execute on function public.admin_reorder_lesson_block(text, uuid, text) to authenticated;
