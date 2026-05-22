insert into public.quizzes (id, lesson_id, title, version, status)
values
  ('quiz-starter-budget', 'lesson-starter-budget', 'Starter Budget Quiz', 1, 'published'),
  ('quiz-track-spending', 'lesson-track-spending', 'Spending Tracker Quiz', 1, 'published'),
  ('quiz-avoid-scams', 'lesson-avoid-scams', 'Scam Safety Quiz', 1, 'published')
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  title = excluded.title,
  version = excluded.version,
  status = excluded.status;

insert into public.quiz_questions (
  id,
  quiz_id,
  question_order,
  question_type,
  prompt,
  explanation,
  xp
)
values
  ('q-budget-purpose', 'quiz-starter-budget', 1, 'single_choice', 'What is the main purpose of a starter budget?', 'A budget helps you make intentional decisions before spending.', 10),
  ('q-budget-needs', 'quiz-starter-budget', 2, 'multiple_choice', 'Which items are usually needs?', 'Needs are essential costs required for daily life or work.', 15),
  ('q-budget-flex', 'quiz-starter-budget', 3, 'true_false', 'True or false: a useful budget can include flexible spending.', 'A budget should be realistic. Small flexible spending can help the plan last.', 10),
  ('q-budget-first-step', 'quiz-starter-budget', 4, 'single_choice', 'What should you write down first when starting a budget?', 'A starter budget begins with income and essential costs so the plan is grounded.', 20),
  ('q-track-first-goal', 'quiz-track-spending', 1, 'single_choice', 'What is the first goal of tracking spending?', 'Tracking gives you visibility before you decide what to change.', 10),
  ('q-track-details', 'quiz-track-spending', 2, 'multiple_choice', 'Which details should you capture in a simple spending log?', 'Date, amount, and reason are enough to spot patterns without making tracking heavy.', 15),
  ('q-track-judgement', 'quiz-track-spending', 3, 'true_false', 'True or false: the first week of tracking is mainly for judging yourself.', 'The first week is for awareness. You can choose one small change after you see the pattern.', 10),
  ('q-scam-pressure', 'quiz-avoid-scams', 1, 'single_choice', 'What should you do when a money message pressures you to act now?', 'Urgency is a common scam tactic. Pause and verify first.', 15),
  ('q-scam-private-info', 'quiz-avoid-scams', 2, 'multiple_choice', 'Which details should you never share with someone in chat?', 'PINs, OTPs, and passwords can give someone control of your account.', 20),
  ('q-scam-verify', 'quiz-avoid-scams', 3, 'single_choice', 'What is the safest way to verify a suspicious wallet message?', 'Use a trusted channel you control instead of trusting the message source.', 15),
  ('q-scam-urgency', 'quiz-avoid-scams', 4, 'true_false', 'True or false: urgency can be a scam warning sign.', 'Scammers often use urgency to stop people from checking carefully.', 10)
on conflict (id) do update set
  quiz_id = excluded.quiz_id,
  question_order = excluded.question_order,
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  explanation = excluded.explanation,
  xp = excluded.xp;

insert into public.quiz_options (id, question_id, option_order, label, is_correct)
values
  ('q-budget-purpose-a', 'q-budget-purpose', 1, 'To decide what your money should do', true),
  ('q-budget-purpose-b', 'q-budget-purpose', 2, 'To remove every fun purchase', false),
  ('q-budget-purpose-c', 'q-budget-purpose', 3, 'To avoid tracking expenses', false),
  ('q-budget-needs-a', 'q-budget-needs', 1, 'Transport to work', true),
  ('q-budget-needs-b', 'q-budget-needs', 2, 'Basic food', true),
  ('q-budget-needs-c', 'q-budget-needs', 3, 'Impulse shopping', false),
  ('q-budget-flex-true', 'q-budget-flex', 1, 'True', true),
  ('q-budget-flex-false', 'q-budget-flex', 2, 'False', false),
  ('q-budget-first-step-a', 'q-budget-first-step', 1, 'Money coming in and required costs', true),
  ('q-budget-first-step-b', 'q-budget-first-step', 2, 'Only the things you want to buy', false),
  ('q-budget-first-step-c', 'q-budget-first-step', 3, 'A random savings amount', false),
  ('q-track-first-goal-a', 'q-track-first-goal', 1, 'Awareness', true),
  ('q-track-first-goal-b', 'q-track-first-goal', 2, 'Shame', false),
  ('q-track-details-a', 'q-track-details', 1, 'Date', true),
  ('q-track-details-b', 'q-track-details', 2, 'Amount', true),
  ('q-track-details-c', 'q-track-details', 3, 'Reason', true),
  ('q-track-details-d', 'q-track-details', 4, 'Your friend''s balance', false),
  ('q-track-judgement-true', 'q-track-judgement', 1, 'True', false),
  ('q-track-judgement-false', 'q-track-judgement', 2, 'False', true),
  ('q-scam-pressure-a', 'q-scam-pressure', 1, 'Pause and verify', true),
  ('q-scam-pressure-b', 'q-scam-pressure', 2, 'Send your PIN', false),
  ('q-scam-pressure-c', 'q-scam-pressure', 3, 'Click quickly', false),
  ('q-scam-private-info-a', 'q-scam-private-info', 1, 'PIN', true),
  ('q-scam-private-info-b', 'q-scam-private-info', 2, 'OTP', true),
  ('q-scam-private-info-c', 'q-scam-private-info', 3, 'Full password', true),
  ('q-scam-private-info-d', 'q-scam-private-info', 4, 'Your first name', false),
  ('q-scam-verify-a', 'q-scam-verify', 1, 'Open the official app or use a verified support channel', true),
  ('q-scam-verify-b', 'q-scam-verify', 2, 'Reply to the sender with your account details', false),
  ('q-scam-verify-c', 'q-scam-verify', 3, 'Click the link because it looks urgent', false),
  ('q-scam-urgency-true', 'q-scam-urgency', 1, 'True', true),
  ('q-scam-urgency-false', 'q-scam-urgency', 2, 'False', false)
