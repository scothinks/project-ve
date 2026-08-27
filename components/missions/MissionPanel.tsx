"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  AlertCircleIcon,
  BookmarkIcon,
  BoostIcon,
  BuildingIcon,
  CameraIcon,
  CheckCircleIcon,
  CopyIcon,
  DocumentIcon,
  HubIcon,
  InfoIcon,
  KitIcon,
  MedalIcon,
  MedicalIcon,
  OpenExternalIcon,
  ShareIcon,
  StarBadgeIcon,
  UploadCloudIcon,
} from "@/components/missions/MissionIcons";
import {
  getMissionBoostDetails,
  getMissionProofFieldLabel,
  getMissionRewardEffect,
  getMissionRewardLabel,
} from "@/lib/missions";
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
  organizationName?: string;
  pointsLabel?: string;
};

type ProofDrafts = Partial<Record<NonNullable<UserMissionSummary["proofRequiredFields"]>[number], string>>;
type ProofInputMode = Partial<Record<NonNullable<UserMissionSummary["proofRequiredFields"]>[number], "upload" | "link">>;
type ActiveTab = "active" | "available" | "history";

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

const categoryIcon: Record<UserMissionSummary["category"], ReactNode> = {
  course: <MedicalIcon className="size-5" />,
  referral: <ShareIcon className="size-5" />,
  feedback: <DocumentIcon className="size-5" />,
  campaign: <StarBadgeIcon className="size-4" />,
  custom: <StarBadgeIcon className="size-4" />,
};

function formatAvailableAgain(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function formatDueLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfDay(due).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff < 0) return "Past due";
  if (dayDiff === 0) return "Due today";
  if (dayDiff === 1) return "Due tomorrow";
  return `Due ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(due)}`;
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

