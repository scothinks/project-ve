create or replace function public.admin_upsert_course(
  p_course_id text,
  p_title text,
  p_description text,
  p_category text,
  p_level public.course_level,
  p_status public.content_status,
  p_thumbnail jsonb,
  p_sort_order integer,
  p_estimated_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_slug_base text := public.admin_slugify(v_title);
  v_slug text;
  v_exists boolean := false;
  v_course_id text := nullif(trim(coalesce(p_course_id, '')), '');
  v_counter integer := 1;
  v_existing public.courses%rowtype;
  v_requested_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_category text := nullif(trim(coalesce(p_category, '')), '');
  v_thumbnail jsonb := coalesce(p_thumbnail, '{}'::jsonb);
  v_should_reset_text boolean := false;
  v_should_reset_media boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage courses.';
  end if;

  if v_title = '' then
    raise exception 'Course title is required.';
  end if;

  select * into v_existing from public.courses where id = v_course_id;
  v_exists := found;

  if v_exists then
    v_should_reset_text := v_existing.ai_generated
      and v_existing.ai_text_status = 'approved'
      and (
        v_existing.title is distinct from v_title
        or v_existing.description is distinct from v_description
        or v_existing.category is distinct from v_category
        or v_existing.level is distinct from coalesce(p_level, 'beginner'::public.course_level)
      );

    v_should_reset_media := v_existing.ai_generated
      and v_existing.ai_media_status = 'approved'
      and coalesce(v_existing.thumbnail, '{}'::jsonb) is distinct from v_thumbnail;

    update public.courses
    set title = v_title,
        description = v_description,
        category = v_category,
        level = coalesce(p_level, 'beginner'::public.course_level),
        status = v_requested_status,
        thumbnail = v_thumbnail,
        sort_order = coalesce(p_sort_order, 0),
        estimated_minutes = greatest(0, coalesce(p_estimated_minutes, 0)),
        updated_at = now()
    where id = v_course_id;
  else
    if v_slug_base = '' then
      v_slug_base := 'course';
    end if;

    v_slug := left(v_slug_base, 96);
    v_course_id := 'course-' || left(v_slug_base, 86);

    while exists(select 1 from public.courses where id = v_course_id or slug = v_slug) loop
      v_counter := v_counter + 1;
      v_slug := left(v_slug_base, 90) || '-' || v_counter::text;
      v_course_id := 'course-' || left(v_slug_base, 80) || '-' || v_counter::text;
    end loop;

    insert into public.courses (
      id,
      slug,
      title,
      description,
      category,
      level,
      status,
      thumbnail,
      sort_order,
      estimated_minutes
    )
    values (
      v_course_id,
      v_slug,
      v_title,
      v_description,
      v_category,
      coalesce(p_level, 'beginner'::public.course_level),
      v_requested_status,
      v_thumbnail,
      coalesce(p_sort_order, 0),
      greatest(0, coalesce(p_estimated_minutes, 0))
    );
  end if;

  if v_should_reset_text then
    perform public.admin_reset_ai_course_tree(v_course_id, 'draft');
  elsif v_should_reset_media then
    perform public.admin_reset_ai_course_media(v_course_id, null, 'draft');
  end if;

  perform public.admin_sync_course_estimated_minutes(v_course_id);

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'course_updated' else 'course_created' end,
    'course',
    v_course_id,
    jsonb_build_object(
      'status', v_requested_status,
      'aiGenerated', coalesce(v_existing.ai_generated, false)
    )
  );

  return jsonb_build_object('courseId', v_course_id);
end;
$$;

