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
import { useEffect, useRef, useState, useTransition } from "react";
import { AiAssistanceAuthoring } from "@/components/admin/ai/AiAssistanceAuthoring";
import {
  deleteQuizQuestion,
  duplicateQuizQuestion,
  reorderQuizQuestions,
  saveLesson,
  saveQuizQuestion,
  saveQuizSettings,
} from "@/app/admin/courses/actions";
import { AdminDragHandle } from "@/components/admin/AdminDragHandle";
import { AdminStatusBadge, EmptyAdminState } from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { CheckIcon } from "@/components/ui/Icons";
import {
  getAssessmentIssues,
  getAssessmentXp,
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

type RetryMode = "anytime" | "cooldown" | "disabled";

const questionTypeOptions: Array<{ value: string; label: string }> = [
  { value: "single_choice", label: "Single choice" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "true_false", label: "True/false" },
];

const retryModeOptions: Array<{ value: RetryMode; label: string }> = [
  { value: "anytime", label: "Anytime" },
  { value: "cooldown", label: "Cooldown" },
  { value: "disabled", label: "Disabled" },
];

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function pillButtonClasses(active: boolean) {
  return cn(
    "inline-flex items-center justify-center rounded-full border px-[18px] py-[9px] text-[13px]",
    active
      ? "border-[var(--ui-action)] bg-[var(--ui-action)] font-extrabold text-[var(--ui-on-action)]"
      : "border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] font-bold text-[var(--ui-text)]",
  );
}

function fieldClasses() {
  return "mt-2 w-full rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-inset)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[var(--ui-focus)] focus:ring-4 focus:ring-[var(--ui-focus)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]";
}

function getCoverImageValue(image: Record<string, unknown> | null | undefined, key: "src" | "alt") {
  const value = image?.[key];
  return typeof value === "string" ? value : "";
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

function QuestionCardFields({
  defaultQuestionOrder,
  lessonId,
  question,
  quizId,
  onSaved,
}: {
  onSaved?: () => void;
  defaultQuestionOrder: number;
  lessonId: string;
  question?: AdminQuizQuestionRow | null;
  quizId: string;
}) {
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [questionType, setQuestionType] = useState(question?.question_type ?? "single_choice");
  const [xp, setXp] = useState(question?.xp ?? 10);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [options, setOptions] = useState(() => normalizeQuestionOptions(question));

  const draft = JSON.stringify({ prompt, questionType, xp, explanation, options });
  const [savedDraft, setSavedDraft] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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

  function markCorrect(index: number) {
    setOptions((current) =>
      current.map((option, optionIndex) => {
        if (questionType === "multiple_choice") {
          return optionIndex === index ? { ...option, isCorrect: !option.isCorrect } : option;
        }

        return { ...option, isCorrect: optionIndex === index };
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
    setOptions((current) => (current.length <= 2 ? current : current.filter((_, optionIndex) => optionIndex !== index)));
  }

  const issues = getQuestionIssues(
    buildPreviewQuestion({ explanation, options, prompt, question, questionOrder: defaultQuestionOrder, questionType, xp }),
  );

  return (
    <form data-unsaved={draft !== savedDraft || saving} action={async formData => {
      const submitted = draft; setSaving(true); setSaveError("");
      try { formData.set("stayInEditor", "true"); await saveQuizQuestion(formData); setSavedDraft(submitted); onSaved?.(); }
      catch (error) { setSaveError(error instanceof Error ? error.message : "Question could not be saved."); }
      finally { setSaving(false); }
    }} className="mt-4 space-y-4">
      {saveError && <p role="alert" className="text-sm text-[var(--ui-danger)]">{saveError}</p>}
      <fieldset disabled={saving} className="contents">
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="quizId" type="hidden" value={quizId} />
      <input name="questionId" type="hidden" value={question?.id ?? ""} />
      <input name="questionType" type="hidden" value={questionType} />
      <input name="questionOrder" type="hidden" value={question?.question_order ?? defaultQuestionOrder} />

      <div className="flex flex-wrap gap-2">
        {questionTypeOptions.map((option) => (
          <button
            className={pillButtonClasses(questionType === option.value)}
            key={option.value}
            onClick={() => setType(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <input
        className="w-full border-0 border-b border-[var(--ui-control-border)] bg-transparent px-0.5 py-2 text-base font-black text-[var(--ui-text)] outline-none focus:border-[var(--ui-focus)]"
        name="prompt"
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Write the question"
        required
        value={prompt}
      />

      <div className="grid gap-2">
        {options.map((option, index) => (
          <div className="flex items-center gap-2.5" key={option.id}>
            <button
              aria-label={option.isCorrect ? "Marked correct" : "Mark as correct"}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
                option.isCorrect
                  ? "border-[var(--ui-action)] bg-[var(--ui-action)] text-[var(--ui-on-action)]"
                  : "border-[var(--ui-border-subtle)] text-transparent",
              )}
              onClick={() => markCorrect(index)}
              type="button"
            >
              <CheckIcon className="h-3 w-3" />
            </button>
            {questionType === "true_false" ? (
              <span className="flex-1 border-b border-[var(--ui-border-subtle)] px-0.5 py-1.5 text-sm font-semibold text-[var(--ui-text)]">
                {option.label}
              </span>
            ) : (
              <input
                className="flex-1 border-0 border-b border-[var(--ui-control-border)] bg-transparent px-0.5 py-1.5 text-sm font-semibold text-[var(--ui-text)] outline-none focus:border-[var(--ui-focus)]"
                name={`option${index + 1}`}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)),
                  )
                }
                placeholder="Answer option"
                value={option.label}
              />
            )}
            {questionType === "true_false" ? <input name={`option${index + 1}`} type="hidden" value={option.label} /> : null}
            <input name={`correct${index + 1}`} type="hidden" value={option.isCorrect ? "on" : ""} />
            {options.length > 2 && questionType !== "true_false" ? (
              <button
                aria-label="Remove option"
                className="shrink-0 text-[var(--ui-text-muted)] hover:text-[var(--ui-warning)]"
                onClick={() => removeOption(index)}
                type="button"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        {options.length < 4 && questionType !== "true_false" ? (
          <button
            className="self-start text-xs font-black text-[var(--ui-action)]"
            onClick={addOption}
            type="button"
          >
            + Add option
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className={labelClasses()}>Explanation shown after answering</span>
        <textarea
          className={cn(fieldClasses(), "min-h-[52px] resize-none")}
          name="explanation"
          onChange={(event) => setExplanation(event.target.value)}
          placeholder="Why is this the correct answer?"
          value={explanation}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-[var(--ui-text-muted)]">Worth</span>
          <input
            className="w-[70px] rounded-[12px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)] px-2.5 py-2 text-sm font-black text-[var(--ui-text)] outline-none"
            max={20}
            min={1}
            name="xp"
            onChange={(event) => setXp(Number(event.target.value))}
            required
            type="number"
            value={xp}
          />
          <span className="text-xs font-bold text-[var(--ui-text-muted)]">XP</span>
        </div>
        <div className="flex items-center gap-2">
          {issues.length > 0 ? <AdminStatusBadge tone="warning">{issues.length} issue{issues.length === 1 ? "" : "s"}</AdminStatusBadge> : null}
          <PendingSubmitButton
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--ui-action)] px-4 text-xs font-black text-[var(--ui-on-action)] transition hover:brightness-95"
            label={question ? "Save question" : "Create question"}
            pendingLabel="Saving question..."
            type="submit"
          />
        </div>
      </div>
      {issues.length > 0 ? (
        <ul className="space-y-1 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
          {issues.map((issue) => (
            <li key={issue.message}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
      </fieldset>
    </form>
  );
}

function SortableQuestionCard({
  children,
  isFirst,
  isLast,
  onDeleteRequest,
  onDuplicate,
  onMove,
  question,
}: {
  children: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  onDeleteRequest: (question: AdminQuizQuestionRow) => void;
  onDuplicate: (question: AdminQuizQuestionRow) => void;
  onMove: (question: AdminQuizQuestionRow, direction: "up" | "down") => void;
  question: AdminQuizQuestionRow;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      className={cn(
        "rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4 shadow-sm",
        isDragging && "opacity-80 shadow-lg",
      )}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AdminDragHandle attributes={attributes} label={`question ${question.question_order}`} listeners={listeners} />
          <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
            Question {question.question_order}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex min-h-8 items-center justify-center rounded-[10px] border border-[var(--ui-border-subtle)] px-2.5 text-xs font-black text-[var(--ui-text-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isFirst}
            onClick={() => onMove(question, "up")}
            title="Move question up"
            type="button"
          >
            ↑
          </button>
          <button
            className="inline-flex min-h-8 items-center justify-center rounded-[10px] border border-[var(--ui-border-subtle)] px-2.5 text-xs font-black text-[var(--ui-text-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLast}
            onClick={() => onMove(question, "down")}
            title="Move question down"
            type="button"
          >
            ↓
          </button>
          <button
            className="text-xs font-black text-[var(--ui-text-muted)] hover:text-[var(--ui-action)]"
            onClick={() => onDuplicate(question)}
            type="button"
          >
            Duplicate
          </button>
          <button
            className="text-xs font-black text-[var(--ui-warning)]"
            onClick={() => onDeleteRequest(question)}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
      {children}
    </article>
  );
}

function RetakeRulesCard({ courseId, lesson }: { courseId: string; lesson: AdminLessonRow }) {
  const [retryMode, setRetryMode] = useState<RetryMode>((lesson.retry_mode as RetryMode) ?? "anytime");
  const [cooldownHours, setCooldownHours] = useState(() =>
    Math.max(1, Math.round((lesson.retry_cooldown_seconds ?? 3600) / 3600)),
  );

  return (
    <form data-unsaved={retryMode !== (lesson.retry_mode ?? "anytime") || cooldownHours !== Math.max(1, Math.round((lesson.retry_cooldown_seconds ?? 3600) / 3600))} action={saveLesson} className="space-y-4 rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4">
      <input name="courseId" type="hidden" value={courseId} />
      <input name="returnTo" type="hidden" value="quiz" />
      <input name="lessonId" type="hidden" value={lesson.id} />
      <input name="title" type="hidden" value={lesson.title} />
      <input name="description" type="hidden" value={lesson.description ?? ""} />
      <input name="coverImageUrl" type="hidden" value={getCoverImageValue(lesson.cover_image, "src")} />
      <input name="coverImageAlt" type="hidden" value={getCoverImageValue(lesson.cover_image, "alt")} />
      <input name="status" type="hidden" value={lesson.status} />
      <input name="sortOrder" type="hidden" value={lesson.sort_order} />
      <input name="estimatedMinutes" type="hidden" value={lesson.estimated_minutes} />
      <input name="retryCooldownSeconds" type="hidden" value={cooldownHours * 3600} />

      <span className={labelClasses()}>Retake rules</span>

      <div className="space-y-2">
        <span className="text-sm font-bold text-[var(--ui-text)]">When can a learner retake this quiz?</span>
        <div className="flex flex-wrap gap-2">
          {retryModeOptions.map((option) => (
            <button
              className={pillButtonClasses(retryMode === option.value)}
              key={option.value}
              onClick={() => setRetryMode(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <input name="retryMode" type="hidden" value={retryMode} />
      </div>

      {retryMode === "cooldown" ? (
        <div className="flex items-center gap-2.5">
          <input
            className="w-20 rounded-[12px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)] px-3 py-2 text-sm font-black text-[var(--ui-text)] outline-none"
            min={1}
            onChange={(event) => setCooldownHours(Math.max(1, Number(event.target.value) || 1))}
            type="number"
            value={cooldownHours}
          />
          <span className="text-xs font-bold text-[var(--ui-text-muted)]">hours before they can try again</span>
        </div>
      ) : null}

      <label className="flex items-start gap-2.5">
        <input className="peer sr-only" defaultChecked={lesson.retry_requires_reread ?? true} name="retryRequiresReread" type="checkbox" />
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-[var(--ui-border-subtle)] text-transparent peer-checked:border-[var(--ui-action)] peer-checked:bg-[var(--ui-action)] peer-checked:text-[var(--ui-on-action)]">
          <CheckIcon className="h-3 w-3" />
        </span>
        <span className="text-sm font-bold text-[var(--ui-text)]">Require re-reading the lesson before a retry</span>
      </label>

      <div className="flex items-center gap-2.5">
        <input
          className="w-[100px] rounded-[12px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)] px-3 py-2 text-sm font-black text-[var(--ui-text)] outline-none"
          defaultValue={lesson.max_earning_attempts ?? ""}
          min={0}
          name="maxEarningAttempts"
          placeholder="Unlimited"
          type="number"
        />
        <span className="text-xs font-bold text-[var(--ui-text-muted)]">attempts that can earn XP (blank = unlimited)</span>
      </div>

      <label className="flex items-start gap-2.5">
        <input
          className="peer sr-only"
          defaultChecked={lesson.quiz_requires_lesson_completion ?? true}
          name="quizRequiresLessonCompletion"
          type="checkbox"
        />
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-[var(--ui-border-subtle)] text-transparent peer-checked:border-[var(--ui-action)] peer-checked:bg-[var(--ui-action)] peer-checked:text-[var(--ui-on-action)]">
          <CheckIcon className="h-3 w-3" />
        </span>
        <span className="text-sm font-bold text-[var(--ui-text)]">
          Quiz requires lesson completion
          <span className="block text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
            Learners must read every page before the quiz becomes available.
          </span>
        </span>
      </label>

      <button
        className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--ui-action)] px-4 text-xs font-black text-[var(--ui-on-action)] transition hover:brightness-95"
        type="submit"
      >
        Save retake rules
      </button>
    </form>
  );
}

export function AssessmentBuilder({
  lesson,
  questions,
  quiz,
  aiEnabled = false,
  initialResultId,
}: {
  aiEnabled?: boolean;
  initialResultId?: string;
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
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const editorRef = useRef<HTMLElement | null>(null);
  async function beforeAiAction() {
    const root = editorRef.current;
    const changedInput = root && [...root.querySelectorAll<HTMLInputElement>("input")].some(input =>
      input.type === "checkbox" ? input.checked !== input.defaultChecked : input.name === "quizTitle" && input.value !== input.defaultValue);
    if (isPending || isDeletePending || root?.querySelector('[data-unsaved="true"]') || changedInput) {
      throw new Error("Save your quiz changes before using AI. Your inputs are still in the editor.");
    }
  }
  useEffect(() => {
    setOrderedQuestions([...questions].sort((first, second) => first.question_order - second.question_order));
    setDeleteTarget((current) => current && !questions.some((question) => question.id === current.id) ? null : current);
  }, [questions]);
  const [isPending, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const issues = getAssessmentIssues(orderedQuestions);
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

  function moveQuestion(question: AdminQuizQuestionRow, direction: "up" | "down") {
    const currentIndex = orderedQuestions.findIndex((item) => item.id === question.id);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedQuestions.length) {
      return;
    }

    const previousQuestions = orderedQuestions;
    const nextQuestions = [...orderedQuestions];
    const [movedQuestion] = nextQuestions.splice(currentIndex, 1);
    nextQuestions.splice(nextIndex, 0, movedQuestion);
    persistQuestionOrder(
      nextQuestions.map((item, index) => ({ ...item, question_order: index + 1 })),
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
    <section ref={editorRef} className="mt-6 space-y-5">
      <div className="rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <form action={saveQuizSettings} className="space-y-4">
            <input name="lessonId" type="hidden" value={lesson.id} />
            <input name="quizId" type="hidden" value={quiz.id} />
            {/* Quiz visibility follows the lesson's own status, not an independent
                draft/published/archived toggle — pass the stored value through
                unchanged rather than exposing a second status control here. */}
            <input name="quizStatus" type="hidden" value={quiz.status} />
            <div>
              <p className={labelClasses()}>Quiz</p>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-2xl font-black text-[var(--ui-text)] outline-none"
                defaultValue={quiz.title}
                name="quizTitle"
                required
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PendingSubmitButton
                className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--ui-action)] px-4 text-xs font-black text-[var(--ui-on-action)] transition hover:brightness-95"
                label="Save quiz title"
                pendingLabel="Saving title..."
                type="submit"
              />
              <Link
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--ui-border-subtle)] px-4 text-xs font-black text-[var(--ui-text-muted)] transition hover:text-[var(--ui-action)]"
                href={`/admin/courses/lessons/${lesson.id}/preview?section=quiz`}
              >
                Preview quiz
              </Link>
            </div>
          </form>

          <div className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)] p-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color:color-mix(in_srgb,var(--ui-action)_16%,transparent)] px-3 text-xs font-black text-[var(--ui-action)]">
                {formatXpLabel(totalXp)} total
              </span>
              <AdminStatusBadge tone={errorCount > 0 ? "danger" : "good"}>
                {errorCount} blocker{errorCount === 1 ? "" : "s"}
              </AdminStatusBadge>
              <AdminStatusBadge tone={warningCount > 0 ? "warning" : "good"}>
                {warningCount} warning{warningCount === 1 ? "" : "s"}
              </AdminStatusBadge>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-[var(--ui-text-muted)]">
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
                  <li className="rounded-[10px] bg-[var(--ui-surface)] px-3 py-2" key={`${issue.message}-${index}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <RetakeRulesCard courseId={lesson.course_id} lesson={lesson} />

      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={labelClasses()}>Question list</p>
            <h2 className="mt-1 text-lg font-black">{orderedQuestions.length} questions</h2>
            {orderMessage ? (
              <p className="mt-2 text-xs font-black text-[var(--ui-text-muted)]">{orderMessage}</p>
            ) : null}
          </div>
          <AdminStatusBadge tone={isPending ? "warning" : "neutral"}>
            {isPending ? "Saving order" : "Drag to reorder"}
          </AdminStatusBadge>
        </div>

        <div className="mt-4 space-y-4">
          {orderedQuestions.length === 0 && !showNewQuestion ? (
            <EmptyAdminState>No quiz questions yet.</EmptyAdminState>
          ) : (
            <DndContext collisionDetection={closestCenter} id="quiz-questions-dnd" onDragEnd={handleDragEnd} sensors={sensors}>
              <SortableContext items={orderedQuestions.map((question) => question.id)} strategy={verticalListSortingStrategy}>
                {orderedQuestions.map((question, index) => (
                  <SortableQuestionCard
                    isFirst={index === 0}
                    isLast={index === orderedQuestions.length - 1}
                    key={question.id}
                    onDeleteRequest={setDeleteTarget}
                    onDuplicate={(target) => {
                      const formData = new FormData();
                      formData.set("lessonId", lesson.id);
                      formData.set("quizId", quiz.id);
                      formData.set("questionId", target.id);
                      void duplicateQuizQuestion(formData);
                    }}
                    onMove={moveQuestion}
                    question={question}
                  >
                    <QuestionCardFields
                      defaultQuestionOrder={question.question_order}
                      lessonId={lesson.id}
                      question={question}
                      quizId={quiz.id}
                    />
                  </SortableQuestionCard>
                ))}
              </SortableContext>
            </DndContext>
          )}

          {showNewQuestion ? (
            <article className="rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
                  New question
                </span>
                <button
                  className="text-xs font-black text-[var(--ui-text-muted)] hover:text-[var(--ui-warning)]"
                  onClick={() => setShowNewQuestion(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              <QuestionCardFields onSaved={() => setShowNewQuestion(false)} defaultQuestionOrder={orderedQuestions.length + 1} lessonId={lesson.id} quizId={quiz.id} />
            </article>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[var(--ui-border-subtle)] p-3.5 text-xs font-bold text-[var(--ui-text-muted)] transition hover:border-[var(--ui-action)] hover:text-[var(--ui-action)]"
            onClick={() => setShowNewQuestion(true)}
            type="button"
          >
            <PlusIcon className="h-4 w-4" />
            Add question
          </button>
        </div>
        <AiAssistanceAuthoring courseId={lesson.course_id} lessonId={lesson.id} kind="quiz" enabled={aiEnabled} initialResultId={initialResultId} beforeAction={beforeAiAction} />
      </div>

      <AlertDialog.Root
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteMessage(null);
          }
        }}
        open={deleteTarget !== null}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Delete question?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--ui-text-muted)]">
              This removes the question and its answer options when no learner attempt history references it.
            </AlertDialog.Description>
            {deleteMessage ? (
              <p className="mt-3 rounded-[12px] border border-[var(--ui-danger-bg)] bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_60%,var(--ui-surface))] px-3 py-2 text-sm font-bold text-[var(--ui-danger)]">
                {deleteMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-inset)] px-4 text-sm font-black text-[var(--ui-text-muted)]"
                type="button"
              >
                Cancel
              </AlertDialog.Cancel>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-[12px] bg-[var(--ui-danger)] px-4 text-sm font-black text-[var(--ui-on-danger)] disabled:cursor-not-allowed disabled:opacity-60"
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
