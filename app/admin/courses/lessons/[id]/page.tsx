import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { MediaAssetPresentationEditor } from "@/components/admin/MediaAssetPresentationEditor";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import {
  LessonForm,
  QuizSettingsForm,
  QuizQuestionForm,
} from "@/components/admin/LearningForms";
import { LessonPageBuilder } from "@/components/admin/LessonPageBuilder";
import {
  approveLessonMedia,
  approveLessonText,
  generateLessonMediaAssets,
  requestLessonMediaChanges,
  requestLessonTextChanges,
  saveLearningMediaAsset,
} from "@/app/admin/courses/lesson-page-actions";
import { getAiMediaConfig } from "@/lib/ai-media-generator";
import { parseImagePresentation } from "@/lib/image-presentation";
import {
  isRequiredMediaAsset,
  isStaleMediaAsset,
  validateMediaApproval,
} from "@/lib/ai-media-workflow";
import { getAdminLearningMediaAssets, getAdminLesson, requireAdmin } from "@/lib/admin";
import { formatXpLabel } from "@/lib/xp-format";

type LessonDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; notice?: string }>;
};

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
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

function latestTextFeedback(notes: Record<string, unknown>) {
  const history = Array.isArray(notes.textRevisionFeedbackHistory)
    ? notes.textRevisionFeedbackHistory
    : [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = asRecord(history[index]);
    const kind = typeof entry.kind === "string" ? entry.kind : "";
    const feedback = typeof entry.feedback === "string" ? entry.feedback.trim() : "";
    if (kind === "request" && feedback) {
      return feedback;
    }
  }

  return "";
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

export default async function LessonDetailPage({ params, searchParams }: LessonDetailPageProps) {
  const { id } = await params;
  const { page: selectedPageId, notice } = await searchParams;
  const { supabase } = await requireAdmin();
  const detail = await getAdminLesson(supabase, id);

  if (!detail) {
    notFound();
  }

  const { lesson, pages, blocks, quiz, questions } = detail;
  const mediaConfig = getAiMediaConfig();
  const mediaAssets = await getAdminLearningMediaAssets(supabase, {
    courseId: lesson.course_id,
    lessonId: lesson.id,
  });
  const totalXp = questions.reduce((total, question) => total + question.xp, 0);
  const mediaValidation = validateMediaApproval(mediaAssets);
  const hasRequiredImageAssets = mediaAssets.some(isRequiredMediaAsset);
  const storedTextFeedback = latestTextFeedback(lesson.ai_generation_notes ?? {});
  const storedMediaFeedback = latestMediaFeedback(lesson.ai_generation_notes ?? {});
  const mediaApprovalBlocked =
    lesson.ai_generated
    && lesson.ai_text_status === "approved"
    && (
      !hasRequiredImageAssets
      || mediaValidation.missingRequiredAssets.length > 0
      || mediaValidation.failedRequiredAssets.length > 0
      || mediaValidation.staleRequiredAssets.length > 0
    );

  return (
    <>
      <AdminPageHeader
        backHref={`/admin/courses/${lesson.course_id}`}
        backLabel="Course"
        eyebrow="Learning"
        title={lesson.title}
        subtitle="Shape the lesson experience from reading flow to scored quiz questions."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <AdminStatCard label="Pages" value={pages.length} />
        <AdminStatCard label="Blocks" value={blocks.length} />
        <AdminStatCard label="Questions" value={questions.length} tone="mission" />
        <AdminStatCard label="Quiz XP" value={formatXpLabel(totalXp)} tone="store" />
        <AdminCard className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Preview</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-black text-[#087f5b]">
            <Link href={`/lessons/${lesson.id}`}>Lesson</Link>
            {quiz ? <Link href={`/quiz/${lesson.id}`}>Quiz</Link> : null}
          </div>
        </AdminCard>
      </section>

      {lesson.ai_generated ? (
        <section className="mb-6 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <AdminCard>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">AI workflow</p>
            <h2 className="mt-2 text-lg font-black">Review this lesson independently</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              Approve text, generate media, and approve media for this lesson without waiting for the rest of the course.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Text status</p>
                <div className="mt-3">
                  <AdminStatusBadge tone={workflowTone(lesson.ai_text_status)}>{lesson.ai_text_status.replaceAll("_", " ")}</AdminStatusBadge>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {formatApproval(lesson.text_approved_at, lesson.text_approved_by_name)}
                </p>
              </div>
              <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Media status</p>
                <div className="mt-3">
                  <AdminStatusBadge tone={workflowTone(lesson.ai_media_status)}>{lesson.ai_media_status.replaceAll("_", " ")}</AdminStatusBadge>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {formatApproval(lesson.media_approved_at, lesson.media_approved_by_name)}
                </p>
              </div>
              <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Publish readiness</p>
                <div className="mt-3">
                  <AdminStatusBadge tone={workflowTone(lesson.ai_publish_status)}>{lesson.ai_publish_status.replaceAll("_", " ")}</AdminStatusBadge>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Course-level publishing still depends on the rest of the course.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {["draft", "in_review", "changes_requested"].includes(lesson.ai_text_status) ? (
                <form action={approveLessonText}>
                  <input name="lessonId" type="hidden" value={lesson.id} />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                  <PendingSubmitButton
                    className={workflowButtonClasses()}
                    label="Approve Lesson Text"
                    pendingLabel="Approving Lesson Text..."
                    type="submit"
                  />
                </form>
              ) : null}

              {lesson.ai_text_status === "approved" ? (
                <>
                  <form action={generateLessonMediaAssets}>
                    <input name="lessonId" type="hidden" value={lesson.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                    <PendingSubmitButton
                      className={workflowButtonClasses()}
                      disabled={!mediaConfig.canGenerate}
                      label="Generate Lesson Media"
                      pendingLabel="Generating Lesson Media..."
                      type="submit"
                    />
                  </form>
                  <form action={generateLessonMediaAssets}>
                    <input name="lessonId" type="hidden" value={lesson.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                    <input name="replaceExisting" type="hidden" value="true" />
                    <PendingSubmitButton
                      className={workflowButtonClasses("neutral")}
                      disabled={!mediaConfig.canGenerate}
                      label="Regenerate Lesson Images"
                      pendingLabel="Regenerating Lesson Images..."
                      type="submit"
                    />
                  </form>
                  {!mediaConfig.canGenerate ? (
                    <p className="basis-full text-xs font-semibold leading-5 text-[#c00000]">
                      Media generation is unavailable until these server settings are added: {mediaConfig.missingRequirements.join(", ")}.
                    </p>
                  ) : (
                    <p className="basis-full text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                      AI media generation currently supports images and infographics only.
                    </p>
                  )}
                </>
              ) : null}

              {["draft", "in_review", "changes_requested"].includes(lesson.ai_media_status) ? (
                <>
                  <form action={approveLessonMedia}>
                    <input name="lessonId" type="hidden" value={lesson.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                    <PendingSubmitButton
                      className={workflowButtonClasses()}
                      disabled={mediaApprovalBlocked}
                      label="Approve Lesson Media"
                      pendingLabel="Approving Lesson Media..."
                      type="submit"
                    />
                  </form>
                </>
              ) : null}
            </div>

            {mediaApprovalBlocked ? (
              <p className="mt-4 text-xs font-semibold leading-5 text-[#c00000]">
                {!hasRequiredImageAssets
                  ? "Lesson media approval is blocked because the required lesson image assets have not been seeded yet. Generate lesson media first."
                  : `Lesson media approval is blocked by required assets: ${mediaValidation.missingRequiredAssets.length} missing preview${mediaValidation.missingRequiredAssets.length === 1 ? "" : "s"}, ${mediaValidation.failedRequiredAssets.length} failed, ${mediaValidation.staleRequiredAssets.length} stale.`}
              </p>
            ) : null}

            <div className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Request text changes</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Record the specific text changes you want for this lesson. Lesson media will be locked again until the updated text is approved.
              </p>
              <form action={requestLessonTextChanges} className="mt-4">
                <input name="lessonId" type="hidden" value={lesson.id} />
                <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                <textarea
                  className="min-h-28 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                  defaultValue={storedTextFeedback}
                  name="changeRequest"
                  placeholder="Example: Strengthen the scenario, remove weak repetition, and make the quiz questions harder and more practical."
                  required
                />
                <PendingSubmitButton
                  className={`${workflowButtonClasses("danger")} mt-4`}
                  label="Request Lesson Text Changes"
                  pendingLabel="Saving Text Feedback..."
                  type="submit"
                />
              </form>
            </div>

            <div className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Media revision loop</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Record the exact visual changes you want for this lesson, then regenerate its media against that feedback.
              </p>
              {storedMediaFeedback ? (
                <div className="mt-4 rounded-[14px] bg-[var(--ve-panel)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">Latest requested media changes</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{storedMediaFeedback.feedback}</p>
                  {storedMediaFeedback.requestedAt ? (
                    <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                      Requested {formatPlanTime(storedMediaFeedback.requestedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <form action={requestLessonMediaChanges} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
                  <input name="lessonId" type="hidden" value={lesson.id} />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                  <textarea
                    className="min-h-28 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                    defaultValue={storedMediaFeedback?.feedback ?? ""}
                    name="mediaChangeRequest"
                    placeholder="Example: Stop cropping the faces, make the scene wider, remove title-like text, and simplify the background."
                    required
                  />
                  <PendingSubmitButton
                    className={`${workflowButtonClasses("danger")} mt-4`}
                    label="Request Lesson Media Changes"
                    pendingLabel="Saving Media Feedback..."
                    type="submit"
                  />
                </form>

                <form action={generateLessonMediaAssets} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
                  <input name="lessonId" type="hidden" value={lesson.id} />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                  <input name="replaceExisting" type="hidden" value="true" />
                  <input name="applyMediaFeedback" type="hidden" value="true" />
                  <textarea
                    className="min-h-28 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                    defaultValue={storedMediaFeedback?.feedback ?? ""}
                    name="mediaRevisionRequest"
                    placeholder="Use the latest requested media changes or add a tighter visual revision brief here."
                  />
                  {!mediaConfig.canGenerate ? (
                    <p className="mt-3 text-xs font-semibold leading-5 text-[#c00000]">
                      Media generation is unavailable until these server settings are added: {mediaConfig.missingRequirements.join(", ")}.
                    </p>
                  ) : null}
                  <PendingSubmitButton
                    className={`${workflowButtonClasses("neutral")} mt-4`}
                    disabled={!mediaConfig.canGenerate}
                    label="Regenerate Lesson Media With Feedback"
                    pendingLabel="Regenerating Lesson Media..."
                    type="submit"
                  />
                </form>
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-black">Lesson media assets</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              Manage only this lesson’s AI media here. Course cover and course thumbnail still stay on the course page.
            </p>
            {mediaAssets.length === 0 ? (
              <div className="mt-4">
                <EmptyAdminState>No lesson media briefs yet.</EmptyAdminState>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {mediaAssets.map((asset) => {
                  const presentation = parseImagePresentation(asset.metadata);

                  return (
                  <form action={saveLearningMediaAsset} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={asset.id}>
                    <input name="assetId" type="hidden" value={asset.id} />
                    <input name="courseId" type="hidden" value={lesson.course_id} />
                    <input name="lessonId" type="hidden" value={lesson.id} />
                    <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">{asset.placement}</p>
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
                        {isStaleMediaAsset(asset) ? <AdminStatusBadge tone="danger">stale</AdminStatusBadge> : null}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 text-xs font-semibold leading-5 text-[var(--ve-muted)] md:grid-cols-2">
                      <p>
                        Generation status: <span className="font-black text-[var(--foreground)]">{asset.generation_status.replaceAll("_", " ")}</span>
                      </p>
                      <p>
                        Provider/model: <span className="font-black text-[var(--foreground)]">{asset.provider ?? "pending"}{asset.model ? ` / ${asset.model}` : ""}</span>
                      </p>
                      <p className="md:col-span-2">
                        Error: <span className="font-black text-[var(--foreground)]">{asset.generation_error ?? "None"}</span>
                      </p>
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
                    </div>
                    <label className="mt-3 block">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Prompt</span>
                      <textarea className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.prompt ?? ""} name="prompt" />
                    </label>
                    <label className="mt-3 block">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Script</span>
                      <textarea className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={asset.script ?? ""} name="script" />
                    </label>
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
                    <PendingSubmitButton
                      className="mt-4 rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-sm font-black"
                      label="Save lesson media asset"
                      pendingLabel="Saving Media Asset..."
                      type="submit"
                    />
                  </form>
                )})}
              </div>
            )}
          </AdminCard>
        </section>
      ) : (
        <AdminCard className="mb-6">
          <p className="text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            This lesson was created manually, so the AI workflow statuses are informational only.
          </p>
        </AdminCard>
      )}

      <details className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-black">Lesson setup</summary>
        <div className="mt-5">
          <LessonForm courseId={lesson.course_id} lesson={lesson} />
        </div>
      </details>

      <LessonPageBuilder
        blocks={blocks}
        initialPageId={selectedPageId}
        lesson={lesson}
        pages={pages}
      />

      {quiz ? (
        <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
          <AdminCard>
            <QuizSettingsForm lessonId={lesson.id} quiz={quiz} />
          </AdminCard>
          <AdminCard>
            <h2 className="mb-1 text-lg font-black">Add question</h2>
            <p className="mb-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              XP lives on questions. Multiple choice is graded all-or-nothing.
            </p>
            <QuizQuestionForm
              lessonId={lesson.id}
              quiz={quiz}
              defaultQuestionOrder={questions.length + 1}
            />
          </AdminCard>
        </section>
      ) : null}

      {quiz ? (
        <section className="mt-6">
          <AdminCard>
            <h2 className="mb-4 text-lg font-black">Quiz questions</h2>
            {questions.length === 0 ? (
              <EmptyAdminState>No quiz questions yet.</EmptyAdminState>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => (
                  <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={question.id}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">
                          Question {question.question_order} · {question.question_type.replaceAll("_", " ")}
                        </p>
                        <h3 className="mt-1 font-black">{question.prompt}</h3>
                      </div>
                      <AdminStatusBadge tone="store">{formatXpLabel(question.xp)}</AdminStatusBadge>
                    </div>
                    <QuizQuestionForm lessonId={lesson.id} quiz={quiz} question={question} />
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </section>
      ) : null}
    </>
  );
}
