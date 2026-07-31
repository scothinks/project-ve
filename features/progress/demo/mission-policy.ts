import type {
  Mission,
  MissionProofField,
  MissionRepeatability,
} from "../../../lib/missions.ts";
import { DEMO_USER_ID, key } from "./store.ts";
import {
  getNextDailyResetAt,
  getNextWeeklyResetAt,
  getUserDateKey,
  getUserWeekKey,
} from "./xp-policy.ts";

export type DemoMissionProgress = {
  progressCount: number;
  targetCount: number;
  valid: boolean;
  proofRequiredFields?: MissionProofField[];
  proofRequirementMode?: "all" | "any";
  proofFieldStatuses?: Partial<Record<MissionProofField, "pending" | "submitted" | "approved" | "rejected">>;
};

export function normalizeProofFieldList(value: readonly MissionProofField[]) {
  return value.length > 0 ? [...value] : (["text"] as MissionProofField[]);
}

export function getMissionPeriodScope(repeatability: MissionRepeatability, mission: Mission) {
  switch (repeatability) {
    case "daily":
      return `day:${getUserDateKey()}`;
    case "weekly":
      return `week:${getUserWeekKey()}`;
    case "campaign":
      return `campaign:${mission.startsAt ?? "open"}:${mission.endsAt ?? "open"}`;
    case "per_referral":
      return "referral";
    case "once":
      return "lifetime";
  }
}

export function getMissionClaimKey(mission: Mission, userId = DEMO_USER_ID, scope?: string) {
  return key(userId, mission.id, scope ?? getMissionPeriodScope(mission.repeatability, mission));
}

export function getMissionStateKey(mission: Mission, userId = DEMO_USER_ID) {
  return getMissionClaimKey(mission, userId);
}

export function getLegacyMissionKey(mission: Mission, userId = DEMO_USER_ID) {
  return key(userId, mission.id);
}

export function getMissionAvailableAgainAt(mission: Mission) {
  switch (mission.repeatability) {
    case "daily":
      return getNextDailyResetAt();
    case "weekly":
      return getNextWeeklyResetAt();
    default:
      return undefined;
  }
}

export function getMissionCompletionLabel(mission: Mission) {
  switch (mission.repeatability) {
    case "daily":
      return "Completed today";
    case "weekly":
      return "Completed this week";
    case "campaign":
      return "Completed for campaign";
    case "once":
      return "Completed";
    case "per_referral":
      return "Awarded";
  }
}

export function normalizeMissionProgress(
  progress: { progressCount: number; targetCount: number; valid: boolean },
  forceComplete = false,
) {
  const targetCount = Math.max(1, Math.floor(progress.targetCount));
  const rawProgressCount = forceComplete ? targetCount : progress.progressCount;
  const progressCount = Math.min(
    targetCount,
    Math.max(0, Math.floor(rawProgressCount)),
  );

  return {
    progressCount,
    targetCount,
    valid: progress.valid && progressCount >= targetCount,
  };
}
