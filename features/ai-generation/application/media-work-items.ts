import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateLearningMediaImage,
  type LearningMediaAssetForGeneration,
  type LearningMediaGenerationContext,
} from "@/lib/ai-media-generator";
import type { Database, Json } from "@/types/database";
import {
  applyLearningMediaAssetTarget,
  updateMediaAssetGenerationStatus,
} from "../data/media-assets";
import type { WorkflowMediaAssetRow } from "../data/workflow";
import type { MediaTarget } from "../domain/media-planning";
import {
  buildCompletedMediaAsset,
  processMediaGenerationWorkItems,
  type MediaGenerationCounts,
  type MediaGenerationOutcome,
} from "./media-worker";

type AiGenerationAdminClient = SupabaseClient<Database>;

export type MediaGenerationWorkItem = {
  asset: WorkflowMediaAssetRow;
  context: LearningMediaGenerationContext;
  target: MediaTarget;
};

async function processMediaGenerationWorkItem(
  supabase: AiGenerationAdminClient,
  item: MediaGenerationWorkItem,
  replaceExisting: boolean,
): Promise<MediaGenerationOutcome> {
  const { asset, context, target } = item;

  try {
    const result = await generateLearningMediaImage({
      asset: asset as LearningMediaAssetForGeneration,
      context,
      replaceExisting,
    });

    const updatedAsset = buildCompletedMediaAsset(asset, target, result);

    if (result.status === "skipped") {
      const { error } = await supabase
        .from("learning_media_assets")
        .update({
          generation_status: "completed",
          generation_error: null,
          metadata: updatedAsset.metadata as Json,
        })
        .eq("id", asset.id);

      if (error) {
        throw error;
      }
    }

    await applyLearningMediaAssetTarget(supabase, updatedAsset, target);
    return result.status === "generated" ? "generatedCount" : "reusedCount";
  } catch (error) {
    await updateMediaAssetGenerationStatus(
      supabase,
      asset.id,
      "failed",
      error instanceof Error ? error.message : "Image generation failed.",
    ).catch(() => undefined);
    return "failedCount";
  }
}

export async function processMediaWorkItemsForJob(
  supabase: AiGenerationAdminClient,
  workItems: MediaGenerationWorkItem[],
  replaceExisting: boolean,
  skippedCount: number,
): Promise<MediaGenerationCounts> {
  return processMediaGenerationWorkItems(
    workItems,
    (item) => processMediaGenerationWorkItem(supabase, item, replaceExisting),
    skippedCount,
  );
}
