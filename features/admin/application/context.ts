import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentUserContext,
  type UserProfile,
} from "@/lib/supabase-server";
import { isLiveMode } from "@/lib/app-mode";
import { organizationAllowsLearnerEntry } from "@/features/organizations/identity";
import { PLATFORM_CATALOG_WORKSPACE_ID, workspaceHasAnyRole } from "@/features/admin/shared/workspace";

export { PLATFORM_CATALOG_WORKSPACE_ID, workspaceHasAnyRole };

type CountableTable =
  | "profiles"
  | "rewards"
  | "reward_redemptions"
  | "mission_proofs"
  | "missions"
  | "campaigns"
  | "xp_transactions";

export type AdminContext = {
  supabase: SupabaseClient;
  profile: UserProfile;
  workspace: AdminWorkspace;
};

export const ADMIN_WORKSPACE_COOKIE = "project-ve-admin-workspace";

export type AdminWorkspace = {
  id: "platform" | string;
  organizationIdentity?: AdminWorkspaceOrganizationIdentity;
  type: "platform" | "organization";
  roles: string[];
};

export type OrganizationScopeFilter =
  | { mode: "all" }
  | { mode: "unowned" }
  | { mode: "organization"; organizationId: string };

/**
 * Interprets the ambient `project-ve-admin-workspace` cookie value for data
 * getters that scope rows by `organization_id`. Three states: "platform"
 * means no filter (oversight of everything), the platform-catalog sentinel
 * means `organization_id IS NULL` (Project VE's own catalog), and anything
 * else is a specific organisation id to filter on exactly.
 */
export function resolveOrganizationScopeFilter(selectedWorkspaceId: string): OrganizationScopeFilter {
  if (selectedWorkspaceId === "platform") {
    return { mode: "all" };
  }

  if (selectedWorkspaceId === PLATFORM_CATALOG_WORKSPACE_ID) {
    return { mode: "unowned" };
  }

  return { mode: "organization", organizationId: selectedWorkspaceId };
}

export type AdminWorkspaceOrganizationIdentity = {
  accentToken: string;
  lifecycleStatus: string;
  logoUrl: string | null;
  name: string;
  shortName: string | null;
  slug: string;
  verificationStatus: string;
};

type AdminWorkspaceOrganizationRow = {
  accent_token?: string;
  lifecycle_status?: string;
  logo_url?: string | null;
  name: string;
  short_name?: string | null;
  slug: string;
  status?: string;
  verification_status?: string;
};

const STAFF_ORGANIZATION_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
  "reviewer",
  "instructor",
  "report_viewer",
] as const;

export async function getSelectedAdminWorkspaceId() {
  return (await cookies()).get(ADMIN_WORKSPACE_COOKIE)?.value ?? "platform";
}

async function getPlatformCatalogStaffRoles(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("platform_catalog_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ role: string }>).map((row) => row.role);
}

function platformCatalogWorkspace(roles: string[]): AdminWorkspace {
  return {
    id: PLATFORM_CATALOG_WORKSPACE_ID,
    organizationIdentity: {
      accentToken: "green",
      lifecycleStatus: "active",
      logoUrl: null,
      name: "Project VE Platform Catalog",
      shortName: "Project VE",
      slug: PLATFORM_CATALOG_WORKSPACE_ID,
      verificationStatus: "verified",
    },
    roles,
    type: "organization",
  };
}

async function getOrganizationStaffMemberships(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations!inner(id, name, short_name, slug, status, lifecycle_status, verification_status, accent_token, logo_url)")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", STAFF_ORGANIZATION_ROLES);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    organization_id: string;
    role: string;
    organizations: AdminWorkspaceOrganizationRow | AdminWorkspaceOrganizationRow[] | null;
  }>).filter((membership) => {
    const organization = Array.isArray(membership.organizations)
      ? membership.organizations[0]
      : membership.organizations;
    return organization ? organizationAllowsLearnerEntry({
      lifecycle_status: organization.lifecycle_status ?? "active",
      status: organization.status ?? "archived",
    }) : false;
  });
}

function mapOrganizationIdentity(
  organization: AdminWorkspaceOrganizationRow | null | undefined,
): AdminWorkspaceOrganizationIdentity | undefined {
  if (!organization) {
    return undefined;
  }

  return {
    accentToken: organization.accent_token ?? "green",
    lifecycleStatus: organization.lifecycle_status ?? "active",
    logoUrl: organization.logo_url ?? null,
    name: organization.name,
    shortName: organization.short_name ?? null,
    slug: organization.slug,
    verificationStatus: organization.verification_status ?? "unverified",
  };
}

async function getOrganizationIdentityById(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("name, short_name, slug, lifecycle_status, verification_status, accent_token, logo_url")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapOrganizationIdentity(data);
}

