import {
  formFailed,
  formOk,
  getBooleanFlag,
  getFormEnum,
  getFormInteger,
  getFormString,
  getFormStringList,
  getFormUrl,
  getOptionalFormDate,
  getOptionalFormString,
  getRequiredFormDate,
} from "./form-data-validation.ts";
import type { ValidationIssue } from "./request-validation.ts";

const adStatuses = ["draft", "active", "paused", "ended", "archived"] as const;
const partnerStatuses = ["draft", "active", "paused", "archived"] as const;
const campaignTypes = ["guaranteed", "house", "sponsorship"] as const;
const pricingModels = ["flat_fee", "cpm", "cpc", "make_good"] as const;
const roundingModes = ["half_up", "floor", "ceiling"] as const;
const pacingModes = ["even", "asap", "manual"] as const;
const creativeFormats = ["native_card"] as const;
const creativeVersionStatuses = ["draft", "submitted"] as const;
const adEntityTypes = ["partner", "campaign", "creative", "creative_version", "flight"] as const;
const returnPaths = new Set([
  "/admin/ads",
  "/admin/ads/launch",
  "/admin/ads/review",
  "/admin/ads/reporting",
  "/admin/ads/inventory",
]);

function result<T>(issues: ValidationIssue[], data: T) {
  return issues.length > 0 ? formFailed<T>(issues) : formOk(data);
}

function getPositiveInteger(formData: FormData, key: string, issues: ValidationIssue[], fallback = 1) {
  return getFormInteger(formData, key, issues, { fallback, min: 1 }) ?? fallback;
}

function getOptionalPositiveIntegerOrBlank(formData: FormData, key: string, issues: ValidationIssue[]) {
  const value = getFormInteger(formData, key, issues, { fallback: 0, min: 0 }) ?? 0;
  return value || "";
}

function getReturnPath(formData: FormData, fallback: string, issues: ValidationIssue[]) {
  const rawPath = getOptionalFormString(formData, "returnPath", issues, {
    allowEmpty: true,
    maxLength: 120,
  });
  return returnPaths.has(rawPath) ? rawPath : fallback;
}

function getAdvertiseFallbackUrl(formData: FormData, key: string, issues: ValidationIssue[]) {
  const trimmed = getOptionalFormString(formData, key, issues, {
    allowEmpty: true,
    maxLength: 400,
  }) || "/advertise";

  if (
    trimmed === "/advertise" ||
    trimmed === "/advertise/inquiry" ||
    trimmed.startsWith("/advertise?") ||
    trimmed.startsWith("/advertise#")
  ) {
    return trimmed;
  }

  issues.push({
    path: key,
    message: "Must stay on the Project VE advertising page.",
  });
  return "/advertise";
}

export function slugifyAdValue(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function parseAdPlacementFallbackForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return result(issues, {
    body: getOptionalFormString(formData, "houseFallbackBody", issues, {
      allowEmpty: true,
      maxLength: 500,
    }),
    ctaLabel: getOptionalFormString(formData, "houseFallbackCtaLabel", issues, {
      allowEmpty: true,
      maxLength: 80,
    }),
    ctaUrl: getAdvertiseFallbackUrl(formData, "houseFallbackCtaUrl", issues),
    enabled: getBooleanFlag(formData, "houseFallbackEnabled", "true"),
    eyebrow: getOptionalFormString(formData, "houseFallbackEyebrow", issues, {
      allowEmpty: true,
      maxLength: 80,
    }),
    headline: getOptionalFormString(formData, "houseFallbackHeadline", issues, {
      allowEmpty: true,
      maxLength: 160,
    }),
    placementKey: getFormString(formData, "placementKey", issues, { maxLength: 80 }) ?? "",
  });
}

export function parseAdPartnerForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const name = getFormString(formData, "name", issues, { maxLength: 160 }) ?? "";
  const partnerId = getOptionalFormString(formData, "partnerId", issues, {
    allowEmpty: true,
    maxLength: 120,
  });
  const id = partnerId || `ad-partner-${slugifyAdValue(name, "partner")}`;

  return result(issues, {
    id,
    allowedCtaDomains: getFormStringList(formData, "allowedCtaDomains", issues)
      .map((domain) => domain.toLowerCase()),
    contactEmail: getOptionalFormString(formData, "contactEmail", issues, {
      allowEmpty: true,
      maxLength: 160,
    }),
    contactName: getOptionalFormString(formData, "contactName", issues, {
      allowEmpty: true,
      maxLength: 160,
    }),
    contractReference: getOptionalFormString(formData, "contractReference", issues, {
      allowEmpty: true,
      maxLength: 160,
    }),
    name,
    notes: getOptionalFormString(formData, "notes", issues, {
      allowEmpty: true,
      maxLength: 1000,
    }),
    slug: slugifyAdValue(name, id),
    status: getFormEnum(formData, "status", partnerStatuses, issues, "draft"),
    termsAccepted: getBooleanFlag(formData, "termsAccepted", "true"),
    websiteUrl: getFormUrl(formData, "websiteUrl", issues, {
      allowEmpty: true,
      httpsOnly: true,
      maxLength: 300,
      required: false,
    }),
  });
}

