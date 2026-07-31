import type { PublicQuizQuestion, QuizQuestion } from "../../../lib/lessons.ts";
import type { MissionProof } from "../../../lib/missions.ts";

export const DEMO_USER_ID = "demo-user";

export type AttemptEndReason =
  | "submitted"
  | "daily_cap_reached"
  | "practice_completed"
  | "abandoned";

export type AttemptMode = "earning" | "practice";

export type QuizAttemptSnapshot = {
  quizId: string;
  quizVersion: number;
  questions: QuizQuestion[];
  publicQuestions: PublicQuizQuestion[];
};

export type DemoAttempt = {
  id: string;
  userId: string;
  lessonId: string;
  quizId: string;
  mode: AttemptMode;
  snapshot: QuizAttemptSnapshot;
  startedAt: string;
  endedAt?: string;
  endedReason?: AttemptEndReason;
  answeredQuestionIds: string[];
  questionResults: QuestionResult[];
};

export type QuestionResult = {
  questionId: string;
  correct: boolean;
  earnedXp: number;
  status: "earned" | "missed" | "already_earned" | "daily_cap_deferred" | "practice";
};

export type XpTransaction = {
  id: string;
  userId: string;
  amount: number;
  sourceType: "quiz_question" | "mission" | "reward_redemption" | "adjustment";
  sourceId: string;
  direction: "earn" | "spend";
  createdAt: string;
};

export type ReferralAttribution = {
  id: string;
  referralCode: string;
  referrerUserId: string;
  referredUserId: string;
  createdAt: string;
};

export type DemoProgressStore = {
  pageCompletions: Record<string, string>;
  attempts: DemoAttempt[];
  awardedQuestionXp: Record<string, string>;
  xpTransactions: XpTransaction[];
  missionProofs: Record<string, MissionProof[]>;
  missionClaims: Record<string, string>;
  missionReviewStatuses: Record<string, "submitted" | "approved" | "rejected">;
  referralLessonCompletions: Record<string, number>;
  referralCodes: Record<string, string>;
  referralAttributions: Record<string, ReferralAttribution>;
};

declare global {
  var __projectVeDemoStore: DemoProgressStore | undefined;
}

const seededMissionCompletedAt = "2026-05-12T08:00:00.000Z";

export function createDemoProgressStore(): DemoProgressStore {
  return {
    pageCompletions: {},
    attempts: [],
    awardedQuestionXp: {},
    xpTransactions: [
      {
        id: "xp-seed-mission-starter-budget",
        userId: DEMO_USER_ID,
        amount: 25,
        sourceType: "mission",
        sourceId: "mission-complete-starter-budget",
        direction: "earn",
        createdAt: seededMissionCompletedAt,
      },
    ],
    missionProofs: {},
    missionClaims: {
      [`${DEMO_USER_ID}:mission-complete-starter-budget:lifetime`]: seededMissionCompletedAt,
    },
    missionReviewStatuses: {},
    referralLessonCompletions: {
      "demo-user:friend-ife": 1,
    },
    referralCodes: {
      "ve-demouser": "demo-user",
    },
    referralAttributions: {},
  };
}

export function getStore() {
  globalThis.__projectVeDemoStore ??= createDemoProgressStore();

  globalThis.__projectVeDemoStore.missionProofs ??= {};
  globalThis.__projectVeDemoStore.missionClaims ??= {};
  globalThis.__projectVeDemoStore.missionReviewStatuses ??= {};
  globalThis.__projectVeDemoStore.referralLessonCompletions ??= {
    "demo-user:friend-ife": 1,
  };
  globalThis.__projectVeDemoStore.referralCodes ??= {
    "ve-demouser": "demo-user",
  };
  globalThis.__projectVeDemoStore.referralAttributions ??= {};

  return globalThis.__projectVeDemoStore;
}

export function key(...parts: string[]) {
  return parts.join(":");
}

export function nowIso() {
  return new Date().toISOString();
}
