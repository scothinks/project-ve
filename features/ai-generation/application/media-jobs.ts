import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAiGenerationJobActorUserId,
  completeAiGenerationJob,
  type AiGenerationClaim,
} from "@/features/ai-generation/data/jobs";
import {
  getLearningMediaAssetById,
  updateMediaAssetGenerationStatus,
} from "@/features/ai-generation/data/media-assets";
import {
  getCourseMediaAssets,
  getCourseWorkflowData,
  getLessonWorkflowData,
  insertAiGenerationAuditEvent,
  recomputeCourseAiStatuses,
  resetMediaApprovalAfterAssetChange,
  type LearningMediaAssetInsert,
  type WorkflowMediaAssetRow,
} from "@/features/ai-generation/data/workflow";
import {
  createCourseMediaSeedRows,
  createLessonMediaSeedRows,
  resolveMediaTarget,
} from "@/features/ai-generation/domain/media-planning";
import {
  appendMediaRevisionFeedback,
  getLatestMediaRevisionFeedback,
} from "@/features/ai-generation/domain/revision";
import {
  ensureAiCourse,
  ensureAiLesson,
} from "@/features/ai-generation/domain/workflow-status";
import {
  buildPagesByLessonId,
} from "@/features/ai-generation/application/media-targets";
import {
  getMediaJobMode,
  getPromptBoolean,
  getPromptString,
} from "@/features/ai-generation/application/job-prompts";
import {
  processMediaWorkItemsForJob,
  type MediaGenerationWorkItem,
} from "@/features/ai-generation/application/media-work-items";
import { getAiMediaConfig } from "@/lib/ai-media-generator";
import {
  isGenerationExcludedMediaAsset,
  isImageMediaAsset,
} from "@/lib/ai-media-workflow";
import { ValidationError } from "@/lib/app-errors";
import type { Database, Json } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type MediaJobRevalidation = {
  revalidateLearningPaths: (courseId: string, lessonIds: string[]) => void;
  workerId: string;
};

