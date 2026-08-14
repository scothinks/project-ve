import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSelectedAdminWorkspaceId } from "@/features/admin/application/context";
import { organizationAllowsLearnerEntry } from "@/features/organizations/identity";
import type { UserProfile } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

export type AdminOrganizationContext = {
  accentToken: Database["public"]["Enums"]["organization_accent_token"];
  id: string;
  label: string;
  logoUrl: string | null;
  role: string;
  roleLabel: string;
  shortName: string | null;
  slug: string;
  type: "platform" | "organization";
  verificationStatus: Database["public"]["Enums"]["organization_verification_status"];
};

export type AdminOrganizationRow = {
  accent_token: Database["public"]["Enums"]["organization_accent_token"];
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string;
  logo_url: string | null;
  support_email: string | null;
  support_phone: string | null;
  status: Database["public"]["Enums"]["content_status"];
  creation_source: Database["public"]["Enums"]["organization_creation_source"];
  verification_status: Database["public"]["Enums"]["organization_verification_status"];
  lifecycle_status: Database["public"]["Enums"]["organization_lifecycle_status"];
  created_at: string;
  updated_at: string;
};

export type AdminOrganizationPlanRow = {
  key: string;
  name: string;
  description: string;
  status: Database["public"]["Enums"]["organization_plan_status"];
  entitlements: Database["public"]["Tables"]["organization_plans"]["Row"]["entitlements"];
};

export type AdminOrganizationPlanAssignmentRow = {
  id: string;
  organization_id: string;
  plan_key: string;
  billing_status: Database["public"]["Enums"]["organization_billing_status"];
  starts_at: string;
  plan?: Pick<AdminOrganizationPlanRow, "key" | "name"> | null;
};

export type AdminOrganizationEntitlementOverrideRow = {
  id: string;
  organization_id: string;
  entitlements: Database["public"]["Tables"]["organization_entitlement_overrides"]["Row"]["entitlements"];
  reason: string | null;
  starts_at: string;
};

export type AdminOrganizationTemporaryEntitlementGrantRow = {
  id: string;
  organization_id: string;
  grant_type: Database["public"]["Enums"]["organization_temporary_entitlement_grant_type"];
  source_plan_key: string | null;
  entitlement_delta: Database["public"]["Tables"]["organization_temporary_entitlement_grants"]["Row"]["entitlement_delta"];
  starts_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  expired_audited_at: string | null;
  reason: string | null;
  created_at: string;
  sourcePlan?: Pick<AdminOrganizationPlanRow, "key" | "name"> | null;
};

export type AdminOrganizationXpAccountOverview = {
  account: {
    displayFormat: string;
    icon: string;
    id: string;
    name: string;
    pluralName: string;
    shortLabel: string;
    status: Database["public"]["Enums"]["xp_account_status"];
  };
  circulation: number;
  issuance: number;
  redemptions: number;
  adjustments: number;
  controls: {
    accountingValuePerUnit: number;
    exposureHardThreshold: number | null;
    exposureWarningThreshold: number | null;
    fundedRewardBudget: number | null;
    issuanceCapPerPeriod: number;
    issuanceCapPerUser: number;
    issuancePeriodDays: number;
    periodIssued: number;
    periodRemaining: number;
  };
  exposure: {
    estimatedUnredeemedLiability: number;
    hardBlocked: boolean;
    warning: boolean;
  };
  programmeIssuance: Array<{
    issued: number;
    programmeId: string;
    programmeName: string;
  }>;
  rewards: Array<{
    costXp: number;
    id: string;
    isEnabled: boolean;
    status: string;
    title: string;
  }>;
  userIssuance: Array<{
    displayName: string;
    issued: number;
    userId: string;
  }>;
  transactions: Array<{
    amount: number;
    createdAt: string;
    direction: string;
    id: string;
    sourceId: string | null;
    sourceType: string;
    userId: string;
  }>;
};

export type AdminOrganizationMembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  status: Database["public"]["Enums"]["organization_membership_status"];
  created_at: string;
  updated_at: string;
  organization?: Pick<AdminOrganizationRow, "id" | "name" | "slug"> | null;
  profile?: {
    id: string;
    display_name: string | null;
    role: string;
  } | null;
  roleDefinition?: {
    label: string;
  } | null;
};

export type AdminOrganizationUnitRow = {
  id: string;
  organization_id: string;
  parent_unit_id: string | null;
  name: string;
  unit_type: string;
  status: Database["public"]["Enums"]["content_status"];
  created_at: string;
  updated_at: string;
  organization?: Pick<AdminOrganizationRow, "id" | "name" | "slug"> | null;
  active_member_count?: number;
  cohort_count?: number;
};

