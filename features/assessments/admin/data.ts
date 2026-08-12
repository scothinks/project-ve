import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSelectedAdminWorkspaceId } from "@/features/admin/application/context";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";
import type { OrganizationAssessmentCapability } from "@/features/organizations/entitlements";
import type { Database } from "@/types/database";

export type AdminAssessmentVersionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  xp_award: number;
  status: string;
  created_at: string;
  published_at: string | null;
  owner_scope: "platform" | "organization";
  organization_id: string | null;
  source_assessment_version_id: string | null;
  version_number: number;
  introduction_copy: string;
  completion_copy: string;
  scoring_config: Record<string, unknown>;
};

export type AdminAssessmentQuestionRow = {
  id: string;
  assessment_version_id: string;
  prompt: string;
  helper_text: string | null;
  question_type: string;
  sort_order: number;
  created_at: string;
  options: AdminAssessmentOptionRow[];
};

export type AdminAssessmentOptionRow = {
  id: string;
  question_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  weights: Record<string, number>;
};

export type AdminAssessmentUsageRow = {
  programme_id: string;
  assessment_version_id: string;
  sort_order: number;
  is_required: boolean;
  programme?: {
    id: string;
    title: string;
    slug: string;
    status: string;
    organization_id: string;
  } | null;
};

export type AdminAssessmentVersionSummary = AdminAssessmentVersionRow & {
  question_count: number;
  usage_count: number;
};

export type AdminAssessmentWorkspace = {
  assessment: AdminAssessmentVersionRow;
  assessmentCapability: OrganizationAssessmentCapability;
  canAdapt: boolean;
  canEditDraft: boolean;
  questions: AdminAssessmentQuestionRow[];
  sourceAssessment: Pick<AdminAssessmentVersionRow, "id" | "title" | "slug" | "version_number"> | null;
  usage: AdminAssessmentUsageRow[];
  valueDimensions: AdminAssessmentValueDimensionRow[];
  versionHistory: AdminAssessmentVersionRow[];
};

export type AdminAssessmentValueDimensionRow = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  status: string;
};

function canAdaptAssessment(capability: OrganizationAssessmentCapability) {
  return capability === "template_adaptation" || capability === "custom";
}

async function getWorkspaceAssessmentCapability(
  supabase: SupabaseClient<Database>,
  organizationId: string | null | undefined,
): Promise<OrganizationAssessmentCapability> {
  if (!organizationId) {
    return "custom";
  }

  const { entitlements } = await resolveOrganizationEntitlements(supabase, organizationId);
  return entitlements.assessmentCapability;
}

function normalizeAssessment(row: AdminAssessmentVersionRow): AdminAssessmentVersionRow {
  return {
    ...row,
    scoring_config: row.scoring_config ?? {},
  };
}