on conflict (id) do update set
  question_id = excluded.question_id,
  option_order = excluded.option_order,
  label = excluded.label,
  is_correct = excluded.is_correct;

drop policy if exists "Users can create their quiz attempts" on public.quiz_attempts;
create policy "Users can create their quiz attempts"
  on public.quiz_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can create their attempt questions" on public.quiz_attempt_questions;
create policy "Users can create their attempt questions"
  on public.quiz_attempt_questions for insert
  with check (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_attempt_questions.attempt_id
        and a.user_id = auth.uid()
    )
  );

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
  v_attempt_question_count integer;
  v_answered_count integer;
  v_correct_option_ids text[];
  v_selected_option_ids text[];
  v_has_invalid_option boolean;
  v_is_correct boolean;
  v_already_awarded boolean;
  v_daily_limit integer := 30;
  v_daily_earned integer := 0;
  v_daily_remaining integer := 0;
  v_status public.quiz_answer_status;
  v_earned_xp integer := 0;
  v_answer_correct boolean;
  v_award_scope text := 'quiz_question:' || p_question_id;
  v_completed boolean := false;
  v_attempt_status public.quiz_attempt_status;
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

  select xp
    into v_question_xp
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
       select 1 from public.quiz_options o
        where o.id = selected.option_id
          and o.question_id = p_question_id
     )
  )
    into v_has_invalid_option;

  if v_has_invalid_option then
    raise exception 'One or more selected options do not belong to this question.';
  end if;

  select coalesce(array_agg(id order by id), '{}'::text[])
    into v_correct_option_ids
    from public.quiz_options
   where question_id = p_question_id
     and is_correct = true;

  v_is_correct := v_selected_option_ids = v_correct_option_ids;
  v_answer_correct := v_is_correct;

  select exists (
    select 1 from public.xp_transactions
     where user_id = v_user_id
       and direction = 'earn'
       and award_scope = v_award_scope
  )
    into v_already_awarded;

  select coalesce(earnable_quiz_xp_limit, 30)
    into v_daily_limit
    from public.user_daily_xp_limits
   where user_id = v_user_id
     and local_date = (now() at time zone 'Africa/Lagos')::date;

  v_daily_limit := coalesce(v_daily_limit, 30);

  select coalesce(sum(amount), 0)
    into v_daily_earned
    from public.xp_transactions
   where user_id = v_user_id
     and direction = 'earn'
     and source_type = 'quiz_question'
     and (created_at at time zone 'Africa/Lagos')::date =
       (now() at time zone 'Africa/Lagos')::date;

  v_daily_remaining := greatest(0, v_daily_limit - v_daily_earned);

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
    v_earned_xp := v_question_xp;

    insert into public.xp_transactions (
      user_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values (
      v_user_id,
      v_earned_xp,
      'earn',
      'quiz_question',
      p_question_id,
      v_award_scope,
      jsonb_build_object('attemptId', p_attempt_id, 'quizId', v_attempt.quiz_id)
    );

    update public.profiles
       set xp = xp + v_earned_xp,
           xp_balance_cached = xp_balance_cached + v_earned_xp
     where id = v_user_id;
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
      'status', v_status
    ),
    'dailyXpLimit', v_daily_limit,
    'dailyXpRemaining', greatest(0, v_daily_limit - v_daily_earned - v_earned_xp),
    'nextResetAt', (
      ((now() at time zone 'Africa/Lagos')::date + interval '1 day') at time zone 'Africa/Lagos'
    )
  );
end;
$$;

grant execute on function public.answer_quiz_question(uuid, text, text[]) to authenticated;
