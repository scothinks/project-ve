create or replace function public.admin_update_organization_profile(
  p_organization_id uuid,
  p_short_name text,
  p_description text,
  p_logo_url text,
  p_accent_token public.organization_accent_token,
  p_support_email text,
  p_support_phone text,
  p_verification_status public.organization_verification_status,
  p_lifecycle_status public.organization_lifecycle_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_short_name text := nullif(trim(coalesce(p_short_name, '')), '');
  v_description text := trim(coalesce(p_description, ''));
  v_logo_url text := nullif(trim(coalesce(p_logo_url, '')), '');
  v_support_email text := nullif(lower(trim(coalesce(p_support_email, ''))), '');
  v_support_phone text := nullif(trim(coalesce(p_support_phone, '')), '');
  v_is_platform_admin boolean := public.current_user_is_admin();
  v_existing public.organizations%rowtype;
begin
  if v_actor_id is null or not public.current_user_can_manage_organization(p_organization_id) then
    raise exception 'Organization manager access required.';
  end if;

  select * into v_existing
  from public.organizations
  where id = p_organization_id;

  if not found then
    raise exception 'Organization does not exist.';
  end if;

  if v_short_name is not null and length(v_short_name) > 80 then
    raise exception 'Organization short name must be at most 80 characters.';
  end if;

  if length(v_description) > 2000 then
    raise exception 'Organization description must be at most 2000 characters.';
  end if;

  if v_logo_url is not null and (length(v_logo_url) > 1000 or v_logo_url !~* '^https?://[^[:space:]<>]+$') then
    raise exception 'Organization logo URL must be a valid HTTP or HTTPS URL.';
  end if;

  if v_support_email is not null and (length(v_support_email) > 254 or v_support_email !~* '^[^@[:space:]<>]+@[^@[:space:]<>]+\.[^@[:space:]<>]+$') then
    raise exception 'Organization support email is invalid.';
  end if;

  if v_support_phone is not null and (length(v_support_phone) > 40 or v_support_phone !~ '^[0-9+(). -]{5,40}$') then
    raise exception 'Organization support phone is invalid.';
  end if;

  update public.organizations
  set short_name = v_short_name,
      description = v_description,
      logo_url = v_logo_url,
      accent_token = coalesce(p_accent_token, v_existing.accent_token),
      support_email = v_support_email,
      support_phone = v_support_phone,
      verification_status = case
        when v_is_platform_admin then coalesce(p_verification_status, v_existing.verification_status)
        else v_existing.verification_status
      end,
      lifecycle_status = case
        when v_is_platform_admin then coalesce(p_lifecycle_status, v_existing.lifecycle_status)
        else v_existing.lifecycle_status
      end,
      updated_at = now()
  where id = p_organization_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_profile_updated',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'verificationStatus', case when v_is_platform_admin then coalesce(p_verification_status, v_existing.verification_status) else v_existing.verification_status end,
      'lifecycleStatus', case when v_is_platform_admin then coalesce(p_lifecycle_status, v_existing.lifecycle_status) else v_existing.lifecycle_status end,
      'accentToken', coalesce(p_accent_token, v_existing.accent_token)
    )
  );

  return jsonb_build_object('organizationId', p_organization_id, 'status', 'updated');
end;
$$;

create or replace function public.admin_upsert_organization_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role_key,
  p_status public.organization_membership_status default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_membership_id uuid;
begin
  if v_actor_id is null or not public.current_user_can_manage_organization(p_organization_id) then
    raise exception 'Organization manager access required.';
  end if;

  if p_organization_id is null or p_user_id is null or p_role is null then
    raise exception 'Organization, user and role are required.';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    p_organization_id,
    p_user_id,
    p_role,
    coalesce(p_status, 'active'::public.organization_membership_status),
    v_actor_id
  )
  on conflict (organization_id, user_id, role) do update
    set status = excluded.status,
        invited_by = excluded.invited_by,
        updated_at = now()
  returning id into v_membership_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'organization_membership_upserted',
    'organization_membership',
    v_membership_id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'userId', p_user_id,
      'role', p_role,
      'status', coalesce(p_status, 'active'::public.organization_membership_status)
    )
  );

  return jsonb_build_object('membershipId', v_membership_id, 'status', 'upserted');
