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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  archiveLessonFromCurriculum,
  reorderCourseLessons,
} from "@/app/admin/courses/actions";
import { AdminStatusBadge, EmptyAdminState } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

export type CurriculumLesson = {
  aiGenerated: boolean;
  aiMediaStatus: string;
  aiPublishStatus: string;
  aiTextStatus: string;
  description: string | null;
  estimatedMinutes: number;
  failedMediaCount: number;
  hasQuiz: boolean;
  id: string;
  mediaPendingCount: number;
  pageCount: number;
  questionCount: number;
  sortOrder: number;
  status: string;
  title: string;
};

function buttonClasses(tone: "primary" | "secondary" | "danger" = "secondary") {
  const base = "inline-flex min-h-10 items-center justify-center rounded-[12px] px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60";

  if (tone === "primary") {
    return cn(base, "bg-[var(--admin-primary-container)] text-white hover:brightness-95");
  }

  if (tone === "danger") {
    return cn(
      base,
      "bg-[color:color-mix(in_srgb,var(--admin-error-container)_74%,var(--admin-surface-milk))] text-[var(--admin-error)]",
    );
  }

  return cn(
    base,
    "border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary-container)]",
  );
}

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "archived") return "danger" as const;
  return "warning" as const;
}

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested" || status === "not_ready") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
}

function lessonIssues(lesson: CurriculumLesson) {
  const issues: string[] = [];

  if (lesson.status === "archived") {
    issues.push("Archived");
  } else if (lesson.status !== "published") {
    issues.push("Draft");
  }

  if (lesson.pageCount === 0) {
    issues.push("Missing pages");
  }

  if (!lesson.hasQuiz) {
    issues.push("Quiz missing");
  } else if (lesson.questionCount === 0) {
    issues.push("Quiz incomplete");
  }

  if (lesson.failedMediaCount > 0) {
    issues.push(`${lesson.failedMediaCount} failed media`);
  } else if (lesson.mediaPendingCount > 0) {
    issues.push("Media needs review");
  }

  if (lesson.aiGenerated) {
    if (lesson.aiTextStatus === "changes_requested" || lesson.aiMediaStatus === "changes_requested") {
      issues.push("Changes requested");
    } else if (lesson.aiPublishStatus !== "ready" && lesson.aiPublishStatus !== "published") {
      issues.push("Review gates pending");
    }
  }

  return Array.from(new Set(issues));
}

function readinessTone(lesson: CurriculumLesson) {
  const issues = lessonIssues(lesson).filter((issue) => issue !== "Archived");

  if (lesson.status === "archived") return "danger" as const;
  if (issues.length === 0) return "good" as const;
  if (issues.some((issue) => issue.includes("failed") || issue === "Changes requested")) return "danger" as const;
  return "warning" as const;
}

function readinessLabel(lesson: CurriculumLesson) {
  if (lesson.status === "archived") return "Archived";
  return lessonIssues(lesson).filter((issue) => issue !== "Archived").length === 0
    ? "Ready"
    : "Needs attention";
}

