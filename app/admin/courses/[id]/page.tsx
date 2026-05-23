import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { saveLesson, setLessonStatus } from "@/app/admin/courses/actions";
import {
  approveCourseMedia,
  approveCourseText,
  generateCourseMediaAssets,
  publishApprovedCourse,
  requestCourseMediaChanges,
  requestCourseTextChanges,
  saveLearningMediaAsset,
} from "@/app/admin/courses/ai-actions";
import { CourseForm } from "@/components/admin/LearningForms";
import {
  isRequiredMediaAsset,
  isStaleMediaAsset,
  validateMediaApproval,
} from "@/lib/ai-media-workflow";
import {
  getAdminCourse,
  getAdminCourseCategories,
  getAdminLearningMediaAssets,
  getAdminLessons,
  requireAdmin,
} from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "published") return "Enabled";
  if (status === "draft") return "Disabled";
  return status;
}

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

function workflowButtonClasses(tone: "primary" | "danger" | "neutral" = "primary") {
  if (tone === "danger") {
    return "rounded-[12px] bg-[#fff0f0] px-4 py-3 text-sm font-black text-[#c00000]";
  }

  if (tone === "neutral") {
    return "rounded-[12px] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black text-[var(--foreground)]";
  }

  return "rounded-[12px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white";
}

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lessonsPage?: string; notice?: string }>;
};

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { id } = await params;
  const { lessonsPage, notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [course, lessons, categories, mediaAssets] = await Promise.all([
    getAdminCourse(supabase, id),
    getAdminLessons(supabase, { courseId: id }),
    getAdminCourseCategories(supabase),
    getAdminLearningMediaAssets(supabase, { courseId: id }),
  ]);

  if (!course) {
    notFound();
  }

  const paginatedLessons = paginateItems(lessons, parsePageParam(lessonsPage), 12);
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
      stale_asset: 0,
    },
  );
  const optionalWarningByAssetId = new Map(
    mediaValidation.optionalWarnings.map((warning) => [warning.asset.id, warning.reasons]),
  );
  const mediaApprovalBlocked =
    course.ai_generated
    && course.ai_text_status === "approved"
    && (
      !hasRequiredImageAssets
      || mediaValidation.missingRequiredAssets.length > 0
      || mediaValidation.failedRequiredAssets.length > 0
      || mediaValidation.staleRequiredAssets.length > 0
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
          <Link className="mt-3 text-sm font-black text-[#087f5b]" href={`/courses/${course.id}`}>
            Open learner course
          </Link>
        </AdminCard>
      </section>
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <AdminCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">AI workflow</p>
              <h2 className="mt-2 text-lg font-black">Approval gates for AI-generated content</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Text approval unlocks media. Media approval unlocks publishing. Learners still only see published content.
              </p>
            </div>
            {course.ai_generated ? (
              <AdminStatusBadge tone="good">AI generated</AdminStatusBadge>
            ) : (
              <AdminStatusBadge tone="neutral">Manual course</AdminStatusBadge>
            )}
          </div>

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
                    <button className={workflowButtonClasses()} type="submit">Approve Text</button>
                  </form>
                  <form action={requestCourseTextChanges}>
                    <input name="courseId" type="hidden" value={course.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                    <button className={workflowButtonClasses("danger")} type="submit">Request Text Changes</button>
                  </form>
                </>
              ) : null}

              {course.ai_text_status === "approved" ? (
                <>
                  <form action={generateCourseMediaAssets}>
                    <input name="courseId" type="hidden" value={course.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                    <button className={workflowButtonClasses()} type="submit">Generate Media</button>
                  </form>
                  <form action={generateCourseMediaAssets}>
                    <input name="courseId" type="hidden" value={course.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                    <input name="replaceExisting" type="hidden" value="true" />
                    <button className={workflowButtonClasses("neutral")} type="submit">Regenerate Existing Images</button>
                  </form>
                  <p className="basis-full text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Generates image assets from approved lesson text and media prompts. Audio/video can be added later.
                  </p>
                </>
              ) : null}

              {["draft", "in_review", "changes_requested"].includes(course.ai_media_status) ? (
                <>
                  <form action={approveCourseMedia}>
                    <input name="courseId" type="hidden" value={course.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                    <button className={workflowButtonClasses()} disabled={mediaApprovalBlocked} type="submit">Approve Media</button>
                  </form>
                  <form action={requestCourseMediaChanges}>
                    <input name="courseId" type="hidden" value={course.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                    <button className={workflowButtonClasses("danger")} type="submit">Request Media Changes</button>
                  </form>
                  {mediaApprovalBlocked ? (
                    <p className="basis-full text-xs font-semibold leading-5 text-[#c00000]">
                      {!hasRequiredImageAssets
                        ? "Media approval is blocked because the required image assets have not been seeded yet. Generate Media first."
                        : `Media approval is blocked by required assets: ${mediaValidation.missingRequiredAssets.length} missing preview${mediaValidation.missingRequiredAssets.length === 1 ? "" : "s"}, ${mediaValidation.failedRequiredAssets.length} failed, ${mediaValidation.staleRequiredAssets.length} stale.`}
                    </p>
                  ) : null}
                  {!mediaApprovalBlocked && mediaValidation.optionalWarnings.length > 0 ? (
                    <p className="basis-full text-xs font-semibold leading-5 text-[#8a5a13]">
                      Optional media warnings do not block approval: {optionalWarningCounts.missing_preview} missing preview{optionalWarningCounts.missing_preview === 1 ? "" : "s"}, {optionalWarningCounts.failed_generation} failed, {optionalWarningCounts.stale_asset} stale.
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
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-black">Media briefs and assets</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Edit prompts, scripts, and URLs here. Saving or regenerating approved media resets publishing readiness until media is approved again.
          </p>
          {mediaApprovalBlocked ? (
            <div className="mt-4 rounded-[16px] border border-[#ffd7d7] bg-[#fff5f5] p-4 text-sm font-semibold leading-6 text-[#8a1f1f]">
              {!hasRequiredImageAssets
                ? "Blocker: required image assets have not been created yet. Generate Media before approving."
                : `Blockers: ${mediaValidation.missingRequiredAssets.length} required preview${mediaValidation.missingRequiredAssets.length === 1 ? "" : "s"} missing, ${mediaValidation.failedRequiredAssets.length} required asset${mediaValidation.failedRequiredAssets.length === 1 ? "" : "s"} failed, ${mediaValidation.staleRequiredAssets.length} required asset${mediaValidation.staleRequiredAssets.length === 1 ? "" : "s"} stale.`}
            </div>
          ) : null}
          {mediaValidation.optionalWarnings.length > 0 ? (
            <div className="mt-4 rounded-[16px] border border-[#f3dfb2] bg-[#fff9ea] p-4 text-sm font-semibold leading-6 text-[#8a5a13]">
              Optional warnings: {optionalWarningCounts.missing_preview} optional preview{optionalWarningCounts.missing_preview === 1 ? "" : "s"} missing, {optionalWarningCounts.failed_generation} optional asset{optionalWarningCounts.failed_generation === 1 ? "" : "s"} failed, {optionalWarningCounts.stale_asset} optional asset{optionalWarningCounts.stale_asset === 1 ? "" : "s"} stale. These do not block media approval.
            </div>
          ) : null}
          {mediaAssets.length === 0 ? (
            <div className="mt-4">
              <EmptyAdminState>No media briefs yet.</EmptyAdminState>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {mediaAssets.map((asset) => (
                <form action={saveLearningMediaAsset} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={asset.id}>
                  <input name="assetId" type="hidden" value={asset.id} />
                  <input name="courseId" type="hidden" value={course.id} />
                  <input name="lessonId" type="hidden" value={asset.lesson_id ?? ""} />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">
                        {asset.lesson?.title ? `${asset.lesson.title} · ` : ""}{asset.placement}
                      </p>
                      <p className="mt-1 text-sm font-black capitalize">{asset.asset_type}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatusBadge tone={isRequiredMediaAsset(asset) ? "warning" : "neutral"}>
                        {isRequiredMediaAsset(asset) ? "required" : "optional"}
                      </AdminStatusBadge>
                      <AdminStatusBadge tone={workflowTone(asset.review_status)}>{asset.review_status.replaceAll("_", " ")}</AdminStatusBadge>
                      <AdminStatusBadge tone={asset.generation_status === "failed" ? "danger" : asset.generation_status === "completed" ? "good" : "warning"}>
                        {asset.generation_status.replaceAll("_", " ")}
                      </AdminStatusBadge>
                      {isStaleMediaAsset(asset) ? (
                        <AdminStatusBadge tone="danger">stale</AdminStatusBadge>
                      ) : null}
                      {optionalWarningByAssetId.has(asset.id) ? (
                        <AdminStatusBadge tone="warning">optional warning</AdminStatusBadge>
                      ) : null}
                    </div>
                  </div>
                  {asset.url ? (
                    <div className="mt-4 overflow-hidden rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={asset.alt_text ?? asset.caption ?? asset.placement} className="h-48 w-full object-cover" src={asset.url} />
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-3 text-xs font-semibold leading-5 text-[var(--ve-muted)] md:grid-cols-2">
                    <p>Generation status: <span className="font-black text-[var(--foreground)]">{asset.generation_status.replaceAll("_", " ")}</span></p>
                    <p>Provider/model: <span className="font-black text-[var(--foreground)]">{asset.provider ?? "pending"}{asset.model ? ` / ${asset.model}` : ""}</span></p>
                    <p>Storage path: <span className="font-black text-[var(--foreground)]">{asset.storage_path ?? "Not uploaded yet"}</span></p>
                    <p>Error: <span className="font-black text-[var(--foreground)]">{asset.generation_error ?? "None"}</span></p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
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
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Placement</span>
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
                  </div>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Prompt</span>
                    <textarea className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.prompt ?? ""} name="prompt" />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Script</span>
                    <textarea className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.script ?? ""} name="script" />
                  </label>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <label>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">URL</span>
                      <input className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.url ?? ""} name="url" />
                    </label>
                    <label>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Alt text</span>
                      <input className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.alt_text ?? ""} name="altText" />
                    </label>
                    <label>
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Caption</span>
                      <input className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.caption ?? ""} name="caption" />
                    </label>
                  </div>
                  <button className="mt-4 rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-sm font-black" type="submit">
                    Save media asset
                  </button>
                </form>
              ))}
            </div>
          )}
        </AdminCard>
      </section>
      <AdminCard>
        <CourseForm
          categories={categories}
          course={course}
          derivedMinutes={lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0)}
        />
      </AdminCard>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <AdminCard>
          <h2 className="mb-4 text-lg font-black">Lessons</h2>
          {lessons.length === 0 ? (
            <EmptyAdminState>No lessons yet.</EmptyAdminState>
          ) : (
            <>
              <AdminTable columns={["Lesson", "Minutes", "Retry", "Status", "Action"]}>
                {paginatedLessons.items.map((lesson) => (
                  <tr key={lesson.id}>
                    <td className="min-w-[260px] px-4 py-4">
                      <Link className="font-black hover:text-[#087f5b]" href={`/admin/courses/lessons/${lesson.id}`}>
                        {lesson.title}
                      </Link>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{lesson.slug}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold">{lesson.estimated_minutes}</td>
                    <td className="whitespace-nowrap px-4 py-4 capitalize">{lesson.retry_mode}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <AdminStatusBadge tone={statusTone(lesson.status)}>{statusLabel(lesson.status)}</AdminStatusBadge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
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
                              ? "rounded-[12px] bg-[#fff0f0] px-3 py-2 text-xs font-black text-[#c00000]"
                              : "rounded-[12px] bg-[#e4f4ed] px-3 py-2 text-xs font-black text-[#087f5b]"
                          }
                          disabled={
                            lesson.ai_generated
                            && lesson.status !== "published"
                            && lesson.ai_publish_status !== "ready"
                          }
                          type="submit"
                        >
                          {lesson.status === "published"
                            ? "Disable"
                            : lesson.ai_generated && lesson.ai_publish_status !== "ready"
                              ? "AI gates pending"
                              : "Enable"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </AdminTable>
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
              className="inline-flex w-full items-center justify-center rounded-[14px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white transition hover:bg-[#066f4f]"
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
