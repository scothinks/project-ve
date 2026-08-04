import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSelectedAdminWorkspaceId } from "@/features/admin/application/context";
import type { UserProfile } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

export type AdminOrganizationContext = {
  id: string;
  label: string;
  role: string;
  roleLabel: string;
  slug: string;
  type: "platform" | "organization";
};

export type AdminOrganizationRow = {
  id: string;
  slug: string;
  name: string;
  status: Database["public"]["Enums"]["content_status"];
  created_at: string;
  updated_at: string;
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

type MembershipContextRow = {
  organization_id: string;
  role: Database["public"]["Enums"]["organization_role_key"];
  organizations: {
    id: string;
    name: string;
    slug: string;
    status: Database["public"]["Enums"]["content_status"];
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

function roleToLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
      organizations!inner(id, name, slug, status),
      organization_roles!inner(label)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("role", { ascending: true });

  if (error) {
    throw error;
  }

  const organizationContexts = ((data ?? []) as unknown as MembershipContextRow[])
    .filter((row) => row.organizations?.status !== "archived")
    .map((row) => ({
      id: row.organization_id,
      label: row.organizations?.name ?? "Organisation",
      role: row.role,
      roleLabel: row.organization_roles?.label ?? roleToLabel(row.role),
      slug: row.organizations?.slug ?? row.organization_id,
      type: "organization" as const,
    }));

  if (profile?.role !== "admin") {
    return organizationContexts;
  }

  return [
    {
      id: "platform",
      label: "Project VE platform",
      role: "platform_admin",
      roleLabel: "Platform admin",
      slug: "platform",
      type: "platform",
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
    .select("id, slug, name, status, created_at, updated_at")
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
