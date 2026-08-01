import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const dbUrl =
  process.env.LOCAL_SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (
  process.env.ALLOW_NONLOCAL_DB_CONCURRENCY_TESTS !== "1" &&
  !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):54322\//.test(dbUrl)
) {
  throw new Error(
    "Refusing to run destructive local concurrency fixtures against a non-local database. Set ALLOW_NONLOCAL_DB_CONCURRENCY_TESTS=1 to override.",
  );
}

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const concurrentUserId = randomUUID();
const sequentialUserId = randomUUID();
const courseId = `course-ve-quiz-003-${suffix}`;
const lessonId = `lesson-ve-quiz-003-${suffix}`;
const pageId = `page-ve-quiz-003-${suffix}`;
const quizId = `quiz-ve-quiz-003-${suffix}`;
const questionAId = `question-ve-quiz-003-a-${suffix}`;
const questionBId = `question-ve-quiz-003-b-${suffix}`;
const optionACorrectId = `option-ve-quiz-003-a-correct-${suffix}`;
const optionAWrongId = `option-ve-quiz-003-a-wrong-${suffix}`;
const optionBCorrectId = `option-ve-quiz-003-b-correct-${suffix}`;
const optionBWrongId = `option-ve-quiz-003-b-wrong-${suffix}`;
const sleepFunctionName = `ve_quiz_003_sleep_${suffix}`;
const sleepTriggerName = `ve_quiz_003_sleep_${suffix}`;

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseLastLine(stdout) {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1) ?? "";
}

async function psql(sql, options = {}) {
  const result = await execFileAsync(
    "psql",
    [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      ...options,
    },
  );

  return parseLastLine(result.stdout);
}

function asAuthenticated(userId, sql) {
  return `
    set role authenticated;
    select set_config('request.jwt.claim.sub', ${literal(userId)}, false);
    ${sql}
  `;
}

async function cleanup() {
  await psql(`
    drop trigger if exists ${sleepTriggerName} on public.xp_transactions;
    drop function if exists public.${sleepFunctionName}();
    delete from auth.users where id in (${literal(concurrentUserId)}::uuid, ${literal(sequentialUserId)}::uuid);
    delete from public.missions where id = 'mission-unused-${suffix}';
    delete from public.courses where id = ${literal(courseId)};
  `);
}

async function setupFixture() {
  await cleanup();

  await psql(`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values
      (
        '00000000-0000-0000-0000-000000000000',
        ${literal(concurrentUserId)}::uuid,
        'authenticated',
        'authenticated',
        ${literal(`ve-quiz-003-concurrent-${suffix}@example.com`)},
        '',
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        ${literal(sequentialUserId)}::uuid,
        'authenticated',
        'authenticated',
        ${literal(`ve-quiz-003-sequential-${suffix}@example.com`)},
        '',
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      );

    insert into public.courses (
      id,
      slug,
      title,
      description,
      category,
      level,
      status
    )
    values (
      ${literal(courseId)},
      ${literal(courseId)},
      'VE-QUIZ-003 concurrency course',
      'Local-only concurrency test fixture.',
      'Security',
      'beginner',
      'published'
    );

    insert into public.lessons (
      id,
      course_id,
      slug,
      title,
      description,
      status,
      retry_mode,
      retry_requires_reread,
      quiz_requires_lesson_completion
    )
    values (
      ${literal(lessonId)},
      ${literal(courseId)},
      ${literal(lessonId)},
      'VE-QUIZ-003 concurrency lesson',
      'Local-only concurrency test fixture.',
      'published',
      'anytime',
      false,
      true
    );

    insert into public.lesson_pages (
      id,
      lesson_id,
      page_number,
      title,
      page_type
    )
    values (
      ${literal(pageId)},
      ${literal(lessonId)},
      1,
      'VE-QUIZ-003 page',
      'concept'
    );

    insert into public.quizzes (
      id,
      lesson_id,
      title,
      status
    )
    values (
      ${literal(quizId)},
      ${literal(lessonId)},
      'VE-QUIZ-003 concurrency quiz',
      'published'
    );

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
      (${literal(questionAId)}, ${literal(quizId)}, 1, 'single_choice', 'Question A?', 'A is correct.', 10),
      (${literal(questionBId)}, ${literal(quizId)}, 2, 'single_choice', 'Question B?', 'B is correct.', 10);

    insert into public.quiz_options (
      id,
      question_id,
      option_order,
      label,
      is_correct
    )
    values
      (${literal(optionACorrectId)}, ${literal(questionAId)}, 1, 'Correct A', true),
      (${literal(optionAWrongId)}, ${literal(questionAId)}, 2, 'Wrong A', false),
      (${literal(optionBCorrectId)}, ${literal(questionBId)}, 1, 'Correct B', true),
      (${literal(optionBWrongId)}, ${literal(questionBId)}, 2, 'Wrong B', false);

    insert into public.user_daily_xp_limits (
      user_id,
      local_date,
      timezone,
      earnable_quiz_xp_limit
    )
    values
      (${literal(concurrentUserId)}::uuid, (now() at time zone 'Africa/Lagos')::date, 'Africa/Lagos', 10),
      (${literal(sequentialUserId)}::uuid, (now() at time zone 'Africa/Lagos')::date, 'Africa/Lagos', 50);

    create function public.${sleepFunctionName}()
    returns trigger
    language plpgsql
    as $$
    begin
      if new.user_id = ${literal(concurrentUserId)}::uuid
        and new.source_type = 'quiz_question' then
        perform pg_sleep(0.35);
      end if;

      return new;
    end;
    $$;

    create trigger ${sleepTriggerName}
    before insert on public.xp_transactions
    for each row execute function public.${sleepFunctionName}();
  `);
}

