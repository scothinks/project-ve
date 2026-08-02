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
  v_expected_count integer;
  v_offset integer;
  v_requested_count integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can reorder quiz questions.';
  end if;

  if not exists(select 1 from public.quizzes where id = p_quiz_id) then
    raise exception 'Quiz not found.';
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
    left join public.quiz_questions qq
      on qq.id = requested.question_id
     and qq.quiz_id = p_quiz_id
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
  values (
    v_actor_id,
    'quiz_questions_reordered',
    'quiz',
    p_quiz_id,
    jsonb_build_object('questionIds', p_question_ids)
  );

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
  v_order integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can delete quiz questions.';
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
  values (
    v_actor_id,
    'quiz_question_deleted',
    'quiz_question',
    p_question_id,
    jsonb_build_object('quizId', p_quiz_id)
  );

  return jsonb_build_object('quizId', p_quiz_id, 'questionId', p_question_id, 'status', 'deleted');
end;
$$;

grant execute on function public.admin_reorder_quiz_questions(text, text[]) to authenticated;
grant execute on function public.admin_delete_quiz_question(text, text) to authenticated;
