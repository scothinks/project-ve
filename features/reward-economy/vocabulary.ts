/** Presentation rules only. Awarding and eligibility remain with the existing RPCs. */
export function missionRule(type: string, config: Record<string, unknown>) {
  const count = Number(config.count) || 1;
  switch (type) {
    case "lesson_completed":
      return "Complete the selected lesson.";
    case "course_completed":
      return "Complete the selected course.";
    case "lesson_count_completed":
      return `Complete ${count} ${count === 1 ? "lesson" : "lessons"}${config.withinDays ? ` within ${config.withinDays} days` : ""}.`;
    case "referral_friend_completed_lessons":
      return `Invite a friend who completes ${Number(config.requiredFriendLessonCount) || 1} lessons${config.minimumAccountAgeHours ? ` after their account is ${config.minimumAccountAgeHours} hours old` : ""}.`;
    case "proof_upload":
      return config.requiresManualReview
        ? "Submit proof for a reviewer to approve."
        : "Submit the required proof.";
    case "manual_review":
      return "Complete the task and receive manual approval.";
    default:
      return type.replaceAll("_", " ");
  }
}
export function repeatabilityLabel(value: string) {
  return (
    (
      {
        once: "Once per learner",
        daily: "Once each day",
        weekly: "Once each week",
        campaign: "Once per campaign",
        per_referral: "For each qualifying referral",
      } as Record<string, string>
    )[value] ?? value
  );
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
export function availabilityLabel(
  start: string | null,
  end: string | null,
  now = Date.now(),
) {
  if (end && Date.parse(end) <= now) return `Ended ${dateLabel(end)}`;
  if (start && Date.parse(start) > now)
    return `Starts ${dateLabel(start)} · not available yet`;
  if (end) return `Available until ${dateLabel(end)}`;
  return "Always on · no end date";
}
export type StorefrontInput = {
  status: string;
  is_enabled: boolean;
  visibility_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  offer_expires_at: string | null;
  total_available: number;
  campaign?: {
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  } | null;
};
export function storefrontChecklist(reward: StorefrontInput, now = Date.now()) {
  const future = (v: string | null | undefined) =>
    Boolean(v && Date.parse(v) > now);
  const ended = (v: string | null | undefined) =>
    Boolean(v && Date.parse(v) <= now);
  const intentional = ["hidden", "system_only", "campaign_only"].includes(
    reward.visibility_mode,
  );
  const checks = [
    {
      label: "Published and enabled",
      pass: reward.status === "published" && reward.is_enabled,
      reason: "disabled",
    },
    {
      label: intentional
        ? `Distribution: ${reward.visibility_mode.replaceAll("_", " ")}`
        : "Visible in the store",
      pass: !intentional,
      reason: reward.visibility_mode.replaceAll("_", " "),
      neutral: intentional,
    },
    {
      label: "Campaign is active",
      pass: Boolean(reward.campaign?.status === "active"),
      reason: "campaign off",
    },
    {
      label: "Opening dates reached",
      pass: !future(reward.starts_at) && !future(reward.campaign?.starts_at),
      reason: "scheduled",
    },
    {
      label: "Offer and campaign have not ended",
      pass:
        !ended(reward.ends_at) &&
        !ended(reward.offer_expires_at) &&
        !ended(reward.campaign?.ends_at),
      reason: "ended",
    },
    {
      label: "Stock available",
      pass: reward.total_available > 0,
      reason: "sold out",
    },
  ];
  return {
    state: checks.find((check) => !check.pass)?.reason ?? "live",
    checks,
  };
}
export function configuredPrizeShares<
  T extends { id: string; weight: number; is_enabled: boolean },
>(prizes: T[]) {
  const total = prizes.reduce(
    (sum, prize) => sum + (prize.is_enabled ? Math.max(prize.weight, 1) : 0),
    0,
  );
  return new Map(
    prizes.map((prize) => [
      prize.id,
      total && prize.is_enabled ? (Math.max(prize.weight, 1) / total) * 100 : 0,
    ]),
  );
}
export function rewardLimit(period: string, count: number) {
  return period === "none"
    ? "No per-person limit"
    : `${count} per person · ${period === "lifetime" ? "all time" : period}`;
}