end;
$$;

create or replace function public.admin_upsert_course(
  p_course_id text,
  p_title text,
  p_description text,
  p_intended_audience text,
  p_learning_outcomes text[],
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
  v_learning_outcomes text[] := array(
    select outcome
    from unnest(coalesce(p_learning_outcomes, '{}'::text[])) as outcome
    where trim(outcome) <> ''
  );
begin
  if v_actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if v_title = '' then
    raise exception 'Course title is required.';
  end if;

  select exists(select 1 from public.courses where id = v_course_id) into v_exists;

  if v_exists then
    if not public.current_user_can_edit_course(v_course_id) then
      raise exception 'Course editor access required.';
    end if;

    update public.courses
    set title = v_title,
        description = nullif(trim(coalesce(p_description, '')), ''),
        intended_audience = trim(coalesce(p_intended_audience, '')),
        learning_outcomes = v_learning_outcomes,
        category = nullif(trim(coalesce(p_category, '')), ''),
        level = coalesce(p_level, 'beginner'::public.course_level),
        status = coalesce(p_status, 'draft'::public.content_status),
        thumbnail = coalesce(p_thumbnail, '{}'::jsonb),
        sort_order = coalesce(p_sort_order, 0),
        estimated_minutes = greatest(0, coalesce(p_estimated_minutes, 0)),
        updated_at = now()
    where id = v_course_id;
  else
    if not public.current_user_is_admin() then
      raise exception 'Only a platform admin can create platform courses.';
    end if;

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
      intended_audience,
      learning_outcomes,
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
      trim(coalesce(p_intended_audience, '')),
      v_learning_outcomes,
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
  if v_actor_id is null or not public.current_user_can_edit_course(p_course_id) then
    raise exception 'Course editor access required.';
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
begin
  if v_actor_id is null or not public.current_user_can_edit_course(p_course_id) then
    raise exception 'Course editor access required.';
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
    if v_existing.course_id <> p_course_id and not public.current_user_can_edit_course(v_existing.course_id) then
      raise exception 'Original course editor access required.';
    end if;

    if v_existing.ai_generated
      and v_requested_status = 'published'::public.content_status
      and coalesce(v_existing.ai_publish_status, 'not_ready') not in ('ready', 'published')
    then
      raise exception 'AI-generated lessons can only be published after approved text and media.';
    end if;

    update public.lessons
    set course_id = p_course_id,
        title = v_title,
        description = nullif(trim(coalesce(p_description, '')), ''),
        cover_image = coalesce(p_cover_image, '{}'::jsonb),
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
      nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_cover_image, '{}'::jsonb),
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
  v_page_id text := lower(regexp_replace(trim(coalesce(p_page_id, '')), '[^a-zA-Z0-9_-]+', '-', 'g'));
  v_title text := trim(coalesce(p_title, ''));
  v_exists boolean := false;
  v_counter integer := 1;
  v_course_id text;
  v_existing_lesson_id text;
begin
  select course_id into v_course_id
  from public.lessons
  where id = p_lesson_id;

  if v_actor_id is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Lesson content editor access required.';
  end if;

  if v_title = '' then
    raise exception 'Page title is required.';
  end if;

  if v_page_id = '' then
    v_page_id := public.admin_slugify(v_title);
    if v_page_id = '' then
      v_page_id := 'page';
    end if;
    v_page_id := 'page-' || left(v_page_id, 90);
  end if;

  select lesson_id into v_existing_lesson_id
  from public.lesson_pages
  where id = v_page_id;
  v_exists := found;

  if v_exists and v_existing_lesson_id <> p_lesson_id then
    raise exception 'Lesson pages cannot be moved between lessons.';
  end if;

  if not v_exists then
    while exists(select 1 from public.lesson_pages where id = v_page_id) loop
      v_counter := v_counter + 1;
      v_page_id := left(v_page_id, 96) || '-' || v_counter::text;
    end loop;
  end if;

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
  v_lesson_id text;
  v_course_id text;
  v_existing_page_id text;
  v_existing_sort_order integer;
  v_resolved_sort_order integer := coalesce(p_sort_order, 0);
