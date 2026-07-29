create table if not exists private.quiz_answer_keys (
  question_id text primary key references public.quiz_questions(id) on delete cascade,
  correct_option_ids text[] not null default '{}',
  explanation text,
  updated_at timestamptz not null default now()
);

alter table private.quiz_answer_keys enable row level security;

revoke all on private.quiz_answer_keys from public;
revoke all on private.quiz_answer_keys from anon;
revoke all on private.quiz_answer_keys from authenticated;

insert into private.quiz_answer_keys (
  question_id,
  correct_option_ids,
  explanation,
  updated_at
)
select
  qq.id,
  coalesce(array_agg(qo.id order by qo.id) filter (where qo.is_correct), '{}')::text[],
  qq.explanation,
  now()
from public.quiz_questions qq
left join public.quiz_options qo
  on qo.question_id = qq.id
group by qq.id, qq.explanation
on conflict (question_id) do update
set correct_option_ids = excluded.correct_option_ids,
    explanation = excluded.explanation,
    updated_at = now();

create or replace function private.sync_quiz_answer_key(p_question_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_explanation text;
begin
  select explanation
    into v_explanation
  from public.quiz_questions
  where id = p_question_id;

  if not found then
    delete from private.quiz_answer_keys
    where question_id = p_question_id;
    return;
  end if;

  insert into private.quiz_answer_keys (
    question_id,
    correct_option_ids,
    explanation,
    updated_at
  )
  select
    p_question_id,
    coalesce(array_agg(id order by id) filter (where is_correct), '{}')::text[],
    v_explanation,
    now()
  from public.quiz_options
  where question_id = p_question_id
  on conflict (question_id) do update
  set correct_option_ids = excluded.correct_option_ids,
      explanation = excluded.explanation,
      updated_at = now();
end;
$$;

create or replace function private.sync_quiz_answer_key_from_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.sync_quiz_answer_key(new.id);
  return new;
end;
$$;

create or replace function private.sync_quiz_answer_key_from_option()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.sync_quiz_answer_key(coalesce(new.question_id, old.question_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists quiz_questions_sync_answer_key on public.quiz_questions;
create trigger quiz_questions_sync_answer_key
  after insert or update of explanation on public.quiz_questions
  for each row execute function private.sync_quiz_answer_key_from_question();

drop trigger if exists quiz_options_sync_answer_key on public.quiz_options;
create trigger quiz_options_sync_answer_key
  after insert or update or delete on public.quiz_options
  for each row execute function private.sync_quiz_answer_key_from_option();

drop policy if exists "Published quiz questions are readable" on public.quiz_questions;
drop policy if exists "Published quiz options are readable" on public.quiz_options;

create or replace view public.learner_quiz_questions as
select
  qq.id,
  qq.quiz_id,
  qq.question_order,
  qq.question_type,
  qq.prompt,
  qq.xp
from public.quiz_questions qq
join public.quizzes q on q.id = qq.quiz_id
join public.lessons l on l.id = q.lesson_id
join public.courses c on c.id = l.course_id
where q.status = 'published'
  and l.status = 'published'
  and c.status = 'published';

create or replace view public.learner_quiz_options as
select
  qo.id,
  qo.question_id,
  qo.option_order,
  qo.label
from public.quiz_options qo
join public.quiz_questions qq on qq.id = qo.question_id
join public.quizzes q on q.id = qq.quiz_id
join public.lessons l on l.id = q.lesson_id
join public.courses c on c.id = l.course_id
where q.status = 'published'
  and l.status = 'published'
  and c.status = 'published';

grant select on public.learner_quiz_questions to anon, authenticated;
grant select on public.learner_quiz_options to anon, authenticated;

drop policy if exists "Users can create their quiz attempts" on public.quiz_attempts;
drop policy if exists "Users can create their attempt questions" on public.quiz_attempt_questions;

create or replace function public.start_quiz_attempt(
  p_quiz_id text,
  p_lesson_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid := gen_random_uuid();
  v_quiz public.quizzes%rowtype;
  v_lesson public.lessons%rowtype;
  v_course public.courses%rowtype;
  v_last_ended_at timestamptz;
  v_page_count integer := 0;
  v_completed_count integer := 0;
  v_requires_fresh_reread boolean := false;
  v_retry_available_at timestamptz;
  v_daily_limit integer := 50;
  v_daily_earned integer := 0;
  v_daily_remaining integer := 0;
  v_unawarded_count integer := 0;
  v_question_ids text[] := '{}';
  v_mode public.quiz_attempt_mode := 'earning';
  v_seed text;
  v_total_possible_xp integer := 0;
  v_questions jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_quiz
  from public.quizzes
  where id = p_quiz_id
    and status = 'published';

  if not found then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select *
    into v_lesson
  from public.lessons
  where id = v_quiz.lesson_id
    and status = 'published';

  if not found or (p_lesson_id is not null and p_lesson_id <> v_lesson.id) then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select *
    into v_course
  from public.courses
  where id = v_lesson.course_id
    and status = 'published';

  if not found then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', 'We could not find this quiz for the selected lesson.'
    );
  end if;

  select ended_at
    into v_last_ended_at
  from public.quiz_attempts
  where user_id = v_user_id
    and lesson_id = v_lesson.id
    and ended_at is not null
  order by ended_at desc
  limit 1;

  v_requires_fresh_reread := v_last_ended_at is not null and coalesce(v_lesson.retry_requires_reread, false);

  select count(*)
    into v_page_count
  from public.lesson_pages
  where lesson_id = v_lesson.id;

  select count(distinct lpc.page_id)
    into v_completed_count
  from public.lesson_page_completions lpc
  join public.lesson_pages lp
    on lp.id = lpc.page_id
   and lp.lesson_id = v_lesson.id
  where lpc.user_id = v_user_id
    and lpc.lesson_id = v_lesson.id
    and (
      not v_requires_fresh_reread
      or lpc.completed_at > v_last_ended_at
    );

  if coalesce(v_lesson.quiz_requires_lesson_completion, true)
    and v_completed_count < v_page_count
  then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'lesson_incomplete',
      'message', case
        when v_requires_fresh_reread then 'Please reread the lesson pages before retrying this quiz.'
        else 'Complete the lesson pages before starting the quiz.'
      end
    );
  end if;

  if v_lesson.retry_mode = 'disabled' and v_last_ended_at is not null then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'retry_disabled',
      'message', 'This lesson quiz can only be completed once.'
    );
  end if;

  if v_lesson.retry_mode = 'cooldown' and v_last_ended_at is not null then
    v_retry_available_at := v_last_ended_at + make_interval(secs => coalesce(v_lesson.retry_cooldown_seconds, 86400));

    if v_retry_available_at > now() then
      return jsonb_build_object(
        'status', 'blocked',
        'reason', 'cooldown',
        'message', 'Your progress is saved. This quiz unlocks again after the retry window.',
        'retryAvailableAt', v_retry_available_at
      );
    end if;
  end if;

  select coalesce(
    (
      select earnable_quiz_xp_limit
      from public.user_daily_xp_limits
      where user_id = v_user_id
        and local_date = (now() at time zone 'Africa/Lagos')::date
    ),
    (
      select default_daily_quiz_xp_limit
      from public.xp_settings
      where id = 1
    ),
    50
  )
    into v_daily_limit;

  select coalesce(sum(amount), 0)
    into v_daily_earned
  from public.xp_transactions
  where user_id = v_user_id
    and direction = 'earn'
    and source_type = 'quiz_question'
    and (created_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date;

  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

  select count(*)
    into v_unawarded_count
  from public.quiz_questions qq
  where qq.quiz_id = v_quiz.id
    and not exists (
      select 1
      from public.xp_transactions xp
      where xp.user_id = v_user_id
        and xp.direction = 'earn'
        and xp.source_type = 'quiz_question'
        and xp.source_id = qq.id
    );

  v_mode := case when v_unawarded_count > 0 then 'earning'::public.quiz_attempt_mode else 'practice'::public.quiz_attempt_mode end;

  if v_mode = 'earning' then
    select coalesce(array_agg(id order by question_order), '{}')::text[]
      into v_question_ids
    from public.quiz_questions qq
    where qq.quiz_id = v_quiz.id
      and qq.xp <= v_daily_remaining
      and not exists (
        select 1
        from public.xp_transactions xp
        where xp.user_id = v_user_id
          and xp.direction = 'earn'
          and xp.source_type = 'quiz_question'
          and xp.source_id = qq.id
      );
  else
    select coalesce(array_agg(id order by question_order), '{}')::text[]
      into v_question_ids
    from public.quiz_questions
    where quiz_id = v_quiz.id;
  end if;

  if v_mode = 'earning' and coalesce(array_length(v_question_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'blocked',
      'reason', 'daily_cap_reached',
      'message', 'You have reached today''s quiz XP limit.',
      'nextResetAt', (((now() at time zone 'Africa/Lagos')::date + interval '1 day') at time zone 'Africa/Lagos')
    );
  end if;

  v_seed := v_quiz.id || ':' || v_attempt_id::text;

  insert into public.quiz_attempts (
    id,
    user_id,
    lesson_id,
    quiz_id,
    quiz_version,
    mode,
    status,
    seed
  )
  values (
    v_attempt_id,
    v_user_id,
    v_lesson.id,
    v_quiz.id,
    v_quiz.version,
    v_mode,
    'in_progress',
    v_seed
  );

  insert into public.quiz_attempt_questions (
    attempt_id,
    question_id,
    question_order,
    question_snapshot,
    options_snapshot,
    xp
  )
  select
    v_attempt_id,
    qq.id,
    row_number() over (order by qq.question_order)::integer,
    jsonb_build_object(
      'id', qq.id,
      'prompt', qq.prompt,
      'type', qq.question_type,
      'xp', qq.xp,
      'order', qq.question_order
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', qo.id,
            'questionId', qo.question_id,
            'label', qo.label,
            'order', qo.option_order
          )
          order by qo.option_order
        )
        from public.quiz_options qo
        where qo.question_id = qq.id
      ),
      '[]'::jsonb
    ),
    qq.xp
  from public.quiz_questions qq
  where qq.id = any(v_question_ids)
  order by qq.question_order;

  select coalesce(sum(xp), 0)
    into v_total_possible_xp
  from public.quiz_attempt_questions
  where attempt_id = v_attempt_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', aq.question_id,
        'quizId', v_quiz.id,
        'prompt', aq.question_snapshot ->> 'prompt',
        'type', aq.question_snapshot ->> 'type',
        'xp', aq.xp,
        'order', aq.question_order,
        'options', aq.options_snapshot
      )
      order by aq.question_order
    ),
    '[]'::jsonb
  )
    into v_questions
  from public.quiz_attempt_questions aq
  where aq.attempt_id = v_attempt_id;

  return jsonb_build_object(
    'status', 'started',
    'attemptId', v_attempt_id,
    'mode', v_mode,
    'questions', v_questions,
    'dailyXpLimit', v_daily_limit,
    'dailyXpRemaining', v_daily_remaining,
    'totalPossibleXp', v_total_possible_xp
  );
