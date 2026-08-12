import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type PublicQuizQuestion } from "@/lib/lessons";
import { xpTimezone } from "@/lib/xp-settings";

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

function buildDailyCapSavedMessage(resetAtIso: string) {
  return `You have reached today's quiz XP limit. Your progress is saved. You can answer the remaining questions after ${formatDailyResetAt(resetAtIso)}.`;
}

export async function startSupabaseQuizAttempt({
  supabase,
  userId: _userId,
  lessonId,
  quizId,
  programmeId,
}: {
  supabase: SupabaseClient;
  userId: string;
  lessonId: string;
  quizId: string;
  programmeId?: string | null;
}): Promise<StartQuizResult> {
  void _userId;

  const { data, error } = await supabase.rpc("start_quiz_attempt", {
    p_quiz_id: quizId,
    p_lesson_id: lessonId,
    p_programme_id: programmeId ?? null,
  });

  if (error) {
    throw error;
  }

  return data as StartQuizResult;
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
    .maybeSingle();

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
