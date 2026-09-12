"use client";

import Image from "@/components/media/MediaImage";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { CourseAudienceField } from "@/components/admin/CourseAudienceField";
import { CourseCategoryField } from "@/components/admin/CourseCategoryField";
import { CourseOutcomesField } from "@/components/admin/CourseOutcomesField";
import { CourseTitleField } from "@/components/admin/CourseTitleField";
import { useMediaPicker } from "@/components/admin/MediaPickerProvider";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { cn } from "@/lib/utils";
import type {
  AdminCourseRow,
  AdminLearningMediaAssetRow,
} from "@/lib/admin";
import { saveCourse } from "@/app/admin/courses/actions";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-4 py-3 text-sm font-bold text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-focus)] focus:ring-4 focus:ring-[var(--ui-focus)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]";
}

function getImageValue(image: Record<string, unknown> | null | undefined, key: "src" | "alt") {
  const value = image?.[key];
  return typeof value === "string" ? value : "";
}

function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button className="rounded-[14px] bg-[var(--ui-action)] px-5 py-3 text-sm font-black text-[var(--ui-on-action)]" type="submit">
      {children}
    </button>
  );
}

function FlatCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-6 shadow-sm">
      <h3 className="mb-4 border-b border-[var(--ui-border-subtle)] pb-3 text-base font-black text-[var(--ui-text)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function CourseForm({
  aiGenerationAvailable = true,
  categories = [],
  course,
  derivedMinutes,
  mediaLibraryAssets = [],
  nextSortOrder = 0,
  stickyFooter = false,
}: {
  aiGenerationAvailable?: boolean;
  categories?: string[];
  course?: AdminCourseRow | null;
  derivedMinutes?: number;
  mediaLibraryAssets?: AdminLearningMediaAssetRow[];
  nextSortOrder?: number;
  stickyFooter?: boolean;
}) {
  const estimatedMinutes = derivedMinutes ?? course?.estimated_minutes ?? 0;
  const sortOrder = course?.sort_order ?? nextSortOrder;
  const currentCategory = (course?.category ?? "Values Education").trim() || "Values Education";
  const isNewCourse = !course?.id;
  const thumbnail = course?.thumbnail ?? null;
  const { requestMedia } = useMediaPicker();
  const formRef = useRef<HTMLFormElement>(null);
  const savedFieldsRef = useRef("");
  useEffect(() => { if (formRef.current) savedFieldsRef.current = JSON.stringify([...new FormData(formRef.current).entries()]); }, [course?.id]);
  const [cover, setCover] = useState({
    altText: getImageValue(thumbnail, "alt"),
    fit: typeof thumbnail?.fit === "string" ? thumbnail.fit : "cover",
    positionX: typeof thumbnail?.positionX === "number" ? thumbnail.positionX : 50,
    positionY: typeof thumbnail?.positionY === "number" ? thumbnail.positionY : 50,
    url: getImageValue(thumbnail, "src"),
  });

  async function pickCover() {
    const picked = await requestMedia({
      aiGenerationAvailable,
      assetTypeFilter: ["cover", "image", "thumbnail"],
      initialAltText: cover.altText,
      initialFit: cover.fit,
      initialPositionX: cover.positionX,
      initialPositionY: cover.positionY,
      initialUrl: cover.url,
      libraryAssets: mediaLibraryAssets,
      imageDraft: {
        beforeAction: async () => {
          if (formRef.current && JSON.stringify([...new FormData(formRef.current).entries()]) !== savedFieldsRef.current) throw new Error("Save your course changes before generating an image. Your edits are still here.");
          return 0;
        },
        onApplied: () => {},
      },
      placementLabel: "Course thumbnail",
      title: "Choose a cover image",
      uploadContext: course?.id ? {
        assetType: "thumbnail",
        courseId: course.id,
        placement: "course_thumbnail",
      } : undefined,
    });

    if (picked) setCover(picked);
  }

  return (
    <form ref={formRef} action={saveCourse} className="flex flex-col gap-6">
      <input name="courseId" type="hidden" value={course?.id ?? ""} />
      <input name="sortOrder" type="hidden" value={sortOrder} />
      <input name="estimatedMinutes" type="hidden" value={estimatedMinutes} />
      {isNewCourse ? <input name="status" type="hidden" value="draft" /> : null}
      <div className={cn("grid gap-6 md:grid-cols-12", stickyFooter && "pb-24")}>
        <div className="flex flex-col gap-6 md:col-span-8">
          <FlatCard title="Course Title &amp; Category">
            <CourseTitleField defaultValue={course?.title ?? ""} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <CourseCategoryField categories={categories} currentCategory={currentCategory} />
              <label>
                <span className={labelClasses()}>Difficulty Level</span>
                <AdminSelect
                  className="mt-2"
                  defaultValue={course?.level ?? "beginner"}
                  name="level"
                  options={[
                    { label: "Beginner", value: "beginner" },
                    { label: "Intermediate", value: "intermediate" },
                    { label: "Advanced", value: "advanced" },
                  ]}
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className={labelClasses()}>Brief Description</span>
              <textarea
                className={`${fieldClasses()} min-h-28 resize-none`}
                name="description"
                placeholder="Summarize the core value of this course..."
                required
                defaultValue={course?.description ?? ""}
              />
            </label>
          </FlatCard>

          <FlatCard title="Pedagogy &amp; Targeting">
            <CourseAudienceField defaultValue={course?.intended_audience ?? ""} />
            <div className="mt-5">
              <CourseOutcomesField defaultValue={course?.learning_outcomes ?? []} />
            </div>
          </FlatCard>

          {!isNewCourse ? (
            <FlatCard title="Publishing and pacing">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Status</span>
                  <AdminSelect
                    className="mt-2"
                    defaultValue={course?.status ?? "draft"}
                    name="status"
                    options={[
                      { label: "Draft", value: "draft" },
                      { label: "Published", value: "published" },
                      { label: "Archived", value: "archived" },
                    ]}
                  />
                  {course?.ai_generated ? (
                    <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
                      Learners can see the course before all lessons are published.
                    </p>
                  ) : null}
                </label>
                <div className="rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] px-4 py-3">
                  <span className={labelClasses()}>Minutes</span>
                  <p className="mt-2 text-sm font-black tabular-nums">{estimatedMinutes}</p>
                  <p className="mt-1 text-[11px] font-bold text-[var(--ui-text-muted)]">From lessons</p>
                </div>
              </div>
            </FlatCard>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 md:col-span-4">
          <FlatCard title="Course Cover">
            <input name="thumbnailUrl" type="hidden" value={cover.url} />
            <input name="thumbnailAlt" type="hidden" value={cover.altText} />
            <input name="imageFit" type="hidden" value={cover.fit} />
            <input name="imagePositionX" type="hidden" value={cover.positionX} />
            <input name="imagePositionY" type="hidden" value={cover.positionY} />
            <button
              className="relative block h-40 w-full overflow-hidden rounded-[14px] text-left"
              onClick={() => {
                void pickCover();
              }}
              type="button"
            >
              {cover.url ? (
                <>
                  <Image
                    alt={cover.altText}
                    className={getImageFitClass(cover)}
                    fill
                    sizes="320px"
                    src={cover.url}
                    style={getImagePresentationStyle(cover)}
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/55 to-transparent p-3">
                    <span className="text-xs font-bold text-white/90">Cover image &middot; click to change</span>
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] text-[var(--ui-text-muted)]">
                  <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect height="14" rx="2" width="18" x="3" y="5" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m21 16-5-4-4 3-3-2-6 5" />
                  </svg>
                  <span className="text-xs font-bold">Add a cover image</span>
                </div>
              )}
            </button>
          </FlatCard>
        </div>
      </div>

      {stickyFooter ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-end gap-3 border-t border-[var(--ui-border-subtle)] bg-[var(--ui-surface)]/95 p-4 backdrop-blur md:left-72">
          <button
            className="rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-6 py-3 text-sm font-bold text-[var(--ui-action)] transition hover:bg-[var(--ui-surface-soft)]"
            name="returnTo"
            type="submit"
            value="index"
          >
            Save as Draft
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-[var(--ui-action)] px-8 py-3 text-sm font-bold text-[var(--ui-on-action)] transition hover:brightness-95"
            type="submit"
          >
            Create Workspace →
          </button>
        </div>
      ) : (
        <SubmitButton>Save course</SubmitButton>
      )}
    </form>
  );
}
