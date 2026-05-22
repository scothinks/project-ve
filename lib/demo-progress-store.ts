import "server-only";
import {
  courses,
  getLesson,
  getPublicQuiz,
  getQuiz,
  isQuestionCorrect,
  type PublicQuizQuestion,
  type Quiz,
  type QuizQuestion,
} from "@/lib/lessons";
import {
  getMission,
  getMissionRewardLabel,
  missions,
  type Mission,
  type MissionProof,
  type MissionProofField,
  type MissionRepeatability,
  type UserMissionSummary,
  type UserMissionStatus,
} from "@/lib/missions";

export const DEMO_USER_ID = "demo-user";

export const xpEarningPolicy = {
  dailyEarnableXpLimit: 50,
  timezone: "Africa/Lagos",
  capBehavior: "block_quiz_until_reset",
} as const;

type AttemptEndReason =
  | "submitted"
  | "daily_cap_reached"
  | "practice_completed"
  | "abandoned";

type AttemptMode = "earning" | "practice";

type QuizAttemptSnapshot = {
  quizId: string;
  quizVersion: number;
  questions: QuizQuestion[];
  publicQuestions: PublicQuizQuestion[];
};

type DemoAttempt = {
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

type QuestionResult = {
  questionId: string;
  correct: boolean;
  earnedXp: number;
  status: "earned" | "missed" | "already_earned" | "daily_cap_deferred" | "practice";
};

type XpTransaction = {
  id: string;
  userId: string;
  amount: number;
  sourceType: "quiz_question" | "mission" | "reward_redemption" | "adjustment";
  sourceId: string;
  direction: "earn" | "spend";
  createdAt: string;
};

type ReferralAttribution = {
  id: string;
  referralCode: string;
  referrerUserId: string;
  referredUserId: string;
  createdAt: string;
};

type DemoProgressStore = {
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

type DemoMissionProgress = {
  progressCount: number;
  targetCount: number;
  valid: boolean;
  proofRequiredFields?: MissionProofField[];
  proofRequirementMode?: "all" | "any";
  proofFieldStatuses?: Partial<Record<MissionProofField, "pending" | "submitted" | "approved" | "rejected">>;
};

type StartQuizResult =
  | {
      status: "started";
      attemptId: string;
      mode: AttemptMode;
      questions: PublicQuizQuestion[];
      dailyXpLimit: number;
      dailyXpRemaining: number;
      totalPossibleXp: number;
    }
  | {
      status: "blocked";
      reason: "lesson_incomplete" | "cooldown" | "retry_disabled" | "daily_cap_reached";
      message: string;
      nextResetAt?: string;
      retryAvailableAt?: string;
    };

type AnswerQuestionResult =
  | {
      status: "answered";
      attemptId: string;
      questionResult: QuestionResult;
      earnedXpThisAttempt: number;
      dailyXpRemaining: number;
      completed: false;
    }
  | {
      status: "completed";
      result: QuizAttemptResult;
    }
  | {
      status: "daily_cap_reached";
      result: QuizAttemptResult;
      dailyXpLimit: number;
      earnedXpToday: number;
      nextResetAt: string;
      message: string;
    };

export type QuizAttemptResult = {
  status: "graded" | "daily_cap_reached" | "practice_completed";
  quizId: string;
  attemptId: string;
  earnedXp: number;
  totalPossibleXp: number;
  correctCount: number;
  wrongCount: number;
  questions: QuestionResult[];
  message?: string;
  nextResetAt?: string;
};

declare global {
  var __projectVeDemoStore: DemoProgressStore | undefined;
}

const seededMissionCompletedAt = "2026-05-12T08:00:00.000Z";

function getStore() {
  globalThis.__projectVeDemoStore ??= {
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

function key(...parts: string[]) {
  return parts.join(":");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeProofFieldList(value: readonly MissionProofField[]) {
  return value.length > 0 ? [...value] : (["text"] as MissionProofField[]);
}

function getUserDateParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: xpEarningPolicy.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    dateKey: `${year}-${month}-${day}`,
  };
}

function getUserDateKey(now = new Date()) {
  return getUserDateParts(now).dateKey;
}

function getUserWeekKey(now = new Date()) {
  const { year, month, day } = getUserDateParts(now);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() - dayOfWeek + 1);

  return localDate.toISOString().slice(0, 10);
}

function getNextWeeklyResetAt(now = new Date()) {
  const weekStart = new Date(`${getUserWeekKey(now)}T00:00:00+01:00`);
  return new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function getStartOfUserDay(now = new Date()) {
  const { dateKey } = getUserDateParts(now);

  return new Date(`${dateKey}T00:00:00+01:00`);
}

export function getNextDailyResetAt(now = new Date()) {
  const start = getStartOfUserDay(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function formatDailyResetAt(resetAtIso: string) {
  const resetAt = new Date(resetAtIso);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: xpEarningPolicy.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZoneName: "short",
  }).format(resetAt);
}

function buildDailyCapBlockedMessage(resetAtIso: string) {
  return `You have reached today's quiz XP limit. Quiz XP unlocks at ${formatDailyResetAt(resetAtIso)}.`;
}

function buildDailyCapSavedMessage(resetAtIso: string) {
  return `You have reached today's quiz XP limit. Your progress is saved. You can answer the remaining questions after ${formatDailyResetAt(resetAtIso)}.`;
}

export function getDailyEarnedXp(userId = DEMO_USER_ID) {
  const store = getStore();
  const start = getStartOfUserDay();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return store.xpTransactions.reduce((total, transaction) => {
    const createdAt = new Date(transaction.createdAt);
    const countsForToday =
      transaction.userId === userId &&
      transaction.direction === "earn" &&
      transaction.sourceType === "quiz_question" &&
      transaction.createdAt &&
      createdAt >= start &&
      createdAt < end;

    return countsForToday ? total + transaction.amount : total;
  }, 0);
}

export function getDailyXpRemaining(userId = DEMO_USER_ID) {
  return Math.max(0, xpEarningPolicy.dailyEarnableXpLimit - getDailyEarnedXp(userId));
}

export function markLessonPageCompleted(lessonId: string, pageId: string, userId = DEMO_USER_ID) {
  const store = getStore();
  store.pageCompletions[key(userId, lessonId, pageId)] = nowIso();
}

function getLastEndedAttempt(lessonId: string, userId = DEMO_USER_ID) {
  const store = getStore();
  return [...store.attempts]
    .reverse()
    .find((attempt) => attempt.userId === userId && attempt.lessonId === lessonId && attempt.endedAt);
}

function hasReadAllPagesAfter(lessonId: string, afterIso?: string, userId = DEMO_USER_ID) {
  const lesson = getLesson(lessonId);
  const after = afterIso ? new Date(afterIso) : null;
  return lesson.pages.every((page) => {
    const completedAt = getStore().pageCompletions[key(userId, lesson.id, page.id)];
    if (!completedAt) {
      return false;
    }
    return after ? new Date(completedAt) > after : true;
  });
}

function getAwardedQuestionIds(userId = DEMO_USER_ID) {
  const store = getStore();
  return new Set(
    Object.entries(store.awardedQuestionXp)
      .filter(([awardKey]) => awardKey.startsWith(`${userId}:`))
      .map(([awardKey]) => awardKey.split(":")[1]),
  );
}

function getUnawardedQuestions(quiz: Quiz, userId = DEMO_USER_ID) {
  const awardedQuestionIds = getAwardedQuestionIds(userId);
  return quiz.questions.filter((question) => !awardedQuestionIds.has(question.id));
}

function getQuestionsXp(questions: QuizQuestion[]) {
  return questions.reduce((total, question) => total + question.xp, 0);
}

function buildAttemptSnapshot(
  quiz: Quiz,
  seed: string,
  includedQuestions: QuizQuestion[] = quiz.questions,
): QuizAttemptSnapshot {
  const publicQuiz = getPublicQuiz(quiz, seed);
  const publicQuestionById = new Map(
    publicQuiz.questions.map((question) => [question.id, question]),
  );

  return {
    quizId: quiz.id,
    quizVersion: 1,
    questions: includedQuestions.map((question) => ({
      ...question,
      options: publicQuestionById.get(question.id)?.options ?? question.options,
    })),
    publicQuestions: includedQuestions.map((question) => {
      const publicQuestion = publicQuestionById.get(question.id);
      return publicQuestion
        ? publicQuestion
        : {
            ...question,
            options: question.options,
          };
    }),
  };
}

export function startQuizAttempt(
  lessonId: string,
  quizId: string,
  userId = DEMO_USER_ID,
): StartQuizResult {
  const lesson = getLesson(lessonId);
  const quiz = getQuiz(quizId);

  if (!quiz || quiz.lessonId !== lesson.id) {
    return {
      status: "blocked",
      reason: "lesson_incomplete",
      message: "We could not find this quiz for the selected lesson.",
    };
  }

  const lastEndedAttempt = getLastEndedAttempt(lesson.id, userId);
  const requiresFreshReread = Boolean(lastEndedAttempt?.endedAt && lesson.retryPolicy.requiresReread);
  if (
    lesson.quizAccess.requiresLessonCompletion &&
    !hasReadAllPagesAfter(
      lesson.id,
      requiresFreshReread ? lastEndedAttempt?.endedAt : undefined,
      userId,
    )
  ) {
    return {
      status: "blocked",
      reason: "lesson_incomplete",
      message:
        requiresFreshReread
          ? "Please reread the lesson pages before retrying this quiz."
          : "Complete the lesson pages before starting the quiz.",
    };
  }

  if (lesson.retryPolicy.mode === "disabled" && lastEndedAttempt) {
    return {
      status: "blocked",
      reason: "retry_disabled",
      message: "Retries are not available for this lesson.",
    };
  }

  if (lesson.retryPolicy.mode === "cooldown" && lastEndedAttempt?.endedAt) {
    const retryAvailableAt = addHours(
      new Date(lastEndedAttempt.endedAt),
      lesson.retryPolicy.cooldownHours ?? 24,
    );
    if (retryAvailableAt > new Date()) {
      return {
        status: "blocked",
        reason: "cooldown",
        message: "Your progress is saved. This quiz unlocks again after the retry window.",
        retryAvailableAt: retryAvailableAt.toISOString(),
      };
    }
  }

  const unawardedQuestions = getUnawardedQuestions(quiz, userId);
  const mode: AttemptMode = unawardedQuestions.length === 0 ? "practice" : "earning";
  const dailyXpRemaining = getDailyXpRemaining(userId);

  const hasQuestionThatFitsDailyLimit = unawardedQuestions.some(
    (question) => question.xp <= dailyXpRemaining,
  );

  if (mode === "earning" && (dailyXpRemaining <= 0 || !hasQuestionThatFitsDailyLimit)) {
    const nextResetAt = getNextDailyResetAt();
    return {
      status: "blocked",
      reason: "daily_cap_reached",
      message: buildDailyCapBlockedMessage(nextResetAt),
      nextResetAt,
    };
  }

  const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const snapshot = buildAttemptSnapshot(
    quiz,
    attemptId,
    mode === "earning" ? unawardedQuestions : quiz.questions,
  );
  const attempt: DemoAttempt = {
    id: attemptId,
    userId,
    lessonId: lesson.id,
    quizId: quiz.id,
    mode,
    snapshot,
    startedAt: nowIso(),
    answeredQuestionIds: [],
    questionResults: [],
  };

  getStore().attempts.push(attempt);

  return {
    status: "started",
    attemptId,
    mode,
    questions: snapshot.publicQuestions,
    dailyXpLimit: xpEarningPolicy.dailyEarnableXpLimit,
    dailyXpRemaining,
    totalPossibleXp: getQuestionsXp(snapshot.questions),
  };
}

export function answerQuizQuestion(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
  userId = DEMO_USER_ID,
): AnswerQuestionResult {
  const store = getStore();
  const attempt = store.attempts.find((item) => item.id === attemptId && item.userId === userId);

  if (!attempt || attempt.endedAt) {
    throw new Error("Attempt is not active.");
  }

  const question = attempt.snapshot.questions.find((item) => item.id === questionId);
  if (!question) {
    throw new Error("Question is not part of this attempt.");
  }

  if (attempt.answeredQuestionIds.includes(questionId)) {
    throw new Error("This question has already been answered.");
  }

  const validOptionIds = new Set(question.options.map((option) => option.id));
  const uniqueSelectedOptionIds = Array.from(new Set(selectedOptionIds));
  const hasInvalidOption = uniqueSelectedOptionIds.some((optionId) => !validOptionIds.has(optionId));

  if (hasInvalidOption) {
    throw new Error("One or more selected options do not belong to this question.");
  }

  const correct = isQuestionCorrect(question, uniqueSelectedOptionIds);
  const alreadyAwarded = Boolean(store.awardedQuestionXp[key(userId, question.id)]);
  const dailyXpRemaining = getDailyXpRemaining(userId);
  let earnedXp = 0;
  let status: QuestionResult["status"] = correct ? "earned" : "missed";
  let questionResultCorrectOverride: boolean | undefined;

  if (attempt.mode === "practice") {
    status = "practice";
  } else if (!correct) {
    status = "missed";
  } else if (alreadyAwarded) {
    status = "already_earned";
  } else if (dailyXpRemaining < question.xp) {
    status = "daily_cap_deferred";
    // Do not reveal whether the answer was correct when XP cannot be awarded today.
    // The question remains an earnable opportunity after reset.
    questionResultCorrectOverride = false;
  } else {
    earnedXp = question.xp;
    store.awardedQuestionXp[key(userId, question.id)] = nowIso();
    store.xpTransactions.push({
      id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      amount: earnedXp,
      sourceType: "quiz_question",
      sourceId: question.id,
      direction: "earn",
      createdAt: nowIso(),
    });
  }

  const questionResult: QuestionResult = {
    questionId,
    correct: questionResultCorrectOverride ?? correct,
    earnedXp,
    status,
  };

  attempt.answeredQuestionIds.push(questionId);
  attempt.questionResults.push(questionResult);

  const remainingAfterAnswer = getDailyXpRemaining(userId);
  const hitDailyCap =
    attempt.mode === "earning" &&
    (status === "daily_cap_deferred" || (correct && earnedXp > 0 && remainingAfterAnswer <= 0));
  const allAnswered = attempt.answeredQuestionIds.length === attempt.snapshot.questions.length;

  if (hitDailyCap) {
    return endAttempt(attempt, "daily_cap_reached");
  }

  if (allAnswered) {
    return endAttempt(attempt, attempt.mode === "practice" ? "practice_completed" : "submitted");
  }

  return {
    status: "answered",
    attemptId,
    questionResult,
    earnedXpThisAttempt: getAttemptEarnedXp(attempt),
    dailyXpRemaining: remainingAfterAnswer,
    completed: false,
  };
}

function endAttempt(attempt: DemoAttempt, reason: AttemptEndReason): AnswerQuestionResult {
  attempt.endedAt = nowIso();
  attempt.endedReason = reason;
  syncReferralProgressForUser(attempt.userId);

  const result = buildAttemptResult(attempt);

  if (reason === "daily_cap_reached") {
    const nextResetAt = getNextDailyResetAt();
    return {
      status: "daily_cap_reached",
      result,
      dailyXpLimit: xpEarningPolicy.dailyEarnableXpLimit,
      earnedXpToday: getDailyEarnedXp(attempt.userId),
      nextResetAt,
      message: buildDailyCapSavedMessage(nextResetAt),
    };
  }

  return {
    status: "completed",
    result,
  };
}

function getAttemptEarnedXp(attempt: DemoAttempt) {
  return attempt.questionResults.reduce((total, question) => total + question.earnedXp, 0);
}

function buildAttemptResult(attempt: DemoAttempt): QuizAttemptResult {
  const correctCount = attempt.questionResults.filter(
    (question) => question.status === "earned" || question.status === "already_earned",
  ).length;
  const unansweredResults = attempt.snapshot.questions
    .filter((question) => !attempt.answeredQuestionIds.includes(question.id))
    .map<QuestionResult>((question) => ({
      questionId: question.id,
      correct: false,
      earnedXp: 0,
      status: "missed",
    }));
  const questions = [...attempt.questionResults, ...unansweredResults];
  const status =
    attempt.endedReason === "daily_cap_reached"
      ? "daily_cap_reached"
      : attempt.endedReason === "practice_completed"
        ? "practice_completed"
        : "graded";

  return {
    status,
    quizId: attempt.quizId,
    attemptId: attempt.id,
    earnedXp: getAttemptEarnedXp(attempt),
    totalPossibleXp: attempt.snapshot.questions.reduce((total, question) => total + question.xp, 0),
    correctCount,
    wrongCount: attempt.snapshot.questions.length - correctCount,
    questions,
    message:
      status === "daily_cap_reached"
        ? buildDailyCapSavedMessage(getNextDailyResetAt())
        : undefined,
    nextResetAt: status === "daily_cap_reached" ? getNextDailyResetAt() : undefined,
  };
}

function isLessonCompleted(lessonId: string, userId = DEMO_USER_ID) {
  const lesson = getLesson(lessonId);
  const hasCompletedPages = hasReadAllPagesAfter(lesson.id, undefined, userId);
  const hasEndedAttempt = getStore().attempts.some(
    (attempt) =>
      attempt.userId === userId &&
      attempt.lessonId === lesson.id &&
      Boolean(attempt.endedAt) &&
      attempt.endedReason !== "abandoned",
  );

  return hasCompletedPages && hasEndedAttempt;
}

function getCompletedLessonIds(userId = DEMO_USER_ID) {
  return courses
    .flatMap((course) => course.lessons)
    .filter((lesson) => isLessonCompleted(lesson.id, userId))
    .map((lesson) => lesson.id);
}

function syncReferralProgressForUser(referredUserId: string) {
  const store = getStore();
  const attribution = store.referralAttributions[referredUserId];

  if (!attribution) {
    return;
  }

  store.referralLessonCompletions[key(attribution.referrerUserId, referredUserId)] =
    getCompletedLessonIds(referredUserId).length;
  syncReferralMissionRewards(attribution.referrerUserId);
}

function getCompletedLessonIdsWithinDays(days: number, userId = DEMO_USER_ID) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const completedLessonIds = new Set<string>();

  for (const attempt of getStore().attempts) {
    if (
      attempt.userId === userId &&
      attempt.endedAt &&
      new Date(attempt.endedAt) >= since &&
      isLessonCompleted(attempt.lessonId, userId)
    ) {
      completedLessonIds.add(attempt.lessonId);
    }
  }

  return [...completedLessonIds];
}

function getMissionPeriodScope(repeatability: MissionRepeatability, mission: Mission) {
  switch (repeatability) {
    case "daily":
      return `day:${getUserDateKey()}`;
    case "weekly":
      return `week:${getUserWeekKey()}`;
    case "campaign":
      return `campaign:${mission.startsAt ?? "open"}:${mission.endsAt ?? "open"}`;
    case "per_referral":
      return "referral";
    case "once":
      return "lifetime";
  }
}

function getMissionClaimKey(mission: Mission, userId = DEMO_USER_ID, scope?: string) {
  return key(userId, mission.id, scope ?? getMissionPeriodScope(mission.repeatability, mission));
}

function getMissionStateKey(mission: Mission, userId = DEMO_USER_ID) {
  return getMissionClaimKey(mission, userId);
}

function getLegacyMissionKey(mission: Mission, userId = DEMO_USER_ID) {
  return key(userId, mission.id);
}

function getReferralCode(userId = DEMO_USER_ID) {
  const store = getStore();
  const existingCode = Object.entries(store.referralCodes).find(
    ([, codeUserId]) => codeUserId === userId,
  )?.[0];

  if (existingCode) {
    return existingCode;
  }

  const code = `ve-${userId.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
  store.referralCodes[code] = userId;
  return code;
}

function getReferralShareUrl(
  origin = "http://localhost:3000",
  userId = DEMO_USER_ID,
  referralCode = getReferralCode(userId),
) {
  const baseUrl = origin.replace(/\/$/, "");
  return `${baseUrl}/invite/${encodeURIComponent(referralCode)}`;
}

function getDemoUserIdFromHint(userHint?: string) {
  const normalized = userHint?.trim().toLowerCase();

  if (!normalized) {
    return `referred-${Date.now().toString(36)}`;
  }

  return `user-${normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function registerReferralAttribution({
  referralCode,
  referredUserHint,
}: {
  referralCode: string;
  referredUserHint?: string;
}) {
  const store = getStore();
  const normalizedCode = referralCode.trim().toLowerCase();
  const referrerUserId = store.referralCodes[normalizedCode];

  if (!referrerUserId) {
    throw new Error("Referral link is not valid.");
  }

  const referredUserId = getDemoUserIdFromHint(referredUserHint);

  if (referredUserId === referrerUserId) {
    throw new Error("You cannot use your own referral link.");
  }

  const existingAttribution = store.referralAttributions[referredUserId];

  if (existingAttribution) {
    return {
      status: "already_attributed" as const,
      attribution: existingAttribution,
    };
  }

  const attribution: ReferralAttribution = {
    id: `referral-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    referralCode: normalizedCode,
    referrerUserId,
    referredUserId,
    createdAt: nowIso(),
  };

  store.referralAttributions[referredUserId] = attribution;
  store.referralLessonCompletions[key(referrerUserId, referredUserId)] ??= 0;

  return {
    status: "attributed" as const,
    attribution,
  };
}

function hasMissionClaim(mission: Mission, userId = DEMO_USER_ID, scope?: string) {
  const store = getStore();
  return Boolean(
    store.missionClaims[getMissionClaimKey(mission, userId, scope)] ||
      (mission.repeatability === "once" && store.missionClaims[getLegacyMissionKey(mission, userId)]),
  );
}

function hasAnyMissionClaim(mission: Mission, userId = DEMO_USER_ID) {
  const prefix = `${userId}:${mission.id}:`;
  const store = getStore();

  return (
    Boolean(store.missionClaims[getLegacyMissionKey(mission, userId)]) ||
    Object.keys(store.missionClaims).some((claimKey) => claimKey.startsWith(prefix))
  );
}

function getQualifiedReferralIds(
  requiredFriendLessonCount: number,
  userId = DEMO_USER_ID,
) {
  return Object.entries(getStore().referralLessonCompletions)
    .filter(
      ([referralKey, completedLessons]) =>
        referralKey.startsWith(`${userId}:`) &&
        completedLessons >= requiredFriendLessonCount,
    )
    .map(([referralKey]) => referralKey.slice(`${userId}:`.length));
}

function getReferralIds(userId = DEMO_USER_ID) {
  return Object.keys(getStore().referralLessonCompletions)
    .filter((referralKey) => referralKey.startsWith(`${userId}:`))
    .map((referralKey) => referralKey.slice(`${userId}:`.length));
}

function getUnclaimedReferralIds(mission: Mission, userId = DEMO_USER_ID) {
  if (mission.validation.type !== "referral_friend_completed_lessons") {
    return [];
  }

  return getQualifiedReferralIds(
    mission.validation.requiredFriendLessonCount,
    userId,
  ).filter((referralId) => !hasMissionClaim(mission, userId, `referral:${referralId}`));
}

function getClaimableMissionScope(mission: Mission, userId = DEMO_USER_ID) {
  if (mission.repeatability === "per_referral") {
    const [referralId] = getUnclaimedReferralIds(mission, userId);
    return referralId ? `referral:${referralId}` : null;
  }

  const scope = getMissionPeriodScope(mission.repeatability, mission);
  return hasMissionClaim(mission, userId, scope) ? null : scope;
}

function getMissionAvailableAgainAt(mission: Mission) {
  switch (mission.repeatability) {
    case "daily":
      return getNextDailyResetAt();
    case "weekly":
      return getNextWeeklyResetAt();
    default:
      return undefined;
  }
}

function getMissionCompletionLabel(mission: Mission) {
  switch (mission.repeatability) {
    case "daily":
      return "Completed today";
    case "weekly":
      return "Completed this week";
    case "campaign":
      return "Completed for campaign";
    case "once":
      return "Completed";
    case "per_referral":
      return "Awarded";
  }
}

function normalizeMissionProgress(
  progress: { progressCount: number; targetCount: number; valid: boolean },
  forceComplete = false,
) {
  const targetCount = Math.max(1, Math.floor(progress.targetCount));
  const rawProgressCount = forceComplete ? targetCount : progress.progressCount;
  const progressCount = Math.min(
    targetCount,
    Math.max(0, Math.floor(rawProgressCount)),
  );

  return {
    progressCount,
    targetCount,
    valid: progress.valid && progressCount >= targetCount,
  };
}

function awardMissionXp(mission: Mission, userId: string, claimScope: string) {
  const store = getStore();
  const missionClaimKey = getMissionClaimKey(mission, userId, claimScope);
  const rewardXp = Math.max(1, Number(mission.rewardXp ?? 1));

  if (store.missionClaims[missionClaimKey]) {
    return null;
  }

  const claimedAt = nowIso();
  store.missionClaims[missionClaimKey] = claimedAt;
  store.xpTransactions.push({
    id: `xp-mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    amount: rewardXp,
    sourceType: "mission",
    sourceId: mission.id,
    direction: "earn",
    createdAt: claimedAt,
  });

  return {
    status: "claimed" as const,
    missionId: mission.id,
    claimScope,
    awardedXp: rewardXp,
    bypassesDailyCap: true,
  };
}

function syncReferralMissionRewards(userId = DEMO_USER_ID) {
  const awards = [];

  for (const mission of missions) {
    if (
      mission.repeatability !== "per_referral" ||
      mission.validation.type !== "referral_friend_completed_lessons"
    ) {
      continue;
    }

    for (const referralId of getUnclaimedReferralIds(mission, userId)) {
      const award = awardMissionXp(mission, userId, `referral:${referralId}`);
      if (award) {
        awards.push(award);
      }
    }
  }

  return awards;
}

function syncAutoMissionRewards(userId = DEMO_USER_ID) {
  const awards = [...syncReferralMissionRewards(userId)];

  for (const mission of missions) {
    if (mission.repeatability === "per_referral") {
      continue;
    }

    const claimScope = getClaimableMissionScope(mission, userId);
    if (!claimScope) {
      continue;
    }

    if (getMissionProgress(mission, userId).valid) {
      const award = awardMissionXp(mission, userId, claimScope);
      if (award) {
        awards.push(award);
      }
    }
  }

  return awards;
}

function getReferralMissionSummary(
  mission: Mission,
  origin?: string,
  userId = DEMO_USER_ID,
  referralCode?: string | null,
) {
  if (mission.validation.type !== "referral_friend_completed_lessons") {
    return undefined;
  }

  const requiredFriendLessonCount = Math.max(
    1,
    mission.validation.requiredFriendLessonCount,
  );
  const invitedReferralIds = getReferralIds(userId);
  const qualifiedReferralIds = getQualifiedReferralIds(
    requiredFriendLessonCount,
    userId,
  );
  const awardedCount = qualifiedReferralIds.filter((referralId) =>
    hasMissionClaim(mission, userId, `referral:${referralId}`),
  ).length;

  const code = referralCode ?? getReferralCode(userId);

  return {
    code,
    shareUrl: getReferralShareUrl(origin, userId, code),
    requiredFriendLessonCount,
    invitedCount: invitedReferralIds.length,
    qualifiedCount: qualifiedReferralIds.length,
    awardedCount,
  };
}

function getMissionProgress(mission: Mission, userId = DEMO_USER_ID): DemoMissionProgress {
  const store = getStore();
  const validation = mission.validation;

  switch (validation.type) {
    case "course_completed": {
      const course = courses.find((item) => item.id === validation.courseId);
      if (!course) {
        return { progressCount: 0, targetCount: 1, valid: false };
      }

      const completedCount = course.lessons.filter((lesson) =>
        isLessonCompleted(lesson.id, userId),
      ).length;

      return {
        progressCount: completedCount,
        targetCount: course.lessons.length,
        valid: course.lessons.length > 0 && completedCount >= course.lessons.length,
      };
    }

    case "lesson_completed": {
      const valid = isLessonCompleted(validation.lessonId, userId);
      return { progressCount: valid ? 1 : 0, targetCount: 1, valid };
    }

    case "lesson_count_completed": {
      const completedLessonIds = validation.withinDays
        ? getCompletedLessonIdsWithinDays(validation.withinDays, userId)
        : getCompletedLessonIds(userId);
      const requiredCount = Math.max(1, validation.count);
      return {
        progressCount: completedLessonIds.length,
        targetCount: requiredCount,
        valid: completedLessonIds.length >= requiredCount,
      };
    }

    case "referral_friend_completed_lessons": {
      const requiredLessonCount = Math.max(1, validation.requiredFriendLessonCount);
      const qualifiedFriends = getQualifiedReferralIds(
        requiredLessonCount,
        userId,
      ).length;
      return {
        progressCount: qualifiedFriends,
        targetCount: 1,
        valid: qualifiedFriends > 0,
      };
    }

    case "proof_upload": {
      const proofKey = getMissionStateKey(mission, userId);
      const proofs = store.missionProofs[proofKey] ?? [];
      const proofTypes = new Set(proofs.map((proof) => proof.type));
      const approvedProofTypes = store.missionReviewStatuses[proofKey] === "approved"
        ? new Set(proofs.map((proof) => proof.type))
        : new Set<MissionProofField>();
      const requiredFields = normalizeProofFieldList(validation.requiredFields);
      const requirementMode = validation.requirementMode === "any" ? "any" : "all";
      const hasRequiredProof = requirementMode === "any"
        ? requiredFields.some((field) => proofTypes.has(field))
        : requiredFields.every((field) => proofTypes.has(field));
      const hasApprovedRequiredProof = requirementMode === "any"
        ? requiredFields.some((field) => approvedProofTypes.has(field))
        : requiredFields.every((field) => approvedProofTypes.has(field));
      const reviewStatus = store.missionReviewStatuses[proofKey];
      const proofFieldStatuses = Object.fromEntries(
        requiredFields.map((field) => [
          field,
          reviewStatus === "rejected"
            ? "rejected"
            : reviewStatus === "approved" && proofTypes.has(field)
              ? "approved"
              : proofTypes.has(field)
                ? "submitted"
                : "pending",
        ]),
      ) as Partial<Record<MissionProofField, "pending" | "submitted" | "approved" | "rejected">>;

      return {
        progressCount: requirementMode === "any"
          ? hasRequiredProof
            ? 1
            : 0
          : requiredFields.filter((field) => proofTypes.has(field)).length,
        targetCount: requirementMode === "any" ? 1 : requiredFields.length,
        valid: validation.requiresManualReview
          ? hasApprovedRequiredProof
          : validation.requiredFields.length > 0 && hasRequiredProof,
        proofRequiredFields: requiredFields,
        proofRequirementMode: requirementMode,
        proofFieldStatuses,
      };
    }

    case "manual_review": {
      const reviewStatus = store.missionReviewStatuses[getMissionStateKey(mission, userId)];
      return {
        progressCount: reviewStatus === "approved" ? 1 : 0,
        targetCount: 1,
        valid: reviewStatus === "approved",
      };
    }
  }
}

function getMissionStatus(mission: Mission, userId = DEMO_USER_ID): UserMissionStatus {
  const store = getStore();
  const missionKey = getMissionStateKey(mission, userId);

  if (mission.repeatability === "per_referral") {
    return getReferralIds(userId).length > 0 || hasAnyMissionClaim(mission, userId)
      ? "in_progress"
      : "not_started";
  }

  if (hasMissionClaim(mission, userId)) {
    return "completed";
  }

  const progress = getMissionProgress(mission, userId);
  const reviewStatus = store.missionReviewStatuses[missionKey];

  if (reviewStatus === "rejected") {
    return "rejected";
  }

  if (reviewStatus === "submitted") {
    return "under_review";
  }

  if (reviewStatus === "approved") {
    return "completed";
  }

  if (progress.valid) {
    return "completed";
  }

  return progress.progressCount > 0 ? "in_progress" : "not_started";
}

export function getMissionSummaries(
  userId = DEMO_USER_ID,
  origin?: string,
  referralCode?: string | null,
): UserMissionSummary[] {
  syncAutoMissionRewards(userId);

  return missions.map((mission) => {
    const rawProgress = getMissionProgress(mission, userId);
    const status = getMissionStatus(mission, userId);
    const isCompleted = status === "completed";
    const progress = normalizeMissionProgress(rawProgress, isCompleted);
    const autoAwards = true;

    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      category: mission.category,
      rewardType: mission.rewardType ?? "xp",
      rewardXp: mission.rewardXp,
      rewardId: mission.rewardId,
      rewardTitle: mission.rewardTitle,
      rewardFulfillmentType: mission.rewardFulfillmentType,
      repeatability: mission.repeatability,
      status,
      progressCount: progress.progressCount,
      targetCount: progress.targetCount,
      validationType: mission.validation.type,
      requiresProof:
        mission.validation.type === "proof_upload" || mission.validation.type === "manual_review",
      proofRequirementMode:
        mission.validation.type === "proof_upload" ? rawProgress.proofRequirementMode : undefined,
      proofRequiredFields:
        mission.validation.type === "proof_upload" ? rawProgress.proofRequiredFields : undefined,
      proofFieldStatuses:
        mission.validation.type === "proof_upload" ? rawProgress.proofFieldStatuses : undefined,
      bypassesDailyCap: true,
      autoAwards,
      completionLabel: isCompleted ? getMissionCompletionLabel(mission) : undefined,
      availableAgainAt: isCompleted ? getMissionAvailableAgainAt(mission) : undefined,
      referral: getReferralMissionSummary(mission, origin, userId, referralCode),
    };
  });
}

export function claimMissionReward(missionId: string, userId = DEMO_USER_ID) {
  const mission = getMission(missionId);

  if (!mission) {
    throw new Error("Mission not found.");
  }

  syncAutoMissionRewards(userId);
  throw new Error("Mission rewards are awarded automatically when completed.");
}

export function submitMissionProof(
  missionId: string,
  proof: Array<{ type: MissionProof["type"]; value: string }>,
  userId = DEMO_USER_ID,
) {
  const mission = getMission(missionId);
  const store = getStore();

  if (!mission) {
    throw new Error("Mission not found.");
  }

  if (mission.validation.type !== "proof_upload") {
    throw new Error("This mission does not accept proof uploads.");
  }

  const requiredFields = normalizeProofFieldList(mission.validation.requiredFields);
  const allowedFieldSet = new Set(requiredFields);
  const validProof = proof.filter(
    (item) => allowedFieldSet.has(item.type) && item.value.trim().length > 0,
  );

  if (validProof.length === 0) {
    throw new Error("Proof is incomplete.");
  }

  const missionKey = getMissionStateKey(mission, userId);
  const existingProofs = store.missionProofs[missionKey] ?? [];
  store.missionProofs[missionKey] = [
    ...existingProofs.filter(
      (existing) => !validProof.some((item) => item.type === existing.type),
    ),
    ...validProof.map((item) => ({
      id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: item.type,
      value: item.value,
      uploadedAt: nowIso(),
    })),
  ];

  const proofProgress = getMissionProgress(mission, userId);

  if (!proofProgress.valid && !mission.validation.requiresManualReview) {
    throw new Error("Required proof is incomplete.");
  }

  store.missionReviewStatuses[missionKey] = mission.validation.requiresManualReview
    ? "submitted"
    : "approved";
  syncAutoMissionRewards(userId);

  return {
    status: store.missionReviewStatuses[missionKey],
    missionId: mission.id,
    message: mission.validation.requiresManualReview
      ? `Proof submitted. We will review it before awarding ${getMissionRewardLabel(mission)}.`
      : `Proof received. ${getMissionRewardLabel(mission)} has been awarded.`,
  };
}
