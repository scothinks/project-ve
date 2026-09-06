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
import Image from "@/components/media/MediaImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  reorderCourseLessons,
  saveLessonCover,
} from "@/app/admin/courses/actions";
import { AdminDragHandle } from "@/components/admin/AdminDragHandle";
import { useMediaPicker } from "@/components/admin/MediaPickerProvider";
import { SparkleIcon } from "@/components/ui/Icons";
import type { AdminLearningMediaAssetRow } from "@/lib/admin";
import { coverAccent } from "@/lib/gradient-accent";
import { cn } from "@/lib/utils";

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export type CurriculumLesson = {
  aiGenerated: boolean;
  aiMediaStatus: string;
  aiPublishStatus: string;
  aiTextStatus: string;
  coverImage: Record<string, unknown> | null;
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

function statusPillClasses(status: string) {
  if (status === "published") {
    return "bg-[#e6f4ea] text-[#0b5a3a]";
  }
  if (status === "archived") {
    return "bg-[var(--admin-surface-container-low)] text-[var(--admin-outline)]";
  }
  return "bg-[var(--admin-surface-container)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}


function iconButtonClasses() {
  return "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition hover:bg-[var(--admin-surface-container-low)] disabled:cursor-not-allowed disabled:opacity-35";
}

function LessonThumbButton({
  aiGenerationAvailable,
  courseId,
  index,
  lesson,
  mediaLibraryAssets,
}: {
  aiGenerationAvailable?: boolean;
  courseId: string;
  index: number;
  lesson: CurriculumLesson;
  mediaLibraryAssets: AdminLearningMediaAssetRow[];
}) {
  const { requestMedia } = useMediaPicker();
  const src = typeof lesson.coverImage?.src === "string" ? lesson.coverImage.src : "";
  const hasCover = src.trim().length > 0;

  async function pickCover() {
    const picked = await requestMedia({
      aiGenerationAvailable,
      assetTypeFilter: ["cover", "image", "thumbnail"],
      initialAltText: typeof lesson.coverImage?.alt === "string" ? lesson.coverImage.alt : "",
      initialUrl: src,
      libraryAssets: mediaLibraryAssets,
      mediaKind: "image",
      placementLabel: "Lesson cover",
      title: "Choose a lesson thumbnail",
      uploadContext: {
        assetType: "thumbnail",
        courseId,
        lessonId: lesson.id,
        placement: "lesson_thumbnail",
      },
    });

    if (!picked) return;

    const formData = new FormData();
    formData.set("lessonId", lesson.id);
    formData.set("courseId", courseId);
    formData.set("coverImageUrl", picked.url);
    formData.set("coverImageAlt", picked.altText);
    await saveLessonCover(formData);
  }

  return (
    <button
      aria-label={`Change cover for ${lesson.title}`}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] text-sm font-black text-white/90"
      onClick={() => {
        void pickCover();
      }}
      style={{ background: hasCover ? undefined : `linear-gradient(135deg, ${coverAccent(lesson.id)})` }}
      type="button"
    >
      {hasCover ? (
        <Image alt="" className="object-cover" fill sizes="44px" src={src} />
      ) : (
        index + 1
      )}
    </button>
  );
}

function SortableLessonRow({
  aiGenerationAvailable,
  courseId,
  index,
  isPending,
  lesson,
  mediaLibraryAssets,
  onDuplicateLesson,
  requestArchive,
}: {
  aiGenerationAvailable?: boolean;
  courseId: string;
  index: number;
  isPending: boolean;
  lesson: CurriculumLesson;
  mediaLibraryAssets: AdminLearningMediaAssetRow[];
  onDuplicateLesson: (lesson: CurriculumLesson) => void;
  requestArchive: (lesson: CurriculumLesson) => void;
}) {
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
        "flex items-center gap-3 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-3 py-2.5 transition",
        isDragging && "border-[color:color-mix(in_srgb,var(--admin-primary-container)_40%,var(--admin-border-warm))] opacity-80 shadow-lg",
      )}
      ref={setNodeRef}
      style={style}
    >
      <AdminDragHandle attributes={attributes} label={lesson.title} listeners={listeners} />
      <LessonThumbButton
        aiGenerationAvailable={aiGenerationAvailable}
        courseId={courseId}
        index={index}
        lesson={lesson}
        mediaLibraryAssets={mediaLibraryAssets}
      />
      <Link
        className="min-w-0 flex-1 py-0.5"
        href={`/admin/courses/lessons/${lesson.id}`}
      >
        <span className="block truncate text-[15px] font-extrabold text-[var(--admin-on-surface)]">{lesson.title}</span>
        <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
          {lesson.pageCount} pages &middot; {lesson.estimatedMinutes} min
        </span>
      </Link>
      <span className={cn("rounded-full px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em]", statusPillClasses(lesson.status))}>
        {statusLabel(lesson.status)}
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger aria-label={`More actions for ${lesson.title}`} className={iconButtonClasses()} type="button">
          ⋯
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 min-w-56 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-2 shadow-xl"
            sideOffset={6}
          >
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
    </article>
  );
}

