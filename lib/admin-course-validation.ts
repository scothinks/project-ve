import { sanitizePlainTextInput, sanitizeUrlInput } from "./input-safety.ts";
import type { ValidationIssue, ValidationResult } from "./request-validation.ts";

type CourseStatus = "draft" | "published" | "archived";
type ToggleStatus = "draft" | "published";
type RetryMode = "anytime" | "cooldown" | "disabled";
type LessonPageType = "primer" | "concept" | "example" | "reflection" | "summary";
type BlockType = "text" | "callout" | "image" | "video" | "audio" | "table";
type Direction = "up" | "down";
type QuestionType = "single_choice" | "multiple_choice" | "true_false";

const courseStatuses = ["draft", "published", "archived"] as const;
const toggleStatuses = ["draft", "published"] as const;
const retryModes = ["anytime", "cooldown", "disabled"] as const;
const lessonPageTypes = ["primer", "concept", "example", "reflection", "summary"] as const;
const blockTypes = ["text", "callout", "image", "video", "audio", "table"] as const;
const directions = ["up", "down"] as const;
const questionTypes = ["single_choice", "multiple_choice", "true_false"] as const;

type StringOptions = {
  allowEmpty?: boolean;
  maxLength?: number;
  required?: boolean;
  trim?: boolean;
};

type IntegerOptions = {
  fallback?: number;
  max?: number;
  min?: number;
  required?: boolean;
};

export type ImagePayload = {
  src?: string;
  alt?: string;
  fit?: "cover" | "contain";
  positionX?: number;
  positionY?: number;
};

export type QuizOptionInput = {
  label: string;
  isCorrect: boolean;
};

function ok<T>(data: T): ValidationResult<T> {
  return { ok: true, data };
}

function failed<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

function getFormString(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: StringOptions = {},
) {
  const {
    allowEmpty = false,
    maxLength = 500,
    required = true,
    trim = true,
  } = options;
  const value = formData.get(key);

  if (value === null) {
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ path: key, message: "Expected a string." });
    return null;
  }

  const sanitized = sanitizePlainTextInput(value, maxLength);
  const nextValue = trim ? sanitized.trim() : sanitized;

  if (!allowEmpty && nextValue.length === 0) {
    issues.push({ path: key, message: "Required." });
    return null;
  }

  return nextValue;
}

function getOptionalFormString(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: Omit<StringOptions, "required"> = {},
) {
  return getFormString(formData, key, issues, { ...options, required: false }) ?? "";
}

function getFormUrl(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: StringOptions = {},
) {
  const raw = getFormString(formData, key, issues, {
    ...options,
    allowEmpty: true,
    trim: true,
  });

  return raw ? sanitizeUrlInput(raw, options.maxLength ?? 1000) : "";
}

function getFormInteger(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: IntegerOptions = {},
) {
  const { fallback, max, min, required = true } = options;
  const value = formData.get(key);

  if (value === null) {
    if (fallback !== undefined) return fallback;
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ path: key, message: "Expected an integer." });
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    if (fallback !== undefined) return fallback;
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (!/^-?\d+$/.test(raw)) {
    issues.push({ path: key, message: "Expected an integer." });
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isSafeInteger(parsed)) {
    issues.push({ path: key, message: "Expected a safe integer." });
    return null;
  }

  if (min !== undefined && parsed < min) {
    issues.push({ path: key, message: `Must be at least ${min}.` });
    return null;
  }

  if (max !== undefined && parsed > max) {
    issues.push({ path: key, message: `Must be at most ${max}.` });
    return null;
  }

  return parsed;
}

function getOptionalFormInteger(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: Omit<IntegerOptions, "fallback" | "required"> = {},
) {
  const value = formData.get(key);

  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  return getFormInteger(formData, key, issues, { ...options, required: false });
}

