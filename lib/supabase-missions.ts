import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MissionCategory,
  MissionProofField,
  MissionProofRequirementMode,
  MissionRewardType,
  MissionRepeatability,
  MissionValidationRule,
  UserMissionStatus,
  UserMissionSummary,
} from "@/lib/missions";
import { getMissionRewardLabel } from "@/lib/missions";
import type { RewardFulfillmentType } from "@/lib/rewards";
import { getCompletedLessonIds, getLessonProgress } from "@/lib/progress";

type DbMission = {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  reward_type: MissionRewardType;
  reward_xp: number | null;
  reward_id: string | null;
  rewards: {
    id: string;
    title: string;
    fulfillment_type: RewardFulfillmentType;
    fulfillment_config: Record<string, unknown> | null;
  } | null;
  repeatability: MissionRepeatability;
  validation_type: MissionValidationRule["type"];
  validation_config: Record<string, unknown>;
  presentation_config?: Record<string, unknown> | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type MissionPresentationOverride = {
  ctaLabel?: string;
  description?: string;
  eligibilityExplanation?: string;
  fullInstructions?: string;
  icon?: string;
  imageUrl?: string;
  pendingMessage?: string;
  rejectionMessage?: string;
  rewardExplanation?: string;
  shortDescription?: string;
  successMessage?: string;
  terms?: string;
  title?: string;
};

export type MissionPresentationOverrides = Record<string, MissionPresentationOverride>;

export type MissionExecutionContext = {
  deliveryId?: string;
  organizationId: string;
  organizationSlug?: string;
  programmeId: string | null;
  programmeMissionId: string | null;
  startsAt: string | null;
  dueAt: string | null;
  isRequired: boolean;
  xpAccountId: string | null;
  rewardXpOverride: number | null;
};

export type MissionExecutionContexts = Record<string, MissionExecutionContext>;

export type MissionDeliveryRequest = {
  deliveryId: string;
  executionContext?: MissionExecutionContext;
  missionId: string;
  presentationOverride?: MissionPresentationOverride;
};

function normalizeMissionReward(
  value: unknown,
): DbMission["rewards"] {
  if (Array.isArray(value)) {
    return normalizeMissionReward(value[0]);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const reward = value as Partial<NonNullable<DbMission["rewards"]>>;
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
    fulfillment_config:
      reward.fulfillment_config && typeof reward.fulfillment_config === "object"
        ? reward.fulfillment_config
        : null,
  };
}

function normalizeProofRequirementMode(value: unknown): MissionProofRequirementMode {
  return value === "any" ? "any" : "all";
}

function normalizeProofFieldList(value: unknown): MissionProofField[] {
  if (!Array.isArray(value)) {
    return ["text"];
  }

  const fields = value
    .map((item) => String(item))
    .filter((item): item is MissionProofField =>
      item === "image" || item === "video" || item === "text" || item === "link" || item === "location",
    );

  return fields.length > 0 ? fields : ["text"];
}

function getPresentationText(config: Record<string, unknown> | null | undefined, key: string) {
  const value = config?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolvePresentationText(
  override: MissionPresentationOverride | undefined,
  config: Record<string, unknown> | null | undefined,
  ...keys: Array<keyof MissionPresentationOverride | string>
) {
  for (const key of keys) {
    const overrideValue = override?.[key as keyof MissionPresentationOverride];
    if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
      return overrideValue.trim();
    }

    const configValue = getPresentationText(config, String(key));
    if (configValue) {
      return configValue;
    }
  }

  return undefined;
}

type MissionProgress = {
  progressCount: number;
  targetCount: number;
  valid: boolean;
};

type MissionProgressResult = {
  progress: MissionProgress;
  reviewStatus?: "submitted" | "approved" | "rejected";
  proofRequiredFields?: MissionProofField[];
  proofRequirementMode?: MissionProofRequirementMode;
  proofFieldStatuses?: Partial<Record<MissionProofField, "pending" | "submitted" | "approved" | "rejected">>;
  referralProgress?: {
    invitedCount: number;
    qualifiedIds: string[];
  };
};

const xpTimezone = "Africa/Lagos";

function getUserDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: xpTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getUserWeekKey(now = new Date()) {
  const [year, month, day] = getUserDateKey(now).split("-").map(Number);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() - dayOfWeek + 1);
  return localDate.toISOString().slice(0, 10);
}

function getNextDailyResetAt(now = new Date()) {
  return new Date(`${getUserDateKey(now)}T00:00:00+01:00`).getTime() + 24 * 60 * 60 * 1000;
}

function getNextWeeklyResetAt(now = new Date()) {
  return new Date(`${getUserWeekKey(now)}T00:00:00+01:00`).getTime() + 7 * 24 * 60 * 60 * 1000;
}

