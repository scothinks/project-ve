import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  materializeAiCourseTextJob,
  replaceAiCourseTextJob,
  type AiGenerationClaim,
} from "@/features/ai-generation/data/jobs";
import {
  getCourseRevisionData,
  getCourseWorkflowData,
  insertAiGenerationAuditEvent,
} from "@/features/ai-generation/data/workflow";
import {
  buildGeneratedLessonTreeRows,
  createTextId,
  ensureNoDuplicateLessonTitles,
  slugify,
} from "@/features/ai-generation/domain/generated-tree";
import { createCourseLevelMediaSeedRows } from "@/features/ai-generation/domain/media-planning";
import {
  appendTextRevisionFeedback,
  buildCourseExtensionContext,
  buildCourseRevisionNotes,
  getGeneratedFromInput,
  getLatestTextRevisionFeedback,
  getRecommendedQuestionCountForRevision,
} from "@/features/ai-generation/domain/revision";
import {
  getPromptInput,
  getPromptString,
} from "@/features/ai-generation/application/job-prompts";
import {
  clampAiGenerationRequest,
  generateAiCourseDraft as generateAiCourseDraftFromModel,
  generateAiLessonExtension,
  getAiLearningConfig,
  type AiCourseGenerationInput,
  type AiGeneratedCourseDraft,
} from "@/lib/ai-learning-generator";
import { ValidationError } from "@/lib/app-errors";
import type { Database } from "@/types/database";
import { ensureAiCourse } from "../domain/workflow-status";

type AiGenerationAdminClient = SupabaseClient<Database>;