function getFormEnum<const T extends readonly string[]>(
  formData: FormData,
  key: string,
  allowed: T,
  issues: ValidationIssue[],
  fallback?: T[number],
) {
  const value = getFormString(formData, key, issues, {
    allowEmpty: fallback !== undefined,
    required: fallback === undefined,
  });

  if (value === null || value === "") {
    return fallback ?? null;
  }

  if (!(allowed as readonly string[]).includes(value)) {
    issues.push({ path: key, message: `Expected one of: ${allowed.join(", ")}.` });
    return null;
  }

  return value as T[number];
}

function getBooleanFlag(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function imagePayloadFromForm(
  formData: FormData,
  urlKey: string,
  altKey: string,
  issues: ValidationIssue[],
): ImagePayload {
  const payload: ImagePayload = {
    src: getFormUrl(formData, urlKey, issues, {
      maxLength: 1000,
      required: false,
    }) || undefined,
    alt: getOptionalFormString(formData, altKey, issues, {
      allowEmpty: true,
      maxLength: 240,
    }) || undefined,
  };

  const fitValue = formData.get("imageFit");
  if (typeof fitValue === "string" && fitValue.trim()) {
    if (fitValue === "cover" || fitValue === "contain") {
      payload.fit = fitValue;
    } else {
      issues.push({ path: "imageFit", message: "Expected one of: cover, contain." });
    }
  }

  const positionX = getOptionalFormInteger(formData, "imagePositionX", issues, {
    max: 100,
    min: 0,
  });
  const positionY = getOptionalFormInteger(formData, "imagePositionY", issues, {
    max: 100,
    min: 0,
  });

  if (positionX !== null) payload.positionX = positionX;
  if (positionY !== null) payload.positionY = positionY;

  return payload;
}

function resolveCategory(formData: FormData, issues: ValidationIssue[]) {
  const customCategory = getOptionalFormString(formData, "categoryCustom", issues, {
    allowEmpty: true,
    maxLength: 120,
  });
  const selectedCategory = getOptionalFormString(formData, "category", issues, {
    allowEmpty: true,
    maxLength: 120,
  });

  return customCategory.trim() || selectedCategory.trim();
}

function returnResult<T>(issues: ValidationIssue[], data: T): ValidationResult<T> {
  return issues.length > 0 ? failed<T>(issues) : ok(data);
}

export function formatValidationIssues(issues: ValidationIssue[]) {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ");
}

export function parseSaveCourseForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const courseId = getOptionalFormString(formData, "courseId", issues, {
    allowEmpty: true,
    maxLength: 120,
  });

  return returnResult(issues, {
    courseId,
    description: getOptionalFormString(formData, "description", issues, {
      allowEmpty: true,
      maxLength: 1000,
    }),
    intendedAudience: getOptionalFormString(formData, "intendedAudience", issues, {
      allowEmpty: true,
      maxLength: 500,
    }),
    learningOutcomes: getOptionalFormString(formData, "learningOutcomes", issues, {
      allowEmpty: true,
      maxLength: 2000,
    })
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12),
    category: resolveCategory(formData, issues),
    estimatedMinutes: getFormInteger(formData, "estimatedMinutes", issues, {
      fallback: 0,
      min: 0,
    }) ?? 0,
    level: getFormEnum(formData, "level", ["beginner", "intermediate", "advanced"] as const, issues, "beginner") ?? "beginner",
    sortOrder: getFormInteger(formData, "sortOrder", issues, {
      fallback: 0,
      min: 0,
    }) ?? 0,
    status: getFormEnum(formData, "status", courseStatuses, issues, "draft") as CourseStatus,
    thumbnail: imagePayloadFromForm(formData, "thumbnailUrl", "thumbnailAlt", issues),
    title: getFormString(formData, "title", issues, { maxLength: 160 }) ?? "",
  });
}

