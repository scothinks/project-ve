drop policy if exists "Admins can read all courses" on public.courses;
create policy "Admins can read all courses"
  on public.courses for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all lessons" on public.lessons;
create policy "Admins can read all lessons"
  on public.lessons for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all lesson pages" on public.lesson_pages;
create policy "Admins can read all lesson pages"
  on public.lesson_pages for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all lesson blocks" on public.lesson_content_blocks;
create policy "Admins can read all lesson blocks"
  on public.lesson_content_blocks for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all quizzes" on public.quizzes;
create policy "Admins can read all quizzes"
  on public.quizzes for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all quiz questions" on public.quiz_questions;
create policy "Admins can read all quiz questions"
  on public.quiz_questions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read all quiz options" on public.quiz_options;
create policy "Admins can read all quiz options"
  on public.quiz_options for select
  using (public.current_user_is_admin());

drop policy if exists "Published quiz questions are readable" on public.quiz_questions;
create policy "Published quiz questions are readable"
  on public.quiz_questions for select
  using (
    exists (
      select 1
      from public.quizzes q
      join public.lessons l on l.id = q.lesson_id
      join public.courses c on c.id = l.course_id
      where q.id = quiz_questions.quiz_id
        and q.status = 'published'
        and l.status = 'published'
        and c.status = 'published'
    )
  );

drop policy if exists "Published quiz options are readable" on public.quiz_options;
create policy "Published quiz options are readable"
  on public.quiz_options for select
  using (
    exists (
      select 1
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      join public.lessons l on l.id = q.lesson_id
      join public.courses c on c.id = l.course_id
      where qq.id = quiz_options.question_id
        and q.status = 'published'
        and l.status = 'published'
        and c.status = 'published'
    )
  );

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
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage quizzes.';
  end if;

  if v_title = '' then
    raise exception 'Quiz title is required.';
  end if;

  update public.quizzes
  set title = v_title,
      status = coalesce(p_status, 'draft'::public.content_status),
      updated_at = now()
  where id = p_quiz_id;

  if not found then
    raise exception 'Quiz not found.';
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

grant execute on function public.admin_update_quiz(text, text, public.content_status) to authenticated;