type MediaJobResult = {
  mode: "course_media" | "lesson_media" | "single_media_asset";
  status: "completed" | "failed";
  [key: string]: unknown;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function processCourseMediaAssetsJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  options: MediaJobRevalidation,
): Promise<MediaJobResult> {
  const courseId = getPromptString(job.prompt, "courseId");
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const replaceExisting = getPromptBoolean(job.prompt, "replaceExisting");
  const applyMediaFeedback = getPromptBoolean(job.prompt, "applyMediaFeedback");
  const mediaFeedback = getPromptString(job.prompt, "mediaFeedback").trim();
  const mediaConfig = getAiMediaConfig();

  if (!courseId) {
    throw new ValidationError("AI course media job is missing a course id.");
  }

  if (!actorUserId) {
    throw new ValidationError("AI course media job is missing an actor user id.");
  }

  if (!mediaConfig.canGenerate) {
    throw new ValidationError(
      `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
    );
  }

  const { course, lessons, pages } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (course.ai_text_status !== "approved") {
    throw new ValidationError("Approve the course text before generating media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new ValidationError("AI course media job is missing requested media changes.");
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(course.ai_generation_notes));
  const { data: existingAssets, error: assetsError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (assetsError) throw assetsError;

  const typedExistingAssets = (existingAssets ?? []) as WorkflowMediaAssetRow[];
  const seedRows = createCourseMediaSeedRows(course, lessons, pages, typedExistingAssets, job.id);
  if (seedRows.length > 0) {
    const { error } = await supabase
      .from("learning_media_assets")
      .insert(seedRows as LearningMediaAssetInsert[]);
    if (error) throw error;
  }

  const { data: refreshedAssetsData, error: refreshedAssetsError } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (refreshedAssetsError) throw refreshedAssetsError;

  const pagesByLessonId = buildPagesByLessonId(pages);

  const imageAssets = ((refreshedAssetsData ?? []) as WorkflowMediaAssetRow[]).filter(isImageMediaAsset);
  const usedTargetKeys = new Set<string>();
  const usedPageIds = new Set<string>();
  const workItems: MediaGenerationWorkItem[] = [];
  let skippedCount = 0;

  for (const asset of imageAssets) {
    if (isGenerationExcludedMediaAsset(asset)) {
      skippedCount += 1;
      continue;
    }

    const target = resolveMediaTarget(asset, pagesByLessonId, usedPageIds);
    if (!target) {
      skippedCount += 1;
      await updateMediaAssetGenerationStatus(
        supabase,
        asset.id,
        "skipped",
        "Skipped because no supported lesson page target could be resolved for this asset.",
      );
      continue;
    }

    if (usedTargetKeys.has(target.key)) {
      skippedCount += 1;
      await updateMediaAssetGenerationStatus(
        supabase,
        asset.id,
        "skipped",
        "Skipped because this run only generates one image for each supported course, lesson, or page target.",
      );
      continue;
    }

    usedTargetKeys.add(target.key);
    if (target.kind === "page_cover") {
      usedPageIds.add(target.pageId);
    }

    const lesson = asset.lesson_id ? lessons.find((row) => row.id === asset.lesson_id) ?? null : null;
    const page = target.kind === "page_cover" || target.kind === "page_block"
      ? pages.find((row) => row.id === target.pageId) ?? null
      : null;

    workItems.push({
      asset,
      target,
      context: {
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description,
        courseCategory: course.category,
        lessonId: lesson?.id ?? null,
        lessonTitle: lesson?.title ?? null,
        lessonDescription: lesson?.description ?? null,
        pageId: page?.id ?? null,
        pageTitle: page?.title ?? null,
        pageSubtitle: page?.subtitle ?? null,
        placementLabel: asset.placement,
        revisionFeedback: applyMediaFeedback ? mediaFeedback : null,
        targetKind: target.kind,
      },
    });
  }

  const counts = await processMediaWorkItemsForJob(supabase, workItems, replaceExisting, skippedCount);

  const { error: mediaStatusError } = await supabase.rpc("admin_reset_ai_course_media", {
    p_course_id: courseId,
    p_media_status: "draft",
  });

  if (mediaStatusError) throw mediaStatusError;

  if (applyMediaFeedback && mediaFeedback) {
    const nextNotes = appendMediaRevisionFeedback(asRecord(course.ai_generation_notes), {
      kind: "applied",
      feedback: mediaFeedback,
      requestedAt: storedMediaFeedback?.requestedAt ?? new Date().toISOString(),
      requestedBy: storedMediaFeedback?.requestedBy ?? actorUserId,
      revisedAt: new Date().toISOString(),
      revisedBy: actorUserId,
      jobId: job.id,
    });

    const { error } = await supabase
      .from("courses")
      .update({ ai_generation_notes: nextNotes as Json })
      .eq("id", courseId);

    if (error) throw error;
  }

  const jobStatus = counts.generatedCount > 0 || counts.reusedCount > 0 || counts.skippedCount > 0
    ? "completed"
    : "failed";

  const result = {
    courseId,
    imageAssetCount: imageAssets.length,
    lessonCount: lessons.length,
    mediaFeedbackApplied: applyMediaFeedback,
    replaceExisting,
    ...counts,
  };

  await completeAiGenerationJob(supabase, {
    entityId: courseId,
    jobId: job.id,
    status: jobStatus,
    result,
    error: jobStatus === "failed" ? "No media images were generated successfully." : null,
    workerId: options.workerId,
  });

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_media_assets_generated", "course", courseId, {
    jobId: job.id,
    ...counts,
    replaceExisting,
    mediaFeedbackApplied: applyMediaFeedback,
  });

  options.revalidateLearningPaths(courseId, lessonIds);

  return {
    mode: "course_media",
    status: jobStatus,
    ...result,
  };
}

async function processLessonMediaAssetsJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  options: MediaJobRevalidation,
): Promise<MediaJobResult> {
  const courseId = getPromptString(job.prompt, "courseId");
  const lessonId = getPromptString(job.prompt, "lessonId");
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const replaceExisting = getPromptBoolean(job.prompt, "replaceExisting");
  const applyMediaFeedback = getPromptBoolean(job.prompt, "applyMediaFeedback");
  const mediaFeedback = getPromptString(job.prompt, "mediaFeedback").trim();
  const mediaConfig = getAiMediaConfig();

  if (!courseId) {
    throw new ValidationError("AI lesson media job is missing a course id.");
  }

  if (!lessonId) {
    throw new ValidationError("AI lesson media job is missing a lesson id.");
  }

  if (!actorUserId) {
    throw new ValidationError("AI lesson media job is missing an actor user id.");
  }

  if (!mediaConfig.canGenerate) {
    throw new ValidationError(
      `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
    );
  }

  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, lessonPages, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  if (course.id !== courseId) {
    throw new ValidationError("AI lesson media job course id does not match the lesson.");
  }

  if (lesson.ai_text_status !== "approved") {
    throw new ValidationError("Approve this lesson's text before generating lesson media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new ValidationError("AI lesson media job is missing requested media changes.");
  }

  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(lesson.ai_generation_notes));
  const lessonIds = lessons.map((item) => item.id);
  const courseAssets = await getCourseMediaAssets(supabase, course.id);
  const existingLessonAssets = courseAssets.filter((asset) => asset.lesson_id === lessonId);
  const seedRows = createLessonMediaSeedRows(course, lesson, lessonPages, existingLessonAssets, job.id);

  if (seedRows.length > 0) {
    const { error } = await supabase
      .from("learning_media_assets")
      .insert(seedRows as LearningMediaAssetInsert[]);
    if (error) throw error;
  }

  const lessonAssets = (await getCourseMediaAssets(supabase, course.id))
    .filter((asset) => asset.lesson_id === lessonId);
  const imageAssets = lessonAssets.filter(isImageMediaAsset);
  const pagesByLessonId = buildPagesByLessonId(lessonPages);
  const usedTargetKeys = new Set<string>();
  const usedPageIds = new Set<string>();
  const workItems: MediaGenerationWorkItem[] = [];
  let skippedCount = 0;

  for (const asset of imageAssets) {
    if (isGenerationExcludedMediaAsset(asset)) {
      skippedCount += 1;
      continue;
    }

    const target = resolveMediaTarget(asset, pagesByLessonId, usedPageIds);
    if (!target) {
      skippedCount += 1;
      await updateMediaAssetGenerationStatus(
        supabase,
        asset.id,
        "skipped",
        "Skipped because no supported lesson page target could be resolved for this asset.",
      );
      continue;
    }

    if (usedTargetKeys.has(target.key)) {
      skippedCount += 1;
      await updateMediaAssetGenerationStatus(
        supabase,
        asset.id,
        "skipped",
        "Skipped because this run only generates one image for each supported lesson target.",
      );
      continue;
    }

    usedTargetKeys.add(target.key);
    if (target.kind === "page_cover") {
      usedPageIds.add(target.pageId);
    }

    const page = target.kind === "page_cover" || target.kind === "page_block"
      ? lessonPages.find((row) => row.id === target.pageId) ?? null
      : null;

    workItems.push({
      asset,
      target,
      context: {
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description,
        courseCategory: course.category,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonDescription: lesson.description,
        pageId: page?.id ?? null,
        pageTitle: page?.title ?? null,
        pageSubtitle: page?.subtitle ?? null,
        placementLabel: asset.placement,
        revisionFeedback: applyMediaFeedback ? mediaFeedback : null,
        targetKind: target.kind,
      },
    });
  }

  const counts = await processMediaWorkItemsForJob(supabase, workItems, replaceExisting, skippedCount);

  const { error: mediaStatusError } = await supabase.rpc("admin_reset_ai_course_media", {
    p_course_id: course.id,
    p_lesson_id: lessonId,
    p_media_status: "draft",
  });

  if (mediaStatusError) throw mediaStatusError;

  if (applyMediaFeedback && mediaFeedback) {
    const nextNotes = appendMediaRevisionFeedback(asRecord(lesson.ai_generation_notes), {
      kind: "applied",
      feedback: mediaFeedback,
      requestedAt: storedMediaFeedback?.requestedAt ?? new Date().toISOString(),
      requestedBy: storedMediaFeedback?.requestedBy ?? actorUserId,
      revisedAt: new Date().toISOString(),
      revisedBy: actorUserId,
      jobId: job.id,
    });

    const { error } = await supabase
      .from("lessons")
      .update({ ai_generation_notes: nextNotes as Json })
      .eq("id", lessonId);

    if (error) throw error;
  }

  const jobStatus = counts.generatedCount > 0 || counts.reusedCount > 0 || counts.skippedCount > 0
    ? "completed"
    : "failed";
  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, actorUserId);
  const result = {
    courseId: course.id,
    imageAssetCount: imageAssets.length,
    lessonId,
    mediaFeedbackApplied: applyMediaFeedback,
    replaceExisting,
    ...counts,
  };

  await completeAiGenerationJob(supabase, {
    entityId: course.id,
    jobId: job.id,
    status: jobStatus,
    result,
    error: jobStatus === "failed" ? "No lesson media images were generated successfully." : null,
    workerId: options.workerId,
  });

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_lesson_media_assets_generated", "lesson", lessonId, {
    courseId: course.id,
    jobId: job.id,
    ...counts,
    replaceExisting,
    mediaFeedbackApplied: applyMediaFeedback,
    courseMediaStatus: aggregate.nextMediaStatus,
  });

  options.revalidateLearningPaths(course.id, lessonIds);

  return {
    mode: "lesson_media",
    status: jobStatus,
    ...result,
  };
}

