"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState } from "react";
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

type MediaPickerProps = {
  aiGenerationAvailable?: boolean;
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
  return "mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function tabClasses(active = false) {
  return cn(
    "rounded-[12px] px-3 py-2 text-xs font-black transition",
    active
      ? "bg-[var(--ve-green)] text-white"
      : "bg-[var(--ve-panel)] text-[var(--ve-muted-strong)] hover:text-[var(--ve-green)]",
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

function assetLabel(asset: AdminLearningMediaAssetRow) {
  return [
    asset.lesson?.title,
    asset.placement,
    asset.asset_type,
  ].filter(Boolean).join(" · ");
}

export function MediaPicker({
  aiGenerationAvailable = true,
  assetTypeFilter,
  canGenerate = false,
  caption = "",
  fieldNames,
  generateAction,
  initialAltText,
  initialFit = "cover",
  initialPositionX = 50,
  initialPositionY = 50,
  initialUrl,
  libraryAssets = [],
  libraryFieldName = "libraryAssetId",
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
  const [activeTab, setActiveTab] = useState("library");
  const [url, setUrl] = useState(initialUrl);
  const [altText, setAltText] = useState(initialAltText);
  const [fit, setFit] = useState<ImageFit>(normalizeImageFit(initialFit));
  const [positionX, setPositionX] = useState(normalizeImagePosition(initialPositionX, 50));
  const [positionY, setPositionY] = useState(normalizeImagePosition(initialPositionY, 50));
  const [captionValue, setCaptionValue] = useState(caption);
  const [search, setSearch] = useState("");
  const [assetType, setAssetType] = useState("all");
  const [uploadedAssets, setUploadedAssets] = useState<AdminLearningMediaAssetRow[]>([]);
  const [uploadAltText, setUploadAltText] = useState(initialAltText);
  const [uploadError, setUploadError] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedLibraryAssetId, setSelectedLibraryAssetId] = useState("");
  const tabs = [
    ["library", "Choose from library"],
    ...(aiGenerationAvailable ? [["generate", "Generate with AI"] as const] : []),
    ["external", "External URL"],
    ["upload", "Upload"],
  ] as const;
  const combinedLibraryAssets = useMemo(
    () => [...uploadedAssets, ...libraryAssets],
    [libraryAssets, uploadedAssets],
  );
  const libraryAssetTypes = useMemo(
    () => Array.from(new Set(combinedLibraryAssets.map((asset) => asset.asset_type))).sort(),
    [combinedLibraryAssets],
  );
  const filteredLibraryAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return combinedLibraryAssets.filter((asset) => {
      if (assetTypeFilter && !assetTypeFilter.includes(asset.asset_type)) return false;
      if (assetType !== "all" && asset.asset_type !== assetType) return false;
      if (!normalizedSearch) return true;
      return assetLabel(asset).toLowerCase().includes(normalizedSearch)
        || (asset.alt_text ?? "").toLowerCase().includes(normalizedSearch)
        || (asset.caption ?? "").toLowerCase().includes(normalizedSearch);
    });
  }, [assetType, assetTypeFilter, combinedLibraryAssets, search]);
  const selectedLibraryAsset =
    combinedLibraryAssets.find((asset) => asset.id === selectedLibraryAssetId)
    ?? filteredLibraryAssets[0]
    ?? null;
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

    setSelectedLibraryAssetId(asset.id);
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
      setUploadError("Choose an image file to upload.");
      return;
    }

    if (!uploadAltText.trim()) {
      setUploadError("Alt text is required for uploaded CMS images.");
      return;
    }

    const body = new FormData();
    body.set("file", uploadFile);
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

      setUploadedAssets((assets) => [result.asset as AdminLearningMediaAssetRow, ...assets]);
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
    <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
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
          <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
            <label>
              <span className={labelClasses()}>Search media</span>
              <input
                className={fieldClasses()}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search placement, lesson, alt text"
                value={search}
              />
            </label>
            <label>
              <span className={labelClasses()}>Asset type</span>
              <select className={fieldClasses()} onChange={(event) => setAssetType(event.target.value)} value={assetType}>
                <option value="all">All types</option>
                {libraryAssetTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>
          {renderFormFields ? (
            <input name={libraryFieldName} type="hidden" value={selectedLibraryAsset?.id ?? ""} />
          ) : null}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {filteredLibraryAssets.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-5 text-sm font-semibold text-[var(--ve-muted)]">
                No matching approved or reusable media is available yet.
              </div>
            ) : (
              filteredLibraryAssets.slice(0, 8).map((asset) => (
                <button
                  className={cn(
                    "rounded-[14px] border p-3 text-left transition",
                    selectedLibraryAsset?.id === asset.id
                      ? "border-[var(--ve-green)] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_80%,var(--ve-card))]"
                      : "border-[var(--ve-line-soft)] bg-[var(--ve-panel)] hover:border-[var(--ve-green)]",
                  )}
                  key={asset.id}
                  onClick={() => applyAsset(asset)}
                  type="button"
                >
                  <div className="h-28 overflow-hidden rounded-[12px] bg-[var(--ve-card-subtle)]">
                    {asset.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={asset.alt_text ?? asset.placement} className="h-full w-full object-cover" src={asset.url} />
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs font-black">{assetLabel(asset)}</p>
                  <p className="mt-1 text-[11px] font-bold text-[var(--ve-muted)]">
                    {asset.review_status.replaceAll("_", " ")} · {asset.generation_status.replaceAll("_", " ")}
                  </p>
                  {!asset.alt_text?.trim() ? (
                    <p className="mt-1 text-[11px] font-black text-[var(--ve-danger)]">Missing alt text</p>
                  ) : null}
                </button>
              ))
            )}
          </div>
          {useLibraryAction && renderFormFields ? (
            <PendingSubmitButton
              className="mt-4 rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
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
          <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
            <p className="text-sm font-black">AI generation</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Edit the prompt or placement details in this form, then generate a new candidate for this exact media slot.
            </p>
            {generateAction && renderFormFields ? (
              <PendingSubmitButton
                className="mt-4 rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                disabled={!canGenerate}
                formAction={generateAction}
                label="Generate media"
                name="actionIntent"
                pendingLabel="Generating..."
                pendingValue="generate"
                type="submit"
                value="generate"
              />
            ) : (
              <p className="mt-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                AI generation is available from seeded course and lesson media briefs.
              </p>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content className="mt-4" value="external">
          {previewImage ? (
            previewVariant === "course-thumbnail" ? (
              <div className="overflow-hidden rounded-[18px] bg-[var(--ve-panel)] shadow-sm">
                <div className="h-28">{previewImage}</div>
                <div className="p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
                    {previewEyebrow || "Values Education"}
                  </p>
                  <h4 className="mt-2 text-lg font-black leading-6">{previewTitle || "Course title"}</h4>
                  <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    {previewDescription || "Short learner-facing course description."}
                  </p>
                  <p className="mt-3 text-[11px] font-black text-[var(--ve-muted)]">{previewMinutes ?? 0} min from lessons</p>
                </div>
              </div>
            ) : (
              <div className="h-48 overflow-hidden rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)]">
                {previewImage}
              </div>
            )
          ) : (
            <div className="rounded-[16px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)] px-4 py-6 text-sm font-semibold text-[var(--ve-muted)]">
              Add a media URL or choose from the library to preview it here.
            </div>
          )}

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label>
              <span className={labelClasses()}>External URL</span>
              <input
                className={fieldClasses()}
                onChange={(event) => {
                  setUrl(event.target.value);
                  emit({ url: event.target.value });
                }}
                value={url}
              />
            </label>
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
              <select
                className={fieldClasses()}
                onChange={(event) => {
                  const nextFit = normalizeImageFit(event.target.value);
                  setFit(nextFit);
                  emit({ fit: nextFit });
                }}
                value={fit}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label>
              <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
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
              <span className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
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
          {showCaption ? (
            <label className="mt-3 block">
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
          <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
              <label>
                <span className={labelClasses()}>Image file</span>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className={fieldClasses()}
                  disabled={isUploading || (!uploadContext?.courseId && !uploadContext?.lessonId)}
                  onChange={(event) => {
                    setUploadFile(event.target.files?.[0] ?? null);
                    setUploadError("");
                    setUploadStatus("");
                  }}
                  type="file"
                />
              </label>
              <label>
                <span className={labelClasses()}>Alt text</span>
                <input
                  className={fieldClasses()}
                  disabled={isUploading || (!uploadContext?.courseId && !uploadContext?.lessonId)}
                  onChange={(event) => setUploadAltText(event.target.value)}
                  value={uploadAltText}
                />
              </label>
            </div>
            {showCaption ? (
              <label className="mt-3 block">
                <span className={labelClasses()}>Caption / attribution</span>
                <input
                  className={fieldClasses()}
                  disabled={isUploading || (!uploadContext?.courseId && !uploadContext?.lessonId)}
                  onChange={(event) => {
                    setCaptionValue(event.target.value);
                    onCaptionChange?.(event.target.value);
                    emit({ caption: event.target.value });
                  }}
                  value={captionValue}
                />
              </label>
            ) : null}
            {!uploadContext?.courseId && !uploadContext?.lessonId ? (
              <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Save this item before uploading media.
              </p>
            ) : null}
            {uploadError ? (
              <p className="mt-3 text-xs font-black text-[var(--ve-danger)]">{uploadError}</p>
            ) : null}
            {uploadStatus ? (
              <p className="mt-3 text-xs font-black text-[var(--ve-green)]">{uploadStatus}</p>
            ) : null}
            <button
              className="mt-4 rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isUploading || !uploadFile || (!uploadContext?.courseId && !uploadContext?.lessonId)}
              onClick={uploadSelectedAsset}
              type="button"
            >
              {isUploading ? "Uploading..." : "Upload media"}
            </button>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
