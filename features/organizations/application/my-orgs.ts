import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type OrganizationIdentity = {
  accent_token: Database["public"]["Enums"]["organization_accent_token"];
  id: string;
  lifecycle_status: Database["public"]["Enums"]["organization_lifecycle_status"];
  logo_url: string | null;
  name: string;
  short_name: string | null;
  slug: string;
  verification_status: Database["public"]["Enums"]["organization_verification_status"];
};

type MembershipRow = {
  organization_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  organizations: OrganizationIdentity | OrganizationIdentity[] | null;
  organization_roles: { label: string } | Array<{ label: string }> | null;
};

type InvitationRow = {
  created_at: string;
  email: string | null;
  expires_at: string;
  id: string;
  organization_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  target_id: string | null;
  target_type: Database["public"]["Enums"]["organization_invitation_target_type"];
  organizations: OrganizationIdentity | OrganizationIdentity[] | null;
};

type ProgrammeEnrolmentRow = {
  organization_id: string;
  programme_id: string | null;
  programmes: { id: string; status: string; title: string } | Array<{ id: string; status: string; title: string }> | null;
  organizations: OrganizationIdentity | OrganizationIdentity[] | null;
};

type CohortMembershipRow = {
  cohort_id: string;
  cohorts: {
    id: string;
    organization_id: string;
    title: string;
    organizations: OrganizationIdentity | OrganizationIdentity[] | null;
  } | Array<{
    id: string;
    organization_id: string;
    title: string;
    organizations: OrganizationIdentity | OrganizationIdentity[] | null;
  }> | null;
};

export type MyOrganizationInvitation = {
  createdAt: string;
  email: string | null;
  expiresAt: string;
  id: string;
  organization: OrganizationIdentity;
  role: Database["public"]["Enums"]["organization_role_key"];
  targetId: string | null;
  targetLabel: string;
  targetType: Database["public"]["Enums"]["organization_invitation_target_type"];
};

export type MyOrganizationSummary = {
  accessLabel: string;
  canManage: boolean;
  cohorts: Array<{ id: string; title: string }>;
  organization: OrganizationIdentity;
  pointsLabel: string;
  programmes: Array<{ id: string; title: string }>;
  roles: Array<{ key: string; label: string }>;
};

const STAFF_ROLES = new Set([
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
  "reviewer",
  "instructor",
  "report_viewer",
]);

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function organizationLabel(organization: OrganizationIdentity) {
  return organization.short_name || organization.name;
}

function ensureOrganization(
  map: Map<string, MyOrganizationSummary>,
  organization: OrganizationIdentity,
) {
  const existing = map.get(organization.id);

  if (existing) {
    return existing;
  }

  const summary: MyOrganizationSummary = {
    accessLabel: "Invited access",
    canManage: false,
    cohorts: [],
    organization,
    pointsLabel: "Not available yet",
    programmes: [],
    roles: [],
  };

  map.set(organization.id, summary);
  return summary;
}

function addUnique<T extends { id: string }>(items: T[], item: T) {
  if (!items.some((existing) => existing.id === item.id)) {
    items.push(item);
  }
}

