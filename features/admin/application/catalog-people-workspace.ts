import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export { ORGANIZATION_ROLE_DESCRIPTIONS, ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";

export type AdminCatalogStaffMember = {
  id: string;
  user_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  status: Database["public"]["Enums"]["organization_membership_status"];
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
};

export type AdminCatalogStaffInvitation = {
  id: string;
  email: string | null;
  invited_user_id: string | null;
  role: Database["public"]["Enums"]["organization_role_key"];
  status: Database["public"]["Enums"]["organization_invitation_status"];
  expires_at: string;
  created_at: string;
  profile?: {
    id: string;
    display_name: string | null;
  } | null;
};

export type AdminCatalogPeopleWorkspace = {
  members: AdminCatalogStaffMember[];
  invitations: AdminCatalogStaffInvitation[];
};

export async function getAdminCatalogPeopleWorkspace(
  supabase: SupabaseClient<Database>,
): Promise<AdminCatalogPeopleWorkspace> {
  const [membershipsResult, invitationsResult] = await Promise.all([
    supabase
      .from("platform_catalog_memberships")
      .select(
        "id, user_id, role, status, created_at, updated_at, profile:profiles!platform_catalog_memberships_user_id_fkey(id, display_name, avatar_url)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("platform_catalog_invitations")
      .select(
        "id, email, invited_user_id, role, status, expires_at, created_at, profile:profiles!platform_catalog_invitations_invited_user_id_fkey(id, display_name)",
      )
      .order("created_at", { ascending: false }),
  ]);

  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  if (invitationsResult.error) {
    throw invitationsResult.error;
  }

  const normalizeProfile = <P>(profile: P | P[] | null | undefined): P | null =>
    Array.isArray(profile) ? profile[0] ?? null : profile ?? null;

  return {
    members: ((membershipsResult.data ?? []) as unknown as AdminCatalogStaffMember[]).map((row) => ({
      ...row,
      profile: normalizeProfile(row.profile),
    })),
    invitations: ((invitationsResult.data ?? []) as unknown as AdminCatalogStaffInvitation[]).map((row) => ({
      ...row,
      profile: normalizeProfile(row.profile),
    })),
  };
}
