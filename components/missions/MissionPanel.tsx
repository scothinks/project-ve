"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
    card: "border-[#c7e6d8] bg-[#edf9f2] shadow-[0_16px_36px_rgba(8,127,91,0.12)]",
    accent: "text-[#087f5b]",
    progress: "bg-[#109365]",
    pill: "bg-[#def3e8] text-[#087f5b]",
    label: "bg-[#daf1e4] text-[#087f5b]",
    buttonBg: "#0d8a5e",
    buttonFg: "#ffffff",
    buttonShadow: "0 12px 28px rgba(8,127,91,0.22)",
    buttonSoftBg: "#e7f6ef",
    buttonSoftFg: "#087f5b",
    buttonSoftBorder: "#c7e6d8",
  },
  referral: {
    card: "border-[#d9c7ff] bg-[#f3ebff] shadow-[0_16px_36px_rgba(107,67,204,0.16)]",
    accent: "text-[#6b43cc]",
    progress: "bg-[#8d68f2]",
    pill: "bg-[#ece3ff] text-[#6b43cc]",
    label: "bg-[#e8ddff] text-[#6b43cc]",
    buttonBg: "#8d68f2",
    buttonFg: "#ffffff",
    buttonShadow: "0 12px 28px rgba(107,67,204,0.24)",
    buttonSoftBg: "#ede5ff",
    buttonSoftFg: "#6b43cc",
    buttonSoftBorder: "#d9c7ff",
  },
  feedback: {
    card: "border-[#ffcbb6] bg-[#fff0e8] shadow-[0_16px_36px_rgba(255,122,89,0.16)]",
    accent: "text-[#c94f2e]",
    progress: "bg-[#ff7a59]",
    pill: "bg-[#ffe7dc] text-[#c94f2e]",
    label: "bg-[#ffe1d5] text-[#c94f2e]",
    buttonBg: "#ff7a59",
    buttonFg: "#ffffff",
    buttonShadow: "0 12px 28px rgba(255,122,89,0.24)",
    buttonSoftBg: "#ffe7dc",
    buttonSoftFg: "#c94f2e",
    buttonSoftBorder: "#ffcbb6",
  },
  campaign: {
    card: "border-[#f1db8d] bg-[#fff5d9] shadow-[0_16px_36px_rgba(192,138,0,0.16)]",
    accent: "text-[#a36d00]",
    progress: "bg-[#d59a13]",
    pill: "bg-[#fff0c8] text-[#a36d00]",
    label: "bg-[#ffefc2] text-[#a36d00]",
    buttonBg: "#d59a13",
    buttonFg: "#ffffff",
    buttonShadow: "0 12px 28px rgba(192,138,0,0.22)",
    buttonSoftBg: "#fff0c8",
    buttonSoftFg: "#a36d00",
    buttonSoftBorder: "#f1db8d",
  },
  custom: {
    card: "border-[#d6dde6] bg-[#f1f5f9] shadow-[0_16px_36px_rgba(16,16,16,0.09)]",
    accent: "text-[#475569]",
    progress: "bg-[#64748b]",
    pill: "bg-[#e8edf5] text-[#475569]",
    label: "bg-[#e5ebf3] text-[#475569]",
    buttonBg: "#64748b",
    buttonFg: "#ffffff",
    buttonShadow: "0 12px 28px rgba(71,85,105,0.22)",
    buttonSoftBg: "#e8edf5",
    buttonSoftFg: "#475569",
    buttonSoftBorder: "#d6dde6",
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
      return "Paste a shareable photo link";
    case "video":
      return "Paste a shareable video link";
    case "text":
      return "Describe what you did";
    case "link":
      return "Paste the supporting link";
    case "location":
      return "Enter the place or address";
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

function getMissionPrimaryAction(mission: UserMissionSummary) {
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
      label: "In review",
      disabled: true,
      href: undefined,
      type: "link" as const,
    };
  }

  if (mission.referral) {
    return {
      label: "Share invite",
      disabled: false,
      href: undefined,
      type: "share" as const,
    };
  }

  if (mission.requiresProof) {
    return {
      label: mission.status === "rejected" ? "Resubmit proof" : "Submit proof",
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
      label: mission.status === "in_progress" ? "Continue" : "Open lessons",
      disabled: false,
      href: "/courses",
      type: "link" as const,
    };
  }

  return {
    label: "Open mission",
    disabled: false,
    href: "/missions",
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
    "inline-flex h-11 min-w-[148px] items-center justify-center rounded-[30px] px-6 text-[0.95rem] font-semibold tracking-[-0.01em] transition",
    disabled && "cursor-not-allowed opacity-60",
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

export function MissionPanel({ maxItems, mode = "full" }: MissionPanelProps) {
  const [missions, setMissions] = useState<UserMissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedMissionId, setCopiedMissionId] = useState<string | null>(null);
  const [activeProofMissionId, setActiveProofMissionId] = useState<string | null>(null);
  const [proofDrafts, setProofDrafts] = useState<ProofDrafts>({});
  const [proofFieldMessage, setProofFieldMessage] = useState<string | null>(null);
  const [submittingProofField, setSubmittingProofField] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function loadMissions() {
    setLoading(true);
    try {
      const response = await fetch("/api/missions");
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
  }

  useEffect(() => {
    void loadMissions();
  }, []);

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
  }

  async function submitProofField(
    mission: UserMissionSummary,
    field: NonNullable<UserMissionSummary["proofRequiredFields"]>[number],
  ) {
    const value = (proofDrafts[field] ?? "").trim();
    if (!value) {
      setProofFieldMessage(`Add ${getMissionProofFieldLabel(field).toLowerCase()} proof before submitting.`);
      return;
    }

    setSubmittingProofField(field);
    const response = await fetch(`/api/missions/${mission.id}/proof`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
  const skeletonCount = maxItems ?? 3;

  useEffect(() => {
    setPage(1);
  }, [missions.length, maxItems, mode]);

  return (
    <section>
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

      <div className={cn("space-y-4", isFeatured ? "mt-3" : "mt-0")}>
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

        {!loading &&
          visibleMissions.map((mission) => {
            const theme = categoryTheme[mission.category];
            const rewardLabel = getMissionRewardLabel(mission);
            const progressPercent =
              mission.targetCount > 0
                ? Math.min(100, (mission.progressCount / mission.targetCount) * 100)
                : 0;
            const hasStructuredProgress =
              !mission.referral &&
              (mission.targetCount > 1 ||
                mission.progressCount > 0 ||
                mission.status === "completed" ||
                mission.requiresProof ||
                mission.status === "submitted" ||
                mission.status === "under_review" ||
                mission.status === "rejected");
            const copied = copiedMissionId === mission.id;
            const action = getMissionPrimaryAction(mission);
            const requiredReferralLessons = mission.referral?.requiredFriendLessonCount ?? 0;
            const referralLessonLabel = requiredReferralLessons === 1 ? "lesson" : "lessons";
            const proofRequirementSummary = mission.requiresProof ? getProofRequirementSummary(mission) : null;
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
                className={cn("overflow-hidden p-5 sm:p-6", theme.card)}
                key={mission.id}
                variant="quiet"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <div
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em]",
                        theme.label,
                      )}
                    >
                      {mission.category}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "ml-auto max-w-[72%] rounded-[18px] px-4 py-2.5 text-right sm:max-w-[18rem]",
                      theme.pill,
                    )}
                    title={rewardLabel}
                  >
                    <span className="block text-[0.95rem] font-black tracking-[-0.02em] sm:text-base">
                      {rewardLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-5 min-w-0">
                  <h3 className="text-[1.24rem] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
                    {mission.title}
                  </h3>
                  <p className="mt-3 max-w-none text-[0.98rem] font-medium leading-[1.7] text-[var(--ve-muted-strong)] sm:max-w-[34ch]">
                    {mission.description}
                  </p>
                </div>

                {hasStructuredProgress ? (
                  <div className="mt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.9rem] font-semibold tracking-[-0.01em] text-[#757575]">
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
                    <div className="mt-3 h-2 rounded-full bg-[color:color-mix(in_srgb,var(--ve-card)_65%,transparent)]">
                      <div
                        className={cn("h-full rounded-full", theme.progress)}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className={cn("mt-5 flex flex-wrap items-center gap-3", mission.referral && "items-stretch")}>
                  {action.type === "share" && mission.referral ? (
                    <>
                      <MissionActionButton
                        className="w-full sm:w-auto"
                        onClick={() => void shareReferralLink(mission.id, mission.referral!.shareUrl)}
                        style={primaryActionStyle}
                      >
                        Share invite
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
                  <div className="mt-4 rounded-[20px] border border-white/80 bg-[color:color-mix(in_srgb,var(--ve-card)_72%,transparent)] px-4 py-4">
                    <div className="rounded-[16px] bg-[var(--ve-card)] px-4 py-3 text-left">
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
                      XP is awarded when a friend completes {requiredReferralLessons} {referralLessonLabel}.
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
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
        <div className="fixed inset-0 z-50 bg-black/35 px-4 py-6">
          <div className="mx-auto max-w-[420px]">
            <Card className="max-h-[calc(100vh-3rem)] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                    Submit Proof
                  </p>
                  <h2 className="mt-2 text-xl font-black">{activeProofMission.title}</h2>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                    {activeProofMission.proofRequirementMode === "any"
                      ? `Choose any one of these ${activeProofMission.proofRequiredFields?.length ?? 0} proof options.`
                      : `Submit all ${activeProofMission.proofRequiredFields?.length ?? 0} proof items below.`}
                  </p>
                  {activeProofMission.status === "under_review" ? (
                    <p className="mt-2 text-xs font-semibold text-[#a66d00]">
                      Submitted items stay under review until an admin approves them.
                    </p>
                  ) : null}
                </div>
                <button
                  className="rounded-[12px] border border-[var(--ve-line-soft)] px-3 py-2 text-sm font-black text-[var(--ve-muted-strong)]"
                  onClick={closeProofModal}
                  type="button"
                >
                  Close
                </button>
              </div>

              {proofFieldMessage ? (
                <div className="mt-4 rounded-[14px] border border-[#f1ddd7] bg-[#fff7f4] px-4 py-3 text-sm font-black text-[#c94f2e]">
                  {proofFieldMessage}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {(activeProofMission.proofRequiredFields ?? []).map((field) => {
                  const fieldStatus = activeProofMission.proofFieldStatuses?.[field];
                  const isLocked = fieldStatus === "approved" || fieldStatus === "submitted";

                  return (
                    <div
                      className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4"
                      key={field}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">{getMissionProofFieldLabel(field)}</p>
                          <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                            {getProofFieldPlaceholder(field)}
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
                        <input
                          className="mt-3 h-12 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-sm font-medium outline-none"
                          disabled={isLocked}
                          onChange={(event) =>
                            setProofDrafts((current) => ({ ...current, [field]: event.target.value }))
                          }
                          placeholder={getProofFieldPlaceholder(field)}
                          type={getProofFieldInputType(field)}
                          value={proofDrafts[field] ?? ""}
                        />
                      )}

                      <div className="mt-3 flex justify-end">
                        <button
                          className="rounded-[14px] bg-[#ff7a59] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                          disabled={isLocked || submittingProofField === field}
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
