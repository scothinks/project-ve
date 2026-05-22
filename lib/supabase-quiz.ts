import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPublicQuiz,
  type PublicQuizQuestion,
  type QuizQuestion,
} from "@/lib/lessons";
import { getLearningLesson } from "@/lib/supabase-learning";
import { getEffectiveDailyQuizXpLimit, xpTimezone } from "@/lib/xp-settings";

type QuestionResult = {
  questionId: string;
  correct: boolean;
  earnedXp: number;
  status: "earned" | "missed" | "already_earned" | "daily_cap_deferred" | "practice";
};

type AttemptMode = "earning" | "practice";

export type SupabaseQuizAttemptResult = {
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
      result: SupabaseQuizAttemptResult;
    }
  | {
      status: "daily_cap_reached";
      result: SupabaseQuizAttemptResult;
      dailyXpLimit: number;
      earnedXpToday: number;
      nextResetAt: string;
      message: string;
    };

type AnswerRpcResponse = {
  status: QuestionResult["status"];
  completed: boolean;
  attemptStatus: "in_progress" | "graded" | "daily_cap_reached" | "practice_completed";
  questionResult: QuestionResult;
  dailyXpLimit: number;
  dailyXpRemaining: number;
  nextResetAt: string;
};

function getStartOfUserDay(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: xpTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);

  return new Date(`${year}-${month}-${day}T00:00:00+01:00`);
}

