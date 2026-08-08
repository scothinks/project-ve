import {
  AdminCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { getAiMediaConfig } from "@/lib/ai-media-generator";
import { parseImagePresentation } from "@/lib/image-presentation";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type ShellMediaAction = (formData: FormData) => void | Promise<void>;

type CourseDetailShellMediaSectionProps = {
  aiGenerationAvailable?: boolean;
  course: AdminCourseDetailPageData["course"];
  courseCoverAsset: AdminCourseDetailPageData["courseCoverAsset"];
  courseThumbnailAsset: AdminCourseDetailPageData["courseThumbnailAsset"];
  derivedMinutes: number;
  mediaConfig: ReturnType<typeof getAiMediaConfig>;
  mediaLibraryAssets: AdminCourseDetailPageData["mediaLibraryAssets"];
  actions: {
    approveLearningMediaAsset: ShellMediaAction;
    generateLearningMediaAsset: ShellMediaAction;
    saveLearningMediaAsset: ShellMediaAction;
    useLibraryMediaAsset: ShellMediaAction;
  };
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function collapsibleSummaryClasses() {
  return "cursor-pointer list-none px-5 py-5";
}

function collapsibleBodyClasses() {
  return "border-t border-[var(--ve-line-soft)] px-5 pb-5";
}

export function CourseDetailShellMediaSection({
  actions,
  aiGenerationAvailable = true,
  course,
  courseCoverAsset,
  courseThumbnailAsset,
  derivedMinutes,
  mediaConfig,
  mediaLibraryAssets,
}: CourseDetailShellMediaSectionProps) {
  return (
    <AdminCard className="p-0">
      <details>
        <summary className={collapsibleSummaryClasses()}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Course media</p>
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
                  ? "Use this for the wider course artwork. Keep the key subject away from the edges."
                  : "This is the learner card image. Position it for the card crop first.";
              const availableLibraryAssets = mediaLibraryAssets.filter((libraryAsset) => libraryAsset.id !== asset.id);
              const canApproveAsset = typeof asset.url === "string" && asset.url.trim().length > 0 && asset.generation_status !== "failed";

              return (
                <form action={actions.saveLearningMediaAsset} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={asset.id}>
                  <input name="assetId" type="hidden" value={asset.id} />
                  <input name="courseId" type="hidden" value={course.id} />
                  <input name="lessonId" type="hidden" value="" />
                  <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                  <input name="assetType" type="hidden" value={asset.asset_type} />
                  <input name="placement" type="hidden" value={asset.placement} />
                  <input name="reviewStatus" type="hidden" value={asset.review_status} />
                  <input name="prompt" type="hidden" value={asset.prompt ?? ""} />
                  <input name="script" type="hidden" value={asset.script ?? ""} />

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

                  <MediaPicker
                    aiGenerationAvailable={aiGenerationAvailable}
                    canGenerate={mediaConfig.canGenerate}
                    caption={asset.caption ?? ""}
                    generateAction={actions.generateLearningMediaAsset}
                    initialAltText={asset.alt_text ?? ""}
                    initialFit={presentation.fit}
                    initialPositionX={presentation.positionX}
                    initialPositionY={presentation.positionY}
                    initialUrl={asset.url ?? ""}
                    libraryAssets={availableLibraryAssets}
                    placementLabel={title}
                    previewDescription={course.description}
                    previewEyebrow={course.category}
                    previewMinutes={derivedMinutes}
                    previewTitle={course.title}
                    previewVariant={targetKind === "course_cover" ? "course-cover" : "course-thumbnail"}
                    showCaption
                    useLibraryAction={actions.useLibraryMediaAsset}
                  />

                  <PendingSubmitButton
                    className="mt-4 rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-sm font-black"
                    label={`Save ${title}`}
                    name="actionIntent"
                    pendingLabel="Saving Image..."
                    pendingValue="save"
                    type="submit"
                    value="save"
                  />
                  <PendingSubmitButton
                    className="mt-3 rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                    disabled={!canApproveAsset}
                    formAction={actions.approveLearningMediaAsset}
                    label="Approve Media"
                    name="actionIntent"
                    pendingLabel="Approving..."
                    pendingValue="approve"
                    type="submit"
                    value="approve"
                  />
                </form>
              );
            })}

            {!courseThumbnailAsset && !courseCoverAsset ? (
              <div className="rounded-[16px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-5 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Course media briefs have not been seeded yet. Generate course media first, then come back here to position the thumbnail and cover.
              </div>
            ) : null}
          </div>
        </div>
      </details>
    </AdminCard>
  );
}
