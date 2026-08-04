import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const ADMIN_PROFILE_SELECT =
  "id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status";

export type AdminProfileRow = {
  id: string;
  display_name: string | null;
  referral_code: string | null;
  xp_balance_cached: number;
  role: string;
  created_at: string;
  redemption_unlocked_at: string | null;
  fraud_review_status: string;
};

export async function getAdminProfilesByIds(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>,
) {
  const uniqueIds = Array.from(new Set(userIds)).filter(
    (userId): userId is string => typeof userId === "string" && userId.length > 0,
  );

  if (uniqueIds.length === 0) {
    return new Map<string, AdminProfileRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(ADMIN_PROFILE_SELECT)
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AdminProfileRow[]).map((profile) => [profile.id, profile]));
}

export async function getAdminUsers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select(ADMIN_PROFILE_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminProfileRow[];
}

export async function getAdminOrganizationLearners(
  supabase: SupabaseClient,
  organizationId: string | null | undefined,
) {
  if (!organizationId) {
    return [];
  }

  const { data, error } = await supabase
    .from("organization_memberships")
    .select(`
      user_id,
      profile:profiles!organization_memberships_user_id_fkey(${ADMIN_PROFILE_SELECT})
    `)
    .eq("organization_id", organizationId)
    .eq("role", "learner")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    profile: AdminProfileRow | AdminProfileRow[] | null;
  }>)
    .map((row) => Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile)
    .filter((profile): profile is AdminProfileRow => Boolean(profile));
}
