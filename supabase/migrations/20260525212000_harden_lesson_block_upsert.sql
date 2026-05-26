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
  v_lesson_id text;
  v_course_id text;
  v_existing_page_id text;
  v_existing_sort_order integer;
  v_resolved_sort_order integer := coalesce(p_sort_order, 0);
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lesson content.';
  end if;

  select p.lesson_id, l.course_id
    into v_lesson_id, v_course_id
  from public.lesson_pages p
  join public.lessons l on l.id = p.lesson_id
  where p.id = p_page_id;

  if v_lesson_id is null then
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

  if exists(
    select 1
    from public.lessons l
    where l.id = v_lesson_id
      and l.ai_generated = true
      and l.ai_text_status = 'approved'
  ) or exists(
    select 1
    from public.courses c
    where c.id = v_course_id
      and c.ai_generated = true
      and c.ai_text_status = 'approved'
  ) then
    perform public.admin_reset_ai_course_tree(v_course_id, 'draft');
  end if;

  return jsonb_build_object('blockId', v_block_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;
