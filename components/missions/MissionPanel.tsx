"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getMissionProofFieldLabel, getMissionRewardLabel } from "@/lib/missions";
import { paginateItems } from "@/lib/pagination";
import type { UserMissionSummary } from "@/lib/missions";
import { cn } from "@/lib/utils";

type MissionResponse = {
  missions: UserMissionSummary[];
};

type MissionPanelProps = {
  apiPath?: string;
  initialMissions?: UserMissionSummary[];
  maxItems?: number;
  mode?: "full" | "featured";
};

type ProofDrafts = Partial<Record<NonNullable<UserMissionSummary["proofRequiredFields"]>[number], string>>;

const statusCopy: Record<UserMissionSummary["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  rejected: "Rejected",
  completed: "Completed",
};

const categoryTheme: Record<
  UserMissionSummary["category"],
  {
    card: string;
    accent: string;
    progress: string;
    pill: string;
    label: string;
    buttonBg: string;
    buttonFg: string;
    buttonShadow: string;
    buttonSoftBg: string;
    buttonSoftFg: string;
    buttonSoftBorder: string;
  }
> = {
  course: {
    card: "!rounded-[8px] border-[#8b6b1c] bg-[#f4f7ef] shadow-none",
    accent: "text-[#0b6f4d]",
    progress: "bg-[#0b6f4d]",
    pill: "bg-transparent text-[#0b6f4d]",
    label: "bg-transparent text-[#8b6b1c]",
    buttonBg: "#007a53",
    buttonFg: "#ffffff",
    buttonShadow: "none",
    buttonSoftBg: "#eef4ec",
    buttonSoftFg: "#0b6f4d",
    buttonSoftBorder: "#b9c7b9",
  },
  referral: {
    card: "!rounded-[8px] border-[#e4eadf] bg-[#f4f7ef] shadow-none",
    accent: "text-[#0b6f4d]",
    progress: "bg-[#0b6f4d]",
    pill: "bg-[#007a53] text-white",
    label: "bg-transparent text-[#8b6b1c]",
    buttonBg: "#007a53",
    buttonFg: "#ffffff",
    buttonShadow: "none",
    buttonSoftBg: "#eef4ec",
    buttonSoftFg: "#0b6f4d",
    buttonSoftBorder: "#b9c7b9",
  },
  feedback: {
    card: "!rounded-[8px] border-[#8b6b1c] bg-[#f4f7ef] shadow-none",
    accent: "text-[#0b6f4d]",
    progress: "bg-[#0b6f4d]",
    pill: "bg-[#ffdd76] text-[#2c2614]",
    label: "bg-transparent text-[#8b6b1c]",
    buttonBg: "#007a53",
    buttonFg: "#ffffff",
    buttonShadow: "none",
    buttonSoftBg: "#eef4ec",
    buttonSoftFg: "#0b6f4d",
    buttonSoftBorder: "#b9c7b9",
  },
  campaign: {
    card: "!rounded-[8px] border-[#8b6b1c] bg-[#f4f7ef] shadow-none",
    accent: "text-[#0b6f4d]",
    progress: "bg-[#0b6f4d]",
    pill: "bg-[#ffdd76] text-[#2c2614]",
    label: "bg-transparent text-[#8b6b1c]",
    buttonBg: "#007a53",
    buttonFg: "#ffffff",
    buttonShadow: "none",
    buttonSoftBg: "#eef4ec",
    buttonSoftFg: "#0b6f4d",
    buttonSoftBorder: "#b9c7b9",
  },
  custom: {
    card: "!rounded-[8px] border-[#d8ddd2] bg-[#f4f7ef] shadow-none",
    accent: "text-[#0b6f4d]",
    progress: "bg-[#0b6f4d]",
    pill: "bg-[#e8eee3] text-[#3f4b45]",
    label: "bg-transparent text-[#8b6b1c]",
    buttonBg: "#007a53",
    buttonFg: "#ffffff",
    buttonShadow: "none",
    buttonSoftBg: "#eef4ec",
    buttonSoftFg: "#0b6f4d",
    buttonSoftBorder: "#b9c7b9",
  },
};

