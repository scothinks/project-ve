import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAiGenerationJob } from "@/features/ai-generation/data/jobs";
import {
  applyLearningMediaAssetTarget,
  clearLearningMediaAssetTarget,
  getLearningMediaAssetById,
} from "@/features/ai-generation/data/media-assets";
import {
  approveMediaScopeIfReady,
  getCourseWorkflowData,
  insertAiGenerationAuditEvent,
  recomputeCourseAiStatuses,
  resetMediaApprovalAfterAssetChange,
  type WorkflowMediaAssetRow,
} from "@/features/ai-generation/data/workflow";
import {
  resolveMediaTarget,
} from "@/features/ai-generation/domain/media-planning";
import {
  assetHasUsablePreview,
  ensureAiCourse,
  ensureAiLesson,
} from "@/features/ai-generation/domain/workflow-status";
import {
  buildPagesByLessonId,
  resolveManualMediaTargetKind,
} from "@/features/ai-generation/application/media-targets";
import {
  isGenerationExcludedMediaAsset,
  isImageMediaAsset,
} from "@/lib/ai-media-workflow";
import type { Database, Json } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type SingleMediaAssetJobResult = {
  courseId: string;
  lessonId: string | null;
  jobId: string;
};

type MediaAssetCommandResult = {
  courseId: string;
  lessonIds: string[];
};

export type SaveLearningMediaAssetInput = {
  assetId: string;
  courseId: string;
  lessonId: string | null;
  assetType: string;
  placement: string;
  prompt: string;
  script: string;
  url: string | null;
  altText: string;
  caption: string;
  reviewStatus: string;
  excludeFromGeneration: boolean;
  requestedPageMediaTarget: string;
  presentation: {
    fit: string;
    positionX: number;
    positionY: number;
  };
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createAssetTargetSnapshot(
  assetId: string,
  asset: Pick<WorkflowMediaAssetRow, "url" | "metadata" | "asset_type" | "placement" | "lesson_id" | "course_id">,
): WorkflowMediaAssetRow {
  return {
    id: assetId,
    course_id: asset.course_id,
    lesson_id: asset.lesson_id,
    asset_type: asset.asset_type,
    placement: asset.placement,
    source: "ai_generated",
    prompt: null,
    script: null,
    url: asset.url,
    storage_path: null,
    provider: null,
    model: null,
    alt_text: null,
    caption: null,
    metadata: asset.metadata ?? {},
    review_status: "draft",
    generation_status: "pending",
    generation_error: null,
    sort_order: 0,
  };
}

export async function queueSingleLearningMediaAssetGeneration(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  assetId: string,
  courseId: string,
): Promise<SingleMediaAssetJobResult> {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons, pages } = workflow;
  ensureAiCourse(course);

  const asset = await getLearningMediaAssetById(supabase, assetId);
  if (asset.course_id !== courseId) {
    throw new Error("This media asset does not belong to this course.");
  }

  if (!isImageMediaAsset(asset)) {
    throw new Error("This media slot is not an image-based media type yet.");
  }

  if (isGenerationExcludedMediaAsset(asset)) {
    throw new Error("This optional media slot is excluded from generation.");
  }

  const lesson = asset.lesson_id
    ? lessons.find((item) => item.id === asset.lesson_id) ?? null
    : null;

  if (asset.lesson_id) {
    if (!lesson) {
      throw new Error("Media asset lesson not found.");
    }
    ensureAiLesson(lesson);
    if (lesson.ai_text_status !== "approved") {
      throw new Error("Approve this lesson's text before generating this media.");
    }
  } else if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before generating this media.");
  }

  const target = resolveMediaTarget(asset, buildPagesByLessonId(pages), new Set<string>());
  if (!target) {
    throw new Error("This media slot does not have a supported target.");
  }

  const jobId = await createAiGenerationJob(supabase, actorUserId, "media_assets", {
    actorUserId,
    assetId,
    courseId,
    mode: "single_media_asset",
  }, {
    entityId: courseId,
    status: "queued",
  });

  return {
    courseId,
    lessonId: asset.lesson_id,
    jobId,
  };
}

