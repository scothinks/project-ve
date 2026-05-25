"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
  lessonId: string;
  retryHref: string;
  questions: QuestionSummary[];
};

export function QuizResultDetails({ lessonId, retryHref, questions }: QuizResultDetailsProps) {
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
      <section className="px-6 py-8">
        <Card className="p-6">
          <p className="text-sm font-bold">Loading result...</p>
        </Card>
      </section>
    );
  }

  if (result === null) {
    return (
      <section className="px-6 py-8">
        <Card className="p-6 text-center">
          <p className="text-lg font-black">No quiz result yet</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Complete the lesson and finish the quiz to see your XP result.
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
    <section className="px-6 py-8">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs font-bold text-[var(--ve-muted)]">Correct Answers</p>
          <p className="mt-2 text-[32px] font-black text-[#008751]">
            {visibleResult.correctCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold text-[var(--ve-muted)]">Wrong Answers</p>
          <p className="mt-2 text-[32px] font-black text-[var(--foreground)]">
            {visibleResult.wrongCount}
          </p>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden border border-[#dff2e9] bg-[#f4fbf7] p-6 text-center">
        <div aria-hidden="true" className="relative mx-auto mb-1 size-20">
          <div className="absolute inset-[10px] rounded-full bg-[#e4f4ed] shadow-[0_18px_30px_rgba(0,135,81,0.12)]" />
          <div className="absolute left-1 top-3 text-[0.9rem]">✦</div>
          <div className="absolute right-0 top-1 text-[0.8rem]">•</div>
          <div className="absolute bottom-2 left-0 text-[0.75rem]">•</div>
          <div className="absolute bottom-1 right-2 text-[0.95rem]">✦</div>
          <div className="absolute inset-0 grid place-items-center text-[1.9rem] leading-none">
            🎉
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-black text-[var(--foreground)]">
          You earned {formatXpLabel(visibleResult.earnedXp)}!
        </h1>
        <p className="mx-auto mt-2 max-w-[240px] text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
          Use XP for rewards or keep learning to earn more.
        </p>
      </Card>

      <section className="mt-7">
        <h2 className="text-[17px] font-bold">Questions to Review</h2>
        <div className="mt-3 space-y-3">
          {reviewQuestions.length > 0 ? (
            reviewQuestions.map((question) => (
              <Card className="min-h-[61px] px-5 py-4" key={question.id}>
                <p className="text-sm font-semibold leading-5 text-[var(--ve-muted-strong)]">
                  {question.prompt}
                </p>
                <p className="mt-1 text-[11px] font-bold text-[var(--ve-muted)]">
                  {question.status === "daily_cap_deferred"
                    ? `Available after reset: ${formatXpLabel(question.xp)}`
                    : `Missed ${formatXpLabel(question.xp)}`}
                </p>
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
      </section>

      <section className="mt-8 grid grid-cols-3 gap-2">
        <Button className="h-10 px-2 text-xs" href={retryHref} variant="outline">
          Retry
        </Button>
        <Button className="h-10 px-2 text-xs" href="/xp-store" variant="soft">
          XP Store
        </Button>
        <Button className="h-10 px-2 text-xs" href="/dashboard">
          Lessons
        </Button>
      </section>
    </section>
  );
}