function getMissionPeriodScope(mission: DbMission) {
  switch (mission.repeatability) {
    case "daily":
      return `day:${getUserDateKey()}`;
    case "weekly":
      return `week:${getUserWeekKey()}`;
    case "campaign":
      return `campaign:${mission.starts_at ?? "open"}:${mission.ends_at ?? "open"}`;
    case "per_referral":
      return "referral";
    case "once":
      return "lifetime";
  }
}

function getMissionAwardScope(mission: DbMission, executionContext?: MissionExecutionContext) {
  const periodScope = getMissionPeriodScope(mission);

  if (!executionContext || mission.repeatability === "per_referral") {
    return periodScope;
  }

  if (!executionContext.programmeId) {
    return `organization:${executionContext.organizationId}:${periodScope}`;
  }

  return `programme:${executionContext.programmeId}:${periodScope}`;
}

function getReferralAwardScope(referredUserId: string, executionContext?: MissionExecutionContext) {
  const referralScope = `referral:${referredUserId}`;
  if (!executionContext) return referralScope;
  if (!executionContext.programmeId) return `organization:${executionContext.organizationId}:${referralScope}`;
  return `programme:${executionContext.programmeId}:${referralScope}`;
}

function assertMissionExecutionWindow(executionContext?: MissionExecutionContext) {
  if (!executionContext) return;

  const now = Date.now();

  if (executionContext.startsAt && new Date(executionContext.startsAt).getTime() > now) {
    throw new Error("Programme mission is not available yet.");
  }

  if (executionContext.dueAt && new Date(executionContext.dueAt).getTime() <= now) {
    throw new Error("Programme mission is past its due date.");
  }
}

function getMissionCompletionLabel(mission: DbMission) {
  switch (mission.repeatability) {
    case "daily":
      return "Completed today";
    case "weekly":
      return "Completed this week";
    case "campaign":
      return "Completed for campaign";
    case "per_referral":
      return "Awarded";
    case "once":
      return "Completed";
  }
}

function getMissionAvailableAgainAt(mission: DbMission) {
  if (mission.repeatability === "daily") {
    return new Date(getNextDailyResetAt()).toISOString();
  }

  if (mission.repeatability === "weekly") {
    return new Date(getNextWeeklyResetAt()).toISOString();
  }

  return undefined;
}

function normalizeProgress(progress: MissionProgress, forceComplete = false) {
  const targetCount = Math.max(1, Math.floor(progress.targetCount));
  const progressCount = Math.min(
    targetCount,
    Math.max(0, Math.floor(forceComplete ? targetCount : progress.progressCount)),
  );

  return {
    progressCount,
    targetCount,
    valid: progress.valid && progressCount >= targetCount,
  };
}

async function getProgrammeCourseIds(
  supabase: SupabaseClient,
  executionContext?: MissionExecutionContext,
) {
  if (!executionContext?.programmeId) return null;

  const { data, error } = await supabase
    .from("programme_courses")
    .select("course_id")
    .eq("programme_id", executionContext.programmeId);

  if (error) {
    throw error;
  }

  return Array.from(new Set((data ?? []).map((row) => String(row.course_id)).filter(Boolean)));
}

