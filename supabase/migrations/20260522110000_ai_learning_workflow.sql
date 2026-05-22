alter table public.courses
  add column if not exists ai_text_status text not null default 'not_started',
  add column if not exists ai_media_status text not null default 'not_started',
  add column if not exists ai_publish_status text not null default 'not_ready',
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_generation_notes jsonb not null default '{}'::jsonb,
  add column if not exists text_approved_at timestamptz,
  add column if not exists text_approved_by uuid references auth.users(id),
  add column if not exists media_approved_at timestamptz,
  add column if not exists media_approved_by uuid references auth.users(id);

alter table public.lessons
  add column if not exists ai_text_status text not null default 'not_started',
  add column if not exists ai_media_status text not null default 'not_started',
  add column if not exists ai_publish_status text not null default 'not_ready',
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_generation_notes jsonb not null default '{}'::jsonb,
  add column if not exists text_approved_at timestamptz,
  add column if not exists text_approved_by uuid references auth.users(id),
  add column if not exists media_approved_at timestamptz,
  add column if not exists media_approved_by uuid references auth.users(id);

alter table public.quizzes
  add column if not exists ai_text_status text not null default 'not_started',
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_generation_notes jsonb not null default '{}'::jsonb,
  add column if not exists text_approved_at timestamptz,
  add column if not exists text_approved_by uuid references auth.users(id);

alter table public.courses
  drop constraint if exists courses_ai_text_status_check,
  drop constraint if exists courses_ai_media_status_check,
  drop constraint if exists courses_ai_publish_status_check;

alter table public.courses
  add constraint courses_ai_text_status_check
    check (ai_text_status in ('not_started', 'draft', 'in_review', 'changes_requested', 'approved')),
  add constraint courses_ai_media_status_check
    check (ai_media_status in ('not_started', 'generation_ready', 'draft', 'in_review', 'changes_requested', 'approved')),
  add constraint courses_ai_publish_status_check
    check (ai_publish_status in ('not_ready', 'ready', 'scheduled', 'published'));

alter table public.lessons
  drop constraint if exists lessons_ai_text_status_check,
  drop constraint if exists lessons_ai_media_status_check,
  drop constraint if exists lessons_ai_publish_status_check;

alter table public.lessons
  add constraint lessons_ai_text_status_check
    check (ai_text_status in ('not_started', 'draft', 'in_review', 'changes_requested', 'approved')),
  add constraint lessons_ai_media_status_check
    check (ai_media_status in ('not_started', 'generation_ready', 'draft', 'in_review', 'changes_requested', 'approved')),
  add constraint lessons_ai_publish_status_check
    check (ai_publish_status in ('not_ready', 'ready', 'scheduled', 'published'));

alter table public.quizzes
  drop constraint if exists quizzes_ai_text_status_check;

alter table public.quizzes
  add constraint quizzes_ai_text_status_check
    check (ai_text_status in ('not_started', 'draft', 'in_review', 'changes_requested', 'approved'));

create table if not exists public.learning_media_assets (
  id uuid primary key default gen_random_uuid(),
  course_id text references public.courses(id) on delete cascade,
  lesson_id text references public.lessons(id) on delete cascade,
  asset_type text not null,
  placement text not null,
  source text not null default 'ai_generated',
  prompt text,
  script text,
  url text,
  alt_text text,
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  review_status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_media_assets_asset_type_check
    check (asset_type in ('image', 'audio', 'video', 'infographic', 'thumbnail', 'cover')),
  constraint learning_media_assets_review_status_check
    check (review_status in ('draft', 'in_review', 'changes_requested', 'approved', 'rejected')),
  constraint learning_media_assets_parent_check
    check (course_id is not null or lesson_id is not null)
);

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  job_type text not null,
  status text not null default 'pending',
  prompt jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_generation_jobs_entity_type_check
    check (entity_type in ('course', 'lesson', 'quiz', 'media')),
  constraint ai_generation_jobs_job_type_check
    check (job_type in ('course_text', 'lesson_text', 'quiz_text', 'media_brief', 'media_assets')),
  constraint ai_generation_jobs_status_check
    check (status in ('pending', 'running', 'completed', 'failed'))
);

