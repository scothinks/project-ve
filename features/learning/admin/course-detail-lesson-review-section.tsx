import Image from "next/image";
import Link from "next/link";
import {
  AdminCard,
  AdminPagination,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import {
  isImageMediaAsset,
  isRequiredMediaAsset,
} from "@/lib/ai-media-workflow";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import type {
  AdminLearningMediaAssetRow,
  AdminLessonPageRow,
} from "./data";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type LessonReviewAction = (formData: FormData) => void | Promise<void>;

type CourseDetailLessonReviewSectionProps = {
  course: AdminCourseDetailPageData["course"];
  lessons: AdminCourseDetailPageData["lessons"];
  lessonsPage?: string;
  mediaAssetsByLessonId: AdminCourseDetailPageData["mediaAssetsByLessonId"];
  pagesByLessonId: AdminCourseDetailPageData["pagesByLessonId"];
  questionCountByQuizId: AdminCourseDetailPageData["questionCountByQuizId"];
  quizByLessonId: AdminCourseDetailPageData["quizByLessonId"];
  actions: {
    saveLesson: LessonReviewAction;
    setLessonStatus: LessonReviewAction;
  };
};

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
}

function getImageValue(image: Record<string, unknown> | null | undefined, key: "src" | "alt") {
  const value = image?.[key];
  return typeof value === "string" ? value : "";
}

function lessonPreviewFrames(
  lesson: { title: string; cover_image: Record<string, unknown> | null },
  pages: AdminLessonPageRow[],
  lessonAssets: AdminLearningMediaAssetRow[],
) {
  const previews: Array<{ key: string; src: string; alt: string; label: string }> = [];
  const seen = new Set<string>();

  const pushPreview = (key: string, src: string, alt: string, label: string) => {
    if (!src || seen.has(src)) {
      return;
    }
    seen.add(src);
    previews.push({ key, src, alt, label });
  };

  pushPreview(
    `lesson-${lesson.title}`,
    getImageValue(lesson.cover_image, "src"),
    getImageValue(lesson.cover_image, "alt") || `${lesson.title} lesson cover`,
    "Lesson cover",
  );

  for (const page of pages) {
    pushPreview(
      page.id,
      getImageValue(page.cover_image, "src"),
      getImageValue(page.cover_image, "alt") || `${page.title} page image`,
      `Page ${page.page_number}`,
    );
    if (previews.length >= 3) {
      return previews;
    }
  }

  for (const asset of lessonAssets) {
    pushPreview(
      asset.id,
      asset.url ?? "",
      asset.alt_text ?? asset.caption ?? `${lesson.title} media preview`,
      asset.asset_type === "thumbnail" ? "Lesson brief" : asset.asset_type,
    );
    if (previews.length >= 3) {
      return previews;
    }
  }

  return previews;
}

function lessonPublishActionLabel(lesson: { status: string; ai_generated: boolean; ai_publish_status: string }) {
  if (lesson.status === "published") {
    return "Unpublish lesson";
  }

  if (lesson.ai_generated && lesson.ai_publish_status !== "ready") {
    return "Publish gates pending";
  }

  return "Publish lesson";
}

