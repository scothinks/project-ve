import {
  AdminCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { getAiMediaConfig } from "@/lib/ai-media-generator";
import { isRequiredMediaAsset } from "@/lib/ai-media-workflow";
import { parseImagePresentation } from "@/lib/image-presentation";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type MediaRegistryAction = (formData: FormData) => void | Promise<void>;

type CourseDetailMediaRegistrySectionProps = {
  aiGenerationAvailable?: boolean;
  course: AdminCourseDetailPageData["course"];
  mediaAssets: AdminCourseDetailPageData["mediaAssets"];
  mediaLibraryAssets: AdminCourseDetailPageData["mediaLibraryAssets"];
  mediaValidation: AdminCourseDetailPageData["mediaValidation"];
  hasRequiredImageAssets: boolean;
  legacyMediaAssetCount: number;
  mediaApprovalBlocked: boolean;
  mediaConfig: ReturnType<typeof getAiMediaConfig>;
  optionalWarningByAssetId: AdminCourseDetailPageData["optionalWarningByAssetId"];
  optionalWarningCounts: AdminCourseDetailPageData["optionalWarningCounts"];
  actions: {
    approveLearningMediaAsset: MediaRegistryAction;
    generateLearningMediaAsset: MediaRegistryAction;
    normalizeCourseLegacyMediaAssets: MediaRegistryAction;
    saveLearningMediaAsset: MediaRegistryAction;
    useLibraryMediaAsset: MediaRegistryAction;
  };
};

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

function collapsibleSummaryClasses() {
  return "cursor-pointer list-none px-5 py-5";
}

function collapsibleBodyClasses() {
  return "border-t border-[var(--ve-line-soft)] px-5 pb-5";
}

export function CourseDetailMediaRegistrySection({
  actions,
  aiGenerationAvailable = true,
  course,
  hasRequiredImageAssets,
  legacyMediaAssetCount,
  mediaApprovalBlocked,
  mediaAssets,
  mediaConfig,
  mediaLibraryAssets,
  mediaValidation,
  optionalWarningByAssetId,
  optionalWarningCounts,
}: CourseDetailMediaRegistrySectionProps) {
  return (
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

              <form action={actions.normalizeCourseLegacyMediaAssets} className="mt-4 flex flex-wrap items-end gap-4">
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
                const availableLibraryAssets = mediaLibraryAssets.filter((libraryAsset) => libraryAsset.id !== asset.id);
                const canGenerateAsset = mediaConfig.canGenerate && !excludeFromGeneration;
                const canApproveAsset = typeof asset.url === "string" && asset.url.trim().length > 0 && asset.generation_status !== "failed";

                return (
                  <form action={actions.saveLearningMediaAsset} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" id={`media-asset-${asset.id}`} key={asset.id}>
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
                    <MediaPicker
                      aiGenerationAvailable={aiGenerationAvailable}
                      canGenerate={canGenerateAsset}
                      caption={asset.caption ?? ""}
                      generateAction={actions.generateLearningMediaAsset}
                      initialAltText={asset.alt_text ?? ""}
                      initialFit={presentation.fit}
                      initialPositionX={presentation.positionX}
                      initialPositionY={presentation.positionY}
                      initialUrl={asset.url ?? ""}
                      libraryAssets={availableLibraryAssets}
                      placementLabel={asset.placement}
                      showCaption
                      useLibraryAction={actions.useLibraryMediaAsset}
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <PendingSubmitButton
                        className="rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-sm font-black"
                        label="Save media asset"
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
  );
}
