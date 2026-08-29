"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminWorkspaceRole, type AdminContext } from "@/features/admin/application/context";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import {
  normalizeOrganizationMembershipStatus,
  normalizeOrganizationRole,
  parseOrganizationInvitationExpiry,
} from "@/features/organizations/admin/membership-commands";
import { getAdminCatalogPeopleWorkspace } from "@/features/admin/application/catalog-people-workspace";
import { searchAdminUsers } from "@/features/users/admin/data";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { normalizeEmailInput, sanitizePlainTextInput } from "@/lib/input-safety";

const CATALOG_PEOPLE_MANAGER_ROLES = ["organisation_owner", "organisation_admin"];

async function requireCatalogPeopleManager(): Promise<AdminContext> {
  const context = await requireAdminWorkspaceRole(CATALOG_PEOPLE_MANAGER_ROLES);

  if (context.workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID) {
    throw new Error("You can only manage platform catalog staff from the Platform Catalog workspace.");
  }

  return context;
}

export async function searchCatalogInviteCandidates(query: string) {
  const { supabase } = await requireCatalogPeopleManager();

  const [candidates, workspace] = await Promise.all([
    searchAdminUsers(supabase, query, 8),
    getAdminCatalogPeopleWorkspace(supabase),
  ]);

  const existingMemberIds = new Set(
    workspace.members.filter((member) => member.status !== "removed").map((member) => member.user_id),
  );

  return candidates
    .filter((candidate) => !existingMemberIds.has(candidate.id))
    .map((candidate) => ({ id: candidate.id, displayName: candidate.display_name ?? "Unnamed user" }));
}

export async function sendCatalogInvitation(formData: FormData) {
  const invitedUserId = sanitizePlainTextInput(String(formData.get("invitedUserId") ?? ""), 80);
  const email = invitedUserId ? "" : normalizeEmailInput(String(formData.get("email") ?? ""));
  const role = normalizeOrganizationRole(formData.get("role"));
  const expiresAt = parseOrganizationInvitationExpiry(formData.get("expiresInDays"));
  const { supabase } = await requireCatalogPeopleManager();

  if (!invitedUserId && !email) {
    throw new Error("Choose an existing user or enter an email address to send an invitation.");
  }

  const { error } = await supabase.rpc("admin_create_platform_catalog_invitation", {
    p_email: email || null,
    p_invited_user_id: invitedUserId || null,
    p_role: role,
    p_expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/catalog-people");
  redirect(appendAdminNotice("/admin/catalog-people?tab=invitations", "Invitation sent."));
}

export async function saveCatalogMembership(formData: FormData) {
  const userId = sanitizePlainTextInput(String(formData.get("userId") ?? ""), 80);
  const role = normalizeOrganizationRole(formData.get("role"));
  const status = normalizeOrganizationMembershipStatus(formData.get("status"));
  const { supabase } = await requireCatalogPeopleManager();

  const { error } = await supabase.rpc("admin_upsert_platform_catalog_membership", {
    p_user_id: userId,
    p_role: role,
    p_status: status,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/catalog-people");
  redirect(appendAdminNotice("/admin/catalog-people", "Membership updated."));
}

export async function revokeCatalogInvitation(formData: FormData) {
  const invitationId = sanitizePlainTextInput(String(formData.get("invitationId") ?? ""), 80);
  const { supabase } = await requireCatalogPeopleManager();

  const { error } = await supabase.rpc("admin_revoke_platform_catalog_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/catalog-people");
  redirect(appendAdminNotice("/admin/catalog-people?tab=invitations", "Invitation revoked."));
}