export function parseSaveLessonForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return returnResult(issues, {
    courseId: getFormString(formData, "courseId", issues, { maxLength: 120 }) ?? "",
    coverImage: imagePayloadFromForm(formData, "coverImageUrl", "coverImageAlt", issues),
    description: getOptionalFormString(formData, "description", issues, {
      allowEmpty: true,
      maxLength: 1000,
    }),
    estimatedMinutes: getFormInteger(formData, "estimatedMinutes", issues, {
      fallback: 0,
      min: 0,
    }) ?? 0,
    lessonId: getOptionalFormString(formData, "lessonId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    maxEarningAttempts: getOptionalFormInteger(formData, "maxEarningAttempts", issues, {
      min: 1,
    }),
    quizRequiresLessonCompletion: getBooleanFlag(formData, "quizRequiresLessonCompletion"),
    retryCooldownSeconds: getOptionalFormInteger(formData, "retryCooldownSeconds", issues, {
      min: 0,
    }),
    retryMode: getFormEnum(formData, "retryMode", retryModes, issues, "anytime") as RetryMode,
    retryRequiresReread: getBooleanFlag(formData, "retryRequiresReread"),
    sortOrder: getFormInteger(formData, "sortOrder", issues, {
      fallback: 0,
      min: 0,
    }) ?? 0,
    status: getFormEnum(formData, "status", courseStatuses, issues, "draft") as CourseStatus,
    title: getFormString(formData, "title", issues, { maxLength: 160 }) ?? "",
  });
}

export function parseSetCourseStatusForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const courseId = getFormString(formData, "courseId", issues, { maxLength: 120 }) ?? "";

  return returnResult(issues, {
    courseId,
    redirectTo: getOptionalFormString(formData, "redirectTo", issues, {
      allowEmpty: true,
      maxLength: 400,
    }) || `/admin/courses/${courseId}`,
    status: getFormEnum(formData, "status", toggleStatuses, issues, "draft") as ToggleStatus,
  });
}

export function parseSetLessonStatusForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const courseId = getFormString(formData, "courseId", issues, { maxLength: 120 }) ?? "";
  const lessonId = getFormString(formData, "lessonId", issues, { maxLength: 120 }) ?? "";

  return returnResult(issues, {
    courseId,
    lessonId,
    redirectTo: getOptionalFormString(formData, "redirectTo", issues, {
      allowEmpty: true,
      maxLength: 400,
    }) || `/admin/courses/${courseId}`,
    status: getFormEnum(formData, "status", toggleStatuses, issues, "draft") as ToggleStatus,
  });
}

export function parseSaveLessonPageForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return returnResult(issues, {
    coverImage: imagePayloadFromForm(formData, "coverImageUrl", "coverImageAlt", issues),
    lessonId: getFormString(formData, "lessonId", issues, { maxLength: 120 }) ?? "",
    pageId: getOptionalFormString(formData, "pageId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    pageNumber: getFormInteger(formData, "pageNumber", issues, {
      fallback: 1,
      min: 1,
    }) ?? 1,
    pageType: getFormEnum(formData, "pageType", lessonPageTypes, issues, "concept") as LessonPageType,
    subtitle: getOptionalFormString(formData, "subtitle", issues, {
      allowEmpty: true,
      maxLength: 300,
    }),
    title: getFormString(formData, "title", issues, { maxLength: 160 }) ?? "",
  });
}

export function parseSaveLessonBlockForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const blockType = getFormEnum(formData, "blockType", blockTypes, issues, "text") as BlockType;

  return returnResult(issues, {
    blockId: getOptionalFormString(formData, "blockId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    blockType,
    lessonId: getFormString(formData, "lessonId", issues, { maxLength: 120 }) ?? "",
    pageId: getFormString(formData, "pageId", issues, { maxLength: 120 }) ?? "",
    payload: parseBlockPayload(formData, blockType, issues),
    sortOrder: getFormInteger(formData, "sortOrder", issues, {
      fallback: 0,
      min: 0,
    }) ?? 0,
  });
}