export type CourseTextJobResult = {
  courseId: string;
  lessonIds: string[];
  mode: "create_course" | "extend_course" | "revise_course";
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildCourseNotes(
  input: AiCourseGenerationInput,
  jobId: string | null,
  draft: AiGeneratedCourseDraft,
  mode: CourseTextJobResult["mode"] = "create_course",
) {
  const config = getAiLearningConfig();
  return {
    source: "openai",
    jobId,
    mode,
    textModel: config.textModel,
    reviewModel: config.reviewModel,
    generatedFrom: input,
    lessonCount: draft.lessons.length,
  };
}

export async function processCreateCourseTextJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  workerId: string,
): Promise<CourseTextJobResult> {
  const input = getPromptInput(job.prompt);
  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new ValidationError("AI course generation job is missing required prompt fields.");
  }

  const draft = await generateAiCourseDraftFromModel(input);
  const courseSlugBase = slugify(draft.course.title);
  const courseSlug = `${courseSlugBase}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
  const courseId = createTextId("course", courseSlug);
  const generatedTree = buildGeneratedLessonTreeRows({
    courseId,
    lessons: draft.lessons,
    jobId: job.id,
    startingSortOrder: 1,
  });

  const courseRow = {
    id: courseId,
    slug: courseSlug,
    title: draft.course.title,
    description: draft.course.description,
    category: draft.course.category,
    level: draft.course.level,
    thumbnail: {},
    status: "draft",
    sort_order: 0,
    estimated_minutes: draft.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
    ai_text_status: "draft",
    ai_media_status: "not_started",
    ai_publish_status: "not_ready",
    ai_generated: true,
    ai_generation_notes: buildCourseNotes(input, job.id, draft, "create_course"),
  };

  generatedTree.mediaRows.push(
    ...createCourseLevelMediaSeedRows(courseRow, job.id, generatedTree.mediaRows.length),
  );

  await materializeAiCourseTextJob(supabase, {
    courseRow,
    courseUpdate: null,
    entityId: courseId,
    generatedTree,
    jobId: job.id,
    jobResult: {
      courseId,
      title: draft.course.title,
      lessonCount: draft.lessons.length,
      mediaAssetCount: generatedTree.mediaRows.length,
    },
    workerId,
  });

  await insertAiGenerationAuditEvent(supabase, getPromptString(job.prompt, "actorUserId"), "ai_course_draft_generated", "course", courseId, {
    topic: input.topic,
    audience: input.audience,
    region: input.region,
    lessonCount: draft.lessons.length,
    questionsPerLesson: input.questionsPerLesson,
    jobId: job.id,
  });

  return {
    courseId,
    lessonIds: generatedTree.lessonIds,
    mode: "create_course",
  };
}

export async function processExtendCourseTextJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  workerId: string,
): Promise<CourseTextJobResult> {
  const input = getPromptInput(job.prompt);
  const courseId = getPromptString(job.prompt, "courseId");
  const continuityInstruction = getPromptString(job.prompt, "continuityInstruction");

  if (!courseId) {
    throw new ValidationError("AI course extension job is missing a course id.");
  }

  if (!input.topic || !input.audience || !input.region || !input.tone) {
    throw new ValidationError("AI course extension job is missing required prompt fields.");
  }

  const { course, lessons } = await getCourseWorkflowData(supabase, courseId);
  const extensionContext = buildCourseExtensionContext(course, lessons, continuityInstruction);
  const draft = await generateAiLessonExtension(input, extensionContext);
  ensureNoDuplicateLessonTitles(lessons, draft.lessons);

  const nextSortOrder = lessons.reduce((max, lesson) => Math.max(max, lesson.sort_order), 0) + 1;
  const generatedTree = buildGeneratedLessonTreeRows({
    courseId,
    lessons: draft.lessons,
    jobId: job.id,
    startingSortOrder: nextSortOrder,
  });

  await materializeAiCourseTextJob(supabase, {
    courseRow: null,
    courseUpdate: {
      ai_generated: true,
      ai_text_status: "draft",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      text_approved_at: null,
      text_approved_by: null,
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: {
        ...buildCourseNotes(input, job.id, draft, "extend_course"),
        extendedCourseId: courseId,
        addedLessonCount: draft.lessons.length,
        continuityInstruction: continuityInstruction || null,
      },
    },
    entityId: courseId,
    generatedTree,
    jobId: job.id,
    jobResult: {
      mode: "extend_course",
      courseId,
      addedLessonCount: draft.lessons.length,
      lessonIds: generatedTree.lessonIds,
      mediaAssetCount: generatedTree.mediaRows.length,
    },
    workerId,
  });

  await insertAiGenerationAuditEvent(supabase, getPromptString(job.prompt, "actorUserId"), "ai_course_extended_with_lessons", "course", courseId, {
    jobId: job.id,
    addedLessonCount: draft.lessons.length,
    lessonIds: generatedTree.lessonIds,
  });

  return {
    courseId,
    lessonIds: generatedTree.lessonIds,
    mode: "extend_course",
  };
}

export async function processReviseCourseTextJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  workerId: string,
): Promise<CourseTextJobResult> {
  const courseId = getPromptString(job.prompt, "courseId");
  const feedback = getPromptString(job.prompt, "feedback").trim();
  const actorUserId = getPromptString(job.prompt, "actorUserId");

  if (!courseId) {
    throw new ValidationError("AI course revision job is missing a course id.");
  }

  if (!actorUserId) {
    throw new ValidationError("AI course revision job is missing an actor user id.");
  }

  if (!feedback) {
    throw new ValidationError("AI course revision job is missing requested text changes.");
  }

  const revisionData = await getCourseRevisionData(supabase, courseId);
  const { course, lessons, pages, quizzes, blocks, questions } = revisionData;
  ensureAiCourse(course);

  if (course.status === "published") {
    throw new ValidationError("Disable the course before revising AI text because published courses do not have a separate draft version yet.");
  }

  const storedFeedback = getLatestTextRevisionFeedback(asRecord(course.ai_generation_notes));
  const generatedFrom = getGeneratedFromInput(course);
  const questionsPerLesson = Math.max(
    getRecommendedQuestionCountForRevision(course.level),
    questions.reduce((max, question) => Math.max(max, question.question_order), 0),
  );

  const input = clampAiGenerationRequest({
    topic: course.title,
    audience: generatedFrom.audience,
    region: generatedFrom.region,
    difficulty: course.level,
    tone: generatedFrom.tone,
    lessonCount: lessons.length,
    questionsPerLesson,
    notes: buildCourseRevisionNotes({
      course,
      lessons,
      pages,
      blocks,
      quizzes,
      questions,
      feedback,
    }),
  });

  const draft = await generateAiCourseDraftFromModel(input);
  ensureNoDuplicateLessonTitles([], draft.lessons);

  const generatedTree = buildGeneratedLessonTreeRows({
    courseId,
    lessons: draft.lessons,
    jobId: job.id,
    startingSortOrder: 1,
  });

  generatedTree.mediaRows.push(
    ...createCourseLevelMediaSeedRows(
      {
        ...draft.course,
        id: courseId,
      },
      job.id,
      generatedTree.mediaRows.length,
    ),
  );

  const revisionNotesBase = appendTextRevisionFeedback(asRecord(course.ai_generation_notes), {
    kind: "applied",
    feedback,
    requestedAt: storedFeedback?.requestedAt ?? new Date().toISOString(),
    requestedBy: storedFeedback?.requestedBy ?? actorUserId,
    revisedAt: new Date().toISOString(),
    revisedBy: actorUserId,
    jobId: job.id,
  });

  const nextCourseNotes = {
    ...revisionNotesBase,
    ...buildCourseNotes(input, job.id, draft, "revise_course"),
    sourceCourseId: courseId,
    revisedFromTitle: course.title,
    latestTextRevisionFeedback: feedback,
    latestTextRevisionAt: new Date().toISOString(),
  };

  await replaceAiCourseTextJob(supabase, {
    courseUpdate: {
      title: draft.course.title,
      description: draft.course.description,
      category: draft.course.category,
      level: draft.course.level,
      estimated_minutes: draft.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
      ai_generated: true,
      ai_text_status: "draft",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      text_approved_at: null,
      text_approved_by: null,
      media_approved_at: null,
      media_approved_by: null,
      ai_generation_notes: nextCourseNotes,
    },
    entityId: courseId,
    generatedTree,
    jobId: job.id,
    jobResult: {
      mode: "revise_course",
      courseId,
      title: draft.course.title,
      lessonCount: draft.lessons.length,
      mediaAssetCount: generatedTree.mediaRows.length,
    },
    workerId,
  });

  await insertAiGenerationAuditEvent(supabase, actorUserId, "ai_course_text_revised", "course", courseId, {
    jobId: job.id,
    feedback,
    revisedTitle: draft.course.title,
    lessonCount: draft.lessons.length,
  });

  return {
    courseId,
    lessonIds: generatedTree.lessonIds,
    mode: "revise_course",
  };
}