export type AdminOrganizationUnitMemberRow = {
  unit_id: string;
  organization_id: string;
  user_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  status: Database["public"]["Enums"]["organization_membership_status"];
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    role: string;
  } | null;
};

export type AdminOrganizationAdjustmentLearnerOption = {
  displayName: string | null;
  sourceLabel: string;
  userId: string;
};

export type AdminOrganizationInvitationRow = {
  created_at: string;
  email: string | null;
  expires_at: string;
  id: string;
  invited_user_id: string | null;
  organization_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  status: Database["public"]["Enums"]["organization_invitation_status"];
  target_id: string | null;
  target_type: Database["public"]["Enums"]["organization_invitation_target_type"];
  organization?: Pick<AdminOrganizationRow, "id" | "name" | "slug"> | null;
  profile?: {
    display_name: string | null;
    id: string;
  } | null;
};

type MembershipContextRow = {
  organization_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  organizations: {
    accent_token: Database["public"]["Enums"]["organization_accent_token"];
    id: string;
    logo_url: string | null;
    name: string;
    short_name: string | null;
    slug: string;
    status: Database["public"]["Enums"]["content_status"];
    lifecycle_status: Database["public"]["Enums"]["organization_lifecycle_status"];
    verification_status: Database["public"]["Enums"]["organization_verification_status"];
  } | null;
  organization_roles: {
    label: string;
  } | null;
};

type MembershipSelectRow = AdminOrganizationMembershipRow & {
  organizations?: Pick<AdminOrganizationRow, "id" | "name" | "slug"> | Array<Pick<AdminOrganizationRow, "id" | "name" | "slug">> | null;
  organization_roles?: { label: string } | Array<{ label: string }> | null;
  profile?: {
    id: string;
    display_name: string | null;
    role: string;
  } | Array<{
    id: string;
    display_name: string | null;
    role: string;
  }> | null;
};

type UnitSelectRow = AdminOrganizationUnitRow & {
  organizations?: Pick<AdminOrganizationRow, "id" | "name" | "slug"> | Array<Pick<AdminOrganizationRow, "id" | "name" | "slug">> | null;
};

type PlanAssignmentSelectRow = AdminOrganizationPlanAssignmentRow & {
  organization_plans?: Pick<AdminOrganizationPlanRow, "key" | "name"> | Array<Pick<AdminOrganizationPlanRow, "key" | "name">> | null;
};

type TemporaryEntitlementGrantSelectRow = AdminOrganizationTemporaryEntitlementGrantRow & {
  organization_plans?: Pick<AdminOrganizationPlanRow, "key" | "name"> | Array<Pick<AdminOrganizationPlanRow, "key" | "name">> | null;
};

type InvitationSelectRow = AdminOrganizationInvitationRow & {
  organizations?: Pick<AdminOrganizationRow, "id" | "name" | "slug"> | Array<Pick<AdminOrganizationRow, "id" | "name" | "slug">> | null;
  profile?: {
    display_name: string | null;
    id: string;
  } | Array<{
    display_name: string | null;
    id: string;
  }> | null;
};

type AdjustmentLearnerMembershipRow = {
  user_id: string;
  profile?: {
    display_name: string | null;
    id: string;
  } | Array<{
    display_name: string | null;
    id: string;
  }> | null;
};

type AdjustmentLearnerEnrolmentRow = {
  status: Database["public"]["Enums"]["lms_participation_status"];
  user_id: string;
  profile?: {
    display_name: string | null;
    id: string;
  } | Array<{
    display_name: string | null;
    id: string;
  }> | null;
};

function roleToLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeOrganizationUnit(row: UnitSelectRow): AdminOrganizationUnitRow {
  const organization = Array.isArray(row.organizations)
    ? row.organizations[0] ?? null
    : row.organizations ?? row.organization ?? null;

  return {
    ...row,
    organization,
  };
}

function countByUnitId(rows: Array<{ unit_id: string | null }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.unit_id) continue;
    counts.set(row.unit_id, (counts.get(row.unit_id) ?? 0) + 1);
  }
  return counts;
}