create or replace function public.admin_upsert_lesson(
  p_lesson_id text,
  p_course_id text,
  p_title text,
  p_description text,
  p_cover_image jsonb,
  p_status public.content_status,
  p_sort_order integer,
  p_estimated_minutes integer,
  p_retry_mode public.lesson_retry_mode,
  p_retry_cooldown_seconds integer,
  p_retry_requires_reread boolean,
  p_quiz_requires_lesson_completion boolean,
  p_max_earning_attempts integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_slug_base text := public.admin_slugify(v_title);
  v_slug text;
  v_exists boolean := false;
  v_lesson_id text := nullif(trim(coalesce(p_lesson_id, '')), '');
  v_counter integer := 1;
  v_existing public.lessons%rowtype;
  v_requested_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_cover_image jsonb := coalesce(p_cover_image, '{}'::jsonb);
  v_should_reset_text boolean := false;
  v_should_reset_media boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lessons.';
  end if;

  if not exists(select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found.';
  end if;

  if v_title = '' then
    raise exception 'Lesson title is required.';
  end if;

  select * into v_existing from public.lessons where id = v_lesson_id;
  v_exists := found;

  if v_exists then
    v_should_reset_text := v_existing.ai_generated
      and v_existing.ai_text_status = 'approved'
      and (
        v_existing.title is distinct from v_title
        or coalesce(v_existing.description, '') is distinct from coalesce(v_description, '')
      );

    v_should_reset_media := v_existing.ai_generated
      and v_existing.ai_media_status = 'approved'
      and coalesce(v_existing.cover_image, '{}'::jsonb) is distinct from v_cover_image;

    update public.lessons
    set course_id = p_course_id,
        title = v_title,
        description = v_description,
        cover_image = v_cover_image,
        status = v_requested_status,
        sort_order = coalesce(p_sort_order, 0),
        estimated_minutes = greatest(0, coalesce(p_estimated_minutes, 0)),
        retry_mode = coalesce(p_retry_mode, 'anytime'::public.lesson_retry_mode),
        retry_cooldown_seconds = p_retry_cooldown_seconds,
        retry_requires_reread = coalesce(p_retry_requires_reread, true),
        quiz_requires_lesson_completion = coalesce(p_quiz_requires_lesson_completion, true),
        max_earning_attempts = p_max_earning_attempts,
        updated_at = now()
    where id = v_lesson_id;
  else
    if v_slug_base = '' then
      v_slug_base := 'lesson';
    end if;

    v_slug := left(v_slug_base, 96);
    v_lesson_id := 'lesson-' || left(v_slug_base, 86);

    while exists(select 1 from public.lessons where id = v_lesson_id or slug = v_slug) loop
      v_counter := v_counter + 1;
      v_slug := left(v_slug_base, 90) || '-' || v_counter::text;
      v_lesson_id := 'lesson-' || left(v_slug_base, 80) || '-' || v_counter::text;
    end loop;

    insert into public.lessons (
      id,
      course_id,
      slug,
      title,
      description,
      cover_image,
      status,
      sort_order,
      estimated_minutes,
      retry_mode,
      retry_cooldown_seconds,
      retry_requires_reread,
      quiz_requires_lesson_completion,
      max_earning_attempts
    )
    values (
      v_lesson_id,
      p_course_id,
      v_slug,
      v_title,
      v_description,
      v_cover_image,
      v_requested_status,
      coalesce(p_sort_order, 0),
      greatest(0, coalesce(p_estimated_minutes, 0)),
      coalesce(p_retry_mode, 'anytime'::public.lesson_retry_mode),
      p_retry_cooldown_seconds,
      coalesce(p_retry_requires_reread, true),
      coalesce(p_quiz_requires_lesson_completion, true),
      p_max_earning_attempts
    );
  end if;

  if v_should_reset_text then
    perform public.admin_reset_ai_course_tree(p_course_id, 'draft');
  elsif v_should_reset_media then
    perform public.admin_reset_ai_course_media(p_course_id, v_lesson_id, 'draft');
  end if;

  perform public.admin_sync_course_estimated_minutes(p_course_id);

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'lesson_updated' else 'lesson_created' end,
    'lesson',
    v_lesson_id,
    jsonb_build_object(
      'courseId', p_course_id,
      'status', v_requested_status,
      'aiGenerated', coalesce(v_existing.ai_generated, false)
    )
  );

  return jsonb_build_object('lessonId', v_lesson_id);
end;
$$;
