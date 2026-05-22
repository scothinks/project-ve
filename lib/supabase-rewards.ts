import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RewardDistributionMode,
  RewardFulfillmentType,
  RewardLimitPeriod,
  RewardRedemption,
  RewardStoreSnapshot,
  RewardThumbnail,
  RewardVisibilityMode,
  StoreReward,
} from "@/lib/rewards";

type JsonRecord = Record<string, unknown>;
type LegacyRewardFulfillmentType = RewardFulfillmentType | "perk_bundle";

type DbReward = {
  id: string;
  campaign_id: string | null;
  title: string;
  description: string | null;
  cost_xp: number;
  thumbnail: JsonRecord;
  starts_at: string | null;
  ends_at: string | null;
  offer_expires_at: string | null;
  terms: string | null;
  claim_steps: unknown;
  distribution_mode: RewardDistributionMode;
  fulfillment_type: RewardFulfillmentType;
  visibility_mode: RewardVisibilityMode;
  fulfillment_config: JsonRecord;
  per_user_limit: number;
  limit_period: RewardLimitPeriod;
  redemption_window_days: number | null;
  total_available: number;
};

type LegacyDbReward = Omit<DbReward, "visibility_mode" | "distribution_mode" | "fulfillment_type"> & {
  fulfillment_type: LegacyRewardFulfillmentType;
};

type DbInventoryCount = {
  reward_id: string;
  total_available: number;
};

type DbRedemption = {
  id: string;
  reward_id: string;
  requested_at: string;
  fulfilled_at: string | null;
  xp_cost_at_redemption: number | null;
  fulfillment_type: RewardFulfillmentType | null;
  fulfillment_payload: JsonRecord;
  claim_data: JsonRecord | null;
  claim_state: RewardRedemption["claimState"];
  user_message: string | null;
  redemption_expires_at: string | null;
  expired_at: string | null;
  reward_title_snapshot: string | null;
  reward_description_snapshot: string | null;
  reward_thumbnail_snapshot: JsonRecord;
  claim_steps_snapshot: unknown;
  fulfillment_config_snapshot: JsonRecord;
  rewards: {
    id: string;
    title: string;
    description: string | null;
    cost_xp: number;
    thumbnail: JsonRecord;
    claim_steps: unknown;
    fulfillment_config: JsonRecord;
  } | null;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function mapClaimSteps(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((step): step is string => typeof step === "string");
}

function mapThumbnail(value: unknown): RewardThumbnail {
  const record = asRecord(value);
  return {
    url: typeof record.url === "string" ? record.url : undefined,
    icon: typeof record.icon === "string" ? record.icon : undefined,
    color: typeof record.color === "string" ? record.color : undefined,
  };
}

function mapReward(reward: DbReward): StoreReward {
  return {
    id: reward.id,
    title: reward.title,
    description: reward.description,
    costXp: reward.cost_xp,
    thumbnail: mapThumbnail(reward.thumbnail),
    offerExpiresAt: reward.offer_expires_at,
    terms: reward.terms,
    claimSteps: mapClaimSteps(reward.claim_steps),
    distributionMode: reward.distribution_mode,
    fulfillmentType: reward.fulfillment_type,
    visibilityMode: reward.visibility_mode,
    fulfillmentConfig: asRecord(reward.fulfillment_config) as StoreReward["fulfillmentConfig"],
    perUserLimit: reward.per_user_limit,
    limitPeriod: reward.limit_period,
    redemptionWindowDays: reward.redemption_window_days,
    totalAvailable: reward.total_available,
    isSoldOut:
      reward.distribution_mode === "perk_bundle"
        ? reward.total_available <= 0
        : reward.total_available <= 0,
  };
}

function isRewardActive(reward: DbReward, now = new Date()) {
  const startsAt = reward.starts_at ? new Date(reward.starts_at) : null;
  const endsAt = reward.ends_at ? new Date(reward.ends_at) : null;
  const offerExpiresAt = reward.offer_expires_at ? new Date(reward.offer_expires_at) : null;

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt <= now) {
    return false;
  }

  if (offerExpiresAt && offerExpiresAt <= now) {
    return false;
  }

  return true;
}