drop trigger if exists learning_media_assets_set_updated_at on public.learning_media_assets;
create trigger learning_media_assets_set_updated_at
  before update on public.learning_media_assets
  for each row execute function public.set_updated_at();

drop trigger if exists ai_generation_jobs_set_updated_at on public.ai_generation_jobs;
create trigger ai_generation_jobs_set_updated_at
  before update on public.ai_generation_jobs
  for each row execute function public.set_updated_at();

alter table public.learning_media_assets enable row level security;
alter table public.ai_generation_jobs enable row level security;

drop policy if exists "Admins can read all learning media assets" on public.learning_media_assets;
create policy "Admins can read all learning media assets"
  on public.learning_media_assets for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can insert learning media assets" on public.learning_media_assets;
create policy "Admins can insert learning media assets"
  on public.learning_media_assets for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update learning media assets" on public.learning_media_assets;
create policy "Admins can update learning media assets"
  on public.learning_media_assets for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can read all AI generation jobs" on public.ai_generation_jobs;
create policy "Admins can read all AI generation jobs"
  on public.ai_generation_jobs for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can insert AI generation jobs" on public.ai_generation_jobs;
create policy "Admins can insert AI generation jobs"
  on public.ai_generation_jobs for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update AI generation jobs" on public.ai_generation_jobs;
create policy "Admins can update AI generation jobs"
  on public.ai_generation_jobs for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can insert courses" on public.courses;
create policy "Admins can insert courses"
  on public.courses for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update courses" on public.courses;
create policy "Admins can update courses"
  on public.courses for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can delete courses" on public.courses;
create policy "Admins can delete courses"
  on public.courses for delete
  using (public.current_user_is_admin());

drop policy if exists "Admins can insert lessons" on public.lessons;
create policy "Admins can insert lessons"
  on public.lessons for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update lessons" on public.lessons;
create policy "Admins can update lessons"
  on public.lessons for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can insert lesson pages" on public.lesson_pages;
create policy "Admins can insert lesson pages"
  on public.lesson_pages for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update lesson pages" on public.lesson_pages;
create policy "Admins can update lesson pages"
  on public.lesson_pages for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can insert lesson blocks" on public.lesson_content_blocks;
create policy "Admins can insert lesson blocks"
  on public.lesson_content_blocks for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update lesson blocks" on public.lesson_content_blocks;
create policy "Admins can update lesson blocks"
  on public.lesson_content_blocks for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can insert quizzes" on public.quizzes;
create policy "Admins can insert quizzes"
  on public.quizzes for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update quizzes" on public.quizzes;
create policy "Admins can update quizzes"
  on public.quizzes for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can insert quiz questions" on public.quiz_questions;
create policy "Admins can insert quiz questions"
  on public.quiz_questions for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update quiz questions" on public.quiz_questions;
create policy "Admins can update quiz questions"
  on public.quiz_questions for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can insert quiz options" on public.quiz_options;
create policy "Admins can insert quiz options"
  on public.quiz_options for insert
  with check (public.current_user_is_admin());

drop policy if exists "Admins can update quiz options" on public.quiz_options;
create policy "Admins can update quiz options"
  on public.quiz_options for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can insert audit events" on public.audit_events;
create policy "Admins can insert audit events"
  on public.audit_events for insert
  with check (public.current_user_is_admin());