export function parseAdCampaignForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const name = getFormString(formData, "name", issues, { maxLength: 180 }) ?? "";
  const campaignId = getOptionalFormString(formData, "campaignId", issues, {
    allowEmpty: true,
    maxLength: 120,
  });
  const startsAt = getOptionalFormDate(formData, "startsAt", issues);
  const endsAt = getOptionalFormDate(formData, "endsAt", issues);

  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    issues.push({ path: "endsAt", message: "Must be after startsAt." });
  }

  return result(issues, {
    id: campaignId || `ad-campaign-${slugifyAdValue(name, "campaign")}`,
    allowOverspend: getBooleanFlag(formData, "allowOverspend", "true"),
    billableBudgetAmount: getOptionalPositiveIntegerOrBlank(formData, "billableBudgetAmount", issues),
    budgetLabel: getOptionalFormString(formData, "budgetLabel", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    campaignType: getFormEnum(formData, "campaignType", campaignTypes, issues, "guaranteed"),
    competitorExclusionKeys: getFormStringList(formData, "competitorExclusionKeys", issues),
    contractedClicks: getOptionalPositiveIntegerOrBlank(formData, "contractedClicks", issues),
    contractedImpressions: getOptionalPositiveIntegerOrBlank(formData, "contractedImpressions", issues),
    contractedViewableImpressions: getOptionalPositiveIntegerOrBlank(formData, "contractedViewableImpressions", issues),
    currency: (getOptionalFormString(formData, "currency", issues, {
      allowEmpty: true,
      maxLength: 3,
    }) || "NGN").toUpperCase(),
    endsAt,
    excludedContentTags: getFormStringList(formData, "excludedContentTags", issues),
    excludedCourseCategories: getFormStringList(formData, "excludedCourseCategories", issues),
    excludedCourseIds: getFormStringList(formData, "excludedCourseIds", issues),
    excludedLessonIds: getFormStringList(formData, "excludedLessonIds", issues),
    excludedPageTypes: getFormStringList(formData, "excludedPageTypes", issues),
    grossBudgetAmount: getOptionalPositiveIntegerOrBlank(formData, "grossBudgetAmount", issues),
    includedContentTags: getFormStringList(formData, "includedContentTags", issues),
    includedCourseCategories: getFormStringList(formData, "includedCourseCategories", issues),
    includedCourseIds: getFormStringList(formData, "includedCourseIds", issues),
    includedLessonIds: getFormStringList(formData, "includedLessonIds", issues),
    makeGoodPolicy: getOptionalFormString(formData, "makeGoodPolicy", issues, {
      allowEmpty: true,
      maxLength: 1000,
    }),
    minorUnit: getFormInteger(formData, "minorUnit", issues, { fallback: 2, min: 0, max: 6 }) ?? 2,
    name,
    notes: getOptionalFormString(formData, "notes", issues, {
      allowEmpty: true,
      maxLength: 1000,
    }),
    overspendTolerancePercent: getFormInteger(formData, "overspendTolerancePercent", issues, {
      fallback: 0,
      min: 0,
      max: 100,
    }) ?? 0,
    pacingMode: getFormEnum(formData, "pacingMode", pacingModes, issues, "even"),
    partnerId: getFormString(formData, "partnerId", issues, { maxLength: 120 }) ?? "",
    pricingModel: getFormEnum(formData, "pricingModel", pricingModels, issues, "flat_fee"),
    priority: getFormInteger(formData, "priority", issues, { fallback: 0, min: 0 }) ?? 0,
    rateAmount: getFormInteger(formData, "rateAmount", issues, { fallback: 0, min: 0 }) ?? 0,
    roundingMode: getFormEnum(formData, "roundingMode", roundingModes, issues, "half_up"),
    spendCapAmount: getOptionalPositiveIntegerOrBlank(formData, "spendCapAmount", issues),
    startsAt,
    status: getFormEnum(formData, "status", adStatuses, issues, "draft"),
    timezone: getOptionalFormString(formData, "timezone", issues, {
      allowEmpty: true,
      maxLength: 80,
    }) || "Africa/Lagos",
  });
}

export function parseAdCreativeVersionForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return result(issues, {
    body: getFormString(formData, "body", issues, { maxLength: 500 }) ?? "",
    campaignId: getFormString(formData, "campaignId", issues, { maxLength: 120 }) ?? "",
    creativeFormat: getFormEnum(formData, "creativeFormat", creativeFormats, issues, "native_card"),
    creativeId: getOptionalFormString(formData, "creativeId", issues, {
      allowEmpty: true,
      maxLength: 120,
    }),
    creativeStatus: getFormEnum(formData, "creativeStatus", adStatuses, issues, "active"),
    ctaLabel: getFormString(formData, "ctaLabel", issues, { maxLength: 80 }) ?? "",
    ctaUrl: getFormUrl(formData, "ctaUrl", issues, {
      allowEmpty: false,
      httpsOnly: true,
      maxLength: 400,
    }),
    disclosureLabel: getOptionalFormString(formData, "disclosureLabel", issues, {
      allowEmpty: true,
      maxLength: 40,
    }) || "Sponsored",
    eyebrow: getOptionalFormString(formData, "eyebrow", issues, {
      allowEmpty: true,
      maxLength: 80,
    }),
    headline: getFormString(formData, "headline", issues, { maxLength: 160 }) ?? "",
    imageAlt: getFormString(formData, "imageAlt", issues, {
      maxLength: 160,
      minLength: 10,
    }) ?? "",
    legalText: getOptionalFormString(formData, "legalText", issues, {
      allowEmpty: true,
      maxLength: 300,
    }),
    name: getFormString(formData, "name", issues, { maxLength: 180 }) ?? "",
    sponsorLabel: getFormString(formData, "sponsorLabel", issues, { maxLength: 120 }) ?? "",
    versionStatus: getFormEnum(formData, "versionStatus", creativeVersionStatuses, issues, "submitted"),
    weight: getPositiveInteger(formData, "weight", issues, 1),
  });
}

