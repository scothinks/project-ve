import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";
import { asSupabaseJson } from "@/lib/supabase-rpc";

type JsonRecord = Record<string, unknown>;

export type LearningMediaAssetForGeneration = {
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
  metadata: JsonRecord;
  review_status: string;
  generation_status: string;
  generation_error: string | null;
};

export type LearningMediaGenerationContext = {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  courseCategory: string;
  lessonId?: string | null;
  lessonTitle?: string | null;
  lessonDescription?: string | null;
  pageId?: string | null;
  pageTitle?: string | null;
  pageSubtitle?: string | null;
  placementLabel?: string | null;
  revisionFeedback?: string | null;
  targetKind: "course_cover" | "course_thumbnail" | "lesson_thumbnail" | "page_cover" | "page_block" | "asset_only";
};

type OpenAiImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export type GenerateLearningMediaImageInput = {
  asset: LearningMediaAssetForGeneration;
  context: LearningMediaGenerationContext;
  replaceExisting?: boolean;
};

export type GenerateLearningMediaImageResult = {
  assetId: string;
  status: "generated" | "skipped";
  url: string | null;
  storagePath: string | null;
  provider: string | null;
  model: string | null;
  generatedAt: string | null;
  replacedExisting: boolean;
  revisedPrompt: string | null;
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function sanitizeText(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return sanitizePlainTextInput(value, maxLength).trim();
}

function getImageModel() {
  return sanitizeText(process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1", 120, "gpt-image-1") || "gpt-image-1";
}

function getMediaBucket() {
  return "learning-media-private";
}

export function getAiMediaConfig() {
  const adminConfig = getSupabaseAdminConfig();
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const bucket = getMediaBucket();
  const hasBucket = Boolean(bucket);
  const missingRequirements: string[] = [];

  if (!hasApiKey) missingRequirements.push("OPENAI_API_KEY");
  if (!adminConfig.hasSupabaseUrl) missingRequirements.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!adminConfig.hasServiceRoleKey) missingRequirements.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!hasBucket) missingRequirements.push("LEARNING_MEDIA_BUCKET");

  return {
    hasApiKey,
    hasSupabaseUrl: adminConfig.hasSupabaseUrl,
    hasServiceRoleKey: adminConfig.hasServiceRoleKey,
    hasBucket,
    bucket,
    canGenerate: missingRequirements.length === 0,
    missingRequirements,
  };
}

function buildStoragePath() {
  return `registry/${randomUUID()}.png`;
}

function getTargetSize(
  asset: Pick<LearningMediaAssetForGeneration, "asset_type">,
  context: Pick<LearningMediaGenerationContext, "targetKind">,
): OpenAiImageSize {
  if (
    context.targetKind === "course_cover"
    || context.targetKind === "course_thumbnail"
    || context.targetKind === "lesson_thumbnail"
    || context.targetKind === "page_cover"
    || asset.asset_type === "infographic"
    || asset.asset_type === "thumbnail"
    || asset.asset_type === "cover"
  ) {
    return "1536x1024";
  }

  return "1024x1024";
}

function getCompositionRules(
  asset: Pick<LearningMediaAssetForGeneration, "asset_type">,
  context: Pick<LearningMediaGenerationContext, "targetKind">,
) {
  const rules = [
    "- keep the composition clean and easy to understand on a mobile screen",
    "- do not render the course title, lesson title, page title, or headline text inside the image",
    "- treat all titles in this prompt as context for the scene, not as words to place on the artwork",
    "- avoid visible text unless it is naturally part of the scene or essential to the concept",
    "- if text is relevant to the image, keep it minimal and secondary",
    "- do not make the image text-heavy",
  ];

  if (
    context.targetKind === "course_cover"
    || context.targetKind === "course_thumbnail"
    || context.targetKind === "lesson_thumbnail"
  ) {
    rules.push(
      "- compose for a wide horizontal card crop, not a square crop",
      "- keep faces, hands, books, and other key details inside the center safe area",
      "- leave clear breathing room around subjects so nothing important sits on the edges",
      "- avoid close-up portraits or tightly cropped group shots",
    );
  } else if (context.targetKind === "page_cover") {
    rules.push(
      "- compose for a wide in-page banner image",
      "- keep the main subject centered with room around it",
      "- prefer a medium-wide scene instead of a tight crop",
    );
  }

  if (asset.asset_type === "infographic") {
    rules.push(
      "- this should feel like a visual educational infographic, not a photo collage",
      "- use simple shapes, icons, symbols, and scene cues that explain the idea visually",
      "- avoid dense labels, charts, or paragraphs of text",
      "- never place the course title or lesson title as a headline inside the infographic",
    );
  } else {
    rules.push(
      "- focus on one clear scene or idea",
      "- avoid clutter and unnecessary background distractions",
    );
  }

  return rules;
}