export async function approveLearningMediaAssetCommand(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  assetId: string,
  courseId: string,
): Promise<MediaAssetCommandResult> {
  const asset = await getLearningMediaAssetById(supabase, assetId);

  if (asset.course_id !== courseId) {
    throw new Error("This media asset does not belong to this course.");
  }

  if (!assetHasUsablePreview(asset) || asset.generation_status === "failed") {
    throw new Error("Add or generate a media preview before approval.");
  }

  const { error } = await supabase
    .from("learning_media_assets")
    .update({ review_status: "approved", generation_error: null })
    .eq("id", assetId);

  if (error) throw error;

  const updatedAsset = await getLearningMediaAssetById(supabase, assetId);
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const target = resolveMediaTarget(updatedAsset, buildPagesByLessonId(workflow.pages), new Set<string>());
  if (target) {
    await applyLearningMediaAssetTarget(supabase, updatedAsset, target);
  }

  const aggregate = await approveMediaScopeIfReady(supabase, courseId, asset.lesson_id, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "learning_media_asset_approved", "media_asset", assetId, {
    courseId,
    lessonId: asset.lesson_id,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  return {
    courseId,
    lessonIds: asset.lesson_id ? [asset.lesson_id] : [],
  };
}

export async function applyLibraryMediaAssetCommand(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  assetId: string,
  libraryAssetId: string,
  courseId: string,
): Promise<MediaAssetCommandResult> {
  if (!libraryAssetId) {
    throw new Error("Choose a library media asset first.");
  }

  const [targetAsset, libraryAsset] = await Promise.all([
    getLearningMediaAssetById(supabase, assetId),
    getLearningMediaAssetById(supabase, libraryAssetId),
  ]);

  if (targetAsset.course_id !== courseId || libraryAsset.course_id !== courseId) {
    throw new Error("Library media must belong to this course.");
  }

  if (!assetHasUsablePreview(libraryAsset)) {
    throw new Error("The selected library media does not have a usable preview.");
  }

  if (!isImageMediaAsset(libraryAsset)) {
    throw new Error("Only image media can be reused from the library.");
  }

  const metadata = asRecord(targetAsset.metadata);
  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      url: libraryAsset.url,
      storage_path: libraryAsset.storage_path,
      source: "library",
      provider: libraryAsset.provider,
      model: libraryAsset.model,
      alt_text: libraryAsset.alt_text || targetAsset.alt_text,
      caption: libraryAsset.caption || targetAsset.caption,
      review_status: "draft",
      generation_status: "completed",
      generation_error: null,
      metadata: {
        ...metadata,
        previousUrl: targetAsset.url,
        librarySourceAssetId: libraryAsset.id,
        librarySourcePlacement: libraryAsset.placement,
        librarySelectedAt: new Date().toISOString(),
        librarySelectedBy: actorUserId,
      } as Json,
    })
    .eq("id", assetId);

  if (error) throw error;

  const updatedAsset = await getLearningMediaAssetById(supabase, assetId);
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const target = resolveMediaTarget(updatedAsset, buildPagesByLessonId(workflow.pages), new Set<string>());
  if (target) {
    await applyLearningMediaAssetTarget(supabase, updatedAsset, target);
  }

  await resetMediaApprovalAfterAssetChange(supabase, courseId, targetAsset.lesson_id);
  await recomputeCourseAiStatuses(supabase, courseId, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "learning_media_asset_library_selected", "media_asset", assetId, {
    courseId,
    lessonId: targetAsset.lesson_id,
    libraryAssetId,
  });

  return {
    courseId,
    lessonIds: targetAsset.lesson_id ? [targetAsset.lesson_id] : [],
  };
}

