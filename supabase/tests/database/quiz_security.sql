begin;

\ir ./_test_constants.psql

create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, private;

select extensions.plan(16);

set local role service_role;

create temp table test_quiz_fixture as
select
  q.id as quiz_id,
  l.id as lesson_id,
  qq.id as question_id,
  (
    select qo.id
    from public.quiz_options qo
    where qo.question_id = qq.id
      and qo.is_correct
    order by qo.option_order, qo.id
    limit 1
  ) as correct_option_id
from public.quizzes q
join public.lessons l
  on l.id = q.lesson_id
 and l.status = 'published'
join public.courses c
  on c.id = l.course_id
 and c.status = 'published'
join public.quiz_questions qq
  on qq.quiz_id = q.id
where q.status = 'published'
  and exists (
    select 1
    from public.lesson_pages lp
    where lp.lesson_id = l.id
  )
  and exists (
    select 1
    from public.quiz_options qo
    where qo.question_id = qq.id
      and qo.is_correct
  )
order by q.id, qq.question_order, qq.id
limit 1;

grant select on test_quiz_fixture to authenticated, service_role;

reset role;

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

select public.complete_lesson_page(lp.lesson_id, lp.id)
from public.lesson_pages lp
where lp.lesson_id = (select lesson_id from test_quiz_fixture)
order by lp.page_number;

reset role;

select set_config('request.jwt.claim.sub', :'TEST_LEARNER_USER_ID', true);
set local role authenticated;

select extensions.is(
  (select count(*)::integer from public.quiz_questions where quiz_id = (select quiz_id from test_quiz_fixture)),
  0,
  'authenticated learner cannot read raw quiz_questions rows'
);

select extensions.is(
  (
    select count(*)::integer
    from public.quiz_options qo
    join public.quiz_questions qq on qq.id = qo.question_id
    where qq.quiz_id = (select quiz_id from test_quiz_fixture)
  ),
  0,
  'authenticated learner cannot read raw quiz_options rows'
);

select extensions.ok(
  (select count(*)::integer from public.learner_quiz_questions where quiz_id = (select quiz_id from test_quiz_fixture)) > 0,
  'authenticated learner can read sanitized quiz questions'
);

select extensions.ok(
  (
    select count(*)::integer
    from public.learner_quiz_options qo
    join public.learner_quiz_questions qq on qq.id = qo.question_id
    where qq.quiz_id = (select quiz_id from test_quiz_fixture)
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
      (select lesson_id from test_quiz_fixture),
      (select quiz_id from test_quiz_fixture),
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
  (
    select public.start_quiz_attempt(
      (select quiz_id from test_quiz_fixture),
      (select lesson_id from test_quiz_fixture)
    ) ->> 'status'
  ),
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
          and quiz_id = (select quiz_id from test_quiz_fixture)
        order by created_at desc
        limit 1
      ),
      (select question_id from test_quiz_fixture),
      1,
      jsonb_build_object('id', (select question_id from test_quiz_fixture), 'prompt', 'forged', 'xp', 999),
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
      and quiz_id = (select quiz_id from test_quiz_fixture)
  ),
  'start_quiz_attempt created the attempt row'
);

select extensions.ok(
  exists (
    select 1
    from public.quiz_attempt_questions aq
    join public.quiz_attempts qa on qa.id = aq.attempt_id
    where qa.user_id = :'TEST_LEARNER_USER_ID'::uuid
      and qa.quiz_id = (select quiz_id from test_quiz_fixture)
  ),
  'start_quiz_attempt created attempt question snapshots'
);

select extensions.ok(
  not exists (
    select 1
    from public.quiz_attempt_questions aq
    join public.quiz_attempts qa on qa.id = aq.attempt_id
    where qa.user_id = :'TEST_LEARNER_USER_ID'::uuid
      and qa.quiz_id = (select quiz_id from test_quiz_fixture)
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
          and quiz_id = (select quiz_id from test_quiz_fixture)
        order by created_at desc
        limit 1
      ),
      (select question_id from test_quiz_fixture),
      array[(select correct_option_id from test_quiz_fixture)]
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
      and source_id = (select question_id from test_quiz_fixture)
  ),
  (select xp from public.quiz_questions where id = (select question_id from test_quiz_fixture)),
  'quiz answer XP comes from canonical question configuration'
);

select extensions.is(
  (
    select xp_balance_cached
    from public.profiles
    where id = :'TEST_LEARNER_USER_ID'::uuid
  ),
  (select xp from public.quiz_questions where id = (select question_id from test_quiz_fixture)),
  'cached XP balance matches canonical quiz XP after answer'
);

select * from finish();

rollback;
