import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCourseWorkflowData,
  getLessonWorkflowData,
  insertAiGenerationAuditEvent,
  recomputeCourseAiStatuses,
} from "@/features/ai-generation/data/workflow";
import {
  ensureAiCourse,
  ensureAiLesson,
} from "@/features/ai-generation/domain/workflow-status";
import { appendTextRevisionFeedback } from "@/features/ai-generation/domain/revision";
import type { Database, Json } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type AiTextReviewResult = {
  courseId: string;
  lessonIds: string[];
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function approveCourseTextReview(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
): Promise<AiTextReviewResult> {
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  const approvedAt = new Date().toISOString();

  const { error: courseError } = await supabase
    .from("courses")
    .update({
      ai_text_status: "approved",
      ai_media_status: "generation_ready",
      ai_publish_status: "not_ready",
      text_approved_at: approvedAt,
      text_approved_by: actorUserId,
    })
    .eq("id", courseId);

  if (courseError) throw courseError;

  if (lessons.length > 0) {
    const lessonIds = lessons.map((lesson) => lesson.id);
    const { error: lessonsError } = await supabase
      .from("lessons")
      .update({
        ai_text_status: "approved",
        ai_media_status: "generation_ready",
        ai_publish_status: "not_ready",
        text_approved_at: approvedAt,
        text_approved_by: actorUserId,
      })
      .in("id", lessonIds);

    if (lessonsError) throw lessonsError;

    const { error: quizzesError } = await supabase
      .from("quizzes")
      .update({
        ai_text_status: "approved",
        text_approved_at: approvedAt,
        text_approved_by: actorUserId,
      })
      .in("lesson_id", lessonIds);

    if (quizzesError) throw quizzesError;
  }

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_text_approved", "course", courseId, {
    approvedAt,
  });

  return {
    courseId,
    lessonIds: lessons.map((lesson) => lesson.id),
  };
}

export async function requestCourseTextReviewChanges(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
  feedback: string,
): Promise<AiTextReviewResult> {
  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);
  const nextNotes = appendTextRevisionFeedback(asRecord(course.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: actorUserId,
  });

  const { error } = await supabase.rpc("admin_reset_ai_course_tree", {
    p_course_id: courseId,
    p_text_status: "changes_requested",
  });

  if (error) throw error;

  const { error: notesError } = await supabase
    .from("courses")
    .update({
      ai_generation_notes: nextNotes as Json,
    })
    .eq("id", courseId);

  if (notesError) throw notesError;

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_text_changes_requested", "course", courseId, {
    feedback,
  });

  return {
    courseId,
    lessonIds: lessons.map((lesson) => lesson.id),
  };
}

export async function approveLessonTextReview(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  lessonId: string,
): Promise<AiTextReviewResult> {
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, quiz, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  const approvedAt = new Date().toISOString();

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_text_status: "approved",
      ai_media_status: "generation_ready",
      ai_publish_status: "not_ready",
      text_approved_at: approvedAt,
      text_approved_by: actorUserId,
      media_approved_at: null,
      media_approved_by: null,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  if (quiz) {
    const { error: quizError } = await supabase
      .from("quizzes")
      .update({
        ai_text_status: "approved",
        text_approved_at: approvedAt,
        text_approved_by: actorUserId,
      })
      .eq("id", quiz.id);

    if (quizError) throw quizError;
  }

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_lesson_text_approved", "lesson", lessonId, {
    courseId: course.id,
    approvedAt,
    courseTextStatus: aggregate.nextTextStatus,
  });

  return {
    courseId: course.id,
    lessonIds: lessons.map((item) => item.id),
  };
}

export async function requestLessonTextReviewChanges(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  lessonId: string,
  feedback: string,
): Promise<AiTextReviewResult> {
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson, quiz, lessons } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);

  const nextNotes = appendTextRevisionFeedback(asRecord(lesson.ai_generation_notes), {
    kind: "request",
    feedback,
    requestedAt: new Date().toISOString(),
    requestedBy: actorUserId,
  });

  const { error: lessonError } = await supabase
    .from("lessons")
    .update({
      ai_text_status: "changes_requested",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      text_approved_at: null,
      text_approved_by: null,
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: nextNotes as Json,
    })
    .eq("id", lessonId);

  if (lessonError) throw lessonError;

  if (quiz) {
    const { error: quizError } = await supabase
      .from("quizzes")
      .update({
        ai_text_status: "changes_requested",
        text_approved_at: null,
        text_approved_by: null,
      })
      .eq("id", quiz.id);

    if (quizError) throw quizError;
  }

  const aggregate = await recomputeCourseAiStatuses(supabase, course.id, actorUserId);

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_lesson_text_changes_requested", "lesson", lessonId, {
    courseId: course.id,
    feedback,
    courseTextStatus: aggregate.nextTextStatus,
  });

  return {
    courseId: course.id,
    lessonIds: lessons.map((item) => item.id),
  };
}
