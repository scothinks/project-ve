import Link from "next/link";
import {
  AdminCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { getAiMediaConfig } from "@/lib/ai-media-generator";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type CourseAction = (formData: FormData) => void | Promise<void>;

type CourseDetailWorkflowSectionProps = {
  course: AdminCourseDetailPageData["course"];
  canPublish: boolean;
  plannerShellPlan: AdminCourseDetailPageData["plannerShellPlan"];
  plannerShellSelection: AdminCourseDetailPageData["plannerShellSelection"];
  showPlannedLessonContinuation: boolean;
  mediaValidation: AdminCourseDetailPageData["mediaValidation"];
  hasRequiredImageAssets: boolean;
  hasManualCourseMedia: boolean;
  optionalWarningCounts: AdminCourseDetailPageData["optionalWarningCounts"];
  storedTextFeedback: AdminCourseDetailPageData["storedTextFeedback"];
  storedMediaFeedback: AdminCourseDetailPageData["storedMediaFeedback"];
  mediaApprovalBlocked: boolean;
  mediaConfig: ReturnType<typeof getAiMediaConfig>;
  actions: {
    approveCourseMedia: CourseAction;
    approveCourseManualMedia: CourseAction;
    approveCourseText: CourseAction;
    generateCourseMediaAssets: CourseAction;
    generatePlannedLessonsFromSelectedPlan: CourseAction;
    publishApprovedCourse: CourseAction;
    requestCourseMediaChanges: CourseAction;
    requestCourseTextChanges: CourseAction;
    reviseCourseTextWithAi: CourseAction;
  };
};

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

function workflowButtonClasses(tone: "primary" | "danger" | "neutral" = "primary") {
  if (tone === "danger") {
    return "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-danger)]";
  }

  if (tone === "neutral") {
    return "rounded-[12px] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black text-[var(--foreground)]";
  }

  return "rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white";
}

function collapsibleSummaryClasses() {
  return "cursor-pointer list-none px-5 py-5";
}

function collapsibleBodyClasses() {
  return "border-t border-[var(--ve-line-soft)] px-5 pb-5";
}

export function CourseDetailWorkflowSection({
  actions,
  canPublish,
  course,
  hasManualCourseMedia,
  hasRequiredImageAssets,
  mediaApprovalBlocked,
  mediaConfig,
  mediaValidation,
  optionalWarningCounts,
  plannerShellPlan,
  plannerShellSelection,
  showPlannedLessonContinuation,
  storedMediaFeedback,
  storedTextFeedback,
}: CourseDetailWorkflowSectionProps) {
  return (
    <AdminCard className="p-0">
      <details open>
        <summary className={collapsibleSummaryClasses()}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">AI review</p>
              <h2 className="mt-2 text-lg font-black">Approval gates for assisted content</h2>
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
                <form action={actions.approveCourseText}>
                  <input name="courseId" type="hidden" value={course.id} />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                  <PendingSubmitButton
                    className={workflowButtonClasses()}
                    label="Approve Text"
                    pendingLabel="Approving Text..."
                    type="submit"
                  />
                </form>
              ) : null}

              {course.ai_text_status === "approved" ? (
                <>
                  <form action={actions.generateCourseMediaAssets}>
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
                  <form action={actions.generateCourseMediaAssets}>
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
                  {hasManualCourseMedia ? (
                    <form action={actions.approveCourseManualMedia}>
                      <input name="courseId" type="hidden" value={course.id} />
                      <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                      <button className={workflowButtonClasses("neutral")} type="submit">Use Own Media</button>
                    </form>
                  ) : null}
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
                  <form action={actions.approveCourseMedia}>
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
                  <form action={actions.publishApprovedCourse}>
                    <input name="courseId" type="hidden" value={course.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                    <button className={workflowButtonClasses()} disabled={!canPublish} type="submit">Publish Approved Course</button>
                  </form>
                ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              This course was created manually, so assisted-content states are informational only.
            </p>
          )}

          {showPlannedLessonContinuation && plannerShellPlan && plannerShellSelection ? (
            <div className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Next step</p>
                  <h3 className="mt-2 text-base font-black">Create the planned lessons for this course</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    This course was created from the staged planner flow, and the original lesson outline is ready to turn into draft lessons.
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Planned lessons: {plannerShellSelection.lessonOutline.length}. They will be created as draft lessons and enter the existing text review, media review, and publish workflow.
                  </p>
                </div>
                <AdminStatusBadge tone="warning">Lessons pending</AdminStatusBadge>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <form action={actions.generatePlannedLessonsFromSelectedPlan}>
                  <input name="planId" type="hidden" value={plannerShellPlan.id} />
                  <PendingSubmitButton
                    className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                    label="Create Planned Lessons"
                    pendingLabel="Creating Planned Lessons..."
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
                <form action={actions.requestCourseTextChanges} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
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

                <form action={actions.reviseCourseTextWithAi} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
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
                    label="Apply Reviewer Feedback"
                    pendingLabel="Queuing Revision..."
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
                <form action={actions.requestCourseMediaChanges} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
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

                <form action={actions.generateCourseMediaAssets} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
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
  );
}
