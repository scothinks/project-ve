create or replace function public.admin_reorder_course_lessons(
  p_course_id text,
  p_lesson_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_expected_count integer;
  v_requested_count integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can reorder course lessons.';
  end if;

  if not exists(select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found.';
  end if;

  select count(*)
    into v_expected_count
  from public.lessons
  where course_id = p_course_id;

  select count(distinct lesson_id)
    into v_requested_count
  from unnest(coalesce(p_lesson_ids, '{}'::text[])) as lesson_id;

  if v_expected_count <> v_requested_count then
    raise exception 'Lesson order must include every lesson in the course exactly once.';
  end if;

  if exists(
    select 1
    from unnest(p_lesson_ids) as requested(lesson_id)
    left join public.lessons l
      on l.id = requested.lesson_id
     and l.course_id = p_course_id
    where l.id is null
  ) then
    raise exception 'Lesson order includes a lesson outside this course.';
  end if;

  with ordered as (
    select lesson_id, row_number() over () as next_order
    from unnest(p_lesson_ids) as lesson_id
  )
  update public.lessons l
  set sort_order = ordered.next_order,
      updated_at = now()
  from ordered
  where l.id = ordered.lesson_id
    and l.course_id = p_course_id;

  update public.courses
  set updated_at = now()
  where id = p_course_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'course_lessons_reordered',
    'course',
    p_course_id,
    jsonb_build_object('lessonIds', p_lesson_ids)
  );

  return jsonb_build_object('courseId', p_course_id, 'lessonCount', v_expected_count);
end;
$$;

grant execute on function public.admin_reorder_course_lessons(text, text[]) to authenticated;
