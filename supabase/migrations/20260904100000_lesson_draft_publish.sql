-- Lesson Editor v1: one published snapshot, editable draft tables, no quiz/tag versioning.
-- App publication/read-path cutover is a separate coordinated follow-up.
begin;

alter table public.lessons
  add column if not exists published_snapshot jsonb,
  add column if not exists published_at timestamptz;

-- A single SQL statement gives publishing and the legacy backfill a consistent
-- draft projection. This private invoker helper has no API-role EXECUTE grant.
create or replace function private.lesson_draft_snapshot(p_lesson_id text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'lesson', jsonb_build_object(
      'title', l.title,
      'description', l.description,
      'cover_image', coalesce(l.cover_image, '{}'::jsonb),
      'estimated_minutes', l.estimated_minutes,
      'retry_mode', l.retry_mode,
      'retry_cooldown_seconds', l.retry_cooldown_seconds,
      'retry_requires_reread', l.retry_requires_reread,
      'quiz_requires_lesson_completion', l.quiz_requires_lesson_completion,
      'max_earning_attempts', l.max_earning_attempts
    ),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'page_number', p.page_number,
        'title', p.title,
        'subtitle', p.subtitle,
        'page_type', p.page_type,
        'cover_image', coalesce(p.cover_image, '{}'::jsonb)
      ) order by p.page_number, p.id)
      from public.lesson_pages p
      where p.lesson_id = p_lesson_id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'page_id', b.page_id,
        'block_type', b.block_type,
        'sort_order', b.sort_order,
        'payload', b.payload
      ) order by b.page_id, b.sort_order, b.id)
      from public.lesson_content_blocks b
      join public.lesson_pages p on p.id = b.page_id
      where p.lesson_id = p_lesson_id
    ), '[]'::jsonb)
  )
  from public.lessons l
  where l.id = p_lesson_id;

$$;
revoke all on function private.lesson_draft_snapshot(text) from public, anon, authenticated, service_role;

-- Capture the currently live baseline before switching readers in the app layer.
-- The actual historic publication time is unknown; published_at is capture time.
update public.lessons
set published_snapshot = private.lesson_draft_snapshot(id), published_at = now()
where status = 'published' and published_snapshot is null;

create or replace function public.admin_publish_lesson(
  p_lesson_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_snapshot jsonb;
  v_course_id text;
begin
  select course_id into v_course_id
  from public.lessons where id = p_lesson_id;

  if v_actor_id is null or v_course_id is null
    or not public.current_user_can_edit_course(v_course_id)
  then
    raise exception 'Lesson content editor access required.';
  end if;

  -- Authorize before taking a write lock, and reject a concurrent course move.
  perform 1 from public.lessons
  where id = p_lesson_id and course_id = v_course_id for update;
  if not found then
    raise exception 'Lesson changed during authorization; retry the operation.';
  end if;

  -- Preserve the existing upsert RPC's database AI approval boundary.
  -- Full editorial/course readiness checks still belong to the application.
  if exists (
    select 1 from public.lessons
    where id = p_lesson_id and ai_generated
      and coalesce(ai_publish_status, 'not_ready') not in ('ready', 'published')
  ) then
    raise exception 'AI-generated lessons can only be published after approved text and media.';
  end if;

  v_snapshot := private.lesson_draft_snapshot(p_lesson_id);

  update public.lessons
  set status = 'published',
      published_snapshot = v_snapshot,
      published_at = now(),
      updated_at = now()
  where id = p_lesson_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'lesson_published', 'lesson', p_lesson_id, jsonb_build_object('pageCount', jsonb_array_length(v_snapshot->'pages')));

  return jsonb_build_object('lessonId', p_lesson_id, 'publishedAt', now());
end;
$$;

