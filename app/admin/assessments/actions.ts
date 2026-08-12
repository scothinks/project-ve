"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdminWorkspaceRole } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";

const ASSESSMENT_MANAGER_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
];

function parseOptionalUuid(value: FormDataEntryValue | null) {
  const raw = sanitizePlainTextInput(String(value ?? ""), 80);
  return raw || null;
}

function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonObject(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Scoring config must be a JSON object.");
  }

  return parsed;
}

function parseQuestionOptions(formData: FormData) {
  return [1, 2, 3, 4].map((position) => {
    const optionId = parseOptionalUuid(formData.get(`optionId:${position}`));
    const label = sanitizePlainTextInput(String(formData.get(`optionLabel:${position}`) ?? ""), 500);
    const description = sanitizePlainTextInput(String(formData.get(`optionDescription:${position}`) ?? ""), 1000);
    const sortOrder = parseInteger(formData.get(`optionSortOrder:${position}`), position);
    const weights = Object.fromEntries(
      formData
        .getAll("dimensionIds")
        .map((dimensionValue) => sanitizePlainTextInput(String(dimensionValue ?? ""), 80))
        .filter(Boolean)
        .map((dimensionId) => {
          const parsed = Number.parseFloat(String(formData.get(`optionWeight:${position}:${dimensionId}`) ?? "0"));
          return [dimensionId, Number.isFinite(parsed) ? Math.max(0, parsed) : 0] as const;
        }),
    );

    return {
      ...(optionId ? { id: optionId } : {}),
      description,
      label,
      sort_order: sortOrder,
      weights,
    };
  }).filter((option) => option.label.length > 0);
}

export async function createAssessmentRevision(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const sourceAssessmentVersionId = sanitizePlainTextInput(String(formData.get("sourceAssessmentVersionId") ?? ""), 80);
  const title = sanitizePlainTextInput(String(formData.get("title") ?? ""), 180);
  const slug = sanitizePlainTextInput(String(formData.get("slug") ?? ""), 120);
  const description = sanitizePlainTextInput(String(formData.get("description") ?? ""), 2000);
  const introductionCopy = sanitizePlainTextInput(String(formData.get("introductionCopy") ?? ""), 1000);
  const completionCopy = sanitizePlainTextInput(String(formData.get("completionCopy") ?? ""), 1000);
  const { supabase } = await requireAdminWorkspaceRole(ASSESSMENT_MANAGER_ROLES);

  const { data, error } = await supabase.rpc("admin_create_organization_assessment_revision", {
    p_completion_copy: completionCopy,
    p_description: description,
    p_introduction_copy: introductionCopy,
    p_organization_id: organizationId,
    p_slug: slug,
    p_source_assessment_version_id: sourceAssessmentVersionId,
    p_title: title,
  });

  if (error) {
    throw error;
  }

  const result = data as { assessmentVersionId?: string } | null;
  revalidatePath("/admin/assessments");
  redirect(
    appendAdminNotice(
      result?.assessmentVersionId ? `/admin/assessments/${result.assessmentVersionId}` : "/admin/assessments",
      "Assessment draft created.",
    ),
  );
}

export async function updateAssessmentOverview(formData: FormData) {
  const assessmentVersionId = sanitizePlainTextInput(String(formData.get("assessmentVersionId") ?? ""), 80);
  const title = sanitizePlainTextInput(String(formData.get("title") ?? ""), 180);
  const slug = sanitizePlainTextInput(String(formData.get("slug") ?? ""), 120);
  const description = sanitizePlainTextInput(String(formData.get("description") ?? ""), 2000);
  const introductionCopy = sanitizePlainTextInput(String(formData.get("introductionCopy") ?? ""), 1000);
  const completionCopy = sanitizePlainTextInput(String(formData.get("completionCopy") ?? ""), 1000);
  const scoringConfig = parseJsonObject(formData.get("scoringConfig"));
  const { supabase } = await requireAdminWorkspaceRole(ASSESSMENT_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_update_organization_assessment_overview", {
    p_assessment_version_id: assessmentVersionId,
    p_completion_copy: completionCopy,
    p_description: description,
    p_introduction_copy: introductionCopy,
    p_scoring_config: scoringConfig,
    p_slug: slug,
    p_title: title,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/assessments");
  revalidatePath(`/admin/assessments/${assessmentVersionId}`);
  redirect(appendAdminNotice(`/admin/assessments/${assessmentVersionId}`, "Assessment overview saved."));
}

export async function saveAssessmentQuestion(formData: FormData) {
  const assessmentVersionId = sanitizePlainTextInput(String(formData.get("assessmentVersionId") ?? ""), 80);
  const questionId = parseOptionalUuid(formData.get("questionId"));
  const prompt = sanitizePlainTextInput(String(formData.get("prompt") ?? ""), 1000);
  const helperText = sanitizePlainTextInput(String(formData.get("helperText") ?? ""), 1000);
  const sortOrder = parseInteger(formData.get("sortOrder"), 1);
  const { supabase } = await requireAdminWorkspaceRole(ASSESSMENT_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_upsert_organization_assessment_question", {
    p_assessment_version_id: assessmentVersionId,
    p_helper_text: helperText,
    p_options: parseQuestionOptions(formData),
    p_prompt: prompt,
    p_question_id: questionId,
    p_sort_order: sortOrder,
  });

  if (error) {
    throw error;
  }

  revalidatePath(`/admin/assessments/${assessmentVersionId}`);
  redirect(appendAdminNotice(`/admin/assessments/${assessmentVersionId}#questions`, "Question saved."));
}

export async function deleteAssessmentQuestion(formData: FormData) {
  const assessmentVersionId = sanitizePlainTextInput(String(formData.get("assessmentVersionId") ?? ""), 80);
  const questionId = sanitizePlainTextInput(String(formData.get("questionId") ?? ""), 80);
  const { supabase } = await requireAdminWorkspaceRole(ASSESSMENT_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_delete_organization_assessment_question", {
    p_question_id: questionId,
  });

  if (error) {
    throw error;
  }

  revalidatePath(`/admin/assessments/${assessmentVersionId}`);
  redirect(appendAdminNotice(`/admin/assessments/${assessmentVersionId}#questions`, "Question deleted."));
}

export async function publishAssessmentVersion(formData: FormData) {
  const assessmentVersionId = sanitizePlainTextInput(String(formData.get("assessmentVersionId") ?? ""), 80);
  const { supabase } = await requireAdminWorkspaceRole(ASSESSMENT_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_publish_organization_assessment_version", {
    p_assessment_version_id: assessmentVersionId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/assessments");
  revalidatePath(`/admin/assessments/${assessmentVersionId}`);
  redirect(appendAdminNotice(`/admin/assessments/${assessmentVersionId}`, "Assessment published."));
}
