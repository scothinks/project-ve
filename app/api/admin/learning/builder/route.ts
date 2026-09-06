import { imageStyleDraft } from "@/features/ai-generation/authoring/image-style";
import { mediaIntent } from "@/lib/media-intent";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import {
  getArrayField,
  getBooleanField,
  getNumberField,
  getObjectField,
  getOptionalStringField,
  getStringField,
  isJsonObject,
  readJsonObject,
  validationErrorResponse,
  type JsonObject,
  type ValidationIssue,
} from "@/lib/request-validation";

type BuilderPageInput = {
  id?: string;
  title?: string;
  subtitle?: string | null;
  page_type?: string;
  page_number?: number;
  cover_image?: Record<string, unknown> | null;
};

type BuilderBlockInput = {
  id?: string;
  page_id?: string;
  block_type?: string;
  sort_order?: number;
  payload?: Record<string, unknown> | null;
  isDraft?: boolean;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseInteger(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizePageImagePayload(input: unknown) {
  const payload = asRecord(input);
  const next: Record<string, unknown> = {};
  const src = sanitizeUrlInput(String(payload.src ?? ""), 1000);
  const alt = sanitizePlainTextInput(String(payload.alt ?? ""), 240);

  if (src) next.src = src;
  if (alt) next.alt = alt;

  if (payload.fit === "cover" || payload.fit === "contain") {
    next.fit = payload.fit;
  }

  const positionX = parseInteger(payload.positionX, 50);
  const positionY = parseInteger(payload.positionY, 50);
  next.positionX = Math.max(0, Math.min(100, positionX));
  next.positionY = Math.max(0, Math.min(100, positionY));

  const caption = sanitizePlainTextInput(String(payload.caption ?? ""), 500);
  if (caption) next.caption = caption;

  return next;
}

function sanitizeBlockPayload(blockType: string, input: unknown) {
  const payload = asRecord(input);
  const intent = mediaIntent(payload);
  const briefFields = typeof payload.mediaBrief === "string"
    ? { mediaBrief: sanitizePlainTextInput(payload.mediaBrief, 6000) } : {};
  const intentFields = intent?.kind === blockType ? { mediaIntent: { ...intent, purpose: sanitizePlainTextInput(intent.purpose, 1000) } } : {};

  if (blockType === "callout") {
    return {
      variant: sanitizePlainTextInput(String(payload.variant ?? "key_point"), 40),
      label: sanitizePlainTextInput(String(payload.label ?? ""), 80),
      title: sanitizePlainTextInput(String(payload.title ?? payload.heading ?? ""), 180),
      body: sanitizePlainTextInput(String(payload.body ?? ""), 2000),
    };
  }

  if (blockType === "image") {
    const next: Record<string, unknown> = {
      ...intentFields,
      ...briefFields,
      ...(imageStyleDraft(payload.mediaStyle) !== undefined ? { mediaStyle: imageStyleDraft(payload.mediaStyle) } : {}),
      src: sanitizeUrlInput(String(payload.src ?? ""), 1000),
      alt: sanitizePlainTextInput(String(payload.alt ?? ""), 240),
      caption: sanitizePlainTextInput(String(payload.caption ?? ""), 500),
    };
    if (payload.fit === "cover" || payload.fit === "contain") {
      next.fit = payload.fit;
    }
    next.positionX = Math.max(0, Math.min(100, parseInteger(payload.positionX, 50)));
    next.positionY = Math.max(0, Math.min(100, parseInteger(payload.positionY, 50)));

    // A GIF is stored as an image block with this flag — no dedicated DB enum
    // value, since it renders and is picked exactly like an image.
    if (payload.mediaKind === "gif") {
      next.mediaKind = "gif";
    }

    const aiManagedByAssetId = sanitizePlainTextInput(String(payload.aiManagedByAssetId ?? ""), 120);
    const aiManagedKind = sanitizePlainTextInput(String(payload.aiManagedKind ?? ""), 80);
    if (aiManagedByAssetId) next.aiManagedByAssetId = aiManagedByAssetId;
    if (aiManagedKind) next.aiManagedKind = aiManagedKind;
    if (payload.aiGenerated === true) next.aiGenerated = true;
    return next;
  }

  if (blockType === "video" || blockType === "audio") {
    return {
      ...intentFields,
      ...briefFields,
      src: sanitizeUrlInput(String(payload.src ?? ""), 1000),
      title: sanitizePlainTextInput(String(payload.title ?? payload.heading ?? ""), 180),
      caption: sanitizePlainTextInput(String(payload.caption ?? ""), 500),
      transcript: sanitizePlainTextInput(String(payload.transcript ?? payload.body ?? ""), 2000),
    };
  }

  if (blockType === "table") {
    const columns = Array.isArray(payload.columns)
      ? payload.columns.map((item) => sanitizePlainTextInput(String(item), 80)).filter(Boolean)
      : [];
    const rows = Array.isArray(payload.rows)
      ? payload.rows
          .map((row) => Array.isArray(row)
            ? row.map((cell) => sanitizePlainTextInput(String(cell), 160))
            : [])
          .filter((row) => row.some(Boolean))
      : [];

    return {
      title: sanitizePlainTextInput(String(payload.title ?? payload.heading ?? ""), 180),
      columns,
      rows,
      caption: sanitizePlainTextInput(String(payload.caption ?? ""), 500),
    };
  }

  return {
    heading: sanitizePlainTextInput(String(payload.heading ?? payload.title ?? ""), 180),
    body: sanitizeRichTextHtml(String(payload.body ?? ""), 6000),
  };
}

function validateBuilderPage(input: JsonObject, issues: ValidationIssue[]) {
  const id = getOptionalStringField(input, "id", issues);
  const title = getOptionalStringField(input, "title", issues, { allowEmpty: true });
  const subtitle = getOptionalStringField(input, "subtitle", issues, { allowEmpty: true });
  const pageType = getOptionalStringField(input, "page_type", issues);
  const pageNumber = getNumberField(input, "page_number", issues, {
    integer: true,
    min: 1,
    required: false,
  });
  const coverImage = getObjectField(input, "cover_image", issues, { required: false });

  return {
    ...(id !== null ? { id } : {}),
    ...(title !== null ? { title } : {}),
    ...(subtitle !== null ? { subtitle } : {}),
    ...(pageType !== null ? { page_type: pageType } : {}),
    ...(pageNumber !== null ? { page_number: pageNumber } : {}),
    ...(coverImage !== null ? { cover_image: coverImage } : {}),
  } satisfies BuilderPageInput;
}

function validateBuilderBlock(input: JsonObject, issues: ValidationIssue[]) {
  const id = getOptionalStringField(input, "id", issues);
  const pageId = getOptionalStringField(input, "page_id", issues);
  const blockType = getOptionalStringField(input, "block_type", issues);
  const sortOrder = getNumberField(input, "sort_order", issues, {
    integer: true,
    min: 1,
    required: false,
  });
  const payload = getObjectField(input, "payload", issues, { required: false });
  const isDraft = getBooleanField(input, "isDraft", issues, { required: false });

  return {
    ...(id !== null ? { id } : {}),
    ...(pageId !== null ? { page_id: pageId } : {}),
    ...(blockType !== null ? { block_type: blockType } : {}),
    ...(sortOrder !== null ? { sort_order: sortOrder } : {}),
    ...(payload !== null ? { payload } : {}),
    ...(isDraft !== null ? { isDraft } : {}),
  } satisfies BuilderBlockInput;
}

export async function POST(request: Request) {
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const rawLessonId = getStringField(bodyResult.data, "lessonId", issues);
  const lessonId = sanitizePlainTextInput(rawLessonId ?? "", 120);
  const expectedRevision = getNumberField(bodyResult.data, "expectedRevision", issues, { integer: true, min: 0 });
  const rawPages = getArrayField(bodyResult.data, "pages", issues, { required: false }) ?? [];
  const rawBlocks = getArrayField(bodyResult.data, "blocks", issues, { required: false }) ?? [];
  const pages: BuilderPageInput[] = [];
  const blocks: BuilderBlockInput[] = [];

  rawPages.forEach((page, index) => {
    if (!isJsonObject(page)) {
      issues.push({ path: `pages.${index}`, message: "Expected an object." });
      return;
    }

    pages.push(validateBuilderPage(page, issues));
  });

  rawBlocks.forEach((block, index) => {
    if (!isJsonObject(block)) {
      issues.push({ path: `blocks.${index}`, message: "Expected an object." });
      return;
    }

    blocks.push(validateBuilderBlock(block, issues));
  });

  if (!lessonId) {
    issues.push({ path: "lessonId", message: "Required." });
  }

  if (issues.length > 0) {
    return validationErrorResponse(issues);
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_save_lesson_builder", {
    p_lesson_id: lessonId,
    p_expected_revision: expectedRevision!,
    p_pages: pages.map((page) => ({
      id: sanitizePlainTextInput(String(page.id ?? ""), 120),
      title: sanitizePlainTextInput(String(page.title ?? ""), 160),
      subtitle: sanitizePlainTextInput(String(page.subtitle ?? ""), 300),
      page_type: sanitizePlainTextInput(String(page.page_type ?? "concept"), 40),
      page_number: parseInteger(page.page_number, 1),
      cover_image: sanitizePageImagePayload(page.cover_image),
    })),
    p_blocks: blocks.map((block) => ({
      id: sanitizePlainTextInput(String(block.id ?? ""), 160),
      page_id: sanitizePlainTextInput(String(block.page_id ?? ""), 120),
      block_type: sanitizePlainTextInput(String(block.block_type ?? "text"), 40),
      sort_order: parseInteger(block.sort_order, 1),
      payload: sanitizeBlockPayload(String(block.block_type ?? "text"), block.payload),
    })),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PT409" ? 409 : 422 });
  return NextResponse.json({ ...asRecord(data), notice: "Lesson content saved." });
}
