import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const VALUES_STARTER_CHECK_SLUG = "values-starter-check-v1";

export type ValueDimension = {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
  status: "active" | "archived";
};

export type ContentValueTag = {
  id: string;
  contentType: "course" | "lesson" | "mission";
  contentId: string;
  dimensionId: string;
  weight: number;
  recommendedLevel: "beginner" | "intermediate" | "advanced" | null;
  outcomeType: "awareness" | "reflection" | "practice" | "action" | "assessment" | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UserValueProfile = {
  userId: string;
  latestAttemptId: string | null;
  assessmentVersionId: string | null;
  assessmentCompletedAt: string | null;
  readinessLevel: "beginner" | "intermediate" | "advanced";
  primaryDimensionId: string | null;
  secondaryDimensionId: string | null;
  profileSummary: Record<string, unknown>;
  updatedAt: string;
};

export type UserValueDimensionScore = {
  userId: string;
  dimensionId: string;
  score: number;
  confidence: number;
  updatedAt: string;
};

type AssessmentVersionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  xp_award: number;
};

type AssessmentOptionRow = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
};

type AssessmentQuestionRow = {
  id: string;
  prompt: string;
  helper_text: string | null;
  sort_order: number;
  assessment_question_options?: AssessmentOptionRow[] | null;
};

type UserValueProfileStatusRow = {
  assessment_completed_at: string | null;
};

type ValueDimensionRow = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  status: "active" | "archived";
};

export type ValuesAssessmentOption = {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

export type ValuesAssessmentQuestion = {
  id: string;
  prompt: string;
  helperText: string | null;
  sortOrder: number;
  options: ValuesAssessmentOption[];
};

export type PublishedValuesAssessment = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  xpAward: number;
  questions: ValuesAssessmentQuestion[];
};

export async function getPublishedValuesAssessment(
  supabase: SupabaseClient | null,
  slug = VALUES_STARTER_CHECK_SLUG,
): Promise<PublishedValuesAssessment | null> {
  if (!supabase) {
    return null;
  }

  const { data: version, error: versionError } = await supabase
    .from("assessment_versions")
    .select("id, slug, title, description, xp_award")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<AssessmentVersionRow>();

  if (versionError || !version) {
    return null;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("assessment_questions")
    .select(
      "id, prompt, helper_text, sort_order, assessment_question_options(id, label, description, sort_order)",
    )
    .eq("assessment_version_id", version.id)
    .order("sort_order", { ascending: true })
    .returns<AssessmentQuestionRow[]>();

  if (questionsError) {
    return null;
  }

  return {
    id: version.id,
    slug: version.slug,
    title: version.title,
    description: version.description,
    xpAward: version.xp_award,
    questions: (questions ?? []).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      helperText: question.helper_text,
      sortOrder: question.sort_order,
      options: (question.assessment_question_options ?? [])
        .slice()
        .sort((first, second) => first.sort_order - second.sort_order)
        .map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          sortOrder: option.sort_order,
        })),
    })),
  };
}

export async function getUserAssessmentCompletionStatus(
  supabase: SupabaseClient | null,
  userId: string,
) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_value_profiles")
    .select("assessment_completed_at")
    .eq("user_id", userId)
    .maybeSingle<UserValueProfileStatusRow>();

  if (error) {
    return null;
  }

  return data;
}

export async function getActiveValueDimensions(supabase: SupabaseClient | null): Promise<ValueDimension[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("value_dimensions")
    .select("id, label, description, sort_order, status")
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .returns<ValueDimensionRow[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    description: dimension.description,
    sortOrder: dimension.sort_order,
    status: dimension.status,
  }));
}

export function learnerNeedsValuesAssessment(input: {
  role?: "learner" | "admin" | null;
  assessmentCompletedAt?: string | null;
}) {
  return input.role !== "admin" && !input.assessmentCompletedAt;
}

export function getValuesAssessmentErrorMessage(message?: string | null) {
  if (!message) {
    return "We could not save your answers. Please try again.";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("please answer every question")) {
    return "Please answer every question before continuing.";
  }

  if (
    normalized.includes("not available")
    || normalized.includes("not ready")
    || normalized.includes("invalid")
    || normalized.includes("do not match")
  ) {
    return "We could not save your answers. Please refresh and try again.";
  }

  return "We could not save your answers. Please try again.";
}
