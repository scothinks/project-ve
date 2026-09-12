import Link from "next/link";
import { cn } from "@/lib/utils";

export function LessonAuthoringSteps({
  lessonId,
  current,
  pageCount,
  questionCount,
}: {
  lessonId: string;
  current: "pages" | "quiz" | "values" | "preview";
  pageCount: number;
  questionCount: number;
}) {
  const base = `/admin/courses/lessons/${lessonId}`;
  const steps = [
    { id: "pages", label: "Pages", href: base, detail: `${pageCount} page${pageCount === 1 ? "" : "s"}` },
    { id: "quiz", label: "Quiz", href: `${base}/quiz`, detail: questionCount ? `${questionCount} question${questionCount === 1 ? "" : "s"}` : "Add questions" },
    { id: "values", label: "Values", href: `${base}/values`, detail: "What learners explore" },
    { id: "preview", label: "Review", href: `${base}/preview`, detail: "Check before publishing" },
  ];

  return (
    <nav aria-label="Lesson authoring steps" className="border-b border-[var(--ui-border-subtle)] py-4">
      <ol className="mx-auto grid max-w-4xl grid-cols-2 sm:grid-cols-4 gap-2 px-3">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              aria-current={current === step.id ? "step" : undefined}
              className={cn(
                "block rounded-[14px] border px-3 py-3 text-sm font-extrabold",
                current === step.id
                  ? "border-[var(--ui-action)] bg-[var(--ui-surface-soft)] text-[var(--ui-action)]"
                  : "border-transparent text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-soft)]",
              )}
              href={step.href}
            >
              {index + 1}. {step.label}
              <span className="mt-1 block text-xs font-semibold">{step.detail}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
