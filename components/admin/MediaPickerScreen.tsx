"use client";

import { AiImageAuthoring } from "./ai/AiImageAuthoring";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { useState } from "react";
import { mapMediaAssetToPickerValue } from "@/components/admin/media-picker-domain";
import type { MediaPickerRequestConfig, PickedMedia } from "@/components/admin/MediaPickerProvider";
import type { AdminLearningMediaAssetRow } from "@/lib/admin";
import { normalizeImageFit, normalizeImagePosition } from "@/lib/image-presentation";
import { cn } from "@/lib/utils";

const mediaKindAccept: Record<string, string> = {
  audio: "audio/mpeg,audio/mp4,audio/wav,audio/ogg",
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/webm,video/quicktime,video/ogg",
};

function tabClasses(active: boolean) {
  return cn(
    "rounded-full border px-[18px] py-[9px] text-[13px] transition",
    active
      ? "border-[var(--ui-current-text)] bg-[var(--ui-current-text)] font-extrabold text-[var(--ui-on-action)]"
      : "border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] font-bold text-[var(--ui-text)] hover:border-[var(--ui-current-text)]",
  );
}

function labelClasses() {
  return "text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]";
}

export function MediaPickerScreen({
  request,
  onPick,
}: {
  request: MediaPickerRequestConfig;
  onPick: (value: PickedMedia) => void;
}) {
  const mediaKind = request.mediaKind ?? "image";
  const isGif = request.isGif === true;
  const isImage = mediaKind === "image";

  const [activeTab, setActiveTab] = useState<"library" | "upload" | "ai">(request.initialTab ?? "library");
  const [url, setUrl] = useState(request.initialUrl ?? "");
  const [altText, setAltText] = useState(request.initialAltText ?? "");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const fit = normalizeImageFit(request.initialFit ?? "cover");
  const positionX = normalizeImagePosition(request.initialPositionX, 50);
  const positionY = normalizeImagePosition(request.initialPositionY, 50);
  const caption = request.caption ?? "";

  const uploadTarget = request.uploadContext ?? { assetType: mediaKind, placement: request.placementLabel };
  const canUpload = isImage;
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const tabs: Array<{ key: "library" | "upload" | "ai"; label: string }> = [
    { key: "library", label: isGif ? "GIF library" : "Media library" },
    { key: "upload", label: "Upload or link" },
    ...(isImage && !isGif ? [{ key: "ai" as const, label: "Generate with AI" }] : []),
  ];

  function pickAsset(asset: AdminLearningMediaAssetRow) {
    onPick(mapMediaAssetToPickerValue(asset, { fit, positionX, positionY }));
  }

  function useLink() {
    if (!url.trim()) return;
    onPick({ altText, caption, fit, positionX, positionY, url: url.trim() });
  }

  async function uploadSelectedFile(file: File) {
    setUploadError("");

    if (!canUpload) {
      setUploadError("Direct upload currently supports images.");
      return;
    }

    if (isImage && !altText.trim()) {
      setUploadError("Add alt text before uploading — CMS images require it.");
      return;
    }

    const body = new FormData();
    body.set("file", file);
    body.set("rightsConfirmed", String(rightsConfirmed));
    body.set("altText", altText);
    body.set("assetType", uploadTarget.assetType);
    body.set("placement", uploadTarget.placement);
    body.set("caption", caption);
    body.set("fit", fit);
    body.set("positionX", String(positionX));
    body.set("positionY", String(positionY));
    if (uploadTarget.courseId) body.set("courseId", uploadTarget.courseId);
    if (uploadTarget.lessonId) body.set("lessonId", uploadTarget.lessonId);

    setIsUploading(true);

    try {
      const response = await fetch("/api/admin/learning/media/upload", { body, method: "POST" });
      const result = await response.json() as { asset?: AdminLearningMediaAssetRow; error?: string };

      if (!response.ok || !result.asset) {
        throw new Error(result.error || "Upload failed.");
      }

      pickAsset(result.asset);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            className={tabClasses(activeTab === tab.key)}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "library" ? <MediaLibrary courseId={uploadTarget.courseId} mediaType={mediaKind} onPick={(asset) => onPick({
        assetVersionId: asset.id, altText: asset.alt_text, caption: "", fit, positionX, positionY, url: asset.url,
      })} /> : null}

      {activeTab === "upload" ? (
        <div className="flex max-w-[480px] flex-col gap-5">
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />I have permission for in-project reuse, cropping and derivation without mandatory attribution.</label>
          <label
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] p-[22px] text-sm font-extrabold text-[var(--ui-action)]",
              (isUploading || !canUpload) && "pointer-events-none opacity-60",
            )}
          >
            <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            {isUploading ? "Uploading..." : uploadFile ? uploadFile.name : "Choose a file to upload"}
            <input
              accept={mediaKindAccept[mediaKind]}
              className="sr-only"
              disabled={isUploading || !canUpload}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setUploadFile(file);
                if (file) void uploadSelectedFile(file);
              }}
              type="file"
            />
          </label>

          {!canUpload ? (
            <p className="text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
              Direct upload currently supports images. Existing permitted audio and video can be selected from the library.
            </p>
          ) : null}

          {isImage ? (
            <label className="flex flex-col gap-2">
              <span className={labelClasses()}>Alt text</span>
              <input
                className="rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-4 py-3 text-sm font-bold text-[var(--ui-text)] outline-none focus:border-[var(--ui-focus)]"
                disabled={isUploading}
                onChange={(event) => setAltText(event.target.value)}
                value={altText}
              />
            </label>
          ) : null}

          {uploadError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-black text-[var(--ui-danger)]">{uploadError}</p>
              {uploadFile ? (
                <button
                  className="rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-extrabold text-[var(--ui-text)] disabled:opacity-50"
                  disabled={isUploading}
                  onClick={() => void uploadSelectedFile(uploadFile)}
                  type="button"
                >
                  Try upload again
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
            <span className="h-px flex-1 bg-[var(--ui-border-subtle)]" />
            or paste an external link
            <span className="h-px flex-1 bg-[var(--ui-border-subtle)]" />
          </div>

          <p className="text-xs">External links remain controlled by their host; organisation privacy applies to uploaded files.</p>
          <div className="flex gap-2.5">
            <input
              className="min-w-0 flex-1 rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-4 py-3 text-sm font-semibold text-[var(--ui-text)] outline-none focus:border-[var(--ui-focus)]"
              onChange={(event) => setUrl(event.target.value)}
              placeholder={
                mediaKind === "video"
                  ? "https://example.com/video.mp4"
                  : mediaKind === "audio"
                    ? "https://example.com/audio.mp3"
                    : "https://example.com/image.jpg"
              }
              value={url}
            />
            <button
              className="shrink-0 rounded-[14px] bg-[var(--ui-action)] px-5 text-[13px] font-extrabold text-[var(--ui-on-action)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!url.trim()}
              onClick={useLink}
              type="button"
            >
              Use link
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "ai" ? <AiImageAuthoring request={request} onPick={onPick} /> : null}
    </div>
  );
}
