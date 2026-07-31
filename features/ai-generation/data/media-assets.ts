import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildManagedImageBlockPayload,
  findManagedImageBlock,
  getManagedImageBlockIds,
} from "../application/media-targets.ts";
import { buildImagePayloadFromAsset, type MediaTarget } from "../domain/media-planning.ts";
import type { Database, Json } from "../../../types/database.ts";
import type { WorkflowLessonBlockRow, WorkflowMediaAssetRow } from "./workflow.ts";

type AiGenerationAdminClient = SupabaseClient<Database>;

const learningMediaAssetSelect =
  "id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order";

export async function getLearningMediaAssetById(
  supabase: AiGenerationAdminClient,
  assetId: string,
) {
  const { data, error } = await supabase
    .from("learning_media_assets")
    .select(learningMediaAssetSelect)
    .eq("id", assetId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Media asset not found.");
  }

  return data as WorkflowMediaAssetRow;
}

export async function updateMediaAssetGenerationStatus(
  supabase: AiGenerationAdminClient,
  assetId: string,
  status: "pending" | "skipped" | "failed",
  errorMessage: string | null,
) {
  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      generation_status: status,
      generation_error: errorMessage,
    })
    .eq("id", assetId);

  if (error) {
    throw error;
  }
}

export async function applyLearningMediaAssetTarget(
  supabase: AiGenerationAdminClient,
  asset: WorkflowMediaAssetRow,
  target: MediaTarget,
) {
  if (!asset.url) {
    return;
  }

  if (target.kind === "asset_only" || target.kind === "course_cover") {
    return;
  }

  const imagePayload = buildImagePayloadFromAsset(asset);

  if (target.kind === "course_thumbnail" && asset.course_id) {
    const { error } = await supabase
      .from("courses")
      .update({ thumbnail: imagePayload as Json })
      .eq("id", asset.course_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "lesson_thumbnail" && asset.lesson_id) {
    const { error } = await supabase
      .from("lessons")
      .update({ cover_image: imagePayload as Json })
      .eq("id", asset.lesson_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_cover") {
    const { error } = await supabase
      .from("lesson_pages")
      .update({ cover_image: imagePayload as Json })
      .eq("id", target.pageId);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_block") {
    const { data: blocks, error: blocksError } = await supabase
      .from("lesson_content_blocks")
      .select("id, page_id, block_type, sort_order, payload")
      .eq("page_id", target.pageId)
      .order("sort_order", { ascending: true });

    if (blocksError) {
      throw blocksError;
    }

    const typedBlocks = (blocks ?? []) as WorkflowLessonBlockRow[];
    const matchingBlock = findManagedImageBlock(typedBlocks, asset.id);
    const nextPayload = buildManagedImageBlockPayload(asset, matchingBlock?.payload);

    if (matchingBlock?.id) {
      const { error } = await supabase
        .from("lesson_content_blocks")
        .update({
          payload: nextPayload as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchingBlock.id);

      if (error) {
        throw error;
      }

      return;
    }

    const nextSortOrder = typedBlocks.reduce((max, block) => Math.max(max, block.sort_order), 0) + 1;
    const { error } = await supabase
      .from("lesson_content_blocks")
      .insert({
        page_id: target.pageId,
        block_type: "image",
        sort_order: nextSortOrder,
        payload: nextPayload as Json,
      });

    if (error) {
      throw error;
    }
  }
}

export async function clearLearningMediaAssetTarget(
  supabase: AiGenerationAdminClient,
  asset: WorkflowMediaAssetRow,
  target: MediaTarget,
) {
  if (target.kind === "asset_only" || target.kind === "course_cover") {
    return;
  }

  if (target.kind === "course_thumbnail" && asset.course_id) {
    const { error } = await supabase
      .from("courses")
      .update({ thumbnail: {} })
      .eq("id", asset.course_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "lesson_thumbnail" && asset.lesson_id) {
    const { error } = await supabase
      .from("lessons")
      .update({ cover_image: {} })
      .eq("id", asset.lesson_id);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_cover") {
    const { error } = await supabase
      .from("lesson_pages")
      .update({ cover_image: {} })
      .eq("id", target.pageId);

    if (error) {
      throw error;
    }

    return;
  }

  if (target.kind === "page_block") {
    const { data: blocks, error: blocksError } = await supabase
      .from("lesson_content_blocks")
      .select("id, payload")
      .eq("page_id", target.pageId)
      .eq("block_type", "image");

    if (blocksError) {
      throw blocksError;
    }

    const matchingBlockIds = getManagedImageBlockIds(
      (blocks ?? []) as Array<{ id: string; payload: Record<string, unknown> }>,
      asset.id,
    );

    if (matchingBlockIds.length === 0) {
      return;
    }

    const { error } = await supabase
      .from("lesson_content_blocks")
      .delete()
      .in("id", matchingBlockIds);

    if (error) {
      throw error;
    }
  }
}
