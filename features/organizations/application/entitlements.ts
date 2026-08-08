import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseOrganizationEntitlements,
  type OrganizationEntitlements,
} from "@/features/organizations/entitlements";
import type { Database } from "@/types/database";

export type ResolvedOrganizationEntitlements = {
  organizationId: string;
  entitlements: OrganizationEntitlements;
};

export async function resolveOrganizationEntitlements(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<ResolvedOrganizationEntitlements> {
  const { data, error } = await supabase.rpc("resolve_organization_entitlements", {
    p_organization_id: organizationId,
  });

  if (error) {
    throw error;
  }

  return {
    organizationId,
    entitlements: parseOrganizationEntitlements(data),
  };
}
