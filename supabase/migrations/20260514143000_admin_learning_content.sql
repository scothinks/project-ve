create or replace function public.admin_slugify(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from lower(regexp_replace(trim(coalesce(p_value, '')), '[^a-zA-Z0-9]+', '-', 'g')));
$$;

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
  v_course_id text := lower(regexp_replace(trim(coalesce(p_course_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_slug_base text := public.admin_slugify(p_title);
  v_slug text;
  v_exists boolean := false;
  v_counter integer := 1;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage courses.';
  end if;

  if v_title = '' then
    raise exception 'Course title is required.';
  end if;

  select exists(select 1 from public.courses where id = v_course_id) into v_exists;

  if v_exists then
    update public.courses
    set title = v_title,
        description = nullif(trim(coalesce(p_description, '')), ''),
        category = nullif(trim(coalesce(p_category, '')), ''),
        level = coalesce(p_level, 'beginner'::public.course_level),
        status = coalesce(p_status, 'draft'::public.content_status),
        thumbnail = coalesce(p_thumbnail, '{}'::jsonb),
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
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(nullif(trim(coalesce(p_category, '')), ''), 'Values Education'),
      coalesce(p_level, 'beginner'::public.course_level),
      coalesce(p_status, 'draft'::public.content_status),
      coalesce(p_thumbnail, '{}'::jsonb),
      coalesce(p_sort_order, 0),
      greatest(0, coalesce(p_estimated_minutes, 0))
    );
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'course_updated' else 'course_created' end,
    'course',
    v_course_id,
    jsonb_build_object('title', v_title, 'status', p_status)
  );

  return jsonb_build_object('courseId', v_course_id, 'status', case when v_exists then 'updated' else 'created' end);
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
  v_lesson_id text := lower(regexp_replace(trim(coalesce(p_lesson_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_slug_base text := public.admin_slugify(p_title);
  v_slug text;
  v_exists boolean := false;
  v_counter integer := 1;
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

  select exists(select 1 from public.lessons where id = v_lesson_id) into v_exists;

  if v_exists then
    update public.lessons
    set course_id = p_course_id,
        title = v_title,
        description = nullif(trim(coalesce(p_description, '')), ''),
        cover_image = coalesce(p_cover_image, '{}'::jsonb),
        status = coalesce(p_status, 'draft'::public.content_status),
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

    while exists(select 1 from public.lessons where id = v_lesson_id or (course_id = p_course_id and slug = v_slug)) loop
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
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_cover_image, '{}'::jsonb),
      coalesce(p_status, 'draft'::public.content_status),
      coalesce(p_sort_order, 0),
      greatest(0, coalesce(p_estimated_minutes, 0)),
      coalesce(p_retry_mode, 'anytime'::public.lesson_retry_mode),
      p_retry_cooldown_seconds,
      coalesce(p_retry_requires_reread, true),
      coalesce(p_quiz_requires_lesson_completion, true),
      p_max_earning_attempts
    );

    insert into public.quizzes (id, lesson_id, title, status)
    values ('quiz-' || replace(v_lesson_id, 'lesson-', ''), v_lesson_id, v_title || ' Quiz', 'draft')
    on conflict (lesson_id) do nothing;
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'lesson_updated' else 'lesson_created' end,
    'lesson',
    v_lesson_id,
    jsonb_build_object('title', v_title, 'courseId', p_course_id, 'status', p_status)
  );

  return jsonb_build_object('lessonId', v_lesson_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;

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
  v_title text := trim(coalesce(p_title, ''));
  v_page_id text := lower(regexp_replace(trim(coalesce(p_page_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_exists boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lesson pages.';
  end if;

  if not exists(select 1 from public.lessons where id = p_lesson_id) then
    raise exception 'Lesson not found.';
  end if;

  if v_title = '' then
    raise exception 'Page title is required.';
  end if;

  if v_page_id = '' then
    v_page_id := 'page-' || left(public.admin_slugify(v_title), 80) || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  select exists(select 1 from public.lesson_pages where id = v_page_id) into v_exists;

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
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lesson content.';
  end if;

  if not exists(select 1 from public.lesson_pages where id = p_page_id) then
    raise exception 'Lesson page not found.';
  end if;

  select exists(select 1 from public.lesson_content_blocks where id = v_block_id) into v_exists;

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
    coalesce(p_sort_order, 0),
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

create or replace function public.admin_upsert_quiz_question(
  p_question_id text,
  p_quiz_id text,
  p_prompt text,
  p_question_type public.quiz_question_type,
  p_explanation text,
  p_xp integer,
  p_question_order integer,
  p_options jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_prompt text := trim(coalesce(p_prompt, ''));
  v_question_id text := lower(regexp_replace(trim(coalesce(p_question_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_option jsonb;
  v_option_index integer := 0;
  v_option_id text;
  v_exists boolean := false;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage quiz questions.';
  end if;

  if not exists(select 1 from public.quizzes where id = p_quiz_id) then
    raise exception 'Quiz not found.';
  end if;

  if v_prompt = '' then
    raise exception 'Question prompt is required.';
  end if;

  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) < 2 then
    raise exception 'At least two options are required.';
  end if;

  if v_question_id = '' then
    v_question_id := 'question-' || left(public.admin_slugify(v_prompt), 70) || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  select exists(select 1 from public.quiz_questions where id = v_question_id) into v_exists;

  insert into public.quiz_questions (
    id,
    quiz_id,
    question_order,
    question_type,
    prompt,
    explanation,
    xp
  )
  values (
    v_question_id,
    p_quiz_id,
    greatest(1, coalesce(p_question_order, 1)),
    coalesce(p_question_type, 'single_choice'::public.quiz_question_type),
    v_prompt,
    nullif(trim(coalesce(p_explanation, '')), ''),
    greatest(1, coalesce(p_xp, 1))
  )
  on conflict (id) do update
  set quiz_id = excluded.quiz_id,
      question_order = excluded.question_order,
      question_type = excluded.question_type,
      prompt = excluded.prompt,
      explanation = excluded.explanation,
      xp = excluded.xp,
      updated_at = now();

  delete from public.quiz_options where question_id = v_question_id;

  for v_option in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) loop
    v_option_index := v_option_index + 1;
    v_option_id := v_question_id || '-option-' || v_option_index::text;

    insert into public.quiz_options (
      id,
      question_id,
      option_order,
      label,
      is_correct
    )
    values (
      v_option_id,
      v_question_id,
      v_option_index,
      coalesce(v_option ->> 'label', ''),
      coalesce((v_option ->> 'isCorrect')::boolean, false)
    );
  end loop;

  update public.quizzes
  set version = version + 1,
      updated_at = now()
  where id = p_quiz_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'quiz_question_updated' else 'quiz_question_created' end,
    'quiz_question',
    v_question_id,
    jsonb_build_object('quizId', p_quiz_id, 'xp', p_xp)
  );

  return jsonb_build_object('questionId', v_question_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;

grant execute on function public.admin_upsert_course(text, text, text, text, public.course_level, public.content_status, jsonb, integer, integer) to authenticated;
grant execute on function public.admin_upsert_lesson(text, text, text, text, jsonb, public.content_status, integer, integer, public.lesson_retry_mode, integer, boolean, boolean, integer) to authenticated;
grant execute on function public.admin_upsert_lesson_page(text, text, text, text, public.lesson_page_type, integer, jsonb) to authenticated;
grant execute on function public.admin_upsert_lesson_block(uuid, text, public.lesson_content_block_type, integer, jsonb) to authenticated;
grant execute on function public.admin_upsert_quiz_question(text, text, text, public.quiz_question_type, text, integer, integer, jsonb) to authenticated;