function getNextDailyResetAt(now = new Date()) {
  const start = getStartOfUserDay(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function formatDailyResetAt(resetAtIso: string) {
  const resetAt = new Date(resetAtIso);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: xpTimezone,
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

async function getDailyEarnedXp(supabase: SupabaseClient, userId: string) {
  const start = getStartOfUserDay();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("xp_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("direction", "earn")
    .eq("source_type", "quiz_question")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((total, transaction) => total + Number(transaction.amount), 0);
}

async function getLastEndedAttempt(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
) {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("ended_at, status")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ ended_at: string; status: string }>();

  if (error) {
    throw error;
  }

  return data;
}

async function hasReadAllPagesAfter(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  pageIds: string[],
  afterIso?: string | null,
) {
  const { data, error } = await supabase
    .from("lesson_page_completions")
    .select("page_id, completed_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId);

  if (error) {
    throw error;
  }

  const completedAtByPageId = new Map(
    (data ?? []).map((completion) => [
      String(completion.page_id),
      String(completion.completed_at),
    ]),
  );
  const after = afterIso ? new Date(afterIso) : null;

  return pageIds.every((pageId) => {
    const completedAt = completedAtByPageId.get(pageId);
    if (!completedAt) {
      return false;
    }

    return after ? new Date(completedAt) > after : true;
  });
}

async function getAwardedQuestionIds(
  supabase: SupabaseClient,
  userId: string,
  questionIds: string[],
) {
  if (questionIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("xp_transactions")
    .select("source_id")
    .eq("user_id", userId)
    .eq("direction", "earn")
    .eq("source_type", "quiz_question")
    .in("source_id", questionIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((transaction) => String(transaction.source_id)));
}

function getQuestionsXp(questions: QuizQuestion[]) {
  return questions.reduce((total, question) => total + question.xp, 0);
}

export async function startSupabaseQuizAttempt({
  supabase,
  userId,
  lessonId,
  quizId,
}: {
  supabase: SupabaseClient;
  userId: string;
  lessonId: string;
  quizId: string;
}): Promise<StartQuizResult> {
  const detail = await getLearningLesson(supabase, lessonId);
  const lesson = detail?.lesson;
  const quiz = lesson?.quiz;

  if (!lesson || !quiz || quiz.id !== quizId || quiz.lessonId !== lesson.id) {
    return {
      status: "blocked",
      reason: "lesson_incomplete",
      message: "We could not find this quiz for the selected lesson.",
    };
  }

  const lastEndedAttempt = await getLastEndedAttempt(supabase, userId, lesson.id);
  const requiresFreshReread = Boolean(lastEndedAttempt?.ended_at && lesson.retryPolicy.requiresReread);
  const hasCompletedPages = await hasReadAllPagesAfter(
    supabase,
    userId,
    lesson.id,
    lesson.pages.map((page) => page.id),
    requiresFreshReread ? lastEndedAttempt?.ended_at : undefined,
  );

  if (lesson.quizAccess.requiresLessonCompletion && !hasCompletedPages) {
    return {
      status: "blocked",
      reason: "lesson_incomplete",
      message: requiresFreshReread
        ? "Please reread the lesson pages before retrying this quiz."
        : "Complete the lesson pages before starting the quiz.",
    };
  }

  if (lesson.retryPolicy.mode === "disabled" && lastEndedAttempt) {
    return {
      status: "blocked",
      reason: "retry_disabled",
      message: "This lesson quiz can only be completed once.",
    };
  }

  if (lesson.retryPolicy.mode === "cooldown" && lastEndedAttempt?.ended_at) {
    const retryAvailableAt = new Date(
      new Date(lastEndedAttempt.ended_at).getTime() +
        (lesson.retryPolicy.cooldownHours ?? 24) * 60 * 60 * 1000,
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

  const dailyXpLimit = await getEffectiveDailyQuizXpLimit(supabase, userId);
  const dailyXpRemaining = Math.max(0, dailyXpLimit - (await getDailyEarnedXp(supabase, userId)));
  const awardedQuestionIds = await getAwardedQuestionIds(
    supabase,
    userId,
    quiz.questions.map((question) => question.id),
  );
  const unawardedQuestions = quiz.questions.filter(
    (question) => !awardedQuestionIds.has(question.id),
  );
  const earnableQuestionsToday = unawardedQuestions.filter(
    (question) => question.xp <= dailyXpRemaining,
  );
  const mode: AttemptMode = unawardedQuestions.length > 0 ? "earning" : "practice";
  const includedQuestions = mode === "earning" ? earnableQuestionsToday : quiz.questions;

  if (mode === "earning" && includedQuestions.length === 0) {
    const nextResetAt = getNextDailyResetAt();
    return {
      status: "blocked",
      reason: "daily_cap_reached",
      message: buildDailyCapBlockedMessage(nextResetAt),
      nextResetAt,
    };
  }

  const attemptId = randomUUID();
  const seed = `${quiz.id}:${attemptId}`;
  const publicQuiz = getPublicQuiz(quiz, seed);
  const publicQuestionById = new Map(
    publicQuiz.questions.map((question) => [question.id, question]),
  );
  const publicQuestions = includedQuestions.map(
    (question) => publicQuestionById.get(question.id) ?? question,
  );

  const { error: attemptError } = await supabase.from("quiz_attempts").insert({
    id: attemptId,
    user_id: userId,
    lesson_id: lesson.id,
    quiz_id: quiz.id,
    quiz_version: 1,
    mode,
    status: "in_progress",
    seed,
  });

  if (attemptError) {
    throw attemptError;
  }

  const { error: questionsError } = await supabase.from("quiz_attempt_questions").insert(
    includedQuestions.map((question, index) => ({
      attempt_id: attemptId,
      question_id: question.id,
      question_order: index + 1,
      question_snapshot: {
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        xp: question.xp,
        order: question.order,
      },
      options_snapshot: publicQuestionById.get(question.id)?.options ?? question.options,
      xp: question.xp,
    })),
  );

  if (questionsError) {
    throw questionsError;
  }

  return {
    status: "started",
    attemptId,
    mode,
    questions: publicQuestions,
    dailyXpLimit,
    dailyXpRemaining,
    totalPossibleXp: getQuestionsXp(includedQuestions),
  };
}

async function buildAttemptResult(
  supabase: SupabaseClient,
  attemptId: string,
  status: SupabaseQuizAttemptResult["status"],
  nextResetAt?: string,
): Promise<SupabaseQuizAttemptResult> {
  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id")
    .eq("id", attemptId)
    .maybeSingle<{ id: string; quiz_id: string }>();

  if (attemptError || !attempt) {
    throw attemptError ?? new Error("Attempt not found.");
  }

  const { data: attemptQuestions, error: questionsError } = await supabase
    .from("quiz_attempt_questions")
    .select("question_id, xp")
    .eq("attempt_id", attemptId);

  if (questionsError) {
    throw questionsError;
  }

  const { data: answers, error: answersError } = await supabase
    .from("quiz_answers")
    .select("question_id, is_correct, earned_xp, status")
    .eq("attempt_id", attemptId)
    .order("answered_at", { ascending: true });

  if (answersError) {
    throw answersError;
  }

  const questions = (answers ?? []).map((answer) => ({
    questionId: String(answer.question_id),
    correct: Boolean(answer.is_correct),
    earnedXp: Number(answer.earned_xp),
    status: answer.status as QuestionResult["status"],
  }));

  return {
    status,
    quizId: attempt.quiz_id,
    attemptId,
    earnedXp: questions.reduce((total, question) => total + question.earnedXp, 0),
    totalPossibleXp: (attemptQuestions ?? []).reduce(
      (total, question) => total + Number(question.xp),
      0,
    ),
    correctCount: questions.filter((question) => question.correct).length,
    wrongCount: questions.filter((question) => !question.correct).length,
    questions,
    nextResetAt,
  };
}

export async function answerSupabaseQuizQuestion({
  supabase,
  attemptId,
  questionId,
  selectedOptionIds,
}: {
  supabase: SupabaseClient;
  attemptId: string;
  questionId: string;
  selectedOptionIds: string[];
}): Promise<AnswerQuestionResult> {
  const { data, error } = await supabase.rpc("answer_quiz_question", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_option_ids: selectedOptionIds,
  });

  if (error) {
    throw error;
  }

  const answer = data as AnswerRpcResponse;

  if (!answer.completed) {
    const { data: answers, error: answersError } = await supabase
      .from("quiz_answers")
      .select("earned_xp")
      .eq("attempt_id", attemptId);

    if (answersError) {
      throw answersError;
    }

    return {
      status: "answered",
      attemptId,
      questionResult: answer.questionResult,
      earnedXpThisAttempt: (answers ?? []).reduce(
        (total, item) => total + Number(item.earned_xp),
        0,
      ),
      dailyXpRemaining: answer.dailyXpRemaining,
      completed: false,
    };
  }

  if (answer.attemptStatus === "daily_cap_reached") {
    const result = await buildAttemptResult(
      supabase,
      attemptId,
      "daily_cap_reached",
      answer.nextResetAt,
    );
    const earnedXpToday = answer.dailyXpLimit - answer.dailyXpRemaining;
    const message = buildDailyCapSavedMessage(answer.nextResetAt);

    return {
      status: "daily_cap_reached",
      result: {
        ...result,
        message,
      },
      dailyXpLimit: answer.dailyXpLimit,
      earnedXpToday,
      nextResetAt: answer.nextResetAt,
      message,
    };
  }

  return {
    status: "completed",
    result: await buildAttemptResult(
      supabase,
      attemptId,
      answer.attemptStatus === "practice_completed" ? "practice_completed" : "graded",
    ),
  };
}
