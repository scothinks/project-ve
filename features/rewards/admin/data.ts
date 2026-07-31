import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdminCampaignsByIds,
  type AdminCampaignRow,
} from "@/features/campaigns/admin/data";
import {
  getAdminProfilesByIds,
  type AdminProfileRow,
} from "@/features/users/admin/data";

export type AdminRewardRow = {
  id: string;
  campaign_id: string | null;
  title: string;
  description: string | null;
  cost_xp: number;
  status: string;
  is_enabled: boolean;
  distribution_mode: string;
  fulfillment_type: string;
  visibility_mode: string;
  total_uploaded: number;
  total_available: number;
  per_user_limit: number;
  limit_period: string;
  starts_at: string | null;
  ends_at: string | null;
  offer_expires_at: string | null;
  updated_at: string;
  campaign?: AdminCampaignRow | null;
};

export type AdminRedemptionRow = {
  id: string;
  user_id: string;
  reward_id: string;
  status: string;
  claim_state: string;
  reward_title_snapshot: string | null;
  xp_cost_at_redemption: number | null;
  fulfillment_type: string | null;
  claim_data: Record<string, unknown> | null;
  user_message: string | null;
  redemption_expires_at: string | null;
  refunded_at: string | null;
  fulfilled_at: string | null;
  admin_note: string | null;
  requested_at: string;
  profile?: AdminProfileRow;
  reward?: AdminRewardRow | null;
};

export type AdminRedemptionFilters = {
  claimState?: string;
  fulfillmentType?: string;
  rewardId?: string;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getAdminRewards(
  supabase: SupabaseClient,
  filters: { campaignId?: string; distributionMode?: "direct" | "perk_bundle" } = {},
) {
  const baseSelect =
    "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, starts_at, ends_at, offer_expires_at, updated_at";
  let query = supabase
    .from("rewards")
    .select(`${baseSelect}, distribution_mode`)
    .order("sort_order", { ascending: true });

  if (filters.campaignId) {
    query =
      filters.campaignId === "none"
        ? query.is("campaign_id", null)
        : query.eq("campaign_id", filters.campaignId);
  }

  if (filters.distributionMode) {
    query = query.eq("distribution_mode", filters.distributionMode);
  }

  const { data: nextData, error } = await query;

  if (error) {
    throw error;
  }

  const data = (nextData ?? []) as AdminRewardRow[];
  const campaigns = await getAdminCampaignsByIds(
    supabase,
    (data ?? []).map((reward) => reward.campaign_id ?? ""),
  );

  return (data ?? []).map((reward) => ({
    ...reward,
    campaign: reward.campaign_id ? campaigns.get(reward.campaign_id) ?? null : null,
  }));
}

export async function getAdminRedemptions(
  supabase: SupabaseClient,
  filters: AdminRedemptionFilters = {},
  limit = 100,
) {
  let query = supabase
    .from("reward_redemptions")
    .select(
      "id, user_id, reward_id, status, claim_state, reward_title_snapshot, xp_cost_at_redemption, fulfillment_type, claim_data, user_message, redemption_expires_at, refunded_at, fulfilled_at, admin_note, requested_at",
    )
    .order("requested_at", { ascending: false });

  if (filters.claimState) {
    query = query.eq("claim_state", filters.claimState);
  }

  if (filters.fulfillmentType) {
    query = query.eq("fulfillment_type", filters.fulfillmentType);
  }

  if (filters.rewardId) {
    query = query.eq("reward_id", filters.rewardId);
  }

  if (filters.dateFrom) {
    query = query.gte("requested_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("requested_at", filters.dateTo);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw error;
  }

  let redemptions = (data ?? []) as AdminRedemptionRow[];

  const [profiles, rewards] = await Promise.all([
    getAdminProfilesByIds(
      supabase,
      redemptions.map((redemption) => redemption.user_id),
    ),
    getAdminRewardsByIds(
      supabase,
      redemptions.map((redemption) => redemption.reward_id),
    ),
  ]);

  if (filters.campaignId) {
    redemptions = redemptions.filter((redemption) => {
      const reward = rewards.get(redemption.reward_id);
      return filters.campaignId === "none"
        ? !reward?.campaign_id
        : reward?.campaign_id === filters.campaignId;
    });
  }

  return redemptions.map((redemption) => ({
    ...redemption,
    profile: profiles.get(redemption.user_id),
    reward: rewards.get(redemption.reward_id) ?? null,
  }));
}

export async function getAdminRewardsByIds(supabase: SupabaseClient, rewardIds: string[]) {
  const uniqueIds = Array.from(new Set(rewardIds)).filter(Boolean);

  if (uniqueIds.length === 0) {
    return new Map<string, AdminRewardRow>();
  }

  const baseSelect =
    "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, starts_at, ends_at, offer_expires_at, updated_at";
  const { data, error } = await supabase
    .from("rewards")
    .select(`${baseSelect}, distribution_mode`)
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AdminRewardRow[]).map((reward) => [reward.id, reward]));
}
