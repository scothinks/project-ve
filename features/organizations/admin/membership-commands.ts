import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminOrganizationUnitMembers } from "@/features/organizations/admin/data";
import { ORGANIZATION_ROLES } from "@/features/organizations/shared/roles";
import { sanitizePlainTextInput } from "@/lib/input-safety";
import type { Database } from "@/types/database";

type OrganizationInvitationTargetType = Database["public"]["Enums"]["organization_invitation_target_type"];
type OrganizationMembershipStatus = Database["public"]["Enums"]["organization_membership_status"];
type OrganizationRoleKey = Database["public"]["Enums"]["organization_role_key"];

export function normalizeOrganizationRole(value: FormDataEntryValue | null): OrganizationRoleKey {
  const role = String(value ?? "learner");
  return ORGANIZATION_ROLES.includes(role as OrganizationRoleKey)
    ? role as OrganizationRoleKey
    : "learner";
}

export function normalizeOrganizationMembershipStatus(
  value: FormDataEntryValue | null,
): OrganizationMembershipStatus {
  const status = String(value ?? "active");
  if (status === "invited" || status === "suspended" || status === "removed") {
    return status;
  }

  return "active";
}

export function parseOrganizationInvitationTarget(value: FormDataEntryValue | null): {
  targetId: string | null;
  targetType: OrganizationInvitationTargetType;
} {
  const target = sanitizePlainTextInput(String(value ?? "organization"), 120);
  const [rawType, rawId] = target.split(":");

  if (rawType === "programme" || rawType === "cohort") {
    return {
      targetId: sanitizePlainTextInput(rawId ?? "", 80) || null,
      targetType: rawType,
    };
  }

  return {
    targetId: null,
    targetType: "organization",
  };
}

export function parseOrganizationInvitationExpiry(value: FormDataEntryValue | null) {
  const rawValue = sanitizePlainTextInput(String(value ?? "14"), 8);
  const days = Number(rawValue);
  const safeDays = Number.isInteger(days) && days >= 1 && days <= 90 ? days : 14;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export async function upsertOrganizationMembership(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    role: OrganizationRoleKey;
    status: OrganizationMembershipStatus;
  },
) {
  const { error } = await supabase.rpc("admin_upsert_organization_membership", {
    p_organization_id: input.organizationId,
    p_role: input.role,
    p_status: input.status,
    p_user_id: input.userId,
  });

  if (error) {
    throw error;
  }
}

export async function createOrganizationInvitation(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    invitedUserId: string | null;
    email: string | null;
    role: OrganizationRoleKey;
    targetId: string | null;
    targetType: OrganizationInvitationTargetType;
    expiresAt: string;
  },
) {
  const { error } = await supabase.rpc("admin_create_organization_invitation", {
    p_email: input.email,
    p_expires_at: input.expiresAt,
    p_invited_user_id: input.invitedUserId,
    p_organization_id: input.organizationId,
    p_role: input.role,
    p_target_id: input.targetId,
    p_target_type: input.targetType,
  });

  if (error) {
    throw error;
  }
}

export async function revokeOrganizationInvitation(supabase: SupabaseClient, invitationId: string) {
  const { error } = await supabase.rpc("admin_revoke_organization_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) {
    throw error;
  }
}

export async function upsertOrganizationUnit(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    unitId: string | null;
    parentUnitId: string | null;
    name: string;
    unitType: string;
    status: Database["public"]["Enums"]["content_status"];
  },
) {
  const { error } = await supabase.rpc("admin_upsert_organization_unit", {
    p_name: input.name,
    p_organization_id: input.organizationId,
    p_parent_unit_id: input.parentUnitId,
    p_status: input.status,
    p_unit_id: input.unitId,
    p_unit_type: input.unitType,
  });

  if (error) {
    throw error;
  }
}

export async function replaceOrganizationUnitMembers(
  supabase: SupabaseClient,
  input: {
    unitId: string;
    members: Array<{ userId: string; role: string }>;
  },
) {
  const { error } = await supabase.rpc("admin_replace_organization_unit_members", {
    p_members: input.members,
    p_unit_id: input.unitId,
  });

  if (error) {
    throw error;
  }
}

/**
 * `admin_replace_organization_unit_members` replaces a *whole unit's* roster —
 * there is no RPC for reassigning a single member. This does a safe
 * read-modify-write per affected unit: it adds the member to the new unit
 * FIRST (so a mid-failure leaves them in both units, never orphaned in
 * neither), then removes them from each previous unit.
 */
export async function reassignOrganizationMemberUnit(
  supabase: SupabaseClient,
  input: {
    newUnitId: string;
    previousUnitIds: string[];
    role: OrganizationRoleKey;
    userId: string;
  },
) {
  const allUnitMembers = await getAdminOrganizationUnitMembers(supabase);
  const membersByUnit = new Map<string, Array<{ userId: string; role: string }>>();

  for (const member of allUnitMembers) {
    const list = membersByUnit.get(member.unit_id) ?? [];
    list.push({ userId: member.user_id, role: member.role });
    membersByUnit.set(member.unit_id, list);
  }

  const newUnitMembers = membersByUnit.get(input.newUnitId) ?? [];
  if (!newUnitMembers.some((member) => member.userId === input.userId)) {
    await replaceOrganizationUnitMembers(supabase, {
      members: [...newUnitMembers, { userId: input.userId, role: input.role }],
      unitId: input.newUnitId,
    });
  }

  for (const previousUnitId of input.previousUnitIds) {
    if (previousUnitId === input.newUnitId) {
      continue;
    }

    const currentMembers = membersByUnit.get(previousUnitId) ?? [];
    const filtered = currentMembers.filter((member) => member.userId !== input.userId);

    if (filtered.length !== currentMembers.length) {
      await replaceOrganizationUnitMembers(supabase, { members: filtered, unitId: previousUnitId });
    }
  }
}
