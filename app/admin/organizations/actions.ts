"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { requirePlatformAdmin } from "@/features/admin/application/context";
import { ORGANIZATION_ENTITLEMENT_KEYS } from "@/features/organizations/entitlements";
import { normalizeOrganizationAccentToken } from "@/features/organizations/identity";
import { normalizeEmailInput, sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";
import type { Database } from "@/types/database";

type ContentStatus = Database["public"]["Enums"]["content_status"];
type OrganizationAccentToken = Database["public"]["Enums"]["organization_accent_token"];
type OrganizationBillingStatus = Database["public"]["Enums"]["organization_billing_status"];
type OrganizationEntitlementKey = typeof ORGANIZATION_ENTITLEMENT_KEYS[number];
type OrganizationInvitationTargetType = Database["public"]["Enums"]["organization_invitation_target_type"];
type OrganizationLifecycleStatus = Database["public"]["Enums"]["organization_lifecycle_status"];
type OrganizationMembershipStatus = Database["public"]["Enums"]["organization_membership_status"];
type OrganizationRoleKey = Database["public"]["Enums"]["organization_role_key"];
type OrganizationVerificationStatus = Database["public"]["Enums"]["organization_verification_status"];

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

const BILLING_STATUSES: OrganizationBillingStatus[] = [
  "free",
  "trial",
  "active",
  "past_due",
  "cancelled",
  "sponsored",
];

const LIFECYCLE_STATUSES: OrganizationLifecycleStatus[] = [
  "trial",
  "active",
  "suspended",
  "archived",
];

const VERIFICATION_STATUSES: OrganizationVerificationStatus[] = [
  "unverified",
  "verification_pending",
  "verified",
  "rejected",
];

const INTEGER_OVERRIDE_KEYS: OrganizationEntitlementKey[] = [
  "max_courses",
  "max_total_lessons",
  "max_storage_bytes",
  "max_active_missions",
  "max_xp_accounts",
  "max_active_rewards",
  "max_open_reward_claims",
  "max_fulfilled_reward_claims_per_month",
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

function normalizeBillingStatus(value: FormDataEntryValue | null): OrganizationBillingStatus {
  const status = String(value ?? "free");
  return BILLING_STATUSES.includes(status as OrganizationBillingStatus)
    ? status as OrganizationBillingStatus
    : "free";
}

function normalizeLifecycleStatus(value: FormDataEntryValue | null): OrganizationLifecycleStatus {
  const status = String(value ?? "active");
  return LIFECYCLE_STATUSES.includes(status as OrganizationLifecycleStatus)
    ? status as OrganizationLifecycleStatus
    : "active";
}

function normalizeVerificationStatus(value: FormDataEntryValue | null): OrganizationVerificationStatus {
  const status = String(value ?? "unverified");
  return VERIFICATION_STATUSES.includes(status as OrganizationVerificationStatus)
    ? status as OrganizationVerificationStatus
    : "unverified";
}

function normalizeRole(value: FormDataEntryValue | null): OrganizationRoleKey {
  const role = String(value ?? "learner");
  return ORGANIZATION_ROLES.includes(role as OrganizationRoleKey)
    ? role as OrganizationRoleKey
    : "learner";
}

function parseInvitationTarget(value: FormDataEntryValue | null): {
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

function parseExpiry(value: FormDataEntryValue | null) {
  const rawValue = sanitizePlainTextInput(String(value ?? "14"), 8);
  const days = Number(rawValue);
  const safeDays = Number.isInteger(days) && days >= 1 && days <= 90 ? days : 14;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function parseIntegerOverride(formData: FormData, key: OrganizationEntitlementKey) {
  const rawValue = sanitizePlainTextInput(String(formData.get(key) ?? ""), 32);

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`Entitlement override ${key} must be a non-negative integer.`);
  }

  return parsedValue;
}

function parseEntitlementOverrides(formData: FormData) {
  const overrides: Partial<Record<OrganizationEntitlementKey, number>> = {};

  for (const key of INTEGER_OVERRIDE_KEYS) {
    const value = parseIntegerOverride(formData, key);

    if (value !== null) {
      overrides[key] = value;
    }
  }

  return overrides;
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

export async function saveOrganizationInvitation(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const invitedUserId = sanitizePlainTextInput(String(formData.get("invitedUserId") ?? ""), 80);
  const email = normalizeEmailInput(String(formData.get("email") ?? ""));
  const role = normalizeRole(formData.get("role"));
  const { targetId, targetType } = parseInvitationTarget(formData.get("target"));
  const expiresAt = parseExpiry(formData.get("expiresInDays"));
  const { supabase } = await requirePlatformAdmin();

  const { error } = await supabase.rpc("admin_create_organization_invitation", {
    p_email: email || null,
    p_expires_at: expiresAt,
    p_invited_user_id: invitedUserId || null,
    p_organization_id: organizationId,
    p_role: role,
    p_target_id: targetId,
    p_target_type: targetType,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/organizations");
  revalidatePath("/org/my");
  revalidatePath("/notifications");
  redirect(appendAdminNotice("/admin/organizations", "Invitation created."));
}

export async function saveOrganizationPlanAssignment(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const planKey = sanitizePlainTextInput(String(formData.get("planKey") ?? ""), 80);
  const billingStatus = normalizeBillingStatus(formData.get("billingStatus"));
  const overrideReason = sanitizePlainTextInput(String(formData.get("overrideReason") ?? ""), 240);
  const entitlementOverrides = parseEntitlementOverrides(formData);
  const { supabase } = await requirePlatformAdmin();

  const { error } = await supabase.rpc("admin_assign_organization_plan", {
    p_billing_status: billingStatus,
    p_entitlement_overrides: entitlementOverrides,
    p_organization_id: organizationId,
    p_override_reason: overrideReason || null,
    p_plan_key: planKey,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/organizations");
  redirect(appendAdminNotice("/admin/organizations", "Organisation plan assigned."));
}

export async function saveOrganizationProfile(formData: FormData) {
  const organizationId = sanitizePlainTextInput(String(formData.get("organizationId") ?? ""), 80);
  const shortName = sanitizePlainTextInput(String(formData.get("shortName") ?? ""), 80);
  const description = sanitizePlainTextInput(String(formData.get("description") ?? ""), 2000);
  const logoUrl = sanitizeUrlInput(String(formData.get("logoUrl") ?? ""), 1000);
  const accentToken = normalizeOrganizationAccentToken(formData.get("accentToken")) as OrganizationAccentToken;
  const supportEmail = normalizeEmailInput(String(formData.get("supportEmail") ?? ""));
  const supportPhone = sanitizePlainTextInput(String(formData.get("supportPhone") ?? ""), 40);
  const verificationStatus = normalizeVerificationStatus(formData.get("verificationStatus"));
  const lifecycleStatus = normalizeLifecycleStatus(formData.get("lifecycleStatus"));
  const { supabase } = await requirePlatformAdmin();

  const { error } = await supabase.rpc("admin_update_organization_profile", {
    p_accent_token: accentToken,
    p_description: description,
    p_lifecycle_status: lifecycleStatus,
    p_logo_url: logoUrl || null,
    p_organization_id: organizationId,
    p_short_name: shortName || null,
    p_support_email: supportEmail || null,
    p_support_phone: supportPhone || null,
    p_verification_status: verificationStatus,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/organizations");
  redirect(appendAdminNotice("/admin/organizations", "Organisation profile updated."));
}