function formatAvailableAgain(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function getProofRequirementSummary(mission: UserMissionSummary) {
  const fields = mission.proofRequiredFields ?? [];
  if (fields.length === 0) {
    return null;
  }

  if (mission.proofRequirementMode === "any") {
    return `Submit any 1 of ${fields.length} proof options`;
  }

  return `Submit all ${fields.length} required proof items`;
}

function getProofFieldPlaceholder(field: NonNullable<UserMissionSummary["proofRequiredFields"]>[number]) {
  switch (field) {
    case "image":
      return "https://...";
    case "video":
      return "https://...";
    case "text":
      return "Describe what you did";
    case "link":
      return "https://...";
    case "location":
      return "Enter the place or address";
  }
}

function getProofFieldInstruction(field: NonNullable<UserMissionSummary["proofRequiredFields"]>[number]) {
  switch (field) {
    case "image":
      return "Add a photo URL that shows the completed activity.";
    case "video":
      return "Add a video URL that shows the completed activity.";
    case "text":
      return "Describe what you did during the session.";
    case "link":
      return "Add the supporting page, post, or document URL.";
    case "location":
      return "Enter the place or address connected to this proof.";
  }
}

function getProofFieldInputType(field: NonNullable<UserMissionSummary["proofRequiredFields"]>[number]) {
  switch (field) {
    case "image":
    case "video":
    case "link":
      return "url";
    default:
      return "text";
  }
}

function getProofFieldStatusTone(
  status: NonNullable<UserMissionSummary["proofFieldStatuses"]>[NonNullable<UserMissionSummary["proofRequiredFields"]>[number]] | undefined,
  requirementMode?: UserMissionSummary["proofRequirementMode"],
) {
  if (!status && requirementMode === "any") {
    return "bg-[var(--ve-panel)] text-[var(--ve-muted)]";
  }

  switch (status) {
    case "approved":
      return "bg-[#e4f4ed] text-[#087f5b]";
    case "submitted":
      return "bg-[#fff8df] text-[#a66d00]";
    case "rejected":
      return "bg-[#fff0f0] text-[#c00000]";
    default:
      return "bg-[var(--ve-panel)] text-[var(--ve-muted-strong)]";
  }
}

function getProofFieldStatusLabel(
  status: NonNullable<UserMissionSummary["proofFieldStatuses"]>[NonNullable<UserMissionSummary["proofRequiredFields"]>[number]] | undefined,
  requirementMode?: UserMissionSummary["proofRequirementMode"],
) {
  if (!status && requirementMode === "any") {
    return "Optional";
  }

  switch (status) {
    case "approved":
      return "Approved";
    case "submitted":
      return "Submitted";
    case "rejected":
      return "Needs update";
    default:
      return requirementMode === "any" ? "Optional" : "Pending";
  }
}

function getMissionRewardEffect(mission: UserMissionSummary) {
  const config =
    mission.rewardFulfillmentConfig && typeof mission.rewardFulfillmentConfig === "object"
      ? mission.rewardFulfillmentConfig
      : null;
  const effect = typeof config?.effect === "string" ? config.effect : null;
  return effect === "xp_boost" ? "boost" : "standard";
}

function BoostIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[1.05em] shrink-0 translate-y-px"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M8.95 1.5 3.4 8.55h4.05l-.42 5.95 5.58-7.2H8.55l.4-5.8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getBoostRewardChipLabel(rewardLabel: string) {
  return rewardLabel.replace(/\s*XP\s+Boost$/i, " Boost");
}

