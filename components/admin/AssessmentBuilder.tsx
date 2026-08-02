"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  deleteQuizQuestion,
  duplicateQuizQuestion,
  reorderQuizQuestions,
  saveQuizQuestion,
  saveQuizSettings,
} from "@/app/admin/courses/actions";
import { AdminCard, AdminStatusBadge, EmptyAdminState } from "@/components/admin/AdminPrimitives";
import {
  getAssessmentIssues,
  getAssessmentXp,
  getCorrectOptionCount,
  getQuestionIssues,
  getSortedQuestionOptions,
} from "@/features/learning/admin/assessment-builder-domain";
import type {
  AdminLessonRow,
  AdminQuizQuestionRow,
  AdminQuizRow,
} from "@/features/learning/admin/data";
import { cn } from "@/lib/utils";
import { formatXpLabel } from "@/lib/xp-format";

type EditableOption = {
  id: string;
  isCorrect: boolean;
  label: string;
};

const questionTypeLabels = {
  multiple_choice: "Multiple choice",
  single_choice: "Single choice",
  true_false: "True/false",
};

function buttonClasses(tone: "primary" | "secondary" | "danger" = "secondary") {
  const base = "inline-flex min-h-10 items-center justify-center rounded-[12px] px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60";

  if (tone === "primary") {
    return cn(base, "bg-[var(--ve-green)] text-white hover:brightness-95");
  }

  if (tone === "danger") {
    return cn(
      base,
      "bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_82%,var(--ve-card))] text-[var(--ve-danger)]",
    );
  }

  return cn(
    base,
    "border border-[var(--ve-line-soft)] bg-[var(--ve-card)] text-[var(--ve-muted-strong)] hover:text-[var(--ve-green)]",
  );
}

function fieldClasses() {
  return "mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function normalizeQuestionOptions(question?: AdminQuizQuestionRow | null): EditableOption[] {
  const options = question ? getSortedQuestionOptions(question) : [];
  const normalized = options.map((option) => ({
    id: option.id,
    isCorrect: option.is_correct,
    label: option.label,
  }));

  if (normalized.length >= 2) {
    return normalized.slice(0, 4);
  }

  return [
    ...normalized,
    ...Array.from({ length: 2 - normalized.length }).map((_, index) => ({
      id: `draft-option-${index + 1}`,
      isCorrect: normalized.length === 0 && index === 0,
      label: "",
    })),
  ];
}

function buildPreviewQuestion({
  explanation,
  options,
  prompt,
  question,
  questionType,
  questionOrder,
  xp,
}: {
  explanation: string;
  options: EditableOption[];
  prompt: string;
  question?: AdminQuizQuestionRow | null;
  questionOrder: number;
  questionType: string;
  xp: number;
}): AdminQuizQuestionRow {
  return {
    id: question?.id ?? "draft-question",
    explanation,
    options: options
      .filter((option) => option.label.trim())
      .map((option, index) => ({
        id: option.id || `preview-option-${index + 1}`,
        is_correct: option.isCorrect,
        label: option.label,
        option_order: index + 1,
        question_id: question?.id ?? "draft-question",
      })),
    prompt,
    question_order: question?.question_order ?? questionOrder,
    question_type: questionType,
    quiz_id: question?.quiz_id ?? "",
    xp,
  };
}

