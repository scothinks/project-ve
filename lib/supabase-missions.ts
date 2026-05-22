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
  starts_at: string | null;
  ends_at: string | null;
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
    .maybeSingle<{ id: string }>();

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
): Promise<MissionProgress> {
  const [{ data: pages, error: pagesError }, progress] = await Promise.all([
    supabase.from("lesson_pages").select("id, lesson_id").eq("lesson_id", lessonId),
    getLessonProgress(supabase, userId),
  ]);

  if (pagesError) {
    throw pagesError;
  }

  const valid = getCompletedLessonIds(progress, [
    {
      id: lessonId,
      pages: (pages ?? []).map((page, index) => ({ id: String(page.id), order: index + 1 })),
    } as never,
  ]).has(lessonId);

  return { progressCount: valid ? 1 : 0, targetCount: 1, valid };
}

async function getCourseCompletedProgress(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<MissionProgress> {
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, lesson_pages!lesson_pages_lesson_id_fkey(id)")
    .eq("course_id", courseId)
    .eq("status", "published");

  if (lessonsError) {
    throw lessonsError;
  }

  const lessonIds = (lessons ?? []).map((lesson) => String(lesson.id));

  if (lessonIds.length === 0) {
    return { progressCount: 0, targetCount: 1, valid: false };
  }

  const progress = await getLessonProgress(supabase, userId);
  const completedIds = getCompletedLessonIds(
    progress,
    (lessons ?? []).map((lesson) => ({
      id: String(lesson.id),
      pages: ((lesson as { lesson_pages?: Array<{ id: string }> }).lesson_pages ?? []).map((page, index) => ({
        id: String(page.id),
        order: index + 1,
      })),
    })) as never,
  );
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
): Promise<MissionProgress> {
  if (!withinDays) {
    const [{ data: lessons, error: lessonsError }, progress] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, lesson_pages!lesson_pages_lesson_id_fkey(id)")
        .eq("status", "published"),
      getLessonProgress(supabase, userId),
    ]);

    if (lessonsError) {
      throw lessonsError;
    }

    const completedCount = getCompletedLessonIds(
      progress,
      (lessons ?? []).map((lesson) => ({
        id: String(lesson.id),
        pages: ((lesson as { lesson_pages?: Array<{ id: string }> }).lesson_pages ?? []).map((page, index) => ({
          id: String(page.id),
          order: index + 1,
        })),
      })) as never,
    ).size;
    const targetCount = Math.max(1, count);

    return {
      progressCount: completedCount,
      targetCount,
      valid: completedCount >= targetCount,
    };
  }

  let query = supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

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
) {
  const { data: referrals, error: referralError } = await supabase
    .from("referral_attributions")
    .select("referred_user_id, created_at")
    .eq("referrer_user_id", userId);

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

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, lesson_pages!lesson_pages_lesson_id_fkey(id)")
    .eq("status", "published");

  if (lessonsError) {
    throw lessonsError;
  }

  const completedByUser = new Map<string, Set<string>>();

  for (const referralId of eligibleReferralIds) {
    const progress = await getLessonProgress(supabase, referralId);
    completedByUser.set(
      referralId,
      getCompletedLessonIds(
        progress,
        (lessons ?? []).map((lesson) => ({
          id: String(lesson.id),
          pages: ((lesson as { lesson_pages?: Array<{ id: string }> }).lesson_pages ?? []).map((page, index) => ({
            id: String(page.id),
            order: index + 1,
          })),
        })) as never,
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
  const awardScope = getMissionPeriodScope(mission);
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
): Promise<MissionProgressResult> {
  switch (mission.validation_type) {
    case "lesson_completed":
      return {
        progress: await getLessonCompletedProgress(
          supabase,
          userId,
          String(mission.validation_config.lessonId),
        ),
      };
    case "course_completed":
      return {
        progress: await getCourseCompletedProgress(
          supabase,
          userId,
          String(mission.validation_config.courseId),
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
      return await getProofProgress(supabase, userId, mission);
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
) {
  if (mission.repeatability === "per_referral") {
    const qualifiedIds = progressResult.referralProgress?.qualifiedIds ?? [];

    for (const referredUserId of qualifiedIds) {
      await awardMissionXp(supabase, userId, mission, `referral:${referredUserId}`);
    }

    return;
  }

  if (progressResult.progress.valid) {
    await awardMissionXp(supabase, userId, mission, getMissionPeriodScope(mission));
  }
}

async function getAwardedCount(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
) {
  const { count, error } = await supabase
    .from("mission_awards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("mission_id", missionId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function getReferralShareUrl(origin: string, referralCode: string) {
  return `${origin.replace(/\/$/, "")}/invite/${encodeURIComponent(referralCode)}`;
}

export async function getSupabaseMissionSummaries({
  supabase,
  userId,
  referralCode,
  origin,
}: {
  supabase: SupabaseClient;
  userId: string;
  referralCode: string | null;
  origin: string;
}): Promise<UserMissionSummary[]> {
  const { data: missions, error } = await supabase
    .from("missions")
    .select(
      "id, title, description, category, reward_type, reward_xp, reward_id, repeatability, validation_type, validation_config, starts_at, ends_at, rewards:rewards!missions_reward_id_fkey(id, title, fulfillment_type, fulfillment_config)",
    )
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const summaries: UserMissionSummary[] = [];
  const missionRows = (missions ?? []).map((mission) => ({
    ...(mission as Omit<DbMission, "rewards"> & { rewards?: unknown }),
    rewards: normalizeMissionReward((mission as { rewards?: unknown }).rewards),
  })) as DbMission[];

  for (const mission of missionRows) {
    const progressResult = await getMissionProgress(supabase, userId, mission);
    await syncMissionAwards(supabase, userId, mission, progressResult);

    const awardScope = getMissionPeriodScope(mission);
    const hasCurrentAward =
      mission.repeatability === "per_referral"
        ? (await getAwardedCount(supabase, userId, mission.id)) > 0
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
    const referral =
      mission.validation_type === "referral_friend_completed_lessons" && referralCode
        ? {
            code: referralCode,
            shareUrl: getReferralShareUrl(origin, referralCode),
            requiredFriendLessonCount,
            invitedCount: progressResult.referralProgress?.invitedCount ?? 0,
            qualifiedCount: progressResult.referralProgress?.qualifiedIds.length ?? 0,
            awardedCount: await getAwardedCount(supabase, userId, mission.id),
          }
        : undefined;

    summaries.push({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      category: mission.category,
      rewardType: mission.reward_type,
      rewardXp: mission.reward_xp,
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
      completionLabel: status === "completed" ? getMissionCompletionLabel(mission) : undefined,
      availableAgainAt: status === "completed" ? getMissionAvailableAgainAt(mission) : undefined,
      referral,
    });
  }

  return summaries;
}

export async function submitSupabaseMissionProof({
  supabase,
  userId,
  missionId,
  proof,
}: {
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
    .maybeSingle<DbMission>();

  if (missionError || !mission) {
    throw missionError ?? new Error("Mission not found.");
  }

  const normalizedMission = {
    ...mission,
    rewards: normalizeMissionReward((mission as { rewards?: unknown }).rewards),
  } as DbMission;

  if (normalizedMission.validation_type !== "proof_upload") {
    throw new Error("This mission does not accept proof uploads.");
  }

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

  const awardScope = getMissionPeriodScope(normalizedMission);
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
      proof_type: item.type,
      value: item.value,
      status: requiresManualReview ? "submitted" : "approved",
    })),
  );

  if (insertError) {
    throw insertError;
  }

  const progress = await getMissionProgress(supabase, userId, normalizedMission);

  if (progress.progress.valid) {
    await syncMissionAwards(supabase, userId, normalizedMission, progress);
  }

  return {
    status: requiresManualReview ? "submitted" : "approved",
    missionId: normalizedMission.id,
    message: requiresManualReview
      ? `Proof submitted. We will review it before awarding ${getMissionRewardLabel({
          rewardType: normalizedMission.reward_type,
          rewardXp: normalizedMission.reward_xp,
          rewardTitle: normalizedMission.rewards?.title ?? null,
          rewardFulfillmentConfig: normalizedMission.rewards?.fulfillment_config ?? null,
        })}.`
      : `Proof received. ${getMissionRewardLabel({
          rewardType: normalizedMission.reward_type,
          rewardXp: normalizedMission.reward_xp,
          rewardTitle: normalizedMission.rewards?.title ?? null,
          rewardFulfillmentConfig: normalizedMission.rewards?.fulfillment_config ?? null,
        })} has been awarded.`,
  };
}