function getMissionPrimaryAction(mission: UserMissionSummary) {
  const configuredLabel = mission.presentation?.ctaLabel;

  if (mission.status === "completed") {
    return {
      label: "Completed",
      disabled: true,
      href: undefined,
      type: "link" as const,
    };
  }

  if (mission.status === "submitted" || mission.status === "under_review") {
    return {
      label: mission.presentation?.pendingMessage ?? "In review",
      disabled: true,
      href: undefined,
      type: "link" as const,
    };
  }

  if (mission.referral) {
    return {
      label: configuredLabel ?? "Share invite",
      disabled: false,
      href: undefined,
      type: "share" as const,
    };
  }

  if (mission.requiresProof) {
    return {
      label: configuredLabel ?? (mission.status === "rejected" ? "Resubmit proof" : "Submit proof"),
      disabled: false,
      href: undefined,
      type: "proof" as const,
    };
  }

  if (
    mission.validationType === "lesson_completed" ||
    mission.validationType === "course_completed" ||
    mission.validationType === "lesson_count_completed"
  ) {
    return {
      label: configuredLabel ?? (mission.status === "in_progress" ? "Continue" : "Open lessons"),
      disabled: false,
      href: mission.actionHref ?? "/courses",
      type: "link" as const,
    };
  }

  return {
    label: configuredLabel ?? "Open mission",
    disabled: false,
    href: mission.actionHref ?? "/missions",
    type: "link" as const,
  };
}

type MissionActionButtonProps = {
  children: ReactNode;
  className: string;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
};

function MissionActionButton({
  children,
  className,
  href,
  disabled = false,
  onClick,
  style,
}: MissionActionButtonProps) {
  const classes = cn(
    "inline-flex h-9 min-w-0 items-center justify-center rounded-[6px] px-4 text-[0.76rem] font-black tracking-[-0.01em] transition",
    disabled && "cursor-not-allowed",
    className,
  );

  if (href && !disabled) {
    return (
      <Link className={classes} href={href} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled} onClick={onClick} style={style} type="button">
      {children}
    </button>
  );
}

