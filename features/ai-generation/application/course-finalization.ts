import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCourseMediaAssets,
  getCourseWorkflowData,
  insertAiGenerationAuditEvent,
  recomputeCourseAiStatuses,
} from "@/features/ai-generation/data/workflow";
import { normalizeLegacyMediaAssetType } from "@/features/ai-generation/application/media-targets";
import { ensureAiCourse } from "@/features/ai-generation/domain/workflow-status";
import { isImageMediaAsset } from "@/lib/ai-media-workflow";
import type { Database, Json } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type CourseCommandResult = {
  courseId: string;
  lessonIds: string[];
};

type LegacyMediaNormalizationResult = CourseCommandResult & {
  normalizedAssetCount: number;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function normalizeCourseLegacyMediaAssetsCommand(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
  regenerateNormalized: boolean,
): Promise<LegacyMediaNormalizationResult> {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons } = workflow;

  ensureAiCourse(course);

  const assets = await getCourseMediaAssets(supabase, courseId);
  const legacyAssets = assets.filter((asset) => !isImageMediaAsset(asset));

  if (legacyAssets.length === 0) {
    return {
      courseId,
      lessonIds: lessons.map((lesson) => lesson.id),
      normalizedAssetCount: 0,
    };
  }

  for (const asset of legacyAssets) {
    const nextAssetType = normalizeLegacyMediaAssetType(asset);
    const nextMetadata = {
      ...asRecord(asset.metadata),
      normalizedFromAssetType: asset.asset_type,
      normalizedAt: new Date().toISOString(),
      normalizedBy: actorUserId,
      previousUrl: asset.url,
    };

    const { error } = await supabase
      .from("learning_media_assets")
      .update({
        asset_type: nextAssetType,
        url: null,
        storage_path: null,
        provider: null,
        model: null,
        review_status: "draft",
        generation_status: "pending",
        generation_error: null,
        metadata: nextMetadata as Json,
      })
      .eq("id", asset.id);

    if (error) throw error;
  }

  const { error: resetError } = await supabase.rpc("admin_reset_ai_course_media", {
    p_course_id: courseId,
    p_lesson_id: null as unknown as string,
    p_media_status: "draft",
  });

  if (resetError) throw resetError;

  await recomputeCourseAiStatuses(supabase, courseId, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_legacy_media_normalized", "course", courseId, {
    normalizedAssetCount: legacyAssets.length,
    regenerateNormalized,
  });

  return {
    courseId,
    lessonIds: lessons.map((lesson) => lesson.id),
    normalizedAssetCount: legacyAssets.length,
  };
}

export async function publishApprovedAiCourseCommand(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
): Promise<CourseCommandResult> {
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  if (
    course.ai_text_status !== "approved"
    || course.ai_media_status !== "approved"
    || course.ai_publish_status !== "ready"
  ) {
    throw new Error("This course is not ready to publish. Text and media must both be approved first.");
  }

  const lessonIds = lessons.map((lesson) => lesson.id);

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      status: "published",
      ai_publish_status: "published",
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessonIds.length > 0) {
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        status: "published",
        ai_publish_status: "published",
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;

    const { error: quizzesError } = await supabase
      .from("quizzes")
      .update({
        status: "published",
      })
      .in("lesson_id", lessonIds);

    if (quizzesError) throw quizzesError;
  }

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_published", "course", courseId, {});

  return { courseId, lessonIds };
}