async function completeLesson(userId) {
  const completed = await psql(
    asAuthenticated(
      userId,
      `select public.complete_lesson_page(${literal(lessonId)}, ${literal(pageId)}) ->> 'lessonCompleted';`,
    ),
  );

  assert.equal(completed, "true", `lesson completion failed for ${userId}`);
}

async function startAttempt(userId) {
  const attemptId = await psql(
    asAuthenticated(
      userId,
      `select public.start_quiz_attempt(${literal(quizId)}, ${literal(lessonId)}) ->> 'attemptId';`,
    ),
  );

  assert.match(attemptId, /^[0-9a-f-]{36}$/i, `start_quiz_attempt did not return an attempt id: ${attemptId}`);
  return attemptId;
}

async function answerQuestion(userId, attemptId, questionId, optionId) {
  return psql(
    `
      set statement_timeout = '12s';
      ${asAuthenticated(
        userId,
        `select public.answer_quiz_question(${literal(attemptId)}::uuid, ${literal(questionId)}, array[${literal(optionId)}]) ->> 'status';`,
      )}
    `,
    { timeout: 15_000 },
  );
}

async function expectAnswerError(userId, attemptId, questionId, optionId) {
  try {
    await answerQuestion(userId, attemptId, questionId, optionId);
  } catch {
    return;
  }

  throw new Error("Expected duplicate answer submission to be rejected.");
}

async function quizXpTotal(userId) {
  const total = await psql(`
    select coalesce(sum(amount), 0)::integer
    from public.xp_transactions
    where user_id = ${literal(userId)}::uuid
      and direction = 'earn'
      and source_type = 'quiz_question'
      and source_id in (${literal(questionAId)}, ${literal(questionBId)});
  `);

  return Number(total);
}

async function cachedBalance(userId) {
  const balance = await psql(`
    select xp_balance_cached
    from public.profiles
    where id = ${literal(userId)}::uuid;
  `);

  return Number(balance);
}

try {
  await setupFixture();

  await completeLesson(concurrentUserId);
  const concurrentAttemptA = await startAttempt(concurrentUserId);
  const concurrentAttemptB = await startAttempt(concurrentUserId);

  const concurrentStatuses = await Promise.all([
    answerQuestion(concurrentUserId, concurrentAttemptA, questionAId, optionACorrectId),
    answerQuestion(concurrentUserId, concurrentAttemptB, questionBId, optionBCorrectId),
  ]);

  assert.deepEqual(
    concurrentStatuses.sort(),
    ["daily_cap_deferred", "earned"],
    "two concurrent correct answers should produce one award and one cap deferral",
  );
  assert.equal(await quizXpTotal(concurrentUserId), 10, "concurrent quiz XP must not exceed the daily cap.");
  assert.equal(await cachedBalance(concurrentUserId), 10, "cached balance must match capped quiz XP.");

  await completeLesson(sequentialUserId);
  const sequentialAttempt = await startAttempt(sequentialUserId);
  assert.equal(
    await answerQuestion(sequentialUserId, sequentialAttempt, questionAId, optionACorrectId),
    "earned",
    "first sequential answer should still earn XP",
  );
  assert.equal(
    await answerQuestion(sequentialUserId, sequentialAttempt, questionBId, optionBCorrectId),
    "earned",
    "second sequential answer should still earn XP",
  );
  assert.equal(await quizXpTotal(sequentialUserId), 20, "sequential quiz XP should remain unchanged.");
  assert.equal(await cachedBalance(sequentialUserId), 20, "sequential cached balance should match ledger.");

  await expectAnswerError(sequentialUserId, sequentialAttempt, questionAId, optionACorrectId);
  assert.equal(await quizXpTotal(sequentialUserId), 20, "duplicate answer submission must not double-credit XP.");

  const practiceAttempt = await startAttempt(sequentialUserId);
  assert.equal(
    await answerQuestion(sequentialUserId, practiceAttempt, questionAId, optionACorrectId),
    "practice",
    "retry attempt after all questions are awarded should remain non-earning practice",
  );
  assert.equal(await quizXpTotal(sequentialUserId), 20, "practice retry must not add quiz XP.");

  console.log("quiz XP concurrency regression passed");
} finally {
  await cleanup();
}