function getProofFieldIcon(field: NonNullable<UserMissionSummary["proofRequiredFields"]>[number]) {
  switch (field) {
    case "image":
    case "video":
      return <CameraIcon className="size-4" />;
    default:
      return <DocumentIcon className="size-4" />;
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

function getMissionCardVariant(mission: UserMissionSummary, hasStructuredProgress: boolean) {
  if (getMissionRewardEffect(mission) === "boost") return "boost";
  if (!hasStructuredProgress && mission.rewardType === "reward") return "linked";
  return "structured";
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
  organizationName,
  pointsLabel = "XP",
}: MissionPanelProps) {
  const [missions, setMissions] = useState<UserMissionSummary[]>(initialMissions ?? []);
  const [loading, setLoading] = useState(!initialMissions);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedMissionId, setCopiedMissionId] = useState<string | null>(null);
  const [activeProofMissionId, setActiveProofMissionId] = useState<string | null>(null);
  const [proofDrafts, setProofDrafts] = useState<ProofDrafts>({});
  const [proofInputMode, setProofInputMode] = useState<ProofInputMode>({});
  const [proofFieldMessage, setProofFieldMessage] = useState<string | null>(null);
  const [submittingProofField, setSubmittingProofField] = useState<string | null>(null);
  const [uploadingProofField, setUploadingProofField] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<ActiveTab>("active");

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
    setProofInputMode((current) => {
      const next: ProofInputMode = {};
      for (const field of mission.proofRequiredFields ?? []) {
        next[field] = current[field] ?? "upload";
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
    const activeStatuses = new Set<UserMissionSummary["status"]>([
      "not_started",
      "in_progress",
      "submitted",
      "under_review",
      "rejected",
    ]);
    const active = visibleMissions.filter(
      (mission) => activeStatuses.has(mission.status) && !mission.referral,
    );
    const referrals = visibleMissions.filter((mission) => Boolean(mission.referral) && mission.status !== "completed");
    const activeAndReferrals = [...active.slice(0, 2), ...referrals];
    const activeIds = new Set(activeAndReferrals.map((mission) => mission.id));
    const available = visibleMissions.filter(
      (mission) => !activeIds.has(mission.id) && mission.status !== "completed",
    );
    const history = visibleMissions.filter((mission) => mission.status === "completed");

    return { active: activeAndReferrals, available, history };
  }, [visibleMissions]);
  const skeletonCount = maxItems ?? 3;

  useEffect(() => {
    setPage(1);
  }, [missions.length, maxItems, mode]);

  useEffect(() => {
    if (isFeatured) return;
    if (activeTab === "active" && missionGroups.active.length === 0 && missionGroups.available.length > 0) {
      setActiveTab("available");
    }
  }, [activeTab, isFeatured, missionGroups.active.length, missionGroups.available.length]);

  const tabs: Array<{ key: ActiveTab; label: string; count: number }> = [
    { key: "active", label: "Active", count: missionGroups.active.length },
    { key: "available", label: "Available", count: missionGroups.available.length },
    { key: "history", label: "History", count: missionGroups.history.length },
  ];
  const currentTabMissions = isFeatured ? visibleMissions : missionGroups[activeTab];

  function renderMissionCard(mission: UserMissionSummary) {
    const theme = categoryTheme[mission.category];
    const rewardLabel = getMissionRewardLabel(mission, pointsLabel);
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
    const action = getMissionPrimaryAction(mission);
    const variant = getMissionCardVariant(mission, hasStructuredProgress);
    const boostDetails = variant === "boost" ? getMissionBoostDetails(mission, pointsLabel) : null;
    const proofRequirementSummary = mission.requiresProof ? getProofRequirementSummary(mission) : null;
    const showReviewStatus =
      mission.status === "submitted" || mission.status === "under_review" || mission.status === "rejected";
    const isRequired = Boolean(mission.programmeContext?.isRequired);
    const dueLabel = formatDueLabel(mission.programmeContext?.dueAt);
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
    const outlineActionStyle: CSSProperties = {
      backgroundColor: "transparent",
      color: theme.buttonBg,
      border: `1px solid ${theme.buttonBg}`,
      boxShadow: "none",
    };

    if (mission.referral) {
      const referral = mission.referral;
      const copied = copiedMissionId === mission.id;

      return (
        <Card
          className="mission-card mission-card--referral min-w-0 !rounded-[8px] p-5 text-center"
          key={mission.id}
          variant="quiet"
        >
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--ve-card-muted)]">
            <HubIcon className="size-8 text-[var(--ve-green)]" />
          </div>
          <h3 className="mt-3 text-[1.15rem] font-black tracking-[-0.01em] text-[var(--foreground)]">
            {mission.title}
          </h3>
          <p className="mx-auto mt-1.5 max-w-[24rem] text-[0.82rem] font-medium leading-5 text-[var(--ve-muted-strong)]">
            {mission.description}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-3 text-left">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                {boostDetails ? "Qualification Reward" : "Mission Reward"}
              </p>
              {boostDetails ? (
                <>
                  <p className="mt-1 flex items-center gap-1 text-[1.05rem] font-black text-[var(--ve-green)]">
                    <BoostIcon className="size-4" />
                    {boostDetails.multiplier}x {boostDetails.unitLabel} Boost
                  </p>
                  {boostDetails.durationLabel ? (
                    <p className="mt-0.5 text-[0.7rem] font-bold text-[var(--ve-muted)]">
                      Active for {boostDetails.durationLabel}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-[1.05rem] font-black text-[var(--ve-green)]">{rewardLabel}</p>
              )}
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ve-green)] text-white">
              {boostDetails ? <BoostIcon className="size-5" /> : <MedalIcon className="size-5" />}
            </div>
          </div>

          <div className="mt-4 text-left">
            <h4 className="pl-1 text-[0.78rem] font-bold text-[var(--foreground)]">Share your link</h4>
            <div className="mt-2 flex items-center gap-1 rounded-[10px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-1">
              <div className="flex-1 truncate px-2.5 text-[0.8rem] font-medium text-[var(--ve-muted-strong)]">
                {referral.shareUrl}
              </div>
              <MissionActionButton
                className="shrink-0 gap-1.5 px-3"
                onClick={() => void copyReferralLink(mission.id, referral.shareUrl)}
                style={primaryActionStyle}
              >
                <CopyIcon className="size-3.5" />
                {copied ? "Copied" : "Copy link"}
              </MissionActionButton>
            </div>
            <button
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--ve-card-muted)] py-3 text-[0.82rem] font-bold text-[var(--foreground)]"
              onClick={() => void shareReferralLink(mission.id, referral.shareUrl)}
              type="button"
            >
              <ShareIcon className="size-4" />
              Share Invite via...
            </button>
          </div>

          <div className="mt-5 text-left">
            <h4 className="pl-1 text-[0.78rem] font-bold text-[var(--foreground)]">Your Referral Status</h4>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="aspect-square rounded-[10px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-2 text-center">
                <p className="mt-2 text-[1.4rem] font-black text-[var(--foreground)]">{referral.invitedCount}</p>
                <p className="mt-1 text-[10px] font-bold text-[var(--ve-muted)]">Invited</p>
              </div>
              <div className="aspect-square rounded-[10px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-2 text-center">
                <p className="mt-2 text-[1.4rem] font-black text-[var(--foreground)]">{referral.qualifiedCount}</p>
                <p className="mt-1 text-[10px] font-bold text-[var(--ve-muted)]">Qualified</p>
              </div>
              <div className="aspect-square rounded-[10px] bg-[var(--ve-green)] p-2 text-center shadow-sm">
                <p className="mt-2 text-[1.4rem] font-black text-white">{referral.awardedCount}</p>
                <p className="mt-1 text-[10px] font-bold text-white/80">Awarded</p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 rounded-[10px] bg-[var(--ve-card-muted)] p-3 text-left text-[0.72rem] font-medium leading-4 text-[var(--ve-muted-strong)]">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--ve-muted)]" />
              {mission.presentation?.rewardExplanation
                ?? `A referred learner becomes qualified after completing ${referral.requiredFriendLessonCount} ${referral.requiredFriendLessonCount === 1 ? "lesson" : "lessons"}.`}
            </p>
          </div>
        </Card>
      );
    }

    if (variant === "boost" && boostDetails) {
      const boostAccent = "#8b6b1c";
      const boostContent = (
        <>
          <div
            className="grid size-11 shrink-0 place-items-center rounded-full text-white shadow-sm"
            style={{ backgroundColor: boostAccent }}
          >
            <BoostIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[0.92rem] font-black leading-5 text-[var(--foreground)]">
              {mission.title}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-[0.74rem] font-medium leading-4 text-[var(--ve-muted-strong)]">
              {mission.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end" style={{ color: boostAccent }}>
            <div className="flex items-center gap-1">
              <BoostIcon className="size-[18px]" />
              <span className="text-[1.15rem] font-black leading-none">{boostDetails.multiplier}x</span>
            </div>
            <span className="mt-0.5 text-[0.64rem] font-bold leading-4">{boostDetails.unitLabel} Boost</span>
            {boostDetails.durationLabel ? (
              <span className="text-[0.64rem] font-medium leading-4 text-[var(--ve-muted)]">
                {boostDetails.durationLabel}
              </span>
            ) : null}
          </div>
        </>
      );
      const boostClasses = cn(
        "mission-card mission-card--boost flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-[8px] border p-4 text-left",
        "border-[#e4d9b8] bg-[#f7f2e4] shadow-none",
      );

      if (!action.disabled && action.type === "link") {
        return (
          <Link className={boostClasses} href={action.href ?? "#"} key={mission.id}>
            {boostContent}
          </Link>
        );
      }

      return (
        <div className={boostClasses} key={mission.id}>
          {boostContent}
        </div>
      );
    }

    if (variant === "linked") {
      return (
        <Card
          className={cn("mission-card mission-card--linked min-w-0 overflow-hidden p-4", theme.card)}
          key={mission.id}
          variant="quiet"
        >
          <div className="flex items-start justify-between gap-3">
            <div
              className="grid size-10 shrink-0 place-items-center rounded-[10px]"
              style={{ backgroundColor: theme.buttonSoftBg, color: theme.buttonBg }}
            >
              {categoryIcon[mission.category]}
            </div>
            <div
              className="ml-auto flex max-w-[60%] items-center gap-1.5 rounded-full px-2.5 py-1.5 text-right text-[0.74rem] font-black"
              style={{ backgroundColor: theme.buttonSoftBg, color: theme.buttonBg }}
              title={rewardLabel}
            >
              <KitIcon className="size-4 shrink-0" />
              <span className="truncate leading-none">{rewardLabel}</span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-[1.02rem] font-semibold leading-6 tracking-[-0.01em] text-[var(--foreground)]">
              {mission.title}
            </h3>
            <p className="mt-1 text-[0.82rem] font-medium leading-5 text-[var(--ve-muted-strong)]">
              {mission.description}
            </p>
          </div>
          <div className="mt-4">
            {action.type === "link" ? (
              <MissionActionButton
                className="w-full gap-2"
                disabled={action.disabled}
                href={action.href}
                style={outlineActionStyle}
              >
                {action.label}
                <OpenExternalIcon className="size-4" />
              </MissionActionButton>
            ) : (
              <MissionActionButton className="w-full" style={primaryActionStyle}>
                {action.label}
              </MissionActionButton>
            )}
          </div>
        </Card>
      );
    }

    return (
      <Card
        className={cn(
          "mission-card min-w-0 overflow-hidden p-4 sm:p-4",
          `mission-card--${mission.category}`,
          mission.referral && "mission-card--referral",
          theme.card,
        )}
        key={mission.id}
        variant="quiet"
      >
        <div className="mission-card__top-row flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isRequired ? (
              <div className="inline-flex items-center gap-1 rounded-[8px] bg-[#fff0bd] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#a66d00]">
                Required
              </div>
            ) : (
              <div
                className={cn(
                  "inline-flex rounded-[8px] px-0 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
                  theme.label,
                )}
              >
                {mission.category} mission
              </div>
            )}
            {dueLabel ? (
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--ve-muted)]">
                {dueLabel}
              </span>
            ) : null}
            {!mission.referral ? (
              <BookmarkIcon className="size-4 shrink-0 text-[var(--ve-muted-soft)]" />
            ) : null}
            {showReviewStatus ? (
              <span className="rounded-[8px] bg-[color:color-mix(in_srgb,var(--ve-card)_72%,transparent)] px-2.5 py-1 text-[10px] font-black text-[var(--ve-muted-strong)]">
                {statusCopy[mission.status]}
              </span>
            ) : null}
          </div>

          {!mission.referral ? (
            <div
              className={cn(
                "mission-card__reward",
                "ml-auto flex min-w-0 max-w-[58%] items-center gap-1 rounded-[12px] px-1 py-1 text-right sm:max-w-[18rem]",
                theme.pill,
              )}
              title={rewardLabel}
            >
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#087f5b] text-white">
                <StarBadgeIcon className="size-2.5" />
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[0.78rem] font-black tracking-[-0.01em] sm:text-sm">
                <span className="truncate leading-none">{rewardLabel}</span>
              </span>
            </div>
          ) : null}
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

        {mission.requiresProof && mission.proofRequiredFields?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {mission.proofRequiredFields.map((field) => (
              <div
                className="flex items-center gap-1 rounded bg-[var(--ve-card-muted)] px-2 py-1 text-[11px] font-bold text-[var(--ve-muted-strong)]"
                key={field}
              >
                {getProofFieldIcon(field)}
                {getMissionProofFieldLabel(field)}
              </div>
            ))}
          </div>
        ) : null}

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

        <div className="mission-card__actions mt-4 flex flex-wrap items-center gap-2">
          {action.type === "proof" ? (
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

        {mission.presentation?.terms ? (
          <p className="mt-4 text-[11px] font-semibold leading-5 text-[var(--ve-muted)]">
            {mission.presentation.terms}
          </p>
        ) : null}
      </Card>
    );
  }

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

      {!isFeatured && !loading && missions.length > 0 ? (
        <div className="mission-panel__tabs mb-5 flex gap-6 border-b border-[var(--ve-line-soft)] lg:hidden">
          {tabs.map((tab) => (
            <button
              className={cn(
                "relative flex items-center gap-1.5 pb-3 text-[0.85rem] font-semibold tracking-[-0.01em] transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-[var(--ve-green)] text-[var(--ve-green)]"
                  : "border-b-2 border-transparent text-[var(--ve-muted)] hover:text-[var(--foreground)]",
              )}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
              {tab.key === "active" && tab.count > 0 ? (
                <span className="grid size-4 place-items-center rounded-full bg-[var(--ve-green)] text-[9px] font-black leading-none text-white">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-[18px] border border-[#ffe2d3] bg-[#fff0e8] px-4 py-3 text-xs font-bold text-[#c94f2e]">
          {message}
        </div>
      ) : null}

      <div className={cn(isFeatured ? "learner-card-grid mt-3" : "mission-panel__groups")}>
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

        {!loading && visibleMissions.length > 0 && !isFeatured
          ? tabs.map((group) => (
              <div
                className={cn(
                  "mission-panel__group",
                  `mission-panel__group--${group.key}`,
                  "space-y-3",
                  activeTab === group.key ? "block" : "hidden lg:block",
                )}
                key={group.key}
              >
                <h2 className="mission-panel__group-title hidden text-[1.05rem] font-black tracking-[-0.01em] text-[var(--foreground)] lg:block">
                  {group.key === "history" ? "Mission History" : group.label}
                </h2>
                <div
                  className={cn(
                    "mission-panel__group-grid learner-card-grid",
                    `mission-panel__group-grid--${group.key}`,
                  )}
                >
                  {missionGroups[group.key].length === 0 ? (
                    <Card className="mission-card mission-card--empty !rounded-[8px] p-6 text-center" variant="quiet">
                      <p className="text-xs font-semibold text-[var(--ve-muted)]">
                        {group.key === "history"
                          ? "No completed missions yet. Get started above!"
                          : "Nothing here right now. Check back soon."}
                      </p>
                    </Card>
                  ) : (
                    missionGroups[group.key].map((mission) => renderMissionCard(mission))
                  )}
                </div>
              </div>
            ))
          : null}

        {!loading && isFeatured && currentTabMissions.map((mission) => renderMissionCard(mission))}
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
            <Card className="mission-proof-dialog max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-b-none p-0 sm:rounded-b-[24px]">
              <div className="mission-proof-dialog__header sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--ve-line-soft)] bg-[color:color-mix(in_srgb,var(--ve-card)_92%,transparent)] px-5 py-4 backdrop-blur-md">
                <button
                  aria-label="Close proof submission"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--ve-muted-strong)] hover:bg-[var(--ve-card-muted)]"
                  onClick={closeProofModal}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                    <path d="M20 12H6m0 0 5-5m-5 5 5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                  </svg>
                </button>
                <h2 className="flex-1 truncate text-center text-[1.02rem] font-black tracking-[-0.01em]">
                  Submit Proof
                </h2>
                <div className="size-9 shrink-0" />
              </div>

              <div className="p-5">
                <div className="flex flex-col gap-1.5">
                  {organizationName ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                      <BuildingIcon className="size-3.5" />
                      {organizationName}
                    </div>
                  ) : null}
                  <h2 className="text-[1.4rem] font-black leading-7 tracking-[-0.01em] text-[var(--foreground)]">
                    {activeProofMission.title}
                  </h2>
                  <p className="text-[0.85rem] font-medium leading-6 text-[var(--ve-muted-strong)]">
                    Provide the required evidence to complete this mission. All submissions will be reviewed by
                    an organisation instructor.
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-[8px] bg-[#dff2e9] px-2.5 py-1 text-[11px] font-black text-[#087f5b]">
                      {getMissionRewardLabel(activeProofMission, pointsLabel)}
                    </span>
                    <span className="text-[11px] font-black text-[var(--ve-muted)]">
                      {activeProofMission.proofRequirementMode === "any"
                        ? `Any 1 of ${activeProofMission.proofRequiredFields?.length ?? 0} proof options`
                        : "Proof required"}
                    </span>
                  </div>
                  {activeProofMission.status === "under_review" ? (
                    <p className="mt-1 text-xs font-semibold text-[#a66d00]">
                      {activeProofMission.presentation?.pendingMessage
                        ?? "Submitted items stay under review until an admin approves them."}
                    </p>
                  ) : null}
                </div>

                {proofFieldMessage ? (
                  <div className="mt-4 rounded-[14px] border border-[#f1ddd7] bg-[#fff7f4] px-4 py-3 text-sm font-black text-[#c94f2e]">
                    {proofFieldMessage}
                  </div>
                ) : null}

                <div className="mission-proof-grid mt-5 flex flex-col gap-3">
                  {(activeProofMission.proofRequiredFields ?? []).map((field) => {
                    const fieldStatus = activeProofMission.proofFieldStatuses?.[field];
                    const isLocked = fieldStatus === "approved" || fieldStatus === "submitted";
                    const isRejected = fieldStatus === "rejected";
                    const isMediaField = field === "image" || field === "video";
                    const inputMode = proofInputMode[field] ?? "upload";

                    return (
                      <div
                        className={cn(
                          "mission-proof-field rounded-[12px] border p-4",
                          isRejected
                            ? "border-[#f3c6bd] bg-[#fff7f4]"
                            : "border-[var(--ve-line-soft)] bg-[var(--ve-shell)]",
                        )}
                        key={field}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <div
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-full",
                                isRejected
                                  ? "bg-[#fbe4e0] text-[#c00000]"
                                  : "bg-[var(--ve-card-muted)] text-[var(--ve-muted-strong)]",
                              )}
                            >
                              {getProofFieldIcon(field)}
                            </div>
                            <div>
                              <p className="text-sm font-black">{getMissionProofFieldLabel(field)}</p>
                              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                {getProofFieldInstruction(field)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]",
                              getProofFieldStatusTone(fieldStatus, activeProofMission.proofRequirementMode),
                            )}
                          >
                            {isRejected ? <AlertCircleIcon className="size-3.5" /> : null}
                            {fieldStatus === "approved" || fieldStatus === "submitted" ? (
                              <CheckCircleIcon className="size-3.5" />
                            ) : null}
                            {getProofFieldStatusLabel(fieldStatus, activeProofMission.proofRequirementMode)}
                          </span>
                        </div>

                        {isRejected && activeProofMission.presentation?.rejectionMessage ? (
                          <div className="mt-3 rounded-lg border-l-2 border-[#c00000] bg-[var(--ve-card-muted)] px-3 py-2">
                            <p className="text-[13px] leading-5 text-[var(--ve-muted-strong)]">
                              <strong className="font-medium text-[#c00000]">Instructor note: </strong>
                              {activeProofMission.presentation.rejectionMessage}
                            </p>
                          </div>
                        ) : null}

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
                            {isMediaField ? (
                              <div className="mt-3 flex flex-col gap-3">
                                <div className="flex rounded-lg bg-[var(--ve-card-muted)] p-1">
                                  <button
                                    className={cn(
                                      "flex-1 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors",
                                      inputMode === "upload"
                                        ? "bg-[var(--ve-card)] text-[var(--foreground)] shadow-sm"
                                        : "text-[var(--ve-muted)]",
                                    )}
                                    onClick={() => setProofInputMode((current) => ({ ...current, [field]: "upload" }))}
                                    type="button"
                                  >
                                    Upload {getMissionProofFieldLabel(field)}
                                  </button>
                                  <button
                                    className={cn(
                                      "flex-1 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors",
                                      inputMode === "link"
                                        ? "bg-[var(--ve-card)] text-[var(--foreground)] shadow-sm"
                                        : "text-[var(--ve-muted)]",
                                    )}
                                    onClick={() => setProofInputMode((current) => ({ ...current, [field]: "link" }))}
                                    type="button"
                                  >
                                    Paste Link
                                  </button>
                                </div>

                                {inputMode === "upload" ? (
                                  <label
                                    className={cn(
                                      "flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center",
                                      isRejected
                                        ? "border-[#e3a99e] bg-[#fff2ee]"
                                        : "border-[var(--ve-line)] bg-[var(--ve-card-muted)]",
                                    )}
                                  >
                                    <UploadCloudIcon className={cn("size-5", isRejected ? "text-[#c00000]" : "text-[var(--ve-muted-strong)]")} />
                                    <p className={cn("text-xs font-semibold", isRejected ? "text-[#c00000]" : "text-[var(--ve-muted-strong)]")}>
                                      <span className="font-bold">Tap to upload</span> or drag and drop
                                    </p>
                                    <input
                                      accept={
                                        field === "image"
                                          ? "image/png,image/jpeg,image/webp"
                                          : "video/mp4,video/webm,video/quicktime"
                                      }
                                      className="hidden"
                                      disabled={isLocked || uploadingProofField === field}
                                      onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null;
                                        event.target.value = "";
                                        void uploadAndSubmitProofMedia(activeProofMission, field, file);
                                      }}
                                      type="file"
                                    />
                                  </label>
                                ) : (
                                  <input
                                    className="h-12 w-full rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-sm font-medium outline-none"
                                    disabled={isLocked}
                                    onChange={(event) =>
                                      setProofDrafts((current) => ({ ...current, [field]: event.target.value }))
                                    }
                                    placeholder={getProofFieldPlaceholder(field)}
                                    type={getProofFieldInputType(field)}
                                    value={proofDrafts[field] ?? ""}
                                  />
                                )}
                                {uploadingProofField === field ? (
                                  <p className="text-xs font-semibold text-[var(--ve-muted)]">Uploading…</p>
                                ) : null}
                              </div>
                            ) : (
                              <input
                                className="mt-3 h-12 w-full rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-sm font-medium outline-none"
                                disabled={isLocked}
                                onChange={(event) =>
                                  setProofDrafts((current) => ({ ...current, [field]: event.target.value }))
                                }
                                placeholder={getProofFieldPlaceholder(field)}
                                type={getProofFieldInputType(field)}
                                value={proofDrafts[field] ?? ""}
                              />
                            )}
                          </>
                        )}

                        {!isMediaField || inputMode === "link" ? (
                          <div className="mt-3 flex justify-end">
                            <button
                              className="min-h-10 rounded-[10px] bg-[#087f5b] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                              disabled={isLocked || submittingProofField === field || uploadingProofField === field}
                              onClick={() => void submitProofField(activeProofMission, field)}
                              type="button"
                            >
                              {submittingProofField === field
                                ? "Submitting..."
                                : isRejected
                                  ? `Resubmit ${getMissionProofFieldLabel(field)}`
                                  : `Submit ${getMissionProofFieldLabel(field)}`}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-[var(--ve-line-soft)] bg-[color:color-mix(in_srgb,var(--ve-card)_92%,transparent)] px-5 py-3 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--ve-muted)]">Progress</span>
                  <span className="text-[0.85rem] font-black text-[var(--foreground)]">
                    {(activeProofMission.proofRequiredFields ?? []).filter(
                      (field) =>
                        activeProofMission.proofFieldStatuses?.[field] === "approved" ||
                        activeProofMission.proofFieldStatuses?.[field] === "submitted",
                    ).length}{" "}
                    of {(activeProofMission.proofRequiredFields ?? []).length} Complete
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  );
}
