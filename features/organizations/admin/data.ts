import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
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

function roleToLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getAdminOrganizationContexts(
  supabase: SupabaseClient<Database>,
  userId: string,
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
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name, status, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminOrganizationRow[];
}