export async function getAdminAssessmentVersions(
  supabase: SupabaseClient<Database>,
): Promise<{
  assessmentCapability: OrganizationAssessmentCapability;
  assessments: AdminAssessmentVersionSummary[];
  selectedOrganizationId: string | null;
}> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  const selectedOrganizationId = selectedWorkspaceId === "platform" ? null : selectedWorkspaceId;
  const assessmentCapability = await getWorkspaceAssessmentCapability(supabase, selectedOrganizationId);

  let query = supabase
    .from("assessment_versions")
    .select("id, slug, title, description, xp_award, status, created_at, published_at, owner_scope, organization_id, source_assessment_version_id, version_number, introduction_copy, completion_copy, scoring_config")
    .order("created_at", { ascending: false });

  if (selectedOrganizationId) {
    query = query.or(`owner_scope.eq.platform,organization_id.eq.${selectedOrganizationId}`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const assessments = ((data ?? []) as AdminAssessmentVersionRow[]).map(normalizeAssessment);
  const assessmentIds = assessments.map((assessment) => assessment.id);

  if (assessmentIds.length === 0) {
    return { assessmentCapability, assessments: [], selectedOrganizationId };
  }

  const [questionsResult, usageResult] = await Promise.all([
    supabase
      .from("assessment_questions")
      .select("assessment_version_id")
      .in("assessment_version_id", assessmentIds),
    supabase
      .from("programme_assessments")
      .select("assessment_version_id")
      .in("assessment_version_id", assessmentIds),
  ]);

  if (questionsResult.error) throw questionsResult.error;
  if (usageResult.error) throw usageResult.error;

  const questionCounts = new Map<string, number>();
  for (const question of (questionsResult.data ?? []) as Array<{ assessment_version_id: string }>) {
    questionCounts.set(question.assessment_version_id, (questionCounts.get(question.assessment_version_id) ?? 0) + 1);
  }

  const usageCounts = new Map<string, number>();
  for (const usage of (usageResult.data ?? []) as Array<{ assessment_version_id: string }>) {
    usageCounts.set(usage.assessment_version_id, (usageCounts.get(usage.assessment_version_id) ?? 0) + 1);
  }

  return {
    assessmentCapability,
    assessments: assessments.map((assessment) => ({
      ...assessment,
      question_count: questionCounts.get(assessment.id) ?? 0,
      usage_count: usageCounts.get(assessment.id) ?? 0,
    })),
    selectedOrganizationId,
  };
}

export async function getAdminAssessmentWorkspace(
  supabase: SupabaseClient<Database>,
  assessmentVersionId: string,
): Promise<AdminAssessmentWorkspace | null> {
  const { data, error } = await supabase
    .from("assessment_versions")
    .select("id, slug, title, description, xp_award, status, created_at, published_at, owner_scope, organization_id, source_assessment_version_id, version_number, introduction_copy, completion_copy, scoring_config")
    .eq("id", assessmentVersionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const assessment = normalizeAssessment(data as AdminAssessmentVersionRow);
  const assessmentCapability = await getWorkspaceAssessmentCapability(supabase, assessment.organization_id);
  const canAdapt = Boolean(assessment.organization_id) && canAdaptAssessment(assessmentCapability);
  const canEditDraft = canAdapt && assessment.owner_scope === "organization" && assessment.status === "draft";

  const [questionsResult, optionsResult, weightsResult, usageResult, dimensionsResult, sourceResult, historyResult] = await Promise.all([
    supabase
      .from("assessment_questions")
      .select("id, assessment_version_id, prompt, helper_text, question_type, sort_order, created_at")
      .eq("assessment_version_id", assessmentVersionId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("assessment_question_options")
      .select("id, question_id, label, description, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("assessment_option_dimension_weights")
      .select("option_id, dimension_id, weight"),
    supabase
      .from("programme_assessments")
      .select("programme_id, assessment_version_id, sort_order, is_required, programmes!programme_assessments_programme_id_fkey(id, title, slug, status, organization_id)")
      .eq("assessment_version_id", assessmentVersionId),
    supabase
      .from("value_dimensions")
      .select("id, label, description, sort_order, status")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    assessment.source_assessment_version_id
      ? supabase
        .from("assessment_versions")
        .select("id, title, slug, version_number")
        .eq("id", assessment.source_assessment_version_id)
        .maybeSingle()
      : { data: null, error: null },
    supabase
      .from("assessment_versions")
      .select("id, slug, title, description, xp_award, status, created_at, published_at, owner_scope, organization_id, source_assessment_version_id, version_number, introduction_copy, completion_copy, scoring_config")
      .or(`id.eq.${assessment.source_assessment_version_id ?? assessment.id},source_assessment_version_id.eq.${assessment.source_assessment_version_id ?? assessment.id}`)
      .order("version_number", { ascending: false }),
  ]);

  if (questionsResult.error) throw questionsResult.error;
  if (optionsResult.error) throw optionsResult.error;
  if (weightsResult.error) throw weightsResult.error;
  if (usageResult.error) throw usageResult.error;
  if (dimensionsResult.error) throw dimensionsResult.error;
  if (sourceResult.error) throw sourceResult.error;
  if (historyResult.error) throw historyResult.error;

  const questionRows = (questionsResult.data ?? []) as Omit<AdminAssessmentQuestionRow, "options">[];
  const questionIds = new Set(questionRows.map((question) => question.id));
  const weightsByOptionId = new Map<string, Record<string, number>>();

  for (const weight of (weightsResult.data ?? []) as Array<{ option_id: string; dimension_id: string; weight: number }>) {
    const weights = weightsByOptionId.get(weight.option_id) ?? {};
    weights[weight.dimension_id] = Number(weight.weight);
    weightsByOptionId.set(weight.option_id, weights);
  }

  const optionsByQuestionId = new Map<string, AdminAssessmentOptionRow[]>();
  for (const option of ((optionsResult.data ?? []) as Array<Omit<AdminAssessmentOptionRow, "weights">>).filter((item) => questionIds.has(item.question_id))) {
    const options = optionsByQuestionId.get(option.question_id) ?? [];
    options.push({
      ...option,
      weights: weightsByOptionId.get(option.id) ?? {},
    });
    optionsByQuestionId.set(option.question_id, options);
  }

  return {
    assessment,
    assessmentCapability,
    canAdapt,
    canEditDraft,
    questions: questionRows.map((question) => ({
      ...question,
      options: optionsByQuestionId.get(question.id) ?? [],
    })),
    sourceAssessment: sourceResult.data as AdminAssessmentWorkspace["sourceAssessment"],
    usage: ((usageResult.data ?? []) as Array<AdminAssessmentUsageRow & { programmes?: AdminAssessmentUsageRow["programme"] | AdminAssessmentUsageRow["programme"][] }>).map((usage) => ({
      ...usage,
      programme: Array.isArray(usage.programmes) ? usage.programmes[0] ?? null : usage.programmes ?? null,
    })),
    valueDimensions: (dimensionsResult.data ?? []) as AdminAssessmentValueDimensionRow[],
    versionHistory: ((historyResult.data ?? []) as AdminAssessmentVersionRow[]).map(normalizeAssessment),
  };
}