function QuestionPreview({ question }: { question: AdminQuizQuestionRow }) {
  const options = getSortedQuestionOptions(question);

  return (
    <div className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge tone="neutral">
          {questionTypeLabels[question.question_type as keyof typeof questionTypeLabels] ?? question.question_type}
        </AdminStatusBadge>
        <AdminStatusBadge tone="store">{formatXpLabel(question.xp)}</AdminStatusBadge>
      </div>
      <h4 className="mt-3 text-sm font-black leading-6">{question.prompt || "Question prompt"}</h4>
      <div className="mt-3 grid gap-2">
        {options.length === 0 ? (
          <p className="text-xs font-semibold text-[var(--ve-muted)]">No answer options yet.</p>
        ) : (
          options.map((option) => (
            <div
              className={cn(
                "rounded-[12px] border px-3 py-2 text-sm font-bold",
                option.is_correct
                  ? "border-[color:color-mix(in_srgb,var(--ve-green)_34%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_74%,var(--ve-card))]"
                  : "border-[var(--ve-line-soft)] bg-[var(--ve-card)]",
              )}
              key={option.id}
            >
              {option.label || "Untitled option"}
            </div>
          ))
        )}
      </div>
      {question.explanation ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">{question.explanation}</p>
      ) : null}
    </div>
  );
}

