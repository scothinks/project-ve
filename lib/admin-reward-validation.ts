import { isRewardIconName } from "./reward-icons.ts";
import {
  formFailed,
  formOk,
  getBooleanFlag,
  getFormEnum,
  getFormInteger,
  getFormString,
  getFormStringArray,
  getFormUrl,
  getOptionalFormDate,
  getOptionalFormInteger,
  getOptionalFormString,
  getRequiredFormDate,
  parseFormJsonObject,
} from "./form-data-validation.ts";
import type { ValidationIssue } from "./request-validation.ts";

const rewardStatuses = ["draft", "published", "archived"] as const;
const distributionModes = ["direct", "perk_bundle"] as const;
const fulfillmentTypes = ["manual", "voucher_code", "qr_code", "native"] as const;
const visibilityModes = ["store", "hidden", "system_only"] as const;
const limitPeriods = ["none", "daily", "weekly", "monthly", "lifetime"] as const;
const prizeTypes = ["native_xp", "xp_boost", "reward"] as const;
const rewardOwnerScopes = ["platform_owned", "organization_owned", "programme_sponsored"] as const;

export type RewardThumbnailPayload = {
  color?: string;
  icon?: string;
  iconName?: string;
  iconSet?: string;
  url?: string;
};

export type RewardMutationPayload = {
  campaignId: string | null;
  claimSteps: string[];
  costXp: number;
  description: string;
  distributionMode: "direct" | "perk_bundle";
  fulfillmentConfig: Record<string, unknown>;
  fulfillmentType: "manual" | "voucher_code" | "qr_code" | "native";
  isEnabled: boolean;
  limitPeriod: "none" | "daily" | "weekly" | "monthly" | "lifetime";
  offerExpiresAt: string | null;
  organizationId: string | null;
  ownerScope: "platform_owned" | "organization_owned" | "programme_sponsored";
  perUserLimit: number;
  redemptionWindowDays: number | null;
  rewardId: string;
  sharedWithProgrammes: boolean;
  sortOrder: number;
  sponsoredProgrammeId: string | null;
  status: "draft" | "published" | "archived";
  terms: string;
  thumbnail: RewardThumbnailPayload;
  title: string;
  totalAvailable: number;
  visibilityMode: "store" | "hidden" | "system_only";
};

function result<T>(issues: ValidationIssue[], data: T) {
  return issues.length > 0 ? formFailed<T>(issues) : formOk(data);
}

function positive(formData: FormData, key: string, issues: ValidationIssue[], fallback = 1) {
  return getFormInteger(formData, key, issues, { fallback, min: 1 }) ?? fallback;
}

function optionalPositive(formData: FormData, key: string, issues: ValidationIssue[]) {
  return getOptionalFormInteger(formData, key, issues, { min: 1 });
}

function parseClaimSteps(formData: FormData, issues: ValidationIssue[]) {
  return getOptionalFormString(formData, "claimSteps", issues, {
    allowEmpty: true,
    maxLength: 5000,
  })
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean)
    .map((step) => step.slice(0, 300));
}

function parseRewardThumbnailFields(formData: FormData, issues: ValidationIssue[]): RewardThumbnailPayload {
  const url = getFormUrl(formData, "thumbnailUrl", issues, {
    allowEmpty: true,
    maxLength: 1000,
    required: false,
  }) || undefined;
  const color = getOptionalFormString(formData, "thumbnailColor", issues, {
    allowEmpty: true,
    maxLength: 32,
  }) || undefined;
  const iconSetRaw = getOptionalFormString(formData, "thumbnailIconSet", issues, {
    allowEmpty: true,
    maxLength: 24,
  });
  const iconNameRaw = getOptionalFormString(formData, "thumbnailIconName", issues, {
    allowEmpty: true,
    maxLength: 40,
  });
  const legacyIcon = getOptionalFormString(formData, "thumbnailLegacyIcon", issues, {
    allowEmpty: true,
    maxLength: 24,
  }) || undefined;
  const useLegacyIcon = getBooleanFlag(formData, "thumbnailUseLegacyIcon", "true");
  const iconName = isRewardIconName(iconNameRaw) ? iconNameRaw : undefined;

  return {
    color,
    icon: useLegacyIcon ? legacyIcon : undefined,
    iconName: iconSetRaw === "tabler" ? iconName : undefined,
    iconSet: iconSetRaw === "tabler" && iconName ? "tabler" : undefined,
    url,
  };
}

export function parseRewardThumbnailForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  return result(issues, parseRewardThumbnailFields(formData, issues));
}