export async function requireAdmin(): Promise<AdminContext> {
  const { profile, supabase, user } = await getCurrentUserContext();

  if (!isLiveMode || !supabase) {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  if (!profile) {
    redirect("/dashboard");
  }

  if (profile.role === "admin") {
    const selectedWorkspaceId = await getSelectedAdminWorkspaceId();

    if (selectedWorkspaceId === "platform") {
      return {
        profile,
        supabase,
        workspace: { id: "platform", roles: ["platform_admin"], type: "platform" },
      };
    }

    if (selectedWorkspaceId === PLATFORM_CATALOG_WORKSPACE_ID) {
      return {
        profile,
        supabase,
        workspace: {
          id: PLATFORM_CATALOG_WORKSPACE_ID,
          organizationIdentity: {
            accentToken: "green",
            lifecycleStatus: "active",
            logoUrl: null,
            name: "Project VE Platform Catalog",
            shortName: "Project VE",
            slug: PLATFORM_CATALOG_WORKSPACE_ID,
            verificationStatus: "verified",
          },
          roles: ["platform_admin"],
          type: "organization",
        },
      };
    }

    const organizationIdentity = await getOrganizationIdentityById(supabase, selectedWorkspaceId);

    return {
      profile,
      supabase,
      workspace: { id: selectedWorkspaceId, organizationIdentity, roles: ["platform_admin"], type: "organization" },
    };
  }

  const [memberships, catalogStaffRoles] = await Promise.all([
    getOrganizationStaffMemberships(supabase, profile.id),
    getPlatformCatalogStaffRoles(supabase, profile.id),
  ]);

  if (memberships.length === 0 && catalogStaffRoles.length === 0) {
    redirect("/dashboard");
  }

  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();

  if (selectedWorkspaceId === PLATFORM_CATALOG_WORKSPACE_ID && catalogStaffRoles.length > 0) {
    return {
      profile,
      supabase,
      workspace: platformCatalogWorkspace(catalogStaffRoles),
    };
  }

  if (memberships.length === 0) {
    // The user has no real organisation memberships at all — their only
    // access is the platform catalog, regardless of what the ambient cookie
    // says (e.g. a stale "platform" default from before they had any role).
    return {
      profile,
      supabase,
      workspace: platformCatalogWorkspace(catalogStaffRoles),
    };
  }

  const selectedMembership =
    memberships.find((membership) => membership.organization_id === selectedWorkspaceId)
    ?? memberships[0];
  const selectedOrganizationId = selectedMembership.organization_id;
  const selectedOrganization = Array.isArray(selectedMembership.organizations)
    ? selectedMembership.organizations[0]
    : selectedMembership.organizations;
  const roles = memberships
    .filter((membership) => membership.organization_id === selectedOrganizationId)
    .map((membership) => membership.role);

  return {
    profile,
    supabase,
    workspace: {
      id: selectedOrganizationId,
      organizationIdentity: mapOrganizationIdentity(selectedOrganization),
      roles,
      type: "organization",
    },
  };
}

export async function requirePlatformAdmin(): Promise<AdminContext> {
  const context = await requireAdmin();

  if (context.profile.role !== "admin") {
    redirect("/admin");
  }

  return {
    ...context,
    workspace: { id: "platform", roles: ["platform_admin"], type: "platform" },
  };
}

export async function requireAdminWorkspaceRole(roles: string[]): Promise<AdminContext> {
  const context = await requireAdmin();

  if (workspaceHasAnyRole(context.workspace, roles)) {
    return context;
  }

  redirect("/admin");
}

async function getExactCount(supabase: SupabaseClient, table: CountableTable) {
  const { count, error } = await supabase.from(table).select("id", {
    count: "exact",
    head: true,
  });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getAdminOverview(supabase: SupabaseClient) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalRewards,
    totalMissions,
    totalCampaigns,
    pendingRedemptions,
    pendingProofItems,
    earnedToday,
  ] = await Promise.all([
    getExactCount(supabase, "profiles"),
    getExactCount(supabase, "rewards"),
    getExactCount(supabase, "missions"),
    getExactCount(supabase, "campaigns"),
    supabase
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .in("claim_state", ["details_submitted", "purchased"]),
    supabase
      .from("mission_proofs")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("xp_transactions")
      .select("amount")
      .eq("direction", "earn")
      .gte("created_at", todayStart.toISOString()),
  ]);

  if (pendingRedemptions.error) {
    throw pendingRedemptions.error;
  }

  if (pendingProofItems.error) {
    throw pendingProofItems.error;
  }

  if (earnedToday.error) {
    throw earnedToday.error;
  }

  return {
    totalUsers,
    totalRewards,
    totalMissions,
    totalCampaigns,
    pendingRedemptions: pendingRedemptions.count ?? 0,
    pendingProofItems: pendingProofItems.count ?? 0,
    xpEarnedToday: ((earnedToday.data ?? []) as Array<{ amount: number }>).reduce(
      (total, row) => total + row.amount,
      0,
    ),
  };
}
