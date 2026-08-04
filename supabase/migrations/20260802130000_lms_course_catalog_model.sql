do $$ begin
  create type public.course_catalog_scope as enum (
    'platform',
    'organization_private',
    'adapted_platform'
  );
exception when duplicate_object then null;
end $$;

alter table public.courses
  add column if not exists catalog_scope public.course_catalog_scope not null default 'platform',
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists source_course_id text references public.courses(id) on delete restrict,
  add column if not exists source_catalog_version integer,
  add column if not exists copied_at timestamptz,
  add column if not exists local_changes jsonb not null default '{}'::jsonb,
  add column if not exists upstream_update_available boolean not null default false,
  add column if not exists catalog_version integer not null default 1 check (catalog_version > 0);

create index if not exists courses_catalog_scope_idx
  on public.courses(catalog_scope, status);

create index if not exists courses_organization_catalog_idx
  on public.courses(organization_id, catalog_scope, status);

create index if not exists courses_source_course_idx
  on public.courses(source_course_id);

alter table public.courses
  drop constraint if exists courses_catalog_scope_owner_check,
  drop constraint if exists courses_catalog_source_check;

alter table public.courses
  add constraint courses_catalog_scope_owner_check
  check (
    (
      catalog_scope = 'platform'
      and organization_id is null
      and source_course_id is null
      and source_catalog_version is null
      and copied_at is null
    )
    or (
      catalog_scope = 'organization_private'
      and organization_id is not null
      and source_course_id is null
      and source_catalog_version is null
    )
    or (
      catalog_scope = 'adapted_platform'
      and organization_id is not null
      and source_course_id is not null
      and source_catalog_version is not null
      and source_catalog_version > 0
      and copied_at is not null
    )
  ),
  add constraint courses_catalog_source_check
  check (source_course_id is null or source_course_id <> id);

create or replace function public.current_user_can_edit_organization_content(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.current_user_has_organization_role(
      p_organization_id,
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'content_editor'
      ]::public.organization_role_key[]
    );
$$;

create or replace function public.current_user_can_read_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and (
        public.current_user_is_admin()
        or (
          course.catalog_scope = 'platform'
          and course.status = 'published'
        )
        or (
          course.organization_id is not null
          and (
            public.current_user_has_organization_role(
              course.organization_id,
              array[
                'organisation_owner',
                'organisation_admin',
                'programme_manager',
                'content_editor',
                'reviewer',
                'instructor',
                'report_viewer'
              ]::public.organization_role_key[]
            )
            or (
              course.status = 'published'
              and public.current_user_has_organization_role(course.organization_id, null)
            )
          )
        )
      )
  );
$$;

create or replace function public.current_user_can_edit_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses course
    where course.id = p_course_id
      and (
        public.current_user_is_admin()
        or (
          course.catalog_scope <> 'platform'
          and course.organization_id is not null
          and public.current_user_can_edit_organization_content(course.organization_id)
        )
      )
  );
$$;

revoke execute on function public.current_user_can_edit_organization_content(uuid) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_edit_organization_content(uuid) to authenticated, service_role;

revoke execute on function public.current_user_can_read_course(text) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_read_course(text) to anon, authenticated, service_role;

revoke execute on function public.current_user_can_edit_course(text) from public, anon, authenticated, service_role;
grant execute on function public.current_user_can_edit_course(text) to authenticated, service_role;

drop policy if exists "Published courses are readable" on public.courses;
create policy "Published courses are readable"
  on public.courses for select
  using (public.current_user_can_read_course(id));

drop policy if exists "Published lessons are readable" on public.lessons;
create policy "Published lessons are readable"
  on public.lessons for select
  using (
    public.current_user_can_edit_course(course_id)
    or (
      status = 'published'
      and public.current_user_can_read_course(course_id)
    )
  );

drop policy if exists "Published lesson pages are readable" on public.lesson_pages;
create policy "Published lesson pages are readable"
  on public.lesson_pages for select
  using (
    exists (
      select 1
      from public.lessons lesson
      where lesson.id = lesson_pages.lesson_id
        and (
          public.current_user_can_edit_course(lesson.course_id)
          or (
            lesson.status = 'published'
            and public.current_user_can_read_course(lesson.course_id)
          )
        )
    )
  );

