import { sanitizePlainTextInput } from "../../../lib/input-safety.ts";
import type {
  AiGeneratedBlock,
  AiGeneratedCourseDraft,
} from "../../../lib/ai-learning-generator.ts";
import type { WorkflowLessonRow } from "../data/workflow.ts";

export function slugify(value: string) {
  return sanitizePlainTextInput(value, 160)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

export function createTextId(prefix: string, value: string) {
  const base = slugify(value);
  return `${prefix}-${base}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
}

function mapAiPageTypeToDb(pageType: string) {
  return pageType === "scenario" ? "example" : pageType;
}

export function mapAiBlockToDb(block: AiGeneratedBlock): {
  block_type: "text" | "callout" | "table";
  payload: Record<string, unknown>;
} {
  if (block.blockType === "callout") {
    return {
      block_type: "callout",
      payload: {
        variant: sanitizePlainTextInput(String(block.payload.variant ?? "key_point"), 24) || "key_point",
        title: sanitizePlainTextInput(String(block.payload.title ?? ""), 180),
        body: sanitizePlainTextInput(String(block.payload.body ?? ""), 2000),
      },
    };
  }

  if (block.blockType === "table") {
    const columns = Array.isArray(block.payload.columns)
      ? block.payload.columns.map((column) => sanitizePlainTextInput(String(column), 60)).filter(Boolean)
      : [];
    const rows = Array.isArray(block.payload.rows)
      ? block.payload.rows
          .map((row) =>
            Array.isArray(row)
              ? row.map((cell) => sanitizePlainTextInput(String(cell), 120)).filter(Boolean)
              : [],
          )
          .filter((row) => row.length > 0)
      : [];

    return {
      block_type: "table",
      payload: {
        title: sanitizePlainTextInput(String(block.payload.title ?? ""), 180),
        columns,
        rows,
        caption: sanitizePlainTextInput(String(block.payload.caption ?? ""), 500),
      },
    };
  }

  if (block.blockType === "image" || block.blockType === "video" || block.blockType === "audio") {
    const label = block.blockType === "image" ? "Suggested media" : `Suggested ${block.blockType}`;
    return {
      block_type: "callout",
      payload: {
        variant: "example",
        title:
          sanitizePlainTextInput(
            String(block.payload.title ?? block.payload.caption ?? block.payload.alt ?? label),
            180,
          ) || label,
        body:
          sanitizePlainTextInput(
            String(
              block.payload.transcript
                ?? block.payload.caption
                ?? block.payload.alt
                ?? "Media will be reviewed and attached after text approval.",
            ),
            2000,
          ) || "Media will be reviewed and attached after text approval.",
      },
    };
  }

  return {
    block_type: "text",
    payload: {
      heading: sanitizePlainTextInput(String(block.payload.heading ?? ""), 180),
      body: sanitizePlainTextInput(String(block.payload.body ?? ""), 3000),
    },
  };
}

export function parsePageNumberFromPlacement(placement: string) {
  const match = placement.toLowerCase().match(/page[_ -]?(\d+)/i);
  if (!match) {
    return null;
  }

  const pageNumber = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(pageNumber) ? pageNumber : null;
}

export function ensureNoDuplicateLessonTitles(
  existingLessons: WorkflowLessonRow[],
  generatedLessons: AiGeneratedCourseDraft["lessons"],
) {
  const existingSlugs = new Set(existingLessons.map((lesson) => slugify(lesson.title)));
  const newSlugs = new Set<string>();

  for (const lesson of generatedLessons) {
    const normalizedTitle = slugify(lesson.title);
    if (!normalizedTitle) {
      throw new Error("A generated lesson is missing a valid title.");
    }

    if (existingSlugs.has(normalizedTitle)) {
      throw new Error(`The AI tried to create a duplicate lesson title: "${lesson.title}". Adjust the prompt and try again.`);
    }

    if (newSlugs.has(normalizedTitle)) {
      throw new Error(`The AI returned duplicate new lesson titles, including "${lesson.title}". Try again with clearer sequencing guidance.`);
    }

    newSlugs.add(normalizedTitle);
  }
}

export function buildGeneratedLessonTreeRows({
  courseId,
  lessons,
  jobId,
  startingSortOrder,
}: {
  courseId: string;
  lessons: AiGeneratedCourseDraft["lessons"];
  jobId: string | null;
  startingSortOrder: number;
}) {
  const lessonRows: Array<Record<string, unknown>> = [];
  const pageRows: Array<Record<string, unknown>> = [];
  const blockRows: Array<Record<string, unknown>> = [];
  const quizRows: Array<Record<string, unknown>> = [];
  const questionRows: Array<Record<string, unknown>> = [];
  const optionRows: Array<Record<string, unknown>> = [];
  const mediaRows: Array<Record<string, unknown>> = [];
  const lessonIds: string[] = [];

  for (const [lessonIndex, lesson] of lessons.entries()) {
    const lessonId = createTextId("lesson", lesson.title);
    const quizId = `quiz-${lessonId.replace(/^lesson-/, "")}`;
    const generatedPages: Array<{ id: string; page_number: number; page_type: string }> = [];
    lessonIds.push(lessonId);
    lessonRows.push({
      id: lessonId,
      course_id: courseId,
      slug: `${slugify(lesson.title)}-${startingSortOrder + lessonIndex}`,
      title: lesson.title,
      description: lesson.description,
      cover_image: {},
      status: "draft",
      sort_order: startingSortOrder + lessonIndex,
      estimated_minutes: lesson.estimatedMinutes,
      retry_mode: "anytime",
      retry_cooldown_seconds: null,
      retry_requires_reread: true,
      quiz_requires_lesson_completion: true,
      max_earning_attempts: null,
      ai_text_status: "draft",
      ai_media_status: "not_started",
      ai_publish_status: "not_ready",
      ai_generated: true,
      ai_generation_notes: {
        source: "openai",
        jobId,
        lessonIndex: startingSortOrder + lessonIndex,
      },
    });

    quizRows.push({
      id: quizId,
      lesson_id: lessonId,
      title: lesson.quiz.title,
      version: 1,
      status: "draft",
      ai_text_status: "draft",
      ai_generated: true,
      ai_generation_notes: {
        source: "openai",
        jobId,
        lessonId,
      },
    });

    for (const [pageIndex, page] of lesson.pages.entries()) {
      const pageId = createTextId("page", `${lesson.title}-${page.title}`);
      const pageType = mapAiPageTypeToDb(page.pageType);
      generatedPages.push({
        id: pageId,
        page_number: pageIndex + 1,
        page_type: pageType,
      });
      pageRows.push({
        id: pageId,
        lesson_id: lessonId,
        page_number: pageIndex + 1,
        title: page.title,
        subtitle: page.subtitle,
        page_type: pageType,
        cover_image: {},
      });

      for (const [blockIndex, block] of page.blocks.entries()) {
        const mapped = mapAiBlockToDb(block);
        blockRows.push({
          id: crypto.randomUUID(),
          page_id: pageId,
          block_type: mapped.block_type,
          sort_order: blockIndex + 1,
          payload: mapped.payload,
        });
      }
    }

    for (const [questionIndex, question] of lesson.quiz.questions.entries()) {
      const questionId = createTextId("question", `${lesson.title}-${question.prompt}`);
      questionRows.push({
        id: questionId,
        quiz_id: quizId,
        question_order: questionIndex + 1,
        question_type: "single_choice",
        prompt: question.prompt,
        explanation: question.explanation,
        xp: question.xp,
      });

      for (const [optionIndex, option] of question.options.entries()) {
        optionRows.push({
          id: `${questionId}-option-${optionIndex + 1}`,
          question_id: questionId,
          option_order: optionIndex + 1,
          label: option.label,
          is_correct: option.isCorrect,
        });
      }
    }

    const resolveGeneratedPageIdForPlacement = (placement: string) => {
      const explicitPageNumber = parsePageNumberFromPlacement(placement);
      if (explicitPageNumber !== null) {
        return generatedPages.find((page) => page.page_number === explicitPageNumber)?.id ?? null;
      }

      const normalizedPlacement = placement.toLowerCase();
      const preferredType =
        normalizedPlacement.includes("summary") ? "summary"
          : normalizedPlacement.includes("reflection") ? "reflection"
            : normalizedPlacement.includes("example") || normalizedPlacement.includes("scenario") ? "example"
              : normalizedPlacement.includes("concept") || normalizedPlacement.includes("intro") || normalizedPlacement.includes("primer") ? "concept"
                : "";

      if (!preferredType) {
        return null;
      }

      return generatedPages.find((page) => page.page_type === preferredType)?.id ?? null;
    };

    for (const [mediaIndex, mediaBrief] of lesson.mediaBriefs.entries()) {
      const targetPageId = mediaBrief.assetType === "image" || mediaBrief.assetType === "infographic"
        ? resolveGeneratedPageIdForPlacement(mediaBrief.placement)
        : null;

      mediaRows.push({
        course_id: courseId,
        lesson_id: lessonId,
        asset_type: mediaBrief.assetType,
        placement: mediaBrief.placement,
        source: "ai_generated",
        prompt: mediaBrief.prompt,
        script: mediaBrief.script,
        url: null,
        storage_path: null,
        provider: null,
        model: null,
        alt_text: mediaBrief.altText,
        caption: mediaBrief.caption,
        metadata: {
          jobId,
          lessonId,
          lessonTitle: lesson.title,
          targetKind:
            mediaBrief.assetType === "thumbnail" ? "lesson_thumbnail"
              : mediaBrief.assetType === "image" ? "page_cover"
                : mediaBrief.assetType === "infographic" ? "page_block"
                : undefined,
          preferredPlacement:
            mediaBrief.assetType === "infographic" ? "page_block" : undefined,
          mediaNote:
            mediaBrief.assetType === "infographic"
              ? "Infographics are intended for in-page teaching use, not page cover art."
              : undefined,
          targetPageId,
        },
        review_status: "draft",
        generation_status: "pending",
        generation_error: null,
        sort_order: mediaIndex,
      });
    }
  }

  return {
    lessonRows,
    pageRows,
    blockRows,
    quizRows,
    questionRows,
    optionRows,
    mediaRows,
    lessonIds,
  };
}
