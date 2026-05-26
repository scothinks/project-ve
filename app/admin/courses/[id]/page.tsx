import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import { MediaAssetPresentationEditor } from "@/components/admin/MediaAssetPresentationEditor";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { saveLesson, setLessonStatus } from "@/app/admin/courses/actions";
import {
  approveCourseMedia,
  approveCourseText,
  generateCourseMediaAssets,
  normalizeCourseLegacyMediaAssets,
  publishApprovedCourse,
  reviseCourseTextWithAi,
  requestCourseMediaChanges,
  requestCourseTextChanges,
  saveLearningMediaAsset,
  generateCourseExpansionPlan,
  generateLessonFromExpansionSuggestion,
  generatePlannedLessonsFromSelectedPlan,
} from "@/app/admin/courses/detail-page-actions";
import { CourseForm } from "@/components/admin/LearningForms";
import { getAiMediaConfig } from "@/lib/ai-media-generator";
import { parseImagePresentation } from "@/lib/image-presentation";
import {
  isImageMediaAsset,
  isRequiredMediaAsset,
  validateMediaApproval,
} from "@/lib/ai-media-workflow";
import { parseStoredCourseExpansionPlan } from "@/lib/ai-course-planner";
import { parseStoredNewCoursePlanSelection } from "@/lib/ai-course-planner";
import {
  type AdminLearningMediaAssetRow,
  type AdminLessonPageRow,
  type AdminQuizQuestionRow,
  type AdminQuizRow,
  getAdminAiCoursePlans,
  getAdminCourse,
  getAdminCourseCategories,
  getAdminContentValueTags,
  getAdminLearningMediaAssets,
  getAdminLessons,
  getAdminValueDimensions,
  requireAdmin,
} from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
}

function formatApproval(value: string | null, byName?: string | null) {
  if (!value) return "Not approved yet";
  const formatted = new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return byName ? `${formatted} by ${byName}` : formatted;
}

function formatPlanTime(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  return asRecord(metadata)[key] === true;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = asRecord(metadata)[key];
  return typeof value === "string" ? value : "";
}

function latestTextFeedback(notes: Record<string, unknown>) {
  const history = Array.isArray(notes.textRevisionFeedbackHistory)
    ? notes.textRevisionFeedbackHistory
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = typeof entry.kind === "string" ? entry.kind : "";
    const feedback = typeof entry.feedback === "string" ? entry.feedback.trim() : "";
    if (kind === "request" && feedback) {
      return {
        feedback,
        requestedAt: typeof entry.requestedAt === "string" ? entry.requestedAt : null,
      };
    }
  }

  return null;
}

function latestMediaFeedback(notes: Record<string, unknown>) {
  const history = Array.isArray(notes.mediaRevisionFeedbackHistory)
    ? notes.mediaRevisionFeedbackHistory
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = typeof entry.kind === "string" ? entry.kind : "";
    const feedback = typeof entry.feedback === "string" ? entry.feedback.trim() : "";
    if (kind === "request" && feedback) {
      return {
        feedback,
        requestedAt: typeof entry.requestedAt === "string" ? entry.requestedAt : null,
      };
    }
  }

  return null;
}

function getImageValue(image: Record<string, unknown> | null | undefined, key: "src" | "alt") {
  const value = image?.[key];
  return typeof value === "string" ? value : "";
}

