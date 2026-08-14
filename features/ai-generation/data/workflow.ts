import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiGeneratorLevel } from "@/lib/ai-learning-generator";
import type { Database, Json } from "@/types/database";
import {
  buildCourseAiStatusPatch,
  deriveCourseMediaStatus,
  deriveCoursePublishStatus,
  deriveCourseTextStatus,
  ensureAiCourse,
  isLessonMediaApprovalReady,
} from "../domain/workflow-status";

type AiGenerationAdminClient = SupabaseClient<Database>;

export type WorkflowCourseRow = {
  id: string;
  organization_id: string | null;
  slug?: string;
  title: string;
  description: string;
  category: string;
  level: AiGeneratorLevel;
  thumbnail?: Record<string, unknown> | null;
  status: string;
  ai_generated: boolean;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at?: string | null;
  text_approved_by?: string | null;
  media_approved_at?: string | null;
  media_approved_by?: string | null;
};

export type WorkflowLessonRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  cover_image?: Record<string, unknown> | null;
  sort_order: number;
  ai_generated: boolean;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generation_notes: Record<string, unknown>;
  media_approved_at?: string | null;
  media_approved_by?: string | null;
};

export type WorkflowLessonPageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
};

export type WorkflowQuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  ai_generated: boolean;
  ai_text_status: string;
  status: string;
};

export type WorkflowLessonBlockRow = {
  id?: string;
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

export type WorkflowQuizQuestionRow = {
  quiz_id: string;
  question_order: number;
  prompt: string;
  explanation: string | null;
  xp: number;
};

export type WorkflowMediaAssetRow = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  asset_type: string;
  placement: string;
  source: string;
  prompt: string | null;
  script: string | null;
  url: string | null;
  storage_path: string | null;
  provider: string | null;
  model: string | null;
  alt_text: string | null;
  caption: string | null;
  metadata: Record<string, unknown>;
  review_status: string;
  generation_status: string;
  generation_error: string | null;
  sort_order: number;
};

export type LearningMediaAssetInsert =
  Database["public"]["Tables"]["learning_media_assets"]["Insert"];

export async function insertAiGenerationAuditEvent(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_events").insert({
    actor_user_id: actorUserId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata as Json,
  });

  if (error) {
    throw error;
  }
}

export async function getCourseWorkflowData(
  supabase: AiGenerationAdminClient,
  courseId: string,
) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, organization_id, slug, title, description, category, level, thumbnail, status, ai_generated, ai_text_status, ai_media_status, ai_publish_status, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) throw courseError;
  if (!course) {
    throw new Error("Course not found.");
  }
  const courseRow = course as WorkflowCourseRow;

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, course_id, title, description, cover_image, sort_order, ai_generated, ai_text_status, ai_media_status, ai_publish_status, ai_generation_notes, media_approved_at, media_approved_by")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (lessonsError) throw lessonsError;

  const lessonRows = (lessons ?? []) as WorkflowLessonRow[];
  const lessonIds = lessonRows.map((lesson) => lesson.id);
  let quizzes: WorkflowQuizRow[] = [];
  let pages: WorkflowLessonPageRow[] = [];

  if (lessonIds.length > 0) {
    const [quizResult, pagesResult] = await Promise.all([
      supabase
        .from("quizzes")
        .select("id, lesson_id, title, ai_generated, ai_text_status, status")
        .in("lesson_id", lessonIds),
      supabase
        .from("lesson_pages")
        .select("id, lesson_id, page_number, title, subtitle, page_type")
        .in("lesson_id", lessonIds)
        .order("page_number", { ascending: true }),
    ]);

    if (quizResult.error) throw quizResult.error;
    if (pagesResult.error) throw pagesResult.error;
    quizzes = (quizResult.data ?? []) as WorkflowQuizRow[];
    pages = (pagesResult.data ?? []) as WorkflowLessonPageRow[];
  }

  return { course: courseRow, lessons: lessonRows, quizzes, pages };
}

