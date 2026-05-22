create or replace function public.admin_set_course_status(
  p_course_id text,
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
    raise exception 'Only an admin can manage course visibility.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Courses can only be enabled or disabled from this control.';
  end if;

  update public.courses
  set status = v_status,
      updated_at = now()
  where id = p_course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_status = 'published' then 'course_enabled' else 'course_disabled' end,
    'course',
    p_course_id,
    jsonb_build_object('status', v_status)
  );

  return jsonb_build_object('courseId', p_course_id, 'status', v_status);
end;
$$;

create or replace function public.admin_set_lesson_status(
  p_lesson_id text,
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
    raise exception 'Only an admin can manage lesson visibility.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Lessons can only be enabled or disabled from this control.';
  end if;

  update public.lessons
  set status = v_status,
      updated_at = now()
  where id = p_lesson_id;

  if not found then
    raise exception 'Lesson not found.';
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_status = 'published' then 'lesson_enabled' else 'lesson_disabled' end,
    'lesson',
    p_lesson_id,
    jsonb_build_object('status', v_status)
  );

  return jsonb_build_object('lessonId', p_lesson_id, 'status', v_status);
end;
$$;

grant execute on function public.admin_set_course_status(text, public.content_status) to authenticated;
grant execute on function public.admin_set_lesson_status(text, public.content_status) to authenticated;