drop policy if exists "Published lesson blocks are readable" on public.lesson_content_blocks;
create policy "Published lesson blocks are readable"
  on public.lesson_content_blocks for select
  using (
    exists (
      select 1
      from public.lesson_pages page
      join public.lessons lesson
        on lesson.id = page.lesson_id
      where page.id = lesson_content_blocks.page_id
        and (
          public.current_user_can_edit_course(lesson.course_id)
          or (
            lesson.status = 'published'
            and public.current_user_can_read_course(lesson.course_id)
          )
        )
    )
  );

drop policy if exists "Published quizzes are readable" on public.quizzes;
create policy "Published quizzes are readable"
  on public.quizzes for select
  using (
    exists (
      select 1
      from public.lessons lesson
      where lesson.id = quizzes.lesson_id
        and (
          public.current_user_can_edit_course(lesson.course_id)
          or (
            quizzes.status = 'published'
            and lesson.status = 'published'
            and public.current_user_can_read_course(lesson.course_id)
          )
        )
    )
  );

drop policy if exists "Published quiz questions are readable" on public.quiz_questions;
drop policy if exists "Organization content editors can read quiz questions" on public.quiz_questions;
create policy "Organization content editors can read quiz questions"
  on public.quiz_questions for select
  using (
    exists (
      select 1
      from public.quizzes quiz
      join public.lessons lesson
        on lesson.id = quiz.lesson_id
      where quiz.id = quiz_questions.quiz_id
        and public.current_user_can_edit_course(lesson.course_id)
    )
  );

drop policy if exists "Published quiz options are readable" on public.quiz_options;
drop policy if exists "Organization content editors can read quiz options" on public.quiz_options;
create policy "Organization content editors can read quiz options"
  on public.quiz_options for select
  using (
    exists (
      select 1
      from public.quiz_questions question
      join public.quizzes quiz
        on quiz.id = question.quiz_id
      join public.lessons lesson
        on lesson.id = quiz.lesson_id
      where question.id = quiz_options.question_id
        and public.current_user_can_edit_course(lesson.course_id)
    )
  );

drop policy if exists "Organization content editors can insert organization courses" on public.courses;
create policy "Organization content editors can insert organization courses"
  on public.courses for insert
  with check (
    catalog_scope <> 'platform'
    and organization_id is not null
    and public.current_user_can_edit_organization_content(organization_id)
  );

drop policy if exists "Organization content editors can update organization courses" on public.courses;
create policy "Organization content editors can update organization courses"
  on public.courses for update
  using (
    catalog_scope <> 'platform'
    and organization_id is not null
    and public.current_user_can_edit_organization_content(organization_id)
  )
  with check (
    catalog_scope <> 'platform'
    and organization_id is not null
    and public.current_user_can_edit_organization_content(organization_id)
  );

create or replace function public.enforce_course_catalog_model()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.courses%rowtype;
begin
  if new.catalog_scope = 'adapted_platform' then
    select *
      into v_source
    from public.courses
    where id = new.source_course_id;

    if not found then
      raise exception 'Adapted courses must reference a source platform course.';
    end if;

    if v_source.catalog_scope <> 'platform' then
      raise exception 'Adapted courses can only reference canonical platform courses.';
    end if;

    new.source_catalog_version := coalesce(new.source_catalog_version, v_source.catalog_version);
    new.copied_at := coalesce(new.copied_at, now());
  end if;

  if tg_op = 'UPDATE'
    and old.catalog_scope = 'platform'
    and (
      old.title is distinct from new.title
      or old.description is distinct from new.description
      or old.intended_audience is distinct from new.intended_audience
      or old.learning_outcomes is distinct from new.learning_outcomes
      or old.category is distinct from new.category
      or old.level is distinct from new.level
      or old.thumbnail is distinct from new.thumbnail
      or old.status is distinct from new.status
    )
  then
    new.catalog_version := old.catalog_version + 1;
  end if;

  if tg_op = 'UPDATE'
    and old.catalog_scope <> 'platform'
    and (
      old.title is distinct from new.title
      or old.description is distinct from new.description
      or old.intended_audience is distinct from new.intended_audience
      or old.learning_outcomes is distinct from new.learning_outcomes
      or old.category is distinct from new.category
      or old.level is distinct from new.level
      or old.thumbnail is distinct from new.thumbnail
      or old.status is distinct from new.status
    )
  then
    new.local_changes := coalesce(new.local_changes, '{}'::jsonb) || jsonb_build_object('courseMetadataChangedAt', now());
  end if;

  return new;