revoke all on function public.admin_publish_lesson(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_publish_lesson(text) to authenticated, service_role;


create or replace function public.admin_revert_lesson_to_published(
  p_lesson_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_snapshot jsonb;
  v_lesson jsonb;
  v_course_id text;
  v_page_base bigint;
  v_block_base bigint;
begin
  select course_id into v_course_id
  from public.lessons where id = p_lesson_id;

  if v_actor_id is null or v_course_id is null
    or not public.current_user_can_edit_course(v_course_id)
  then
    raise exception 'Lesson content editor access required.';
  end if;

  -- Authorize before taking a write lock, and reject a concurrent course move.
  perform 1 from public.lessons
  where id = p_lesson_id and course_id = v_course_id for update;
  if not found then
    raise exception 'Lesson changed during authorization; retry the operation.';
  end if;

  select published_snapshot into v_snapshot
  from public.lessons
  where id = p_lesson_id;

  if v_snapshot is null then
    raise exception 'This lesson has no published version to revert to.';
  end if;

  -- Lock retained rows before restoration; preserve their IDs and progress FKs.
  perform 1 from public.lesson_pages where lesson_id = p_lesson_id order by id for update;
  perform 1 from public.lesson_content_blocks b
    join public.lesson_pages p on p.id = b.page_id
    where p.lesson_id = p_lesson_id order by b.id for update of b;

  -- Published IDs may have been deleted and reused in another lesson. Never
  -- allow a restore upsert to overwrite or move another lesson's content.
  if exists (
    select 1 from jsonb_array_elements(v_snapshot->'pages') s
    join public.lesson_pages p on p.id = s->>'id'
    where p.lesson_id <> p_lesson_id
  ) or exists (
    select 1 from jsonb_array_elements(v_snapshot->'blocks') s
    join public.lesson_content_blocks b on b.id = (s->>'id')::uuid
    join public.lesson_pages p on p.id = b.page_id
    where p.lesson_id <> p_lesson_id
  ) then
    raise exception 'Published content IDs now belong to another lesson.';
  end if;

  v_lesson := v_snapshot->'lesson';

  update public.lessons
  set title = v_lesson->>'title',
      description = v_lesson->>'description',
      cover_image = coalesce(v_lesson->'cover_image', '{}'::jsonb),
      estimated_minutes = (v_lesson->>'estimated_minutes')::integer,
      retry_mode = (v_lesson->>'retry_mode')::public.lesson_retry_mode,
      retry_cooldown_seconds = (v_lesson->>'retry_cooldown_seconds')::integer,
      retry_requires_reread = (v_lesson->>'retry_requires_reread')::boolean,
      quiz_requires_lesson_completion = (v_lesson->>'quiz_requires_lesson_completion')::boolean,
      max_earning_attempts = (v_lesson->>'max_earning_attempts')::integer,
      updated_at = now()
  where id = p_lesson_id;

  -- Positive temporary positions above BOTH shapes avoid check/unique failures,
  -- including drafts already using the old autosave 100000 offset range.
  select greatest(coalesce(max(page_number), 0),
    coalesce((select max((s->>'page_number')::integer)
      from jsonb_array_elements(v_snapshot->'pages') s), 0))
    into v_page_base from public.lesson_pages where lesson_id = p_lesson_id;
  select greatest(coalesce(max(b.sort_order), 0),
    coalesce((select max((s->>'sort_order')::integer)
      from jsonb_array_elements(v_snapshot->'blocks') s), 0))
    into v_block_base from public.lesson_content_blocks b
    join public.lesson_pages p on p.id = b.page_id where p.lesson_id = p_lesson_id;

  if v_page_base + (select count(*) from public.lesson_pages where lesson_id = p_lesson_id) > 2147483647
    or v_block_base + (select count(*) from public.lesson_content_blocks b
      join public.lesson_pages p on p.id = b.page_id where p.lesson_id = p_lesson_id) > 2147483647
  then
    raise exception 'Lesson content positions exceed the safe renumbering range.';
  end if;

  with positions as (
    select id, row_number() over (order by page_number, id) as n
    from public.lesson_pages where lesson_id = p_lesson_id
  )
  update public.lesson_pages p set page_number = (v_page_base + positions.n)::integer
  from positions where p.id = positions.id;

  with positions as (
    select b.id, row_number() over (order by b.page_id, b.sort_order, b.id) as n
    from public.lesson_content_blocks b join public.lesson_pages p on p.id = b.page_id
    where p.lesson_id = p_lesson_id
  )
  update public.lesson_content_blocks b set sort_order = (v_block_base + positions.n)::integer
  from positions where b.id = positions.id;

  -- Phase 2: drop draft-only pages (and their blocks, via on-delete-cascade) that
  -- aren't part of the published snapshot.
  delete from public.lesson_pages
  where lesson_id = p_lesson_id
    and id not in (select jsonb_array_elements(v_snapshot->'pages')->>'id');

  -- Phase 3: upsert every page from the snapshot back to its published shape.
  insert into public.lesson_pages (id, lesson_id, page_number, title, subtitle, page_type, cover_image)
  select
    page->>'id',
    p_lesson_id,
    (page->>'page_number')::integer,
    page->>'title',
    page->>'subtitle',
    (page->>'page_type')::public.lesson_page_type,
    coalesce(page->'cover_image', '{}'::jsonb)
  from jsonb_array_elements(v_snapshot->'pages') as page
  on conflict (id) do update
  set page_number = excluded.page_number,
      title = excluded.title,
      subtitle = excluded.subtitle,
      page_type = excluded.page_type,
      cover_image = excluded.cover_image,
      updated_at = now()
  where lesson_pages.lesson_id = p_lesson_id;

  -- Phase 4: drop draft-only blocks not part of the snapshot.
  delete from public.lesson_content_blocks b
  using public.lesson_pages p
  where b.page_id = p.id
    and p.lesson_id = p_lesson_id
    and b.id not in (select (jsonb_array_elements(v_snapshot->'blocks')->>'id')::uuid);

  -- Phase 5: upsert every block from the snapshot back to its published shape.
  insert into public.lesson_content_blocks (id, page_id, block_type, sort_order, payload)
  select
    (block->>'id')::uuid,
    block->>'page_id',
    (block->>'block_type')::public.lesson_content_block_type,
    (block->>'sort_order')::integer,
    coalesce(block->'payload', '{}'::jsonb)
  from jsonb_array_elements(v_snapshot->'blocks') as block
  on conflict (id) do update
  set page_id = excluded.page_id,
      block_type = excluded.block_type,
      sort_order = excluded.sort_order,
      payload = excluded.payload,
      updated_at = now()
  where lesson_content_blocks.page_id in (select id from public.lesson_pages where lesson_id = p_lesson_id);

  if private.lesson_draft_snapshot(p_lesson_id) is distinct from v_snapshot then
    raise exception 'Published content could not be restored exactly.';
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'lesson_reverted_to_published', 'lesson', p_lesson_id, '{}'::jsonb);

  return jsonb_build_object('lessonId', p_lesson_id, 'status', 'reverted');
end;
$$;

revoke all on function public.admin_revert_lesson_to_published(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_revert_lesson_to_published(text) to authenticated, service_role;


create or replace function public.admin_delete_lesson_page(
  p_lesson_id text,
  p_page_id text
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
  v_course_id text;
  v_page_base bigint;
begin
  select course_id into v_course_id
  from public.lessons where id = p_lesson_id;

  if v_actor_id is null or v_course_id is null
    or not public.current_user_can_edit_course(v_course_id)
  then
    raise exception 'Lesson content editor access required.';
  end if;

  -- Authorize before taking a write lock, and reject a concurrent course move.
  perform 1 from public.lessons
  where id = p_lesson_id and course_id = v_course_id for update;
  if not found then
    raise exception 'Lesson changed during authorization; retry the operation.';
  end if;

  perform 1 from public.lesson_pages where lesson_id = p_lesson_id order by id for update;
  if not exists (select 1 from public.lesson_pages where id = p_page_id and lesson_id = p_lesson_id) then
    raise exception 'Lesson page not found.';
  end if;

  select count(*) into v_remaining_count from public.lesson_pages where lesson_id = p_lesson_id;
  if v_remaining_count <= 1 then
    raise exception 'A lesson needs at least one page.';
  end if;

  delete from public.lesson_pages
  where id = p_page_id
    and lesson_id = p_lesson_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'Lesson page not found.';
  end if;

  select coalesce(max(page_number), 0) into v_page_base
  from public.lesson_pages where lesson_id = p_lesson_id;
  if v_page_base + v_remaining_count > 2147483647 then
    raise exception 'Lesson content positions exceed the safe renumbering range.';
  end if;

  with ordered as (
    select id, row_number() over (order by page_number, id) as next_number
    from public.lesson_pages where lesson_id = p_lesson_id
  )
  update public.lesson_pages page
  set page_number = (v_page_base + ordered.next_number)::integer, updated_at = now()
  from ordered where page.id = ordered.id;

  update public.lesson_pages
  set page_number = (page_number - v_page_base)::integer, updated_at = now()
  where lesson_id = p_lesson_id;

  select count(*) into v_remaining_count from public.lesson_pages where lesson_id = p_lesson_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'lesson_page_deleted', 'lesson_page', p_page_id, jsonb_build_object('lessonId', p_lesson_id, 'remainingPages', v_remaining_count));

  return jsonb_build_object('pageId', p_page_id, 'lessonId', p_lesson_id, 'remainingPages', v_remaining_count, 'status', 'deleted');
end;
$$;

revoke all on function public.admin_delete_lesson_page(text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_lesson_page(text, text) to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema, function_name, identity_arguments, classification,
  intended_callers, authorization_rule, execute_roles
) values
  ('public', 'admin_publish_lesson', 'p_lesson_id text', 'ADMIN_AUTHENTICATED',
   'Capture the lesson draft as the published snapshot.',
   'Requires auth.uid() and current_user_can_edit_course on the trusted lesson course.',
   array['authenticated', 'service_role']),
  ('public', 'admin_revert_lesson_to_published', 'p_lesson_id text', 'ADMIN_AUTHENTICATED',
   'Restore the last published lesson content.',
   'Requires auth.uid() and current_user_can_edit_course on the trusted lesson course.',
   array['authenticated', 'service_role']),
  ('public', 'admin_delete_lesson_page', 'p_lesson_id text, p_page_id text', 'ADMIN_AUTHENTICATED',
   'Delete a draft lesson page and compact page numbering.',
   'Requires auth.uid() and current_user_can_edit_course on the trusted lesson course.',
   array['authenticated', 'service_role'])
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();

notify pgrst, 'reload schema';

commit;