export function parseAdFlightForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const sequencePageNumber = getFormInteger(formData, "sequencePageNumber", issues, {
    fallback: 0,
    min: 0,
  }) ?? 0;
  const allowConsecutiveCreative = getBooleanFlag(formData, "allowConsecutiveCreative", "true");
  const startsAt = getOptionalFormDate(formData, "startsAt", issues);
  const endsAt = getOptionalFormDate(formData, "endsAt", issues);

  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    issues.push({ path: "endsAt", message: "Must be after startsAt." });
  }

  return result(issues, {
    allowConsecutiveCreative,
    brandExcludedContentTags: getFormStringList(formData, "brandExcludedContentTags", issues),
    brandExcludedPageTypes: getFormStringList(formData, "brandExcludedPageTypes", issues),
    brandIncludedPageTypes: getFormStringList(formData, "brandIncludedPageTypes", issues),
    campaignId: getFormString(formData, "campaignId", issues, { maxLength: 120 }) ?? "",
    competitorExclusionKeys: getFormStringList(formData, "competitorExclusionKeys", issues),
    creativeVersionId: getFormString(formData, "creativeVersionId", issues, { maxLength: 120 }) ?? "",
    deliveryGoalClicks: getOptionalPositiveIntegerOrBlank(formData, "deliveryGoalClicks", issues),
    deliveryGoalImpressions: getOptionalPositiveIntegerOrBlank(formData, "deliveryGoalImpressions", issues),
    endsAt,
    experimentKey: getOptionalFormString(formData, "experimentKey", issues, {
      allowEmpty: true,
      maxLength: 80,
    }),
    experimentVariants: getFormStringList(formData, "experimentVariants", issues),
    excludedSegmentKeys: getFormStringList(formData, "excludedSegmentKeys", issues),
    includedSegmentKeys: getFormStringList(formData, "includedSegmentKeys", issues),
    placementKey: getFormString(formData, "placementKey", issues, { maxLength: 80 }) ?? "",
    priority: getFormInteger(formData, "priority", issues, { fallback: 0, min: 0 }) ?? 0,
    sequenceRules: {
      ...(sequencePageNumber > 0 ? { pageNumber: sequencePageNumber } : {}),
      ...(allowConsecutiveCreative ? { allowConsecutiveCreative: true } : {}),
    },
    sessionMaxPaidAds: getPositiveInteger(formData, "sessionMaxPaidAds", issues, 5),
    startsAt,
    status: getFormEnum(formData, "status", adStatuses, issues, "active"),
    userDailyCampaignImpressions: getPositiveInteger(formData, "userDailyCampaignImpressions", issues, 3),
    userDailyCreativeVersionImpressions: getPositiveInteger(formData, "userDailyCreativeVersionImpressions", issues, 2),
    userWeeklyPartnerImpressions: getPositiveInteger(formData, "userWeeklyPartnerImpressions", issues, 5),
    weight: getPositiveInteger(formData, "weight", issues, 1),
  });
}

export function parseAdEntityStatusForm(formData: FormData) {
  const issues: ValidationIssue[] = [];

  return result(issues, {
    entityId: getFormString(formData, "entityId", issues, { maxLength: 120 }) ?? "",
    entityType: getFormEnum(formData, "entityType", adEntityTypes, issues),
    reason: getOptionalFormString(formData, "reason", issues, {
      allowEmpty: true,
      maxLength: 300,
    }) || null,
    returnPath: getReturnPath(formData, "/admin/ads/review", issues),
    status: getFormEnum(formData, "status", adStatuses, issues, "paused"),
  });
}

export function parseAdBillingSnapshotForm(formData: FormData) {
  const issues: ValidationIssue[] = [];
  const periodStart = getRequiredFormDate(formData, "periodStart", issues);
  const periodEnd = getRequiredFormDate(formData, "periodEnd", issues);

  if (periodStart && periodEnd && new Date(periodEnd).getTime() <= new Date(periodStart).getTime()) {
    issues.push({ path: "periodEnd", message: "Must be after periodStart." });
  }

  return result(issues, {
    campaignId: getFormString(formData, "campaignId", issues, { maxLength: 120 }) ?? "",
    periodEnd,
    periodStart,
  });
}