export function CourseDetailLessonReviewSection({
  actions,
  course,
  lessons,
  lessonsPage,
  mediaAssetsByLessonId,
  pagesByLessonId,
  questionCountByQuizId,
  quizByLessonId,
}: CourseDetailLessonReviewSectionProps) {
  const paginatedLessons = paginateItems(lessons, parsePageParam(lessonsPage), 12);

  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
      <AdminCard>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Lesson review</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              Scan each lesson’s live preview state here before opening the full lesson editor. The asset registry below stays available as an advanced fallback.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminStatusBadge tone="neutral">{lessons.length} lessons</AdminStatusBadge>
            <AdminStatusBadge tone="warning">
              {lessons.filter((lesson) => lesson.ai_generated && lesson.ai_media_status !== "approved").length} media pending
            </AdminStatusBadge>
          </div>
        </div>
        {lessons.length === 0 ? (
          <EmptyAdminState>No lessons yet.</EmptyAdminState>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedLessons.items.map((lesson) => {
                const lessonPagesForPreview = pagesByLessonId.get(lesson.id) ?? [];
                const lessonQuiz = quizByLessonId.get(lesson.id) ?? null;
                const questionCount = lessonQuiz ? questionCountByQuizId.get(lessonQuiz.id) ?? 0 : 0;
                const lessonMediaAssets = mediaAssetsByLessonId.get(lesson.id) ?? [];
                const previewFrames = lessonPreviewFrames(lesson, lessonPagesForPreview, lessonMediaAssets);
                const lessonFailedAssets = lessonMediaAssets.filter((asset) => asset.generation_status === "failed").length;
                const lessonLegacyAssets = lessonMediaAssets.filter((asset) => !isImageMediaAsset(asset)).length;
                const lessonApprovedAssets = lessonMediaAssets.filter((asset) => asset.review_status === "approved").length;
                const lessonReadyAssets = lessonMediaAssets.filter((asset) => asset.url).length;
                const lessonMediaPending = lessonMediaAssets.filter((asset) => asset.review_status !== "approved").length;

                return (
                  <details
                    className="group rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)]"
                    key={lesson.id}
                    open={lesson.ai_generated && lesson.status !== "published" && lesson.ai_publish_status === "ready"}
                  >
                    <summary className="cursor-pointer list-none p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-[240px] flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[var(--ve-panel)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                              Lesson {lesson.sort_order}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black">{lesson.title}</h3>
                            <AdminStatusBadge tone={lesson.status === "published" ? "good" : "warning"}>
                              {lesson.status === "published" ? "Published" : "Not published"}
                            </AdminStatusBadge>
                            {lesson.status !== "published" && lesson.ai_generated && lesson.ai_publish_status === "ready" ? (
                              <AdminStatusBadge tone="good">Ready to publish</AdminStatusBadge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                            {lesson.description || "No lesson description yet."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {lesson.ai_generated ? (
                              <>
                                <AdminStatusBadge tone={workflowTone(lesson.ai_text_status)}>
                                  text: {lesson.ai_text_status.replaceAll("_", " ")}
                                </AdminStatusBadge>
                                <AdminStatusBadge tone={workflowTone(lesson.ai_media_status)}>
                                  media: {lesson.ai_media_status.replaceAll("_", " ")}
                                </AdminStatusBadge>
                                <AdminStatusBadge tone={workflowTone(lesson.ai_publish_status)}>
                                  publish: {lesson.ai_publish_status.replaceAll("_", " ")}
                                </AdminStatusBadge>
                                {lesson.status === "published" ? (
                                  <AdminStatusBadge tone="good">live to learners</AdminStatusBadge>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex min-w-[260px] flex-1 flex-col gap-3">
                          <div className="flex justify-end">
                            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ve-panel)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                              <span>Expand</span>
                              <span className="transition group-open:rotate-180">˅</span>
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {previewFrames.length > 0 ? (
                              previewFrames.map((preview) => (
                                <div className="overflow-hidden rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)]" key={preview.key}>
                                  <div className="relative h-24 w-full">
                                    <Image
                                      alt={preview.alt}
                                      className="object-cover"
                                      fill
                                      sizes="(max-width: 768px) 33vw, 220px"
                                      src={preview.src}
                                    />
                                  </div>
                                  <div className="px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                                    {preview.label}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="sm:col-span-3 rounded-[14px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-6 text-sm font-semibold text-[var(--ve-muted)]">
                                No live preview yet for this lesson.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm font-semibold text-[var(--ve-muted)] sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[14px] bg-[var(--ve-panel)] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em]">Structure</p>
                          <p className="mt-2">{lessonPagesForPreview.length} pages · {questionCount} quiz questions</p>
                        </div>
                        <div className="rounded-[14px] bg-[var(--ve-panel)] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em]">Media ready</p>
                          <p className="mt-2">{lessonReadyAssets}/{lessonMediaAssets.length} previews available</p>
                        </div>
                        <div className="rounded-[14px] bg-[var(--ve-panel)] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em]">Review</p>
                          <p className="mt-2">{lessonApprovedAssets} approved · {lessonMediaPending} pending</p>
                        </div>
                        <div className="rounded-[14px] bg-[var(--ve-panel)] px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em]">Issues</p>
                          <p className="mt-2">{lessonFailedAssets} failed · {lessonLegacyAssets} legacy</p>
                        </div>
                      </div>

                      {lesson.status !== "published" && lesson.ai_generated && lesson.ai_publish_status === "ready" ? (
                        <p className="mt-4 text-sm font-black text-[var(--ve-green)]">
                          This lesson is ready to publish. Open the card to publish it now.
                        </p>
                      ) : null}
                      {lesson.status === "published" ? (
                        <p className="mt-4 text-sm font-black text-[var(--ve-green)]">
                          This lesson is live to learners inside the published course.
                        </p>
                      ) : null}
                    </summary>

                    <div className="border-t border-[var(--ve-line-soft)] p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          className="rounded-[12px] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black text-[var(--foreground)]"
                          href={`/admin/courses/lessons/${lesson.id}`}
                        >
                          Open Lesson Workspace
                        </Link>
                        <form action={actions.setLessonStatus}>
                          <input name="courseId" type="hidden" value={course.id} />
                          <input name="lessonId" type="hidden" value={lesson.id} />
                          <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                          <input
                            name="status"
                            type="hidden"
                            value={lesson.status === "published" ? "draft" : "published"}
                          />
                          <button
                            className={
                              lesson.status === "published"
                                ? "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-danger)]"
                                : "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)]"
                            }
                            disabled={
                              lesson.ai_generated
                              && lesson.status !== "published"
                              && lesson.ai_publish_status !== "ready"
                            }
                            type="submit"
                          >
                            {lessonPublishActionLabel(lesson)}
                          </button>
                        </form>
                      </div>

                      {lesson.ai_generated && lesson.status !== "published" ? (
                        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                          {lesson.ai_publish_status === "ready"
                            ? "This lesson has passed AI text and media review. Publishing it will make it visible inside the live course immediately."
                            : "Finish this lesson’s AI text and media review before it can be published on its own."}
                        </p>
                      ) : null}

                      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Page preview state</p>
                          <div className="mt-3 space-y-3">
                            {lessonPagesForPreview.map((page) => {
                              const pageImage = getImageValue(page.cover_image, "src");
                              return (
                                <div className="rounded-[14px] bg-[var(--ve-panel)] p-3" key={page.id}>
                                  <div className="flex flex-wrap items-start gap-3">
                                    {pageImage ? (
                                      <div className="relative h-16 w-24 overflow-hidden rounded-[10px]">
                                        <Image
                                          alt={getImageValue(page.cover_image, "alt") || `${page.title} preview`}
                                          className="object-cover"
                                          fill
                                          sizes="96px"
                                          src={pageImage}
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex h-16 w-24 items-center justify-center rounded-[10px] border border-dashed border-[var(--ve-line-soft)] text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                                        No image
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-black">Page {page.page_number}: {page.title}</p>
                                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ve-muted)]">{page.page_type}</p>
                                      {page.subtitle ? (
                                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{page.subtitle}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Lesson review summary</p>
                          <div className="mt-3 space-y-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                            <p>Retry mode: <span className="font-black capitalize text-[var(--foreground)]">{lesson.retry_mode}</span></p>
                            <p>Estimated time: <span className="font-black text-[var(--foreground)]">{lesson.estimated_minutes} min</span></p>
                            <p>Media assets: <span className="font-black text-[var(--foreground)]">{lessonMediaAssets.length}</span></p>
                            <p>Required assets: <span className="font-black text-[var(--foreground)]">{lessonMediaAssets.filter((asset) => isRequiredMediaAsset(asset)).length}</span></p>
                            {lessonFailedAssets > 0 ? (
                              <p className="text-[var(--ve-danger)]">{lessonFailedAssets} asset{lessonFailedAssets === 1 ? "" : "s"} failed generation.</p>
                            ) : null}
                            {lessonLegacyAssets > 0 ? (
                              <p className="text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]">{lessonLegacyAssets} legacy unsupported brief{lessonLegacyAssets === 1 ? "" : "s"} still need cleanup.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
            <AdminPagination
              basePath={`/admin/courses/${course.id}`}
              currentPage={paginatedLessons.currentPage}
              summary={`Showing ${paginatedLessons.startItem}-${paginatedLessons.endItem} of ${paginatedLessons.totalItems} lessons`}
              totalPages={paginatedLessons.totalPages}
            />
          </>
        )}
      </AdminCard>
      <AdminCard>
        <h2 className="mb-1 text-lg font-black">Add lesson</h2>
        <p className="mb-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Create a blank lesson and continue in the full lesson builder.
        </p>
        <form action={actions.saveLesson}>
          <input name="lessonId" type="hidden" value="" />
          <input name="courseId" type="hidden" value={course.id} />
          <input name="title" type="hidden" value={`Untitled lesson ${lessons.length + 1}`} />
          <input name="description" type="hidden" value="" />
          <input name="coverImageUrl" type="hidden" value="" />
          <input name="coverImageAlt" type="hidden" value="" />
          <input name="status" type="hidden" value="draft" />
          <input name="sortOrder" type="hidden" value={lessons.length + 1} />
          <input name="estimatedMinutes" type="hidden" value="0" />
          <input name="retryMode" type="hidden" value="anytime" />
          <input name="retryCooldownSeconds" type="hidden" value="" />
          <input name="retryRequiresReread" type="hidden" value="on" />
          <input name="quizRequiresLessonCompletion" type="hidden" value="on" />
          <input name="maxEarningAttempts" type="hidden" value="" />
          <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
          <button
            className="inline-flex w-full items-center justify-center rounded-[14px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white transition hover:brightness-95"
            type="submit"
          >
            + Add lesson
          </button>
        </form>
      </AdminCard>
    </section>
  );
}
