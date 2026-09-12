"use client";

import { useMediaPicker } from "./MediaPickerProvider";
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { libraryAssetToEditorialRow } from "@/features/media/domain/editorial-adapter";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { mapMediaAssetToPickerValue } from "@/components/admin/media-picker-domain";
import type { AdminLearningMediaAssetRow } from "@/lib/admin";
import {
  getImageFitClass,
  getImagePresentationStyle,
  normalizeImageFit,
  normalizeImagePosition,
  type ImageFit,
} from "@/lib/image-presentation";
import { cn } from "@/lib/utils";

type MediaPickerAction = (formData: FormData) => void | Promise<void>;

type MediaPickerFieldNames = {
  altText?: string;
  caption?: string;
  fit?: string;
  positionX?: string;
  positionY?: string;
  url?: string;
};

type MediaPickerUploadContext = {
  assetType: string;
  courseId?: string | null;
  lessonId?: string | null;
  placement: string;
};

type MediaPickerKind = "image" | "video" | "audio";

const mediaKindAccept: Record<MediaPickerKind, string> = {
  audio: "audio/mpeg,audio/mp4,audio/wav,audio/ogg",
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/webm,video/quicktime,video/ogg",
};

type MediaPickerProps = {
  aiGenerationAvailable?: boolean;
  aiGenerationSupported?: boolean;
  assetTypeFilter?: string[];
  canGenerate?: boolean;
  caption?: string;
  fieldNames?: MediaPickerFieldNames;
  generateAction?: MediaPickerAction;
  initialAltText: string;
  initialFit?: ImageFit | string;
  initialPositionX?: number;
  initialPositionY?: number;
  initialUrl: string;
  libraryAssets?: AdminLearningMediaAssetRow[];
  libraryFieldName?: string;
  mediaKind?: MediaPickerKind;
  onCaptionChange?: (value: string) => void;
  onPickAsset?: (asset: AdminLearningMediaAssetRow) => void;
  onPresentationChange?: (value: {
    altText: string;
    caption: string;
    fit: ImageFit;
    positionX: number;
    positionY: number;
    url: string;
  }) => void;
  placementLabel: string;
  previewDescription?: string;
  previewEyebrow?: string;
  previewMinutes?: number;
  previewTitle?: string;
  previewVariant?: "generic" | "course-thumbnail" | "course-cover";
  renderFormFields?: boolean;
  showCaption?: boolean;
  useLibraryAction?: MediaPickerAction;
  uploadContext?: MediaPickerUploadContext;
};

function fieldClasses() {
  return "mt-2 w-full rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[var(--ui-focus)] focus:ring-4 focus:ring-[var(--ui-focus)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]";
}

function tabClasses(active = false) {
  return cn(
    "rounded-full border px-4 py-2 text-xs font-extrabold transition",
    active
      ? "border-[var(--ui-current-text)] bg-[var(--ui-current-text)] text-[var(--ui-on-action)]"
      : "border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:border-[var(--ui-current-text)]",
  );
}

function getPreviewImage({
  altText,
  fit,
  placementLabel,
  positionX,
  positionY,
  url,
}: {
  altText: string;
  fit: ImageFit;
  placementLabel: string;
  positionX: number;
  positionY: number;
  url: string;
}) {
  if (!url.trim()) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={altText.trim() || placementLabel}
      className={`h-full w-full ${getImageFitClass({ fit })}`}
      src={url}
      style={getImagePresentationStyle({ fit, positionX, positionY })}
    />
  );
}