function QuestionEditor({
  defaultQuestionOrder,
  lessonId,
  onDeleteRequest,
  question,
  quizId,
}: {
  defaultQuestionOrder: number;
  lessonId: string;
  onDeleteRequest?: (question: AdminQuizQuestionRow) => void;
  question?: AdminQuizQuestionRow | null;
  quizId: string;
}) {
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [questionType, setQuestionType] = useState(question?.question_type ?? "single_choice");
  const [xp, setXp] = useState(question?.xp ?? 10);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [options, setOptions] = useState(() => normalizeQuestionOptions(question));
  const previewQuestion = buildPreviewQuestion({
    explanation,
    options,
    prompt,
    question,
    questionOrder: defaultQuestionOrder,
    questionType,
    xp,
  });
  const issues = getQuestionIssues(previewQuestion);
  const correctCount = getCorrectOptionCount(previewQuestion);

  function setType(nextType: string) {
    setQuestionType(nextType);

    if (nextType === "true_false") {
      setOptions([
        { id: "true", isCorrect: true, label: "True" },
        { id: "false", isCorrect: false, label: "False" },
      ]);
      return;
    }

    setOptions((current) => {
      if (current.length >= 2) return current;
      return [
        ...current,
        ...Array.from({ length: 2 - current.length }).map((_, index) => ({
          id: `draft-option-${index + 1}`,
          isCorrect: false,
          label: "",
        })),
      ];
    });
  }

  function markCorrect(index: number, checked: boolean) {
    setOptions((current) =>
      current.map((option, optionIndex) => {
        if (questionType === "multiple_choice") {
          return optionIndex === index ? { ...option, isCorrect: checked } : option;
        }

        return { ...option, isCorrect: optionIndex === index ? checked : false };
      }),
    );
  }

  function addOption() {
    setOptions((current) =>
      current.length >= 4
        ? current
        : [
            ...current,
            {
              id: `draft-option-${Date.now()}`,
              isCorrect: false,
              label: "",
            },
          ],
    );
  }

  function removeOption(index: number) {
    setOptions((current) => current.length <= 2 ? current : current.filter((_, optionIndex) => optionIndex !== index));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form action={saveQuizQuestion} className="space-y-4">
        <input name="lessonId" type="hidden" value={lessonId} />
        <input name="quizId" type="hidden" value={quizId} />
        <input name="questionId" type="hidden" value={question?.id ?? ""} />
        <input name="questionOrder" type="hidden" value={question?.question_order ?? defaultQuestionOrder} />

        <section className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
          <p className={labelClasses()}>Content</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_13rem]">
            <label>
              <span className={labelClasses()}>Prompt</span>
              <textarea
                className={`${fieldClasses()} min-h-24 resize-none`}
                name="prompt"
                onChange={(event) => setPrompt(event.target.value)}
                required
                value={prompt}
              />
            </label>
            <label>
              <span className={labelClasses()}>Type</span>
              <select
                className={fieldClasses()}
                name="questionType"
                onChange={(event) => setType(event.target.value)}
                value={questionType}
              >
                <option value="single_choice">Single choice</option>
                <option value="multiple_choice">Multiple choice</option>
                <option value="true_false">True/false</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={labelClasses()}>Correct answer</p>
              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                {options.length} options · {correctCount} marked correct
              </p>
            </div>
            <button
              className={buttonClasses()}
              disabled={options.length >= 4 || questionType === "true_false"}
              onClick={addOption}
              type="button"
            >
              Add option
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {options.map((option, index) => (
              <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3" key={option.id}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <label>
                    <span className={labelClasses()}>Option {index + 1}</span>
                    <input
                      className={fieldClasses()}
                      name={`option${index + 1}`}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: event.target.value } : item,
                          ),
                        )
                      }
                      readOnly={questionType === "true_false"}
                      value={option.label}
                    />
                  </label>
                  <label className="flex min-h-10 items-center gap-2 text-xs font-black">
                    <input
                      checked={option.isCorrect}
                      name={`correct${index + 1}`}
                      onChange={(event) => markCorrect(index, event.target.checked)}
                      type="checkbox"
                    />
                    Correct
                  </label>
                  <button
                    className={buttonClasses("danger")}
                    disabled={options.length <= 2 || questionType === "true_false"}
                    onClick={() => removeOption(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
            <p className={labelClasses()}>Feedback</p>
            <label className="mt-3 block">
              <span className={labelClasses()}>Explanation</span>
              <textarea
                className={`${fieldClasses()} min-h-24 resize-none`}
                name="explanation"
                onChange={(event) => setExplanation(event.target.value)}
                value={explanation}
              />
            </label>
          </div>
          <div className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
            <p className={labelClasses()}>Scoring</p>
            <label className="mt-3 block">
              <span className={labelClasses()}>Question XP</span>
              <input
                className={fieldClasses()}
                max={20}
                min={1}
                name="xp"
                onChange={(event) => setXp(Number(event.target.value))}
                required
                type="number"
                value={xp}
              />
            </label>
            <details className="mt-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                Reward behaviour
              </summary>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                XP is awarded by the existing quiz attempt rules, daily cap and lesson retry policy.
              </p>
            </details>
          </div>
        </section>

        {issues.length > 0 ? (
          <div className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--ve-store)_26%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_78%,var(--ve-card))] p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--ve-store)_70%,var(--foreground))]">
              Validation
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold leading-5">
              {issues.map((issue) => (
                <li key={issue.message}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button className={buttonClasses("primary")} type="submit">
          {question ? "Save question" : "Create question"}
        </button>
      </form>

      <aside className="space-y-3">
        <QuestionPreview question={previewQuestion} />
        {question ? (
          <div className="flex flex-wrap gap-2">
            <form action={duplicateQuizQuestion}>
              <input name="lessonId" type="hidden" value={lessonId} />
              <input name="quizId" type="hidden" value={quizId} />
              <input name="questionId" type="hidden" value={question.id} />
              <button className={buttonClasses()} type="submit">
                Duplicate
              </button>
            </form>
            {onDeleteRequest ? (
              <button className={buttonClasses("danger")} onClick={() => onDeleteRequest(question)} type="button">
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function SortableQuestionCard({
  children,
  issueCount,
  question,
}: {
  children: React.ReactNode;
  issueCount: number;
  question: AdminQuizQuestionRow;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      className={cn(
        "rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 shadow-sm",
        isDragging && "opacity-80 shadow-lg",
      )}
      ref={setNodeRef}
      style={style}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            aria-label={`Drag question ${question.question_order}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--ve-panel)] text-sm font-black text-[var(--ve-muted-strong)] touch-none"
            type="button"
            {...attributes}
            {...listeners}
          >
            ::
          </button>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
              Question {question.question_order}
            </p>
            <h3 className="mt-1 text-base font-black">{question.prompt || "Untitled question"}</h3>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge tone={issueCount > 0 ? "warning" : "good"}>
            {issueCount} issue{issueCount === 1 ? "" : "s"}
          </AdminStatusBadge>
          <AdminStatusBadge tone="store">{formatXpLabel(question.xp)}</AdminStatusBadge>
        </div>
      </div>
      {children}
    </article>
  );
}

export function AssessmentBuilder({
  lesson,
  questions,
  quiz,
}: {
  lesson: AdminLessonRow;
  questions: AdminQuizQuestionRow[];
  quiz: AdminQuizRow;
}) {
  const [orderedQuestions, setOrderedQuestions] = useState(() =>
    [...questions].sort((first, second) => first.question_order - second.question_order),
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminQuizQuestionRow | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const issues = useMemo(() => getAssessmentIssues(orderedQuestions), [orderedQuestions]);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const totalXp = getAssessmentXp(orderedQuestions);

  function persistQuestionOrder(nextQuestions: AdminQuizQuestionRow[], previousQuestions: AdminQuizQuestionRow[]) {
    setOrderedQuestions(nextQuestions);
    setOrderMessage("Saving question order...");
    const formData = new FormData();
    formData.set("lessonId", lesson.id);
    formData.set("quizId", quiz.id);
    formData.set("questionIds", JSON.stringify(nextQuestions.map((question) => question.id)));

    startTransition(() => {
      void reorderQuizQuestions(formData)
        .then(() => setOrderMessage("Question order saved."))
        .catch((error) => {
          setOrderedQuestions(previousQuestions);
          setOrderMessage(error instanceof Error ? error.message : "Question order could not be saved.");
        });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const previousQuestions = orderedQuestions;
    const nextQuestions = [...orderedQuestions];
    const activeIndex = nextQuestions.findIndex((question) => question.id === active.id);
    const overIndex = nextQuestions.findIndex((question) => question.id === over.id);
    if (activeIndex < 0 || overIndex < 0) {
      return;
    }

    const [movedQuestion] = nextQuestions.splice(activeIndex, 1);
    nextQuestions.splice(overIndex, 0, movedQuestion);
    persistQuestionOrder(
      nextQuestions.map((question, index) => ({ ...question, question_order: index + 1 })),
      previousQuestions,
    );
  }

  function confirmDeleteQuestion() {
    if (!deleteTarget) {
      return;
    }

    setDeleteMessage(null);
    const formData = new FormData();
    formData.set("lessonId", lesson.id);
    formData.set("quizId", quiz.id);
    formData.set("questionId", deleteTarget.id);

    startDeleteTransition(() => {
      void deleteQuizQuestion(formData).catch((error) => {
        setDeleteMessage(error instanceof Error ? error.message : "Question could not be deleted.");
      });
    });
  }

  return (
    <section className="mt-6 space-y-5">
      <AdminCard>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <form action={saveQuizSettings} className="space-y-4">
            <input name="lessonId" type="hidden" value={lesson.id} />
            <input name="quizId" type="hidden" value={quiz.id} />
            <div>
              <p className={labelClasses()}>Assessment</p>
              <h2 className="mt-1 text-lg font-black">Quiz settings</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
              <label>
                <span className={labelClasses()}>Quiz title</span>
                <input className={fieldClasses()} name="quizTitle" required defaultValue={quiz.title} />
              </label>
              <label>
                <span className={labelClasses()}>Editorial status</span>
                <select className={fieldClasses()} name="quizStatus" defaultValue={quiz.status}>
                  <option value="draft">Draft</option>
                  <option disabled={Boolean(errorCount > 0 || (quiz.ai_generated && quiz.status !== "published"))} value="published">
                    Published
                  </option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClasses("primary")} type="submit">
                Save quiz
              </button>
              <Link className={buttonClasses()} href={`/quiz/${lesson.id}`}>
                Learner preview
              </Link>
            </div>
          </form>

          <div className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge tone={errorCount > 0 ? "danger" : "good"}>
                {errorCount} blocker{errorCount === 1 ? "" : "s"}
              </AdminStatusBadge>
              <AdminStatusBadge tone={warningCount > 0 ? "warning" : "good"}>
                {warningCount} warning{warningCount === 1 ? "" : "s"}
              </AdminStatusBadge>
              <AdminStatusBadge tone="store">{formatXpLabel(totalXp)}</AdminStatusBadge>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-[var(--ve-muted)]">
              <p>Passing score: scored by existing quiz attempt rules.</p>
              <p>Quiz access: {lesson.quiz_requires_lesson_completion ? "after all lesson pages are read" : "available without page completion gate"}.</p>
              <p>
                Retry policy: {lesson.retry_mode}
                {lesson.retry_cooldown_seconds ? `, ${Math.round(lesson.retry_cooldown_seconds / 3600)}h cooldown` : ""}.
              </p>
            </div>
            {issues.length > 0 ? (
              <ul className="mt-4 space-y-2 text-xs font-bold leading-5">
                {issues.slice(0, 6).map((issue, index) => (
                  <li className="rounded-[10px] bg-[var(--ve-card)] px-3 py-2" key={`${issue.message}-${index}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={labelClasses()}>Question list</p>
            <h2 className="mt-1 text-lg font-black">{orderedQuestions.length} questions</h2>
            {orderMessage ? (
              <p className="mt-2 text-xs font-black text-[var(--ve-muted-strong)]">{orderMessage}</p>
            ) : null}
          </div>
          <AdminStatusBadge tone={isPending ? "warning" : "neutral"}>
            {isPending ? "Saving order" : "Drag to reorder"}
          </AdminStatusBadge>
        </div>
        {orderedQuestions.length === 0 ? (
          <div className="mt-4">
            <EmptyAdminState>No quiz questions yet.</EmptyAdminState>
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
            <SortableContext items={orderedQuestions.map((question) => question.id)} strategy={verticalListSortingStrategy}>
              <div className="mt-4 space-y-4">
                {orderedQuestions.map((question) => (
                  <SortableQuestionCard
                    issueCount={getQuestionIssues(question).length}
                    key={question.id}
                    question={question}
                  >
                    <QuestionEditor
                      defaultQuestionOrder={question.question_order}
                      lessonId={lesson.id}
                      onDeleteRequest={setDeleteTarget}
                      question={question}
                      quizId={quiz.id}
                    />
                  </SortableQuestionCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </AdminCard>

      <AdminCard>
        <p className={labelClasses()}>Create question</p>
        <h2 className="mt-1 text-lg font-black">New assessment item</h2>
        <div className="mt-4">
          <QuestionEditor
            defaultQuestionOrder={orderedQuestions.length + 1}
            lessonId={lesson.id}
            quizId={quiz.id}
          />
        </div>
      </AdminCard>

      <AdminCard>
        <p className={labelClasses()}>Quiz preview</p>
        <h2 className="mt-1 text-lg font-black">{quiz.title}</h2>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {orderedQuestions.length === 0 ? (
            <EmptyAdminState>No questions to preview.</EmptyAdminState>
          ) : (
            orderedQuestions.map((question) => <QuestionPreview key={question.id} question={question} />)
          )}
        </div>
      </AdminCard>

      <AlertDialog.Root
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteMessage(null);
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Delete question?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              This removes the question and its answer options when no learner attempt history references it.
            </AlertDialog.Description>
            {deleteMessage ? (
              <p className="mt-3 rounded-[12px] border border-[color:color-mix(in_srgb,var(--ve-danger)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_78%,var(--ve-card))] px-3 py-2 text-sm font-bold text-[var(--ve-danger)]">
                {deleteMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className={buttonClasses()} type="button">
                Cancel
              </AlertDialog.Cancel>
              <button
                className={buttonClasses("danger")}
                disabled={isDeletePending}
                onClick={confirmDeleteQuestion}
                type="button"
              >
                {isDeletePending ? "Deleting..." : "Delete question"}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
