"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminWorkspaceRole, type AdminContext } from "@/features/admin/application/context";
import { getAdminOrganizationMemberships } from "@/features/organizations/admin/data";
import {
  createOrganizationInvitation,
  normalizeOrganizationMembershipStatus,
  normalizeOrganizationRole,
  parseOrganizationInvitationExpiry,
  parseOrganizationInvitationTarget,
  reassignOrganizationMemberUnit,
  revokeOrganizationInvitation,
  upsertOrganizationMembership,
  upsertOrganizationUnit,
} from "@/features/organizations/admin/membership-commands";
import { searchAdminUsers } from "@/features/users/admin/data";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { normalizeEmailInput, sanitizePlainTextInput } from "@/lib/input-safety";

const PEOPLE_MANAGER_ROLES = ["organisation_owner", "organisation_admin"];

async function requirePeopleManagerFor(organizationId: string): Promise<AdminContext> {
  const context = await requireAdminWorkspaceRole(PEOPLE_MANAGER_ROLES);

  if (context.workspace.type !== "organization" || context.workspace.id !== organizationId) {
    throw new Error("You can only manage people for the selected organisation workspace.");
  }

  return context;
}

export async function saveMembership(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const userId = sanitizePlainTextInput(String(formData.get("userId") ?? ""), 80);
  const role = normalizeOrganizationRole(formData.get("role"));
  const status = normalizeOrganizationMembershipStatus(formData.get("status"));
  const { supabase } = await requirePeopleManagerFor(organizationId);

  await upsertOrganizationMembership(supabase, { organizationId, role, status, userId });

  revalidatePath("/admin/people");
  redirect(appendAdminNotice("/admin/people", "Membership updated."));
}

export async function sendInvitation(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const invitedUserId = sanitizePlainTextInput(String(formData.get("invitedUserId") ?? ""), 80);
  const email = invitedUserId ? "" : normalizeEmailInput(String(formData.get("email") ?? ""));
  const role = normalizeOrganizationRole(formData.get("role"));
  const { targetId, targetType } = parseOrganizationInvitationTarget(formData.get("target"));
  const expiresAt = parseOrganizationInvitationExpiry(formData.get("expiresInDays"));
  const { supabase } = await requirePeopleManagerFor(organizationId);

  if (!invitedUserId && !email) {
    throw new Error("Choose an existing user or enter an email address to send an invitation.");
  }

  await createOrganizationInvitation(supabase, {
    email: email || null,
    expiresAt,
    invitedUserId: invitedUserId || null,
    organizationId,
    role,
    targetId,
    targetType,
  });

  revalidatePath("/admin/people");
  redirect(appendAdminNotice("/admin/people?tab=invitations", "Invitation sent."));
}

export async function searchInviteCandidates(organizationId: string, query: string) {
  const { supabase } = await requirePeopleManagerFor(organizationId);

  const [candidates, existingMemberships] = await Promise.all([
    searchAdminUsers(supabase, query, 8),
    getAdminOrganizationMemberships(supabase),
  ]);

  const existingMemberIds = new Set(
    existingMemberships
      .filter((membership) => membership.organization_id === organizationId && membership.status !== "removed")
      .map((membership) => membership.user_id),
  );

  return candidates
    .filter((candidate) => !existingMemberIds.has(candidate.id))
    .map((candidate) => ({ id: candidate.id, displayName: candidate.display_name ?? "Unnamed user" }));
}

export async function reassignMemberUnit(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const userId = sanitizePlainTextInput(String(formData.get("userId") ?? ""), 80);
  const role = normalizeOrganizationRole(formData.get("role"));
  const newUnitId = sanitizePlainTextInput(String(formData.get("newUnitId") ?? ""), 80);
  const previousUnitIds = sanitizePlainTextInput(String(formData.get("previousUnitIds") ?? ""), 800)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const { supabase } = await requirePeopleManagerFor(organizationId);

  if (!newUnitId) {
    throw new Error("Choose a unit to reassign this member to.");
  }

  await reassignOrganizationMemberUnit(supabase, { newUnitId, previousUnitIds, role, userId });

  revalidatePath("/admin/people");
  redirect(appendAdminNotice("/admin/people", "Member reassigned to the new unit."));
}

export async function saveUnit(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const name = sanitizePlainTextInput(String(formData.get("name") ?? ""), 160);
  const unitType = sanitizePlainTextInput(String(formData.get("unitType") ?? "department"), 80);
  const parentUnitId = sanitizePlainTextInput(String(formData.get("parentUnitId") ?? ""), 80);
  const { supabase } = await requirePeopleManagerFor(organizationId);

  await upsertOrganizationUnit(supabase, {
    name,
    organizationId,
    parentUnitId: parentUnitId || null,
    status: "published",
    unitId: null,
    unitType,
  });

  revalidatePath("/admin/people");
  redirect(appendAdminNotice("/admin/people?tab=units", "Unit created."));
}

export async function revokeInvitation(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const invitationId = sanitizePlainTextInput(String(formData.get("invitationId") ?? ""), 80);
  const { supabase } = await requirePeopleManagerFor(organizationId);

  await revokeOrganizationInvitation(supabase, invitationId);

  revalidatePath("/admin/people");
  redirect(appendAdminNotice("/admin/people?tab=invitations", "Invitation revoked."));
}
