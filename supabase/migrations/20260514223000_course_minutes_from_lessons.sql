create or replace function public.admin_sync_course_estimated_minutes(
  p_course_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_minutes integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can sync course minutes.';
  end if;

  select coalesce(sum(estimated_minutes), 0)::integer
  into v_minutes
  from public.lessons
  where course_id = p_course_id;

  update public.courses
  set estimated_minutes = v_minutes,
      updated_at = now()
  where id = p_course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  return jsonb_build_object('courseId', p_course_id, 'estimatedMinutes', v_minutes);
end;
$$;

grant execute on function public.admin_sync_course_estimated_minutes(text) to authenticated;
