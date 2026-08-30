export const ORGANIZATION_ENTITLEMENT_KEYS = [
  "max_courses",
  "max_total_lessons",
  "allowed_lesson_block_types",
  "max_storage_bytes",
  "ai_authoring_enabled",
  "max_active_missions",
  "allowed_mission_types",
  "allowed_mission_reward_modes",
  "max_xp_accounts",
  "max_active_rewards",
  "allowed_reward_fulfillment_types",
  "max_open_reward_claims",
  "max_fulfilled_reward_claims_per_month",
  "assessment_capability",
  "reporting_level",
  "ai_monthly_allocation",
  "ai_temporary_allocation",
  "ai_top_up_allocation",
  "ai_warning_threshold",
  "ai_hard_limit",
  "ai_user_rate_limit_per_day",
  "ai_organization_concurrency_limit",
  "allowed_ai_operation_types",
  "allowed_ai_roles",
  "daily_quiz_xp_limit",
  "admin_manual_grant_daily_limit",
] as const;

export type OrganizationEntitlementKey = typeof ORGANIZATION_ENTITLEMENT_KEYS[number];

export type OrganizationAssessmentCapability =
  | "assigned_only"
  | "template_use"
  | "template_adaptation"
  | "custom";

export type OrganizationReportingLevel =
  | "basic"
  | "standard"
  | "advanced"
  | "enterprise";

export type OrganizationEntitlements = {
  maxCourses: number;
  maxTotalLessons: number;
  allowedLessonBlockTypes: string[];
  maxStorageBytes: number;
  aiAuthoringEnabled: boolean;
  maxActiveMissions: number;
  allowedMissionTypes: string[];
  allowedMissionRewardModes: string[];
  maxXpAccounts: number;
  maxActiveRewards: number;
  allowedRewardFulfillmentTypes: string[];
  maxOpenRewardClaims: number;
  maxFulfilledRewardClaimsPerMonth: number;
  assessmentCapability: OrganizationAssessmentCapability;
  reportingLevel: OrganizationReportingLevel;
  aiMonthlyAllocation: number;
  aiTemporaryAllocation: number;
  aiTopUpAllocation: number;
  aiWarningThreshold: number;
  aiHardLimit: number;
  aiUserRateLimitPerDay: number;
  aiOrganizationConcurrencyLimit: number;
  allowedAiOperationTypes: string[];
  allowedAiRoles: string[];
  dailyQuizXpLimit: number | null;
  adminManualGrantDailyLimit: number | null;
};

export const STARTER_ORGANIZATION_ENTITLEMENTS: OrganizationEntitlements = {
  maxCourses: 1,
  maxTotalLessons: 5,
  allowedLessonBlockTypes: ["text", "image", "table", "callout"],
  maxStorageBytes: 100 * 1024 * 1024,
  aiAuthoringEnabled: false,
  maxActiveMissions: 2,
  allowedMissionTypes: ["course_completed", "lesson_count_completed"],
  allowedMissionRewardModes: ["organization_xp"],
  maxXpAccounts: 1,
  maxActiveRewards: 1,
  allowedRewardFulfillmentTypes: ["manual_claim_form"],
  maxOpenRewardClaims: 25,
  maxFulfilledRewardClaimsPerMonth: 25,
  assessmentCapability: "assigned_only",
  reportingLevel: "basic",
  aiMonthlyAllocation: 0,
  aiTemporaryAllocation: 0,
  aiTopUpAllocation: 0,
  aiWarningThreshold: 0,
  aiHardLimit: 0,
  aiUserRateLimitPerDay: 0,
  aiOrganizationConcurrencyLimit: 0,
  allowedAiOperationTypes: [],
  allowedAiRoles: [],
  dailyQuizXpLimit: null,
  adminManualGrantDailyLimit: null,
};

type EntitlementJson = Record<string, unknown>;

function toFiniteLimit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function toStringList(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : fallback;
}