function mapRedemption(redemption: DbRedemption): RewardRedemption {
  const reward = redemption.rewards;
  const rewardTitle = redemption.reward_title_snapshot ?? reward?.title ?? "Reward";

  return {
    id: redemption.id,
    rewardId: redemption.reward_id,
    rewardTitle,
    rewardDescription: redemption.reward_description_snapshot ?? reward?.description ?? null,
    rewardThumbnail: mapThumbnail(redemption.reward_thumbnail_snapshot ?? reward?.thumbnail),
    requestedAt: redemption.requested_at,
    fulfilledAt: redemption.fulfilled_at,
    xpCost: redemption.xp_cost_at_redemption ?? reward?.cost_xp ?? 0,
    fulfillmentType:
      redemption.fulfillment_type ?? ("manual" satisfies RewardFulfillmentType),
    fulfillmentPayload: asRecord(redemption.fulfillment_payload),
    claimData: redemption.claim_data ? asRecord(redemption.claim_data) : null,
    claimState: redemption.claim_state,
    userMessage: redemption.user_message,
    claimSteps: mapClaimSteps(redemption.claim_steps_snapshot ?? reward?.claim_steps),
    fulfillmentConfig: asRecord(
      redemption.fulfillment_config_snapshot ?? reward?.fulfillment_config,
    ) as StoreReward["fulfillmentConfig"],
    redemptionExpiresAt: redemption.redemption_expires_at,
    expiredAt: redemption.expired_at,
  };
}

function withStoreVisibility(reward: LegacyDbReward): DbReward {
  return {
    ...reward,
    distribution_mode: reward.fulfillment_type === "perk_bundle" ? "perk_bundle" : "direct",
    fulfillment_type: reward.fulfillment_type === "perk_bundle" ? "manual" : reward.fulfillment_type,
    visibility_mode: "store",
  };
}

function isMissingRewardSchemaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "";
  const details = typeof record.details === "string" ? record.details : "";
  return /visibility_mode|distribution_mode/i.test(`${message} ${details}`);
}

async function getPublishedRewards(supabase: SupabaseClient) {
  const baseSelect =
    "id, campaign_id, title, description, cost_xp, thumbnail, starts_at, ends_at, offer_expires_at, terms, claim_steps, fulfillment_type, fulfillment_config, per_user_limit, limit_period, redemption_window_days, total_available";

  const query = supabase
    .from("rewards")
    .select(`${baseSelect}, visibility_mode, distribution_mode`)
    .eq("status", "published")
    .eq("is_enabled", true)
    .eq("visibility_mode", "store")
    .order("sort_order", { ascending: true })
    .returns<DbReward[]>();

  const { data, error } = await query;

  if (!error) {
    return data ?? [];
  }

  if (!isMissingRewardSchemaError(error)) {
    throw error;
  }

  const legacyResult = await supabase
    .from("rewards")
    .select(baseSelect)
    .eq("status", "published")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true })
    .returns<LegacyDbReward[]>();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return (legacyResult.data ?? []).map(withStoreVisibility);
}

export async function getRewardStoreSnapshot(
  supabase: SupabaseClient,
  userId: string,
  xpBalance: number,
): Promise<RewardStoreSnapshot> {
  void userId;

  const rewards = await getPublishedRewards(supabase);

  const { data: inventoryCounts, error: inventoryCountsError } = await supabase.rpc(
    "reward_available_inventory_counts",
  );
  if (inventoryCountsError) {
    throw inventoryCountsError;
  }

  const inventoryRows = Array.isArray(inventoryCounts)
    ? (inventoryCounts as DbInventoryCount[])
    : [];
  const inventoryCountByRewardId = new Map(
    inventoryRows.map((count) => [count.reward_id, count.total_available]),
  );
  const rewardsWithLiveInventory = rewards
    .filter((reward) => inventoryCountByRewardId.has(reward.id))
    .map((reward) => ({
      ...reward,
      total_available: inventoryCountByRewardId.get(reward.id) ?? 0,
    }))
    .filter((reward) => isRewardActive(reward));

  const { data: redemptions, error: redemptionsError } = await supabase
    .from("reward_redemptions")
    .select(
      "id, reward_id, requested_at, fulfilled_at, xp_cost_at_redemption, fulfillment_type, fulfillment_payload, claim_data, claim_state, user_message, redemption_expires_at, expired_at, reward_title_snapshot, reward_description_snapshot, reward_thumbnail_snapshot, claim_steps_snapshot, fulfillment_config_snapshot, rewards:rewards!reward_redemptions_reward_id_fkey(id, title, description, cost_xp, thumbnail, claim_steps, fulfillment_config)",
    )
    .order("requested_at", { ascending: false })
    .returns<DbRedemption[]>();

  if (redemptionsError) {
    throw redemptionsError;
  }

  return {
    xpBalance,
    rewards: rewardsWithLiveInventory.map(mapReward),
    redemptions: (redemptions ?? []).map(mapRedemption),
  };
}