end;
$$;

create or replace function public.flag_adapted_course_upstream_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.catalog_scope = 'platform'
    and new.catalog_version > old.catalog_version
  then
    update public.courses
    set upstream_update_available = true,
        updated_at = now()
    where source_course_id = new.id
      and catalog_scope = 'adapted_platform'
      and source_catalog_version < new.catalog_version;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_course_catalog_model_trigger on public.courses;
create trigger enforce_course_catalog_model_trigger
  before insert or update on public.courses
  for each row execute function public.enforce_course_catalog_model();

drop trigger if exists flag_adapted_course_upstream_updates_trigger on public.courses;
create trigger flag_adapted_course_upstream_updates_trigger
  after update on public.courses
  for each row execute function public.flag_adapted_course_upstream_updates();

revoke execute on function public.enforce_course_catalog_model() from public, anon, authenticated, service_role;
revoke execute on function public.flag_adapted_course_upstream_updates() from public, anon, authenticated, service_role;

create or replace function public.admin_create_organization_private_course(
  p_organization_id uuid,
  p_title text,
  p_description text,
  p_intended_audience text,
  p_learning_outcomes text[],
  p_category text,
  p_level public.course_level,
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
  v_slug_base text := public.admin_slugify(p_title);
  v_slug text;
  v_course_id text;
  v_counter integer := 1;
  v_learning_outcomes text[] := array(
    select outcome
    from unnest(coalesce(p_learning_outcomes, '{}'::text[])) as outcome
    where trim(outcome) <> ''
  );
begin
  if v_actor_id is null or not public.current_user_can_edit_organization_content(p_organization_id) then
    raise exception 'Organization content editor access required.';
  end if;

  if v_title = '' then
    raise exception 'Course title is required.';
  end if;

  if not exists(select 1 from public.organizations where id = p_organization_id and status <> 'archived') then
    raise exception 'Organization not found.';
  end if;

  if v_slug_base = '' then
    v_slug_base := 'organization-course';
  end if;

  v_slug := left(v_slug_base, 82);
  v_course_id := 'course-' || left(v_slug_base, 74);

  while exists(select 1 from public.courses where id = v_course_id or slug = v_slug) loop
    v_counter := v_counter + 1;
    v_slug := left(v_slug_base, 76) || '-' || v_counter::text;
    v_course_id := 'course-' || left(v_slug_base, 68) || '-' || v_counter::text;
  end loop;

  insert into public.courses (
    id,
    slug,
    title,
    description,
    intended_audience,
    learning_outcomes,
    category,
    level,
    status,
    thumbnail,
    sort_order,
    estimated_minutes,
    catalog_scope,
    organization_id
  )
  values (
    v_course_id,
    v_slug,
    v_title,
    nullif(trim(coalesce(p_description, '')), ''),
    trim(coalesce(p_intended_audience, '')),
    v_learning_outcomes,
    coalesce(nullif(trim(coalesce(p_category, '')), ''), 'Values Education'),
    coalesce(p_level, 'beginner'::public.course_level),
    'draft',
    coalesce(p_thumbnail, '{}'::jsonb),
    coalesce(p_sort_order, 0),
    greatest(0, coalesce(p_estimated_minutes, 0)),
    'organization_private',
    p_organization_id
  );

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_private_course_created',
    'course',
    v_course_id,
    jsonb_build_object('organizationId', p_organization_id, 'title', v_title)
  );

  return jsonb_build_object('courseId', v_course_id, 'status', 'created');
end;
$$;

