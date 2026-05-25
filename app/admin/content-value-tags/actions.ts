"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

type ContentType = "course" | "lesson" | "mission";
type RecommendedLevel = "beginner" | "intermediate" | "advanced" | null;
type OutcomeType = "awareness" | "reflection" | "practice" | "action" | "assessment" | null;

function parseRedirectTo(value: FormDataEntryValue | null, fallback: string) {
  const next = sanitizePlainTextInput(String(value ?? ""), 400).trim();
  if (!next.startsWith("/")) {
    return fallback;
  }
  return next;
}

function parseContentType(value: FormDataEntryValue | null): ContentType {
  const parsed = sanitizePlainTextInput(String(value ?? ""), 32);
  if (parsed === "course" || parsed === "lesson" || parsed === "mission") {
    return parsed;
  }
  throw new Error("Unsupported content type.");
}

function parseWeight(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed < 0.1 || parsed > 1) {
    throw new Error("Weight must be between 0.1 and 1.");
  }
  return Number(parsed.toFixed(2));
}

function parseRecommendedLevel(value: FormDataEntryValue | null): RecommendedLevel {
  const parsed = sanitizePlainTextInput(String(value ?? ""), 32);
  if (!parsed) {
    return null;
  }
  if (parsed === "beginner" || parsed === "intermediate" || parsed === "advanced") {
    return parsed;
  }
  throw new Error("Recommended level is invalid.");
}

function parseOutcomeType(value: FormDataEntryValue | null): OutcomeType {
  const parsed = sanitizePlainTextInput(String(value ?? ""), 32);
  if (!parsed) {
    return null;
  }
  if (
    parsed === "awareness"
    || parsed === "reflection"
    || parsed === "practice"
    || parsed === "action"
    || parsed === "assessment"
  ) {
    return parsed;
  }
  throw new Error("Outcome type is invalid.");
}

async function assertActiveDimension(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  dimensionId: string,
) {
  const { data, error } = await supabase
    .from("value_dimensions")
    .select("id")
    .eq("id", dimensionId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Select an active value dimension.");
  }
}

async function assertContentExists(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  contentType: ContentType,
  contentId: string,
) {
  if (!contentId) {
    throw new Error("Content item is missing.");
  }

  const table =
    contentType === "course" ? "courses" : contentType === "lesson" ? "lessons" : "missions";
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", contentId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Content item not found.");
  }
}

function revalidateContentPaths(contentType: ContentType, contentId: string) {
  revalidatePath("/dashboard");

  if (contentType === "course") {
    revalidatePath(`/admin/courses/${contentId}`);
    revalidatePath("/courses");
    revalidatePath(`/courses/${contentId}`);
    return;
  }

  if (contentType === "lesson") {
    revalidatePath(`/admin/courses/lessons/${contentId}`);
    revalidatePath("/courses");
    revalidatePath(`/lessons/${contentId}`);
    return;
  }

  revalidatePath(`/admin/missions/${contentId}`);
  revalidatePath("/missions");
}

function redirectWithNotice(path: string, notice: string) {
  redirect(appendAdminNotice(path, notice));
}

export async function saveContentValueTag(formData: FormData) {
  const redirectTo = parseRedirectTo(formData.get("redirectTo"), "/admin");
  try {
    const { supabase } = await requireAdmin();
    const contentType = parseContentType(formData.get("contentType"));
    const contentId = sanitizePlainTextInput(String(formData.get("contentId") ?? ""), 120);
    const dimensionId = sanitizePlainTextInput(String(formData.get("dimensionId") ?? ""), 120);

    await assertContentExists(supabase, contentType, contentId);
    await assertActiveDimension(supabase, dimensionId);

    const { error } = await supabase
      .from("content_value_tags")
      .upsert({
        content_type: contentType,
        content_id: contentId,
        dimension_id: dimensionId,
        weight: parseWeight(formData.get("weight")),
        recommended_level: parseRecommendedLevel(formData.get("recommendedLevel")),
        outcome_type: parseOutcomeType(formData.get("outcomeType")),
      }, { onConflict: "content_type,content_id,dimension_id" });

    if (error) {
      throw error;
    }

    revalidateContentPaths(contentType, contentId);
    redirectWithNotice(redirectTo, "Value tag saved.");
  } catch (error) {
    redirectWithNotice(
      redirectTo,
      error instanceof Error ? error.message : "Could not save value tag.",
    );
  }
}

export async function updateContentValueTag(formData: FormData) {
  const redirectTo = parseRedirectTo(formData.get("redirectTo"), "/admin");
  try {
    const { supabase } = await requireAdmin();
    const tagId = sanitizePlainTextInput(String(formData.get("tagId") ?? ""), 120);
    const contentType = parseContentType(formData.get("contentType"));
    const contentId = sanitizePlainTextInput(String(formData.get("contentId") ?? ""), 120);

    if (!tagId) {
      throw new Error("Value tag not found.");
    }

    const { error } = await supabase
      .from("content_value_tags")
      .update({
        weight: parseWeight(formData.get("weight")),
        recommended_level: parseRecommendedLevel(formData.get("recommendedLevel")),
        outcome_type: parseOutcomeType(formData.get("outcomeType")),
      })
      .eq("id", tagId);

    if (error) {
      throw error;
    }

    revalidateContentPaths(contentType, contentId);
    redirectWithNotice(redirectTo, "Value tag updated.");
  } catch (error) {
    redirectWithNotice(
      redirectTo,
      error instanceof Error ? error.message : "Could not update value tag.",
    );
  }
}

export async function deleteContentValueTag(formData: FormData) {
  const redirectTo = parseRedirectTo(formData.get("redirectTo"), "/admin");
  try {
    const { supabase } = await requireAdmin();
    const tagId = sanitizePlainTextInput(String(formData.get("tagId") ?? ""), 120);
    const contentType = parseContentType(formData.get("contentType"));
    const contentId = sanitizePlainTextInput(String(formData.get("contentId") ?? ""), 120);

    if (!tagId) {
      throw new Error("Value tag not found.");
    }

    const { error } = await supabase
      .from("content_value_tags")
      .delete()
      .eq("id", tagId);

    if (error) {
      throw error;
    }

    revalidateContentPaths(contentType, contentId);
    redirectWithNotice(redirectTo, "Value tag removed.");
  } catch (error) {
    redirectWithNotice(
      redirectTo,
      error instanceof Error ? error.message : "Could not remove value tag.",
    );
  }
}
