import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminCampaignRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  starts_at: string | null;
  ends_at: string | null;
  budget_label: string | null;
  budget_amount: number | null;
  created_at: string;
  updated_at: string;
};

export type AdminCampaignRewardMetric = {
  rewardId: string;
  title: string;
  fulfillmentType: string;
  costXp: number;
  totalUploaded: number;
  totalAvailable: number;
  purchases: number;
  fulfilled: number;
  refunded: number;
  xpSpent: number;
};

export type AdminCampaignAnalytics = {
  totalRewards: number;
  enabledRewards: number;
  totalInventoryUploaded: number;
  totalInventoryAvailable: number;
  redemptionsRequested: number;
  redemptionsFulfilled: number;
  redemptionsRefunded: number;
  xpSpent: number;
  pendingManualSubmissions: number;
  reallocatedIn: number;
  reallocatedOut: number;
  rewardMetrics: AdminCampaignRewardMetric[];
};

type AdminCampaignRewardRow = {
  id: string;
  campaign_id: string | null;
  title: string;
  description: string | null;
  cost_xp: number;
  status: string;
  is_enabled: boolean;
  fulfillment_type: string;
  visibility_mode: string;
  total_uploaded: number;
  total_available: number;
  per_user_limit: number;
  limit_period: string;
  offer_expires_at: string | null;
  updated_at: string;
};

type CampaignRedemptionMetricRow = {
  id: string;
  reward_id: string;
  claim_state: string;
  xp_cost_at_redemption: number | null;
  fulfillment_type: string | null;
};

function normalizeAdminMissionReward(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeAdminMissionReward(value[0]);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const reward = value as Partial<{ id: string; title: string; fulfillment_type: string }>;
  if (
    typeof reward.id !== "string"
    || typeof reward.title !== "string"
    || typeof reward.fulfillment_type !== "string"
  ) {
    return null;
  }

  return {
    id: reward.id,
    title: reward.title,
    fulfillment_type: reward.fulfillment_type,
  };
}

export async function getAdminCampaignsByIds(supabase: SupabaseClient, campaignIds: string[]) {
  const uniqueIds = Array.from(new Set(campaignIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, AdminCampaignRow>();
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, slug, name, description, status, starts_at, ends_at, budget_label, budget_amount, created_at, updated_at",
    )
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AdminCampaignRow[]).map((campaign) => [campaign.id, campaign]));
}

export async function getAdminCampaigns(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, slug, name, description, status, starts_at, ends_at, budget_label, budget_amount, created_at, updated_at",
    )
    .order("starts_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as AdminCampaignRow[]).map((mission) => ({
    ...mission,
    reward: normalizeAdminMissionReward((mission as { reward?: unknown }).reward),
  }));
}

export async function getAdminCampaign(supabase: SupabaseClient, campaignId: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, slug, name, description, status, starts_at, ends_at, budget_label, budget_amount, created_at, updated_at",
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const campaign = data as AdminCampaignRow | null;

  return campaign
    ? {
        ...campaign,
        reward: normalizeAdminMissionReward((campaign as { reward?: unknown }).reward),
      }
    : campaign;
}

export async function getAdminCampaignAnalytics(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<AdminCampaignAnalytics> {
  const { data: rewards, error: rewardsError } = await supabase
    .from("rewards")
    .select(
      "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, offer_expires_at, updated_at",
    )
    .eq("campaign_id", campaignId);

  if (rewardsError) {
    throw rewardsError;
  }

  const rewardRows = (rewards ?? []) as AdminCampaignRewardRow[];
  const rewardIds = rewardRows.map((reward) => reward.id);

  if (rewardIds.length === 0) {
    return {
      totalRewards: 0,
      enabledRewards: 0,
      totalInventoryUploaded: 0,
      totalInventoryAvailable: 0,
      redemptionsRequested: 0,
      redemptionsFulfilled: 0,
      redemptionsRefunded: 0,
      xpSpent: 0,
      pendingManualSubmissions: 0,
      reallocatedIn: 0,
      reallocatedOut: 0,
      rewardMetrics: [],
    };
  }

  const [redemptionsResult, reallocationsInResult, reallocationsOutResult] = await Promise.all([
    supabase
      .from("reward_redemptions")
      .select("id, reward_id, claim_state, xp_cost_at_redemption, fulfillment_type")
      .in("reward_id", rewardIds),
    supabase
      .from("reward_inventory_reallocations")
      .select("quantity")
      .eq("to_campaign_id", campaignId),
    supabase
      .from("reward_inventory_reallocations")
      .select("quantity")
      .eq("from_campaign_id", campaignId),
  ]);

  if (redemptionsResult.error) throw redemptionsResult.error;

  const redemptions = (redemptionsResult.data ?? []) as CampaignRedemptionMetricRow[];
  const redemptionsByReward = new Map<string, typeof redemptions>();

  for (const redemption of redemptions) {
    const current = redemptionsByReward.get(redemption.reward_id) ?? [];
    current.push(redemption);
    redemptionsByReward.set(redemption.reward_id, current);
  }

  const rewardMetrics = rewardRows.map((reward) => {
    const rewardRedemptions = redemptionsByReward.get(reward.id) ?? [];
    const activeRedemptions = rewardRedemptions.filter(
      (redemption) => redemption.claim_state !== "refunded" && redemption.claim_state !== "cancelled",
    );

    return {
      rewardId: reward.id,
      title: reward.title,
      fulfillmentType: reward.fulfillment_type,
      costXp: reward.cost_xp,
      totalUploaded: reward.total_uploaded,
      totalAvailable: reward.total_available,
      purchases: activeRedemptions.length,
      fulfilled: rewardRedemptions.filter((redemption) => redemption.claim_state === "fulfilled").length,
      refunded: rewardRedemptions.filter((redemption) => redemption.claim_state === "refunded").length,
      xpSpent: activeRedemptions.reduce(
        (sum, redemption) => sum + (redemption.xp_cost_at_redemption ?? 0),
        0,
      ),
    };
  });

  return {
    totalRewards: rewardRows.length,
    enabledRewards: rewardRows.filter((reward) => reward.is_enabled).length,
    totalInventoryUploaded: rewardRows.reduce((sum, reward) => sum + reward.total_uploaded, 0),
    totalInventoryAvailable: rewardRows.reduce((sum, reward) => sum + reward.total_available, 0),
    redemptionsRequested: redemptions.filter(
      (redemption) => redemption.claim_state !== "refunded" && redemption.claim_state !== "cancelled",
    ).length,
    redemptionsFulfilled: redemptions.filter((redemption) => redemption.claim_state === "fulfilled").length,
    redemptionsRefunded: redemptions.filter((redemption) => redemption.claim_state === "refunded").length,
    xpSpent: rewardMetrics.reduce((sum, reward) => sum + reward.xpSpent, 0),
    pendingManualSubmissions: redemptions.filter(
      (redemption) => redemption.fulfillment_type === "manual" && redemption.claim_state === "details_submitted",
    ).length,
    reallocatedIn: reallocationsInResult.error
      ? 0
      : ((reallocationsInResult.data ?? []) as Array<{ quantity: number }>).reduce((sum, item) => sum + item.quantity, 0),
    reallocatedOut: reallocationsOutResult.error
      ? 0
      : ((reallocationsOutResult.data ?? []) as Array<{ quantity: number }>).reduce((sum, item) => sum + item.quantity, 0),
    rewardMetrics,
  };
}
