import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  materializeAiCourseTextJob,
  type AiGenerationClaim,
} from "@/features/ai-generation/data/jobs";
import { getLessonWorkflowData } from "@/features/ai-generation/data/workflow";
import {
  buildGeneratedLessonPageRows,
  ensureNoDuplicateLessonPageTitles,
} from "@/features/ai-generation/domain/generated-tree";
import { getPromptString } from "@/features/ai-generation/application/job-prompts";
import {
  generateAiLessonPageExtension,
  type AiGeneratedPage,
  type AiGeneratorLevel,
  type AiGeneratorPageType,
} from "@/lib/ai-learning-generator";
import { ValidationError } from "@/lib/app-errors";
import type { Database } from "@/types/database";

type AiGenerationAdminClient = SupabaseClient<Database>;

export type LessonPageJobResult = {
  courseId: string;
  lessonId: string;
  pageId: string;
  lessonIds: string[];
};

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asPageType(value: string): AiGeneratorPageType {
  return value === "concept" || value === "scenario" || value === "reflection" || value === "summary"
    ? value
    : "concept";
}

export async function processExtendLessonPageJob(
  supabase: AiGenerationAdminClient,
  job: AiGenerationClaim,
  workerId: string,
): Promise<LessonPageJobResult> {
  const lessonId = getPromptString(job.prompt, "lessonId");
  const focus = getPromptString(job.prompt, "focus");
  const pageType = asPageType(getPromptString(job.prompt, "pageType"));
  const refinementInstruction = getPromptString(job.prompt, "refinementInstruction");
  const priorDraft = asObject(job.prompt.priorDraft) as AiGeneratedPage | null;

  if (!lessonId) {
    throw new ValidationError("AI page suggestion job is missing a lesson id.");
  }

  const { course, lesson, lessonPages } = await getLessonWorkflowData(supabase, lessonId);

  const sortedExistingPages = [...lessonPages].sort((first, second) => first.page_number - second.page_number);
  const generatedPage = await generateAiLessonPageExtension({
    course: {
      title: course.title,
      category: course.category,
      level: course.level as AiGeneratorLevel,
    },
    lesson: {
      title: lesson.title,
      description: lesson.description ?? "",
    },
    existingPages: sortedExistingPages.map((page) => ({
      title: page.title,
      pageType: asPageType(page.page_type),
    })),
    focus,
    pageType,
    priorDraft,
    refinementInstruction: refinementInstruction || undefined,
  });

  ensureNoDuplicateLessonPageTitles(sortedExistingPages, generatedPage.title);

  const nextPageNumber = sortedExistingPages.reduce((max, page) => Math.max(max, page.page_number), 0) + 1;
  const { pageId, pageRows, blockRows } = buildGeneratedLessonPageRows({
    lessonId,
    page: generatedPage,
    pageNumber: nextPageNumber,
  });

  await materializeAiCourseTextJob(supabase, {
    courseRow: null,
    courseUpdate: null,
    entityId: course.id,
    generatedTree: {
      lessonRows: [],
      pageRows,
      blockRows,
      quizRows: [],
      questionRows: [],
      optionRows: [],
      mediaRows: [],
    },
    jobId: job.id,
    jobResult: {
      mode: "extend_lesson_page",
      courseId: course.id,
      lessonId,
      pageId,
      generatedPage,
      focus: focus || null,
      refinementInstruction: refinementInstruction || null,
    },
    workerId,
    lockToken: job.lock_token,
    lockVersion: job.lock_version,
  });

  return {
    courseId: course.id,
    lessonId,
    pageId,
    lessonIds: [lessonId],
  };
}
