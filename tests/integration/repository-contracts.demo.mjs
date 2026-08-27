import assert from "node:assert/strict";
import test from "node:test";
import { createLearningRepository } from "../../features/app/repositories/learning.ts";
import { createMissionRepository } from "../../features/app/repositories/missions.ts";
import { createProgressRepository } from "../../features/app/repositories/progress.ts";
import { createRewardRepository } from "../../features/app/repositories/rewards.ts";
import {
  createDemoProgressStore,
  DEMO_USER_ID,
  getStore,
} from "../../features/progress/demo/store.ts";
import {
  markLessonPageCompleted,
} from "../../lib/demo-progress-store.ts";
import { courses } from "../../lib/lessons.ts";
import { missions } from "../../lib/missions.ts";

test("demo repositories work without a Supabase client", async () => {
  globalThis.__projectVeDemoStore = createDemoProgressStore();

  const learningRepository = createLearningRepository(null);
  const progressRepository = createProgressRepository(null);
  const rewardRepository = createRewardRepository(null);
  const missionRepository = createMissionRepository(null);
  const lesson = courses[0].lessons[0];
  const page = lesson.pages[0];

  markLessonPageCompleted(lesson.id, page.id, DEMO_USER_ID);

  const [catalog, summaries, course, lessonDetail, quizDetail, progress, rewards, missions] =
    await Promise.all([
      learningRepository.getCatalog(),
      learningRepository.getCourseSummaries(),
      learningRepository.getCourse(courses[0].id),
      learningRepository.getLesson(lesson.id),
      learningRepository.getQuiz(lesson.quiz.id),
      progressRepository.getLessonProgress(DEMO_USER_ID),
      rewardRepository.getStoreSnapshot(DEMO_USER_ID, 0),
      missionRepository.getSummaries({
        userId: DEMO_USER_ID,
        referralCode: null,
        origin: "http://localhost:3000",
      }),
    ]);

  assert.equal(catalog.length, courses.length);
  assert.equal(summaries[0].lessons[0].pages.length, 0);
  assert.equal(course?.id, courses[0].id);
  assert.equal(lessonDetail?.lesson.id, lesson.id);
  assert.equal(quizDetail?.quiz.id, lesson.quiz.id);
  assert.ok(progress.some((record) => record.lesson_id === lesson.id && record.completed_pages.includes(page.id)));
  assert.equal(rewards?.xpBalance, 45232);
  assert.ok(missions.length > 0);
  assert.ok(Object.keys(getStore().pageCompletions).length > 0);
});

test("demo mission repository forwards reward fulfillment config", async () => {
  globalThis.__projectVeDemoStore = createDemoProgressStore();

  const mission = {
    id: "mission-demo-boost-regression",
    title: "Demo Boost Regression",
    description: "Regression fixture for demo mission reward config.",
    category: "campaign",
    rewardType: "reward",
    rewardId: "reward-demo-boost-regression",
    rewardTitle: "2x XP Boost",
    rewardFulfillmentType: "native",
    rewardFulfillmentConfig: {
      effect: "xp_boost",
      multiplier: 2,
      durationHours: 1,
      uses: 3,
    },
    repeatability: "once",
    validation: {
      type: "manual_review",
      instructions: "Review the demo boost mission.",
    },
  };

  missions.push(mission);

  try {
    const missionRepository = createMissionRepository(null);
    const summaries = await missionRepository.getSummaries({
      userId: DEMO_USER_ID,
      referralCode: null,
      origin: "http://localhost:3000",
    });
    const summary = summaries.find((item) => item.id === mission.id);

    assert.equal(summary?.rewardFulfillmentType, "native");
    assert.deepEqual(summary?.rewardFulfillmentConfig, mission.rewardFulfillmentConfig);
  } finally {
    const missionIndex = missions.findIndex((item) => item.id === mission.id);
    if (missionIndex >= 0) {
      missions.splice(missionIndex, 1);
    }
  }
});