create or replace function public.admin_adapt_platform_course(
  p_source_course_id text,
  p_organization_id uuid,
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
  v_block record;
  v_quiz record;
  v_question record;
  v_new_lesson_id text;
  v_new_page_id text;
  v_new_quiz_id text;
  v_new_question_id text;
begin
  if v_actor_id is null or not public.current_user_can_edit_organization_content(p_organization_id) then
    raise exception 'Organization content editor access required.';
  end if;

  select *
    into v_source
  from public.courses
  where id = p_source_course_id;

  if not found then
    raise exception 'Source course not found.';
  end if;

  if v_source.catalog_scope <> 'platform' then
    raise exception 'Only canonical platform courses can be adapted.';
  end if;

  if not exists(select 1 from public.organizations where id = p_organization_id and status <> 'archived') then
    raise exception 'Organization not found.';
  end if;

  if v_title is null then
    v_title := v_source.title || ' adaptation';
  end if;

  v_slug_base := public.admin_slugify(v_title);
  if v_slug_base = '' then
    v_slug_base := 'adapted-course';
  end if;

  v_new_course_id := 'course-' || left(v_slug_base, 72) || '-' || v_suffix;
  v_new_slug := left(v_slug_base, 84) || '-' || v_suffix;
  select coalesce(max(sort_order), 0) + 1
    into v_next_sort_order
  from public.courses
  where organization_id = p_organization_id;

  create temporary table if not exists pg_temp.lms_catalog_lesson_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;
  create temporary table if not exists pg_temp.lms_catalog_page_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;
  create temporary table if not exists pg_temp.lms_catalog_quiz_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;
  create temporary table if not exists pg_temp.lms_catalog_question_map (
    old_id text primary key,
    new_id text not null
  ) on commit drop;

  truncate table
    pg_temp.lms_catalog_lesson_map,
    pg_temp.lms_catalog_page_map,
    pg_temp.lms_catalog_quiz_map,
    pg_temp.lms_catalog_question_map;

  insert into public.courses (
    id,
    slug,
    title,
    description,
    intended_audience,
    learning_outcomes,
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
    catalog_scope,
    organization_id,
    source_course_id,
    source_catalog_version,
    copied_at,
    local_changes,
    upstream_update_available
  )
  values (
    v_new_course_id,
    v_new_slug,
    v_title,
    v_source.description,
    v_source.intended_audience,
    v_source.learning_outcomes,
    v_source.category,
    v_source.level,
    v_source.thumbnail,
    'draft',
    greatest(0, v_next_sort_order),
    v_source.estimated_minutes,
    'not_started',
    'not_started',
    'not_ready',
    false,
    jsonb_build_object(
      'adaptedFromCourseId', v_source.id,
      'adaptedFromCatalogVersion', v_source.catalog_version,
      'adaptedAt', now()
    ),
    'adapted_platform',
    p_organization_id,
    v_source.id,
    v_source.catalog_version,
    now(),
    '{}'::jsonb,
    false
  );

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
      ai_generation_notes
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
      'not_started',
      'not_started',
      'not_ready',
      false,
      jsonb_build_object('adaptedFromLessonId', v_lesson.id, 'adaptedFromCourseId', v_source.id)
    );

    insert into pg_temp.lms_catalog_lesson_map (old_id, new_id)
    values (v_lesson.id, v_new_lesson_id);
  end loop;

  for v_page in
    select page.*
    from public.lesson_pages page
    join pg_temp.lms_catalog_lesson_map lesson_map
      on lesson_map.old_id = page.lesson_id
    order by page.lesson_id, page.page_number, page.id
  loop
    v_new_page_id := 'page-' || left(coalesce(nullif(public.admin_slugify(v_page.title), ''), 'page'), 62)
      || '-' || left(replace(gen_random_uuid()::text, '-', ''), 10);

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
      v_new_page_id,
      (select new_id from pg_temp.lms_catalog_lesson_map where old_id = v_page.lesson_id),
      v_page.page_number,
      v_page.title,
      v_page.subtitle,
      v_page.page_type,
      v_page.cover_image
    );

    insert into pg_temp.lms_catalog_page_map (old_id, new_id)
    values (v_page.id, v_new_page_id);
  end loop;

  for v_block in
    select block.*
    from public.lesson_content_blocks block
    join pg_temp.lms_catalog_page_map page_map
      on page_map.old_id = block.page_id
    order by block.page_id, block.sort_order, block.id
  loop
    insert into public.lesson_content_blocks (
      page_id,
      block_type,
      sort_order,
      payload
    )
    values (
      (select new_id from pg_temp.lms_catalog_page_map where old_id = v_block.page_id),
      v_block.block_type,
      v_block.sort_order,
      v_block.payload
    );
  end loop;

  for v_quiz in
    select quiz.*
    from public.quizzes quiz
    join pg_temp.lms_catalog_lesson_map lesson_map
      on lesson_map.old_id = quiz.lesson_id
    order by quiz.lesson_id, quiz.id
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
      ai_generation_notes
    )
    values (
      v_new_quiz_id,
      (select new_id from pg_temp.lms_catalog_lesson_map where old_id = v_quiz.lesson_id),
      v_quiz.title,
      1,
      'draft',
      'not_started',
      false,
      jsonb_build_object('adaptedFromQuizId', v_quiz.id, 'adaptedFromCourseId', v_source.id)
    );

    insert into pg_temp.lms_catalog_quiz_map (old_id, new_id)
    values (v_quiz.id, v_new_quiz_id);
  end loop;

  for v_question in
    select question.*
    from public.quiz_questions question
    join pg_temp.lms_catalog_quiz_map quiz_map
      on quiz_map.old_id = question.quiz_id
    order by question.quiz_id, question.question_order, question.id
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
    values (
      v_new_question_id,
      (select new_id from pg_temp.lms_catalog_quiz_map where old_id = v_question.quiz_id),
      v_question.question_order,
      v_question.question_type,
      v_question.prompt,
      v_question.explanation,
      v_question.xp
    );

    insert into pg_temp.lms_catalog_question_map (old_id, new_id)
    values (v_question.id, v_new_question_id);
  end loop;

  insert into public.quiz_options (
    id,
    question_id,
    option_order,
    label,
    is_correct
  )
  select
    gen_random_uuid(),
    question_map.new_id,
    option.option_order,
    option.label,
    option.is_correct
  from public.quiz_options option
  join pg_temp.lms_catalog_question_map question_map
    on question_map.old_id = option.question_id
  order by option.question_id, option.option_order, option.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_course_adapted',
    'course',
    v_new_course_id,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'sourceCourseId', v_source.id,
      'sourceCatalogVersion', v_source.catalog_version
    )
  );

  return jsonb_build_object(
    'courseId', v_new_course_id,
    'sourceCourseId', v_source.id,
    'sourceCatalogVersion', v_source.catalog_version,
    'status', 'created'
  );
