"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requireAdminWorkspaceRole } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { Database } from "@/types/database";

type ContentStatus = Database["public"]["Enums"]["content_status"];
type ParticipationStatus = Database["public"]["Enums"]["lms_participation_status"];

const COHORT_MANAGER_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "instructor",
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

function normalizeStatus(value: FormDataEntryValue | null): ContentStatus {
  const status = String(value ?? "draft").trim();

  if (status === "published" || status === "archived") {
    return status;
  }

  return "draft";
}

function normalizeParticipationStatus(value: FormDataEntryValue | null): ParticipationStatus {
  const status = String(value ?? "active").trim();

  if (status === "completed" || status === "withdrawn") {
    return status;
  }

  return "active";
}

function getSelectedIds(formData: FormData, fieldName: string) {
  const ids = new Set<string>();

  for (const value of formData.getAll(fieldName)) {
    const id = sanitizePlainTextInput(String(value ?? ""), 160);
    if (id) ids.add(id);
  }

  return Array.from(ids);
}

function getPastedIds(formData: FormData, fieldName: string) {
  const raw = String(formData.get(fieldName) ?? "");
  const ids = new Set<string>();

  for (const candidate of raw.split(/[\s,]+/)) {
    const id = sanitizePlainTextInput(candidate, 160);
    if (id) ids.add(id);
  }

  return Array.from(ids);
}

function getCombinedUserIds(formData: FormData, checkboxField: string, pastedField: string) {
  return Array.from(new Set([...getSelectedIds(formData, checkboxField), ...getPastedIds(formData, pastedField)]));
}

function revalidateCohortPaths(cohortId?: string) {
  revalidatePath("/admin/cohorts");
  if (cohortId) {
    revalidatePath(`/admin/cohorts/${cohortId}`);
  }
}

export async function saveCohort(formData: FormData) {
  const cohortId = sanitizePlainTextInput(String(formData.get("cohortId") ?? ""), 80);
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const title = sanitizePlainTextInput(String(formData.get("title") ?? ""), 160);
  const slug = sanitizePlainTextInput(String(formData.get("slug") ?? ""), 90);
  const description = sanitizePlainTextInput(String(formData.get("description") ?? ""), 2000);
  const status = normalizeStatus(formData.get("status"));
  const memberUserIds = getCombinedUserIds(formData, "memberUserIds", "bulkMemberUserIds");
  const unitIds = getSelectedIds(formData, "unitIds");
  const { supabase } = await requireAdminWorkspaceRole(COHORT_MANAGER_ROLES);

  const { data, error } = await supabase.rpc("admin_upsert_cohort", {
    p_cohort_id: cohortId || null,
    p_description: description,
    p_ends_at: parseOptionalDateTime(formData.get("endsAt")),
    p_organization_id: organizationId,
    p_slug: slug,
    p_starts_at: parseOptionalDateTime(formData.get("startsAt")),
    p_status: status,
    p_title: title,
  });

  if (error) {
    throw error;
  }

  const result = data as { cohortId?: string } | null;
  const savedCohortId = result?.cohortId ?? cohortId;

  if (savedCohortId) {
    const [membersResult, unitsResult] = await Promise.all([
      supabase.rpc("admin_replace_cohort_members", {
        p_cohort_id: savedCohortId,
        p_user_ids: memberUserIds,
      }),
      supabase.rpc("admin_replace_cohort_units", {
        p_cohort_id: savedCohortId,
        p_unit_ids: unitIds,
      }),
    ]);

    if (membersResult.error) {
      throw membersResult.error;
    }
    if (unitsResult.error) {
      throw unitsResult.error;
    }
  }

  revalidateCohortPaths(savedCohortId);

  redirect(
    appendAdminNotice(
      savedCohortId ? `/admin/cohorts/${savedCohortId}` : "/admin/cohorts",
      cohortId ? "Cohort saved." : "Cohort created.",
    ),
  );
}

export async function assignCourseToAudience(formData: FormData) {
  const cohortId = sanitizePlainTextInput(String(formData.get("cohortId") ?? ""), 80);
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const courseId = sanitizePlainTextInput(String(formData.get("courseId") ?? ""), 160);
  const userIds = getCombinedUserIds(formData, "courseUserIds", "bulkCourseUserIds");
  const cohortIds = formData.get("assignCourseToCohort") === "on" && cohortId ? [cohortId] : [];
  const { supabase } = await requireAdminWorkspaceRole(COHORT_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_assign_course", {
    p_cohort_ids: cohortIds,
    p_course_id: courseId,
    p_due_at: parseOptionalDateTime(formData.get("courseDueAt")),
    p_organization_id: organizationId,
    p_user_ids: userIds,
  });

  if (error) {
    throw error;
  }

  revalidateCohortPaths(cohortId);

  redirect(appendAdminNotice(`/admin/cohorts/${cohortId}`, "Course assignment saved."));
}

export async function assignProgrammeToAudience(formData: FormData) {
  const cohortId = sanitizePlainTextInput(String(formData.get("cohortId") ?? ""), 80);
  const programmeId = sanitizePlainTextInput(String(formData.get("programmeId") ?? ""), 80);
  const userIds = getCombinedUserIds(formData, "programmeUserIds", "bulkProgrammeUserIds");
  const cohortIds = formData.get("assignProgrammeToCohort") === "on" && cohortId ? [cohortId] : [];
  const { supabase } = await requireAdminWorkspaceRole(COHORT_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_assign_programme", {
    p_cohort_ids: cohortIds,
    p_due_at: parseOptionalDateTime(formData.get("programmeDueAt")),
    p_intake_starts_at: parseOptionalDateTime(formData.get("programmeIntakeStartsAt")),
    p_programme_id: programmeId,
    p_user_ids: userIds,
  });

  if (error) {
    throw error;
  }

  revalidateCohortPaths(cohortId);

  redirect(appendAdminNotice(`/admin/cohorts/${cohortId}`, "Programme assignment saved."));
}

export async function updateEnrolmentStatus(formData: FormData) {
  const cohortId = sanitizePlainTextInput(String(formData.get("cohortId") ?? ""), 80);
  const enrolmentId = sanitizePlainTextInput(String(formData.get("enrolmentId") ?? ""), 80);
  const status = normalizeParticipationStatus(formData.get("status"));
  const { supabase } = await requireAdminWorkspaceRole(COHORT_MANAGER_ROLES);

  const { error } = await supabase.rpc("admin_update_enrolment_status", {
    p_enrolment_id: enrolmentId,
    p_status: status,
  });

  if (error) {
    throw error;
  }

  revalidateCohortPaths(cohortId);

  redirect(appendAdminNotice(`/admin/cohorts/${cohortId}`, "Enrolment status updated."));
}