export function CurriculumOutlineEditor({
  aiGenerationAvailable,
  aiSuggestHref,
  courseId,
  lessons,
  mediaLibraryAssets = [],
}: {
  aiGenerationAvailable?: boolean;
  aiSuggestHref?: string;
  courseId: string;
  lessons: CurriculumLesson[];
  mediaLibraryAssets?: AdminLearningMediaAssetRow[];
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

  async function archiveLesson(lesson: CurriculumLesson) {
    setArchiveTarget(null);
    setMessage(null);
    const previousLessons = orderedLessons;
    setOrderedLessons((current) =>
      current.map((item) => (item.id === lesson.id ? { ...item, status: "archived" } : item)),
    );

    try {
      const response = await fetch("/api/admin/learning/lessons/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId: lesson.id }),
      });
      const payload = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Lesson could not be archived.");
      }

      setMessage("Lesson archived.");
    } catch (error) {
      setOrderedLessons(previousLessons);
      setMessage(error instanceof Error ? error.message : "Lesson could not be archived.");
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

  return (
    <div className="space-y-5">
      <section className="space-y-5">
        {message ? (
          <p className="text-sm font-black text-[var(--admin-on-surface-variant)]">{message}</p>
        ) : null}

        {orderedLessons.length === 0 ? (
          <p className="rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] py-10 text-center text-sm font-bold text-[var(--admin-on-surface-variant)]">
            No lessons yet.
          </p>
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            id="curriculum-lessons-dnd"
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
                    aiGenerationAvailable={aiGenerationAvailable}
                    courseId={courseId}
                    index={index}
                    isPending={isPending || duplicatingLessonId === lesson.id}
                    key={lesson.id}
                    lesson={lesson}
                    mediaLibraryAssets={mediaLibraryAssets}
                    onDuplicateLesson={duplicateLesson}
                    requestArchive={setArchiveTarget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex gap-2.5">
          <button
            className="flex flex-1 items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[var(--admin-border-warm)] p-[18px] text-sm font-extrabold text-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || isCreatingLesson}
            onClick={createLesson}
            type="button"
          >
            <PlusIcon />
            {isCreatingLesson ? "Adding..." : "Add lesson"}
          </button>
          {aiSuggestHref ? (
            <Link
              className="flex flex-1 items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[var(--admin-accent-violet,#8d68f2)] p-[18px] text-sm font-extrabold text-[var(--admin-accent-violet,#8d68f2)]"
              href={aiSuggestHref}
            >
              <SparkleIcon className="h-4 w-4" />
              Suggest lessons with AI
            </Link>
          ) : null}
        </div>
      </section>

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
                <AlertDialog.Action
                  className={buttonClasses("danger")}
                  onClick={() => {
                    void archiveLesson(archiveTarget);
                  }}
                  type="button"
                >
                  Archive lesson
                </AlertDialog.Action>
              ) : null}
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
