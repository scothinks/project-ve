import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createLearningRepository } from "../../features/app/repositories/learning.ts";
import { getPublishedLearningCourseCards } from "../../features/learning/data/course-card-data.ts";
import { createMissionRepository } from "../../features/app/repositories/missions.ts";
import { createProgressRepository } from "../../features/app/repositories/progress.ts";
import { createRewardRepository } from "../../features/app/repositories/rewards.ts";

const localSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireLocalSupabaseEnv() {
  assert.equal(process.env.APP_MODE, "live");
  assert.ok(localSupabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required.");
  assert.ok(publishableKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required.");
}

test("live repositories use local Supabase data and do not serve demo snapshots", async () => {
  requireLocalSupabaseEnv();

  const adminSupabase = createClient(localSupabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
  const repositoryOperations = [];
  const supabase = createClient(localSupabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        repositoryOperations.push(String(input));
        return fetch(input, init);
      },
    },
  });
  const nonce = crypto.randomUUID();
  const email = `repository-${nonce}@example.test`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const { data: createdUser, error: createUserError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(createUserError, null);
  assert.ok(createdUser.user);
  const testLearnerUserId = createdUser.user.id;
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);

  try {
    const learningRepository = createLearningRepository(supabase, {
      getCourseCards: getPublishedLearningCourseCards,
    });
    const progressRepository = createProgressRepository(supabase);
    const rewardRepository = createRewardRepository(supabase);
    const missionRepository = createMissionRepository(supabase);
    const catalog = await learningRepository.getCatalog();

    assert.ok(catalog.length > 0, "local migrations should provide published courses.");

    const course = catalog[0];
    const lesson = course.lessons[0];
    const page = lesson.pages[0];

    assert.ok(lesson, "local published course should include a lesson.");
    assert.ok(page, "local published lesson should include a page.");

    await adminSupabase.from("lesson_page_completions").delete().eq("user_id", testLearnerUserId);
    await adminSupabase.from("lesson_progress").delete().eq("user_id", testLearnerUserId);

    const emptyProgress = await progressRepository.getLessonProgress(testLearnerUserId);
    assert.equal(emptyProgress.length, 0, "live progress repository must not fall back to demo progress.");

    const { error: completionError } = await adminSupabase.from("lesson_page_completions").insert({
      user_id: testLearnerUserId,
      lesson_id: lesson.id,
      page_id: page.id,
    });

    assert.equal(completionError, null);

    const [courseCards, courseDetail, lessonDetail, quizDetail, progress, rewards] =
      await Promise.all([
        learningRepository.getCourseCards(),
        learningRepository.getCourse(course.id),
        learningRepository.getLesson(lesson.id),
        learningRepository.getQuiz(lesson.quiz.id),
        progressRepository.getLessonProgress(testLearnerUserId),
        rewardRepository.getStoreSnapshot(testLearnerUserId, 0),
      ]);

    repositoryOperations.length = 0;
    const missions = await missionRepository.getSummaries({
      userId: testLearnerUserId,
      referralCode: null,
      origin: "http://127.0.0.1:3000",
    });

    assert.ok(courseCards[0].lessons[0].pages.length > 0);
    assert.equal("blocks" in courseCards[0].lessons[0].pages[0], false);
    assert.equal("options" in courseCards[0].lessons[0].quiz, false);
    assert.equal(courseDetail?.id, course.id);
    assert.equal(lessonDetail?.lesson.id, lesson.id);
    assert.equal(quizDetail?.quiz.id, lesson.quiz.id);
    assert.deepEqual(progress[0]?.completed_pages, [page.id]);
    assert.equal(rewards?.xpBalance, 0, "live rewards must use the supplied live XP balance, not demo XP.");
    assert.notEqual(rewards?.xpBalance, 45232);
    assert.ok(Array.isArray(missions));
    assert.equal(
      repositoryOperations.filter((url) => url.includes("/rpc/get_dashboard_mission_state")).length,
      1,
      "live mission summaries must evaluate all mission state in one RPC",
    );
    assert.equal(
      repositoryOperations.filter((url) => /mission_awards|mission_proofs|referral_attributions/.test(url)).length,
      0,
      "live mission summaries must not fan out to per-mission state tables",
    );
  } finally {
    await adminSupabase.auth.admin.deleteUser(testLearnerUserId);
  }
});
