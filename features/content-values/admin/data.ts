import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentValueTag, ValueDimension } from "@/lib/values-assessment";

type AdminValueDimensionRow = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  status: "active" | "archived";
};

type AdminContentValueTagRow = {
  id: string;
  content_type: "course" | "lesson" | "mission";
  content_id: string;
  dimension_id: string;
  weight: number;
  recommended_level: "beginner" | "intermediate" | "advanced" | null;
  outcome_type: "awareness" | "reflection" | "practice" | "action" | "assessment" | null;
  created_at: string;
  updated_at: string;
};

export async function getAdminValueDimensions(supabase: SupabaseClient): Promise<ValueDimension[]> {
  const { data, error } = await supabase
    .from("value_dimensions")
    .select("id, label, description, sort_order, status")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AdminValueDimensionRow[]).map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    description: dimension.description,
    sortOrder: dimension.sort_order,
    status: dimension.status,
  }));
}

export async function getAdminContentValueTags(
  supabase: SupabaseClient,
  contentType: "course" | "lesson" | "mission",
  contentId: string,
): Promise<ContentValueTag[]> {
  const { data, error } = await supabase
    .from("content_value_tags")
    .select("id, content_type, content_id, dimension_id, weight, recommended_level, outcome_type, created_at, updated_at")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AdminContentValueTagRow[]).map((tag) => ({
    id: tag.id,
    contentType: tag.content_type,
    contentId: tag.content_id,
    dimensionId: tag.dimension_id,
    weight: Number(tag.weight),
    recommendedLevel: tag.recommended_level,
    outcomeType: tag.outcome_type,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at,
  }));
}
