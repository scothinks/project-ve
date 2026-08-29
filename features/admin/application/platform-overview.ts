import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdminOrganizationActivity,
  type AdminOrganizationActivityEvent,
} from "@/features/organizations/admin/activity";
import {
  getAdminOrganizationEntitlementOverrides,
  getAdminOrganizationTemporaryEntitlementGrants,
  getAdminOrganizations,
  type AdminOrganizationRow,
  type AdminOrganizationTemporaryEntitlementGrantRow,
} from "@/features/organizations/admin/data";
import { getAdminOverview } from "@/features/admin/application/context";
import type { Database } from "@/types/database";

export type AdminPlatformOverview = {
  totalOrganizations: number;
  organizationsPendingVerification: AdminOrganizationRow[];
  totalUsers: number;
  pendingRedemptions: number;
  pendingProofItems: number;
  activeEntitlementOverrides: number;
  expiringTemporaryGrants: Array<AdminOrganizationTemporaryEntitlementGrantRow & { organizationName: string }>;
  recentActivity: AdminOrganizationActivityEvent[];
};

function temporaryGrantIsActive(grant: AdminOrganizationTemporaryEntitlementGrantRow): boolean {
  const now = Date.now();
  if (grant.revoked_at) return false;
  if (new Date(grant.starts_at).getTime() > now) return false;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) return false;
  return true;
}

export async function getAdminPlatformOverview(
  supabase: SupabaseClient<Database>,
): Promise<AdminPlatformOverview> {
  const [overview, organizations, entitlementOverrides, temporaryGrants, activity] = await Promise.all([
    getAdminOverview(supabase),
    getAdminOrganizations(supabase),
    getAdminOrganizationEntitlementOverrides(supabase),
    getAdminOrganizationTemporaryEntitlementGrants(supabase),
    getAdminOrganizationActivity(supabase, { limit: 6 }),
  ]);

  const organizationNameById = new Map(organizations.map((org) => [org.id, org.short_name || org.name]));
  const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const expiringTemporaryGrants = temporaryGrants
    .filter(
      (grant) =>
        temporaryGrantIsActive(grant) &&
        grant.expires_at &&
        new Date(grant.expires_at).getTime() <= sevenDaysFromNow,
    )
    .map((grant) => ({
      ...grant,
      organizationName: organizationNameById.get(grant.organization_id) ?? grant.organization_id,
    }));

  return {
    totalOrganizations: organizations.length,
    organizationsPendingVerification: organizations.filter(
      (org) => org.verification_status === "verification_pending",
    ),
    totalUsers: overview.totalUsers,
    pendingRedemptions: overview.pendingRedemptions,
    pendingProofItems: overview.pendingProofItems,
    activeEntitlementOverrides: entitlementOverrides.length,
    expiringTemporaryGrants,
    recentActivity: activity.events,
  };
}
