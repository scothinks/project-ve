import type { WorkflowLessonBlockRow, WorkflowMediaAssetRow } from "../data/workflow.ts";
import { isImageMediaAsset } from "../../../lib/ai-media-workflow.ts";
import { sanitizePlainTextInput } from "../../../lib/input-safety.ts";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getMediaMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

export function buildPagesByLessonId<T extends { lesson_id: string }>(pages: T[]) {
  const pagesByLessonId = new Map<string, T[]>();
  for (const page of pages) {
    const current = pagesByLessonId.get(page.lesson_id) ?? [];
    current.push(page);
    pagesByLessonId.set(page.lesson_id, current);
  }

  return pagesByLessonId;
}

export function buildManagedImageBlockPayload(
  asset: Pick<WorkflowMediaAssetRow, "id" | "url" | "alt_text" | "caption" | "placement">,
  existingPayload: unknown,
) {
  return {
    ...asRecord(existingPayload),
    src: asset.url,
    alt: asset.alt_text || asset.caption || asset.placement,
    caption: asset.caption || "",
    aiManagedByAssetId: asset.id,
    aiManagedKind: "learning_media_asset",
    aiGenerated: true,
  };
}

export function findManagedImageBlock(
  blocks: WorkflowLessonBlockRow[],
  assetId: string,
) {
  return blocks.find((block) =>
    block.block_type === "image" && asRecord(block.payload).aiManagedByAssetId === assetId,
  ) ?? null;
}

export function getManagedImageBlockIds(
  blocks: Array<{ id: string; payload: Record<string, unknown> }>,
  assetId: string,
) {
  return blocks
    .filter((block) => asRecord(block.payload).aiManagedByAssetId === assetId)
    .map((block) => block.id);
}

export function normalizeLegacyMediaAssetType(
  asset: Pick<WorkflowMediaAssetRow, "asset_type" | "placement" | "lesson_id" | "metadata" | "prompt" | "script">,
) {
  if (isImageMediaAsset(asset as Pick<WorkflowMediaAssetRow, "asset_type">)) {
    return asset.asset_type;
  }

  const metadata = asRecord(asset.metadata);
  const targetKind = getMediaMetadataString(metadata, "targetKind");
  const placement = asset.placement.toLowerCase();
  const prompt = sanitizePlainTextInput(String(asset.prompt ?? ""), 500).toLowerCase();
  const script = sanitizePlainTextInput(String(asset.script ?? ""), 500).toLowerCase();
  const combined = `${placement} ${prompt} ${script}`;

  if (targetKind === "course_cover" || placement === "course_cover") {
    return "cover";
  }

  if (
    targetKind === "course_thumbnail"
    || targetKind === "lesson_thumbnail"
    || placement.includes("thumbnail")
  ) {
    return "thumbnail";
  }

  if (combined.includes("infographic") || combined.includes("diagram") || combined.includes("visual summary")) {
    return "infographic";
  }

  return "image";
}

export function resolveManualMediaTargetKind(
  metadata: Record<string, unknown>,
  nextAssetType: string,
  requestedPageMediaTarget: string,
) {
  const targetPageId = getMediaMetadataString(metadata, "targetPageId");
  if (nextAssetType === "infographic" && targetPageId) {
    return "page_block";
  }

  if (requestedPageMediaTarget === "page_block" && targetPageId) {
    return "page_block";
  }

  if (requestedPageMediaTarget === "page_cover" && targetPageId) {
    return "page_cover";
  }

  return getMediaMetadataString(metadata, "targetKind");
}
