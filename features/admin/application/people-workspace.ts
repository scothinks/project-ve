import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdminOrganizationInvitations,
  getAdminOrganizationMemberships,
  getAdminOrganizationUnitMembers,
  getAdminOrganizationUnits,
  type AdminOrganizationInvitationRow,
  type AdminOrganizationMembershipRow,
  type AdminOrganizationUnitRow,
} from "@/features/organizations/admin/data";
import { getAdminProgrammes } from "@/features/programmes/admin/data";
import { getAdminCohorts } from "@/features/cohorts/admin/data";
import type { Database } from "@/types/database";

export { ORGANIZATION_ROLE_DESCRIPTIONS, ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";

export type AdminPeopleMember = AdminOrganizationMembershipRow & {
  unitIds: string[];
  unitNames: string[];
};

export type AdminPeopleTargetOption = {
  value: string;
  label: string;
};

export type AdminPeopleWorkspace = {
  members: AdminPeopleMember[];
  invitations: AdminOrganizationInvitationRow[];
  units: AdminOrganizationUnitRow[];
  invitationTargetOptions: AdminPeopleTargetOption[];
};

export async function getAdminPeopleWorkspace(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<AdminPeopleWorkspace> {
  const [memberships, invitations, units, unitMembers, programmes, cohorts] = await Promise.all([
    getAdminOrganizationMemberships(supabase),
    getAdminOrganizationInvitations(supabase),
    getAdminOrganizationUnits(supabase),
    getAdminOrganizationUnitMembers(supabase),
    getAdminProgrammes(supabase),
    getAdminCohorts(supabase),
  ]);

  const unitNameById = new Map(units.map((unit) => [unit.id, unit.name]));
  const unitNamesByUserId = new Map<string, string[]>();
  const unitIdsByUserId = new Map<string, string[]>();
  for (const unitMember of unitMembers) {
    const unitName = unitNameById.get(unitMember.unit_id);
    if (!unitName) {
      continue;
    }
    const names = unitNamesByUserId.get(unitMember.user_id) ?? [];
    names.push(unitName);
    unitNamesByUserId.set(unitMember.user_id, names);
    const ids = unitIdsByUserId.get(unitMember.user_id) ?? [];
    ids.push(unitMember.unit_id);
    unitIdsByUserId.set(unitMember.user_id, ids);
  }

  const members = memberships
    .filter((membership) => membership.organization_id === organizationId)
    .map((membership) => ({
      ...membership,
      unitIds: unitIdsByUserId.get(membership.user_id) ?? [],
      unitNames: unitNamesByUserId.get(membership.user_id) ?? [],
    }));

  const invitationTargetOptions: AdminPeopleTargetOption[] = [
    { value: "organization", label: "Whole organisation" },
    ...programmes
      .filter((programme) => programme.organization_id === organizationId)
      .map((programme) => ({ value: `programme:${programme.id}`, label: `Programme · ${programme.title}` })),
    ...cohorts
      .filter((cohort) => cohort.organization_id === organizationId)
      .map((cohort) => ({ value: `cohort:${cohort.id}`, label: `Cohort · ${cohort.title}` })),
  ];

  return {
    members,
    invitations: invitations.filter((invitation) => invitation.organization_id === organizationId),
    units: units.filter((unit) => unit.organization_id === organizationId),
    invitationTargetOptions,
  };
}