export async function getMyOrganizationState(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const now = new Date().toISOString();
  const [invitationsResult, membershipsResult, programmeEnrolmentsResult, cohortMembershipsResult] =
    await Promise.all([
      supabase
        .from("organization_invitations")
        .select(`
          id,
          organization_id,
          target_type,
          target_id,
          email,
          role,
          expires_at,
          created_at,
          organizations!inner(id, name, short_name, slug, logo_url, accent_token, lifecycle_status, verification_status)
        `)
        .eq("status", "pending")
        .gt("expires_at", now)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_memberships")
        .select(`
          organization_id,
          role,
          organizations!inner(id, name, short_name, slug, logo_url, accent_token, lifecycle_status, verification_status),
          organization_roles!inner(label)
        `)
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("enrolments")
        .select(`
          organization_id,
          programme_id,
          organizations!inner(id, name, short_name, slug, logo_url, accent_token, lifecycle_status, verification_status),
          programmes!enrolments_programme_id_fkey(id, title, status)
        `)
        .eq("user_id", userId)
        .not("programme_id", "is", null)
        .in("status", ["active", "completed"]),
      supabase
        .from("cohort_members")
        .select(`
          cohort_id,
          cohorts!inner(
            id,
            organization_id,
            title,
            organizations!inner(id, name, short_name, slug, logo_url, accent_token, lifecycle_status, verification_status)
          )
        `)
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

  if (invitationsResult.error) throw invitationsResult.error;
  if (membershipsResult.error) throw membershipsResult.error;
  if (programmeEnrolmentsResult.error) throw programmeEnrolmentsResult.error;
  if (cohortMembershipsResult.error) throw cohortMembershipsResult.error;

  const programmeIds = Array.from(
    new Set(
      ((invitationsResult.data ?? []) as unknown as InvitationRow[])
        .filter((invitation) => invitation.target_type === "programme" && invitation.target_id)
        .map((invitation) => invitation.target_id as string),
    ),
  );
  const cohortIds = Array.from(
    new Set(
      ((invitationsResult.data ?? []) as unknown as InvitationRow[])
        .filter((invitation) => invitation.target_type === "cohort" && invitation.target_id)
        .map((invitation) => invitation.target_id as string),
    ),
  );

  const [invitedProgrammesResult, invitedCohortsResult] = await Promise.all([
    programmeIds.length > 0
      ? supabase.from("programmes").select("id, title").in("id", programmeIds)
      : Promise.resolve({ data: [], error: null }),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, title").in("id", cohortIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (invitedProgrammesResult.error) throw invitedProgrammesResult.error;
  if (invitedCohortsResult.error) throw invitedCohortsResult.error;

  const programmeTitles = new Map(
    ((invitedProgrammesResult.data ?? []) as Array<{ id: string; title: string }>).map((programme) => [
      programme.id,
      programme.title,
    ]),
  );
  const cohortTitles = new Map(
    ((invitedCohortsResult.data ?? []) as Array<{ id: string; title: string }>).map((cohort) => [
      cohort.id,
      cohort.title,
    ]),
  );
  const organizations = new Map<string, MyOrganizationSummary>();

  for (const row of (membershipsResult.data ?? []) as unknown as MembershipRow[]) {
    const organization = first(row.organizations);
    if (!organization) continue;

    const summary = ensureOrganization(organizations, organization);
    const roleDefinition = first(row.organization_roles);
    summary.roles.push({
      key: row.role,
      label: roleDefinition?.label ?? roleLabel(row.role),
    });
    summary.canManage = summary.canManage || STAFF_ROLES.has(row.role);
    summary.accessLabel = summary.canManage ? "Member and staff access" : "Member access";
  }

  for (const row of (programmeEnrolmentsResult.data ?? []) as unknown as ProgrammeEnrolmentRow[]) {
    const organization = first(row.organizations);
    const programme = first(row.programmes);
    if (!organization) continue;

    const summary = ensureOrganization(organizations, organization);
    if (programme && row.programme_id) {
      addUnique(summary.programmes, { id: row.programme_id, title: programme.title });
    }
    if (summary.roles.length === 0) {
      summary.accessLabel = "Programme-only access";
    }
  }

  for (const row of (cohortMembershipsResult.data ?? []) as unknown as CohortMembershipRow[]) {
    const cohort = first(row.cohorts);
    const organization = first(cohort?.organizations);
    if (!cohort || !organization) continue;

    const summary = ensureOrganization(organizations, organization);
    addUnique(summary.cohorts, { id: cohort.id, title: cohort.title });
    if (summary.roles.length === 0 && summary.programmes.length === 0) {
      summary.accessLabel = "Cohort access";
    }
  }

  const invitations = ((invitationsResult.data ?? []) as unknown as InvitationRow[])
    .map((row): MyOrganizationInvitation | null => {
      const organization = first(row.organizations);
      if (!organization) return null;

      const targetLabel = row.target_type === "programme" && row.target_id
        ? programmeTitles.get(row.target_id) ?? "Programme invitation"
        : row.target_type === "cohort" && row.target_id
          ? cohortTitles.get(row.target_id) ?? "Cohort invitation"
          : organizationLabel(organization);

      return {
        createdAt: row.created_at,
        email: row.email,
        expiresAt: row.expires_at,
        id: row.id,
        organization,
        role: row.role,
        targetId: row.target_id,
        targetLabel,
        targetType: row.target_type,
      };
    })
    .filter((invitation): invitation is MyOrganizationInvitation => Boolean(invitation));

  return {
    invitations,
    organizations: Array.from(organizations.values()).sort((left, right) =>
      organizationLabel(left.organization).localeCompare(organizationLabel(right.organization)),
    ),
  };
}