function parseBlockPayload(formData: FormData, blockType: BlockType, issues: ValidationIssue[]) {
  if (blockType === "callout") {
    return {
      variant: getOptionalFormString(formData, "variant", issues, {
        allowEmpty: true,
        maxLength: 40,
      }) || "key_point",
      label: getOptionalFormString(formData, "label", issues, {
        allowEmpty: true,
        maxLength: 80,
      }),
      title: getOptionalFormString(formData, "heading", issues, {
        allowEmpty: true,
        maxLength: 180,
      }),
      body: getOptionalFormString(formData, "body", issues, {
        allowEmpty: true,
        maxLength: 2000,
      }),
    };
  }

  if (blockType === "image") {
    const payload: Record<string, unknown> = {
      src: getFormUrl(formData, "src", issues, {
        maxLength: 1000,
        required: false,
      }),
      alt: getOptionalFormString(formData, "alt", issues, {
        allowEmpty: true,
        maxLength: 240,
      }),
      caption: getOptionalFormString(formData, "caption", issues, {
        allowEmpty: true,
        maxLength: 500,
      }),
    };
    const fit = getFormEnum(formData, "fit", ["cover", "contain"] as const, issues, "cover");
    const positionX = getOptionalFormInteger(formData, "positionX", issues, {
      max: 100,
      min: 0,
    });
    const positionY = getOptionalFormInteger(formData, "positionY", issues, {
      max: 100,
      min: 0,
    });

    const aiManagedByAssetId = getOptionalFormString(formData, "aiManagedByAssetId", issues, {
      allowEmpty: true,
      maxLength: 120,
    });
    const aiManagedKind = getOptionalFormString(formData, "aiManagedKind", issues, {
      allowEmpty: true,
      maxLength: 80,
    });
    const aiGenerated = getOptionalFormString(formData, "aiGenerated", issues, {
      allowEmpty: true,
      maxLength: 20,
    }).toLowerCase();

    if (aiManagedByAssetId) payload.aiManagedByAssetId = aiManagedByAssetId;
    if (aiManagedKind) payload.aiManagedKind = aiManagedKind;
    if (["true", "1", "yes", "on"].includes(aiGenerated)) payload.aiGenerated = true;
    if (fit) payload.fit = fit;
    if (positionX !== null) payload.positionX = positionX;
    if (positionY !== null) payload.positionY = positionY;

    return payload;
  }

  if (blockType === "video" || blockType === "audio") {
    return {
      src: getFormUrl(formData, "src", issues, {
        maxLength: 1000,
        required: false,
      }),
      title: getOptionalFormString(formData, "heading", issues, {
        allowEmpty: true,
        maxLength: 180,
      }),
      caption: getOptionalFormString(formData, "caption", issues, {
        allowEmpty: true,
        maxLength: 500,
      }),
      transcript: getOptionalFormString(formData, "body", issues, {
        allowEmpty: true,
        maxLength: 2000,
      }),
    };
  }

  if (blockType === "table") {
    return {
      title: getOptionalFormString(formData, "heading", issues, {
        allowEmpty: true,
        maxLength: 180,
      }),
      columns: getOptionalFormString(formData, "columns", issues, {
        allowEmpty: true,
        maxLength: 500,
      })
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      rows: getOptionalFormString(formData, "rows", issues, {
        allowEmpty: true,
        maxLength: 2000,
      })
        .split("\n")
        .map((row) => row.split(",").map((cell) => cell.trim()))
        .filter((row) => row.length > 0 && row.some(Boolean)),
      caption: getOptionalFormString(formData, "caption", issues, {
        allowEmpty: true,
        maxLength: 500,
      }),
    };
  }

  return {
    heading: getOptionalFormString(formData, "heading", issues, {
      allowEmpty: true,
      maxLength: 180,
    }),
    body: getOptionalFormString(formData, "body", issues, {
      allowEmpty: true,
      maxLength: 4000,
    }),
  };
}