create or replace function public.admin_reset_ai_course_tree(
  p_course_id text,
  p_text_status text default 'draft'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_text_status not in ('draft', 'changes_requested') then
    raise exception 'Unsupported AI text reset status.';
  end if;

  update public.courses
  set ai_text_status = p_text_status,
      ai_media_status = 'not_started',
      ai_publish_status = 'not_ready',
      text_approved_at = null,
      text_approved_by = null,
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where id = p_course_id
    and ai_generated = true;

  update public.lessons
  set ai_text_status = p_text_status,
      ai_media_status = 'not_started',
      ai_publish_status = 'not_ready',
      text_approved_at = null,
      text_approved_by = null,
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where course_id = p_course_id
    and ai_generated = true;

  update public.quizzes q
  set ai_text_status = p_text_status,
      text_approved_at = null,
      text_approved_by = null,
      updated_at = now()
  from public.lessons l
  where q.lesson_id = l.id
    and l.course_id = p_course_id
    and q.ai_generated = true;
end;
$$;

create or replace function public.admin_reset_ai_course_media(
  p_course_id text,
  p_lesson_id text default null,
  p_media_status text default 'draft'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_media_status not in ('draft', 'changes_requested') then
    raise exception 'Unsupported AI media reset status.';
  end if;

  update public.courses
  set ai_media_status = p_media_status,
      ai_publish_status = 'not_ready',
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where id = p_course_id
    and ai_generated = true;

  if p_lesson_id is null then
    update public.lessons
    set ai_media_status = p_media_status,
        ai_publish_status = 'not_ready',
        media_approved_at = null,
        media_approved_by = null,
        updated_at = now()
    where course_id = p_course_id
      and ai_generated = true;
  else
    update public.lessons
    set ai_media_status = p_media_status,
        ai_publish_status = 'not_ready',
        media_approved_at = null,
        media_approved_by = null,
        updated_at = now()
    where id = p_lesson_id
      and course_id = p_course_id
      and ai_generated = true;
  end if;
end;
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
    if v_existing.ai_generated
      and v_requested_status = 'published'::public.content_status
      and coalesce(v_existing.ai_publish_status, 'not_ready') not in ('ready', 'published')
    then
      raise exception 'AI-generated courses can only be published after approved text and media.';
    end if;

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
      coalesce(v_description, ''),
      coalesce(v_category, 'Values Education'),
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
    if v_existing.ai_generated
      and v_requested_status = 'published'::public.content_status
      and coalesce(v_existing.ai_publish_status, 'not_ready') not in ('ready', 'published')
    then
      raise exception 'AI-generated lessons can only be published after approved text and media.';
    end if;

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

    insert into public.quizzes (id, lesson_id, title, status)
    values ('quiz-' || replace(v_lesson_id, 'lesson-', ''), v_lesson_id, v_title || ' Quiz', 'draft')
    on conflict (lesson_id) do nothing;
  end if;

  if v_should_reset_text then
    perform public.admin_reset_ai_course_tree(p_course_id, 'draft');
  elsif v_should_reset_media then
    perform public.admin_reset_ai_course_media(p_course_id, v_lesson_id, 'draft');
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
  v_course_id text;
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

  select course_id into v_course_id
  from public.lessons
  where id = p_lesson_id;

  if exists(
    select 1
    from public.lessons l
    where l.id = p_lesson_id
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
  v_lesson_id text;
  v_course_id text;
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

create or replace function public.admin_update_quiz(
  p_quiz_id text,
  p_title text,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_quiz public.quizzes%rowtype;
  v_course_id text;
  v_requested_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage quizzes.';
  end if;

  if v_title = '' then
    raise exception 'Quiz title is required.';
  end if;

  select *
    into v_quiz
  from public.quizzes
  where id = p_quiz_id;

  if not found then
    raise exception 'Quiz not found.';
  end if;

  select course_id
    into v_course_id
  from public.lessons
  where id = v_quiz.lesson_id;

  if v_quiz.ai_generated
    and v_requested_status = 'published'::public.content_status
    and exists(
      select 1
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = v_quiz.lesson_id
        and (
          (l.ai_generated and (l.ai_text_status <> 'approved' or l.ai_media_status <> 'approved' or l.ai_publish_status not in ('ready', 'published')))
          or (c.ai_generated and (c.ai_text_status <> 'approved' or c.ai_media_status <> 'approved' or c.ai_publish_status not in ('ready', 'published')))
        )
    )
  then
    raise exception 'AI-generated quizzes can only be published after course text and media approval.';
  end if;

  update public.quizzes
  set title = v_title,
      status = v_requested_status,
      updated_at = now()
  where id = p_quiz_id;

  if v_quiz.ai_generated
    and v_quiz.ai_text_status = 'approved'
    and v_quiz.title is distinct from v_title
  then
    perform public.admin_reset_ai_course_tree(v_course_id, 'draft');
  end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'quiz_updated',
    'quiz',
    p_quiz_id,
    jsonb_build_object('title', v_title, 'status', p_status)
  );

  return jsonb_build_object('quizId', p_quiz_id, 'status', 'updated');
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
  v_lesson_id text;
  v_course_id text;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage quiz questions.';
  end if;

  select q.lesson_id, l.course_id
    into v_lesson_id, v_course_id
  from public.quizzes q
  join public.lessons l on l.id = q.lesson_id
  where q.id = p_quiz_id;

  if v_lesson_id is null then
    raise exception 'Quiz not found.';
  end if;

  if v_prompt = '' then
    raise exception 'Question prompt is required.';
  end if;

  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) < 2 then
    raise exception 'At least two options are required.';
  end if;

  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) > 4 then
    raise exception 'A maximum of four options is supported.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) option_item
    where coalesce((option_item ->> 'isCorrect')::boolean, false)
  ) then
    raise exception 'At least one correct answer is required.';
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
    least(20, greatest(1, coalesce(p_xp, 1)))
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

  if exists(
    select 1
    from public.quizzes q
    where q.id = p_quiz_id
      and q.ai_generated = true
      and q.ai_text_status = 'approved'
  ) or exists(
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

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_exists then 'quiz_question_updated' else 'quiz_question_created' end,
    'quiz_question',
    v_question_id,
    jsonb_build_object('quizId', p_quiz_id, 'xp', least(20, greatest(1, coalesce(p_xp, 1))))
  );

  return jsonb_build_object('questionId', v_question_id, 'status', case when v_exists then 'updated' else 'created' end);