begin
  select p.lesson_id, l.course_id
    into v_lesson_id, v_course_id
  from public.lesson_pages p
  join public.lessons l on l.id = p.lesson_id
  where p.id = p_page_id;

  if v_actor_id is null or v_lesson_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Lesson content editor access required.';
  end if;

  select page_id, sort_order
    into v_existing_page_id, v_existing_sort_order
  from public.lesson_content_blocks
  where id = v_block_id;

  v_exists := found;

  if v_exists then
    if v_existing_page_id = p_page_id then
      v_resolved_sort_order := v_existing_sort_order;
    else
      if not exists (
        select 1
        from public.lesson_pages old_page
        join public.lessons old_lesson on old_lesson.id = old_page.lesson_id
        where old_page.id = v_existing_page_id
          and public.current_user_can_edit_course(old_lesson.course_id)
      ) then
        raise exception 'Original lesson content editor access required.';
      end if;

      select coalesce(max(sort_order), 0) + 1
        into v_resolved_sort_order
      from public.lesson_content_blocks
      where page_id = p_page_id;
    end if;
  elsif exists(
    select 1
    from public.lesson_content_blocks
    where page_id = p_page_id
      and sort_order = v_resolved_sort_order
  ) then
    select coalesce(max(sort_order), 0) + 1
      into v_resolved_sort_order
    from public.lesson_content_blocks
    where page_id = p_page_id;
  end if;

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
    v_resolved_sort_order,
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
  v_course_id text;
  v_deleted_count integer := 0;
  v_remaining_count integer := 0;
