"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PublicQuizQuestion } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import { formatXpLabel } from "@/lib/xp-format";

type QuizOptionsProps = {
  lessonId: string;
  quizId: string;
  questions: PublicQuizQuestion[];
};

type QuestionResult = {
  questionId: string;
  correct: boolean;
  earnedXp: number;
  status: "earned" | "missed" | "already_earned" | "daily_cap_deferred" | "practice";
};

type QuizAttemptResult = {
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

type StartQuizResponse =
  | {
      status: "started";
      attemptId: string;
      mode: "earning" | "practice";
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

type BlockedReason = Extract<StartQuizResponse, { status: "blocked" }>["reason"];

type AnswerQuizResponse =
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

export function QuizOptions({ lessonId, quizId, questions }: QuizOptionsProps) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptMode, setAttemptMode] = useState<"earning" | "practice">("earning");
  const [liveQuestions, setLiveQuestions] = useState(questions);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submittedQuestionIds, setSubmittedQuestionIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStarting, setIsStarting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<BlockedReason | null>(null);
  const [dailyLimitModal, setDailyLimitModal] = useState<{
    message: string;
    nextResetAt: string;
  } | null>(null);

  const current = liveQuestions[currentIndex];
  const selectedOptionIds = current ? answers[current.id] ?? [] : [];
  const canSubmitCurrent = Boolean(attemptId && current && selectedOptionIds.length > 0);
  const isLastQuestion = currentIndex === liveQuestions.length - 1;

  const answeredCount = useMemo(() => submittedQuestionIds.length, [submittedQuestionIds]);

  function formatResetAt(resetAtIso: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZoneName: "short",
    }).format(new Date(resetAtIso));
  }

  useEffect(() => {
    let cancelled = false;

    async function startAttempt() {
      setIsStarting(true);
      const response = await fetch(`/api/quizzes/${quizId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lessonId }),
      });
      const result = (await response.json()) as StartQuizResponse;

      if (cancelled) {
        return;
      }

      if (result.status === "blocked") {
        setBlockedMessage(result.message);
        setBlockedReason(result.reason);
        setIsStarting(false);
        return;
      }

      setAttemptId(result.attemptId);
      setAttemptMode(result.mode);
      setLiveQuestions(result.questions);
      setIsStarting(false);
    }

    void startAttempt();

    return () => {
      cancelled = true;
    };
  }, [lessonId, quizId]);

  function selectOption(optionId: string) {
    if (!current || submittedQuestionIds.includes(current.id)) {
      return;
    }

    if (current.type === "multiple_choice") {
      setAnswers((previous) => {
        const existingSelection = previous[current.id] ?? [];
        const nextSelection = existingSelection.includes(optionId)
          ? existingSelection.filter((selectedId) => selectedId !== optionId)
          : [...existingSelection, optionId];

        return {
          ...previous,
          [current.id]: nextSelection,
        };
      });
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [current.id]: [optionId],
    }));
  }

  async function submitCurrentAnswer() {
    if (!attemptId || !current || selectedOptionIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/quizzes/${quizId}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attemptId,
        questionId: current.id,
        selectedOptionIds,
      }),
    });
    const result = (await response.json()) as AnswerQuizResponse | { error: string };
    setIsSubmitting(false);

    if ("error" in result) {
      setBlockedMessage(result.error);
      return;
    }

    if (result.status === "answered") {
      setSubmittedQuestionIds((ids) => [...ids, current.id]);
      setCurrentIndex((index) => index + 1);
      return;
    }

    if (result.status === "completed") {
      window.sessionStorage.setItem(`quiz-result:${lessonId}`, JSON.stringify(result.result));
      router.push(`/results/${lessonId}`);
      return;
    }

    window.sessionStorage.setItem(`quiz-result:${lessonId}`, JSON.stringify(result.result));
    setDailyLimitModal({
      message: result.message,
      nextResetAt: result.nextResetAt,
    });
  }

  if (isStarting) {
    return (
      <Card className="p-6">
        <p className="text-sm font-bold">Preparing your quiz...</p>
        <p className="mt-2 text-xs leading-5 text-[var(--ve-muted)]">
          We are checking your lesson progress and XP eligibility.
        </p>
      </Card>
    );
  }

  if (blockedMessage || !current) {
    const isDailyCapBlock = blockedReason === "daily_cap_reached";

    return (
      <Card className="p-6 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-[20px] bg-[#dff2e9] text-lg font-black text-[#008751]">
          XP
        </div>
        <p className="text-lg font-black">
          {isDailyCapBlock ? "Daily XP checkpoint reached" : "Quiz not ready yet"}
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--ve-muted)]">{blockedMessage}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button href={`/lessons/${lessonId}`} variant="outline">
            Review
          </Button>
          <Button href={isDailyCapBlock ? "/courses" : `/lessons/${lessonId}`}>
            {isDailyCapBlock ? "Keep Learning" : "Lesson"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">
            Question {currentIndex + 1}
          </p>
          <span className="max-w-[8rem] whitespace-nowrap rounded-[18px] bg-[#dff2e9] px-3 py-1 text-center text-xs font-bold leading-none text-[#008751] tabular-nums">
            {attemptMode === "practice" ? "Practice" : formatXpLabel(current.xp)}
          </span>
        </div>
        <h2 className="mt-4 text-xl font-bold leading-7">{current.prompt}</h2>
        {current.type === "multiple_choice" ? (
          <div className="mt-3 rounded-[16px] border border-[#dff2e9] bg-[#f4fbf7] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#008751]">
              Multiple choice
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#5f786d]">
              More than one answer can be correct. Select every option that applies before you continue.
            </p>
          </div>
        ) : null}
        <div className="mt-6 space-y-3">
          {current.options.map((option) => {
            const isSelected = selectedOptionIds.includes(option.id);
            return (
              <button
                className={cn(
                  "flex min-h-[58px] w-full items-center rounded-[18px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-5 text-left text-sm font-semibold text-[var(--ve-muted-strong)]",
                  isSelected && "border-[#008751] bg-[#dff2e9] text-[#008751]",
                )}
                key={option.id}
                onClick={() => selectOption(option.id)}
                type="button"
              >
                <span
                  className={cn(
                    "mr-3 grid size-5 shrink-0 place-items-center rounded-[6px] border text-[11px] font-black",
                    current.type === "multiple_choice" ? "border-current" : "rounded-full border-current",
                  )}
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {selectedOptionIds.length > 0 ? (
        <Card className="border border-[#dff2e9] p-5">
          <p className="text-sm font-bold text-[var(--foreground)]">
            {current.type === "multiple_choice"
              ? `${selectedOptionIds.length} choice${selectedOptionIds.length === 1 ? "" : "s"} selected`
              : "Answer saved"}
          </p>
          {current.type === "multiple_choice" ? (
            <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
              Select every answer that applies, then continue.
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--ve-muted)]">
          {answeredCount}/{liveQuestions.length} submitted
        </span>
        <Button
          disabled={!canSubmitCurrent || isSubmitting}
          onClick={submitCurrentAnswer}
          type="button"
          variant={canSubmitCurrent ? "primary" : "soft"}
        >
          {isSubmitting
            ? "Checking..."
            : isLastQuestion
              ? "View result"
              : current.type === "multiple_choice"
                ? "Save & next"
                : "Next"}
        </Button>
      </div>

      {dailyLimitModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6">
          <Card className="max-w-[340px] p-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-[20px] bg-[#dff2e9] text-xl font-black text-[#008751]">
              XP
            </div>
            <h2 className="mt-4 text-xl font-black">Daily XP limit reached</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              {dailyLimitModal.message}
            </p>
            <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
              Quiz XP unlocks at {formatResetAt(dailyLimitModal.nextResetAt)}.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button href={`/results/${lessonId}`} variant="outline">
                Review
              </Button>
              <Button href="/courses">Keep Learning</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
