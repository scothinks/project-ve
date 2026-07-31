import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createLearningRepository } from "../../features/app/repositories/learning.ts";
import { createMissionRepository } from "../../features/app/repositories/missions.ts";
import { createProgressRepository } from "../../features/app/repositories/progress.ts";
import { createRewardRepository } from "../../features/app/repositories/rewards.ts";

const localSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testLearnerUserId =
  process.env.TEST_LEARNER_USER_ID ?? "5a28de43-2bb3-46f0-8566-9fcc07dbf042";

function requireLocalSupabaseEnv() {
  assert.equal(process.env.APP_MODE, "live");
  assert.ok(localSupabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required.");
  assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required.");
}

test("live repositories use local Supabase data and do not serve demo snapshots", async () => {
  requireLocalSupabaseEnv();

  const supabase = createClient(localSupabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  try {
    const learningRepository = createLearningRepository(supabase);
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

    await supabase.from("lesson_page_completions").delete().eq("user_id", testLearnerUserId);
    await supabase.from("lesson_progress").delete().eq("user_id", testLearnerUserId);

    const emptyProgress = await progressRepository.getLessonProgress(testLearnerUserId);
    assert.equal(emptyProgress.length, 0, "live progress repository must not fall back to demo progress.");

    const { error: completionError } = await supabase.from("lesson_page_completions").insert({
      user_id: testLearnerUserId,
      lesson_id: lesson.id,
      page_id: page.id,
    });

    assert.equal(completionError, null);

    const [summaries, courseDetail, lessonDetail, quizDetail, progress, rewards, missions] =
      await Promise.all([
        learningRepository.getCourseSummaries(),
        learningRepository.getCourse(course.id),
        learningRepository.getLesson(lesson.id),
        learningRepository.getQuiz(lesson.quiz.id),
        progressRepository.getLessonProgress(testLearnerUserId),
        rewardRepository.getStoreSnapshot(testLearnerUserId, 0),
        missionRepository.getSummaries({
          userId: testLearnerUserId,
          referralCode: null,
          origin: "http://127.0.0.1:3000",
        }),
      ]);

    assert.equal(summaries[0].lessons[0].pages.length, 0);
    assert.equal(courseDetail?.id, course.id);
    assert.equal(lessonDetail?.lesson.id, lesson.id);
    assert.equal(quizDetail?.quiz.id, lesson.quiz.id);
    assert.deepEqual(progress[0]?.completed_pages, [page.id]);
    assert.equal(rewards?.xpBalance, 0, "live rewards must use the supplied live XP balance, not demo XP.");
    assert.notEqual(rewards?.xpBalance, 45232);
    assert.ok(Array.isArray(missions));
  } finally {
    await supabase.from("lesson_page_completions").delete().eq("user_id", testLearnerUserId);
    await supabase.from("lesson_progress").delete().eq("user_id", testLearnerUserId);
  }
});