function buildImagePrompt(asset: LearningMediaAssetForGeneration, context: LearningMediaGenerationContext) {
  const lines = [
    "Create one safe educational image.",
    `Asset type: ${asset.asset_type}`,
    `Course title: ${context.courseTitle}`,
    `Course category: ${context.courseCategory}`,
    `Course description: ${context.courseDescription || "Values education course."}`,
    context.lessonTitle ? `Lesson title: ${context.lessonTitle}` : "",
    context.lessonDescription ? `Lesson description: ${context.lessonDescription}` : "",
    context.pageTitle ? `Page title: ${context.pageTitle}` : "",
    context.pageSubtitle ? `Page subtitle: ${context.pageSubtitle}` : "",
    context.placementLabel ? `Placement: ${context.placementLabel}` : "",
    `Target usage: ${context.targetKind.replaceAll("_", " ")}`,
    `Asset brief: ${sanitizeText(asset.prompt, 2000, "Create an image that supports the teaching purpose.")}`,
    context.revisionFeedback ? `Reviewer requested media changes: ${sanitizeText(context.revisionFeedback, 2000)}` : "",
    asset.alt_text ? `Accessibility guidance: ${sanitizeText(asset.alt_text, 240)}` : "",
    asset.caption ? `Caption guidance: ${sanitizeText(asset.caption, 500)}` : "",
    "Safety and representation rules:",
    "- safe for learners aged roughly 16 to 35",
    "- non-sexual and non-graphic",
    "- non-political and not party propaganda",
    "- no public figures, logos, brands, copyrighted characters, or identifiable private people",


    "- African youth or community context where appropriate",
    ...getCompositionRules(asset, context),
  ];

  return lines.filter(Boolean).join("\n");
}

async function extractImageBytes(data: OpenAiImageResponse) {
  const first = Array.isArray(data.data) ? data.data[0] : null;
  if (!first) {
    throw new Error("The image provider returned no image data.");
  }

  if (typeof first.b64_json === "string" && first.b64_json.trim()) {
    return {
      bytes: Buffer.from(first.b64_json, "base64"),
      revisedPrompt: sanitizeText(first.revised_prompt, 2000) || null,
    };
  }

  if (typeof first.url === "string" && first.url.trim()) {
    const imageResponse = await fetch(first.url);
    if (!imageResponse.ok) {
      throw new Error("The generated image could not be downloaded from the provider.");
    }

    return {
      bytes: Buffer.from(await imageResponse.arrayBuffer()),
      revisedPrompt: sanitizeText(first.revised_prompt, 2000) || null,
    };
  }

  throw new Error("The image provider returned an unsupported image payload.");
}

export async function requestGeneratedImage(prompt: string, model: string, size: OpenAiImageSize) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to the server environment before generating media.");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    signal: AbortSignal.timeout(180_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      output_format: "png",
    }),
  });

  const payload = (await response.json()) as OpenAiImageResponse;
  if (!response.ok) {
    const message = sanitizeText(payload.error?.message, 500, "The image provider rejected the image generation request.");
    throw new Error(message);
  }

  return extractImageBytes(payload);
}