async function processSingleMediaAssetJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  options: MediaJobRevalidation,
): Promise<MediaJobResult> {
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const assetId = getPromptString(job.prompt, "assetId");
  const courseId = getPromptString(job.prompt, "courseId");
  const mediaConfig = getAiMediaConfig();

  if (!actorUserId) {
    throw new ValidationError("AI media asset job is missing an actor user id.");
  }

  if (!assetId) {
    throw new ValidationError("AI media asset job is missing an asset id.");
  }

  if (!courseId) {
    throw new ValidationError("AI media asset job is missing a course id.");
  }

  if (!mediaConfig.canGenerate) {
    throw new ValidationError(
      `Media generation is unavailable until these server settings are added: ${mediaConfig.missingRequirements.join(", ")}.`,
    );
  }

  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons, pages } = workflow;
  ensureAiCourse(course);

  const asset = await getLearningMediaAssetById(supabase, assetId);
  if (asset.course_id !== courseId) {
    throw new ValidationError("This media asset does not belong to this course.");
  }

  if (!isImageMediaAsset(asset)) {
    throw new ValidationError("This media slot is not an image-based media type yet.");
  }

  if (isGenerationExcludedMediaAsset(asset)) {
    throw new ValidationError("This optional media slot is excluded from generation.");
  }

  const lesson = asset.lesson_id
    ? lessons.find((item) => item.id === asset.lesson_id) ?? null
    : null;

  if (asset.lesson_id) {
    if (!lesson) {
      throw new ValidationError("Media asset lesson not found.");
    }
    ensureAiLesson(lesson);
    if (lesson.ai_text_status !== "approved") {
      throw new ValidationError("Approve this lesson's text before generating this media.");
    }
  } else if (course.ai_text_status !== "approved") {
    throw new ValidationError("Approve the course text before generating this media.");
  }

  const target = resolveMediaTarget(asset, buildPagesByLessonId(pages), new Set<string>());
  if (!target) {
    throw new ValidationError("This media slot does not have a supported target.");
  }

  const page = target.kind === "page_cover" || target.kind === "page_block"
    ? pages.find((row) => row.id === target.pageId) ?? null
    : null;

  const counts = await processMediaWorkItemsForJob(
    supabase,
    [
      {
        asset,
        target,
        context: {
          courseId: course.id,
          courseTitle: course.title,
          courseDescription: course.description,
          courseCategory: course.category,
          lessonId: lesson?.id ?? null,
          lessonTitle: lesson?.title ?? null,
          lessonDescription: lesson?.description ?? null,
          pageId: page?.id ?? null,
          pageTitle: page?.title ?? null,
          pageSubtitle: page?.subtitle ?? null,
          placementLabel: asset.placement,
          revisionFeedback: null,
          targetKind: target.kind,
        },
      },
    ],
    true,
    0,
  );

  await resetMediaApprovalAfterAssetChange(supabase, courseId, asset.lesson_id);
  const aggregate = await recomputeCourseAiStatuses(supabase, courseId, actorUserId);
  const jobStatus = counts.generatedCount > 0 || counts.reusedCount > 0 ? "completed" : "failed";
  const result = {
    assetId,
    courseId,
    lessonId: asset.lesson_id,
    mediaFeedbackApplied: false,
    replaceExisting: true,
    targetKind: target.kind,
    ...counts,
  };

  await completeAiGenerationJob(supabase, {
    entityId: courseId,
    jobId: job.id,
    status: jobStatus,
    result,
    error: jobStatus === "failed" ? "Media generation failed." : null,
    workerId: options.workerId,
  });

  await insertAiGenerationAuditEvent(supabase, actorUserId, "learning_media_asset_generated", "media_asset", assetId, {
    courseId,
    lessonId: asset.lesson_id,
    jobId: job.id,
    targetKind: target.kind,
    courseMediaStatus: aggregate.nextMediaStatus,
    replacedExisting: true,
    ...counts,
  });

  options.revalidateLearningPaths(courseId, asset.lesson_id ? [asset.lesson_id] : []);

  return {
    mode: "single_media_asset",
    status: jobStatus,
    ...result,
  };
}

