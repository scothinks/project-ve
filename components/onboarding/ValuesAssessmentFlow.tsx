"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type AssessmentOption = {
  id: string;
  label: string;
  description: string | null;
};

type AssessmentQuestion = {
  id: string;
  prompt: string;
  helperText: string | null;
  options: AssessmentOption[];
};

type AssessmentData = {
  id: string;
  description?: string | null;
  introductionCopy?: string | null;
  title: string;
  xpAward: number;
  questions: AssessmentQuestion[];
};

type ValuesAssessmentFlowProps = {
  action: (formData: FormData) => void | Promise<void>;
  assessment: AssessmentData;
  contextLabel?: string;
  errorMessage?: string | null;
  heading?: string;
  hiddenFields?: Array<{ name: string; value: string }>;
  introCopy?: string | null;
  nextLabel?: string;
  preferredName?: string | null;
  unitLabel?: string;
  variant?: "default" | "organization";
};

function FinishButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={disabled || pending} type="submit">
      {pending ? "Saving..." : "Finish"}
    </Button>
  );
}

export function ValuesAssessmentFlow({
  action,
  assessment,
  contextLabel,
  errorMessage,
  heading,
  hiddenFields = [],
  introCopy,
  nextLabel = "Next",
  preferredName,
  unitLabel = "XP",
  variant = "default",
}: ValuesAssessmentFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const question = assessment.questions[currentIndex];
  const totalQuestions = assessment.questions.length;
  const selectedOptionId = answers[question.id] ?? "";
  const allAnswered = assessment.questions.every((item) => Boolean(answers[item.id]));
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const currentAnswered = Boolean(selectedOptionId);
  const displayHeading = heading ?? (preferredName ? `Welcome, ${preferredName}` : "Welcome");
  const displayIntro = introCopy
    ?? assessment.introductionCopy
    ?? assessment.description
    ?? "Answer a few quick questions so we can choose a better place for you to start. There are no right or wrong answers.";

  function handleSelect(optionId: string) {
    setAnswers((current) => ({
      ...current,
      [question.id]: optionId,
    }));
  }

  function goBack() {
    setCurrentIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    if (!currentAnswered) {
      return;
    }

    setCurrentIndex((current) => Math.min(totalQuestions - 1, current + 1));
  }

  const isOrganization = variant === "organization";

  if (isOrganization) {
    return (
      <div className="values-assessment-flow values-assessment-flow--organization mx-auto max-w-[390px]">
        <h1 className="text-[1.25rem] font-[650] leading-6 text-[var(--learner-text)]">
          {displayHeading}
        </h1>
        {errorMessage ? (
          <div className="mt-3 rounded-lg border border-[color:color-mix(in_srgb,var(--ve-mission)_28%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-mission)_10%,var(--ve-card))] px-3 py-2 text-[0.72rem] font-semibold text-[var(--foreground)]">
            {errorMessage}
          </div>
        ) : null}

        <form action={action} className="values-assessment-flow__form mt-4">
          <input name="assessmentVersionId" type="hidden" value={assessment.id} />
          {hiddenFields.map((field) => (
            <input key={field.name} name={field.name} type="hidden" value={field.value} />
          ))}
          {assessment.questions.map((item) => (
            <input
              key={item.id}
              name={`question:${item.id}`}
              type="hidden"
              value={answers[item.id] ?? ""}
            />
          ))}

          <div className="values-assessment-flow__progress-labels flex items-center justify-between gap-4">
            <p className="text-[0.68rem] font-[650] leading-4 text-[var(--learner-green-deep)]">
              Question {currentIndex + 1} of {totalQuestions}
            </p>
            <p className="text-[0.62rem] font-[650] leading-4 text-[var(--learner-text-muted)]">
              {progressPercent}%
            </p>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[color:color-mix(in_srgb,var(--learner-green)_15%,transparent)]">
            <div
              className="h-full rounded-full bg-[var(--learner-green-deep)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <section className="values-assessment-flow__question mt-4 rounded-lg bg-[color:color-mix(in_srgb,var(--learner-surface)_72%,white)] p-4">
            <h2 className="text-[1.05rem] font-[650] leading-6 text-[var(--learner-text)]">
              {question.prompt}
            </h2>
            {question.helperText ? (
              <p className="mt-2 text-[0.68rem] font-medium leading-4 text-[var(--learner-text-muted)]">
                {question.helperText}
              </p>
            ) : null}
          </section>

          <div className="values-assessment-flow__options mt-4 grid gap-2">
            {question.options.map((option, optionIndex) => {
              const isSelected = selectedOptionId === option.id;

              return (
                <button
                  aria-pressed={isSelected}
                  className={cn(
                    "w-full border p-3 text-left transition",
                    isSelected
                      ? "border-[var(--learner-green-deep)] bg-[color:color-mix(in_srgb,var(--learner-green-soft)_45%,white)]"
                      : "border-[var(--learner-border-soft)] bg-transparent",
                  )}
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  type="button"
                >
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[0.68rem] font-[650]",
                        isSelected
                          ? "border-[var(--learner-green-deep)] bg-[var(--learner-green-deep)] text-white"
                          : "border-[var(--learner-border)] text-[var(--learner-text-muted)]",
                      )}
                    >
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.72rem] font-[650] leading-5 text-[var(--learner-text)]">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-1 block text-[0.62rem] font-medium leading-4 text-[var(--learner-text-muted)]">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="values-assessment-flow__actions mt-5 grid grid-cols-2 gap-3">
            <Button
              className="h-10 w-full text-[0.72rem]"
              disabled={currentIndex === 0}
              onClick={goBack}
              type="button"
              variant="outline"
            >
              Back
            </Button>
            {isLastQuestion ? (
              <FinishButton disabled={!currentAnswered || !allAnswered} />
            ) : (
              <Button
                className="h-10 w-full text-[0.72rem]"
                disabled={!currentAnswered}
                onClick={goNext}
                type="button"
              >
                {nextLabel}
              </Button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto", isOrganization ? "max-w-[430px]" : "max-w-3xl")}>
      <Card className={cn("p-6 md:p-7", isOrganization && "rounded-xl border-[var(--learner-border-soft)] bg-[var(--learner-background-cream)] shadow-none")}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--ve-line-soft)] px-3 py-1 text-xs font-semibold text-[var(--ve-muted)]">
            About 2 minutes
          </span>
          <span className="rounded-full border border-[color:color-mix(in_srgb,var(--ve-green)_18%,var(--ve-line-soft))] px-3 py-1 text-xs font-semibold text-[var(--ve-green)]">
            {assessment.xpAward} {unitLabel} reward
          </span>
        </div>
        <h1 className="mt-4 text-[2rem] font-black tracking-[-0.04em] text-[var(--foreground)]">
          {displayHeading}
        </h1>
        {contextLabel ? (
          <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
            {contextLabel}
          </p>
        ) : null}
        <p className="mt-3 max-w-2xl text-[0.98rem] font-medium leading-7 text-[var(--ve-muted-strong)]">
          {displayIntro}
        </p>
        {errorMessage ? (
          <div className="mt-5 rounded-[18px] border border-[color:color-mix(in_srgb,var(--ve-mission)_28%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-mission)_10%,var(--ve-card))] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
            {errorMessage}
          </div>
        ) : null}
      </Card>

      <form action={action} className="mt-5">
        <input name="assessmentVersionId" type="hidden" value={assessment.id} />
        {hiddenFields.map((field) => (
          <input key={field.name} name={field.name} type="hidden" value={field.value} />
        ))}
        {assessment.questions.map((item) => (
          <input
            key={item.id}
            name={`question:${item.id}`}
            type="hidden"
            value={answers[item.id] ?? ""}
          />
        ))}

        <Card className={cn("overflow-hidden p-6 md:p-7", isOrganization && "rounded-xl border-[var(--learner-border-soft)] bg-[var(--learner-surface)] shadow-none")} variant="quiet">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
                Question {currentIndex + 1} of {totalQuestions}
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--ve-muted)]">
                A few quick scenarios to personalize your starting lessons.
              </p>
            </div>
            <div className="min-w-[72px] text-right text-sm font-black text-[var(--ve-muted-strong)]">
              {progressPercent}%
            </div>
          </div>

          <div className="mt-4 h-2 rounded-full bg-[var(--ve-panel)]">
            <div
              className="h-full rounded-full bg-[var(--ve-green)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-7">
            <h2 className="text-[1.5rem] font-black leading-[1.28] tracking-[-0.03em] text-[var(--foreground)]">
              {question.prompt}
            </h2>
            {question.helperText ? (
              <p className="mt-3 text-sm font-medium leading-6 text-[var(--ve-muted)]">
                {question.helperText}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            {question.options.map((option, optionIndex) => {
              const isSelected = selectedOptionId === option.id;

              return (
                <button
                  aria-pressed={isSelected}
                  className={cn(
                    "w-full rounded-[22px] border px-4 py-4 text-left transition",
                    isSelected
                      ? "border-[var(--ve-green)] bg-[var(--ve-green-soft)] shadow-[0_12px_28px_rgba(var(--ve-shadow-rgb),0.08)]"
                      : "border-[var(--ve-line-soft)] bg-[var(--ve-card)] hover:border-[color:color-mix(in_srgb,var(--ve-green)_30%,var(--ve-line-soft))] hover:bg-[var(--ve-card-subtle)]",
                  )}
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  type="button"
                >
                  <div className="flex gap-4">
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-black",
                        isSelected
                          ? "border-[var(--ve-green)] bg-[var(--ve-green)] text-white"
                          : "border-[var(--ve-line)] text-[var(--ve-muted)]",
                      )}
                    >
                      {String.fromCharCode(65 + optionIndex)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[1rem] font-semibold leading-7 text-[var(--foreground)]">
                        {option.label}
                      </p>
                      {option.description ? (
                        <p className="mt-1 text-sm font-medium leading-6 text-[var(--ve-muted)]">
                          {option.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 border-t border-[var(--ve-line-soft)] pt-5">
            <div className="text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              {isLastQuestion
                ? "Answer the last question to unlock your starting path."
                : "Pick the answer that feels closest to what you would do."}
            </div>
            <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:justify-end">
              <Button
                className="w-full sm:min-w-[120px]"
                disabled={currentIndex === 0}
                onClick={goBack}
                type="button"
                variant="outline"
              >
                Back
              </Button>
              {isLastQuestion ? (
                <FinishButton disabled={!currentAnswered || !allAnswered} />
              ) : (
                <Button
                  className="w-full sm:min-w-[120px]"
                  disabled={!currentAnswered}
                  onClick={goNext}
                  type="button"
                >
                  {nextLabel}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
