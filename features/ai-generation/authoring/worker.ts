import { processAuthoringImage } from "@/features/ai-generation/authoring/image-worker";
import "server-only";
import { processAuthoringCourse } from "./course-worker.ts";
import { processAuthoringAssistance } from "./assistance-worker.ts";
import { readPageAdvice } from "./page-assistant.ts";
import { normalizeMediaPlaceholder } from "@/lib/media-intent";

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAiLessonPageExtension, type AiLessonPageExtensionContext } from "@/lib/ai-learning-generator";
import type { AiGenerationClaim } from "@/features/ai-generation/data/jobs";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { logAppError } from "@/lib/app-errors";
import type { Database, Json } from "@/types/database";

export async function processAuthoringPage(supabase: SupabaseClient<Database>, job: AiGenerationClaim, workerId: string,
  generate = generateAiLessonPageExtension) {
  const checkpoint = async (action: string, candidate?: Json) => {
    const { data, error } = await supabase.rpc("service_ai_page_checkpoint", {
      p_job: job.id, p_worker: workerId, p_token: job.lock_token, p_version: job.lock_version,
      p_action: action, p_candidate: candidate,
    });
    if (error) throw error;
    return data;
  };
  try {
    if (generate === generateAiLessonPageExtension && !process.env.OPENAI_API_KEY) {
      throw new Error("Page generation is unavailable before provider dispatch.");
    }
    // Persists the provider-start boundary before making the only provider call.
    // Reclaimed leases cannot repeat an uncertain paid request.
    const context = await checkpoint("begin") as unknown as AiLessonPageExtensionContext;
    const page = await generate(context);
    const advice = context.assistant ? readPageAdvice(page, context.pageCount ?? context.existingPages.length, context.contextTruncated) : null;
    if (advice?.decision === "review_quiz") {
      await checkpoint("ready", page as unknown as Json);
      return { status: "completed" as const };
    }
    if (!page.blocks.some(block => ["text", "callout", "table"].includes(block.blockType))) throw new Error("A page needs teaching content alongside media placeholders.");
    for (const block of page.blocks) {
      if (!["text", "callout", "table"].includes(block.blockType)) {
        if (!context.mediaPlaceholders) throw new Error("This request does not include media placeholders.");
        block.payload = normalizeMediaPlaceholder(block.blockType, block.payload);
      }
      if (typeof block.payload.body === "string") block.payload.body = sanitizeRichTextHtml(block.payload.body, 6000);
    }
    await checkpoint("ready", page as unknown as Json);
    return { status: "completed" as const };
  } catch (error) {
    logAppError(error, { operation: "admin.ai_authoring.page", resourceId: job.id });
    // A stop may already have released the lease. The fenced failure call is
    // then harmlessly rejected; it cannot overwrite stopped/ready results.
    await checkpoint("failed").catch((failure) => logAppError(failure, { operation: "admin.ai_authoring.settle", resourceId: job.id }));
    return { status: "failed" as const };
  }
}

export async function dispatchAuthoringPage(supabase: SupabaseClient<Database>, operationId: string) {
  const workerId = `page-${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("service_claim_ai_page", { p_id: operationId, p_worker: workerId });
  if (error) throw error;
  const job = data?.[0];
  if (job) await ((job.prompt as Record<string, unknown>)?.mode === "authoring_image_v4" ? processAuthoringImage : job.prompt && (job.prompt as Record<string, unknown>).mode === "authoring_course_v3" ? processAuthoringCourse : job.prompt && (job.prompt as Record<string, unknown>).mode === "authoring_assistance_v2" ? processAuthoringAssistance : processAuthoringPage)(supabase, { ...job, prompt: job.prompt as Record<string, unknown>, lock_token: job.lock_token! }, workerId);
}
