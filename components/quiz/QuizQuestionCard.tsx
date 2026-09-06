"use client";

import { Card } from "@/components/ui/Card";
import { CheckIcon } from "@/components/ui/Icons";
import type { PublicQuizQuestion } from "@/lib/lessons";
import { cn } from "@/lib/utils";

export function QuizQuestionCard({
  current, questionNumber, totalQuestions, badge, selectedOptionIds, onSelectOption,
}: {
  current: Pick<PublicQuizQuestion, "prompt" | "type" | "options">;
  questionNumber: number;
  totalQuestions: number;
  badge: string;
  selectedOptionIds: string[];
  onSelectOption: (id: string) => void;
}) {
  const quizProgressPercent = Math.round((questionNumber / totalQuestions) * 100);
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">
          Question {questionNumber} of {totalQuestions}
        </p>
        <span className="max-w-[8rem] whitespace-nowrap rounded-[18px] bg-[#dff2e9] px-3 py-1 text-center text-xs font-bold leading-none text-[#008751] tabular-nums">
          {badge}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,#008751_10%,transparent)]">
        <div
          className="h-full rounded-full bg-[#008751] transition-all duration-500"
          style={{ width: `${quizProgressPercent}%` }}
        />
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
          const isMultipleChoice = current.type === "multiple_choice";
          return (
            <button
              className={cn(
                "flex min-h-[58px] w-full items-center rounded-[18px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-5 text-left text-sm font-semibold text-[var(--ve-muted-strong)]",
                isSelected && "border-[#008751] bg-[#dff2e9] text-[#008751]",
              )}
              aria-pressed={isSelected}
              key={option.id}
              onClick={() => onSelectOption(option.id)}
              type="button"
            >
              {isMultipleChoice ? (
                <span className="mr-3 grid size-5 shrink-0 place-items-center rounded-[6px] border border-current">
                  {isSelected ? <CheckIcon className="size-3.5" /> : null}
                </span>
              ) : (
                <span className="mr-3 grid size-5 shrink-0 place-items-center rounded-full border-2 border-current">
                  <span className={cn("size-2.5 rounded-full", isSelected ? "bg-current" : "bg-transparent")} />
                </span>
              )}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