export async function getAdminOrganizationContexts(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile?: Pick<UserProfile, "role">,
): Promise<AdminOrganizationContext[]> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select(`
      organization_id,
      role,
      organizations!inner(id, name, short_name, slug, status, lifecycle_status, verification_status, accent_token, logo_url),
      organization_roles!inner(label)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  const organizationContexts = ((data ?? []) as unknown as MembershipContextRow[])
    .filter((row) => row.organizations ? organizationAllowsLearnerEntry(row.organizations) : false)
    .map((row) => ({
      accentToken: row.organizations?.accent_token ?? "green",
      id: row.organization_id,
      label: row.organizations?.short_name ?? row.organizations?.name ?? "Organisation",
      logoUrl: row.organizations?.logo_url ?? null,
      role: row.role,
      roleLabel: row.organization_roles?.label ?? roleToLabel(row.role),
      shortName: row.organizations?.short_name ?? null,
      slug: row.organizations?.slug ?? row.organization_id,
      type: "organization" as const,
      verificationStatus: row.organizations?.verification_status ?? "unverified",
    }));

  if (profile?.role !== "admin") {
    return organizationContexts;
  }

  return [
    {
      id: "platform",
      accentToken: "green",
      label: "Project VE platform",
      logoUrl: null,
      role: "platform_admin",
      roleLabel: "Platform admin",
      shortName: "Project VE",
      slug: "platform",
      type: "platform",
      verificationStatus: "verified",
    },
    ...organizationContexts,
  ];
}

export async function getAdminOrganizations(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organizations")
    .select("id, slug, name, short_name, description, logo_url, accent_token, support_email, support_phone, status, creation_source, verification_status, lifecycle_status, created_at, updated_at")
    .order("name", { ascending: true });

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminOrganizationRow[];
}

export async function getAdminOrganizationUnits(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationUnitRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organization_units")
    .select(`
      id,
      organization_id,
      parent_unit_id,
      name,
      unit_type,
      status,
      created_at,
      updated_at,
      organizations!organization_units_organization_id_fkey(id, name, slug)
    `)
    .order("name", { ascending: true });

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("organization_id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const units = ((data ?? []) as unknown as UnitSelectRow[]).map(normalizeOrganizationUnit);
  const unitIds = units.map((unit) => unit.id);

  if (unitIds.length === 0) {
    return [];
  }

  const [membersResult, cohortsResult] = await Promise.all([
    supabase
      .from("organization_unit_members")
      .select("unit_id")
      .in("unit_id", unitIds)
      .eq("status", "active"),
    supabase
      .from("cohort_units")
      .select("unit_id")
      .in("unit_id", unitIds),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (cohortsResult.error) throw cohortsResult.error;

  const memberCounts = countByUnitId((membersResult.data ?? []) as Array<{ unit_id: string | null }>);
  const cohortCounts = countByUnitId((cohortsResult.data ?? []) as Array<{ unit_id: string | null }>);

  return units.map((unit) => ({
    ...unit,
    active_member_count: memberCounts.get(unit.id) ?? 0,
    cohort_count: cohortCounts.get(unit.id) ?? 0,
  }));
}

export async function getAdminOrganizationUnitMembers(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationUnitMemberRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organization_unit_members")
    .select(`
      unit_id,
      organization_id,
      user_id,
      role,
      status,
      created_at,
      updated_at,
      profile:profiles!organization_unit_members_user_id_fkey(id, display_name, role)
    `)
    .order("updated_at", { ascending: false });

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("organization_id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as AdminOrganizationUnitMemberRow[];
}

export async function getAdminOrganizationPlans(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationPlanRow[]> {
  const { data, error } = await supabase
    .from("organization_plans")
    .select("key, name, description, status, entitlements")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminOrganizationPlanRow[];
}

export async function getAdminOrganizationPlanAssignments(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationPlanAssignmentRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organization_plan_assignments")
    .select(`
      id,
      organization_id,
      plan_key,
      billing_status,
      starts_at,
      organization_plans!inner(key, name)
    `)
    .is("ended_at", null)
    .order("starts_at", { ascending: false });

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("organization_id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as PlanAssignmentSelectRow[]).map((row) => {
    const plan = Array.isArray(row.organization_plans)
      ? row.organization_plans[0] ?? null
      : row.organization_plans ?? null;

    return {
      id: row.id,
      organization_id: row.organization_id,
      plan_key: row.plan_key,
      billing_status: row.billing_status,
      starts_at: row.starts_at,
      plan,
    };
  });
}

export async function getAdminOrganizationEntitlementOverrides(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationEntitlementOverrideRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organization_entitlement_overrides")
    .select("id, organization_id, entitlements, reason, starts_at")
    .is("ended_at", null)
    .order("starts_at", { ascending: false });

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("organization_id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminOrganizationEntitlementOverrideRow[];
}

export async function getAdminOrganizationTemporaryEntitlementGrants(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationTemporaryEntitlementGrantRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organization_temporary_entitlement_grants")
    .select(`
      id,
      organization_id,
      grant_type,
      source_plan_key,
      entitlement_delta,
      starts_at,
      expires_at,
      revoked_at,
      expired_audited_at,
      reason,
      created_at,
      organization_plans!organization_temporary_entitlement_grants_source_plan_key_fkey(key, name)
    `)
    .order("created_at", { ascending: false })
    .limit(250);

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("organization_id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as TemporaryEntitlementGrantSelectRow[]).map((row) => {
    const sourcePlan = Array.isArray(row.organization_plans)
      ? row.organization_plans[0] ?? null
      : row.organization_plans ?? null;

    return {
      id: row.id,
      organization_id: row.organization_id,
      grant_type: row.grant_type,
      source_plan_key: row.source_plan_key,
      entitlement_delta: row.entitlement_delta,
      starts_at: row.starts_at,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      expired_audited_at: row.expired_audited_at,
      reason: row.reason,
      created_at: row.created_at,
      sourcePlan,
    };
  });
}

export async function getAdminOrganizationXpAccountOverview(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<AdminOrganizationXpAccountOverview> {
  const { data, error } = await supabase.rpc("admin_get_xp_account_overview", {
    p_organization_id: organizationId,
  });

  if (error) {
    throw error;
  }

  return data as unknown as AdminOrganizationXpAccountOverview;
}

export async function getAdminOrganizationMemberships(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationMembershipRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organization_memberships")
    .select(`
      id,
      organization_id,
      user_id,
      role,
      status,
      created_at,
      updated_at,
      organizations!inner(id, name, slug),
      organization_roles!inner(label),
      profile:profiles!organization_memberships_user_id_fkey(id, display_name, role)
    `)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("organization_id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as MembershipSelectRow[]).map((row) => {
    const organization = Array.isArray(row.organizations)
      ? row.organizations[0] ?? null
      : row.organizations ?? null;
    const roleDefinition = Array.isArray(row.organization_roles)
      ? row.organization_roles[0] ?? null
      : row.organization_roles ?? null;
    const profile = Array.isArray(row.profile)
      ? row.profile[0] ?? null
      : row.profile ?? null;

    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      organization,
      profile,
      roleDefinition,
    };
  });
}

export async function getAdminOrganizationAdjustmentLearners(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<AdminOrganizationAdjustmentLearnerOption[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  if (selectedWorkspaceId !== "platform" && selectedWorkspaceId !== organizationId) {
    return [];
  }

  const [membershipsResult, enrolmentsResult] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("user_id, profile:profiles!organization_memberships_user_id_fkey(id, display_name)")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("enrolments")
      .select("user_id, status, profile:profiles!enrolments_user_id_fkey(id, display_name)")
      .eq("organization_id", organizationId)
      .not("programme_id", "is", null)
      .in("status", ["active", "completed"])
      .order("updated_at", { ascending: false })
      .limit(250),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;
  if (enrolmentsResult.error) throw enrolmentsResult.error;

  const learners = new Map<string, AdminOrganizationAdjustmentLearnerOption>();

  for (const row of (membershipsResult.data ?? []) as unknown as AdjustmentLearnerMembershipRow[]) {
    const profile = Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile ?? null;
    learners.set(row.user_id, {
      userId: row.user_id,
      displayName: profile?.display_name ?? null,
      sourceLabel: "Organisation member",
    });
  }

  for (const row of (enrolmentsResult.data ?? []) as unknown as AdjustmentLearnerEnrolmentRow[]) {
    const profile = Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile ?? null;
    const existing = learners.get(row.user_id);
    learners.set(row.user_id, {
      userId: row.user_id,
      displayName: existing?.displayName ?? profile?.display_name ?? null,
      sourceLabel: existing ? "Organisation member" : "Programme learner",
    });
  }

  return Array.from(learners.values()).sort((left, right) =>
    (left.displayName ?? left.userId).localeCompare(right.displayName ?? right.userId),
  );
}

export async function getAdminOrganizationInvitations(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrganizationInvitationRow[]> {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("organization_invitations")
    .select(`
      id,
      organization_id,
      target_type,
      target_id,
      email,
      invited_user_id,
      role,
      status,
      expires_at,
      created_at,
      organizations!inner(id, name, slug),
      profile:profiles!organization_invitations_invited_user_id_fkey(id, display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (selectedWorkspaceId !== "platform") {
    query = query.eq("organization_id", selectedWorkspaceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as InvitationSelectRow[]).map((row) => {
    const organization = Array.isArray(row.organizations)
      ? row.organizations[0] ?? null
      : row.organizations ?? null;
    const profile = Array.isArray(row.profile)
      ? row.profile[0] ?? null
      : row.profile ?? null;

    return {
      created_at: row.created_at,
      email: row.email,
      expires_at: row.expires_at,
      id: row.id,
      invited_user_id: row.invited_user_id,
      organization,
      organization_id: row.organization_id,
      profile,
      role: row.role,
      status: row.status,
      target_id: row.target_id,
      target_type: row.target_type,
    };
  });
}
