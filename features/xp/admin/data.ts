import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrganizationScopeFilter } from "@/features/admin/application/context";
import {
  getAdminProfilesByIds,
  type AdminProfileRow,
} from "@/features/users/admin/data";

const ADMIN_PROFILE_SELECT =
  "id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status";

export type AdminXpTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  direction: "earn" | "spend";
  source_type: string;
  source_id: string;
  award_scope: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: AdminProfileRow;
};

export type AdminXpLedgerFilters = {
  userQuery?: string;
  direction?: "earn" | "spend";
  sourceType?: "quiz_question" | "mission" | "reward_redemption" | "adjustment";
  dateFrom?: string;
  dateTo?: string;
};

export type AdminXpSettingsRow = {
  id: number;
  default_daily_quiz_xp_limit: number;
  admin_manual_grant_daily_limit: number;
  updated_at: string;
};

export type AdminManualXpGrantStatusRow = {
  local_date: string;
  daily_limit: number;
  granted_today: number;
  remaining_today: number;
};

export async function getAdminXpSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("xp_settings")
    .select("id, default_daily_quiz_xp_limit, admin_manual_grant_daily_limit, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AdminXpSettingsRow | null;
}

export async function getAdminManualXpGrantStatus(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("admin_manual_xp_grant_status");

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as AdminManualXpGrantStatusRow | null;
}

export async function getAdminXpLedger(
  supabase: SupabaseClient,
  filters: AdminXpLedgerFilters = {},
  workspaceId?: string,
) {
  let userIds: string[] | null = null;

  if (filters.userQuery?.trim()) {
    const userQuery = filters.userQuery.trim().replace(/[,%()]/g, " ");
    const { data: matchedProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select(ADMIN_PROFILE_SELECT)
      .or(
        [
          `display_name.ilike.%${userQuery}%`,
          `referral_code.ilike.%${userQuery}%`,
        ].join(","),
      )
      .limit(100);

    if (profilesError) {
      throw profilesError;
    }

    userIds = ((matchedProfiles ?? []) as AdminProfileRow[]).map((profile) => profile.id);
    if (userIds.length === 0) {
      return [];
    }
  }

  const scope = resolveOrganizationScopeFilter(workspaceId ?? "platform");
  let transactions: AdminXpTransactionRow[];

  if (scope.mode === "all") {
    // Platform-wide oversight view: every organisation's ledger combined,
    // matching the existing cross-account "XP activity" audit trail.
    let query = supabase
      .from("xp_transactions")
      .select("id, user_id, amount, direction, source_type, source_id, award_scope, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (userIds) {
      query = query.in("user_id", userIds);
    }

    if (filters.direction) {
      query = query.eq("direction", filters.direction);
    }

    if (filters.sourceType) {
      query = query.eq("source_type", filters.sourceType);
    }

    if (filters.dateFrom) {
      query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
    }

    if (filters.dateTo) {
      query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    transactions = (data ?? []) as AdminXpTransactionRow[];
  } else {
    const { data, error } = await supabase.rpc("admin_list_xp_account_transactions", {
      p_organization_id: scope.mode === "organization" ? scope.organizationId : null,
      p_direction: filters.direction ?? null,
      p_source_type: filters.sourceType ?? null,
      p_user_ids: userIds,
      p_date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00.000Z` : null,
      p_date_to: filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : null,
      p_limit: 200,
    });

    if (error) {
      throw error;
    }

    transactions = (data ?? []) as AdminXpTransactionRow[];
  }

  const profiles = await getAdminProfilesByIds(
    supabase,
    transactions.map((transaction) => transaction.user_id),
  );

  return transactions.map((transaction) => ({
    ...transaction,
    profile: profiles.get(transaction.user_id),
  }));
}