export async function generateLearningMediaImage(
  input: GenerateLearningMediaImageInput,
): Promise<GenerateLearningMediaImageResult> {
  const { asset, context, replaceExisting = false } = input;
  const metadata = asRecord(asset.metadata) ?? {};

  if (asset.url && !replaceExisting) {
    return {
      assetId: asset.id,
      status: "skipped",
      url: asset.url,
      storagePath: asset.storage_path,
      provider: asset.provider,
      model: asset.model,
      generatedAt: sanitizeText(metadata.generatedAt, 120) || null,
      replacedExisting: false,
      revisedPrompt: sanitizeText(metadata.revisedPrompt, 2000) || null,
    };
  }

  const bucket = getMediaBucket();
  if (!bucket) {
    throw new Error("LEARNING_MEDIA_BUCKET is missing. Add it to the server environment before generating media.");
  }

  const adminSupabase = createSupabaseAdminClient();
  const model = getImageModel();
  const provider = "openai";
  const generatedAt = new Date().toISOString();
  const originalPrompt = buildImagePrompt(asset, context);
  const size = getTargetSize(asset, context);
  const previousUrl = asset.url;
  const storagePath = buildStoragePath();

  const { error: runningError } = await adminSupabase
    .from("learning_media_assets")
    .update({
      generation_status: "running",
      generation_error: null,
    })
    .eq("id", asset.id);

  if (runningError) {
    throw runningError;
  }

  try {
    const generated = await requestGeneratedImage(originalPrompt, model, size);
    const uploadResult = await adminSupabase.storage.from(bucket).upload(storagePath, generated.bytes, {
      contentType: "image/png",
      upsert: false,
    });

    if (uploadResult.error) {
      throw new Error(
        /bucket/i.test(uploadResult.error.message)
          ? `Supabase storage bucket "${bucket}" is missing or unavailable. Create it before generating media.`
          : uploadResult.error.message,
      );
    }

    const { data: course, error: courseError } = await adminSupabase.from("courses").select("organization_id").eq("id", context.courseId).single();
    if (courseError || !course) throw new Error("Could not resolve generated media ownership.");
    const { data: registered, error: registerError } = await adminSupabase.rpc("service_register_media", {
      // SQL NULL denotes platform ownership.
      p_organization_id: course.organization_id as string,
      p_storage_path: storagePath,
      p_mime_type: "image/png",
      p_size: generated.bytes.byteLength,
      p_title: asset.placement,
      p_alt_text: asset.alt_text ?? "",
      p_rights_evidence: "Generated within Project VE; platform stock approval remains a separate rights review.",
    });
    if (registerError || !registered) {
      await adminSupabase.storage.from(bucket).remove([storagePath]);
      throw new Error(registerError?.message ?? "Could not register generated media.");
    }
    const publicUrl = (registered as { url: string }).url;

    const nextMetadata: JsonRecord = {
      ...metadata,
      provider,
      model,
      generatedAt,
      originalPrompt,
      revisedPrompt: generated.revisedPrompt,
      size,
      previousUrl,
      targetKind: context.targetKind,
      targetPageId: context.pageId ?? null,
      targetLessonId: context.lessonId ?? null,
    };

    const { error: updateError } = await adminSupabase
      .from("learning_media_assets")
      .update({
        url: publicUrl,
        storage_path: storagePath,
        source: "ai_generated",
        review_status: "draft",
        provider,
        model,
        generation_status: "completed",
        generation_error: null,
        metadata: asSupabaseJson(nextMetadata),
      })
      .eq("id", asset.id);

    if (updateError) {
      throw updateError;
    }

    return {
      assetId: asset.id,
      status: "generated",
      url: publicUrl,
      storagePath,
      provider,
      model,
      generatedAt,
      replacedExisting: Boolean(previousUrl),
      revisedPrompt: generated.revisedPrompt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";

    await adminSupabase
      .from("learning_media_assets")
      .update({
        generation_status: "failed",
        generation_error: message,
        metadata: {
          ...metadata,
          provider,
          model,
          originalPrompt,
          size,
          lastFailedAt: generatedAt,
          targetKind: context.targetKind,
          targetPageId: context.pageId ?? null,
          targetLessonId: context.lessonId ?? null,
        },
      })
      .eq("id", asset.id);

    throw new Error(message);
  }
}