export function MediaPicker({
  aiGenerationAvailable = true,
  caption = "",
  fieldNames,
  initialAltText,
  initialFit = "cover",
  initialPositionX = 50,
  initialPositionY = 50,
  initialUrl,
  libraryFieldName = "libraryAssetId",
  mediaKind = "image",
  onCaptionChange,
  onPickAsset,
  onPresentationChange,
  placementLabel,
  previewDescription,
  previewEyebrow,
  previewMinutes,
  previewTitle,
  previewVariant = "generic",
  renderFormFields = true,
  showCaption = false,
  useLibraryAction,
  uploadContext,
}: MediaPickerProps) {
  const { requestMedia } = useMediaPicker();
  const [activeTab, setActiveTab] = useState("library");
  const [url, setUrl] = useState(initialUrl);
  const [altText, setAltText] = useState(initialAltText);
  const [fit, setFit] = useState<ImageFit>(normalizeImageFit(initialFit));
  const [positionX, setPositionX] = useState(normalizeImagePosition(initialPositionX, 50));
  const [positionY, setPositionY] = useState(normalizeImagePosition(initialPositionY, 50));
  const [captionValue, setCaptionValue] = useState(caption);
  const [selectedLibraryAsset, setSelectedLibraryAsset] = useState<AdminLearningMediaAssetRow | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [uploadAltText, setUploadAltText] = useState(initialAltText);
  const [uploadError, setUploadError] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const tabs = [
    ["library", "Choose from library"],
    ...(aiGenerationAvailable ? [["generate", "Generate with AI"] as const] : []),
    ["external", "External URL"],
    ["upload", "Upload"],
  ] as const;
  const previewImage = getPreviewImage({
    altText,
    fit,
    placementLabel,
    positionX,
    positionY,
    url,
  });
  const names = {
    altText: fieldNames?.altText ?? "altText",
    caption: fieldNames?.caption ?? "caption",
    fit: fieldNames?.fit ?? "imageFit",
    positionX: fieldNames?.positionX ?? "imagePositionX",
    positionY: fieldNames?.positionY ?? "imagePositionY",
    url: fieldNames?.url ?? "url",
  };

  function emit(next: Partial<{
    altText: string;
    caption: string;
    fit: ImageFit;
    positionX: number;
    positionY: number;
    url: string;
  }>) {
    const value = {
      altText,
      caption: captionValue,
      fit,
      positionX,
      positionY,
      url,
      ...next,
    };
    onPresentationChange?.(value);
  }

  function applyAsset(asset: AdminLearningMediaAssetRow) {
    const nextValue = mapMediaAssetToPickerValue(asset, { fit, positionX, positionY });

    setSelectedLibraryAsset(asset);
    setUrl(nextValue.url);
    setAltText(nextValue.altText);
    setFit(nextValue.fit);
    setPositionX(nextValue.positionX);
    setPositionY(nextValue.positionY);
    setCaptionValue(nextValue.caption);
    onCaptionChange?.(nextValue.caption);
    onPickAsset?.(asset);
    onPresentationChange?.(nextValue);
  }

  async function uploadSelectedAsset() {
    setUploadError("");
    setUploadStatus("");

    if (!uploadContext?.courseId && !uploadContext?.lessonId) {
      setUploadError("Save this item before uploading media.");
      return;
    }

    if (!uploadFile) {
      setUploadError("Choose a file to upload.");
      return;
    }

    if (mediaKind === "image" && !uploadAltText.trim()) {
      setUploadError("Alt text is required for uploaded CMS images.");
      return;
    }

    const body = new FormData();
    body.set("file", uploadFile);
    body.set("rightsConfirmed", String(rightsConfirmed));
    body.set("altText", uploadAltText);
    body.set("assetType", uploadContext.assetType);
    body.set("placement", uploadContext.placement);
    body.set("caption", captionValue);
    body.set("fit", fit);
    body.set("positionX", String(positionX));
    body.set("positionY", String(positionY));
    if (uploadContext.courseId) body.set("courseId", uploadContext.courseId);
    if (uploadContext.lessonId) body.set("lessonId", uploadContext.lessonId);

    setIsUploading(true);
    setUploadStatus("Uploading...");

    try {
      const response = await fetch("/api/admin/learning/media/upload", {
        body,
        method: "POST",
      });
      const result = await response.json() as {
        asset?: AdminLearningMediaAssetRow;
        error?: string;
      };

      if (!response.ok || !result.asset) {
        throw new Error(result.error || "Upload failed.");
      }


      applyAsset(result.asset);
      setUploadFile(null);
      setUploadStatus("Uploaded and selected.");
      setActiveTab("library");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      setUploadStatus("");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4">
      {renderFormFields ? (
        <>
          <input name={names.url} type="hidden" value={url} />
          <input name={names.altText} type="hidden" value={altText} />
          <input name={names.fit} type="hidden" value={fit} />
          <input name={names.positionX} type="hidden" value={positionX} />
          <input name={names.positionY} type="hidden" value={positionY} />
          {showCaption ? <input name={names.caption} type="hidden" value={captionValue} /> : null}
        </>
      ) : null}
      <Tabs.Root onValueChange={setActiveTab} value={activeTab}>
        <Tabs.List className="flex flex-wrap gap-2">
          {tabs.map(([value, label]) => (
            <Tabs.Trigger className={tabClasses(activeTab === value)} key={value} value={value}>
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content className="mt-4" value="library">
          <MediaLibrary courseId={uploadContext?.courseId} mediaType={mediaKind} onPick={(asset) => applyAsset(libraryAssetToEditorialRow(asset))} />
          {renderFormFields ? <input name={libraryFieldName} type="hidden" value={selectedLibraryAsset?.id ?? ""} /> : null}
          {useLibraryAction && renderFormFields ? (
            <PendingSubmitButton
              className="mt-4 rounded-[12px] bg-[var(--ui-action)] px-4 py-2 text-sm font-black text-[var(--ui-on-action)] disabled:opacity-50"
              disabled={!selectedLibraryAsset}
              formAction={useLibraryAction}
              label="Use selected media"
              name="actionIntent"
              pendingLabel="Applying..."
              pendingValue="useLibrary"
              type="submit"
              value="useLibrary"
            />
          ) : null}
        </Tabs.Content>

        <Tabs.Content className="mt-4" value="generate">
          <button type="button" className={tabClasses()} onClick={async () => {
            const picked = await requestMedia({ aiGenerationAvailable, mediaKind, placementLabel, title: `Choose ${placementLabel.toLowerCase()}`, uploadContext, initialAltText: altText, initialUrl: url, initialTab: "ai" });
            if (!picked) return;
            setUrl(picked.url); setAltText(picked.altText); setCaptionValue(picked.caption);
          }}>Open image chooser</button>
        </Tabs.Content>

        <Tabs.Content className="mt-4" value="external">
          {mediaKind === "image" ? (
            previewImage ? (
              previewVariant === "course-thumbnail" ? (
                <div className="overflow-hidden rounded-[18px] bg-[var(--ui-surface-soft)] shadow-sm">
                  <div className="h-28">{previewImage}</div>
                  <div className="p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ui-text)]">
                      {previewEyebrow || "Values Education"}
                    </p>
                    <h4 className="mt-2 text-lg font-black leading-6">{previewTitle || "Course title"}</h4>
                    <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
                      {previewDescription || "Short learner-facing course description."}
                    </p>
                    <p className="mt-3 text-[11px] font-black text-[var(--ui-text-muted)]">{previewMinutes ?? 0} min from lessons</p>
                  </div>
                </div>
              ) : (
                <div className="h-48 overflow-hidden rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-raised)]">
                  {previewImage}
                </div>
              )
            ) : (
              <div className="rounded-[16px] border border-dashed border-[var(--ui-border-subtle)] bg-[var(--ui-surface-raised)] px-4 py-6 text-sm font-semibold text-[var(--ui-text-muted)]">
                Add a media URL or choose from the library to preview it here.
              </div>
            )
          ) : null}

          <div className={cn("grid gap-3", mediaKind === "image" ? "mt-3 md:grid-cols-3" : "max-w-[480px]")}>
            <label>
              <span className={labelClasses()}>{mediaKind === "image" ? "External URL" : `${placementLabel} URL`}</span>
              <input
                className={fieldClasses()}
                onChange={(event) => {
                  setUrl(event.target.value);
                  emit({ url: event.target.value });
                }}
                placeholder={mediaKind === "video" ? "https://example.com/video.mp4" : mediaKind === "audio" ? "https://example.com/audio.mp3" : undefined}
                value={url}
              />
            </label>
            {mediaKind === "image" ? (
              <>
                <label>
                  <span className={labelClasses()}>Alt text</span>
                  <input
                    className={fieldClasses()}
                    onChange={(event) => {
                      setAltText(event.target.value);
                      emit({ altText: event.target.value });
                    }}
                    required={Boolean(url.trim())}
                    value={altText}
                  />
                </label>
                <label>
                  <span className={labelClasses()}>Image fit</span>
                  <AdminSelect
                    className="mt-2"
                    onValueChange={(next) => {
                      const nextFit = normalizeImageFit(next);
                      setFit(nextFit);
                      emit({ fit: nextFit });
                    }}
                    options={[
                      { label: "Cover", value: "cover" },
                      { label: "Contain", value: "contain" },
                    ]}
                    size="compact"
                    value={fit}
                  />
                </label>
              </>
            ) : null}
          </div>
          {mediaKind === "image" ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label>
                <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
                  <span>Horizontal focus</span>
                  <span>{positionX}%</span>
                </span>
                <input
                  className="mt-2 w-full"
                  max={100}
                  min={0}
                  onChange={(event) => {
                    const nextPosition = normalizeImagePosition(Number(event.target.value), 50);
                    setPositionX(nextPosition);
                    emit({ positionX: nextPosition });
                  }}
                  type="range"
                  value={positionX}
                />
              </label>
              <label>
                <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
                  <span>Vertical focus</span>
                  <span>{positionY}%</span>
                </span>
                <input
                  className="mt-2 w-full"
                  max={100}
                  min={0}
                  onChange={(event) => {
                    const nextPosition = normalizeImagePosition(Number(event.target.value), 50);
                    setPositionY(nextPosition);
                    emit({ positionY: nextPosition });
                  }}
                  type="range"
                  value={positionY}
                />
              </label>
            </div>
          ) : null}
          {showCaption ? (
            <label className="mt-3 block max-w-[480px]">
              <span className={labelClasses()}>Caption / attribution</span>
              <input
                className={fieldClasses()}
                onChange={(event) => {
                  setCaptionValue(event.target.value);
                  onCaptionChange?.(event.target.value);
                  emit({ caption: event.target.value });
                }}
                value={captionValue}
              />
            </label>
          ) : null}
        </Tabs.Content>

        <Tabs.Content className="mt-4" value="upload">
          <label className="mb-3 flex gap-2 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} />I have permission for in-project reuse, cropping and derivation without mandatory attribution.</label>
          {!uploadContext?.courseId && !uploadContext?.lessonId ? (
            <div className="rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] p-4">
              <p className="text-sm font-black">Upload not available yet</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
                File uploads need a saved course to attach to. Save this course as a draft first, then come back here to
                upload directly — or use Choose from library or External URL for now.
              </p>
            </div>
          ) : (
            <div className="flex max-w-[480px] flex-col gap-4">
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] p-[22px] text-sm font-extrabold text-[var(--ui-action)]",
                  isUploading && "pointer-events-none opacity-60",
                )}
              >
                <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                {uploadFile ? uploadFile.name : "Choose a file to upload"}
                <input
                  accept={mediaKindAccept[mediaKind]}
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => {
                    setUploadFile(event.target.files?.[0] ?? null);
                    setUploadError("");
                    setUploadStatus("");
                  }}
                  type="file"
                />
              </label>
              {mediaKind === "image" ? (
                <label>
                  <span className={labelClasses()}>Alt text</span>
                  <input
                    className={fieldClasses()}
                    disabled={isUploading}
                    onChange={(event) => setUploadAltText(event.target.value)}
                    value={uploadAltText}
                  />
                </label>
              ) : null}
              {showCaption ? (
                <label>
                  <span className={labelClasses()}>Caption / attribution</span>
                  <input
                    className={fieldClasses()}
                    disabled={isUploading}
                    onChange={(event) => {
                      setCaptionValue(event.target.value);
                      onCaptionChange?.(event.target.value);
                      emit({ caption: event.target.value });
                    }}
                    value={captionValue}
                  />
                </label>
              ) : null}
              {uploadError ? (
                <p className="text-xs font-black text-[var(--ui-danger)]">{uploadError}</p>
              ) : null}
              {uploadStatus ? (
                <p className="text-xs font-black text-[var(--ui-text)]">{uploadStatus}</p>
              ) : null}
              <button
                className="self-start rounded-full bg-[var(--ui-action)] px-[22px] py-3 text-[13px] font-extrabold text-[var(--ui-on-action)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading || !uploadFile}
                onClick={uploadSelectedAsset}
                type="button"
              >
                {isUploading ? "Uploading..." : "Upload media"}
              </button>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