function toOptionalFiniteLimit(value: unknown, fallback: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function toAssessmentCapability(value: unknown, fallback: OrganizationAssessmentCapability) {
  return value === "assigned_only"
    || value === "template_use"
    || value === "template_adaptation"
    || value === "custom"
    ? value
    : fallback;
}

function toReportingLevel(value: unknown, fallback: OrganizationReportingLevel) {
  return value === "basic"
    || value === "standard"
    || value === "advanced"
    || value === "enterprise"
    ? value
    : fallback;
}

export function parseOrganizationEntitlements(
  value: unknown,
  fallback: OrganizationEntitlements = STARTER_ORGANIZATION_ENTITLEMENTS,
): OrganizationEntitlements {
  const source: EntitlementJson = value && typeof value === "object" && !Array.isArray(value)
    ? value as EntitlementJson
    : {};

  return {
    maxCourses: toFiniteLimit(source.max_courses, fallback.maxCourses),
    maxTotalLessons: toFiniteLimit(source.max_total_lessons, fallback.maxTotalLessons),
    allowedLessonBlockTypes: toStringList(source.allowed_lesson_block_types, fallback.allowedLessonBlockTypes),
    maxStorageBytes: toFiniteLimit(source.max_storage_bytes, fallback.maxStorageBytes),
    aiAuthoringEnabled: toBoolean(source.ai_authoring_enabled, fallback.aiAuthoringEnabled),
    maxActiveMissions: toFiniteLimit(source.max_active_missions, fallback.maxActiveMissions),
    allowedMissionTypes: toStringList(source.allowed_mission_types, fallback.allowedMissionTypes),
    allowedMissionRewardModes: toStringList(source.allowed_mission_reward_modes, fallback.allowedMissionRewardModes),
    maxXpAccounts: toFiniteLimit(source.max_xp_accounts, fallback.maxXpAccounts),
    maxActiveRewards: toFiniteLimit(source.max_active_rewards, fallback.maxActiveRewards),
    allowedRewardFulfillmentTypes: toStringList(
      source.allowed_reward_fulfillment_types,
      fallback.allowedRewardFulfillmentTypes,
    ),
    maxOpenRewardClaims: toFiniteLimit(source.max_open_reward_claims, fallback.maxOpenRewardClaims),
    maxFulfilledRewardClaimsPerMonth: toFiniteLimit(
      source.max_fulfilled_reward_claims_per_month,
      fallback.maxFulfilledRewardClaimsPerMonth,
    ),
    assessmentCapability: toAssessmentCapability(source.assessment_capability, fallback.assessmentCapability),
    reportingLevel: toReportingLevel(source.reporting_level, fallback.reportingLevel),
    aiMonthlyAllocation: toFiniteLimit(source.ai_monthly_allocation, fallback.aiMonthlyAllocation),
    aiTemporaryAllocation: toFiniteLimit(source.ai_temporary_allocation, fallback.aiTemporaryAllocation),
    aiTopUpAllocation: toFiniteLimit(source.ai_top_up_allocation, fallback.aiTopUpAllocation),
    aiWarningThreshold: toFiniteLimit(source.ai_warning_threshold, fallback.aiWarningThreshold),
    aiHardLimit: toFiniteLimit(source.ai_hard_limit, fallback.aiHardLimit),
    aiUserRateLimitPerDay: toFiniteLimit(source.ai_user_rate_limit_per_day, fallback.aiUserRateLimitPerDay),
    aiOrganizationConcurrencyLimit: toFiniteLimit(
      source.ai_organization_concurrency_limit,
      fallback.aiOrganizationConcurrencyLimit,
    ),
    allowedAiOperationTypes: toStringList(source.allowed_ai_operation_types, fallback.allowedAiOperationTypes),
    allowedAiRoles: toStringList(source.allowed_ai_roles, fallback.allowedAiRoles),
    dailyQuizXpLimit: toOptionalFiniteLimit(source.daily_quiz_xp_limit, fallback.dailyQuizXpLimit),
    adminManualGrantDailyLimit: toOptionalFiniteLimit(
      source.admin_manual_grant_daily_limit,
      fallback.adminManualGrantDailyLimit,
    ),
  };
}

export function organizationEntitlementAllowsInteger(
  entitlements: OrganizationEntitlements,
  entitlementKey: keyof Pick<
    OrganizationEntitlements,
    | "maxCourses"
    | "maxTotalLessons"
    | "maxStorageBytes"
    | "maxActiveMissions"
    | "maxXpAccounts"
    | "maxActiveRewards"
    | "maxOpenRewardClaims"
    | "maxFulfilledRewardClaimsPerMonth"
  >,
  requestedValue: number,
) {
  return Number.isInteger(requestedValue)
    && requestedValue >= 0
    && requestedValue <= entitlements[entitlementKey];
}