function SortableLessonRow({
  index,
  isPending,
  lesson,
  lessonCount,
  moveLesson,
  onDuplicateLesson,
  requestArchive,
}: {
  index: number;
  isPending: boolean;
  lesson: CurriculumLesson;
  lessonCount: number;
  moveLesson: (fromIndex: number, toIndex: number) => void;
  onDuplicateLesson: (lesson: CurriculumLesson) => void;
  requestArchive: (lesson: CurriculumLesson) => void;
}) {
  const issues = lessonIssues(lesson);
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: lesson.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      className={cn(
        "rounded-[16px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-4 shadow-sm transition",
        isDragging && "border-[color:color-mix(in_srgb,var(--admin-primary-container)_40%,var(--admin-border-warm))] opacity-80 shadow-lg",
      )}
      ref={setNodeRef}
      style={style}
    >
      <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-start">
        <button
          aria-label={`Drag ${lesson.title}`}
          className="flex min-h-12 min-w-12 items-center justify-center rounded-[12px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-container-low)] text-lg font-black text-[var(--admin-on-surface-variant)] touch-none"
          type="button"
          {...attributes}
          {...listeners}
        >
          ::
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-xs font-black text-[var(--admin-on-primary)]">
              {index + 1}
            </span>
            <Link
              className="text-lg font-black text-[var(--admin-ink-charcoal)] hover:text-[var(--admin-primary)]"
              href={`/admin/courses/lessons/${lesson.id}`}
            >
              {lesson.title}
            </Link>
            <AdminStatusBadge tone={statusTone(lesson.status)}>{lesson.status}</AdminStatusBadge>
            <AdminStatusBadge tone={readinessTone(lesson)}>{readinessLabel(lesson)}</AdminStatusBadge>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
            {lesson.description || "No lesson description yet."}
          </p>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-[var(--admin-on-surface-variant)] sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[14px] bg-[var(--admin-surface-container-low)] px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em]">Pages</p>
              <p className="mt-2 font-black text-[var(--admin-ink-charcoal)]">{lesson.pageCount}</p>
            </div>
            <div className="rounded-[14px] bg-[var(--admin-surface-container-low)] px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em]">Quiz</p>
              <p className="mt-2 font-black text-[var(--admin-ink-charcoal)]">
                {lesson.hasQuiz ? `${lesson.questionCount} questions` : "Missing"}
              </p>
            </div>
            <div className="rounded-[14px] bg-[var(--admin-surface-container-low)] px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em]">Media</p>
              <p className="mt-2 font-black text-[var(--admin-ink-charcoal)]">
                {lesson.failedMediaCount > 0 ? `${lesson.failedMediaCount} failed` : `${lesson.mediaPendingCount} pending`}
              </p>
            </div>
            <div className="rounded-[14px] bg-[var(--admin-surface-container-low)] px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em]">Duration</p>
              <p className="mt-2 font-black text-[var(--admin-ink-charcoal)]">{lesson.estimatedMinutes} min</p>
            </div>
          </div>
          {issues.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {issues.map((issue) => (
                <AdminStatusBadge key={issue} tone={issue.includes("failed") || issue === "Changes requested" ? "danger" : "warning"}>
                  {issue}
                </AdminStatusBadge>
              ))}
            </div>
          ) : null}
          {lesson.aiGenerated ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminStatusBadge tone={workflowTone(lesson.aiTextStatus)}>
                Text {lesson.aiTextStatus.replaceAll("_", " ")}
              </AdminStatusBadge>
              <AdminStatusBadge tone={workflowTone(lesson.aiMediaStatus)}>
                Media {lesson.aiMediaStatus.replaceAll("_", " ")}
              </AdminStatusBadge>
              <AdminStatusBadge tone={workflowTone(lesson.aiPublishStatus)}>
                Publish {lesson.aiPublishStatus.replaceAll("_", " ")}
              </AdminStatusBadge>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            className={buttonClasses()}
            disabled={isPending || index === 0}
            onClick={() => moveLesson(index, index - 1)}
            type="button"
          >
            Move up
          </button>
          <button
            className={buttonClasses()}
            disabled={isPending || index === lessonCount - 1}
            onClick={() => moveLesson(index, index + 1)}
            type="button"
          >
            Move down
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={buttonClasses()} type="button">
              More
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 min-w-56 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-2 shadow-xl"
                sideOffset={6}
              >
                <DropdownMenu.Item asChild>
                  <Link
                    className="block rounded-[10px] px-3 py-2 text-sm font-bold outline-none hover:bg-[var(--admin-surface-container-low)]"
                    href={`/admin/courses/lessons/${lesson.id}`}
                  >
                    Edit lesson
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <button
                    className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold outline-none hover:bg-[var(--admin-surface-container-low)]"
                    disabled={isPending}
                    onClick={() => onDuplicateLesson(lesson)}
                    type="button"
                  >
                    Duplicate lesson
                  </button>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-[var(--admin-border-warm)]" />
                <DropdownMenu.Item asChild>
                  <button
                    className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold text-[var(--admin-error)] outline-none hover:bg-[var(--admin-surface-container-low)]"
                    disabled={lesson.status === "archived"}
                    onClick={() => requestArchive(lesson)}
                    type="button"
                  >
                    Archive lesson
                  </button>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </article>
  );
}