end;
$$;

create or replace function public.answer_quiz_question(
  p_attempt_id uuid,
  p_question_id text,
  p_selected_option_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
  v_question_xp integer;
  v_options_snapshot jsonb;
  v_attempt_question_count integer;
  v_answered_count integer;
  v_correct_option_ids text[];
  v_selected_option_ids text[];
  v_has_invalid_option boolean;
  v_is_correct boolean;
  v_already_awarded boolean;
  v_daily_limit integer := 50;
  v_daily_earned integer := 0;
  v_daily_remaining integer := 0;
  v_status public.quiz_answer_status;
  v_earned_xp integer := 0;
  v_base_earned_xp integer := 0;
  v_boost_bonus_xp integer := 0;
  v_answer_correct boolean;
  v_award_scope text := 'quiz_question:' || p_question_id;
  v_completed boolean := false;
  v_attempt_status public.quiz_attempt_status;
  v_boost public.user_xp_boosts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_attempt
    from public.quiz_attempts
   where id = p_attempt_id
     and user_id = v_user_id
   for update;

  if v_attempt.id is null or v_attempt.status <> 'in_progress' then
    raise exception 'Attempt is not active.';
  end if;

  if exists (
    select 1 from public.quiz_answers
    where attempt_id = p_attempt_id and question_id = p_question_id
  ) then
    raise exception 'This question has already been answered.';
  end if;

  select xp, options_snapshot
    into v_question_xp, v_options_snapshot
    from public.quiz_attempt_questions
   where attempt_id = p_attempt_id
     and question_id = p_question_id;

  if v_question_xp is null then
    raise exception 'Question is not part of this attempt.';
  end if;

  select coalesce(array_agg(distinct option_id order by option_id), '{}'::text[])
    into v_selected_option_ids
    from unnest(coalesce(p_selected_option_ids, '{}'::text[])) as option_id;

  if coalesce(array_length(v_selected_option_ids, 1), 0) = 0 then
    raise exception 'At least one selected option is required.';
  end if;

  select exists (
    select 1
      from unnest(v_selected_option_ids) selected(option_id)
     where not exists (
       select 1
       from jsonb_array_elements(coalesce(v_options_snapshot, '[]'::jsonb)) as option_snapshot(value)
       where option_snapshot.value ->> 'id' = selected.option_id
     )
  )
    into v_has_invalid_option;

  if v_has_invalid_option then
    raise exception 'One or more selected options do not belong to this attempt question.';
  end if;

  select correct_option_ids
    into v_correct_option_ids
    from private.quiz_answer_keys
   where question_id = p_question_id;

  v_correct_option_ids := coalesce(v_correct_option_ids, '{}'::text[]);
  v_is_correct := v_selected_option_ids = v_correct_option_ids;
  v_answer_correct := v_is_correct;

  select exists (
    select 1 from public.xp_transactions
     where user_id = v_user_id
       and direction = 'earn'
       and award_scope = v_award_scope
  )
    into v_already_awarded;

  select coalesce(
    (
      select earnable_quiz_xp_limit
        from public.user_daily_xp_limits
       where user_id = v_user_id
         and local_date = (now() at time zone 'Africa/Lagos')::date
    ),
    (
      select default_daily_quiz_xp_limit
        from public.xp_settings
       where id = 1
    ),
    50
  )
    into v_daily_limit;

  select coalesce(sum(amount), 0)
    into v_daily_earned
    from public.xp_transactions
   where user_id = v_user_id
     and direction = 'earn'
     and source_type = 'quiz_question'
     and (created_at at time zone 'Africa/Lagos')::date =
       (now() at time zone 'Africa/Lagos')::date;

  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

  update public.user_xp_boosts
     set status = 'expired'
   where user_id = v_user_id
     and status = 'active'
     and ends_at <= now();

  if v_attempt.mode = 'practice' then
    v_status := 'practice';
    v_answer_correct := v_is_correct;
  elsif not v_is_correct then
    v_status := 'missed';
  elsif v_already_awarded then
    v_status := 'already_earned';
  elsif v_daily_remaining < v_question_xp then
    v_status := 'daily_cap_deferred';
    v_answer_correct := false;
  else
    v_status := 'earned';
    v_base_earned_xp := v_question_xp;
    v_earned_xp := v_question_xp;

    select *
      into v_boost
    from public.user_xp_boosts
    where user_id = v_user_id
      and status = 'active'
      and starts_at <= now()
      and ends_at > now()
      and (remaining_uses is null or used_count < remaining_uses)
    order by multiplier desc, ends_at asc
    for update skip locked
    limit 1;

    if v_boost.id is not null then
      v_boost_bonus_xp := greatest(0, floor(v_question_xp * (v_boost.multiplier - 1))::integer);
      v_earned_xp := v_question_xp + v_boost_bonus_xp;
    end if;

    perform private.post_xp_transaction(
      v_user_id,
      'earn'::public.xp_direction,
      v_base_earned_xp,
      'quiz_question'::public.xp_source_type,
      p_question_id,
      v_award_scope,
      jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id)
    );

    if v_boost_bonus_xp > 0 then
      perform private.post_xp_transaction(
        v_user_id,
        'earn'::public.xp_direction,
        v_boost_bonus_xp,
        'reward_redemption'::public.xp_source_type,
        v_boost.redemption_id::text,
        'xp_boost:' || v_boost.id::text || ':' || p_question_id,
        jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id, 'boostId', v_boost.id)
      );

      update public.user_xp_boosts
      set used_count = used_count + 1,
          status = case
            when remaining_uses is not null and used_count + 1 >= remaining_uses then 'consumed'
            else status
          end
      where id = v_boost.id;
    end if;
  end if;

  insert into public.quiz_answers (
    attempt_id,
    user_id,
    question_id,
    selected_option_ids,
    is_correct,
    earned_xp,
    status
  )
  values (
    p_attempt_id,
    v_user_id,
    p_question_id,
    v_selected_option_ids,
    v_answer_correct,
    v_earned_xp,
    v_status
  );

  select count(*)
    into v_attempt_question_count
    from public.quiz_attempt_questions
   where attempt_id = p_attempt_id;

  select count(*)
    into v_answered_count
    from public.quiz_answers
   where attempt_id = p_attempt_id;

  if v_status = 'daily_cap_deferred' then
    v_attempt_status := 'daily_cap_reached';
    v_completed := true;
  elsif v_answered_count >= v_attempt_question_count then
    v_attempt_status := case
      when v_attempt.mode = 'practice' then 'practice_completed'::public.quiz_attempt_status
      else 'graded'::public.quiz_attempt_status
    end;
    v_completed := true;
  end if;

  if v_completed then
    update public.quiz_attempts
       set status = v_attempt_status,
           ended_at = now(),
           ended_reason = v_attempt_status::text
     where id = p_attempt_id;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'completed', v_completed,
    'attemptStatus', coalesce(v_attempt_status::text, 'in_progress'),
    'questionResult', jsonb_build_object(
      'questionId', p_question_id,
      'correct', v_answer_correct,
      'earnedXp', v_earned_xp,
      'status', v_status,
      'boostBonusXp', v_boost_bonus_xp
    ),
    'dailyXpLimit', v_daily_limit,
    'dailyXpRemaining', greatest(0, v_daily_limit - v_daily_earned - v_base_earned_xp),
    'nextResetAt', (
      ((now() at time zone 'Africa/Lagos')::date + interval '1 day') at time zone 'Africa/Lagos'
    )
  );
end;
$$;

revoke execute on function public.start_quiz_attempt(text, text) from public, anon;
grant execute on function public.start_quiz_attempt(text, text) to authenticated;

revoke execute on function public.answer_quiz_question(uuid, text, text[]) from public, anon;
grant execute on function public.answer_quiz_question(uuid, text, text[]) to authenticated;

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
    'start_quiz_attempt',
    'p_quiz_id text, p_lesson_id text',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners starting their own quiz attempts.',
    'Derives user_id from auth.uid(); derives quiz questions, option snapshots, XP, mode and eligibility from canonical database state.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'answer_quiz_question',
    'p_attempt_id uuid, p_question_id text, p_selected_option_ids text[]',
    'PUBLIC_AUTHENTICATED_SELF',
    'Authenticated learners answering questions in their own server-created attempts.',
    'Derives user_id from auth.uid(); validates selected options against attempt snapshots and grades against private answer keys.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
