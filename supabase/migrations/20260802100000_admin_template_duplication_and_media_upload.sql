update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'learning-media';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'learning-media', 'learning-media', true, 10485760, array['image/png', 'image/jpeg', 'image/webp']
where not exists (
  select 1
  from storage.buckets
  where id = 'learning-media'
);

create or replace function public.admin_duplicate_course_template(
  p_source_course_id text,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_source public.courses%rowtype;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_slug_base text;
  v_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 10);
  v_new_course_id text;
  v_new_slug text;
  v_next_sort_order integer;
  v_lesson record;
  v_page record;
  v_media record;
  v_block record;
  v_quiz record;
  v_question record;
  v_new_lesson_id text;
  v_new_page_id text;
  v_new_media_id uuid;
  v_new_quiz_id text;
  v_new_question_id text;
  v_payload jsonb;
  v_mapped_media_id uuid;
  v_lesson_count integer := 0;
  v_page_count integer := 0;
  v_block_count integer := 0;
  v_quiz_count integer := 0;
  v_question_count integer := 0;
  v_option_count integer := 0;
  v_inserted_option_count integer := 0;
  v_media_count integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can duplicate course templates.';
  end if;

  select *
    into v_source
  from public.courses
  where id = p_source_course_id;

  if not found then
    raise exception 'Template course not found.';
  end if;

  if v_title is null then
    v_title := 'Copy of ' || v_source.title;
  end if;

  v_slug_base := public.admin_slugify(v_title);
  if v_slug_base = '' then
    v_slug_base := 'course-template';
  end if;

  v_new_course_id := 'course-' || left(v_slug_base, 72) || '-' || v_suffix;
  v_new_slug := left(v_slug_base, 84) || '-' || v_suffix;
  select coalesce(max(sort_order), 0) + 1
    into v_next_sort_order
  from public.courses;

  create temporary table if not exists pg_temp.admin_template_lesson_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;
  create temporary table if not exists pg_temp.admin_template_page_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;
  create temporary table if not exists pg_temp.admin_template_media_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;
  create temporary table if not exists pg_temp.admin_template_quiz_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;
  create temporary table if not exists pg_temp.admin_template_question_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;

  truncate table
    pg_temp.admin_template_lesson_map,
    pg_temp.admin_template_page_map,
    pg_temp.admin_template_media_map,
    pg_temp.admin_template_quiz_map,
    pg_temp.admin_template_question_map;

  insert into public.courses (
    id,
    slug,
    title,
    description,
    category,
    level,
    thumbnail,
    status,
    sort_order,
    estimated_minutes,
    ai_text_status,
    ai_media_status,
    ai_publish_status,
    ai_generated,
    ai_generation_notes,
    text_approved_at,
    text_approved_by,
    media_approved_at,
    media_approved_by
  )
  values (
    v_new_course_id,
    v_new_slug,
    v_title,
    v_source.description,
    v_source.category,
    v_source.level,
    v_source.thumbnail,
    'draft',
    greatest(0, v_next_sort_order),
    v_source.estimated_minutes,
    case when v_source.ai_generated then 'draft' else 'not_started' end,
    case when v_source.ai_generated then 'draft' else 'not_started' end,
    'not_ready',
    v_source.ai_generated,
    coalesce(v_source.ai_generation_notes, '{}'::jsonb) || jsonb_build_object(
      'duplicatedFromCourseId', v_source.id,
      'duplicatedAt', now()
    ),
    null,
    null,
    null,
    null
  );

  if current_setting('project_ve.simulate_template_duplication_failure', true) = '1' then
    raise exception 'Simulated template duplication failure.';
  end if;

  insert into public.content_value_tags (
    content_type,
    content_id,
    dimension_id,
    weight,
    recommended_level,
    outcome_type
  )
  select
    'course',
    v_new_course_id,
    dimension_id,
    weight,
    recommended_level,
    outcome_type
  from public.content_value_tags
  where content_type = 'course'
    and content_id = v_source.id;

  for v_lesson in
    select *
    from public.lessons
    where course_id = v_source.id
    order by sort_order, created_at, id
  loop
    v_new_lesson_id := 'lesson-' || left(coalesce(nullif(public.admin_slugify(v_lesson.title), ''), 'lesson'), 62)
      || '-' || left(replace(gen_random_uuid()::text, '-', ''), 10);

    insert into public.lessons (
      id,
      course_id,
      slug,
      title,
      subtitle,
      description,
      cover_image,
      status,
      sort_order,
      estimated_minutes,
      retry_mode,
      retry_cooldown_seconds,
      retry_requires_reread,
      quiz_requires_lesson_completion,
      max_earning_attempts,
      ai_text_status,
      ai_media_status,
      ai_publish_status,
      ai_generated,
      ai_generation_notes,
      text_approved_at,
      text_approved_by,
      media_approved_at,
      media_approved_by
    )
    values (
      v_new_lesson_id,
      v_new_course_id,
      left(coalesce(nullif(public.admin_slugify(v_lesson.slug), ''), 'lesson'), 82)
        || '-' || left(replace(gen_random_uuid()::text, '-', ''), 10),
      v_lesson.title,
      v_lesson.subtitle,
      v_lesson.description,
      v_lesson.cover_image,
      'draft',
      v_lesson.sort_order,
      v_lesson.estimated_minutes,
      v_lesson.retry_mode,
      v_lesson.retry_cooldown_seconds,
      v_lesson.retry_requires_reread,
      v_lesson.quiz_requires_lesson_completion,
      v_lesson.max_earning_attempts,
      case when v_lesson.ai_generated then 'draft' else 'not_started' end,
      case when v_lesson.ai_generated then 'draft' else 'not_started' end,
      'not_ready',
      v_lesson.ai_generated,
      coalesce(v_lesson.ai_generation_notes, '{}'::jsonb) || jsonb_build_object(
        'duplicatedFromLessonId', v_lesson.id,
        'duplicatedFromCourseId', v_source.id,
        'duplicatedAt', now()
      ),
      null,
      null,
      null,
      null
    );

    insert into pg_temp.admin_template_lesson_map (old_id, new_id)
    values (v_lesson.id, v_new_lesson_id);

    insert into public.content_value_tags (
      content_type,
      content_id,
      dimension_id,
      weight,
      recommended_level,
      outcome_type
    )
    select
      'lesson',
      v_new_lesson_id,
      dimension_id,
      weight,
      recommended_level,
      outcome_type
    from public.content_value_tags
    where content_type = 'lesson'
      and content_id = v_lesson.id;

    v_lesson_count := v_lesson_count + 1;
  end loop;

  for v_page in
    select lp.*
    from public.lesson_pages lp
    join pg_temp.admin_template_lesson_map lm
      on lm.old_id = lp.lesson_id
    order by lp.lesson_id, lp.page_number, lp.created_at, lp.id
  loop
    v_new_page_id := 'page-' || left(replace(gen_random_uuid()::text, '-', ''), 24);

    insert into public.lesson_pages (
      id,
      lesson_id,
      page_number,
      title,
      subtitle,
      page_type,
      cover_image
    )
    select
      v_new_page_id,
      lm.new_id,
      v_page.page_number,
      v_page.title,
      v_page.subtitle,
      v_page.page_type,
      v_page.cover_image
    from pg_temp.admin_template_lesson_map lm
    where lm.old_id = v_page.lesson_id;

    insert into pg_temp.admin_template_page_map (old_id, new_id)
    values (v_page.id, v_new_page_id);

    v_page_count := v_page_count + 1;
  end loop;

  for v_media in
    select lma.*
    from public.learning_media_assets lma
    left join pg_temp.admin_template_lesson_map lm
      on lm.old_id = lma.lesson_id
    where lma.course_id = v_source.id
       or lm.old_id is not null
    order by lma.sort_order, lma.created_at, lma.id
  loop
    v_new_media_id := gen_random_uuid();

    insert into public.learning_media_assets (
      id,
      course_id,
      lesson_id,
      asset_type,
      placement,
      source,
      prompt,
      script,
      url,
      storage_path,
      provider,
      model,
      alt_text,
      caption,
      metadata,
      review_status,
      generation_status,
      generation_error,
      sort_order
    )
    select
      v_new_media_id,
      v_new_course_id,
      lm.new_id,
      v_media.asset_type,
      v_media.placement,
      v_media.source,
      v_media.prompt,
      v_media.script,
      v_media.url,
      v_media.storage_path,
      v_media.provider,
      v_media.model,
      v_media.alt_text,
      v_media.caption,
      coalesce(v_media.metadata, '{}'::jsonb) || jsonb_build_object(
        'duplicatedFromAssetId', v_media.id,
        'duplicatedFromCourseId', v_source.id,
        'duplicatedAt', now()
      ),
      'draft',
      v_media.generation_status,
      null,
      v_media.sort_order
    from (select 1) source_row
    left join pg_temp.admin_template_lesson_map lm
      on lm.old_id = v_media.lesson_id;

    insert into pg_temp.admin_template_media_map (old_id, new_id)
    values (v_media.id, v_new_media_id);

    v_media_count := v_media_count + 1;
  end loop;

  for v_block in
    select lcb.*
    from public.lesson_content_blocks lcb
    join pg_temp.admin_template_page_map pm
      on pm.old_id = lcb.page_id
    order by lcb.page_id, lcb.sort_order, lcb.created_at, lcb.id
  loop
    v_payload := coalesce(v_block.payload, '{}'::jsonb);

    if v_payload ? 'aiManagedByAssetId' then
      select new_id
        into v_mapped_media_id
      from pg_temp.admin_template_media_map
      where old_id::text = v_payload ->> 'aiManagedByAssetId';

      if found then
        v_payload := jsonb_set(v_payload, '{aiManagedByAssetId}', to_jsonb(v_mapped_media_id::text), true);
      end if;
    end if;

    insert into public.lesson_content_blocks (
      page_id,
      block_type,
      sort_order,
      payload
    )
    select
      pm.new_id,
      v_block.block_type,
      v_block.sort_order,
      v_payload
    from pg_temp.admin_template_page_map pm
    where pm.old_id = v_block.page_id;

    v_block_count := v_block_count + 1;
  end loop;

  for v_quiz in
    select q.*
    from public.quizzes q
    join pg_temp.admin_template_lesson_map lm
      on lm.old_id = q.lesson_id
    order by q.created_at, q.id
  loop
    v_new_quiz_id := 'quiz-' || left(replace(gen_random_uuid()::text, '-', ''), 24);

    insert into public.quizzes (
      id,
      lesson_id,
      title,
      version,
      status,
      ai_text_status,
      ai_generated,
      ai_generation_notes,
      text_approved_at,
      text_approved_by
    )
    select
      v_new_quiz_id,
      lm.new_id,
      v_quiz.title,
      1,
      'draft',
      case when v_quiz.ai_generated then 'draft' else 'not_started' end,
      v_quiz.ai_generated,
      coalesce(v_quiz.ai_generation_notes, '{}'::jsonb) || jsonb_build_object(
        'duplicatedFromQuizId', v_quiz.id,
        'duplicatedFromCourseId', v_source.id,
        'duplicatedAt', now()
      ),
      null,
      null
    from pg_temp.admin_template_lesson_map lm
    where lm.old_id = v_quiz.lesson_id;

    insert into pg_temp.admin_template_quiz_map (old_id, new_id)
    values (v_quiz.id, v_new_quiz_id);

    v_quiz_count := v_quiz_count + 1;
  end loop;

  for v_question in
    select qq.*
    from public.quiz_questions qq
    join pg_temp.admin_template_quiz_map qm
      on qm.old_id = qq.quiz_id
    order by qq.quiz_id, qq.question_order, qq.created_at, qq.id
  loop
    v_new_question_id := 'question-' || left(replace(gen_random_uuid()::text, '-', ''), 24);

    insert into public.quiz_questions (
      id,
      quiz_id,
      question_order,
      question_type,
      prompt,
      explanation,
      xp
    )
    select
      v_new_question_id,
      qm.new_id,
      v_question.question_order,
      v_question.question_type,
      v_question.prompt,
      v_question.explanation,
      v_question.xp
    from pg_temp.admin_template_quiz_map qm
    where qm.old_id = v_question.quiz_id;

    insert into pg_temp.admin_template_question_map (old_id, new_id)
    values (v_question.id, v_new_question_id);

    insert into public.quiz_options (
      id,
      question_id,
      option_order,
      label,
      is_correct
    )
    select
      'option-' || left(replace(gen_random_uuid()::text, '-', ''), 24),
      v_new_question_id,
      qo.option_order,
      qo.label,
      qo.is_correct
    from public.quiz_options qo
    where qo.question_id = v_question.id
    order by qo.option_order, qo.created_at, qo.id;

    get diagnostics v_inserted_option_count = row_count;
    v_option_count := v_option_count + v_inserted_option_count;
    v_question_count := v_question_count + 1;
  end loop;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'course_template_duplicated',
    'course',
    v_new_course_id,
    jsonb_build_object(
      'sourceCourseId', v_source.id,
      'lessonCount', v_lesson_count,
      'pageCount', v_page_count,
      'blockCount', v_block_count,
      'quizCount', v_quiz_count,
      'questionCount', v_question_count,
      'optionCount', v_option_count,
      'mediaCount', v_media_count
    )
  );

  return jsonb_build_object(
    'courseId', v_new_course_id,
    'sourceCourseId', v_source.id,
    'lessonCount', v_lesson_count,
    'pageCount', v_page_count,
    'blockCount', v_block_count,
    'quizCount', v_quiz_count,
    'questionCount', v_question_count,
    'optionCount', v_option_count,
    'mediaCount', v_media_count
  );
end;
$$;

revoke execute on function public.admin_duplicate_course_template(text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_duplicate_course_template(text, text) to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values (
  'public',
  'admin_duplicate_course_template',
  'p_source_course_id text, p_title text',
  'ADMIN_AUTHENTICATED',
  'CMS course template duplication flow.',
  'Requires auth.uid() and public.current_user_is_admin(), then copies only authoring records into a new draft course tree inside one transaction.',
  array['authenticated', 'service_role']
)
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
