drop policy if exists "Users can write their lesson progress" on public.lesson_progress;
drop policy if exists "Users can update their lesson progress" on public.lesson_progress;
drop policy if exists "Users can write their page completions" on public.lesson_page_completions;
drop policy if exists "Users can update their page completions" on public.lesson_page_completions;

revoke insert, update on public.lesson_progress from anon, authenticated;
revoke insert, update on public.lesson_page_completions from anon, authenticated;

create or replace function public.complete_lesson_page(
  p_lesson_id text,
  p_page_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_page_exists boolean := false;
  v_completed_pages text[] := '{}';
  v_total_pages integer := 0;
  v_completed_count integer := 0;
  v_is_lesson_complete boolean := false;
  v_existing_quiz_score integer;
  v_started_at timestamptz;
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_lesson_id, '')), '') is null then
    raise exception 'lessonId is required.' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_page_id, '')), '') is null then
    raise exception 'pageId is required.' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.lesson_pages lp
    join public.lessons l
      on l.id = lp.lesson_id
    join public.courses c
      on c.id = l.course_id
    where lp.id = p_page_id
      and lp.lesson_id = p_lesson_id
      and l.status = 'published'
      and c.status = 'published'
  )
    into v_page_exists;

  if not v_page_exists then
    raise exception 'Page not found for lesson.' using errcode = 'P0002';
  end if;

  insert into public.lesson_page_completions (
    user_id,
    lesson_id,
    page_id,
    completed_at
  )
  values (
    v_user_id,
    p_lesson_id,
    p_page_id,
    v_now
  )
  on conflict (user_id, lesson_id, page_id) do nothing;

  insert into public.lesson_progress (
    user_id,
    lesson_id,
    completed_pages,
    completed_modules,
    quiz_score,
    started_at,
    completed_at,
    updated_at
  )
  values (
    v_user_id,
    p_lesson_id,
    '{}',
    '{}',
    null,
    v_now,
    null,
    v_now
  )
  on conflict (user_id, lesson_id) do nothing;

  select quiz_score, started_at, completed_at
    into v_existing_quiz_score, v_started_at, v_completed_at
  from public.lesson_progress
  where user_id = v_user_id
    and lesson_id = p_lesson_id
  for update;

  select coalesce(array_agg(lp.id order by lp.page_number), '{}')::text[]
    into v_completed_pages
  from public.lesson_pages lp
  join public.lesson_page_completions lpc
    on lpc.page_id = lp.id
   and lpc.lesson_id = lp.lesson_id
   and lpc.user_id = v_user_id
  where lp.lesson_id = p_lesson_id;

  select count(*)::integer
    into v_total_pages
  from public.lesson_pages
  where lesson_id = p_lesson_id;

  v_completed_count := coalesce(array_length(v_completed_pages, 1), 0);
  v_is_lesson_complete := v_total_pages > 0 and v_completed_count >= v_total_pages;

  update public.lesson_progress
  set completed_pages = v_completed_pages,
      completed_modules = v_completed_pages,
      quiz_score = v_existing_quiz_score,
      started_at = coalesce(v_started_at, v_now),
      completed_at = case
        when v_is_lesson_complete then coalesce(v_completed_at, v_now)
        else null
      end,
      updated_at = v_now
  where user_id = v_user_id
    and lesson_id = p_lesson_id;

  return jsonb_build_object(
    'lessonId', p_lesson_id,
    'pageId', p_page_id,
    'completedPages', v_completed_pages,
    'completedPageCount', v_completed_count,
    'totalPageCount', v_total_pages,
    'lessonCompleted', v_is_lesson_complete
  );
end;
$$;

revoke execute on function public.complete_lesson_page(text, text) from public, anon;
grant execute on function public.complete_lesson_page(text, text) to authenticated;

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
  'complete_lesson_page',
  'p_lesson_id text, p_page_id text',
  'PUBLIC_AUTHENTICATED_SELF',
  'Authenticated learners completing a page in a published lesson.',
  'Uses auth.uid() as the only user identity source, validates that the page belongs to a published lesson/course, records the canonical page completion, and refreshes the retained lesson_progress summary transactionally.',
  array['authenticated']
)
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