export async function getCourseRevisionData(
  supabase: AiGenerationAdminClient,
  courseId: string,
) {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const lessonIds = workflow.lessons.map((lesson) => lesson.id);
  const quizIds = workflow.quizzes.map((quiz) => quiz.id);
  const pageIds = workflow.pages.map((page) => page.id);

  let blocks: WorkflowLessonBlockRow[] = [];
  let questions: WorkflowQuizQuestionRow[] = [];

  if (pageIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_content_blocks")
      .select("page_id, block_type, sort_order, payload")
      .in("page_id", pageIds)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    blocks = (data ?? []) as WorkflowLessonBlockRow[];
  }

  if (quizIds.length > 0) {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("quiz_id, question_order, prompt, explanation, xp")
      .in("quiz_id", quizIds)
      .order("question_order", { ascending: true });

    if (error) throw error;
    questions = (data ?? []) as WorkflowQuizQuestionRow[];
  }

  return {
    ...workflow,
    lessonIds,
    quizIds,
    pageIds,
    blocks,
    questions,
  };
}

export async function getLessonWorkflowData(
  supabase: AiGenerationAdminClient,
  lessonId: string,
) {
  const { data: lessonLookup, error: lessonLookupError } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonLookupError) throw lessonLookupError;
  if (!lessonLookup) {
    throw new Error("Lesson not found.");
  }

  const workflow = await getCourseWorkflowData(supabase, lessonLookup.course_id);
  const lesson = workflow.lessons.find((row) => row.id === lessonId);

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  const quiz = workflow.quizzes.find((row) => row.lesson_id === lessonId) ?? null;
  const lessonPages = workflow.pages.filter((page) => page.lesson_id === lessonId);

  return {
    ...workflow,
    lesson,
    quiz,
    lessonPages,
  };
}

export async function getCourseMediaAssets(
  supabase: AiGenerationAdminClient,
  courseId: string,
) {
  const { data, error } = await supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorkflowMediaAssetRow[];
}

export async function recomputeCourseAiStatuses(
  supabase: AiGenerationAdminClient,
  courseId: string,
  actorUserId: string,
) {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const { course, lessons } = workflow;
  ensureAiCourse(course);

  const assets = await getCourseMediaAssets(supabase, courseId);
  const nextTextStatus = deriveCourseTextStatus(course, lessons);
  const nextMediaStatus = deriveCourseMediaStatus(course, lessons, assets);
  const nextPublishStatus = deriveCoursePublishStatus(course, lessons, nextTextStatus, nextMediaStatus);
  const patch = buildCourseAiStatusPatch(
    course,
    {
      textStatus: nextTextStatus,
      mediaStatus: nextMediaStatus,
      publishStatus: nextPublishStatus,
    },
    actorUserId,
  );

  const { error } = await supabase
    .from("courses")
    .update(patch as Database["public"]["Tables"]["courses"]["Update"])
    .eq("id", courseId);

  if (error) throw error;

  return {
    course,
    lessons,
    nextTextStatus,
    nextMediaStatus,
    nextPublishStatus,
  };
}

export async function resetMediaApprovalAfterAssetChange(
  supabase: AiGenerationAdminClient,
  courseId: string,
  lessonId: string | null,
) {
  if (lessonId) {
    const { error } = await supabase.rpc("admin_reset_ai_course_media", {
      p_course_id: courseId,
      p_lesson_id: lessonId,
      p_media_status: "draft",
    });

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("courses")
    .update({
      ai_media_status: "draft",
      ai_publish_status: "not_ready",
      media_approved_at: null,
      media_approved_by: null,
    })
    .eq("id", courseId)
    .eq("ai_generated", true);

  if (error) throw error;
}

export async function approveMediaScopeIfReady(
  supabase: AiGenerationAdminClient,
  courseId: string,
  lessonId: string | null,
  actorUserId: string,
) {
  const workflow = await getCourseWorkflowData(supabase, courseId);
  const assets = await getCourseMediaAssets(supabase, courseId);

  if (lessonId) {
    const lesson = workflow.lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      throw new Error("Lesson not found.");
    }

    const lessonAssets = assets.filter((asset) => asset.lesson_id === lessonId);

    if (isLessonMediaApprovalReady(lesson, lessonAssets)) {
      const approvedAt = new Date().toISOString();
      const { error } = await supabase
        .from("lessons")
        .update({
          ai_media_status: "approved",
          ai_publish_status: "ready",
          media_approved_at: lesson.media_approved_at ?? approvedAt,
          media_approved_by: lesson.media_approved_by ?? actorUserId,
        })
        .eq("id", lessonId);

      if (error) throw error;
    }
  }

  return recomputeCourseAiStatuses(supabase, courseId, actorUserId);
}