export async function saveLearningMediaAssetCommand(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  input: SaveLearningMediaAssetInput,
): Promise<MediaAssetCommandResult> {
  const { data: existingAsset, error: assetError } = await supabase
    .from("learning_media_assets")
    .select("url, metadata, asset_type, placement, lesson_id, course_id")
    .eq("id", input.assetId)
    .maybeSingle();

  if (assetError) throw assetError;

  const typedExistingAsset = existingAsset as Pick<WorkflowMediaAssetRow, "url" | "metadata" | "asset_type" | "placement" | "lesson_id" | "course_id"> | null;
  const existingMetadata = asRecord(typedExistingAsset?.metadata);
  const nextTargetKind = resolveManualMediaTargetKind(
    existingMetadata,
    input.assetType,
    input.requestedPageMediaTarget,
  );

  const nextMetadata = {
    ...existingMetadata,
    previousUrl: typedExistingAsset?.url ?? null,
    manuallyEditedAt: new Date().toISOString(),
    excludeFromGeneration: input.excludeFromGeneration,
    fit: input.presentation.fit,
    positionX: input.presentation.positionX,
    positionY: input.presentation.positionY,
    ...(nextTargetKind ? { targetKind: nextTargetKind } : {}),
    ...(input.assetType === "infographic" || nextTargetKind === "page_block"
      ? { preferredPlacement: "page_block" }
      : {}),
    ...(input.assetType === "infographic"
      ? { mediaNote: "Infographics are intended for in-page teaching use, not page cover art." }
      : {}),
  };

  const { error } = await supabase
    .from("learning_media_assets")
    .update({
      asset_type: input.assetType,
      placement: input.placement,
      prompt: input.prompt,
      script: input.script,
      url: input.url,
      alt_text: input.altText,
      caption: input.caption,
      review_status: input.reviewStatus,
      generation_status: input.url ? "completed" : "pending",
      generation_error: null,
      metadata: nextMetadata as Json,
    })
    .eq("id", input.assetId);

  if (error) throw error;

  const workflow = await getCourseWorkflowData(supabase, input.courseId);
  const { course, pages } = workflow;
  const { data: updatedAsset, error: updatedAssetError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("id", input.assetId)
    .maybeSingle();

  if (updatedAssetError) throw updatedAssetError;

  const typedUpdatedAsset = updatedAsset as WorkflowMediaAssetRow | null;

  if (typedUpdatedAsset) {
    const pagesByLessonId = buildPagesByLessonId(pages);
    const previousTarget = typedExistingAsset
      ? resolveMediaTarget(
          createAssetTargetSnapshot(input.assetId, typedExistingAsset),
          pagesByLessonId,
          new Set<string>(),
        )
      : null;
    const target = resolveMediaTarget(typedUpdatedAsset, pagesByLessonId, new Set<string>());

    if (previousTarget && typedExistingAsset && (!target || previousTarget.key !== target.key)) {
      await clearLearningMediaAssetTarget(
        supabase,
        createAssetTargetSnapshot(input.assetId, typedExistingAsset),
        previousTarget,
      );
    }

    if (target) {
      if (input.excludeFromGeneration || !typedUpdatedAsset.url) {
        await clearLearningMediaAssetTarget(supabase, typedUpdatedAsset, target);
      } else {
        await applyLearningMediaAssetTarget(supabase, typedUpdatedAsset, target);
      }
    }
  }

  const targetLesson = input.lessonId
    ? workflow.lessons.find((item) => item.id === input.lessonId) ?? null
    : null;

  if (course.ai_media_status === "approved" || targetLesson?.ai_media_status === "approved") {
    const { error: resetError } = await supabase.rpc("admin_reset_ai_course_media", {
      p_course_id: input.courseId,
      p_lesson_id: (input.lessonId || null) as unknown as string,
      p_media_status: "draft",
    });

    if (resetError) throw resetError;

    await recomputeCourseAiStatuses(supabase, input.courseId, actorUserId);
  }

  await insertAiGenerationAuditEvent(supabase, actorUserId, "learning_media_asset_updated", "media_asset", input.assetId, {
    courseId: input.courseId,
    lessonId: input.lessonId,
  });

  return {
    courseId: input.courseId,
    lessonIds: input.lessonId ? [input.lessonId] : [],
  };
}
