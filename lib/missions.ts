import type { RewardFulfillmentType } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";

export type MissionCategory = "course" | "referral" | "feedback" | "campaign" | "custom";
export type MissionRepeatability = "once" | "daily" | "weekly" | "campaign" | "per_referral";
export type MissionRewardType = "xp" | "reward";
export type MissionProofField = "image" | "video" | "text" | "link" | "location";
export type MissionProofRequirementMode = "all" | "any";

export type MissionValidationRule =
  | {
      type: "course_completed";
      courseId: string;
    }
  | {
      type: "lesson_completed";
      lessonId: string;
    }
  | {
      type: "lesson_count_completed";
      count: number;
      withinDays?: number;
    }
  | {
      type: "referral_friend_completed_lessons";
      requiredFriendLessonCount: number;
    }
  | {
      type: "proof_upload";
      requiredFields: MissionProofField[];
      requirementMode?: MissionProofRequirementMode;
      requiresManualReview: boolean;
    }
  | {
      type: "manual_review";
      instructions: string;
    };

export type Mission = {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  rewardType?: MissionRewardType;
  rewardXp?: number | null;
  rewardId?: string | null;
  rewardTitle?: string | null;
  rewardFulfillmentType?: RewardFulfillmentType | null;
  rewardFulfillmentConfig?: Record<string, unknown> | null;
  repeatability: MissionRepeatability;
  startsAt?: string;
  endsAt?: string;
  validation: MissionValidationRule;
};

export type MissionProof = {
  id: string;
  type: MissionProofField;
  value: string;
  uploadedAt: string;
};

export type UserMissionStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "rejected"
  | "completed";

export type UserMissionSummary = {
  id: string;
  baseMissionId?: string;
  title: string;
  description: string;
  category: MissionCategory;
  rewardType?: MissionRewardType;
  rewardXp?: number | null;
  rewardId?: string | null;
  rewardTitle?: string | null;
  rewardFulfillmentType?: RewardFulfillmentType | null;
  rewardFulfillmentConfig?: Record<string, unknown> | null;
  repeatability: MissionRepeatability;
  status: UserMissionStatus;
  progressCount: number;
  targetCount: number;
  validationType: MissionValidationRule["type"];
  requiresProof: boolean;
  proofRequirementMode?: MissionProofRequirementMode;
  proofRequiredFields?: MissionProofField[];
  proofFieldStatuses?: Partial<Record<MissionProofField, "pending" | "submitted" | "approved" | "rejected">>;
  bypassesDailyCap: true;
  autoAwards: boolean;
  actionHref?: string;
  completionLabel?: string;
  availableAgainAt?: string;
  presentation?: {
    ctaLabel?: string;
    eligibilityExplanation?: string;
    fullInstructions?: string;
    imageUrl?: string;
    icon?: string;
    pendingMessage?: string;
    rejectionMessage?: string;
    rewardExplanation?: string;
    shortDescription?: string;
    successMessage?: string;
    terms?: string;
  };
  programmeContext?: {
    organizationId: string;
    programmeId: string;
    programmeMissionId: string;
    startsAt?: string | null;
    dueAt?: string | null;
    isRequired: boolean;
    xpAccountId?: string | null;
    rewardXpOverride?: number | null;
  };
  organizationContext?: {
    organizationId: string;
  };
  referral?: {
    code: string | null;
    shareUrl: string | null;
    requiredFriendLessonCount: number;
    invitedCount: number;
    qualifiedCount: number;
    awardedCount: number;
  };
};

