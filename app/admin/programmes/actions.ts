"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdminWorkspaceRole } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { Database } from "@/types/database";

type ContentStatus = Database["public"]["Enums"]["content_status"];

const PROGRAMME_MANAGER_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
];

function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function parseNonNegativeInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeStatus(value: FormDataEntryValue | null): ContentStatus {
  const status = String(value ?? "draft").trim();

  if (status === "published" || status === "archived") {
    return status;
  }

  return "draft";
}

function getSortedSelectedIds(formData: FormData, fieldName: string) {
  const seen = new Set<string>();

  return formData
    .getAll(fieldName)
    .map((value, index) => {
      const id = sanitizePlainTextInput(String(value ?? ""), 160);
      const order = parseNonNegativeInteger(formData.get(`${fieldName}Order:${id}`));

      return { id, index, order: order ?? Number.MAX_SAFE_INTEGER };
    })
    .filter((item) => {
      if (!item.id || seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      return true;
    })
    .sort((first, second) => first.order - second.order || first.index - second.index)
    .map((item) => item.id);
}

function parsePercentage(value: FormDataEntryValue | null, fallback: number) {
  const parsed = parseNonNegativeInteger(value);

  if (parsed === null) {
    return fallback;
  }

  return Math.min(100, parsed);
}

function parseCompletionRuleConfig(formData: FormData) {
  const requiredFinalAssessmentVersionId = sanitizePlainTextInput(
    String(formData.get("requiredFinalAssessmentVersionId") ?? ""),
    80,
  );
  const minimumCompletionThreshold = parsePercentage(formData.get("minimumCompletionThreshold"), 100);

  return {
    minimumCompletionThreshold,
    requiredFinalAssessmentVersionId: requiredFinalAssessmentVersionId || null,
  };
}

export async function saveProgramme(formData: FormData) {
  const programmeId = sanitizePlainTextInput(String(formData.get("programmeId") ?? ""), 80);
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const title = sanitizePlainTextInput(String(formData.get("title") ?? ""), 160);
  const slug = sanitizePlainTextInput(String(formData.get("slug") ?? ""), 90);
  const objective = sanitizePlainTextInput(String(formData.get("objective") ?? ""), 2000);
  const intendedAudience = sanitizePlainTextInput(String(formData.get("intendedAudience") ?? ""), 2000);
  const status = normalizeStatus(formData.get("status"));
  const courseIds = getSortedSelectedIds(formData, "courseIds");
  const missionIds = getSortedSelectedIds(formData, "missionIds");
  const rewardIds = getSortedSelectedIds(formData, "rewardIds");
  const assessmentVersionIds = getSortedSelectedIds(formData, "assessmentVersionIds");
  const completionRuleConfig = parseCompletionRuleConfig(formData);
  const { supabase } = await requireAdminWorkspaceRole(PROGRAMME_MANAGER_ROLES);

  const { data, error } = await supabase.rpc("admin_upsert_programme", {
    p_assessment_version_ids: assessmentVersionIds,
    p_completion_rules: {
      minimumCompletionThreshold: completionRuleConfig.minimumCompletionThreshold,
      requiredCourseIds: courseIds,
      requiredFinalAssessmentVersionId: completionRuleConfig.requiredFinalAssessmentVersionId,
      requiredMissionIds: missionIds,
    },
    p_course_ids: courseIds,
    p_intended_audience: intendedAudience,
    p_mission_ids: missionIds,
    p_objective: objective,
    p_organization_id: organizationId,
    p_programme_id: programmeId || null,
    p_reward_ids: rewardIds,
    p_schedule_ends_at: parseOptionalDateTime(formData.get("scheduleEndsAt")),
    p_schedule_starts_at: parseOptionalDateTime(formData.get("scheduleStartsAt")),
    p_slug: slug,
    p_status: status,
    p_title: title,
  });

  if (error) {
    throw error;
  }

  const result = data as { programmeId?: string } | null;
  const savedProgrammeId = result?.programmeId ?? programmeId;

  if (savedProgrammeId) {
    const { error: completionRulesError } = await supabase.rpc("admin_upsert_programme_completion_rules", {
      p_minimum_completion_threshold: completionRuleConfig.minimumCompletionThreshold,
      p_programme_id: savedProgrammeId,
      p_required_course_ids: courseIds,
      p_required_final_assessment_version_id: completionRuleConfig.requiredFinalAssessmentVersionId,
      p_required_mission_ids: missionIds,
    });

    if (completionRulesError) {
      throw completionRulesError;
    }
  }

  revalidatePath("/admin/programmes");
  if (savedProgrammeId) {
    revalidatePath(`/admin/programmes/${savedProgrammeId}`);
  }

  redirect(
    appendAdminNotice(
      savedProgrammeId ? `/admin/programmes/${savedProgrammeId}` : "/admin/programmes",
      programmeId ? "Programme saved." : "Programme created.",
    ),
  );
}

export async function setProgrammeStatus(formData: FormData) {
  const programmeId = sanitizePlainTextInput(String(formData.get("programmeId") ?? ""), 80);
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? "/admin/programmes"), 400);
  const status = normalizeStatus(formData.get("status"));
  const { supabase } = await requireAdminWorkspaceRole(PROGRAMME_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_set_programme_status", {
    p_programme_id: programmeId,
    p_status: status,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/programmes");
  revalidatePath(`/admin/programmes/${programmeId}`);

  redirect(
    appendAdminNotice(
      redirectTo,
      status === "published" ? "Programme published." : "Programme moved to draft.",
    ),
  );
}