async function normalizeMediaAssetsJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
): Promise<AiGenerationClaim> {
  const mode = getMediaJobMode(job.prompt);
  const actorUserId = getPromptString(job.prompt, "actorUserId");
  const courseId = getPromptString(job.prompt, "courseId") || job.entity_id || "";
  const mediaFeedback = getPromptString(job.prompt, "mediaFeedback").trim();

  if (
    mode === getPromptString(job.prompt, "mode")
    && actorUserId
    && (courseId === getPromptString(job.prompt, "courseId") || !job.entity_id)
  ) {
    return job;
  }

  return {
    ...job,
    prompt: {
      ...job.prompt,
      ...(mode ? { mode } : {}),
      ...(courseId ? { courseId } : {}),
      ...(typeof job.prompt.applyMediaFeedback === "boolean" || !mediaFeedback
        ? {}
        : { applyMediaFeedback: true }),
      actorUserId: actorUserId || await getAiGenerationJobActorUserId(supabase, job.id),
    },
  };
}

export async function processMediaAssetsJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  options: MediaJobRevalidation,
) {
  const mediaJob = await normalizeMediaAssetsJob(supabase, job);
  const mode = getMediaJobMode(mediaJob.prompt);

  return mode === "course_media"
    ? processCourseMediaAssetsJob(supabase, mediaJob, options)
    : mode === "lesson_media"
      ? processLessonMediaAssetsJob(supabase, mediaJob, options)
      : mode === "single_media_asset"
        ? processSingleMediaAssetJob(supabase, mediaJob, options)
        : (() => {
            throw new ValidationError(`Unsupported AI media job mode: ${mode}`);
          })();
}
