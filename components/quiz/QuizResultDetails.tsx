"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckCircleIcon, TrophyIcon } from "@/components/ui/Icons";
import { AlertCircleIcon } from "@/components/missions/MissionIcons";
import { formatXpLabel } from "@/lib/xp-format";

type QuestionSummary = {
  id: string;
  prompt: string;
  xp: number;
};

type StoredQuizResult = {
  earnedXp: number;
  totalPossibleXp: number;
  correctCount: number;
  wrongCount: number;
  questions: Array<{
    questionId: string;
    correct: boolean;
    earnedXp: number;
    status?: "earned" | "missed" | "already_earned" | "daily_cap_deferred" | "practice";
  }>;
};

type QuizResultDetailsProps = {
  lessonsHref?: string;
  lessonId: string;
  retryHref: string;
  questions: QuestionSummary[];
  storeHref?: string;
  unitLabel?: string;
};

export function QuizResultDetails({
  lessonsHref = "/dashboard",
  lessonId,
  retryHref,
  questions,
  storeHref = "/xp-store",
  unitLabel = "XP",
}: QuizResultDetailsProps) {
  const [result, setResult] = useState<StoredQuizResult | null | undefined>(undefined);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(`quiz-result:${lessonId}`);
    if (!stored) {
      setResult(null);
      return;
    }

    setResult(JSON.parse(stored) as StoredQuizResult);
  }, [lessonId]);

  if (result === undefined) {
    return (
      <section className="learner-page learner-page--spacious">
        <Card className="p-6">
          <p className="text-sm font-bold">Loading result...</p>
        </Card>
      </section>
    );
  }

  if (result === null) {
    return (
      <section className="learner-page learner-page--spacious">
        <Card className="p-6 text-center">
          <p className="text-lg font-black">No quiz result yet</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Complete the lesson and finish the quiz to see your {unitLabel} result.
          </p>
          <Button className="mt-5 w-full" href={retryHref}>
            Start Quiz
          </Button>
        </Card>
      </section>
    );
  }

  const visibleResult = result;
  const reviewResultByQuestionId = new Map(
    visibleResult.questions
      .filter(
        (question) =>
          !question.correct ||
          question.status === "missed" ||
          question.status === "daily_cap_deferred",
      )
      .map((question) => [question.questionId, question]),
  );
  const reviewQuestions = questions
    .filter((question) => reviewResultByQuestionId.has(question.id))
    .map((question) => ({
      ...question,
      status: reviewResultByQuestionId.get(question.id)?.status ?? "missed",
    }));

  return (
    <section className="learner-page learner-page--spacious">
      <div className="quiz-result-layout learner-readable">
        <div className="quiz-result-layout__summary">
          <Card className="overflow-hidden border-l-4 border-l-[#e7c268] p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff0bd] text-[#946400]">
                <TrophyIcon className="size-5" />
              </span>
              <div>
                <h1 className="text-lg font-black text-[var(--foreground)]">
                  You earned {formatXpLabel(visibleResult.earnedXp, unitLabel)}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[var(--ve-muted-strong)]">
                  Use {unitLabel} for rewards or keep learning to earn more.
                </p>
              </div>
            </div>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Card className="flex flex-col items-center gap-1.5 p-4 text-center">
              <CheckCircleIcon className="size-7 text-[#008751]" />
              <p className="text-[28px] font-black leading-none text-[#008751]">
                {visibleResult.correctCount}
              </p>
              <p className="text-xs font-bold text-[var(--ve-muted)]">Correct</p>
            </Card>
            <Card className="flex flex-col items-center gap-1.5 p-4 text-center">
              <AlertCircleIcon className="size-7 text-[#c94f2e]" />
              <p className="text-[28px] font-black leading-none text-[var(--foreground)]">
                {visibleResult.wrongCount}
              </p>
              <p className="text-xs font-bold text-[#c94f2e]">Needs review</p>
            </Card>
          </div>

          <section className="mt-6 flex flex-col gap-2.5 border-t border-[var(--ve-line-soft)] pt-6">
            <Button href={retryHref}>Retry Quiz</Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button className="px-2 !text-[0.8rem]" href={lessonsHref} variant="outline">
                Continue Learning
              </Button>
              <Button href={storeHref} variant="outline">
                Rewards
              </Button>
            </div>
          </section>
        </div>

        <div className="quiz-result-layout__review">
          <h2 className="text-[17px] font-bold">Questions to Review</h2>
          <div className="mt-3 space-y-3">
            {reviewQuestions.length > 0 ? (
              reviewQuestions.map((question) => (
                <Card className="flex items-start gap-3 px-5 py-4" key={question.id}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fbe4e0] text-[#c00000]">
                    <AlertCircleIcon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 text-[var(--ve-muted-strong)]">
                      {question.prompt}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-[var(--ve-muted)]">
                      {question.status === "daily_cap_deferred"
                        ? `Available after reset: ${formatXpLabel(question.xp, unitLabel)}`
                        : `Missed ${formatXpLabel(question.xp, unitLabel)}`}
                    </p>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-5">
                <p className="text-sm font-bold">No missed questions</p>
                <p className="mt-2 text-xs leading-5 text-[var(--ve-muted)]">
                  You answered every question correctly.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
