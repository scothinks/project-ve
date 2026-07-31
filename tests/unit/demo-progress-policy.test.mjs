import assert from "node:assert/strict";
import test from "node:test";
import {
  createDemoProgressStore,
  DEMO_USER_ID,
  getStore,
  key,
} from "../../features/progress/demo/store.ts";
import {
  buildDailyCapBlockedMessage,
  getDailyEarnedXp,
  getDailyXpRemaining,
  getNextDailyResetAt,
  getUserDateKey,
  getUserWeekKey,
  xpEarningPolicy,
} from "../../features/progress/demo/xp-policy.ts";
import {
  getLegacyMissionKey,
  getMissionClaimKey,
  getMissionCompletionLabel,
  getMissionPeriodScope,
  normalizeMissionProgress,
  normalizeProofFieldList,
} from "../../features/progress/demo/mission-policy.ts";

function resetDemoStore() {
  globalThis.__projectVeDemoStore = createDemoProgressStore();
  return getStore();
}

function mission(overrides = {}) {
  return {
    id: "mission-1",
    title: "Mission",
    description: "Mission description",
    category: "learning",
    rewardType: "xp",
    rewardXp: 10,
    repeatability: "once",
    validation: { type: "lesson_completed", lessonId: "lesson-1" },
    ...overrides,
  };
}

test("demo store bootstrap preserves seeded mission and referral defaults", () => {
  const store = resetDemoStore();

  assert.equal(store.xpTransactions[0].id, "xp-seed-mission-starter-budget");
  assert.equal(store.missionClaims[`${DEMO_USER_ID}:mission-complete-starter-budget:lifetime`], "2026-05-12T08:00:00.000Z");
  assert.equal(store.referralCodes["ve-demouser"], DEMO_USER_ID);
  assert.equal(key("one", "two", "three"), "one:two:three");
});

test("daily XP policy counts only same-day quiz earn transactions", () => {
  const store = resetDemoStore();
  store.xpTransactions.push(
    {
      id: "quiz-today",
      userId: DEMO_USER_ID,
      amount: 20,
      sourceType: "quiz_question",
      sourceId: "question-1",
      direction: "earn",
      createdAt: "2026-07-31T08:00:00.000Z",
    },
    {
      id: "mission-today",
      userId: DEMO_USER_ID,
      amount: 25,
      sourceType: "mission",
      sourceId: "mission-2",
      direction: "earn",
      createdAt: "2026-07-31T09:00:00.000Z",
    },
    {
      id: "quiz-yesterday",
      userId: DEMO_USER_ID,
      amount: 10,
      sourceType: "quiz_question",
      sourceId: "question-2",
      direction: "earn",
      createdAt: "2026-07-30T08:00:00.000Z",
    },
  );

  const now = new Date("2026-07-31T12:00:00.000Z");
  assert.equal(getDailyEarnedXp(DEMO_USER_ID, now), 20);
  assert.equal(getDailyXpRemaining(DEMO_USER_ID, now), xpEarningPolicy.dailyEarnableXpLimit - 20);
});

test("daily and weekly reset helpers use the configured learner timezone", () => {
  const now = new Date("2026-07-31T22:30:00.000Z");

  assert.equal(getUserDateKey(now), "2026-07-31");
  assert.equal(getUserWeekKey(now), "2026-07-27");
  assert.equal(getNextDailyResetAt(now), "2026-07-31T23:00:00.000Z");
  assert.match(
    buildDailyCapBlockedMessage("2026-07-31T23:00:00.000Z"),
    /You have reached today's quiz XP limit\. Quiz XP unlocks at/,
  );
});

test("mission policy helpers derive scopes, claim keys, labels, and proof defaults", () => {
  assert.equal(getMissionPeriodScope("once", mission()), "lifetime");
  assert.equal(
    getMissionPeriodScope(
      "campaign",
      mission({ repeatability: "campaign", startsAt: "2026-07-01", endsAt: "2026-07-31" }),
    ),
    "campaign:2026-07-01:2026-07-31",
  );
  assert.equal(getMissionClaimKey(mission(), "user-1"), "user-1:mission-1:lifetime");
  assert.equal(getLegacyMissionKey(mission(), "user-1"), "user-1:mission-1");
  assert.equal(getMissionCompletionLabel(mission({ repeatability: "weekly" })), "Completed this week");
  assert.deepEqual(normalizeProofFieldList([]), ["text"]);
});

test("mission progress normalization clamps counts and can force completed progress", () => {
  assert.deepEqual(
    normalizeMissionProgress({ progressCount: -2, targetCount: 0, valid: true }),
    { progressCount: 0, targetCount: 1, valid: false },
  );
  assert.deepEqual(
    normalizeMissionProgress({ progressCount: 1, targetCount: 3, valid: true }, true),
    { progressCount: 3, targetCount: 3, valid: true },
  );
});
