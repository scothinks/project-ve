import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdminOrganizationEntitlementOverrides,
  getAdminOrganizationMemberships,
  getAdminOrganizationPlanAssignments,
  getAdminOrganizationPlans,
  getAdminOrganizationTemporaryEntitlementGrants,
  getAdminOrganizations,
  type AdminOrganizationRow,
  type AdminOrganizationTemporaryEntitlementGrantRow,
} from "@/features/organizations/admin/data";
import {
  getAdminOrganizationActivity,
  type AdminOrganizationActivityEvent,
} from "@/features/organizations/admin/activity";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";
import type { OrganizationEntitlementKey, OrganizationEntitlements } from "@/features/organizations/entitlements";
import type { Database } from "@/types/database";

export type AdminOversightEntitlementRow = {
  key: OrganizationEntitlementKey;
  label: string;
  planDefault: number | null;
  hasOverride: boolean;
  hasTemporaryGrant: boolean;
  effective: number | null;
  formatted: (value: number) => string;
};

export type AdminOrganizationOversight = {
  organization: AdminOrganizationRow;
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  planName: string | null;
  billingStatus: Database["public"]["Enums"]["organization_billing_status"] | null;
  entitlementRows: AdminOversightEntitlementRow[];
  activeTemporaryGrants: AdminOrganizationTemporaryEntitlementGrantRow[];
  recentActivity: AdminOrganizationActivityEvent[];
};

function readNumericField(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" ? raw : null;
}

function hasField(value: unknown, key: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(value as Record<string, unknown>, key);
}

function temporaryGrantIsActive(grant: AdminOrganizationTemporaryEntitlementGrantRow): boolean {
  const now = Date.now();
  if (grant.revoked_at) return false;
  if (new Date(grant.starts_at).getTime() > now) return false;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) return false;
  return true;
}

const HEADLINE_ENTITLEMENTS: Array<{
  key: OrganizationEntitlementKey;
  label: string;
  effectiveKey: keyof OrganizationEntitlements;
  formatted: (value: number) => string;
}> = [
  { key: "max_courses", label: "Max Courses", effectiveKey: "maxCourses", formatted: (v) => `${v}` },
  {
    key: "max_storage_bytes",
    label: "Storage Capacity",
    effectiveKey: "maxStorageBytes",
    formatted: (v) => `${Math.round(v / (1024 * 1024 * 1024))} GB`,
  },
  {
    key: "ai_monthly_allocation",
    label: "Monthly AI Allocation",
    effectiveKey: "aiMonthlyAllocation",
    formatted: (v) => new Intl.NumberFormat("en", { notation: "compact" }).format(v),
  },
];

export async function getAdminOrganizationOversight(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<AdminOrganizationOversight | null> {
  const [
    organizations,
    memberships,
    plans,
    planAssignments,
    entitlementOverrides,
    temporaryGrants,
    activity,
    resolved,
  ] = await Promise.all([
    getAdminOrganizations(supabase),
    getAdminOrganizationMemberships(supabase),
    getAdminOrganizationPlans(supabase),
    getAdminOrganizationPlanAssignments(supabase),
    getAdminOrganizationEntitlementOverrides(supabase),
    getAdminOrganizationTemporaryEntitlementGrants(supabase),
    getAdminOrganizationActivity(supabase, { organizationId, limit: 8 }),
    resolveOrganizationEntitlements(supabase, organizationId).catch(() => null),
  ]);

  const organization = organizations.find((org) => org.id === organizationId) ?? null;

  if (!organization) {
    return null;
  }

  const orgMemberships = memberships.filter((membership) => membership.organization_id === organizationId);
  const activeMembers = orgMemberships.filter((membership) => membership.status === "active").length;

  const planAssignment = planAssignments.find((assignment) => assignment.organization_id === organizationId) ?? null;
  const plan = planAssignment ? plans.find((item) => item.key === planAssignment.plan_key) ?? null : null;
  const override = entitlementOverrides.find((item) => item.organization_id === organizationId) ?? null;
  const orgTemporaryGrants = temporaryGrants.filter((grant) => grant.organization_id === organizationId);
  const activeTemporaryGrants = orgTemporaryGrants.filter(temporaryGrantIsActive);

  const entitlementRows: AdminOversightEntitlementRow[] = HEADLINE_ENTITLEMENTS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    planDefault: readNumericField(plan?.entitlements, definition.key),
    hasOverride: hasField(override?.entitlements, definition.key),
    hasTemporaryGrant: activeTemporaryGrants.some((grant) => hasField(grant.entitlement_delta, definition.key)),
    effective: resolved ? (resolved.entitlements[definition.effectiveKey] as number) : null,
    formatted: definition.formatted,
  }));

  return {
    organization,
    totalMembers: orgMemberships.length,
    activeMembers,
    inactiveMembers: orgMemberships.length - activeMembers,
    planName: plan?.name ?? planAssignment?.plan_key ?? null,
    billingStatus: planAssignment?.billing_status ?? null,
    entitlementRows,
    activeTemporaryGrants,
    recentActivity: activity.events,
  };
}