begin
  select lesson.course_id
    into v_course_id
  from public.lesson_pages page
  join public.lessons lesson on lesson.id = page.lesson_id
  where page.id = p_page_id;

  if v_actor_id is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Lesson content editor access required.';
  end if;

  delete from public.lesson_content_blocks
  where id = p_block_id
    and page_id = p_page_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'Lesson block not found.';
  end if;

  with ordered as (
    select id, row_number() over (order by sort_order, id) as next_order
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

  return jsonb_build_object('blockId', p_block_id, 'pageId', p_page_id, 'remainingBlocks', v_remaining_count, 'status', 'deleted');
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
  if v_actor_id is null or not public.current_user_can_edit_course(p_course_id) then
    raise exception 'Course editor access required.';
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
  select * into v_lesson
  from public.lessons
  where id = p_lesson_id;

  if v_actor_id is null or not found or not public.current_user_can_edit_course(v_lesson.course_id) then
    raise exception 'Lesson editor access required.';
  end if;

  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Lessons can only be enabled or disabled from this control.';
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
  if v_actor_id is null or not public.current_user_can_edit_course(p_course_id) then
    raise exception 'Course editor access required.';
  end if;

  select count(*) into v_expected_count
  from public.lessons
  where course_id = p_course_id;

  if v_expected_count is null then
    raise exception 'Course not found.';
  end if;

  select count(distinct lesson_id)
    into v_requested_count
  from unnest(coalesce(p_lesson_ids, '{}'::text[])) as lesson_id;

  if v_expected_count <> v_requested_count then
    raise exception 'Lesson order must include every lesson in the course exactly once.';
  end if;

  if exists(
    select 1
    from unnest(p_lesson_ids) as requested(lesson_id)
    left join public.lessons l on l.id = requested.lesson_id and l.course_id = p_course_id
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
  values (v_actor_id, 'course_lessons_reordered', 'course', p_course_id, jsonb_build_object('lessonIds', p_lesson_ids));

  return jsonb_build_object('courseId', p_course_id, 'lessonCount', v_expected_count);
end;
$$;

create or replace function public.admin_reorder_lesson_page(
  p_lesson_id text,
  p_page_id text,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_course_id text;
  v_current record;
  v_target record;
  v_temp_number integer;
begin
  select course_id into v_course_id
  from public.lessons
  where id = p_lesson_id;

  if v_actor_id is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Lesson content editor access required.';
  end if;

  select id, page_number
  into v_current
  from public.lesson_pages
  where id = p_page_id and lesson_id = p_lesson_id;

  if v_current.id is null then
    raise exception 'Lesson page not found.';
  end if;

  if p_direction = 'up' then
    select id, page_number
    into v_target
    from public.lesson_pages
    where lesson_id = p_lesson_id and page_number < v_current.page_number
    order by page_number desc
    limit 1;
  else
    select id, page_number
    into v_target
    from public.lesson_pages
    where lesson_id = p_lesson_id and page_number > v_current.page_number
    order by page_number asc
    limit 1;
  end if;

  if v_target.id is null then
    return jsonb_build_object('status', 'unchanged', 'pageId', p_page_id);
  end if;

  v_temp_number := 1000000 + v_current.page_number;

  update public.lesson_pages
  set page_number = v_temp_number,
      updated_at = now()
  where id = v_current.id;

  update public.lesson_pages
  set page_number = v_current.page_number,
      updated_at = now()
  where id = v_target.id;

  update public.lesson_pages
  set page_number = v_target.page_number,
      updated_at = now()
  where id = v_current.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'lesson_page_reordered',
    'lesson_page',
    p_page_id,
    jsonb_build_object('lessonId', p_lesson_id, 'direction', p_direction)
  );

  return jsonb_build_object('status', 'updated', 'pageId', p_page_id);
end;
$$;

create or replace function public.admin_reorder_lesson_block(
  p_page_id text,
  p_block_id uuid,
  p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_course_id text;
  v_current record;
  v_target record;
  v_temp_order integer;
begin
  select lesson.course_id
    into v_course_id
  from public.lesson_pages page
  join public.lessons lesson on lesson.id = page.lesson_id
  where page.id = p_page_id;

  if v_actor_id is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Lesson content editor access required.';
  end if;

  select id, sort_order
  into v_current
  from public.lesson_content_blocks
  where id = p_block_id and page_id = p_page_id;

  if v_current.id is null then
    raise exception 'Lesson block not found.';
  end if;

  if p_direction = 'up' then
    select id, sort_order
    into v_target
    from public.lesson_content_blocks
    where page_id = p_page_id and sort_order < v_current.sort_order
    order by sort_order desc
    limit 1;
  else
    select id, sort_order
    into v_target
    from public.lesson_content_blocks
    where page_id = p_page_id and sort_order > v_current.sort_order
    order by sort_order asc
    limit 1;
  end if;

  if v_target.id is null then
    return jsonb_build_object('status', 'unchanged', 'blockId', p_block_id);
  end if;

  v_temp_order := 1000000 + v_current.sort_order;

  update public.lesson_content_blocks
  set sort_order = v_temp_order,
      updated_at = now()
  where id = v_current.id;

  update public.lesson_content_blocks
  set sort_order = v_current.sort_order,
      updated_at = now()
  where id = v_target.id;

  update public.lesson_content_blocks
  set sort_order = v_target.sort_order,
      updated_at = now()
  where id = v_current.id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'lesson_block_reordered',
    'lesson_content_block',
    p_block_id::text,
    jsonb_build_object('pageId', p_page_id, 'direction', p_direction)
  );

  return jsonb_build_object('status', 'updated', 'blockId', p_block_id);
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
  select *
    into v_quiz
  from public.quizzes
  where id = p_quiz_id;

  select course_id
    into v_course_id
  from public.lessons
  where id = v_quiz.lesson_id;

  if v_actor_id is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Quiz editor access required.';
  end if;

  if v_title = '' then
    raise exception 'Quiz title is required.';
  end if;

  update public.quizzes
  set title = v_title,
      status = v_requested_status,
      updated_at = now()
  where id = p_quiz_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'quiz_updated', 'quiz', p_quiz_id, jsonb_build_object('title', v_title, 'status', p_status));

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
  v_existing_quiz_id text;
begin
  select q.lesson_id, l.course_id
    into v_lesson_id, v_course_id
  from public.quizzes q
  join public.lessons l on l.id = q.lesson_id
  where q.id = p_quiz_id;

  if v_actor_id is null or v_lesson_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Quiz editor access required.';
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

  select quiz_id into v_existing_quiz_id
  from public.quiz_questions
  where id = v_question_id;
  v_exists := found;

  if v_exists and v_existing_quiz_id <> p_quiz_id then
    raise exception 'Quiz questions cannot be moved between quizzes.';
  end if;

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

create or replace function public.admin_reorder_quiz_questions(
  p_quiz_id text,
  p_question_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_course_id text;
  v_expected_count integer;
  v_offset integer;
  v_requested_count integer;
begin
  select lesson.course_id
    into v_course_id
  from public.quizzes quiz
  join public.lessons lesson on lesson.id = quiz.lesson_id
  where quiz.id = p_quiz_id;

  if v_actor_id is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Quiz editor access required.';
  end if;

  select count(*), coalesce(max(question_order), 0) + count(*) + 1000
    into v_expected_count, v_offset
  from public.quiz_questions
  where quiz_id = p_quiz_id;

  select count(distinct question_id)
    into v_requested_count
  from unnest(coalesce(p_question_ids, '{}'::text[])) as question_id;

  if v_expected_count <> v_requested_count then
    raise exception 'Question order must include every question exactly once.';
  end if;

  if exists(
    select 1
    from unnest(p_question_ids) as requested(question_id)
    left join public.quiz_questions qq on qq.id = requested.question_id and qq.quiz_id = p_quiz_id
    where qq.id is null
  ) then
    raise exception 'Question order includes a question outside this quiz.';
  end if;

  with ordered as (
    select question_id, row_number() over () as next_order
    from unnest(p_question_ids) as question_id
  )
  update public.quiz_questions qq
  set question_order = v_offset + ordered.next_order,
      updated_at = now()
  from ordered
  where qq.id = ordered.question_id
    and qq.quiz_id = p_quiz_id;

  with ordered as (
    select question_id, row_number() over () as next_order
    from unnest(p_question_ids) as question_id
  )
  update public.quiz_questions qq
  set question_order = ordered.next_order,
      updated_at = now()
  from ordered
  where qq.id = ordered.question_id
    and qq.quiz_id = p_quiz_id;

  update public.quizzes
  set version = version + 1,
      updated_at = now()
  where id = p_quiz_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'quiz_questions_reordered', 'quiz', p_quiz_id, jsonb_build_object('questionIds', p_question_ids));

  return jsonb_build_object('quizId', p_quiz_id, 'questionCount', v_expected_count);
end;
$$;

create or replace function public.admin_delete_quiz_question(
  p_quiz_id text,
  p_question_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_course_id text;
  v_order integer;
begin
  select lesson.course_id
    into v_course_id
  from public.quizzes quiz
  join public.lessons lesson on lesson.id = quiz.lesson_id
  where quiz.id = p_quiz_id;

  if v_actor_id is null or v_course_id is null or not public.current_user_can_edit_course(v_course_id) then
    raise exception 'Quiz editor access required.';
  end if;

  select question_order
    into v_order
  from public.quiz_questions
  where id = p_question_id
    and quiz_id = p_quiz_id;

  if v_order is null then
    raise exception 'Question not found.';
  end if;

  if exists(select 1 from public.quiz_attempt_questions where question_id = p_question_id)
    or exists(select 1 from public.quiz_answers where question_id = p_question_id)
  then
    raise exception 'This question has learner attempt history and cannot be deleted safely.';
  end if;

  delete from public.quiz_questions
  where id = p_question_id
    and quiz_id = p_quiz_id;

  update public.quiz_questions
  set question_order = question_order - 1,
      updated_at = now()
  where quiz_id = p_quiz_id
    and question_order > v_order;

  update public.quizzes
  set version = version + 1,
      updated_at = now()
  where id = p_quiz_id;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (v_actor_id, 'quiz_question_deleted', 'quiz_question', p_question_id, jsonb_build_object('quizId', p_quiz_id));

  return jsonb_build_object('quizId', p_quiz_id, 'questionId', p_question_id, 'status', 'deleted');
end;
$$;

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
    'admin_update_organization_profile',
    'p_organization_id uuid, p_short_name text, p_description text, p_logo_url text, p_accent_token organization_accent_token, p_support_email text, p_support_phone text, p_verification_status organization_verification_status, p_lifecycle_status organization_lifecycle_status',
    'ADMIN_AUTHENTICATED',
    'Platform admins and selected organisation owner/admin workspaces updating organisation identity.',
    'Requires auth.uid() and public.current_user_can_manage_organization(p_organization_id); only platform admins may change verification or lifecycle status.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_organization_membership',
    'p_organization_id uuid, p_user_id uuid, p_role organization_role_key, p_status organization_membership_status',
    'ADMIN_AUTHENTICATED',
    'Platform admins and selected organisation owner/admin workspaces managing organisation memberships.',
    'Requires auth.uid() and public.current_user_can_manage_organization(p_organization_id).',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_course',
    'p_course_id text, p_title text, p_description text, p_intended_audience text, p_learning_outcomes text[], p_category text, p_level course_level, p_status content_status, p_thumbnail jsonb, p_sort_order integer, p_estimated_minutes integer',
    'ADMIN_AUTHENTICATED',
    'CMS course authoring form for platform and organization-owned courses.',
    'Updates require public.current_user_can_edit_course(p_course_id); new platform courses still require public.current_user_is_admin(). Organization-private creation uses admin_create_organization_private_course.',
    array['authenticated']
  ),
  (
    'public',
    'admin_sync_course_estimated_minutes',
    'p_course_id text',
    'ADMIN_AUTHENTICATED',
    'CMS course lesson-minute recalculation.',
    'Requires auth.uid() and public.current_user_can_edit_course(p_course_id).',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_lesson',
    'p_lesson_id text, p_course_id text, p_title text, p_description text, p_cover_image jsonb, p_status content_status, p_sort_order integer, p_estimated_minutes integer, p_retry_mode lesson_retry_mode, p_retry_cooldown_seconds integer, p_retry_requires_reread boolean, p_quiz_requires_lesson_completion boolean, p_max_earning_attempts integer',
    'ADMIN_AUTHENTICATED',
    'CMS lesson authoring form for platform and organization-owned courses.',
    'Requires auth.uid() and public.current_user_can_edit_course(p_course_id), plus original-course edit rights when moving an existing lesson.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_lesson_page',
    'p_page_id text, p_lesson_id text, p_title text, p_subtitle text, p_page_type lesson_page_type, p_page_number integer, p_cover_image jsonb',
    'ADMIN_AUTHENTICATED',
    'CMS lesson page authoring.',
    'Resolves the trusted lesson course and requires public.current_user_can_edit_course(course_id).',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_lesson_block',
    'p_block_id uuid, p_page_id text, p_block_type lesson_content_block_type, p_sort_order integer, p_payload jsonb',
    'ADMIN_AUTHENTICATED',
    'CMS lesson block authoring.',
    'Resolves the trusted page -> lesson -> course path and requires public.current_user_can_edit_course(course_id).',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_delete_lesson_block',
    'p_page_id text, p_block_id uuid',
    'ADMIN_AUTHENTICATED',
    'CMS lesson block deletion.',
    'Resolves the trusted page -> lesson -> course path and requires public.current_user_can_edit_course(course_id).',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_reorder_course_lessons',
    'p_course_id text, p_lesson_ids text[]',
    'ADMIN_AUTHENTICATED',
    'CMS lesson ordering.',
    'Requires auth.uid() and public.current_user_can_edit_course(p_course_id), then validates every requested lesson belongs to the course.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_quiz',
    'p_quiz_id text, p_title text, p_status content_status',
    'ADMIN_AUTHENTICATED',
    'CMS quiz settings authoring.',
    'Resolves the trusted quiz -> lesson -> course path and requires public.current_user_can_edit_course(course_id).',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_upsert_quiz_question',
    'p_question_id text, p_quiz_id text, p_prompt text, p_question_type quiz_question_type, p_explanation text, p_xp integer, p_question_order integer, p_options jsonb',
    'ADMIN_AUTHENTICATED',
    'CMS quiz question authoring.',
    'Resolves the trusted quiz -> lesson -> course path and requires public.current_user_can_edit_course(course_id).',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
  set classification = excluded.classification,
      intended_callers = excluded.intended_callers,
      authorization_rule = excluded.authorization_rule,
      execute_roles = excluded.execute_roles,
      reviewed_at = now();