async function getScopedPublishedLessons(
  supabase: SupabaseClient,
  executionContext?: MissionExecutionContext,
  filter?: { courseId?: string; lessonId?: string },
) {
  const programmeCourseIds = await getProgrammeCourseIds(supabase, executionContext);

  if (programmeCourseIds && programmeCourseIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("lessons")
    .select("id, course_id, lesson_pages!lesson_pages_lesson_id_fkey(id)")
    .eq("status", "published");

  if (programmeCourseIds) {
    query = query.in("course_id", programmeCourseIds);
  }

  if (filter?.courseId) {
    query = query.eq("course_id", filter.courseId);
  }

  if (filter?.lessonId) {
    query = query.eq("id", filter.lessonId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((lesson) => ({
    id: String(lesson.id),
    courseId: String((lesson as { course_id: string }).course_id),
    pages: ((lesson as { lesson_pages?: Array<{ id: string }> }).lesson_pages ?? []).map((page, index) => ({
      id: String(page.id),
      order: index + 1,
    })),
  }));
}

async function hasMissionAward(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  awardScope: string,
) {
  const { data, error } = await supabase
    .from("mission_awards")
    .select("id")
    .eq("user_id", userId)
    .eq("mission_id", missionId)
    .eq("award_scope", awardScope)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function awardMissionXp(
  supabase: SupabaseClient,
  userId: string,
  mission: DbMission,
  awardScope: string,
) {
  void userId;

  if (await hasMissionAward(supabase, userId, mission.id, awardScope)) {
    return null;
  }

  const { data, error } = await supabase.rpc("award_valid_mission_xp", {
    p_mission_id: mission.id,
    p_award_scope: awardScope,
  });

  if (error) {
    throw error;
  }

  return data;
}

async function getLessonCompletedProgress(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  executionContext?: MissionExecutionContext,
): Promise<MissionProgress> {
  const [lessons, progress] = await Promise.all([
    getScopedPublishedLessons(supabase, executionContext, { lessonId }),
    getLessonProgress(supabase, userId),
  ]);

  if (lessons.length === 0) {
    return { progressCount: 0, targetCount: 1, valid: false };
  }

  const valid = getCompletedLessonIds(progress, lessons as never).has(lessonId);

  return { progressCount: valid ? 1 : 0, targetCount: 1, valid };
}

async function getCourseCompletedProgress(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  executionContext?: MissionExecutionContext,
): Promise<MissionProgress> {
  const lessons = await getScopedPublishedLessons(supabase, executionContext, { courseId });
  const lessonIds = lessons.map((lesson) => lesson.id);

  if (lessonIds.length === 0) {
    return { progressCount: 0, targetCount: 1, valid: false };
  }

  const progress = await getLessonProgress(supabase, userId);
  const completedIds = getCompletedLessonIds(progress, lessons as never);
  const completedCount = lessonIds.filter((lessonId) => completedIds.has(lessonId)).length;

  return {
    progressCount: completedCount,
    targetCount: lessonIds.length,
    valid: completedCount >= lessonIds.length,
  };
}

async function getLessonCountProgress(
  supabase: SupabaseClient,
  userId: string,
  count: number,
  withinDays?: number,
  executionContext?: MissionExecutionContext,
): Promise<MissionProgress> {
  if (!withinDays) {
    const [lessons, progress] = await Promise.all([
      getScopedPublishedLessons(supabase, executionContext),
      getLessonProgress(supabase, userId),
    ]);

    const completedCount = getCompletedLessonIds(
      progress,
      lessons as never,
    ).size;
    const targetCount = Math.max(1, count);

    return {
      progressCount: completedCount,
      targetCount,
      valid: completedCount >= targetCount,
    };
  }

  const scopedLessons = await getScopedPublishedLessons(supabase, executionContext);
  const scopedLessonIds = scopedLessons.map((lesson) => lesson.id);

  if (executionContext?.programmeId && scopedLessonIds.length === 0) {
    return { progressCount: 0, targetCount: Math.max(1, count), valid: false };
  }

  let query = supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  if (executionContext?.programmeId && executionContext.programmeMissionId) {
    query = query.in("lesson_id", scopedLessonIds);
  }

  if (withinDays) {
    const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("completed_at", since);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const completedCount = new Set((data ?? []).map((item) => String(item.lesson_id))).size;
  const targetCount = Math.max(1, count);

  return {
    progressCount: completedCount,
    targetCount,
    valid: completedCount >= targetCount,
  };
}

async function getReferralProgress(
  supabase: SupabaseClient,
  userId: string,
  requiredFriendLessonCount: number,
  minimumAccountAgeHours = 24,
  executionContext?: MissionExecutionContext,
) {
  let referralQuery = supabase
    .from("referral_attributions")
    .select("referred_user_id, created_at")
    .eq("referrer_user_id", userId);

  if (executionContext?.programmeId && executionContext.programmeMissionId) {
    referralQuery = referralQuery
      .eq("organization_id", executionContext.organizationId)
      .eq("programme_id", executionContext.programmeId)
      .eq("programme_mission_id", executionContext.programmeMissionId);
  } else if (executionContext) {
    referralQuery = referralQuery
      .eq("organization_id", executionContext.organizationId)
      .is("programme_id", null)
      .is("programme_mission_id", null);
  } else {
    referralQuery = referralQuery
      .is("organization_id", null)
      .is("programme_id", null)
      .is("programme_mission_id", null);
  }

  const { data: referrals, error: referralError } = await referralQuery;

  if (referralError) {
    throw referralError;
  }

  const referralIds = (referrals ?? []).map((item) => String(item.referred_user_id));
  const eligibleReferralIds = (referrals ?? [])
    .filter((item) => {
      const attributedAt = new Date(String(item.created_at)).getTime();
      return Date.now() - attributedAt >= minimumAccountAgeHours * 60 * 60 * 1000;
    })
    .map((item) => String(item.referred_user_id));

  if (referralIds.length === 0) {
    return { invitedCount: 0, qualifiedIds: [] as string[] };
  }

  if (eligibleReferralIds.length === 0) {
    return { invitedCount: referralIds.length, qualifiedIds: [] as string[] };
  }

  const lessons = await getScopedPublishedLessons(supabase, executionContext);

  const completedByUser = new Map<string, Set<string>>();

  for (const referralId of eligibleReferralIds) {
    const progress = await getLessonProgress(supabase, referralId);
    completedByUser.set(
      referralId,
      getCompletedLessonIds(
        progress,
        lessons as never,
      ),
    );
  }

  const qualifiedIds = eligibleReferralIds.filter(
    (referralId) => (completedByUser.get(referralId)?.size ?? 0) >= requiredFriendLessonCount,
  );

  return { invitedCount: referralIds.length, qualifiedIds };
}

async function getProofProgress(
  supabase: SupabaseClient,
  userId: string,
  mission: DbMission,
  executionContext?: MissionExecutionContext,
): Promise<{
  progress: MissionProgress;
  reviewStatus?: "submitted" | "approved" | "rejected";
  proofRequiredFields: MissionProofField[];
  proofRequirementMode: MissionProofRequirementMode;
  proofFieldStatuses: Partial<Record<MissionProofField, "pending" | "submitted" | "approved" | "rejected">>;
}> {
  const requiredFields = normalizeProofFieldList(mission.validation_config.requiredFields);
  const requirementMode = normalizeProofRequirementMode(mission.validation_config.requirementMode);
  const requiresManualReview = Boolean(mission.validation_config.requiresManualReview);
  const awardScope = getMissionAwardScope(mission, executionContext);
  const { data, error } = await supabase
    .from("mission_proofs")
    .select("proof_type, status, created_at")
    .eq("user_id", userId)
    .eq("mission_id", mission.id)
    .eq("award_scope", awardScope);

  if (error) {
    throw error;
  }

  const proofs = data ?? [];
  const submittedProofs = proofs.filter((proof) => String(proof.status) === "submitted");
  const effectiveProofs =
    requirementMode === "any" && submittedProofs.length > 0
      ? proofs.filter((proof) => String(proof.status) !== "rejected")
      : proofs;
  const proofTypes = new Set(effectiveProofs.map((proof) => String(proof.proof_type) as MissionProofField));
  const approvedProofTypes = new Set(
    effectiveProofs
      .filter((proof) => String(proof.status) === "approved")
      .map((proof) => String(proof.proof_type) as MissionProofField),
  );
  const fieldStatuses = Object.fromEntries(
    requiredFields.map((field) => {
      const fieldProofs = effectiveProofs.filter((proof) => String(proof.proof_type) === field);
      const statuses = fieldProofs.map((proof) => String(proof.status));
      const status = statuses.includes("approved")
        ? "approved"
        : statuses.includes("submitted")
          ? "submitted"
          : statuses.includes("rejected")
            ? "rejected"
            : "pending";

      return [field, status];
    }),
  ) as Partial<Record<MissionProofField, "pending" | "submitted" | "approved" | "rejected">>;

  const hasRequiredProof =
    requirementMode === "any"
      ? requiredFields.some((field) => proofTypes.has(field))
      : requiredFields.every((field) => proofTypes.has(field));
  const hasApprovedRequiredProof =
    requirementMode === "any"
      ? requiredFields.some((field) => approvedProofTypes.has(field))
      : requiredFields.every((field) => approvedProofTypes.has(field));
  const reviewStatus = Object.values(fieldStatuses).includes("rejected")
    ? "rejected"
    : requiresManualReview
      ? hasApprovedRequiredProof
        ? "approved"
        : effectiveProofs.length > 0
          ? "submitted"
          : undefined
      : undefined;

  return {
    progress: {
      progressCount:
        requirementMode === "any"
          ? hasRequiredProof
            ? 1
            : 0
          : requiredFields.filter((field) => proofTypes.has(field)).length,
      targetCount: requirementMode === "any" ? 1 : requiredFields.length,
      valid: requiresManualReview ? hasApprovedRequiredProof : hasRequiredProof,
    },
    reviewStatus,
    proofRequiredFields: requiredFields,
    proofRequirementMode: requirementMode,
    proofFieldStatuses: fieldStatuses,
  };
}

async function getMissionProgress(
  supabase: SupabaseClient,
  userId: string,
  mission: DbMission,
  executionContext?: MissionExecutionContext,
): Promise<MissionProgressResult> {
  switch (mission.validation_type) {
    case "lesson_completed":
      return {
        progress: await getLessonCompletedProgress(
          supabase,
          userId,
          String(mission.validation_config.lessonId),
          executionContext,
        ),
      };
    case "course_completed":
      return {
        progress: await getCourseCompletedProgress(
          supabase,
          userId,
          String(mission.validation_config.courseId),
          executionContext,
        ),
      };
    case "lesson_count_completed":
      return {
        progress: await getLessonCountProgress(
          supabase,
          userId,
          Number(mission.validation_config.count ?? 1),
          mission.validation_config.withinDays
            ? Number(mission.validation_config.withinDays)
            : undefined,
          executionContext,
        ),
      };
    case "referral_friend_completed_lessons": {
      const requiredFriendLessonCount = Math.max(
        1,
        Number(mission.validation_config.requiredFriendLessonCount ?? 1),
      );
      const minimumAccountAgeHours = Math.max(
        0,
        Number(mission.validation_config.minimumAccountAgeHours ?? 24),
      );
      const referralProgress = await getReferralProgress(
        supabase,
        userId,
        requiredFriendLessonCount,
        minimumAccountAgeHours,
        executionContext,
      );
      return {
        progress: {
          progressCount: referralProgress.qualifiedIds.length,
          targetCount: 1,
          valid: referralProgress.qualifiedIds.length > 0,
        },
        referralProgress,
      };
    }
    case "proof_upload":
      return await getProofProgress(supabase, userId, mission, executionContext);
    case "manual_review":
      return {
        progress: { progressCount: 0, targetCount: 1, valid: false },
      };
  }
}

async function syncMissionAwards(
  supabase: SupabaseClient,
  userId: string,
  mission: DbMission,
  progressResult: MissionProgressResult,
  executionContext?: MissionExecutionContext,
) {
  if (mission.repeatability === "per_referral") {
    const qualifiedIds = progressResult.referralProgress?.qualifiedIds ?? [];

    for (const referredUserId of qualifiedIds) {
      await awardMissionXp(
        supabase,
        userId,
        mission,
        getReferralAwardScope(referredUserId, executionContext),
      );
    }

    return;
  }

  if (progressResult.progress.valid) {
    await awardMissionXp(supabase, userId, mission, getMissionAwardScope(mission, executionContext));
  }
}

async function getAwardedCount(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  executionContext?: MissionExecutionContext,
) {
  let query = supabase
    .from("mission_awards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("mission_id", missionId);

  if (executionContext?.programmeId) {
    query = query
      .eq("organization_id", executionContext.organizationId)
      .eq("programme_id", executionContext.programmeId)
      .eq("programme_mission_id", executionContext.programmeMissionId);
  } else if (executionContext) {
    query = query
      .eq("organization_id", executionContext.organizationId)
      .is("programme_id", null)
      .is("programme_mission_id", null);
  } else {
    query = query
      .is("organization_id", null)
      .is("programme_id", null)
      .is("programme_mission_id", null);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function getReferralShareUrl(origin: string, referralCode: string) {
  return `${origin.replace(/\/$/, "")}/invite/${encodeURIComponent(referralCode)}`;
}

function normalizeContextualReferralTokenResult(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const result = value as { token?: unknown };
  return typeof result.token === "string" && result.token.trim()
    ? result.token.trim()
    : null;
}

async function getContextualReferralToken(
  supabase: SupabaseClient,
  executionContext?: MissionExecutionContext,
) {
  if (!executionContext?.programmeId || !executionContext.programmeMissionId) {
    return null;
  }

  const { data, error } = await supabase.rpc("ensure_contextual_referral_token", {
    p_programme_id: executionContext.programmeId,
    p_programme_mission_id: executionContext.programmeMissionId,
  });

  if (error) {
    throw error;
  }

  return normalizeContextualReferralTokenResult(data);
}

function normalizeProgrammeRelation(value: unknown): { organization_id: string; status: string } | null {
  const relation = Array.isArray(value) ? value[0] : value;

  if (!relation || typeof relation !== "object") {
    return null;
  }

  const row = relation as { organization_id?: unknown; status?: unknown };

  if (typeof row.organization_id !== "string" || typeof row.status !== "string") {
    return null;
  }

  return {
    organization_id: row.organization_id,
    status: row.status,
  };
}

async function resolveMissionExecutionContext({
  missionId,
  organizationId,
  programmeId,
  supabase,
  userId,
}: {
  missionId: string;
  organizationId?: string | null;
  programmeId?: string | null;
  supabase: SupabaseClient;
  userId: string;
}): Promise<MissionExecutionContext | undefined> {
  void userId;

  if (!programmeId) {
    if (!organizationId) {
      return undefined;
    }

    const { data: mission, error } = await supabase
      .from("missions")
      .select("id, organization_id, delivery_scope, status")
      .eq("id", missionId)
      .eq("organization_id", organizationId)
      .eq("delivery_scope", "organization")
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!mission) {
      throw new Error("Organization mission context is not available.");
    }

    const { data: canEnter, error: canEnterError } = await supabase.rpc(
      "current_user_can_enter_organization",
      { p_organization_id: organizationId },
    );

    if (canEnterError) {
      throw canEnterError;
    }

    if (!canEnter) {
      throw new Error("Organization mission context is not available.");
    }

    return {
      deliveryId: `${organizationId}:${missionId}`,
      organizationId,
      programmeId: null,
      programmeMissionId: null,
      startsAt: null,
      dueAt: null,
      isRequired: false,
      xpAccountId: null,
      rewardXpOverride: null,
    };
  }

  const { data, error } = await supabase
    .from("programme_missions")
    .select(
      "mission_id, programme_id, starts_at, due_at, is_required, xp_account_id, reward_xp_override, programmes!inner(organization_id, status)",
    )
    .eq("mission_id", missionId)
    .eq("programme_id", programmeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as
    | {
        due_at: string | null;
        is_required: boolean | null;
        mission_id: string | null;
        programme_id: string | null;
        programmes?: unknown;
        reward_xp_override: number | null;
        starts_at: string | null;
        xp_account_id: string | null;
      }
    | null;
  const programme = normalizeProgrammeRelation(row?.programmes);

  if (!row || !row.mission_id || !row.programme_id || !programme || programme.status !== "published") {
    throw new Error("Programme mission context is not available.");
  }

  const { data: canEnter, error: canEnterError } = await supabase.rpc(
    "current_user_can_enter_organization",
    { p_organization_id: programme.organization_id },
  );

  if (canEnterError) {
    throw canEnterError;
  }

  if (!canEnter) {
    throw new Error("Programme mission context is not available.");
  }

  return {
    deliveryId: `${row.programme_id}:${row.mission_id}`,
    organizationId: programme.organization_id,
    programmeId: row.programme_id,
    programmeMissionId: row.mission_id,
    startsAt: row.starts_at,
    dueAt: row.due_at,
    isRequired: row.is_required ?? true,
    xpAccountId: row.xp_account_id,
    rewardXpOverride: row.reward_xp_override,
  };
}

export async function getSupabaseMissionSummaries({
  missionDeliveries,
  missionIds,
  missionExecutionContexts,
  missionPresentationOverrides,
  syncAwards = false,
  supabase,
  userId,
  referralCode,
  origin,
}: {
  syncAwards?: boolean;
  supabase: SupabaseClient;
  userId: string;
  referralCode: string | null;
  missionDeliveries?: MissionDeliveryRequest[];
  missionIds?: string[];
  missionExecutionContexts?: MissionExecutionContexts;
  missionPresentationOverrides?: MissionPresentationOverrides;
  origin: string;
}): Promise<UserMissionSummary[]> {
  const deliveryInputs = missionDeliveries?.length
    ? missionDeliveries.filter((delivery) => Boolean(delivery.missionId))
    : null;
  const uniqueMissionIds = deliveryInputs
    ? Array.from(new Set(deliveryInputs.map((delivery) => delivery.missionId))).filter(Boolean)
    : missionIds
      ? Array.from(new Set(missionIds)).filter(Boolean)
      : null;

  if (uniqueMissionIds && uniqueMissionIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("missions")
    .select(
      "id, title, description, category, reward_type, reward_xp, reward_id, repeatability, validation_type, validation_config, presentation_config, starts_at, ends_at, rewards:rewards!missions_reward_id_fkey(id, title, fulfillment_type, fulfillment_config)",
    )
    .eq("status", "published");

  if (uniqueMissionIds) {
    query = query.in("id", uniqueMissionIds);
  }

  const { data: missions, error } = await query.order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const missionRows = (missions ?? []).map((mission) => ({
    ...(mission as Omit<DbMission, "rewards"> & { rewards?: unknown }),
    rewards: normalizeMissionReward((mission as { rewards?: unknown }).rewards),
  })) as DbMission[];
  const missionById = new Map(missionRows.map((mission) => [mission.id, mission]));
  const summaryInputs = deliveryInputs
    ? deliveryInputs
        .map((delivery) => {
          const mission = missionById.get(delivery.missionId);
          return mission ? { delivery, mission } : null;
        })
        .filter((input): input is { delivery: MissionDeliveryRequest; mission: DbMission } => Boolean(input))
    : missionRows.map((mission) => ({
        delivery: {
          deliveryId: mission.id,
          executionContext: missionExecutionContexts?.[mission.id],
          missionId: mission.id,
          presentationOverride: missionPresentationOverrides?.[mission.id],
        },
        mission,
      }));

  return Promise.all(summaryInputs.map(async ({ delivery, mission }): Promise<UserMissionSummary> => {
    const missionExecutionContext = delivery.executionContext;
    const missionOverride = delivery.presentationOverride;
    const title =
      resolvePresentationText(missionOverride, mission.presentation_config, "title")
      ?? mission.title;
    const description =
      resolvePresentationText(missionOverride, mission.presentation_config, "shortDescription", "description")
      ?? mission.description;
    const presentation = {
      ctaLabel: resolvePresentationText(missionOverride, mission.presentation_config, "ctaLabel"),
      eligibilityExplanation: resolvePresentationText(
        missionOverride,
        mission.presentation_config,
        "eligibilityExplanation",
      ),
      fullInstructions: resolvePresentationText(missionOverride, mission.presentation_config, "fullInstructions"),
      icon: resolvePresentationText(missionOverride, mission.presentation_config, "icon"),
      imageUrl: resolvePresentationText(missionOverride, mission.presentation_config, "imageUrl"),
      pendingMessage: resolvePresentationText(missionOverride, mission.presentation_config, "pendingMessage"),
      rejectionMessage: resolvePresentationText(missionOverride, mission.presentation_config, "rejectionMessage"),
      rewardExplanation: resolvePresentationText(missionOverride, mission.presentation_config, "rewardExplanation"),
      shortDescription: description,
      successMessage: resolvePresentationText(missionOverride, mission.presentation_config, "successMessage"),
      terms: resolvePresentationText(missionOverride, mission.presentation_config, "terms"),
    };
    const [progressResult, awardedCount] = await Promise.all([
      getMissionProgress(supabase, userId, mission, missionExecutionContext),
      getAwardedCount(supabase, userId, mission.id, missionExecutionContext),
    ]);

    if (syncAwards) {
      await syncMissionAwards(supabase, userId, mission, progressResult, missionExecutionContext);
    }

    const awardScope = getMissionAwardScope(mission, missionExecutionContext);
    const hasCurrentAward =
      mission.repeatability === "per_referral"
        ? awardedCount > 0
        : await hasMissionAward(supabase, userId, mission.id, awardScope);
    const progress = normalizeProgress(progressResult.progress, hasCurrentAward);
    const isProof = mission.validation_type === "proof_upload" || mission.validation_type === "manual_review";
    let status: UserMissionStatus =
      progress.progressCount > 0 ? "in_progress" : "not_started";

    if (progressResult.reviewStatus === "rejected") {
      status = "rejected";
    } else if (progressResult.reviewStatus === "submitted") {
      status = "under_review";
    } else if (hasCurrentAward) {
      status = "completed";
    }

    const requiredFriendLessonCount =
      mission.validation_type === "referral_friend_completed_lessons"
        ? Math.max(1, Number(mission.validation_config.requiredFriendLessonCount ?? 1))
        : 0;
    const referralInviteCode =
      mission.validation_type === "referral_friend_completed_lessons"
        ? missionExecutionContext
          ? await getContextualReferralToken(supabase, missionExecutionContext)
          : referralCode
        : null;
    const referralWithShareUrl =
      mission.validation_type === "referral_friend_completed_lessons"
        && referralInviteCode
        ? {
            code: referralInviteCode,
            shareUrl: getReferralShareUrl(origin, referralInviteCode),
            requiredFriendLessonCount,
            invitedCount: progressResult.referralProgress?.invitedCount ?? 0,
            qualifiedCount: progressResult.referralProgress?.qualifiedIds.length ?? 0,
            awardedCount,
          }
        : undefined;

    return {
      id: delivery.deliveryId,
      baseMissionId: delivery.deliveryId === mission.id ? undefined : mission.id,
      title,
      description,
      category: mission.category,
      rewardType: mission.reward_type,
      rewardXp: missionExecutionContext?.rewardXpOverride ?? mission.reward_xp,
      rewardId: mission.reward_id,
      rewardTitle: mission.rewards?.title ?? null,
      rewardFulfillmentType: mission.rewards?.fulfillment_type ?? null,
      rewardFulfillmentConfig: mission.rewards?.fulfillment_config ?? null,
      repeatability: mission.repeatability,
      status,
      progressCount: progress.progressCount,
      targetCount: progress.targetCount,
      validationType: mission.validation_type,
      requiresProof: isProof,
      proofRequirementMode: progressResult.proofRequirementMode,
      proofRequiredFields: progressResult.proofRequiredFields,
      proofFieldStatuses: progressResult.proofFieldStatuses,
      bypassesDailyCap: true,
      autoAwards: true,
      actionHref: missionExecutionContext?.organizationSlug ? `/o/${missionExecutionContext.organizationSlug}/learn` : "/courses",
      completionLabel: status === "completed" ? getMissionCompletionLabel(mission) : undefined,
      availableAgainAt: status === "completed" ? getMissionAvailableAgainAt(mission) : undefined,
      presentation,
      programmeContext: missionExecutionContext?.programmeId && missionExecutionContext.programmeMissionId
        ? {
            organizationId: missionExecutionContext.organizationId,
            programmeId: missionExecutionContext.programmeId,
            programmeMissionId: missionExecutionContext.programmeMissionId,
            startsAt: missionExecutionContext.startsAt,
            dueAt: missionExecutionContext.dueAt,
            isRequired: missionExecutionContext.isRequired,
            xpAccountId: missionExecutionContext.xpAccountId,
            rewardXpOverride: missionExecutionContext.rewardXpOverride,
          }
        : undefined,
      organizationContext:
        missionExecutionContext && !missionExecutionContext.programmeId
          ? {
              organizationId: missionExecutionContext.organizationId,
            }
          : undefined,
      referral: referralWithShareUrl,
    };
  }));
}

export async function submitSupabaseMissionProof({
  organizationId,
  programmeId,
  supabase,
  userId,
  missionId,
  proof,
}: {
  organizationId?: string | null;
  programmeId?: string | null;
  supabase: SupabaseClient;
  userId: string;
  missionId: string;
  proof: Array<{ type: string; value: string }>;
}) {
  const hasPlaceholderProof = proof.some((item) => {
    const normalizedValue = item.value.trim().toLowerCase();
    return normalizedValue.startsWith("demo proof:") || normalizedValue.startsWith("demo-proof-");
  });

  if (hasPlaceholderProof) {
    throw new Error("Placeholder demo proof cannot be submitted.");
  }

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select(
      "id, title, description, category, reward_type, reward_xp, reward_id, repeatability, validation_type, validation_config, starts_at, ends_at, rewards:rewards!missions_reward_id_fkey(id, title, fulfillment_type, fulfillment_config)",
    )
    .eq("id", missionId)
    .maybeSingle();

  if (missionError || !mission) {
    throw missionError ?? new Error("Mission not found.");
  }

  const normalizedMission = {
    ...(mission as unknown as DbMission),
    rewards: normalizeMissionReward((mission as { rewards?: unknown }).rewards),
  } as DbMission;

  if (normalizedMission.validation_type !== "proof_upload") {
    throw new Error("This mission does not accept proof uploads.");
  }

  const missionExecutionContext = await resolveMissionExecutionContext({
    missionId: normalizedMission.id,
    organizationId,
    programmeId,
    supabase,
    userId,
  });
  assertMissionExecutionWindow(missionExecutionContext);

  const requiredFields = normalizeProofFieldList(normalizedMission.validation_config.requiredFields);
  const requirementMode = normalizeProofRequirementMode(normalizedMission.validation_config.requirementMode);
  const allowedFieldSet = new Set(requiredFields);
  const validProof = proof.filter(
    (item) => allowedFieldSet.has(item.type as MissionProofField) && item.value.trim().length > 0,
  );

  if (validProof.length === 0) {
    throw new Error(
      requirementMode === "any"
        ? "Submit at least one allowed proof item."
        : "Submit one of the required proof items.",
    );
  }

  const awardScope = getMissionAwardScope(normalizedMission, missionExecutionContext);
  const requiresManualReview = Boolean(normalizedMission.validation_config.requiresManualReview);
  const replaceableStatuses = ["submitted", "rejected"];

  if (requirementMode === "any") {
    const { error: cleanupError } = await supabase
      .from("mission_proofs")
      .delete()
      .eq("user_id", userId)
      .eq("mission_id", normalizedMission.id)
      .eq("award_scope", awardScope)
      .in("status", replaceableStatuses);

    if (cleanupError) {
      throw cleanupError;
    }
  } else {
    const incomingTypes = Array.from(new Set(validProof.map((item) => item.type)));

    if (incomingTypes.length > 0) {
      const { error: cleanupError } = await supabase
        .from("mission_proofs")
        .delete()
        .eq("user_id", userId)
        .eq("mission_id", normalizedMission.id)
        .eq("award_scope", awardScope)
        .in("status", replaceableStatuses)
        .in("proof_type", incomingTypes);

      if (cleanupError) {
        throw cleanupError;
      }
    }
  }

  const { error: insertError } = await supabase.from("mission_proofs").insert(
    validProof.map((item) => ({
      user_id: userId,
      mission_id: normalizedMission.id,
      award_scope: awardScope,
      organization_id: missionExecutionContext?.organizationId ?? null,
      programme_id: missionExecutionContext?.programmeId ?? null,
      programme_mission_id: missionExecutionContext?.programmeMissionId ?? null,
      proof_type: item.type,
      value: item.value,
      status: requiresManualReview ? "submitted" : "approved",
      xp_account_id: missionExecutionContext?.xpAccountId ?? null,
    })),
  );

  if (insertError) {
    throw insertError;
  }

  const progress = await getMissionProgress(supabase, userId, normalizedMission, missionExecutionContext);

  if (progress.progress.valid) {
    await syncMissionAwards(supabase, userId, normalizedMission, progress, missionExecutionContext);
  }

  return {
    status: requiresManualReview ? "submitted" : "approved",
    missionId: normalizedMission.id,
    message: requiresManualReview
      ? `Proof submitted. We will review it before awarding ${getMissionRewardLabel({
          rewardType: normalizedMission.reward_type,
          rewardXp: missionExecutionContext?.rewardXpOverride ?? normalizedMission.reward_xp,
          rewardTitle: normalizedMission.rewards?.title ?? null,
          rewardFulfillmentConfig: normalizedMission.rewards?.fulfillment_config ?? null,
        })}.`
      : `Proof received. ${getMissionRewardLabel({
          rewardType: normalizedMission.reward_type,
          rewardXp: missionExecutionContext?.rewardXpOverride ?? normalizedMission.reward_xp,
          rewardTitle: normalizedMission.rewards?.title ?? null,
          rewardFulfillmentConfig: normalizedMission.rewards?.fulfillment_config ?? null,
        })} has been awarded.`,
  };
}
