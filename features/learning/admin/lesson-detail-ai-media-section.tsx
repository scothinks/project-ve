import {
  AdminCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { MediaAssetPresentationEditor } from "@/components/admin/MediaAssetPresentationEditor";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { getAiMediaConfig } from "@/lib/ai-media-generator";
import { isRequiredMediaAsset } from "@/lib/ai-media-workflow";
import { parseImagePresentation } from "@/lib/image-presentation";
import type { AdminLessonDetailPageData } from "./lesson-detail-data";

type LessonMediaAction = (formData: FormData) => void | Promise<void>;

type LessonDetailAiMediaSectionProps = {
  hasManualLessonMedia: boolean;
  hasRequiredImageAssets: boolean;
  lesson: AdminLessonDetailPageData["lesson"];
  mediaApprovalBlocked: boolean;
  mediaAssets: AdminLessonDetailPageData["mediaAssets"];
  mediaConfig: ReturnType<typeof getAiMediaConfig>;
  mediaLibraryAssets: AdminLessonDetailPageData["mediaLibraryAssets"];
  mediaValidation: AdminLessonDetailPageData["mediaValidation"];
  storedMediaFeedback: AdminLessonDetailPageData["storedMediaFeedback"];
  storedTextFeedback: string;
  actions: {
    approveLearningMediaAsset: LessonMediaAction;
    approveLessonManualMedia: LessonMediaAction;
    approveLessonMedia: LessonMediaAction;
    approveLessonText: LessonMediaAction;
    generateLearningMediaAsset: LessonMediaAction;
    generateLessonMediaAssets: LessonMediaAction;
    requestLessonMediaChanges: LessonMediaAction;
    requestLessonTextChanges: LessonMediaAction;
    saveLearningMediaAsset: LessonMediaAction;
    useLibraryMediaAsset: LessonMediaAction;
  };
};

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
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

function getMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  return metadata?.[key] === true;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function collapsibleSummaryClasses() {
  return "cursor-pointer list-none px-5 py-5";
}

function collapsibleBodyClasses() {
  return "border-t border-[var(--ve-line-soft)] px-5 pb-5";
}

export function LessonDetailAiMediaSection({
  actions,
  hasManualLessonMedia,
  hasRequiredImageAssets,
  lesson,
  mediaApprovalBlocked,
  mediaAssets,
  mediaConfig,
  mediaLibraryAssets,
  mediaValidation,
  storedMediaFeedback,
  storedTextFeedback,
}: LessonDetailAiMediaSectionProps) {
  if (!lesson.ai_generated) {
    return (
      <AdminCard className="mb-6">
        <p className="text-sm font-semibold leading-6 text-[var(--ve-muted)]">
          This lesson was created manually, so the AI workflow statuses are informational only.
        </p>
      </AdminCard>
    );
  }

  return (
    <section className="mb-6 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
      <AdminCard className="p-0">
        <details open>
          <summary className={collapsibleSummaryClasses()}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">AI workflow</p>
                <h2 className="mt-2 text-lg font-black">Review this lesson independently</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                  Approve text, generate media, and approve media for this lesson without waiting for the rest of the course.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge tone={workflowTone(lesson.ai_text_status)}>{lesson.ai_text_status.replaceAll("_", " ")}</AdminStatusBadge>
                <AdminStatusBadge tone={workflowTone(lesson.ai_media_status)}>{lesson.ai_media_status.replaceAll("_", " ")}</AdminStatusBadge>
                <AdminStatusBadge tone={workflowTone(lesson.ai_publish_status)}>{lesson.ai_publish_status.replaceAll("_", " ")}</AdminStatusBadge>
              </div>
            </div>
          </summary>

          <div className={collapsibleBodyClasses()}>
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
                <form action={actions.approveLessonText}>
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
                  <form action={actions.generateLessonMediaAssets}>
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
                  <form action={actions.generateLessonMediaAssets}>
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
                  {hasManualLessonMedia ? (
                    <form action={actions.approveLessonManualMedia}>
                      <input name="lessonId" type="hidden" value={lesson.id} />
                      <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                      <PendingSubmitButton
                        className={workflowButtonClasses("neutral")}
                        label="Use Own Media"
                        pendingLabel="Approving Own Media..."
                        type="submit"
                      />
                    </form>
                  ) : null}
                  {!mediaConfig.canGenerate ? (
                    <p className="basis-full text-xs font-semibold leading-5 text-[var(--ve-danger)]">
                      Media generation is unavailable until these server settings are added: {mediaConfig.missingRequirements.join(", ")}.
                    </p>
                  ) : (
                    <p className="basis-full text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                      AI media generation currently supports images and infographics only.
                    </p>
                  )}
                </>
              ) : null}

              {["draft", "generation_ready", "in_review", "changes_requested"].includes(lesson.ai_media_status) ? (
                <form action={actions.approveLessonMedia}>
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
              ) : null}
            </div>

            {mediaApprovalBlocked ? (
              <p className="mt-4 text-xs font-semibold leading-5 text-[var(--ve-danger)]">
                {!hasRequiredImageAssets
                  ? "Lesson media approval is blocked because the required lesson image assets have not been seeded yet. Generate lesson media first."
                  : `Lesson media approval is blocked by required assets: ${mediaValidation.missingRequiredAssets.length} missing preview${mediaValidation.missingRequiredAssets.length === 1 ? "" : "s"}, ${mediaValidation.failedRequiredAssets.length} failed.`}
              </p>
            ) : null}

            <div className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Request text changes</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Record the specific text changes you want for this lesson. Lesson media will be locked again until the updated text is approved.
              </p>
              <form action={actions.requestLessonTextChanges} className="mt-4">
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
                <form action={actions.requestLessonMediaChanges} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
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

                <form action={actions.generateLessonMediaAssets} className="rounded-[14px] border border-[var(--ve-line-soft)] p-4">
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
                    <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-danger)]">
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
          </div>
        </details>
      </AdminCard>

      <AdminCard className="p-0">
        <details open>
          <summary className={collapsibleSummaryClasses()}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black">Lesson media assets</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                  Manage only this lesson&apos;s AI media here. Course cover and course thumbnail still stay on the course page.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge tone="neutral">{mediaAssets.length} assets</AdminStatusBadge>
                {mediaApprovalBlocked ? <AdminStatusBadge tone="danger">blocked</AdminStatusBadge> : null}
              </div>
            </div>
          </summary>

          <div className={collapsibleBodyClasses()}>
            <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Infographics stay as in-page media recommendations. They are not used as page cover art because the cover crop is too tight and will clip them.
            </div>
            {mediaAssets.length === 0 ? (
              <div className="mt-4">
                <EmptyAdminState>No lesson media briefs yet.</EmptyAdminState>
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
                  const availableLibraryAssets = mediaLibraryAssets.filter((libraryAsset) => libraryAsset.id !== asset.id);
                  const canGenerateAsset = mediaConfig.canGenerate && !excludeFromGeneration;
                  const canApproveAsset = typeof asset.url === "string" && asset.url.trim().length > 0 && asset.generation_status !== "failed";

                  return (
                    <form action={actions.saveLearningMediaAsset} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={asset.id}>
                      <input name="assetId" type="hidden" value={asset.id} />
                      <input name="courseId" type="hidden" value={lesson.course_id} />
                      <input name="lessonId" type="hidden" value={lesson.id} />
                      <input name="redirectTo" type="hidden" value={`/admin/courses/lessons/${lesson.id}`} />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">{asset.placement}</p>
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
                              Use this when you do not want this page recommendation to fill again. Saving with this on also clears its current preview slot.
                            </span>
                          </span>
                        </label>
                      ) : (
                        <div className="mt-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                          This asset powers a core learner surface, so it stays in the generation workflow.
                        </div>
                      )}
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
                      <div className="mt-4 grid gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                        <label>
                          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Use from library</span>
                          <select
                            className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
                            defaultValue=""
                            disabled={availableLibraryAssets.length === 0}
                            name="libraryAssetId"
                          >
                            <option value="">{availableLibraryAssets.length === 0 ? "No saved media yet" : "Choose saved media"}</option>
                            {availableLibraryAssets.map((libraryAsset) => (
                              <option key={libraryAsset.id} value={libraryAsset.id}>
                                {libraryAsset.lesson?.title ? `${libraryAsset.lesson.title} · ` : ""}{libraryAsset.placement}
                              </option>
                            ))}
                          </select>
                        </label>
                        <PendingSubmitButton
                          className="rounded-[12px] bg-[var(--ve-card)] px-4 py-2 text-sm font-black disabled:opacity-50"
                          disabled={availableLibraryAssets.length === 0}
                          formAction={actions.useLibraryMediaAsset}
                          label="Use from library"
                          name="actionIntent"
                          pendingLabel="Applying..."
                          pendingValue="useLibrary"
                          type="submit"
                          value="useLibrary"
                        />
                        <PendingSubmitButton
                          className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                          disabled={!canGenerateAsset}
                          formAction={actions.generateLearningMediaAsset}
                          label="Generate Media"
                          name="actionIntent"
                          pendingLabel="Generating..."
                          pendingValue="generate"
                          type="submit"
                          value="generate"
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <PendingSubmitButton
                          className="rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-sm font-black"
                          label="Save lesson media asset"
                          name="actionIntent"
                          pendingLabel="Saving Media Asset..."
                          pendingValue="save"
                          type="submit"
                          value="save"
                        />
                        <PendingSubmitButton
                          className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                          disabled={!canApproveAsset}
                          formAction={actions.approveLearningMediaAsset}
                          label="Approve Media"
                          name="actionIntent"
                          pendingLabel="Approving..."
                          pendingValue="approve"
                          type="submit"
                          value="approve"
                        />
                      </div>
                    </form>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </AdminCard>
    </section>
  );
}