end;
$$;

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
  v_course public.courses%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage course visibility.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Courses can only be enabled or disabled from this control.';
  end if;

  select * into v_course
  from public.courses
  where id = p_course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  if v_course.ai_generated
    and v_status = 'published'::public.content_status
    and coalesce(v_course.ai_publish_status, 'not_ready') not in ('ready', 'published')
  then
    raise exception 'AI-generated courses can only be published after approved text and media.';
  end if;

  update public.courses
  set status = v_status,
      updated_at = now()
  where id = p_course_id;

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
  v_lesson public.lessons%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage lesson visibility.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Lessons can only be enabled or disabled from this control.';
  end if;

  select * into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if not found then
    raise exception 'Lesson not found.';
  end if;

  if v_lesson.ai_generated
    and v_status = 'published'::public.content_status
    and (
      coalesce(v_lesson.ai_publish_status, 'not_ready') not in ('ready', 'published')
      or exists(
        select 1
        from public.courses c
        where c.id = v_lesson.course_id
          and c.ai_generated = true
          and c.ai_publish_status not in ('ready', 'published')
      )
    )
  then
    raise exception 'AI-generated lessons can only be published after approved text and media.';
  end if;

  update public.lessons
  set status = v_status,
      updated_at = now()
  where id = p_lesson_id;

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

grant execute on function public.admin_reset_ai_course_tree(text, text) to authenticated;
grant execute on function public.admin_reset_ai_course_media(text, text, text) to authenticated;
grant execute on function public.admin_upsert_course(text, text, text, text, public.course_level, public.content_status, jsonb, integer, integer) to authenticated;
grant execute on function public.admin_upsert_lesson(text, text, text, text, jsonb, public.content_status, integer, integer, public.lesson_retry_mode, integer, boolean, boolean, integer) to authenticated;
grant execute on function public.admin_upsert_lesson_page(text, text, text, text, public.lesson_page_type, integer, jsonb) to authenticated;
grant execute on function public.admin_upsert_lesson_block(uuid, text, public.lesson_content_block_type, integer, jsonb) to authenticated;
grant execute on function public.admin_update_quiz(text, text, public.content_status) to authenticated;
grant execute on function public.admin_upsert_quiz_question(text, text, text, public.quiz_question_type, text, integer, integer, jsonb) to authenticated;
grant execute on function public.admin_set_course_status(text, public.content_status) to authenticated;
grant execute on function public.admin_set_lesson_status(text, public.content_status) to authenticated;