export const missions: Mission[] = [
  {
    id: "mission-complete-starter-budget",
    title: "Finish Fair Choices",
    description: "Complete the fair choices lesson and its quiz.",
    category: "course",
    rewardXp: 25,
    repeatability: "once",
    validation: {
      type: "lesson_completed",
      lessonId: "lesson-starter-budget",
    },
  },
  {
    id: "mission-complete-money-basics",
    title: "Complete Everyday Civic Values",
    description: "Finish every lesson in the Everyday Civic Values course.",
    category: "course",
    rewardXp: 150,
    repeatability: "once",
    validation: {
      type: "course_completed",
      courseId: "course-money-basics",
    },
  },
  {
    id: "mission-two-lessons-week",
    title: "Two Lessons This Week",
    description: "Complete any 2 lessons within 7 days.",
    category: "campaign",
    rewardXp: 75,
    repeatability: "weekly",
    validation: {
      type: "lesson_count_completed",
      count: 2,
      withinDays: 7,
    },
  },
  {
    id: "mission-referral-learner",
    title: "Bring a Learning Friend",
    description: "Invite a friend who completes at least 2 lessons.",
    category: "referral",
    rewardXp: 100,
    repeatability: "per_referral",
    validation: {
      type: "referral_friend_completed_lessons",
      requiredFriendLessonCount: 2,
    },
  },
  {
    id: "mission-local-feedback",
    title: "Civic Feedback Proof",
    description: "Engage your local government chairman and submit proof.",
    category: "feedback",
    rewardXp: 200,
    repeatability: "campaign",
    validation: {
      type: "proof_upload",
      requiredFields: ["text", "image"],
      requiresManualReview: true,
    },
  },
];

export function getMission(id: string) {
  return missions.find((mission) => mission.id === id);
}

export function getMissionRewardLabel(
  mission: {
    rewardType?: MissionRewardType;
    rewardXp?: number | null;
    rewardTitle?: string | null;
    rewardFulfillmentConfig?: Record<string, unknown> | null;
  },
  unitLabel = "XP",
) {
  const rewardConfig =
    mission.rewardFulfillmentConfig && typeof mission.rewardFulfillmentConfig === "object"
      ? mission.rewardFulfillmentConfig
      : null;
  const effect = typeof rewardConfig?.effect === "string" ? rewardConfig.effect : null;

  if (effect === "xp_boost") {
    const multiplier = Number(rewardConfig?.multiplier ?? 0);

    if (Number.isFinite(multiplier) && multiplier > 0) {
      return `${new Intl.NumberFormat("en", {
        maximumFractionDigits: 2,
      }).format(multiplier)}x ${unitLabel} Boost`;
    }
  }

  if (effect === "xp_bonus") {
    const amount = Number(rewardConfig?.amount ?? 0);

    if (Number.isFinite(amount) && amount > 0) {
      return formatXpLabel(amount, unitLabel);
    }
  }

  const rewardTitle = mission.rewardTitle?.trim();

  if (rewardTitle) {
    return rewardTitle;
  }

  if (mission.rewardType === "reward") {
    return "Linked reward";
  }

  return formatXpLabel(Math.max(0, Number(mission.rewardXp ?? 0)), unitLabel);
}

export function getMissionRewardEffect(mission: {
  rewardFulfillmentConfig?: Record<string, unknown> | null;
}) {
  const config =
    mission.rewardFulfillmentConfig && typeof mission.rewardFulfillmentConfig === "object"
      ? mission.rewardFulfillmentConfig
      : null;
  const effect = typeof config?.effect === "string" ? config.effect : null;
  return effect === "xp_boost" ? "boost" : "standard";
}

export function getMissionBoostDetails(
  mission: { rewardFulfillmentConfig?: Record<string, unknown> | null },
  unitLabel = "XP",
) {
  const config =
    mission.rewardFulfillmentConfig && typeof mission.rewardFulfillmentConfig === "object"
      ? mission.rewardFulfillmentConfig
      : null;
  if (!config || config.effect !== "xp_boost") return null;

  const multiplier = Number(config.multiplier ?? 0);
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null;

  const durationHours = Number(config.durationHours ?? 0);
  const durationLabel =
    Number.isFinite(durationHours) && durationHours > 0
      ? `${durationHours} ${durationHours === 1 ? "Hour" : "Hours"}`
      : null;

  return {
    multiplier: new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(multiplier),
    unitLabel,
    durationLabel,
  };
}

export function getMissionProofFieldLabel(field: MissionProofField) {
  switch (field) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "text":
      return "Written note";
    case "link":
      return "Link";
    case "location":
      return "Location";
  }
}
