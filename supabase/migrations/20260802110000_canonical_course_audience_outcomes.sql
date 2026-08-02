alter table public.courses
  add column if not exists intended_audience text not null default '',
  add column if not exists learning_outcomes text[] not null default '{}'::text[];

alter function public.admin_duplicate_course_template(text, text) set schema private;
alter function private.admin_duplicate_course_template(text, text) rename to admin_duplicate_course_template_base_v20260802;

revoke execute on function private.admin_duplicate_course_template_base_v20260802(text, text) from public, anon, authenticated, service_role;

drop function if exists public.admin_upsert_course(
  text,
  text,
  text,
  text,
  public.course_level,
  public.content_status,
  jsonb,
  integer,
  integer
);

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
  v_result jsonb;
  v_new_course_id text;
  v_source public.courses%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can duplicate course templates.';
  end if;

  select *
  into v_source
  from public.courses
  where id = p_source_course_id;

  if not found then
    raise exception 'Source course not found.';
  end if;

  v_result := private.admin_duplicate_course_template_base_v20260802(p_source_course_id, p_title);
  v_new_course_id := v_result ->> 'courseId';

  update public.courses
  set intended_audience = coalesce(v_source.intended_audience, ''),
      learning_outcomes = coalesce(v_source.learning_outcomes, '{}'::text[]),
      updated_at = now()
  where id = v_new_course_id;

  return v_result;
end;
$$;

revoke execute on function public.admin_upsert_course(text, text, text, text, text[], text, public.course_level, public.content_status, jsonb, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_upsert_course(text, text, text, text, text[], text, public.course_level, public.content_status, jsonb, integer, integer) to authenticated;

revoke execute on function public.admin_duplicate_course_template(text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_duplicate_course_template(text, text) to authenticated, service_role;

delete from private.rpc_security_classifications
where function_schema = 'public'
  and function_name = 'admin_upsert_course';

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
    'admin_upsert_course',
    'p_course_id text, p_title text, p_description text, p_intended_audience text, p_learning_outcomes text[], p_category text, p_level course_level, p_status content_status, p_thumbnail jsonb, p_sort_order integer, p_estimated_minutes integer',
    'ADMIN_AUTHENTICATED',
    'CMS course authoring form.',
    'Requires auth.uid() and public.current_user_is_admin() before inserting or updating canonical course metadata.',
    array['authenticated']
  ),
  (
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