export function MissionPanel({
  apiPath = "/api/missions",
  initialMissions,
  maxItems,
  mode = "full",
}: MissionPanelProps) {
  const [missions, setMissions] = useState<UserMissionSummary[]>(initialMissions ?? []);
  const [loading, setLoading] = useState(!initialMissions);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedMissionId, setCopiedMissionId] = useState<string | null>(null);
  const [activeProofMissionId, setActiveProofMissionId] = useState<string | null>(null);
  const [proofDrafts, setProofDrafts] = useState<ProofDrafts>({});
  const [proofFieldMessage, setProofFieldMessage] = useState<string | null>(null);
  const [submittingProofField, setSubmittingProofField] = useState<string | null>(null);
  const [uploadingProofField, setUploadingProofField] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadMissions = useCallback(async function loadMissions() {
    setLoading(true);
    try {
      const response = await fetch(apiPath);
      const data = (await response.json()) as Partial<MissionResponse> & { error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "Could not load missions.");
        setMissions([]);
        return;
      }

      setMissions(data.missions ?? []);
    } catch {
      setMessage("Could not load missions.");
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    if (!initialMissions) {
      void loadMissions();
    }
  }, [initialMissions, loadMissions]);

  const activeProofMission = activeProofMissionId
    ? missions.find((mission) => mission.id === activeProofMissionId) ?? null
    : null;

  function openProofModal(mission: UserMissionSummary) {
    setActiveProofMissionId(mission.id);
    setProofFieldMessage(null);
    setProofDrafts((current) => {
      const next: ProofDrafts = {};
      for (const field of mission.proofRequiredFields ?? []) {
        next[field] = current[field] ?? "";
      }
      return next;
    });
  }

  function closeProofModal() {
    setActiveProofMissionId(null);
    setProofFieldMessage(null);
    setSubmittingProofField(null);
    setUploadingProofField(null);
  }

  async function submitProofField(
    mission: UserMissionSummary,
    field: NonNullable<UserMissionSummary["proofRequiredFields"]>[number],
    submittedValue?: string,
  ) {
    const value = (submittedValue ?? proofDrafts[field] ?? "").trim();
    if (!value) {
      setProofFieldMessage(`Add ${getMissionProofFieldLabel(field).toLowerCase()} proof before submitting.`);
      return;
    }

    setSubmittingProofField(field);
    const proofMissionId = mission.baseMissionId ?? mission.id;
    const response = await fetch(`/api/missions/${proofMissionId}/proof`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: mission.organizationContext?.organizationId,
        programmeId: mission.programmeContext?.programmeId,
        proof: [
          {
            type: field,
            value,
          },
        ],
      }),
    });
    const data = await response.json();
    setSubmittingProofField(null);

    if (!response.ok) {
      setProofFieldMessage(data.error ?? "Could not submit proof.");
      return;
    }

    setMessage(data.message);
    setProofFieldMessage(`${getMissionProofFieldLabel(field)} submitted.`);
    setProofDrafts((current) => ({ ...current, [field]: "" }));
    await loadMissions();
  }

  async function uploadAndSubmitProofMedia(
    mission: UserMissionSummary,
    field: Extract<NonNullable<UserMissionSummary["proofRequiredFields"]>[number], "image" | "video">,
    file: File | null,
  ) {
    if (!file) {
      return;
    }

    setUploadingProofField(field);
    setProofFieldMessage(null);

    const proofMissionId = mission.baseMissionId ?? mission.id;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", field);

    const uploadResponse = await fetch(`/api/missions/${proofMissionId}/proof/media`, {
      method: "POST",
      body: formData,
    });
    const uploadData = await uploadResponse.json();
    setUploadingProofField(null);

    if (!uploadResponse.ok) {
      setProofFieldMessage(uploadData.error ?? "Could not upload proof media.");
      return;
    }

    const uploadedUrl =
      uploadData && typeof uploadData === "object" && typeof uploadData.url === "string"
        ? uploadData.url
        : "";

    if (!uploadedUrl) {
      setProofFieldMessage("Proof media uploaded, but no URL was returned.");
      return;
    }

    setProofDrafts((current) => ({ ...current, [field]: uploadedUrl }));
    await submitProofField(mission, field, uploadedUrl);
  }

  async function copyReferralLink(missionId: string, url: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopiedMissionId(missionId);
      setMessage("Referral link copied.");
      window.setTimeout(() => setCopiedMissionId(null), 2200);
    } catch {
      setMessage("Copy failed. Select the link and copy it manually.");
    }
  }

  async function shareReferralLink(missionId: string, url: string) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Project VE",
          text: "Start a short Project VE lesson and earn XP as you learn.",
          url,
        });
        setCopiedMissionId(missionId);
        setMessage("Referral link shared.");
        window.setTimeout(() => setCopiedMissionId(null), 2200);
        return;
      } catch {
        return;
      }
    }

    await copyReferralLink(missionId, url);
  }

  const paginatedMissions = useMemo(
    () => paginateItems(missions, page, maxItems ? maxItems : 6),
    [maxItems, missions, page],
  );
  const visibleMissions = maxItems ? missions.slice(0, maxItems) : paginatedMissions.items;
  const isFeatured = mode === "featured";
  const missionGroups = useMemo(() => {
    if (isFeatured) {
      return [{ key: "featured", title: null, missions: visibleMissions }];
    }

    const activeStatuses = new Set<UserMissionSummary["status"]>([
      "not_started",
      "in_progress",
      "submitted",
      "under_review",
      "rejected",
    ]);
    const active = visibleMissions
      .filter((mission) => activeStatuses.has(mission.status) && !mission.referral)
      .slice(0, 2);
    const activeIds = new Set(active.map((mission) => mission.id));
    const available = visibleMissions.filter(
      (mission) => !activeIds.has(mission.id) && mission.status !== "completed",
    );
    const history = visibleMissions.filter((mission) => mission.status === "completed");

    const groups = [
      { key: "active", title: "Active", missions: active },
      { key: "available", title: "Available", missions: available },
      { key: "history", title: "History", missions: history },
    ];

    return groups.filter((group) => group.key === "history" || group.missions.length > 0);
  }, [isFeatured, visibleMissions]);
  const skeletonCount = maxItems ?? 3;

  useEffect(() => {
    setPage(1);
  }, [missions.length, maxItems, mode]);

  return (
    <section className="mission-panel">
      {isFeatured ? (
        <SectionHeader
          actionHref="/missions"
          actionLabel="View all"
          subtitle="A quick challenge to keep you moving."
          title="Featured Mission"
          tone="mission"
        />
      ) : null}

      {message ? (
        <div className="mt-3 rounded-[18px] border border-[#ffe2d3] bg-[#fff0e8] px-4 py-3 text-xs font-bold text-[#c94f2e]">
          {message}
        </div>
      ) : null}

      <div className={cn(isFeatured ? "learner-card-grid mt-3" : "mission-panel__groups space-y-5")}>
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <Card
                className="overflow-hidden border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-6 shadow-[0_12px_32px_rgba(16,16,16,0.055)]"
                key={`mission-loading-${index}`}
                variant="quiet"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-20 rounded-full bg-[#f2f0eb]" />
                    <div className="h-4 w-44 rounded-full bg-[#e9e6e1]" />
                    <div className="h-3 w-full rounded-full bg-[#efede9]" />
                  </div>
                  <div className="h-9 w-16 rounded-[18px] bg-[#f2f0eb]" />
                </div>
                <div className="mt-5 h-11 w-36 rounded-[18px] bg-[#efede9]" />
              </Card>
            ))
          : null}

        {!loading && visibleMissions.length === 0 ? (
          <Card className="p-6 text-center" variant="mission">
            <p className="text-sm font-black">No missions yet</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Check back soon for new challenges.
            </p>
          </Card>
        ) : null}

        {!loading && visibleMissions.length > 0 &&
          missionGroups.map((group) => (
            <div
              className={cn(
                "mission-panel__group",
                group.title && "space-y-3",
                `mission-panel__group--${group.key}`,
              )}
              key={group.key}
            >
              {group.title ? (
                <h2 className="mission-panel__group-title text-[1.05rem] font-black tracking-[-0.01em] text-[var(--foreground)]">
                  {group.key === "history" ? "Mission History" : group.title}
                </h2>
              ) : null}
              <div
                className={cn(
                  "learner-card-grid mission-panel__group-grid",
                  `mission-panel__group-grid--${group.key}`,
                  group.title ? "gap-3" : null,
                )}
              >
                {group.key === "history" && group.missions.length === 0 ? (
                  <Card className="mission-card mission-card--empty !rounded-[8px] p-6 text-center" variant="quiet">
                    <p className="text-xs font-semibold text-[var(--ve-muted)]">
                      No completed missions yet. Get started above!
                    </p>
                  </Card>
                ) : null}
                {group.missions.map((mission) => {
            const theme = categoryTheme[mission.category];
            const rewardLabel = getMissionRewardLabel(mission);
            const progressPercent =
              mission.targetCount > 0
                ? Math.min(100, (mission.progressCount / mission.targetCount) * 100)
                : 0;
            const hasStructuredProgress =
              !mission.referral &&
              (mission.progressCount > 0 ||
                mission.status === "completed" ||
                mission.requiresProof ||
                mission.status === "submitted" ||
                mission.status === "under_review" ||
                mission.status === "rejected");
            const copied = copiedMissionId === mission.id;
            const action = getMissionPrimaryAction(mission);
            const rewardEffect = getMissionRewardEffect(mission);
            const requiredReferralLessons = mission.referral?.requiredFriendLessonCount ?? 0;
            const referralLessonLabel = requiredReferralLessons === 1 ? "lesson" : "lessons";
            const proofRequirementSummary = mission.requiresProof ? getProofRequirementSummary(mission) : null;
            const showReviewStatus =
              mission.status === "submitted" || mission.status === "under_review" || mission.status === "rejected";
            const primaryActionStyle: CSSProperties = action.disabled
              ? {
                  backgroundColor: theme.buttonSoftBg,
                  color: theme.buttonSoftFg,
                  border: `1px solid ${theme.buttonSoftBorder}`,
                  boxShadow: "none",
                }
              : {
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonFg,
                  border: "1px solid transparent",
                  boxShadow: theme.buttonShadow,
                };
            const secondaryActionStyle: CSSProperties = copied
              ? {
                  backgroundColor: theme.buttonSoftBg,
                  color: theme.buttonSoftFg,
                  border: `1px solid ${theme.buttonSoftBorder}`,
                  boxShadow: "none",
                }
              : {
                  backgroundColor: "rgba(255,255,255,0.88)",
                  color: theme.buttonSoftFg,
                  border: `1px solid ${theme.buttonSoftBorder}`,
                  boxShadow: "0 10px 24px rgba(255,255,255,0.35)",
                };

            return (
              <Card
                className={cn(
                  "mission-card overflow-hidden p-4 sm:p-4",
                  `mission-card--${mission.category}`,
                  mission.referral && "mission-card--referral",
                  theme.card,
                )}
                key={mission.id}
                variant="quiet"
              >
                <div className="mission-card__top-row flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div
                      className={cn(
                        "inline-flex rounded-[8px] px-0 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                        theme.label,
                      )}
                    >
                      {mission.category} mission
                    </div>
                    {showReviewStatus ? (
                      <span className="rounded-[8px] bg-[color:color-mix(in_srgb,var(--ve-card)_72%,transparent)] px-2.5 py-1 text-[10px] font-black text-[var(--ve-muted-strong)]">
                        {statusCopy[mission.status]}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      "mission-card__reward",
                      "ml-auto max-w-[58%] rounded-[12px] px-3 py-2 text-right sm:max-w-[18rem]",
                      theme.pill,
                      rewardEffect === "boost" && "rounded-full bg-[#007a53] px-3.5 py-2 text-white",
                    )}
                    title={rewardLabel}
                  >
                    <span className="inline-flex min-h-4 items-center justify-center gap-1.5 align-middle text-[0.78rem] font-black leading-none tracking-[-0.01em] sm:text-sm">
                      {rewardEffect === "boost" ? <BoostIcon /> : null}
                      <span className="leading-none">
                        {rewardEffect === "boost" ? getBoostRewardChipLabel(rewardLabel) : rewardLabel}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="mission-card__body mt-4 min-w-0">
                  <h3 className="mission-card__title text-[1.08rem] font-semibold leading-6 tracking-[-0.01em] text-[var(--foreground)]">
                    {mission.title}
                  </h3>
                  <p className="mission-card__description mt-1.5 max-w-none text-[0.82rem] font-medium leading-5 text-[var(--ve-muted-strong)] sm:max-w-[34ch]">
                    {mission.description}
                  </p>
                  {mission.presentation?.fullInstructions ? (
                    <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                      {mission.presentation.fullInstructions}
                    </p>
                  ) : null}
                  {mission.presentation?.eligibilityExplanation ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-[var(--ve-muted)]">
                      {mission.presentation.eligibilityExplanation}
                    </p>
                  ) : null}
                  {mission.status === "completed" && mission.presentation?.successMessage ? (
                    <p className="mt-2 text-xs font-black leading-5 text-[#087f5b]">
                      {mission.presentation.successMessage}
                    </p>
                  ) : null}
                  {mission.status === "rejected" && mission.presentation?.rejectionMessage ? (
                    <p className="mt-2 text-xs font-black leading-5 text-[#c00000]">
                      {mission.presentation.rejectionMessage}
                    </p>
                  ) : null}
                </div>

                {hasStructuredProgress ? (
                  <div className="mission-card__progress mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.78rem] font-semibold tracking-[-0.01em] text-[var(--ve-muted)]">
                      <span className="min-w-0 flex-1">
                        {mission.completionLabel
                          ? mission.availableAgainAt
                            ? `${mission.completionLabel} · Available again ${formatAvailableAgain(mission.availableAgainAt)}`
                            : mission.completionLabel
                          : mission.requiresProof && proofRequirementSummary
                            ? proofRequirementSummary
                          : statusCopy[mission.status]}
                      </span>
                      <span className="shrink-0">
                        {mission.progressCount}/{mission.targetCount}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[color:color-mix(in_srgb,var(--ve-card)_65%,transparent)]">
                      <div
                        className={cn("h-full rounded-full", theme.progress)}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className={cn("mission-card__actions mt-4 flex flex-wrap items-center gap-2", mission.referral && "items-stretch")}>
                  {action.type === "share" && mission.referral ? (
                    <>
                      <MissionActionButton
                        className="w-full sm:w-auto"
                        onClick={() => void shareReferralLink(mission.id, mission.referral!.shareUrl)}
                        style={primaryActionStyle}
                      >
                        {action.label}
                      </MissionActionButton>
                      <MissionActionButton
                        className="w-full min-w-0 px-5 sm:w-auto sm:min-w-[124px]"
                        onClick={() => void copyReferralLink(mission.id, mission.referral!.shareUrl)}
                        style={secondaryActionStyle}
                      >
                        {copied ? "Copied" : "Copy link"}
                      </MissionActionButton>
                    </>
                  ) : action.type === "proof" ? (
                    <MissionActionButton
                      className=""
                      onClick={() => openProofModal(mission)}
                      style={primaryActionStyle}
                    >
                      {action.label}
                    </MissionActionButton>
                  ) : (
                    <MissionActionButton
                      className=""
                      disabled={action.disabled}
                      href={action.href}
                      style={primaryActionStyle}
                    >
                      {action.label}
                    </MissionActionButton>
                  )}
                </div>

                {mission.referral ? (
                  <div className="mission-card__referral mt-4 rounded-[20px] border border-white/80 bg-[color:color-mix(in_srgb,var(--ve-card)_72%,transparent)] px-4 py-4">
                    <div className="mission-card__invite rounded-[16px] bg-[var(--ve-card)] px-4 py-3 text-left">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                        Invite link
                      </p>
                      <p className="mt-2 truncate text-[12px] font-bold text-[var(--ve-muted-strong)]">
                        {mission.referral.shareUrl}
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-[14px] bg-[var(--ve-card)] px-2 py-3">
                        <p className="text-base font-black text-[var(--foreground)]">
                          {mission.referral.invitedCount}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[var(--ve-muted)]">Invited</p>
                      </div>
                      <div className="rounded-[14px] bg-[var(--ve-card)] px-2 py-3">
                        <p className="text-base font-black text-[var(--foreground)]">
                          {mission.referral.qualifiedCount}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[var(--ve-muted)]">Qualified</p>
                      </div>
                      <div className="rounded-[14px] bg-[var(--ve-card)] px-2 py-3">
                        <p className="text-base font-black text-[var(--foreground)]">
                          {mission.referral.awardedCount}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[var(--ve-muted)]">Awarded</p>
                      </div>
                    </div>
                    <p className="mt-4 text-[12px] font-semibold leading-5 text-[#7a7a7a]">
                      {mission.presentation?.rewardExplanation
                        ?? `XP is awarded when a friend completes ${requiredReferralLessons} ${referralLessonLabel}.`}
                    </p>
                  </div>
                ) : null}
                {mission.presentation?.terms ? (
                  <p className="mt-4 text-[11px] font-semibold leading-5 text-[var(--ve-muted)]">
                    {mission.presentation.terms}
                  </p>
                ) : null}
              </Card>
            );
                })}
              </div>
            </div>
          ))}
      </div>

      {!loading && !maxItems && mode === "full" ? (
        <PaginationControls
          className="mt-4"
          currentPage={paginatedMissions.currentPage}
          onPageChange={setPage}
          totalPages={paginatedMissions.totalPages}
        />
      ) : null}

      {activeProofMission ? (
        <div className="mission-proof-overlay fixed inset-0 z-50 grid place-items-end bg-black/35 px-0 sm:px-4 sm:py-6">
          <div className="mission-proof-shell w-full sm:mx-auto sm:max-w-[420px]">
            <Card className="mission-proof-dialog max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-b-none p-5 sm:rounded-b-[24px] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 h-1 w-12 rounded-full bg-[var(--ve-line)]" />
                  <h2 className="text-xl font-black tracking-[-0.02em]">{activeProofMission.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-[8px] bg-[#dff2e9] px-2.5 py-1 text-[11px] font-black text-[#087f5b]">
                      {getMissionRewardLabel(activeProofMission)}
                    </span>
                    <span className="text-[11px] font-black text-[var(--ve-muted)]">Proof Required</span>
                  </div>
                  {activeProofMission.status === "under_review" ? (
                    <p className="mt-2 text-xs font-semibold text-[#a66d00]">
                      {activeProofMission.presentation?.pendingMessage
                        ?? "Submitted items stay under review until an admin approves them."}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label="Close proof submission"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ve-card-muted)] text-sm font-black text-[var(--foreground)]"
                  onClick={closeProofModal}
                  type="button"
                >
                  x
                </button>
              </div>

              <div className="mt-4 rounded-[10px] bg-[var(--ve-card-muted)] px-4 py-3 text-[0.82rem] font-medium leading-5 text-[var(--ve-muted-strong)]">
                {activeProofMission.proofRequirementMode === "any"
                  ? `Provide any one of these ${activeProofMission.proofRequiredFields?.length ?? 0} proof options for review.`
                  : `Provide the following evidence for review.`}
              </div>

              {proofFieldMessage ? (
                <div className="mt-4 rounded-[14px] border border-[#f1ddd7] bg-[#fff7f4] px-4 py-3 text-sm font-black text-[#c94f2e]">
                  {proofFieldMessage}
                </div>
              ) : null}

              <div className="mission-proof-grid learner-card-grid mt-5">
                {(activeProofMission.proofRequiredFields ?? []).map((field) => {
                  const fieldStatus = activeProofMission.proofFieldStatuses?.[field];
                  const isLocked = fieldStatus === "approved" || fieldStatus === "submitted";

                  return (
                    <div
                      className="mission-proof-field rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4"
                      key={field}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">{getMissionProofFieldLabel(field)}</p>
                          <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                            {getProofFieldInstruction(field)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]",
                            getProofFieldStatusTone(fieldStatus, activeProofMission.proofRequirementMode),
                          )}
                        >
                          {getProofFieldStatusLabel(fieldStatus, activeProofMission.proofRequirementMode)}
                        </span>
                      </div>

                      {field === "text" ? (
                        <textarea
                          className="mt-3 min-h-24 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-3 text-sm font-medium outline-none"
                          disabled={isLocked}
                          onChange={(event) =>
                            setProofDrafts((current) => ({ ...current, [field]: event.target.value }))
                          }
                          placeholder={getProofFieldPlaceholder(field)}
                          value={proofDrafts[field] ?? ""}
                        />
                      ) : (
                        <>
                          {(field === "image" || field === "video") ? (
                            <>
                              <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] bg-[#087f5b] px-4 text-sm font-black text-white">
                                <input
                                  accept={
                                    field === "image"
                                      ? "image/png,image/jpeg,image/webp"
                                      : "video/mp4,video/webm,video/quicktime"
                                  }
                                  className="sr-only"
                                  disabled={isLocked || uploadingProofField === field}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    event.target.value = "";
                                    void uploadAndSubmitProofMedia(activeProofMission, field, file);
                                  }}
                                  type="file"
                                />
                                {uploadingProofField === field
                                  ? "Uploading..."
                                  : `Upload ${getMissionProofFieldLabel(field)}`}
                              </label>
                              <p className="mt-3 text-xs font-semibold text-[var(--ve-muted)]">
                                Or paste {field === "image" ? "image" : "video"} link instead
                              </p>
                            </>
                          ) : null}
                          <input
                            className="mt-2 h-12 w-full rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-sm font-medium outline-none"
                            disabled={isLocked}
                            onChange={(event) =>
                              setProofDrafts((current) => ({ ...current, [field]: event.target.value }))
                            }
                            placeholder={getProofFieldPlaceholder(field)}
                            type={getProofFieldInputType(field)}
                            value={proofDrafts[field] ?? ""}
                          />
                        </>
                      )}

                      <div className="mt-3 flex justify-end">
                        <button
                          className="min-h-10 rounded-[10px] bg-[#087f5b] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                          disabled={isLocked || submittingProofField === field || uploadingProofField === field}
                          onClick={() => void submitProofField(activeProofMission, field)}
                          type="button"
                        >
                          {submittingProofField === field ? "Submitting..." : `Submit ${getMissionProofFieldLabel(field)}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  );
}
