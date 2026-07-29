begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(16);

select extensions.ok(
  not has_table_privilege('anon', 'private.quiz_answer_keys', 'select')
  and not has_table_privilege('authenticated', 'private.quiz_answer_keys', 'select'),
  'client roles cannot read private quiz answer keys'
);

select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('learner_quiz_questions', 'learner_quiz_options')
      and column_name in ('is_correct', 'correct_option_ids', 'explanation')
  ),
  'learner quiz views do not expose answer key columns'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.start_quiz_attempt(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.start_quiz_attempt(text, text)', 'execute'),
  'start_quiz_attempt is authenticated-only'
);

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

insert into public.lesson_page_completions (user_id, lesson_id, page_id)
select :'TEST_LEARNER_USER_ID'::uuid, lp.lesson_id, lp.id
from public.lesson_pages lp
where lp.lesson_id = 'lesson-how-nigeria-is-organized-746c17'
on conflict (user_id, lesson_id, page_id) do nothing;

reset role;

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.quiz_questions where quiz_id = 'quiz-how-nigeria-is-organized-746c17'),
  0,
  'authenticated learner cannot read raw quiz_questions rows'
);

select extensions.is(
  (select count(*)::integer from public.quiz_options qo join public.quiz_questions qq on qq.id = qo.question_id where qq.quiz_id = 'quiz-how-nigeria-is-organized-746c17'),
  0,
  'authenticated learner cannot read raw quiz_options rows'
);

select extensions.ok(
  (select count(*)::integer from public.learner_quiz_questions where quiz_id = 'quiz-how-nigeria-is-organized-746c17') > 0,
  'authenticated learner can read sanitized quiz questions'
);

select extensions.ok(
  (
    select count(*)::integer
    from public.learner_quiz_options qo
    join public.learner_quiz_questions qq on qq.id = qo.question_id
    where qq.quiz_id = 'quiz-how-nigeria-is-organized-746c17'
  ) > 0,
  'authenticated learner can read sanitized quiz options'
);

select extensions.throws_ok(
  format(
    $$
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
      '00000000-0000-0000-0000-000000000601',
      %L::uuid,
      'lesson-how-nigeria-is-organized-746c17',
      'quiz-how-nigeria-is-organized-746c17',
      1,
      'earning',
      'in_progress',
      'forged'
    )
  $$,
    :'TEST_LEARNER_USER_ID'
  ),
  '42501',
  'new row violates row-level security policy for table "quiz_attempts"'
);

reset role;

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (select public.start_quiz_attempt('quiz-how-nigeria-is-organized-746c17', 'lesson-how-nigeria-is-organized-746c17') ->> 'status'),
  'started',
  'authenticated learner can start a valid quiz through server-authoritative RPC'
);

select extensions.throws_ok(
  format(
    $$
    insert into public.quiz_attempt_questions (
      attempt_id,
      question_id,
      question_order,
      question_snapshot,
      options_snapshot,
      xp
    )
    values (
      (
        select id
        from public.quiz_attempts
        where user_id = %L::uuid
          and quiz_id = 'quiz-how-nigeria-is-organized-746c17'
        order by created_at desc
        limit 1
      ),
      'question-how-nigeria-is-organized-why-should-a-citizen-know-the-basic-parts-of-government-1f4845',
      1,
      '{"id":"question-how-nigeria-is-organized-why-should-a-citizen-know-the-basic-parts-of-government-1f4845","prompt":"forged","xp":999}'::jsonb,
      '[]'::jsonb,
      999
    )
  $$,
    :'TEST_LEARNER_USER_ID'
  ),
  '42501',
  'new row violates row-level security policy for table "quiz_attempt_questions"'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

select extensions.ok(
  exists (
    select 1
    from public.quiz_attempts
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and quiz_id = 'quiz-how-nigeria-is-organized-746c17'
  ),
  'start_quiz_attempt created the attempt row'
);

select extensions.ok(
  exists (
    select 1
    from public.quiz_attempt_questions aq
    join public.quiz_attempts qa on qa.id = aq.attempt_id
    where qa.user_id = :'TEST_LEARNER_USER_ID'::uuid
      and qa.quiz_id = 'quiz-how-nigeria-is-organized-746c17'
  ),
  'start_quiz_attempt created attempt question snapshots'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_attempt_questions aq
    join public.quiz_attempts qa on qa.id = aq.attempt_id
    where qa.user_id = :'TEST_LEARNER_USER_ID'::uuid
      and qa.quiz_id = 'quiz-how-nigeria-is-organized-746c17'
      and (
        aq.question_snapshot ? 'explanation'
        or aq.question_snapshot ? 'correctOptionIds'
        or aq.options_snapshot::text ilike '%is_correct%'
        or aq.options_snapshot::text ilike '%isCorrect%'
      )
  ),
  'server-created attempt snapshots do not expose answer keys'
);

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.lives_ok(
  format(
    $$
    select public.answer_quiz_question(
      (
        select id
        from public.quiz_attempts
        where user_id = %L::uuid
          and quiz_id = 'quiz-how-nigeria-is-organized-746c17'
        order by created_at desc
        limit 1
      ),
      'question-how-nigeria-is-organized-why-should-a-citizen-know-the-basic-parts-of-government-1f4845',
      array['question-how-nigeria-is-organized-why-should-a-citizen-know-the-basic-parts-of-government-1f4845-option-2']
    )
  $$,
    :'TEST_LEARNER_USER_ID'
  ),
  'answer_quiz_question grades using private answer keys'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;

select extensions.is(
  (
    select coalesce(sum(amount), 0)::integer
    from public.xp_transactions
    where user_id = :'TEST_LEARNER_USER_ID'::uuid
      and source_type = 'quiz_question'
      and source_id = 'question-how-nigeria-is-organized-why-should-a-citizen-know-the-basic-parts-of-government-1f4845'
  ),
  (select xp from public.quiz_questions where id = 'question-how-nigeria-is-organized-why-should-a-citizen-know-the-basic-parts-of-government-1f4845'),
  'quiz answer XP comes from canonical question configuration'
);

select extensions.is(
  (
    select xp_balance_cached
    from public.profiles
    where id = :'TEST_LEARNER_USER_ID'::uuid
  ),
  (select xp from public.quiz_questions where id = 'question-how-nigeria-is-organized-why-should-a-citizen-know-the-basic-parts-of-government-1f4845'),
  'cached XP balance matches canonical quiz XP after answer'
);

select * from finish();

rollback;