export function parseReorderLessonPageForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return returnResult(issues, {
    direction: getFormEnum(formData, "direction", directions, issues, "down") as Direction,
    lessonId: getFormString(formData, "lessonId", issues, { maxLength: 120 }) ?? "",
    pageId: getFormString(formData, "pageId", issues, { maxLength: 120 }) ?? "",
  });
}

export function parseReorderLessonBlockForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return returnResult(issues, {
    blockId: getFormString(formData, "blockId", issues, { maxLength: 120 }) ?? "",
    direction: getFormEnum(formData, "direction", directions, issues, "down") as Direction,
    lessonId: getFormString(formData, "lessonId", issues, { maxLength: 120 }) ?? "",
    pageId: getFormString(formData, "pageId", issues, { maxLength: 120 }) ?? "",
  });
}

export function parseSaveQuizSettingsForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return returnResult(issues, {
    lessonId: getFormString(formData, "lessonId", issues, { maxLength: 120 }) ?? "",
    quizId: getFormString(formData, "quizId", issues, { maxLength: 120 }) ?? "",
    quizTitle: getFormString(formData, "quizTitle", issues, { maxLength: 180 }) ?? "",
    status: getFormEnum(formData, "quizStatus", courseStatuses, issues, "draft") as CourseStatus,
  });
}

export function parseSaveQuizQuestionForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const options = parseQuizOptions(formData, issues);
  const questionType = getFormEnum(formData, "questionType", questionTypes, issues, "single_choice") as QuestionType;
  const correctCount = options.filter((option) => option.isCorrect).length;

  if (options.length < 2 || options.length > 4) {
    issues.push({ path: "options", message: "Provide between 2 and 4 answer options." });
  }

  if (correctCount === 0) {
    issues.push({ path: "options", message: "Mark at least one correct answer." });
  }

  if (questionType === "single_choice" && correctCount !== 1) {
    issues.push({ path: "options", message: "Single-choice questions must have exactly one correct answer." });
  }

  if (questionType === "multiple_choice" && options.length > 1 && correctCount === options.length) {
    issues.push({ path: "options", message: "Multiple-choice questions need at least one incorrect option." });
  }

  if (questionType === "true_false") {
    const labels = options.map((option) => option.label.trim().toLowerCase()).sort();

    if (options.length !== 2 || labels[0] !== "false" || labels[1] !== "true") {
      issues.push({ path: "options", message: "True/false questions must use exactly True and False options." });
    }

    if (correctCount !== 1) {
      issues.push({ path: "options", message: "True/false questions must have exactly one correct answer." });
    }
  }

  return returnResult(issues, {
    explanation: getOptionalFormString(formData, "explanation", issues, {
      allowEmpty: true,
      maxLength: 1000,
    }),
    lessonId: getFormString(formData, "lessonId", issues, { maxLength: 120 }) ?? "",
    options,
    prompt: getFormString(formData, "prompt", issues, { maxLength: 1000 }) ?? "",
    questionId: getOptionalFormString(formData, "questionId", issues, {
      allowEmpty: true,
      maxLength: 160,
    }),
    questionOrder: getFormInteger(formData, "questionOrder", issues, {
      fallback: 1,
      min: 1,
    }) ?? 1,
    questionType,
    quizId: getFormString(formData, "quizId", issues, { maxLength: 120 }) ?? "",
    xp: getFormInteger(formData, "xp", issues, {
      fallback: 1,
      max: 20,
      min: 1,
    }) ?? 1,
  });
}

function parseQuizOptions(formData: FormData, issues: ValidationIssue[]): QuizOptionInput[] {
  return [1, 2, 3, 4]
    .map((index) => ({
      label: getOptionalFormString(formData, `option${index}`, issues, {
        allowEmpty: true,
        maxLength: 500,
      }),
      isCorrect: getBooleanFlag(formData, `correct${index}`),
    }))
    .filter((option) => option.label.trim());
}