function findCourseShellMediaAsset(
  assets: AdminLearningMediaAssetRow[],
  targetKind: "course_thumbnail" | "course_cover",
) {
  return assets.find((asset) => {
    if (asset.lesson_id) {
      return false;
    }

    const metadataTargetKind = getMetadataString(asset.metadata, "targetKind");
    if (metadataTargetKind === targetKind) {
      return true;
    }

    if (targetKind === "course_thumbnail") {
      return asset.asset_type === "thumbnail" || asset.placement.toLowerCase() === "course_thumbnail";
    }

    return asset.asset_type === "cover" || asset.placement.toLowerCase() === "course_cover";
  }) ?? null;
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

function workflowButtonClasses(tone: "primary" | "danger" | "neutral" = "primary") {
  if (tone === "danger") {
    return "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-danger)]";
  }

  if (tone === "neutral") {
    return "rounded-[12px] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black text-[var(--foreground)]";
  }

  return "rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white";
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

function collapsibleSummaryClasses() {
  return "cursor-pointer list-none px-5 py-5";
}

function collapsibleBodyClasses() {
  return "border-t border-[var(--ve-line-soft)] px-5 pb-5";
}

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lessonsPage?: string; notice?: string }>;
};

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { id } = await params;
  const { lessonsPage, notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [course, lessons, categories, mediaAssets, expansionPlans, valueDimensions, valueTags] = await Promise.all([
    getAdminCourse(supabase, id),
    getAdminLessons(supabase, { courseId: id }),
    getAdminCourseCategories(supabase),
    getAdminLearningMediaAssets(supabase, { courseId: id }),
    getAdminAiCoursePlans(supabase, { courseId: id, mode: "expand_course", limit: 3, excludeStatuses: ["dismissed", "used"] }),
    getAdminValueDimensions(supabase),
    getAdminContentValueTags(supabase, "course", id),
  ]);

  if (!course) {
    notFound();
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const [lessonPages, quizzes] = lessonIds.length > 0
    ? await Promise.all([
      supabase
        .from("lesson_pages")
        .select("id, lesson_id, page_number, title, subtitle, page_type, cover_image, created_at, updated_at")
        .in("lesson_id", lessonIds)
        .order("page_number", { ascending: true })
        .returns<AdminLessonPageRow[]>(),
      supabase
        .from("quizzes")
        .select("id, lesson_id, title, version, status, ai_text_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by")
        .in("lesson_id", lessonIds)
        .returns<AdminQuizRow[]>(),
    ])
    : [
      { data: [] as AdminLessonPageRow[], error: null },
      { data: [] as AdminQuizRow[], error: null },
    ];

  if (lessonPages.error) throw lessonPages.error;
  if (quizzes.error) throw quizzes.error;
  const quizIds = (quizzes.data ?? []).map((quiz) => quiz.id);
  const quizQuestions = quizIds.length > 0
    ? await supabase
      .from("quiz_questions")
      .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
      .in("quiz_id", quizIds)
      .returns<AdminQuizQuestionRow[]>()
    : { data: [] as AdminQuizQuestionRow[], error: null };
  if (quizQuestions.error) throw quizQuestions.error;

  const resolvedCourseNotes = asRecord(course.ai_generation_notes);
  const resolvedPlannerPlanId =
    typeof resolvedCourseNotes.plannerPlanId === "string" ? resolvedCourseNotes.plannerPlanId : "";
  const plannerShellPlanRows = resolvedPlannerPlanId
    ? await getAdminAiCoursePlans(supabase, { planId: resolvedPlannerPlanId, mode: "new_course", limit: 1 })
    : [];
  const plannerShellPlan = plannerShellPlanRows[0] ?? null;
  const plannerShellSelection = plannerShellPlan
    ? parseStoredNewCoursePlanSelection(plannerShellPlan.selected_items[0])
    : null;
  const showPlannedLessonContinuation =
    course.ai_generated
    && resolvedCourseNotes.mode === "planner_course_shell"
    && resolvedCourseNotes.plannerStage === "course_shell"
    && Boolean(plannerShellPlan)
    && Boolean(plannerShellSelection?.generatedCourseId)
    && !plannerShellSelection?.lessonsGeneratedAt;

  const paginatedLessons = paginateItems(lessons, parsePageParam(lessonsPage), 12);
  const mediaConfig = getAiMediaConfig();
  const mediaValidation = validateMediaApproval(mediaAssets);
  const hasRequiredImageAssets = mediaAssets.some(isRequiredMediaAsset);
  const optionalWarningCounts = mediaValidation.optionalWarnings.reduce(
    (counts, warning) => {
      for (const reason of warning.reasons) {
        counts[reason] += 1;
      }
      return counts;
    },
    {
      missing_preview: 0,
      failed_generation: 0,
    },
  );
  const optionalWarningByAssetId = new Map(
    mediaValidation.optionalWarnings.map((warning) => [warning.asset.id, warning.reasons]),
  );
  const storedTextFeedback = latestTextFeedback(course.ai_generation_notes ?? {});
  const storedMediaFeedback = latestMediaFeedback(course.ai_generation_notes ?? {});
  const legacyMediaAssetCount = mediaAssets.filter((asset) => !isImageMediaAsset(asset)).length;
  const courseThumbnailAsset = findCourseShellMediaAsset(mediaAssets, "course_thumbnail");
  const courseCoverAsset = findCourseShellMediaAsset(mediaAssets, "course_cover");
  const pagesByLessonId = new Map<string, AdminLessonPageRow[]>();
  for (const page of lessonPages.data ?? []) {
    const existing = pagesByLessonId.get(page.lesson_id) ?? [];
    existing.push(page);
    pagesByLessonId.set(page.lesson_id, existing);
  }
  const quizByLessonId = new Map((quizzes.data ?? []).map((quiz) => [quiz.lesson_id, quiz]));
  const questionCountByQuizId = new Map<string, number>();
  for (const question of quizQuestions.data ?? []) {
    questionCountByQuizId.set(question.quiz_id, (questionCountByQuizId.get(question.quiz_id) ?? 0) + 1);
  }
  const mediaAssetsByLessonId = new Map<string, AdminLearningMediaAssetRow[]>();
  for (const asset of mediaAssets.filter((asset) => asset.lesson_id)) {
    const lessonId = asset.lesson_id as string;
    const existing = mediaAssetsByLessonId.get(lessonId) ?? [];
    existing.push(asset);
    mediaAssetsByLessonId.set(lessonId, existing);
  }
  const mediaApprovalBlocked =
    course.ai_generated
    && course.ai_text_status === "approved"
    && (
      !hasRequiredImageAssets
      || mediaValidation.missingRequiredAssets.length > 0
      || mediaValidation.failedRequiredAssets.length > 0
    );

  return (
    <>
      <AdminPageHeader
        backHref="/admin/courses"
        backLabel="Courses"
        eyebrow="Learning"
        title={course.title}
        subtitle="Build the learner journey: course promise, lesson sequence, and publish readiness."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <ContentValueTagEditor
        contentId={course.id}
        contentType="course"
        dimensions={valueDimensions}
        redirectTo={`/admin/courses/${course.id}`}
        tags={valueTags}
      />
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Lessons" value={lessons.length} />
        <AdminStatCard
          label="Published"
          tone="mission"
          value={lessons.filter((lesson) => lesson.status === "published").length}
        />
        <AdminStatCard
          label="Disabled"
          tone="warning"
          value={lessons.filter((lesson) => lesson.status === "draft").length}
        />
        <AdminCard className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Preview</p>
          <Link className="mt-3 text-sm font-black text-[var(--ve-green)]" href={`/courses/${course.id}`}>
            Open learner course
          </Link>
        </AdminCard>
      </section>
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <AdminCard className="p-0">
          <details open>
            <summary className={collapsibleSummaryClasses()}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">AI workflow</p>
                  <h2 className="mt-2 text-lg font-black">Approval gates for AI-generated content</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    Text approval unlocks media. Media approval unlocks publishing. Learners still only see published content.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {course.ai_generated ? (
                    <AdminStatusBadge tone="good">AI generated</AdminStatusBadge>
                  ) : (
                    <AdminStatusBadge tone="neutral">Manual course</AdminStatusBadge>
                  )}
                  <AdminStatusBadge tone={workflowTone(course.ai_text_status)}>{course.ai_text_status.replaceAll("_", " ")}</AdminStatusBadge>
                  <AdminStatusBadge tone={workflowTone(course.ai_media_status)}>{course.ai_media_status.replaceAll("_", " ")}</AdminStatusBadge>
                  <AdminStatusBadge tone={workflowTone(course.ai_publish_status)}>{course.ai_publish_status.replaceAll("_", " ")}</AdminStatusBadge>
                </div>
              </div>
            </summary>

            <div className={collapsibleBodyClasses()}>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Text status</p>
                  <div className="mt-3">
                    <AdminStatusBadge tone={workflowTone(course.ai_text_status)}>{course.ai_text_status.replaceAll("_", " ")}</AdminStatusBadge>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    {formatApproval(course.text_approved_at, course.text_approved_by_name)}
                  </p>
                </div>
                <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Media status</p>
                  <div className="mt-3">
                    <AdminStatusBadge tone={workflowTone(course.ai_media_status)}>{course.ai_media_status.replaceAll("_", " ")}</AdminStatusBadge>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    {formatApproval(course.media_approved_at, course.media_approved_by_name)}
                  </p>
                </div>
                <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Publish readiness</p>
                  <div className="mt-3">
                    <AdminStatusBadge tone={workflowTone(course.ai_publish_status)}>{course.ai_publish_status.replaceAll("_", " ")}</AdminStatusBadge>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Current learner visibility stays on <span className="font-black">{course.status}</span>.
                  </p>
                </div>
              </div>

              {course.ai_generated ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  {["draft", "in_review", "changes_requested"].includes(course.ai_text_status) ? (
                    <>
                      <form action={approveCourseText}>
                        <input name="courseId" type="hidden" value={course.id} />
                        <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                        <PendingSubmitButton
                          className={workflowButtonClasses()}
                          label="Approve Text"
                          pendingLabel="Approving Text..."
                          type="submit"
                        />
                      </form>
                    </>
                  ) : null}

                  {course.ai_text_status === "approved" ? (
                    <>
                      <form action={generateCourseMediaAssets}>
                        <input name="courseId" type="hidden" value={course.id} />
                        <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                        <PendingSubmitButton
                          className={workflowButtonClasses()}
                          disabled={!mediaConfig.canGenerate}
                          label="Generate Media"
                          pendingLabel="Generating Media..."
                          type="submit"
                        />
                      </form>
                      <form action={generateCourseMediaAssets}>
                        <input name="courseId" type="hidden" value={course.id} />
                        <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                        <input name="replaceExisting" type="hidden" value="true" />
                        <PendingSubmitButton
                          className={workflowButtonClasses("neutral")}
                          disabled={!mediaConfig.canGenerate}
                          label="Regenerate Existing Images"
                          pendingLabel="Regenerating Images..."
                          type="submit"
                        />
                      </form>
                      <p className="basis-full text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                        Generates supported visual assets from approved lesson text and media prompts. AI briefs now stay limited to images and infographics.
                      </p>
                      {!mediaConfig.canGenerate ? (
                        <p className="basis-full text-xs font-semibold leading-5 text-[var(--ve-danger)]">
                          Media generation is unavailable until these server settings are added: {mediaConfig.missingRequirements.join(", ")}.
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {["draft", "in_review", "changes_requested"].includes(course.ai_media_status) ? (
                    <>
                      <form action={approveCourseMedia}>
                        <input name="courseId" type="hidden" value={course.id} />
                        <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                        <button className={workflowButtonClasses()} disabled={mediaApprovalBlocked} type="submit">Approve Media</button>
                      </form>
                      {mediaApprovalBlocked ? (
                        <p className="basis-full text-xs font-semibold leading-5 text-[var(--ve-danger)]">
                          {!hasRequiredImageAssets
                            ? "Media approval is blocked because the required image assets have not been seeded yet. Generate Media first."
                            : `Media approval is blocked by required assets: ${mediaValidation.missingRequiredAssets.length} missing preview${mediaValidation.missingRequiredAssets.length === 1 ? "" : "s"}, ${mediaValidation.failedRequiredAssets.length} failed.`}
                        </p>
                      ) : null}
                      {!mediaApprovalBlocked && mediaValidation.optionalWarnings.length > 0 ? (
                        <p className="basis-full text-xs font-semibold leading-5 text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]">
                          Optional media warnings do not block approval: {optionalWarningCounts.missing_preview} missing preview{optionalWarningCounts.missing_preview === 1 ? "" : "s"}, {optionalWarningCounts.failed_generation} failed.
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {course.ai_text_status === "approved"
                    && course.ai_media_status === "approved"
                    && course.ai_publish_status === "ready" ? (
                      <form action={publishApprovedCourse}>
                        <input name="courseId" type="hidden" value={course.id} />
                        <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                        <button className={workflowButtonClasses()} type="submit">Publish Approved Course</button>
                      </form>
                    ) : null}
                </div>
              ) : (
                <p className="mt-5 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                  This course was created manually, so the AI workflow states are informational only.
                </p>
              )}

              {showPlannedLessonContinuation && plannerShellPlan && plannerShellSelection ? (
                <div className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Next step</p>
                      <h3 className="mt-2 text-base font-black">Generate the planned lessons for this course shell</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                        This course was created from the staged planner flow. The course shell is live, but the original lesson outline has not been generated yet.
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                        Planned lessons: {plannerShellSelection.lessonOutline.length}. They will be created as draft lessons and enter the existing text review, media review, and publish workflow.
                      </p>
                    </div>
                    <AdminStatusBadge tone="warning">Lessons pending</AdminStatusBadge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={generatePlannedLessonsFromSelectedPlan}>
                      <input name="planId" type="hidden" value={plannerShellPlan.id} />
                      <PendingSubmitButton
                        className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                        label="Generate Planned Lessons"
                        pendingLabel="Generating Planned Lessons..."
                        type="submit"
                      />
                    </form>
                    <Link
                      className="rounded-[12px] border border-[var(--ve-line-soft)] px-4 py-3 text-sm font-black text-[var(--ve-green)]"
                      href={`/admin/courses/ai/planner?plan=${plannerShellPlan.id}`}
                    >
                      Open Planner Brief
                    </Link>
                  </div>
                </div>
              ) : null}

              {course.ai_generated ? (
                <div className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Text revision loop</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    Record the exact editorial changes you want, then use AI to revise the draft against that feedback. Media stays locked until the revised text is approved again.
                  </p>

                  {storedTextFeedback ? (
                    <div className="mt-4 rounded-[14px] bg-[var(--ve-panel)] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Latest requested changes</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{storedTextFeedback.feedback}</p>
                      {storedTextFeedback.requestedAt ? (
                        <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                          Requested {formatPlanTime(storedTextFeedback.requestedAt)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <form action={requestCourseTextChanges} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
                      <input name="courseId" type="hidden" value={course.id} />
                      <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                      <label className="block">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Requested changes</span>
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                          name="changeRequest"
                          placeholder="Example: The lesson examples are too basic. Add stronger real-life scenarios, improve the quiz difficulty, and make the summary more practical."
                          required
                        />
                      </label>
                      <PendingSubmitButton
                        className={`${workflowButtonClasses("danger")} mt-4 disabled:cursor-not-allowed disabled:opacity-70`}
                        label="Request Text Changes"
                        pendingLabel="Saving Change Request..."
                        type="submit"
                      />
                    </form>

                    <form action={reviseCourseTextWithAi} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
                      <input name="courseId" type="hidden" value={course.id} />
                      <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                      <label className="block">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Revision brief for AI</span>
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                          defaultValue={storedTextFeedback?.feedback ?? ""}
                          name="revisionRequest"
                          placeholder="Use the latest requested changes or add a tighter revision brief here."
                        />
                      </label>
                      {course.status === "published" ? (
                        <p className="mt-3 text-xs font-semibold leading-5 text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]">
                          Disable the course before revising AI text. Published courses do not have a separate draft version yet.
                        </p>
                      ) : null}
                      <PendingSubmitButton
                        className={`${workflowButtonClasses("neutral")} mt-4 disabled:cursor-not-allowed disabled:opacity-70`}
                        disabled={course.status === "published"}
                        label="Revise With AI"
                        pendingLabel="Revising Draft..."
                        type="submit"
                      />
                    </form>
                  </div>
                </div>
              ) : null}

              {course.ai_generated ? (
                <div className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Media revision loop</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    Record the exact visual changes you want, then regenerate the course media against that feedback. Publishing stays locked until the updated media is approved again.
                  </p>

                  {storedMediaFeedback ? (
                    <div className="mt-4 rounded-[14px] bg-[var(--ve-panel)] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Latest requested media changes</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{storedMediaFeedback.feedback}</p>
                      {storedMediaFeedback.requestedAt ? (
                        <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                          Requested {formatPlanTime(storedMediaFeedback.requestedAt)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <form action={requestCourseMediaChanges} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
                      <input name="courseId" type="hidden" value={course.id} />
                      <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                      <label className="block">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Requested media changes</span>
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                          defaultValue={storedMediaFeedback?.feedback ?? ""}
                          name="mediaChangeRequest"
                          placeholder="Example: Pull the subjects back, stop cropping faces, remove title-like text, and use a calmer, cleaner scene."
                          required
                        />
                      </label>
                      <PendingSubmitButton
                        className={`${workflowButtonClasses("danger")} mt-4 disabled:cursor-not-allowed disabled:opacity-70`}
                        label="Request Media Changes"
                        pendingLabel="Saving Media Feedback..."
                        type="submit"
                      />
                    </form>

                    <form action={generateCourseMediaAssets} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
                      <input name="courseId" type="hidden" value={course.id} />
                      <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                      <input name="replaceExisting" type="hidden" value="true" />
                      <input name="applyMediaFeedback" type="hidden" value="true" />
                      <label className="block">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Revision brief for AI</span>
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                          defaultValue={storedMediaFeedback?.feedback ?? ""}
                          name="mediaRevisionRequest"
                          placeholder="Use the latest requested media changes or add a tighter visual revision brief here."
                        />
                      </label>
                      {!mediaConfig.canGenerate ? (
                        <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-danger)]">
                          Media generation is unavailable until these server settings are added: {mediaConfig.missingRequirements.join(", ")}.
                        </p>
                      ) : null}
                      <PendingSubmitButton
                        className={`${workflowButtonClasses("neutral")} mt-4 disabled:cursor-not-allowed disabled:opacity-70`}
                        disabled={!mediaConfig.canGenerate}
                        label="Regenerate With Feedback"
                        pendingLabel="Regenerating Media..."
                        type="submit"
                      />
                    </form>
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        </AdminCard>

        <AdminCard className="p-0">
          <details>
            <summary className={collapsibleSummaryClasses()}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black">Advanced media registry</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    Use this when you need raw prompt, asset-type, or URL control. Normal lesson review should happen from the lesson cards above.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminStatusBadge tone="neutral">{mediaAssets.length} assets</AdminStatusBadge>
                  {mediaApprovalBlocked ? <AdminStatusBadge tone="danger">blocked</AdminStatusBadge> : null}
                  {mediaValidation.optionalWarnings.length > 0 ? (
                    <AdminStatusBadge tone="warning">{mediaValidation.optionalWarnings.length} warnings</AdminStatusBadge>
                  ) : null}
                </div>
              </div>
            </summary>

            <div className={collapsibleBodyClasses()}>
              {legacyMediaAssetCount > 0 ? (
                <div className="mt-4 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Media tools</p>
                      <h3 className="mt-2 text-base font-black">Normalize legacy media briefs</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                        This course still has {legacyMediaAssetCount} unsupported media brief{legacyMediaAssetCount === 1 ? "" : "s"} from the older workflow. Convert them into supported visual types before reviewing or regenerating the course media.
                      </p>
                    </div>
                    <AdminStatusBadge tone="warning">{legacyMediaAssetCount} legacy</AdminStatusBadge>
                  </div>

                  <form action={normalizeCourseLegacyMediaAssets} className="mt-4 flex flex-wrap items-end gap-4">
                    <input name="courseId" type="hidden" value={course.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                    <label className="flex min-w-[220px] items-start gap-3 rounded-[12px] border border-[var(--ve-line-soft)] px-3 py-3 text-sm font-semibold text-[var(--ve-muted)]">
                      <input className="mt-1 h-4 w-4" defaultChecked name="regenerateNormalized" type="checkbox" value="true" />
                      <span>Regenerate the converted visuals right away</span>
                    </label>
                    <PendingSubmitButton
                      className={`${workflowButtonClasses("neutral")} disabled:cursor-not-allowed disabled:opacity-70`}
                      label="Normalize Legacy Briefs"
                      pendingLabel="Normalizing Media..."
                      type="submit"
                    />
                  </form>
                </div>
              ) : null}

              {mediaApprovalBlocked ? (
                <div className="mt-4 rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] p-4 text-sm font-semibold leading-6 text-[var(--ve-danger)]">
                  {!hasRequiredImageAssets
                    ? "Blocker: required image assets have not been created yet. Generate Media before approving."
                    : `Blockers: ${mediaValidation.missingRequiredAssets.length} required preview${mediaValidation.missingRequiredAssets.length === 1 ? "" : "s"} missing, ${mediaValidation.failedRequiredAssets.length} required asset${mediaValidation.failedRequiredAssets.length === 1 ? "" : "s"} failed.`}
                </div>
              ) : null}
              {mediaValidation.optionalWarnings.length > 0 ? (
                <div className="mt-4 rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-store)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] p-4 text-sm font-semibold leading-6 text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]">
                  Optional warnings: {optionalWarningCounts.missing_preview} optional preview{optionalWarningCounts.missing_preview === 1 ? "" : "s"} missing, {optionalWarningCounts.failed_generation} optional asset{optionalWarningCounts.failed_generation === 1 ? "" : "s"} failed. These do not block media approval.
                </div>
              ) : null}
              <div className="mt-4 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Infographics are treated as in-page teaching media, not cover artwork. Cover crops are intentionally tight and will clip infographic layouts.
              </div>
              {mediaAssets.length === 0 ? (
                <div className="mt-4">
                  <EmptyAdminState>No media briefs yet.</EmptyAdminState>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
              {mediaAssets.map((asset) => {
                const presentation = parseImagePresentation(asset.metadata);
                const isRequired = isRequiredMediaAsset(asset);
                const excludeFromGeneration = !isRequired && getMetadataBoolean(asset.metadata, "excludeFromGeneration");
                const targetPageId = getMetadataString(asset.metadata, "targetPageId");
                const pageMediaTarget = asset.asset_type === "infographic"
                  ? "page_block"
                  : getMetadataString(asset.metadata, "targetKind") === "page_block"
                    ? "page_block"
                    : "page_cover";

                return (
                <form action={saveLearningMediaAsset} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={asset.id}>
                  <input name="assetId" type="hidden" value={asset.id} />
                  <input name="courseId" type="hidden" value={course.id} />
                  <input name="lessonId" type="hidden" value={asset.lesson_id ?? ""} />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                        {asset.lesson?.title ? `${asset.lesson.title} · ` : ""}{asset.placement}
                      </p>
                      <p className="mt-1 text-sm font-black capitalize">{asset.asset_type}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatusBadge tone={isRequired ? "warning" : "neutral"}>
                        {isRequired ? "required" : "optional"}
                      </AdminStatusBadge>
                      {asset.asset_type === "infographic" ? (
                        <AdminStatusBadge tone="neutral">in-page media</AdminStatusBadge>
                      ) : null}
                      <AdminStatusBadge tone={workflowTone(asset.review_status)}>{asset.review_status.replaceAll("_", " ")}</AdminStatusBadge>
                      <AdminStatusBadge tone={asset.generation_status === "failed" ? "danger" : asset.generation_status === "completed" ? "good" : "warning"}>
                        {asset.generation_status.replaceAll("_", " ")}
                      </AdminStatusBadge>
                      {excludeFromGeneration ? (
                        <AdminStatusBadge tone="neutral">generation off</AdminStatusBadge>
                      ) : null}
                      {optionalWarningByAssetId.has(asset.id) ? (
                        <AdminStatusBadge tone="warning">optional warning</AdminStatusBadge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 text-xs font-semibold leading-5 text-[var(--ve-muted)] md:grid-cols-2">
                    <p>Generation status: <span className="font-black text-[var(--foreground)]">{asset.generation_status.replaceAll("_", " ")}</span></p>
                    <p>Provider/model: <span className="font-black text-[var(--foreground)]">{asset.provider ?? "pending"}{asset.model ? ` / ${asset.model}` : ""}</span></p>
                    <p>Storage path: <span className="font-black text-[var(--foreground)]">{asset.storage_path ?? "Not uploaded yet"}</span></p>
                    <p>Error: <span className="font-black text-[var(--foreground)]">{asset.generation_error ?? "None"}</span></p>
                  </div>
                  <div className={`mt-4 grid gap-3 ${targetPageId ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
                    <label>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Asset type</span>
                      <select className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.asset_type} name="assetType">
                        <option value="image">Image</option>
                        <option value="audio">Audio</option>
                        <option value="video">Video</option>
                        <option value="infographic">Infographic</option>
                        <option value="thumbnail">Thumbnail</option>
                        <option value="cover">Cover</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Placement key</span>
                      <input className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.placement} name="placement" />
                    </label>
                    <label>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Review status</span>
                      <select className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.review_status} name="reviewStatus">
                        <option value="draft">Draft</option>
                        <option value="in_review">In review</option>
                        <option value="changes_requested">Changes requested</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </label>
                    {targetPageId ? (
                      <label>
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Where it appears</span>
                        <select
                          className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                          defaultValue={pageMediaTarget}
                          name="pageMediaTarget"
                        >
                          {asset.asset_type !== "infographic" ? (
                            <option value="page_cover">Page preview cover</option>
                          ) : null}
                          <option value="page_block">In-page content block</option>
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Prompt</span>
                    <textarea className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.prompt ?? ""} name="prompt" />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Script</span>
                    <textarea className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.script ?? ""} name="script" />
                  </label>
                  {!isRequired ? (
                    <label className="mt-3 flex items-start gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-3">
                      <input
                        className="mt-1 h-4 w-4 accent-[var(--ve-green)]"
                        defaultChecked={excludeFromGeneration}
                        name="excludeFromGeneration"
                        type="checkbox"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-[var(--foreground)]">
                          Do not generate or show this optional media
                        </span>
                        <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                          Use this when an editor does not want this suggested slot filled again. Saving with this on also clears its current preview slot.
                        </span>
                      </span>
                    </label>
                  ) : null}
                  <MediaAssetPresentationEditor
                    initialAltText={asset.alt_text ?? ""}
                    initialFit={presentation.fit}
                    initialPositionX={presentation.positionX}
                    initialPositionY={presentation.positionY}
                    initialUrl={asset.url ?? ""}
                    placementLabel={asset.placement}
                  />
                  <label className="mt-3 block">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Caption</span>
                    <input className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.caption ?? ""} name="caption" />
                  </label>
                  <button className="mt-4 rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-sm font-black" type="submit">
                    Save media asset
                  </button>
                </form>
              )})}
                </div>
              )}
            </div>
          </details>
        </AdminCard>
      </section>
      <section className="mb-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">AI Expansion Assistant</p>
              <h2 className="mt-2 text-lg font-black">Plan the next lesson before generating it</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Analyze the current course, suggest useful next lessons, and draft only the selected lesson idea into the existing text review, media review, and publish workflow.
              </p>
            </div>
            <Link
              className="rounded-[12px] border border-[var(--ve-line-soft)] px-4 py-3 text-sm font-black text-[var(--ve-green)]"
              href={`/admin/courses/ai/planner?courseId=${course.id}`}
            >
              Open Full Planner
            </Link>
          </div>

          <form action={generateCourseExpansionPlan} className="mt-5 space-y-4">
            <input name="course_id" type="hidden" value={course.id} />
            <div className="grid gap-4 md:grid-cols-[1fr_150px]">
              <label>
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Expansion goal</span>
                <select className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue="Fill topic gaps" name="expansion_goal">
                  <option value="Add beginner lessons">Add beginner lessons</option>
                  <option value="Add advanced lessons">Add advanced lessons</option>
                  <option value="Add scenario/practice lessons">Add scenario/practice lessons</option>
                  <option value="Add recap/assessment lesson">Add recap/assessment lesson</option>
                  <option value="Fill topic gaps">Fill topic gaps</option>
                  <option value="Improve weak course progression">Improve weak course progression</option>
                  <option value="Create follow-up course">Create follow-up course</option>
                </select>
              </label>
              <label>
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Suggestions</span>
                <input className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={3} max={6} min={1} name="number_of_suggestions" type="number" />
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Notes</span>
              <textarea
                className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                name="notes"
                placeholder="Example: Focus on practice, recap, and gentle progression without repeating the current lessons."
              />
            </label>

            <PendingSubmitButton
              className="inline-flex items-center justify-center rounded-[14px] bg-[var(--ve-sky)] px-5 py-3 text-sm font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
              label="Generate Expansion Ideas"
              pendingLabel="Generating Expansion Ideas..."
              type="submit"
            />
          </form>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-black">Latest expansion plans</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Generate a lesson draft directly from any suggestion below. It will stay in draft and re-enter the existing approval gates.
          </p>

          {expansionPlans.length === 0 ? (
            <div className="mt-4">
              <EmptyAdminState>No expansion plans yet for this course.</EmptyAdminState>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {expansionPlans.map((planRow) => {
                const planData = parseStoredCourseExpansionPlan(planRow.generated_plan);
                if (!planData) {
                  return (
                    <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] p-4 text-sm font-semibold text-[var(--ve-danger)]" key={planRow.id}>
                      This saved expansion plan could not be read.
                    </div>
                  );
                }

                return (
                  <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={planRow.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                          {planData.input.expansionGoal}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                          Generated {formatPlanTime(planRow.created_at)}
                        </p>
                      </div>
                      <AdminStatusBadge tone={workflowTone(planRow.status)}>{planRow.status.replaceAll("_", " ")}</AdminStatusBadge>
                    </div>

                    <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                      <span className="font-black text-[var(--foreground)]">Recommended direction:</span> {planData.result.courseAnalysis.recommendedDirection}
                    </p>

                    <div className="mt-4 space-y-3">
                      {planData.result.lessonSuggestions.map((suggestion, suggestionIndex) => (
                        <div className="rounded-[14px] bg-[var(--ve-panel)] p-4" key={`${planRow.id}-${suggestion.title}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black">{suggestion.title}</p>
                              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                {suggestion.placement} · {suggestion.difficulty} · {suggestion.estimatedMinutes} min
                              </p>
                            </div>
                            <form action={generateLessonFromExpansionSuggestion}>
                              <input name="planId" type="hidden" value={planRow.id} />
                              <input name="suggestionIndex" type="hidden" value={suggestionIndex} />
                              <PendingSubmitButton
                                className="rounded-[12px] bg-[var(--ve-sky)] px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                                label="Generate Lesson Draft"
                                pendingLabel="Generating Lesson Draft..."
                                type="submit"
                              />
                            </form>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                            {suggestion.reason}
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                            <span className="font-black text-[var(--foreground)]">Objective:</span> {suggestion.learningObjective}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>
      </section>
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminCard>
          <CourseForm
            categories={categories}
            course={course}
            derivedMinutes={lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0)}
          />
        </AdminCard>
        <AdminCard className="p-0">
          <details>
            <summary className={collapsibleSummaryClasses()}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Course shell media</p>
                  <h2 className="mt-2 text-lg font-black">Thumbnail and cover</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminStatusBadge tone={courseThumbnailAsset?.url ? "good" : "warning"}>
                    {courseThumbnailAsset?.url ? "thumbnail ready" : "thumbnail pending"}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={courseCoverAsset?.url ? "good" : "warning"}>
                    {courseCoverAsset?.url ? "cover ready" : "cover pending"}
                  </AdminStatusBadge>
                </div>
              </div>
            </summary>

            <div className={collapsibleBodyClasses()}>
              <div className="mt-5 space-y-4">
            {[courseThumbnailAsset, courseCoverAsset].map((asset) => {
              if (!asset) {
                return null;
              }

              const targetKind = getMetadataString(asset.metadata, "targetKind");
              const presentation = parseImagePresentation(asset.metadata);
              const title = targetKind === "course_cover" ? "Course cover" : "Course thumbnail";
              const helper =
                targetKind === "course_cover"
                  ? "Use this for the wider shell artwork. Keep the key subject away from the edges."
                  : "This is the learner card image. Position it for the card crop first.";

              return (
                <form action={saveLearningMediaAsset} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={asset.id}>
                  <input name="assetId" type="hidden" value={asset.id} />
                  <input name="courseId" type="hidden" value={course.id} />
                  <input name="lessonId" type="hidden" value="" />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                  <input name="assetType" type="hidden" value={asset.asset_type} />
                  <input name="placement" type="hidden" value={asset.placement} />
                  <input name="reviewStatus" type="hidden" value={asset.review_status} />
                  <input name="prompt" type="hidden" value={asset.prompt ?? ""} />
                  <input name="script" type="hidden" value={asset.script ?? ""} />
                  <input name="caption" type="hidden" value={asset.caption ?? ""} />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black">{title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{helper}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatusBadge tone={workflowTone(asset.review_status)}>
                        {asset.review_status.replaceAll("_", " ")}
                      </AdminStatusBadge>
                      <AdminStatusBadge tone={asset.generation_status === "completed" ? "good" : asset.generation_status === "failed" ? "danger" : "warning"}>
                        {asset.generation_status.replaceAll("_", " ")}
                      </AdminStatusBadge>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 text-xs font-semibold leading-5 text-[var(--ve-muted)] md:grid-cols-2">
                    <p>Placement: <span className="font-black text-[var(--foreground)]">{asset.placement}</span></p>
                    <p>Provider/model: <span className="font-black text-[var(--foreground)]">{asset.provider ?? "pending"}{asset.model ? ` / ${asset.model}` : ""}</span></p>
                  </div>

                  <MediaAssetPresentationEditor
                    initialAltText={asset.alt_text ?? ""}
                    initialFit={presentation.fit}
                    initialPositionX={presentation.positionX}
                    initialPositionY={presentation.positionY}
                    initialUrl={asset.url ?? ""}
                    placementLabel={title}
                    previewDescription={course.description}
                    previewEyebrow={course.category}
                    previewMinutes={lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0)}
                    previewTitle={course.title}
                    previewVariant={targetKind === "course_cover" ? "course-cover" : "course-thumbnail"}
                  />

                  <PendingSubmitButton
                    className="mt-4 rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-sm font-black"
                    label={`Save ${title}`}
                    pendingLabel="Saving Image..."
                    type="submit"
                  />
                </form>
              );
            })}

            {!courseThumbnailAsset && !courseCoverAsset ? (
              <div className="rounded-[16px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-5 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Course shell media briefs have not been seeded yet. Generate course media first, then come back here to position the thumbnail and cover.
              </div>
            ) : null}
              </div>
            </div>
          </details>
        </AdminCard>
      </section>

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
                                  <img
                                    alt={preview.alt}
                                    className="h-24 w-full object-cover"
                                    src={preview.src}
                                  />
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
                          <form action={setLessonStatus}>
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
                                        <img
                                          alt={getImageValue(page.cover_image, "alt") || `${page.title} preview`}
                                          className="h-16 w-24 rounded-[10px] object-cover"
                                          src={pageImage}
                                        />
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
          <form action={saveLesson}>
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
    </>
  );
}
