import type { AdminLearningMediaAssetRow } from "../../lib/admin.ts";
import {
  normalizeImageFit,
  normalizeImagePosition,
  type ImageFit,
} from "../../lib/image-presentation.ts";

export type MediaPickerPresentationValue = {
  altText: string;
  caption: string;
  fit: ImageFit;
  positionX: number;
  positionY: number;
  url: string;
};

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function getMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string, fallback: number) {
  const value = Number(metadata?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function mapMediaAssetToPickerValue(
  asset: AdminLearningMediaAssetRow,
  current: Pick<MediaPickerPresentationValue, "fit" | "positionX" | "positionY">,
): MediaPickerPresentationValue {
  return {
    altText: asset.alt_text ?? "",
    caption: asset.caption ?? "",
    fit: normalizeImageFit(getMetadataString(asset.metadata, "fit") || current.fit),
    positionX: normalizeImagePosition(getMetadataNumber(asset.metadata, "positionX", current.positionX), 50),
    positionY: normalizeImagePosition(getMetadataNumber(asset.metadata, "positionY", current.positionY), 50),
    url: asset.url ?? "",
  };
}
