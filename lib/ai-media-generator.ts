import "server-only";

import { Buffer } from "node:buffer";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
  targetKind: "course_cover" | "course_thumbnail" | "lesson_thumbnail" | "page_cover" | "asset_only";
};

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
  return sanitizeText(process.env.LEARNING_MEDIA_BUCKET ?? "learning-media", 120, "learning-media") || "learning-media";
}

function getBooleanMetadata(metadata: JsonRecord, key: string) {
  return metadata[key] === true;
}

function buildStoragePath(asset: LearningMediaAssetForGeneration, context: LearningMediaGenerationContext) {
  const assetId = asset.id;

  if (context.lessonId && context.pageId && context.targetKind === "page_cover") {
    return `courses/${context.courseId}/lessons/${context.lessonId}/pages/${context.pageId}/${assetId}.png`;
  }

  if (context.lessonId) {
    return `courses/${context.courseId}/lessons/${context.lessonId}/thumbnail/${assetId}.png`;
  }

  if (context.targetKind === "course_cover") {
    return `courses/${context.courseId}/cover/${assetId}.png`;
  }

  return `courses/${context.courseId}/thumbnail/${assetId}.png`;
}

function buildImagePrompt(asset: LearningMediaAssetForGeneration, context: LearningMediaGenerationContext) {
  const lines = [
    "Create one safe educational image.",
    `Course title: ${context.courseTitle}`,
    `Course category: ${context.courseCategory}`,
    `Course description: ${context.courseDescription || "Values education course."}`,
    context.lessonTitle ? `Lesson title: ${context.lessonTitle}` : "",
    context.lessonDescription ? `Lesson description: ${context.lessonDescription}` : "",
    context.pageTitle ? `Page title: ${context.pageTitle}` : "",
    context.pageSubtitle ? `Page subtitle: ${context.pageSubtitle}` : "",
    context.placementLabel ? `Placement: ${context.placementLabel}` : "",
    `Target usage: ${context.targetKind.replaceAll("_", " ")}`,
    `Asset brief: ${sanitizeText(asset.prompt, 2000, "Create a warm educational illustration.")}`,
    asset.alt_text ? `Accessibility guidance: ${sanitizeText(asset.alt_text, 240)}` : "",
    asset.caption ? `Caption guidance: ${sanitizeText(asset.caption, 500)}` : "",
    "Required style and safety rules:",
    "- safe for learners aged roughly 16 to 35",
    "- non-sexual and non-graphic",
    "- non-political and not party propaganda",
    "- no public figures, logos, brands, copyrighted characters, or identifiable private people",
    "- realistic or clean illustrated style",
    "- warm, modern educational illustration",
    "- African youth or community context where appropriate",
    "- simple composition, mobile-friendly framing",
    "- avoid visible text unless absolutely necessary",
    "- do not make the image text-heavy",
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

async function requestGeneratedImage(prompt: string, model: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to the server environment before generating media.");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: "1024x1024",
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
  const isStale = getBooleanMetadata(metadata, "stale");

  if (asset.url && !replaceExisting && !isStale) {
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
  const previousUrl = asset.url;
  const storagePath = buildStoragePath(asset, context);

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
    const generated = await requestGeneratedImage(originalPrompt, model);
    const uploadResult = await adminSupabase.storage.from(bucket).upload(storagePath, generated.bytes, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadResult.error) {
      throw new Error(
        /bucket/i.test(uploadResult.error.message)
          ? `Supabase storage bucket "${bucket}" is missing or unavailable. Create it before generating media.`
          : uploadResult.error.message,
      );
    }

    const publicUrlResult = adminSupabase.storage.from(bucket).getPublicUrl(storagePath);
    const publicUrl = sanitizeText(publicUrlResult.data.publicUrl, 1000);
    if (!publicUrl) {
      throw new Error(`A public URL could not be created for storage bucket "${bucket}".`);
    }

    const nextMetadata: JsonRecord = {
      ...metadata,
      provider,
      model,
      generatedAt,
      originalPrompt,
      revisedPrompt: generated.revisedPrompt,
      stale: false,
      staleAt: null,
      staleReason: null,
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
        metadata: nextMetadata,
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
          lastFailedAt: generatedAt,
          stale: false,
          targetKind: context.targetKind,
          targetPageId: context.pageId ?? null,
          targetLessonId: context.lessonId ?? null,
        },
      })
      .eq("id", asset.id);

    throw new Error(message);
  }
}
