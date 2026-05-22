create or replace function public.admin_delete_lesson_block(
  p_page_id text,
  p_block_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_deleted_count integer := 0;
  v_remaining_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can delete lesson blocks.';
  end if;

  if not exists(select 1 from public.lesson_pages where id = p_page_id) then
    raise exception 'Lesson page not found.';
  end if;

  delete from public.lesson_content_blocks
  where id = p_block_id
    and page_id = p_page_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'Lesson block not found.';
  end if;

  with ordered as (
    select
      id,
      row_number() over (order by sort_order, id) as next_order
    from public.lesson_content_blocks
    where page_id = p_page_id
  )
  update public.lesson_content_blocks block
  set sort_order = -ordered.next_order,
      updated_at = now()
  from ordered
  where block.id = ordered.id;

  with ordered as (
    select
      id,
      row_number() over (order by sort_order desc, id) as next_order
    from public.lesson_content_blocks
    where page_id = p_page_id
  )
  update public.lesson_content_blocks block
  set sort_order = ordered.next_order,
      updated_at = now()
  from ordered
  where block.id = ordered.id;

  select count(*)
  into v_remaining_count
  from public.lesson_content_blocks
  where page_id = p_page_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'lesson_block_deleted',
    'lesson_content_block',
    p_block_id::text,
    jsonb_build_object('pageId', p_page_id, 'remainingBlocks', v_remaining_count)
  );

  return jsonb_build_object(
    'blockId', p_block_id,
    'pageId', p_page_id,
    'remainingBlocks', v_remaining_count,
    'status', 'deleted'
  );
end;
$$;

grant execute on function public.admin_delete_lesson_block(text, uuid) to authenticated;
