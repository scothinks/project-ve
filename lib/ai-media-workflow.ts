type MediaApprovalAsset = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  asset_type: string;
  placement: string;
  url: string | null;
  metadata: Record<string, unknown> | null;
  review_status: string;
  generation_status: string;
};

export type MediaApprovalOptionalReason =
  | "missing_preview"
  | "failed_generation";

export type MediaApprovalOptionalWarning<T extends MediaApprovalAsset = MediaApprovalAsset> = {
  asset: T;
  reasons: MediaApprovalOptionalReason[];
};

export type MediaApprovalValidation<T extends MediaApprovalAsset = MediaApprovalAsset> = {
  missingRequiredAssets: T[];
  failedRequiredAssets: T[];
  optionalWarnings: Array<MediaApprovalOptionalWarning<T>>;
};

const IMAGE_ASSET_TYPES = new Set(["image", "thumbnail", "cover", "infographic"]);

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataBoolean(metadata: Record<string, unknown>, key: string) {
  return metadata[key] === true;
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

export function isImageMediaAsset(asset: Pick<MediaApprovalAsset, "asset_type">) {
  return IMAGE_ASSET_TYPES.has(asset.asset_type);
}

export function getMediaAssetTargetKind(
  asset: Pick<MediaApprovalAsset, "asset_type" | "placement" | "metadata" | "lesson_id">,
) {
  const metadata = asRecord(asset.metadata);
  const metadataTargetKind = getMetadataString(metadata, "targetKind");
  if (metadataTargetKind) {
    return metadataTargetKind;
  }

  if (asset.asset_type === "thumbnail") {
    return asset.lesson_id ? "lesson_thumbnail" : "course_thumbnail";
  }

  if (asset.asset_type === "cover") {
    return asset.lesson_id ? "lesson_cover" : "course_cover";
  }

  return "";
}

export function isCourseCoverMediaAsset(
  asset: Pick<MediaApprovalAsset, "asset_type" | "placement" | "metadata" | "lesson_id">,
) {
  return getMediaAssetTargetKind(asset) === "course_cover"
    || asset.placement.toLowerCase() === "course_cover";
}

export function isRequiredMediaAsset(asset: MediaApprovalAsset) {
  if (!isImageMediaAsset(asset)) {
    return false;
  }

  if (isCourseCoverMediaAsset(asset)) {
    return false;
  }

  return getMetadataBoolean(asRecord(asset.metadata), "required");
}

export function isGenerationExcludedMediaAsset(asset: Pick<MediaApprovalAsset, "metadata">) {
  return getMetadataBoolean(asRecord(asset.metadata), "excludeFromGeneration");
}

function hasUsableUrl(asset: Pick<MediaApprovalAsset, "url">) {
  return typeof asset.url === "string" && asset.url.trim().length > 0;
}

export function validateMediaApproval<T extends MediaApprovalAsset>(assets: T[]): MediaApprovalValidation<T> {
  const imageAssets = assets.filter(isImageMediaAsset);
  const requiredAssets = imageAssets.filter(isRequiredMediaAsset);
  const optionalAssets = imageAssets.filter((asset) => !isRequiredMediaAsset(asset));

  const optionalWarnings = optionalAssets.flatMap((asset) => {
    if (isGenerationExcludedMediaAsset(asset)) {
      return [];
    }

    const reasons: MediaApprovalOptionalReason[] = [];

    if (!hasUsableUrl(asset) && asset.review_status !== "rejected" && asset.generation_status !== "skipped") {
      reasons.push("missing_preview");
    }

    if (asset.generation_status === "failed") {
      reasons.push("failed_generation");
    }

    return reasons.length > 0 ? [{ asset, reasons }] : [];
  });

  return {
    missingRequiredAssets: requiredAssets.filter((asset) => !hasUsableUrl(asset)),
    failedRequiredAssets: requiredAssets.filter((asset) => asset.generation_status === "failed"),
    optionalWarnings,
  };
}
