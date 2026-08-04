"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requirePlatformAdmin } from "@/features/admin/application/context";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { Database } from "@/types/database";

type ContentStatus = Database["public"]["Enums"]["content_status"];
type OrganizationMembershipStatus = Database["public"]["Enums"]["organization_membership_status"];
type OrganizationRoleKey = Database["public"]["Enums"]["organization_role_key"];

const ORGANIZATION_ROLES: OrganizationRoleKey[] = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
  "reviewer",
  "instructor",
  "report_viewer",
  "learner",
];

function normalizeContentStatus(value: FormDataEntryValue | null): ContentStatus {
  const status = String(value ?? "draft");
  return status === "published" || status === "archived" ? status : "draft";
}

function normalizeMembershipStatus(value: FormDataEntryValue | null): OrganizationMembershipStatus {
  const status = String(value ?? "active");
  if (status === "invited" || status === "suspended" || status === "removed") {
    return status;
  }

  return "active";
}

function normalizeRole(value: FormDataEntryValue | null): OrganizationRoleKey {
  const role = String(value ?? "learner");
  return ORGANIZATION_ROLES.includes(role as OrganizationRoleKey)
    ? role as OrganizationRoleKey
    : "learner";
}

export async function saveOrganization(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const name = sanitizePlainTextInput(String(formData.get("name") ?? ""), 160);
  const slug = sanitizePlainTextInput(String(formData.get("slug") ?? ""), 90);
  const status = normalizeContentStatus(formData.get("status"));
  const { supabase } = await requirePlatformAdmin();

  const { error } = await supabase.rpc("admin_upsert_organization", {
    p_name: name,
    p_organization_id: organizationId || null,
    p_slug: slug,
    p_status: status,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/organizations");
  redirect(appendAdminNotice("/admin/organizations", organizationId ? "Organisation updated." : "Organisation created."));
}

export async function saveOrganizationMembership(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const userId = sanitizePlainTextInput(String(formData.get("userId") ?? ""), 80);
  const role = normalizeRole(formData.get("role"));
  const status = normalizeMembershipStatus(formData.get("status"));
  const { supabase } = await requirePlatformAdmin();

  const { error } = await supabase.rpc("admin_upsert_organization_membership", {
    p_organization_id: organizationId,
    p_role: role,
    p_status: status,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/organizations");
  redirect(appendAdminNotice("/admin/organizations", "Membership saved."));
}
