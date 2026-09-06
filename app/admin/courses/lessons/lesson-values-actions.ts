"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { PERSONALIZED_RECOMMENDATION_EDITORIAL_CACHE_TAG } from "@/features/recommendations/data/editorial-cache";
import { parseLessonValueChoices } from "@/features/learning/admin/lesson-values-domain";

export async function saveLessonValues(lessonId: string, input: unknown, removedIds: unknown): Promise<{ error?: string }> {
  let wroteChanges = false;
  try {
    const { supabase } = await requireAdmin();
    if (typeof lessonId !== "string" || !lessonId || lessonId.length > 120) throw new Error("Lesson not found.");
    const choices = parseLessonValueChoices(input);
    if (!Array.isArray(removedIds) || removedIds.length > 100 || removedIds.some((id) => typeof id !== "string" || !id || id.length > 120)) {
      throw new Error("Could not read the values to remove.");
    }
    const selectedIds = choices.map((choice) => choice.dimensionId);
    if (removedIds.some((id) => selectedIds.includes(id))) throw new Error("A value cannot be selected and removed together.");
    const [lesson, dimensions, existing] = await Promise.all([
      supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle(),
      supabase.from("value_dimensions").select("id, status").in("id", selectedIds),
      supabase.from("content_value_tags").select("dimension_id").eq("content_type", "lesson").eq("content_id", lessonId),
    ]);
    if (lesson.error) throw lesson.error;
    if (!lesson.data) throw new Error("Lesson not found.");
    if (dimensions.error) throw dimensions.error;
    if (existing.error) throw existing.error;
    const allowedIds = new Set(dimensions.data.filter((dimension) => dimension.status === "active" || existing.data.some((tag) => tag.dimension_id === dimension.id)).map((dimension) => dimension.id));
    if (selectedIds.some((id) => !allowedIds.has(id))) throw new Error("A selected value is no longer available. Refresh the page and choose another.");
    if (choices.length) {
      const { error } = await supabase.from("content_value_tags").upsert(choices.map((choice) => ({
        content_type: "lesson" as const, content_id: lessonId, dimension_id: choice.dimensionId,
        weight: choice.weight, recommended_level: choice.recommendedLevel, outcome_type: choice.outcomeType,
      })), { onConflict: "content_type,content_id,dimension_id" });
      if (error) throw error;
      wroteChanges = true;
    }
    if (removedIds.length) {
      // Remove only choices explicitly removed in this editor, preserving concurrent additions.
      const { error } = await supabase.from("content_value_tags").delete()
        .eq("content_type", "lesson").eq("content_id", lessonId).in("dimension_id", removedIds);
      if (error) throw error;
      wroteChanges = true;
    }
    return {};
  } catch (error) {
    unstable_rethrow(error);
    // Both writes are idempotent. Keep the draft in the browser so a failed second write can be retried.
    return { error: wroteChanges ? "Some changes saved, but we couldn’t finish. Your choices are still here. Please try again." : "We couldn’t save your choices. They’re still here. Please try again." };
  } finally {
    if (wroteChanges) {
      revalidateTag(PERSONALIZED_RECOMMENDATION_EDITORIAL_CACHE_TAG);
      revalidatePath("/dashboard");
      revalidatePath(`/admin/courses/lessons/${lessonId}/values`);
      revalidatePath(`/admin/courses/lessons/${lessonId}/preview`);
    }
  }
}
