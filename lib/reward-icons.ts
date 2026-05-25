import type { RewardThumbnail } from "@/lib/rewards";

export type RewardIconCategory =
  | "reward"
  | "learning"
  | "missions"
  | "xp"
  | "lifestyle"
  | "tech";

export type RewardIconOption = {
  value: string;
  label: string;
  category: RewardIconCategory;
  keywords: string[];
  description?: string;
};

export const rewardIconCategories: Array<{ value: RewardIconCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "reward", label: "Rewards" },
  { value: "xp", label: "XP" },
  { value: "learning", label: "Learning" },
  { value: "missions", label: "Missions" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "tech", label: "Tech" },
];

export const rewardIconOptions: RewardIconOption[] = [
  { value: "gift", label: "Gift", category: "reward", keywords: ["reward", "present", "bonus"] },
  { value: "ticket", label: "Ticket", category: "reward", keywords: ["entry", "pass", "voucher"] },
  { value: "shopping-bag", label: "Shopping bag", category: "reward", keywords: ["store", "shop", "purchase"] },
  { value: "trophy", label: "Trophy", category: "reward", keywords: ["winner", "achievement", "prize"] },
  { value: "medal", label: "Medal", category: "reward", keywords: ["achievement", "completion", "badge"] },
  { value: "stars", label: "Stars", category: "reward", keywords: ["special", "premium", "featured"] },
  { value: "coins", label: "Coins", category: "xp", keywords: ["xp", "points", "balance"] },
  { value: "bolt", label: "Bolt", category: "xp", keywords: ["boost", "speed", "power"] },
  { value: "sparkles", label: "Sparkles", category: "xp", keywords: ["perk", "surprise", "special"] },
  { value: "flame", label: "Flame", category: "xp", keywords: ["streak", "active", "boost"] },
  { value: "book", label: "Book", category: "learning", keywords: ["lesson", "course", "reading"] },
  { value: "school", label: "School", category: "learning", keywords: ["class", "education", "learning"] },
  { value: "pencil", label: "Pencil", category: "learning", keywords: ["write", "study", "exercise"] },
  { value: "certificate", label: "Certificate", category: "learning", keywords: ["completion", "credential"] },
  { value: "target", label: "Target", category: "missions", keywords: ["mission", "goal", "objective"] },
  { value: "flag", label: "Flag", category: "missions", keywords: ["challenge", "campaign", "mission"] },
  { value: "camera", label: "Camera", category: "missions", keywords: ["proof", "upload", "photo"] },
  { value: "map-pin", label: "Map pin", category: "missions", keywords: ["check-in", "location", "visit"] },
  { value: "utensils", label: "Utensils", category: "lifestyle", keywords: ["meal", "food", "ticket"] },
  { value: "coffee", label: "Coffee", category: "lifestyle", keywords: ["drink", "voucher", "meal"] },
  { value: "shirt", label: "Shirt", category: "lifestyle", keywords: ["fashion", "merch", "apparel"] },
  { value: "device-mobile", label: "Mobile", category: "tech", keywords: ["phone", "device", "data"] },
  { value: "headphones", label: "Headphones", category: "tech", keywords: ["audio", "music", "tech"] },
  { value: "wifi", label: "Wifi", category: "tech", keywords: ["internet", "data", "connectivity"] },
];

export type RewardIconName = string;

const rewardIconOptionByValue = new Map(rewardIconOptions.map((option) => [option.value, option]));

const legacyRewardIconAliases: Record<string, string> = {
  BOOST: "bolt",
  BOOK: "book",
  CERT: "certificate",
  COIN: "coins",
  COINS: "coins",
  GIFT: "gift",
  MEAL: "utensils",
  MOBILE: "device-mobile",
  PERK: "sparkles",
  SHOP: "shopping-bag",
  SPARK: "sparkles",
  STAR: "stars",
  STARS: "stars",
  TARGET: "target",
  TICKET: "ticket",
  TROPHY: "trophy",
  XP: "coins",
};

export function isRewardIconName(value: string): value is RewardIconName {
  return Boolean(value.trim());
}

export function getRewardIconNameFromLegacy(icon: string | null | undefined) {
  const normalized = icon?.trim().toUpperCase();

  if (!normalized) {
    return undefined;
  }

  return legacyRewardIconAliases[normalized];
}

export function getRewardIconOption(iconName: string) {
  return rewardIconOptionByValue.get(iconName);
}

export function getRewardThumbnailEditorState(thumbnail: RewardThumbnail) {
  if (thumbnail.iconSet === "tabler" && thumbnail.iconName && isRewardIconName(thumbnail.iconName)) {
    return {
      iconName: thumbnail.iconName,
      legacyIcon: "",
    };
  }

  const aliasedIconName = getRewardIconNameFromLegacy(thumbnail.icon);

  if (aliasedIconName) {
    return {
      iconName: aliasedIconName,
      legacyIcon: "",
    };
  }

  return {
    iconName: "",
    legacyIcon: thumbnail.icon ?? "",
  };
}