end;
$$;

revoke execute on function public.admin_create_organization_private_course(uuid, text, text, text, text[], text, public.course_level, jsonb, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_organization_private_course(uuid, text, text, text, text[], text, public.course_level, jsonb, integer, integer) to authenticated, service_role;

revoke execute on function public.admin_adapt_platform_course(text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_adapt_platform_course(text, uuid, text) to authenticated, service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'public',
    'current_user_can_edit_organization_content',
    'p_organization_id uuid',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, RLS policies and LMS content RPCs checking contextual organisation content edit rights.',
    'Allows platform admins or active organisation_owner, organisation_admin, programme_manager or content_editor memberships for the requested organization id.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_read_course',
    'p_course_id text',
    'PUBLIC_ANON',
    'Learner catalogue RLS helper for published platform courses and organisation-scoped course visibility.',
    'Allows public published platform courses, platform admins, organisation staff roles, and active organisation members for published organisation courses.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'current_user_can_edit_course',
    'p_course_id text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated app, RLS policies and LMS content RPCs checking whether the caller can edit a course.',
    'Allows platform admins for any course and organisation content editors only for non-platform courses owned by their organisation.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_create_organization_private_course',
    'p_organization_id uuid, p_title text, p_description text, p_intended_audience text, p_learning_outcomes text[], p_category text, p_level course_level, p_thumbnail jsonb, p_sort_order integer, p_estimated_minutes integer',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation content editor private course creation workflow.',
    'Requires auth.uid() and platform admin or active organisation_owner, organisation_admin, programme_manager or content_editor membership before creating an organisation-private draft course.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_adapt_platform_course',
    'p_source_course_id text, p_organization_id uuid, p_title text',
    'ADMIN_AUTHENTICATED',
    'Platform admin or contextual organisation content editor platform course adaptation workflow.',
    'Requires auth.uid(), organisation content edit rights and a canonical platform source course before copying an independent draft course tree with provenance.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'enforce_course_catalog_model',
    '',
    'TRIGGER_ONLY',
    'Course catalogue ownership/provenance trigger.',
    'Runs only as a table trigger to validate adapted source provenance and mark local/adapted changes.',
    array[]::text[]
  ),
  (
    'public',
    'flag_adapted_course_upstream_updates',
    '',
    'TRIGGER_ONLY',
    'Course catalogue upstream update trigger.',
    'Runs only as a table trigger to mark adapted courses when their source platform course version changes.',
    array[]::text[]
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
