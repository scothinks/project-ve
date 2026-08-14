import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCourseRevisionData,
  getCourseWorkflowData,
  getLessonWorkflowData,
} from "@/features/ai-generation/data/workflow";
import {
  getLatestMediaRevisionFeedback,
  getLatestTextRevisionFeedback,
} from "@/features/ai-generation/domain/revision";
import {
  ensureAiCourse,
  ensureAiLesson,
} from "@/features/ai-generation/domain/workflow-status";
import {
  enqueueCourseTextJob,
  enqueueMediaAssetsJob,
} from "@/features/ai-generation/application/job-orchestration";
import {
  estimateCourseTextUnits,
  estimateMediaUnits,
} from "@/features/ai-generation/application/organization-ai-metering";
import type { AiCourseGenerationInput } from "@/lib/ai-learning-generator";
import type { Database } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

type JobRequestResult = {
  courseId?: string;
  lessonId?: string;
  jobId: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function ensureCoreGenerationInput(input: AiCourseGenerationInput) {
  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new Error("Topic, target audience, country or region, and tone are required.");
  }
}

export async function requestAiCourseDraftJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  input: AiCourseGenerationInput,
  organizationId?: string | null,
): Promise<JobRequestResult> {
  ensureCoreGenerationInput(input);

  const jobId = await enqueueCourseTextJob(supabase, actorUserId, {
    actorUserId,
    mode: "create_course",
    ...input,
  }, null, organizationId
    ? {
        estimatedUnits: estimateCourseTextUnits("ai_course_draft", input),
        operationType: "ai_course_draft",
        organizationId,
      }
    : undefined);

  return { jobId };
}

export async function requestAiLessonExtensionJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
  continuityInstruction: string,
  input: AiCourseGenerationInput,
): Promise<JobRequestResult> {
  if (!courseId) {
    throw new Error("Select a course to extend.");
  }

  ensureCoreGenerationInput(input);

  const { course } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);

  const jobId = await enqueueCourseTextJob(
    supabase,
    actorUserId,
    {
      actorUserId,
      mode: "extend_course",
      courseId,
      continuityInstruction,
      ...input,
    },
    courseId,
    course.organization_id
      ? {
          estimatedUnits: estimateCourseTextUnits("ai_lesson_extension", input),
          operationType: "ai_lesson_extension",
          organizationId: course.organization_id,
        }
      : undefined,
  );

  return { courseId, jobId };
}

export async function requestAiCourseTextRevisionJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
  requestedFeedback: string,
): Promise<JobRequestResult> {
  const revisionData = await getCourseRevisionData(supabase, courseId);
  const { course } = revisionData;
  ensureAiCourse(course);

  if (course.status === "published") {
    throw new Error("Disable the course before revising AI text because published courses do not have a separate draft version yet.");
  }

  const storedFeedback = getLatestTextRevisionFeedback(asRecord(course.ai_generation_notes));
  const feedback = requestedFeedback || storedFeedback?.feedback || "";
  if (!feedback) {
    throw new Error("Add the requested text changes before revising with AI.");
  }

  const jobId = await enqueueCourseTextJob(
    supabase,
    actorUserId,
    {
      actorUserId,
      mode: "revise_course",
      courseId,
      feedback,
    },
    courseId,
    course.organization_id
      ? {
          estimatedUnits: estimateCourseTextUnits("ai_course_text_revision"),
          operationType: "ai_course_text_revision",
          organizationId: course.organization_id,
        }
      : undefined,
  );

  return { courseId, jobId };
}

export async function requestAiCourseMediaGenerationJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  courseId: string,
  replaceExisting: boolean,
  applyMediaFeedback: boolean,
  requestedMediaFeedback: string,
): Promise<JobRequestResult> {
  const { course } = await getCourseWorkflowData(supabase, courseId);
  ensureAiCourse(course);
  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(course.ai_generation_notes));
  const mediaFeedback = requestedMediaFeedback || storedMediaFeedback?.feedback || "";

  if (course.ai_text_status !== "approved") {
    throw new Error("Approve the course text before generating media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new Error("Add the requested media changes before regenerating with AI.");
  }

  const jobId = await enqueueMediaAssetsJob(
    supabase,
    actorUserId,
    {
      actorUserId,
      courseId,
      mode: "course_media",
      replaceExisting,
      applyMediaFeedback,
      mediaFeedback: applyMediaFeedback ? mediaFeedback : null,
    },
    courseId,
    course.organization_id
      ? {
          estimatedUnits: estimateMediaUnits("ai_course_media_assets", 8),
          operationType: "ai_course_media_assets",
          organizationId: course.organization_id,
        }
      : undefined,
  );

  return { courseId, jobId };
}

export async function requestAiLessonMediaGenerationJob(
  supabase: AiGenerationAdminClient,
  actorUserId: string,
  lessonId: string,
  replaceExisting: boolean,
  applyMediaFeedback: boolean,
  requestedMediaFeedback: string,
): Promise<JobRequestResult> {
  const workflow = await getLessonWorkflowData(supabase, lessonId);
  const { course, lesson } = workflow;
  ensureAiCourse(course);
  ensureAiLesson(lesson);
  const storedMediaFeedback = getLatestMediaRevisionFeedback(asRecord(lesson.ai_generation_notes));
  const mediaFeedback = requestedMediaFeedback || storedMediaFeedback?.feedback || "";

  if (lesson.ai_text_status !== "approved") {
    throw new Error("Approve this lesson's text before generating lesson media.");
  }

  if (applyMediaFeedback && !mediaFeedback) {
    throw new Error("Add the requested media changes before regenerating with AI.");
  }

  const jobId = await enqueueMediaAssetsJob(
    supabase,
    actorUserId,
    {
      actorUserId,
      courseId: course.id,
      lessonId,
      mode: "lesson_media",
      replaceExisting,
      applyMediaFeedback,
      mediaFeedback: applyMediaFeedback ? mediaFeedback : null,
    },
    course.id,
    course.organization_id
      ? {
          estimatedUnits: estimateMediaUnits("ai_lesson_media_assets", 3),
          lessonId,
          operationType: "ai_lesson_media_assets",
          organizationId: course.organization_id,
        }
      : undefined,
  );

  return { courseId: course.id, lessonId, jobId };
}