export function parseRewardPayloadForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const fulfillmentType = getFormEnum(formData, "fulfillmentType", fulfillmentTypes, issues, "manual");
  const distributionMode = getFormEnum(formData, "distributionMode", distributionModes, issues, "direct");
  const limitPeriod = getFormEnum(formData, "limitPeriod", limitPeriods, issues, "lifetime");
  const ownerScope = getFormEnum(formData, "ownerScope", rewardOwnerScopes, issues, "platform_owned") ?? "platform_owned";

  const data: RewardMutationPayload = {
    campaignId: getOptionalFormString(formData, "campaignId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }) || null,
    claimSteps: parseClaimSteps(formData, issues),
    costXp: positive(formData, "costXp", issues, 1),
    description: getOptionalFormString(formData, "description", issues, {
      allowEmpty: true,
      maxLength: 500,
    }),
    distributionMode: distributionMode ?? "direct",
    fulfillmentConfig: parseFormJsonObject(formData, "fulfillmentConfig", issues),
    fulfillmentType: fulfillmentType ?? "manual",
    isEnabled: getBooleanFlag(formData, "isEnabled"),
    limitPeriod: limitPeriod ?? "lifetime",
    offerExpiresAt: getOptionalFormDate(formData, "offerExpiresAt", issues),
    organizationId: getOptionalFormString(formData, "organizationId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }) || null,
    ownerScope,
    perUserLimit: limitPeriod === "none" ? 1 : positive(formData, "perUserLimit", issues, 1),
    redemptionWindowDays: getOptionalFormInteger(formData, "redemptionWindowDays", issues, { min: 1 }),
    rewardId: getOptionalFormString(formData, "rewardId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    sharedWithProgrammes: getBooleanFlag(formData, "sharedWithProgrammes"),
    sortOrder: getFormInteger(formData, "sortOrder", issues, { fallback: 0 }) ?? 0,
    sponsoredProgrammeId: getOptionalFormString(formData, "sponsoredProgrammeId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }) || null,
    status: getFormEnum(formData, "status", rewardStatuses, issues, "draft") ?? "draft",
    terms: getOptionalFormString(formData, "terms", issues, {
      allowEmpty: true,
      maxLength: 1000,
    }),
    thumbnail: parseRewardThumbnailFields(formData, issues),
    title: getFormString(formData, "title", issues, { maxLength: 140 }) ?? "",
    totalAvailable: getOptionalFormInteger(formData, "totalAvailable", issues, { min: 0 }) ?? 0,
    visibilityMode: getFormEnum(
      formData,
      "visibilityMode",
      visibilityModes,
      issues,
      fulfillmentType === "native" ? "system_only" : "store",
    ) ?? "store",
  };

  if (data.ownerScope === "organization_owned" && !data.organizationId) {
    issues.push({ path: "organizationId", message: "Organisation-owned rewards require an organisation." });
  }

  if (data.ownerScope === "programme_sponsored" && !data.sponsoredProgrammeId) {
    issues.push({ path: "sponsoredProgrammeId", message: "Programme-sponsored rewards require a programme." });
  }

  return result(issues, data);
}

export function parseRewardToggleForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return result(issues, {
    isEnabled: getBooleanFlag(formData, "isEnabled", "true"),
    redirectTo: getOptionalFormString(formData, "redirectTo", issues, {
      allowEmpty: true,
      maxLength: 400,
    }) || "/admin/rewards",
    rewardId: getFormString(formData, "rewardId", issues, { maxLength: 120 }) ?? "",
  });
}

export function parseRewardStatusForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const status = getFormEnum(formData, "status", rewardStatuses, issues, "draft") ?? "draft";

  return result(issues, {
    isEnabled: status === "published",
    redirectTo: getOptionalFormString(formData, "redirectTo", issues, {
      allowEmpty: true,
      maxLength: 400,
    }) || "/admin/rewards/perks",
    rewardId: getFormString(formData, "rewardId", issues, { maxLength: 120 }) ?? "",
    status,
  });
}

export function parseSavePerkPrizeForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const prizeType = getFormEnum(formData, "prizeType", prizeTypes, issues, "native_xp");
  const multiplier = Number(String(formData.get("multiplier") ?? 2));

  return result(issues, {
    amount: positive(formData, "amount", issues, 1),
    availableFrom: getOptionalFormDate(formData, "availableFrom", issues),
    bundleRewardId: getFormString(formData, "bundleRewardId", issues, { maxLength: 120 }) ?? "",
    dailyWinCap: optionalPositive(formData, "dailyWinCap", issues),
    durationHours: positive(formData, "durationHours", issues, 24),
    expiresAt: getOptionalFormDate(formData, "expiresAt", issues),
    isEnabled: getBooleanFlag(formData, "isEnabled"),
    multiplier: Number.isFinite(multiplier) ? Math.max(1.1, multiplier) : 2,
    prizeId: getOptionalFormString(formData, "prizeId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    prizeType,
    redirectTo: getOptionalFormString(formData, "redirectTo", issues, {
      allowEmpty: true,
      maxLength: 400,
    }),
    sortOrder: getFormInteger(formData, "sortOrder", issues, { fallback: 0 }) ?? 0,
    sourceRewardId: getOptionalFormString(formData, "sourceRewardId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }) || null,
    thumbnail: parseRewardThumbnailFields(formData, issues),
    title: getOptionalFormString(formData, "title", issues, {
      allowEmpty: true,
      maxLength: 140,
    }) || null,
    totalWinCap: optionalPositive(formData, "totalWinCap", issues),
    uses: positive(formData, "uses", issues, 1),
    weight: positive(formData, "weight", issues, 1),
  });
}

export function parsePerkPrizeToggleForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const bundleRewardId = getFormString(formData, "bundleRewardId", issues, { maxLength: 120 }) ?? "";

  return result(issues, {
    bundleRewardId,
    isEnabled: getBooleanFlag(formData, "isEnabled", "true"),
    prizeId: getFormString(formData, "prizeId", issues, { maxLength: 120 }) ?? "",
    redirectTo: getOptionalFormString(formData, "redirectTo", issues, {
      allowEmpty: true,
      maxLength: 400,
    }) || `/admin/rewards/perks/${bundleRewardId}`,
  });
}

export function parseBulkPerkRewardPrizesForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const sourceRewardIds = Array.from(new Set(getFormStringArray(formData, "sourceRewardIds", issues, {
    itemMaxLength: 120,
  })));

  if (sourceRewardIds.length === 0) {
    issues.push({ path: "sourceRewardIds", message: "Must include at least one item." });
  }

  return result(issues, {
    availableFrom: getOptionalFormDate(formData, "availableFrom", issues),
    baseSortOrder: getFormInteger(formData, "sortOrder", issues, { fallback: 0 }) ?? 0,
    baseWeight: positive(formData, "weight", issues, 1),
    bundleRewardId: getFormString(formData, "bundleRewardId", issues, { maxLength: 120 }) ?? "",
    dailyWinCap: optionalPositive(formData, "dailyWinCap", issues),
    expiresAt: getOptionalFormDate(formData, "expiresAt", issues),
    isEnabled: getBooleanFlag(formData, "isEnabled"),
    redirectTo: getOptionalFormString(formData, "redirectTo", issues, {
      allowEmpty: true,
      maxLength: 400,
    }),
    sourceRewardIds,
    totalWinCap: optionalPositive(formData, "totalWinCap", issues),
  });
}