export function CurriculumOutlineEditor({
  courseId,
  lessons,
}: {
  courseId: string;
  lessons: CurriculumLesson[];
}) {
  const sortedLessons = useMemo(
    () => [...lessons].sort((first, second) => first.sortOrder - second.sortOrder),
    [lessons],
  );
  const router = useRouter();
  const [orderedLessons, setOrderedLessons] = useState(sortedLessons);
  const [archiveTarget, setArchiveTarget] = useState<CurriculumLesson | null>(null);
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [duplicatingLessonId, setDuplicatingLessonId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function persistOrder(nextLessons: CurriculumLesson[], previousLessons: CurriculumLesson[]) {
    setOrderedLessons(nextLessons);
    setMessage("Saving lesson order...");
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("lessonIds", JSON.stringify(nextLessons.map((lesson) => lesson.id)));

    try {
      await reorderCourseLessons(formData);
      setMessage("Lesson order saved.");
    } catch (error) {
      setOrderedLessons(previousLessons);
      setMessage(error instanceof Error ? error.message : "Lesson order could not be saved.");
    }
  }

  function moveLesson(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= orderedLessons.length || fromIndex === toIndex) {
      return;
    }

    const previousLessons = orderedLessons;
    const nextLessons = arrayMove(orderedLessons, fromIndex, toIndex);
    startTransition(() => {
      void persistOrder(nextLessons, previousLessons);
    });
  }

  async function createLesson() {
    setIsCreatingLesson(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/learning/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: `Untitled lesson ${orderedLessons.length + 1}`,
          description: "",
          sortOrder: orderedLessons.length + 1,
          estimatedMinutes: 0,
        }),
      });
      const payload = await response.json() as { error?: string; lessonId?: string };

      if (!response.ok || !payload.lessonId) {
        throw new Error(payload.error ?? "Lesson could not be created.");
      }

      router.push(`/admin/courses/lessons/${payload.lessonId}?notice=Lesson%20created.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lesson could not be created.");
      setIsCreatingLesson(false);
    }
  }

  async function duplicateLesson(lesson: CurriculumLesson) {
    setDuplicatingLessonId(lesson.id);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/learning/lessons/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          lessonId: lesson.id,
        }),
      });
      const payload = await response.json() as { error?: string; lessonId?: string };

      if (!response.ok || !payload.lessonId) {
        throw new Error(payload.error ?? "Lesson could not be duplicated.");
      }

      router.push(`/admin/courses/lessons/${payload.lessonId}?notice=Lesson%20duplicated%20as%20a%20draft.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lesson could not be duplicated.");
      setDuplicatingLessonId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedLessons.findIndex((lesson) => lesson.id === active.id);
    const newIndex = orderedLessons.findIndex((lesson) => lesson.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    moveLesson(oldIndex, newIndex);
  }

  const totalIssues = orderedLessons.reduce((count, lesson) => count + lessonIssues(lesson).length, 0);
  const publishedLessons = orderedLessons.filter((lesson) => lesson.status === "published").length;
  const totalDurationMinutes = orderedLessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);
  const completionPercent = orderedLessons.length > 0
    ? Math.round((publishedLessons / orderedLessons.length) * 100)
    : 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {message ? (
              <p className="text-sm font-black text-[var(--admin-on-surface-variant)]">{message}</p>
            ) : null}
          </div>
          <button
            className={buttonClasses("primary")}
            disabled={isPending || isCreatingLesson}
            onClick={createLesson}
            type="button"
          >
            {isCreatingLesson ? "Creating..." : "Add New Lesson"}
          </button>
        </div>

        {orderedLessons.length === 0 ? (
          <EmptyAdminState>No lessons yet.</EmptyAdminState>
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={orderedLessons.map((lesson) => lesson.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {orderedLessons.map((lesson, index) => (
                  <SortableLessonRow
                    index={index}
                    isPending={isPending || duplicatingLessonId === lesson.id}
                    key={lesson.id}
                    lesson={lesson}
                    lessonCount={orderedLessons.length}
                    moveLesson={moveLesson}
                    onDuplicateLesson={duplicateLesson}
                    requestArchive={setArchiveTarget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <aside className="rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
        <h3 className="text-sm font-black text-[var(--admin-on-surface)]">Course Stats</h3>
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            Total Duration
          </p>
          <p className="text-lg font-black text-[var(--admin-ink-charcoal)]">{totalDurationMinutes} mins</p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
              Completion
            </p>
            <span className="text-xs font-bold text-[var(--admin-on-surface-variant)]">
              {publishedLessons} of {orderedLessons.length} Lessons
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--admin-surface-container-high)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary-container)]"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
        {totalIssues > 0 ? (
          <p className="mt-4 text-xs font-bold text-[var(--admin-secondary)]">
            {totalIssues} readiness issue{totalIssues === 1 ? "" : "s"} across this curriculum.
          </p>
        ) : (
          <p className="mt-4 text-xs font-bold text-[var(--admin-primary)]">All lessons are ready.</p>
        )}
      </aside>

      <AlertDialog.Root onOpenChange={(open) => !open && setArchiveTarget(null)} open={archiveTarget !== null}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">Archive lesson?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
              {archiveTarget ? `${archiveTarget.title} will be removed from the active curriculum sequence for learners.` : null}
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className={buttonClasses()} type="button">
                Cancel
              </AlertDialog.Cancel>
              {archiveTarget ? (
                <form action={archiveLessonFromCurriculum}>
                  <input name="courseId" type="hidden" value={courseId} />
                  <input name="lessonId" type="hidden" value={archiveTarget.id} />
                  <AlertDialog.Action className={buttonClasses("danger")} type="submit">
                    Archive lesson
                  </AlertDialog.Action>
                </form>
              ) : null}
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
