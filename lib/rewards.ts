export type RewardFulfillmentType =
  | "manual"
  | "voucher_code"
  | "qr_code"
  | "external_link"
  | "native";

export type RewardDistributionMode = "direct" | "perk_bundle";

export type RewardClaimState =
  | "purchased"
  | "claim_started"
  | "details_submitted"
  | "fulfilled"
  | "expired"
  | "cancelled"
  | "refunded";

export type RewardLimitPeriod =
  | "none"
  | "lifetime"
  | "daily"
  | "weekly"
  | "monthly"
  | "campaign";

export type RewardVisibilityMode =
  | "store"
  | "system_only"
  | "campaign_only"
  | "hidden";

export type RewardThumbnail = {
  url?: string;
  icon?: string;
  iconSet?: "tabler";
  iconName?: string;
  color?: string;
};

export type RewardFormField = {
  id: string;
  label: string;
  type: "text" | "tel" | "email" | "textarea";
  required?: boolean;
};

export type StoreReward = {
  id: string;
  title: string;
  description: string | null;
  costXp: number;
  thumbnail: RewardThumbnail;
  offerExpiresAt: string | null;
  terms: string | null;
  claimSteps: string[];
  distributionMode: RewardDistributionMode;
  fulfillmentType: RewardFulfillmentType;
  visibilityMode: RewardVisibilityMode;
  fulfillmentConfig: {
    fields?: RewardFormField[];
    code?: string;
    partner?: string;
    url?: string;
    buttonLabel?: string;
    effect?: string;
    amount?: number;
    multiplier?: number;
    durationHours?: number;
    uses?: number;
    quantity?: number;
    fallback?: {
      prizeType?: "native_xp" | "xp_boost";
      title?: string;
      thumbnail?: RewardThumbnail;
      amount?: number;
      multiplier?: number;
      durationHours?: number;
      uses?: number;
    };
  };
  perUserLimit: number;
  limitPeriod: RewardLimitPeriod;
  redemptionWindowDays: number | null;
  totalAvailable: number;
  isSoldOut: boolean;
};

export type RewardRedemption = {
  id: string;
  rewardId: string;
  rewardTitle: string;
  rewardDescription: string | null;
  rewardThumbnail: RewardThumbnail;
  requestedAt: string;
  fulfilledAt: string | null;
  xpCost: number;
  fulfillmentType: RewardFulfillmentType;
  fulfillmentPayload: Record<string, unknown>;
  claimData: Record<string, unknown> | null;
  claimState: RewardClaimState;
  userMessage: string | null;
  claimSteps: string[];
  fulfillmentConfig: StoreReward["fulfillmentConfig"];
  redemptionExpiresAt: string | null;
  expiredAt: string | null;
};

export type RewardStoreSnapshot = {
  xpBalance: number;
  rewards: StoreReward[];
  redemptions: RewardRedemption[];
};

export const demoRewardStoreSnapshot: RewardStoreSnapshot = {
  xpBalance: 45232,
  rewards: [
    {
      id: "reward-meal-ticket-500",
      title: "N500 Meal Ticket",
      description: "Redeem XP for a partner-managed meal ticket.",
      costXp: 20,
      thumbnail: { iconSet: "tabler", iconName: "utensils", color: "#f4fbf7" },
      offerExpiresAt: "2026-06-30T23:59:59.000Z",
      terms: "One ticket per learner while the offer is available.",
      claimSteps: [
        "Submit your name and phone number.",
        "Project VE shares your request with the reward partner.",
        "The partner contacts you with pickup or delivery instructions.",
      ],
      distributionMode: "direct",
      fulfillmentType: "manual",
      visibilityMode: "store",
      fulfillmentConfig: {
        fields: [
          { id: "fullName", label: "Full name", type: "text", required: true },
          { id: "phone", label: "Phone number", type: "tel", required: true },
          { id: "city", label: "City", type: "text", required: true },
        ],
      },
      perUserLimit: 1,
      limitPeriod: "lifetime",
      redemptionWindowDays: 30,
      totalAvailable: 25,
      isSoldOut: false,
    },
  ],
  redemptions: [],
};

export function formatRewardDate(iso: string | null) {
  if (!iso) {
    return "Offer timing varies";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function getRewardLimitLabel(limit: number, period: RewardLimitPeriod) {
  if (period === "none") {
    return "No purchase limit";
  }

  if (period === "lifetime") {
    return `${limit} per learner`;
  }

  return `${limit} per ${period}`;
}