export function parsePerkPrizeIdForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return result(issues, {
    bundleRewardId: getFormString(formData, "bundleRewardId", issues, { maxLength: 120 }) ?? "",
    prizeId: getFormString(formData, "prizeId", issues, { maxLength: 120 }) ?? "",
  });
}

export function parsePerkInventoryMutationForm(formData: FormData, fallbackReason: string) {
  const issues: ValidationIssue[] = [];

  return result(issues, {
    availableFrom: getOptionalFormDate(formData, "availableFrom", issues),
    bundleRewardId: getFormString(formData, "bundleRewardId", issues, { maxLength: 120 }) ?? "",
    expiresAt: getOptionalFormDate(formData, "expiresAt", issues),
    prizeId: getFormString(formData, "prizeId", issues, { maxLength: 120 }) ?? "",
    quantity: positive(formData, "quantity", issues, 1),
    reason: getOptionalFormString(formData, "reason", issues, {
      allowEmpty: true,
      maxLength: 160,
    }) || fallbackReason,
  });
}

export function parsePerkReleaseBucketForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const startsAt = getRequiredFormDate(formData, "startsAt", issues);
  const endsAt = getOptionalFormDate(formData, "endsAt", issues);

  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    issues.push({ path: "endsAt", message: "Must be after startsAt." });
  }

  return result(issues, {
    bucketId: getOptionalFormString(formData, "bucketId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    bundleRewardId: getFormString(formData, "bundleRewardId", issues, { maxLength: 120 }) ?? "",
    endsAt,
    isEnabled: getBooleanFlag(formData, "isEnabled"),
    label: getOptionalFormString(formData, "label", issues, {
      allowEmpty: true,
      maxLength: 120,
    }) || null,
    prizeId: getFormString(formData, "prizeId", issues, { maxLength: 120 }) ?? "",
    releaseCap: positive(formData, "releaseCap", issues, 1),
    sortOrder: getFormInteger(formData, "sortOrder", issues, { fallback: 0 }) ?? 0,
    startsAt,
  });
}

export function parsePerkReleaseBucketDeleteForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return result(issues, {
    bucketId: getFormString(formData, "bucketId", issues, { maxLength: 120 }) ?? "",
    bundleRewardId: getFormString(formData, "bundleRewardId", issues, { maxLength: 120 }) ?? "",
  });
}
