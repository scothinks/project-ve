"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdminWorkspaceRole } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { Database } from "@/types/database";

type InterventionSeverity = Database["public"]["Enums"]["lms_intervention_severity"];
type InterventionStatus = Database["public"]["Enums"]["lms_intervention_status"];
type InterventionType = Database["public"]["Enums"]["lms_intervention_type"];

const INSTRUCTOR_ACTION_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "instructor",
];

const PROOF_ACTION_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "reviewer",
  "instructor",
];

function safeRedirect(value: string) {
  return value.startsWith("/admin/instructor") ? value : "/admin/instructor";
}

function normalizeInterventionStatus(value: FormDataEntryValue | null): InterventionStatus {
  const status = String(value ?? "open");
  if (status === "acknowledged" || status === "resolved" || status === "dismissed") {
    return status;
  }

  return "open";
}

function normalizeInterventionType(value: FormDataEntryValue | null): InterventionType {
  const type = String(value ?? "inactive");
  if (type === "upcoming_due" || type === "overdue") {
    return type;
  }

  return "inactive";
}

function normalizeSeverity(value: FormDataEntryValue | null): InterventionSeverity {
  const severity = String(value ?? "warning");
  if (severity === "info" || severity === "critical") {
    return severity;
  }

  return "warning";
}

function selectedUserIds(formData: FormData) {
  return Array.from(new Set(
    formData
      .getAll("userIds")
      .map((value) => sanitizePlainTextInput(String(value ?? ""), 80))
      .filter(Boolean),
  ));
}

export async function sendInstructorReminder(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const unitId = sanitizePlainTextInput(String(formData.get("unitId") ?? ""), 80);
  const title = sanitizePlainTextInput(String(formData.get("title") ?? ""), 120);
  const body = sanitizePlainTextInput(String(formData.get("body") ?? ""), 500);
  const redirectTo = safeRedirect(String(formData.get("redirectTo") ?? ""));
  const { supabase } = await requireAdminWorkspaceRole(INSTRUCTOR_ACTION_ROLES);
  const { error } = await supabase.rpc("admin_send_instructor_scoped_notification", {
    p_body: body,
    p_cta_href: "/notifications",
    p_organization_id: organizationId,
    p_title: title,
    p_unit_id: unitId || null,
    p_user_ids: selectedUserIds(formData),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/instructor");
  revalidatePath("/notifications");
  redirect(appendAdminNotice(redirectTo, "Reminder sent."));
}

export async function createInstructorIntervention(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const userId = sanitizePlainTextInput(String(formData.get("userId") ?? ""), 80);
  const programmeId = sanitizePlainTextInput(String(formData.get("programmeId") ?? ""), 80);
  const cohortId = sanitizePlainTextInput(String(formData.get("cohortId") ?? ""), 80);
  const reason = sanitizePlainTextInput(String(formData.get("reason") ?? ""), 500);
  const redirectTo = safeRedirect(String(formData.get("redirectTo") ?? ""));
  const { supabase } = await requireAdminWorkspaceRole(INSTRUCTOR_ACTION_ROLES);
  const { error } = await supabase.rpc("admin_create_instructor_intervention", {
    p_cohort_id: cohortId || null,
    p_intervention_type: normalizeInterventionType(formData.get("type")),
    p_organization_id: organizationId,
    p_programme_id: programmeId || null,
    p_reason: reason,
    p_severity: normalizeSeverity(formData.get("severity")),
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/instructor");
  revalidatePath("/admin/interventions");
  redirect(appendAdminNotice(redirectTo, "Intervention opened."));
}

export async function updateInstructorInterventionStatus(formData: FormData) {
  const interventionId = sanitizePlainTextInput(String(formData.get("interventionId") ?? ""), 80);
  const note = sanitizePlainTextInput(String(formData.get("note") ?? ""), 500);
  const redirectTo = safeRedirect(String(formData.get("redirectTo") ?? ""));
  const { supabase } = await requireAdminWorkspaceRole(INSTRUCTOR_ACTION_ROLES);
  const { error } = await supabase.rpc("admin_update_lms_intervention_status", {
    p_intervention_id: interventionId,
    p_note: note || null,
    p_status: normalizeInterventionStatus(formData.get("status")),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/instructor");
  revalidatePath("/admin/interventions");
  redirect(appendAdminNotice(redirectTo, "Intervention updated."));
}

export async function reviewInstructorProofSubmission(formData: FormData) {
  const userId = sanitizePlainTextInput(String(formData.get("userId") ?? ""), 80);
  const missionId = sanitizePlainTextInput(String(formData.get("missionId") ?? ""), 160);
  const awardScope = sanitizePlainTextInput(String(formData.get("awardScope") ?? ""), 200);
  const status = String(formData.get("status") ?? "") === "rejected" ? "rejected" : "approved";
  const rejectionReason = sanitizePlainTextInput(String(formData.get("rejectionReason") ?? ""), 500);
  const redirectTo = safeRedirect(String(formData.get("redirectTo") ?? ""));
  const { supabase } = await requireAdminWorkspaceRole(PROOF_ACTION_ROLES);
  const { error } = await supabase.rpc("admin_review_mission_proof_submission", {
    p_award_scope: awardScope,
    p_mission_id: missionId,
    p_rejection_reason: rejectionReason || null,
    p_status: status,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/instructor");
  revalidatePath("/admin/proofs");
  revalidatePath("/admin/xp-ledger");
  redirect(appendAdminNotice(redirectTo, status === "approved" ? "Evidence approved." : "Evidence rejected."));
}
