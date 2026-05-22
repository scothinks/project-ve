"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExperienceHeader } from "@/components/ui/ExperienceHeader";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { XPBadge } from "@/components/ui/XPBadge";
import { normalizeEmailInput, sanitizePlainTextInput } from "@/lib/input-safety";
import { paginateItems } from "@/lib/pagination";
import {
  formatRewardDate,
  getRewardLimitLabel,
  type RewardRedemption,
  type RewardStoreSnapshot,
  type StoreReward,
} from "@/lib/rewards";
import { cn } from "@/lib/utils";
import { formatXpLabel } from "@/lib/xp-format";

type Tab = "store" | "history";

const fulfillmentLabels: Record<StoreReward["fulfillmentType"], string> = {
  manual: "Details form",
  voucher_code: "Voucher code",
  qr_code: "QR pass",
  external_link: "Partner link",
  native: "Instant unlock",
};

const distributionLabels: Record<StoreReward["distributionMode"], string> = {
  direct: "Direct reward",
  perk_bundle: "Surprise perk",
};

const claimStateLabels: Record<RewardRedemption["claimState"], string> = {
  purchased: "Ready",
  claim_started: "Started",
  details_submitted: "Processing",
  fulfilled: "Fulfilled",
  expired: "Expired",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function shouldShowRedemptionMessage(redemption: RewardRedemption) {
  if (
    redemption.fulfillmentType === "manual"
    && redemption.claimState === "details_submitted"
    && redemption.userMessage === "Submitted for processing."
  ) {
    return false;
  }

  if (
    (redemption.fulfillmentType === "voucher_code" && redemption.userMessage === "Your voucher code is ready.")
    || (redemption.fulfillmentType === "qr_code" && redemption.userMessage === "Your QR pass is ready.")
    || (redemption.fulfillmentType === "external_link" && redemption.userMessage === "Your reward link is ready.")
    || (redemption.fulfillmentType === "native" && redemption.userMessage === "Your native reward has been applied.")
  ) {
    return false;
  }

  return Boolean(redemption.userMessage);
}

function getNativeOutcomeDetails(redemption: RewardRedemption) {
  const payload = redemption.fulfillmentPayload;
  const amount = Number(payload.amount ?? 0);
  const multiplier = Number(payload.multiplier ?? 0);
  const durationHours = Number(payload.durationHours ?? 0);
  const uses = Number(payload.uses ?? 0);

  if (multiplier > 0) {
    const durationCopy =
      durationHours > 0
        ? ` for ${durationHours} hour${durationHours === 1 ? "" : "s"}`
        : "";
    const usesCopy = uses > 0 ? ` and ${uses} use${uses === 1 ? "" : "s"}` : "";

    return {
      eyebrow: "Boost Unlocked",
      emphasis: `${multiplier}x XP`,
      description: `${multiplier}x XP boost is now active${durationCopy}${usesCopy}.`,
    };
  }

  return {
    eyebrow: "XP Unlocked",
    emphasis: amount > 0 ? `+${amount} XP` : redemption.rewardTitle,
    description: amount > 0
      ? `${amount} XP has been added to your balance.`
      : "This XP reward has been added to your balance.",
  };
}

function RewardThumb({
  thumbnail,
  title,
}: {
  thumbnail: StoreReward["thumbnail"] | RewardRedemption["rewardThumbnail"];
  title: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackIcon = thumbnail.icon
    ?? (title.toLowerCase().includes("xp") ? "XP" : title.slice(0, 4).toUpperCase());

  if (thumbnail.url && !imageFailed) {
    return (
      <img
        alt=""
        className="h-full w-full object-cover"
        onError={() => setImageFailed(true)}
        src={thumbnail.url}
      />
    );
  }

  return (
    <div
      className="grid h-full w-full place-items-center text-[11px] font-black text-[#008751]"
      style={{ backgroundColor: thumbnail.color ?? "#f4fbf7" }}
    >
      {fallbackIcon}
    </div>
  );
}

function parseText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sanitizeFieldValue(value: string, type: string) {
  if (type === "email") {
    return normalizeEmailInput(value);
  }

  return sanitizePlainTextInput(value, type === "textarea" ? 2000 : 500);
}

function buildPseudoQrSvg(value: string) {
  const size = 29;
  const quietZone = 2;
  const cell = 6;
  const fullSize = (size + quietZone * 2) * cell;
  const bytes = Array.from(new TextEncoder().encode(value || "PROJECT-VE-PASS"));
  let seed = bytes.reduce((total, byte, index) => (total * 131 + byte + index) >>> 0, 2166136261);
  const rects: string[] = [];

  const hasFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

  const drawCell = (x: number, y: number) => {
    rects.push(
      `<rect x="${(x + quietZone) * cell}" y="${(y + quietZone) * cell}" width="${cell}" height="${cell}" rx="1" ry="1" />`,
    );
  };

  const drawFinder = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || center) {
          drawCell(startX + x, startY + y);
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (hasFinder(x, y)) {
        continue;
      }

      seed = (seed * 1664525 + 1013904223) >>> 0;
      const byte = bytes[(x + y) % bytes.length] ?? 0;
      const shouldFill = ((seed >>> 28) ^ byte ^ x ^ (y << 1)) % 2 === 0;

      if (shouldFill) {
        drawCell(x, y);
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" fill="none"><rect width="${fullSize}" height="${fullSize}" rx="24" fill="#ffffff"/><g fill="#111111">${rects.join("")}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function RewardFulfillment({
  redemption,
  onRefreshRedemption,
  suppressNativeEyebrow = false,
}: {
  redemption: RewardRedemption;
  onRefreshRedemption?: (redemptionId: string) => Promise<RewardRedemption | null>;
  suppressNativeEyebrow?: boolean;
}) {
  const payload = redemption.fulfillmentPayload;
  const redemptionExpired =
    redemption.claimState === "expired" ||
    Boolean(redemption.redemptionExpiresAt && new Date(redemption.redemptionExpiresAt) <= new Date());

  if (redemptionExpired) {
    return (
      <div className="rounded-[18px] bg-[#fff7ed] px-4 py-3 text-xs font-bold leading-5 text-[#9a4f00]">
        This reward redemption has expired.
      </div>
    );
  }

  if (redemption.fulfillmentType === "manual") {
    if (redemption.claimState === "fulfilled") {
      return (
        <div className="rounded-[18px] bg-[var(--ve-panel)] px-4 py-3 text-xs font-bold leading-5 text-[var(--ve-muted-strong)]">
          This reward has been fulfilled.
        </div>
      );
    }

    if (redemption.claimState === "details_submitted") {
      return (
        <div className="rounded-[18px] bg-[#f4fbf7] px-4 py-3 text-xs font-bold leading-5 text-[#008751]">
          Submitted for processing.
        </div>
      );
    }

    return <ManualClaimForm onRefreshRedemption={onRefreshRedemption} redemption={redemption} />;
  }

  if (redemption.fulfillmentType === "voucher_code") {
    const code = parseText(payload.code) || "Code pending";

    return (
      <div className="rounded-[22px] border border-[#ffe7a6] bg-[#fffaf0] p-4 shadow-[0_16px_32px_rgba(246,196,83,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a66d00]">
              Voucher Code
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
              Use this code with the partner to redeem your reward.
            </p>
          </div>
          <div className="rounded-full bg-[#fff0bd] px-3 py-2 text-[11px] font-black text-[#a66d00]">
            Ready
          </div>
        </div>
        <div className="mt-4 rounded-[18px] border border-dashed border-[#efcf70] bg-[var(--ve-card)] px-4 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ve-muted)]">
            Redemption Code
          </p>
          <p className="mt-2 break-all text-[1.45rem] font-black tracking-[0.18em] text-[#111111]">
            {code}
          </p>
        </div>
      </div>
    );
  }

  if (redemption.fulfillmentType === "qr_code") {
    const qrPayload = parseText(payload.qrPayload) || redemption.id;

    return (
      <div className="rounded-[22px] border border-[#dce8ff] bg-[#f7fbff] p-4 shadow-[0_16px_32px_rgba(65,105,225,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#35508f]">
              Scan Pass
            </p>
            <p className="mt-1 text-xs font-semibold text-[#7182ad]">
              Present this pass when a partner needs to verify your reward.
            </p>
          </div>
          <div className="rounded-full bg-[#e4eeff] px-3 py-2 text-[11px] font-black text-[#35508f]">
            Ready
          </div>
        </div>
        <div className="mt-4 rounded-[22px] bg-[var(--ve-card)] p-4">
          <img
            alt="Reward pass"
            className="mx-auto size-44 rounded-[18px]"
            src={buildPseudoQrSvg(qrPayload)}
          />
          <div className="mt-4 rounded-[16px] bg-[var(--ve-card-muted)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              Pass Reference
            </p>
            <p className="mt-1 break-all text-xs font-black text-[var(--foreground)]">{qrPayload}</p>
          </div>
        </div>
      </div>
    );
  }

  if (redemption.fulfillmentType === "external_link") {
    const url = parseText(payload.url);
    return (
      <Button
        className="w-full"
        href={url || "/xp-store"}
        target={url ? "_blank" : undefined}
        variant="primary"
      >
        {parseText(payload.label) || "Open reward"}
      </Button>
    );
  }

  const nativeOutcome = getNativeOutcomeDetails(redemption);

  return (
    <div className="rounded-[22px] border border-[#cde8db] bg-[#eefaf4] p-4 shadow-[0_16px_32px_rgba(8,127,91,0.08)]">
      {!suppressNativeEyebrow ? (
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#087f5b]">
          {nativeOutcome.eyebrow}
        </p>
      ) : null}
      <p className="mt-2 text-[1.55rem] font-black text-[var(--foreground)]">
        {nativeOutcome.emphasis}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#4d665c]">
        {nativeOutcome.description}
      </p>
    </div>
  );
}

function StoreLoadingState() {
  return (
    <section className="px-6 pb-28 pt-5">
      <ExperienceHeader
        badge={
          <div className="grid size-16 place-items-center rounded-[22px] bg-[#f6c453] text-xl font-black text-[#251b08] shadow-[0_12px_24px_rgba(246,196,83,0.26)]">
            XP
          </div>
        }
        eyebrow="Reward Time"
        subtitle="Loading rewards and your purchase history."
        title="Redeem XP rewards"
        tone="store"
      />
      <Card className="mt-6 space-y-4 p-5" variant="store">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-full bg-[#fff4c4]" />
            <div className="h-7 w-28 rounded-full bg-[#eeeeee]" />
          </div>
          <div className="h-8 w-16 rounded-[18px] bg-[#fff8df]" />
        </div>
      </Card>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-[18px] bg-[#fff4c4] p-1">
        <div className="h-10 rounded-[14px] bg-[var(--ve-card)]" />
        <div className="h-10 rounded-[14px] bg-[#ffedab]" />
      </div>
      <div className="mt-5 space-y-3">
        {[0, 1].map((item) => (
          <Card className="flex gap-4 p-4" key={item} variant="store">
            <div className="size-20 shrink-0 rounded-[18px] bg-[#fff8df]" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-36 rounded-full bg-[#eeeeee]" />
              <div className="h-3 w-full rounded-full bg-[#f3f3f1]" />
              <div className="h-3 w-2/3 rounded-full bg-[#f3f3f1]" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ManualClaimForm({
  redemption,
  onRefreshRedemption,
}: {
  redemption: RewardRedemption;
  onRefreshRedemption?: (redemptionId: string) => Promise<RewardRedemption | null>;
}) {
  const fields = redemption.fulfillmentConfig.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const response = await fetch(`/api/redemptions/${redemption.id}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ claimData: values }),
    });
    const data = await response.json();

    setSubmitting(false);

    if (!response.ok) {
      setMessage(data.error ?? "Could not submit details.");
      return;
    }

    const refreshedRedemption = await onRefreshRedemption?.(redemption.id);
    if (!refreshedRedemption) {
      setMessage("Submitted for processing.");
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void submitDetails(event)}>
      {fields.map((field) => {
        const commonClasses =
          "w-full rounded-[18px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-semibold outline-none focus:border-[#008751]";

        return (
          <label className="block" key={field.id}>
            <span className="text-[11px] font-bold text-[var(--ve-muted)]">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                className={cn(commonClasses, "mt-1 min-h-24 resize-none")}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.id]: sanitizeFieldValue(event.target.value, field.type),
                  }))
                }
                maxLength={2000}
                required={field.required}
                value={values[field.id] ?? ""}
              />
            ) : (
              <input
                className={cn(commonClasses, "mt-1")}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.id]: sanitizeFieldValue(event.target.value, field.type),
                  }))
                }
                maxLength={field.type === "email" ? 254 : 500}
                required={field.required}
                type={field.type}
                value={values[field.id] ?? ""}
              />
            )}
          </label>
        );
      })}
      <Button className="w-full" disabled={submitting} type="submit">
        {submitting ? "Submitting..." : "Submit Details"}
      </Button>
      {message ? <p className="text-xs font-bold text-[#008751]">{message}</p> : null}
    </form>
  );
}

export function XPStore() {
  const [snapshot, setSnapshot] = useState<RewardStoreSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("store");
  const [expandedRewardId, setExpandedRewardId] = useState<string | null>(null);
  const [expandedRedemptionId, setExpandedRedemptionId] = useState<string | null>(null);
  const [activeRedemption, setActiveRedemption] = useState<RewardRedemption | null>(null);
  const [confirmReward, setConfirmReward] = useState<StoreReward | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [storePage, setStorePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const activeNativeOutcome =
    activeRedemption?.fulfillmentType === "native"
      ? getNativeOutcomeDetails(activeRedemption)
      : null;
  const rewardItems = snapshot?.rewards ?? [];
  const redemptionItems = snapshot?.redemptions ?? [];
  const paginatedRewards = useMemo(
    () => paginateItems(rewardItems, storePage, 6),
    [rewardItems, storePage],
  );
  const paginatedRedemptions = useMemo(
    () => paginateItems(redemptionItems, historyPage, 6),
    [redemptionItems, historyPage],
  );

  async function loadStore() {
    const response = await fetch("/api/rewards", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setSnapshot(null);
      setAuthRequired(response.status === 401);
      setMessage(data.error ?? "Could not load XP Store.");
      setLoading(false);
      return null;
    }

    const nextSnapshot = data as RewardStoreSnapshot;
    setAuthRequired(false);
    setSnapshot(nextSnapshot);
    setLoading(false);
    return nextSnapshot;
  }

  useEffect(() => {
    void loadStore();

    function reload() {
      void loadStore();
    }

    window.addEventListener("xp-store:reload", reload);
    return () => window.removeEventListener("xp-store:reload", reload);
  }, []);

  useEffect(() => {
    if (!activeRedemption || !snapshot) {
      return;
    }

    const refreshed = snapshot.redemptions.find((redemption) => redemption.id === activeRedemption.id);
    if (refreshed && refreshed !== activeRedemption) {
      setActiveRedemption(refreshed);
    }
  }, [activeRedemption, snapshot]);

  useEffect(() => {
    setStorePage(1);
    setHistoryPage(1);
  }, [snapshot?.rewards.length, snapshot?.redemptions.length]);

  async function refreshRedemption(redemptionId: string) {
    const nextSnapshot = await loadStore();
    if (!nextSnapshot) {
      return null;
    }

    const refreshed = nextSnapshot.redemptions.find((redemption) => redemption.id === redemptionId) ?? null;
    if (refreshed) {
      setExpandedRedemptionId(refreshed.id);
      setActiveRedemption((current) => (current?.id === refreshed.id ? refreshed : current));
    }
    return refreshed;
  }

  async function redeemReward() {
    if (!confirmReward) {
      return;
    }

    setRedeeming(true);
    setMessage(null);

    const response = await fetch(`/api/rewards/${confirmReward.id}/redeem`, {
      method: "POST",
    });
    const data = await response.json();

    setRedeeming(false);

    if (!response.ok) {
      setConfirmReward(null);
      setMessage(data.error ?? "Could not redeem XP for this reward.");
      await loadStore();
      return;
    }

    setMessage("Reward added to your history.");
    setConfirmReward(null);
    const nextSnapshot = await loadStore();
    const redemptionId =
      data && typeof data === "object" && data.redemption && typeof data.redemption === "object"
        ? String((data.redemption as { id?: string }).id ?? "")
        : "";

    if (nextSnapshot && redemptionId) {
      const createdRedemption = nextSnapshot.redemptions.find(
        (redemption) => redemption.id === redemptionId,
      );

      if (createdRedemption) {
        setExpandedRedemptionId(createdRedemption.id);
        setActiveRedemption(createdRedemption);
      }
    }
  }

  if (loading) {
    return <StoreLoadingState />;
  }

  if (!snapshot) {
    return (
      <section className="px-6 py-8">
        <Card className="p-6" variant="store">
          <p className="text-sm font-bold">{message ?? "Could not load XP Store."}</p>
          {authRequired ? (
            <Button className="mt-4 w-full" href="/login">
              Sign In
            </Button>
          ) : (
            <Button className="mt-4 w-full" onClick={() => void loadStore()} type="button">
              Try Again
            </Button>
          )}
        </Card>
      </section>
    );
  }

  return (
    <section className="px-6 pb-28 pt-5">
      <ExperienceHeader
        badge={
          <div className="grid size-16 place-items-center rounded-[22px] bg-[#f6c453] text-xl font-black text-[#251b08] shadow-[0_12px_24px_rgba(246,196,83,0.26)]">
            XP
          </div>
        }
        eyebrow="Reward Time"
        subtitle="Pick a perk, redeem your XP, and find every purchase in history."
        title="Redeem XP rewards"
        tone="store"
      />

      <Card className="mt-6 p-6" variant="store">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a66d00]">
              Available XP
            </p>
            <p className="mt-1 max-w-[12rem] whitespace-nowrap text-[clamp(1.5rem,7vw,2rem)] font-black leading-none tabular-nums">
              {formatXpLabel(snapshot.xpBalance)}
            </p>
          </div>
          <StatusBadge tone="store">Ready</StatusBadge>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-[18px] bg-[#fff4c4] p-1">
        <button
          className={cn(
            "h-10 rounded-[14px] text-[0.98rem] font-semibold tracking-[-0.01em]",
            tab === "store" ? "bg-[var(--ve-card)] text-[#a66d00]" : "text-[#8a743a]",
          )}
          onClick={() => setTab("store")}
          type="button"
        >
          Store
        </button>
        <button
          className={cn(
            "h-10 rounded-[14px] text-[0.98rem] font-semibold tracking-[-0.01em]",
            tab === "history" ? "bg-[var(--ve-card)] text-[#a66d00]" : "text-[#8a743a]",
          )}
          onClick={() => setTab("history")}
          type="button"
        >
          History
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-[18px] border border-[#ffe7a6] bg-[#fff8df] px-4 py-3 text-xs font-bold text-[#a66d00]">
          {message}
        </div>
      ) : null}

      {tab === "store" ? (
        <div className="mt-5 space-y-4">
          {snapshot.rewards.length === 0 ? (
            <Card className="p-6 text-center" variant="store">
              <p className="text-sm font-black">No rewards available</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                New rewards will appear here when they are available.
              </p>
            </Card>
          ) : paginatedRewards.items.map((reward) => {
            const expanded = expandedRewardId === reward.id;
            const canRedeem = snapshot.xpBalance >= reward.costXp && !reward.isSoldOut;

            return (
              <Card className="overflow-hidden p-5" key={reward.id} variant="store">
                <div className="flex gap-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-[18px]">
                    <RewardThumb thumbnail={reward.thumbnail} title={reward.title} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[1.08rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                          {reward.title}
                        </h2>
                        <p className="mt-2 text-[0.98rem] font-medium leading-7 text-[var(--ve-muted)]">
                          {reward.description}
                        </p>
                      </div>
                      <XPBadge
                        xp={reward.costXp}
                        className="h-8 shrink-0 bg-[#fff8df] px-3 text-xs text-[#a66d00]"
                      />
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <button
                        className="text-[0.95rem] font-medium tracking-[-0.01em] text-[#a66d00]"
                        onClick={() => setExpandedRewardId(expanded ? null : reward.id)}
                        type="button"
                      >
                        {expanded ? "Hide details" : "Details"}
                      </button>
                      <Button
                        className="h-10 px-5 text-[0.98rem]"
                        disabled={!canRedeem}
                        onClick={() => setConfirmReward(reward)}
                        type="button"
                        variant={canRedeem ? "primary" : "outline"}
                      >
                        {reward.isSoldOut
                          ? "Sold Out"
                          : "Redeem"}
                      </Button>
                    </div>
                  </div>
                </div>

                {expanded ? (
                    <div className="mt-5 border-t border-[var(--ve-line-soft)] pt-5">
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-[var(--ve-muted)]">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em]">Offer Ends</p>
                        <p className="mt-1 text-[var(--foreground)]">
                          {formatRewardDate(reward.offerExpiresAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em]">Type</p>
                        <p className="mt-1 text-[var(--foreground)]">
                          {reward.distributionMode === "perk_bundle"
                            ? distributionLabels[reward.distributionMode]
                            : fulfillmentLabels[reward.fulfillmentType]}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em]">Limit</p>
                        <p className="mt-1 text-[var(--foreground)]">
                          {getRewardLimitLabel(reward.perUserLimit, reward.limitPeriod)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em]">Redeem By</p>
                        <p className="mt-1 text-[var(--foreground)]">
                          {reward.redemptionWindowDays
                            ? `${reward.redemptionWindowDays} days after purchase`
                            : "No redemption window"}
                        </p>
                      </div>
                    </div>
                    {reward.terms ? (
                      <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                        {reward.terms}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
          <PaginationControls
            className="pt-2"
            currentPage={paginatedRewards.currentPage}
            onPageChange={(nextPage) => {
              setExpandedRewardId(null);
              setStorePage(nextPage);
            }}
            totalPages={paginatedRewards.totalPages}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {snapshot.redemptions.length === 0 ? (
            <Card className="p-6 text-center" variant="store">
              <p className="text-sm font-black">No purchases yet</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Redeem XP for a reward, then return here to manage it.
              </p>
            </Card>
          ) : (
            paginatedRedemptions.items.map((redemption) => {
              const expanded = expandedRedemptionId === redemption.id;

              return (
                <Card className="overflow-hidden p-5" key={redemption.id} variant="store">
                  <div className="flex gap-4">
                    <div className="size-16 shrink-0 overflow-hidden rounded-[16px]">
                      <RewardThumb
                        thumbnail={redemption.rewardThumbnail}
                        title={redemption.rewardTitle}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-[1.06rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                            {redemption.rewardTitle}
                          </h2>
                          <p className="mt-2 text-[0.92rem] font-medium tracking-[-0.01em] text-[var(--ve-muted)]">
                            {formatXpLabel(redemption.xpCost)} redeemed
                          </p>
                        </div>
                        <span className="rounded-[14px] bg-[#fff8df] px-3 py-2 text-[11px] font-black text-[#a66d00]">
                          {claimStateLabels[redemption.claimState]}
                        </span>
                      </div>
                      <button
                        className="mt-5 text-[0.95rem] font-medium tracking-[-0.01em] text-[#a66d00]"
                        onClick={() => setExpandedRedemptionId(expanded ? null : redemption.id)}
                        type="button"
                      >
                        {expanded ? "Hide claim" : "Open claim"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="mt-5 space-y-5 border-t border-[var(--ve-line-soft)] pt-5">
                      {redemption.redemptionExpiresAt ? (
                        <div className="rounded-[18px] bg-[var(--ve-card-muted)] px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                            Redemption Expires
                          </p>
                          <p className="mt-1 text-xs font-black text-[var(--foreground)]">
                            {formatRewardDate(redemption.redemptionExpiresAt)}
                          </p>
                        </div>
                      ) : null}

                      {redemption.claimSteps.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#a66d00]">
                            Claim Steps
                          </p>
                          <ol className="mt-2 space-y-2">
                            {redemption.claimSteps.map((step, index) => (
                              <li
                                className="flex gap-3 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]"
                                key={`${redemption.id}-${step}`}
                              >
                                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#dff2e9] text-[10px] font-black text-[#008751]">
                                  {index + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}

                      {shouldShowRedemptionMessage(redemption) ? (
                        <p className="rounded-[18px] bg-[var(--ve-card-muted)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                          {redemption.userMessage}
                        </p>
                      ) : null}

                      <RewardFulfillment
                        onRefreshRedemption={refreshRedemption}
                        redemption={redemption}
                      />
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
          <PaginationControls
            className="pt-2"
            currentPage={paginatedRedemptions.currentPage}
            onPageChange={(nextPage) => {
              setExpandedRedemptionId(null);
              setHistoryPage(nextPage);
            }}
            totalPages={paginatedRedemptions.totalPages}
          />
        </div>
      )}

      {confirmReward ? (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/30 px-4 py-6">
          <Card className="w-full max-w-[430px] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a66d00]">
              Confirm Redemption
            </p>
            <h2 className="mt-2 text-xl font-black">{confirmReward.title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              {confirmReward.distributionMode === "perk_bundle"
                ? `This will spend ${formatXpLabel(confirmReward.costXp)} to reveal a surprise reward.`
                : `This will redeem ${formatXpLabel(confirmReward.costXp)} and add the reward to your history.`}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                disabled={redeeming}
                onClick={() => setConfirmReward(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={redeeming} onClick={() => void redeemReward()} type="button">
                {redeeming ? "Redeeming..." : "Confirm"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {activeRedemption ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/30 px-4 py-6">
          <Card className="w-full max-w-[430px] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a66d00]">
              {activeRedemption.fulfillmentType === "voucher_code"
                ? "Code Ready"
                : activeRedemption.fulfillmentType === "qr_code"
                  ? "Pass Ready"
                  : activeRedemption.fulfillmentType === "native"
                    ? activeNativeOutcome?.eyebrow ?? "Unlocked"
                    : "Reward Ready"}
            </p>
            <div className="mt-3 flex items-start gap-4">
              <div className="size-16 shrink-0 overflow-hidden rounded-[16px]">
                <RewardThumb
                  thumbnail={activeRedemption.rewardThumbnail}
                  title={activeRedemption.rewardTitle}
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black">
                  {activeRedemption.fulfillmentType === "native" && activeNativeOutcome
                    ? activeNativeOutcome.emphasis
                    : activeRedemption.rewardTitle}
                </h2>
                {activeRedemption.fulfillmentType === "native" ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">
                    {activeRedemption.rewardTitle}
                  </p>
                ) : null}
              </div>
            </div>

            {activeRedemption.fulfillmentType !== "native" && activeRedemption.claimSteps.length > 0 ? (
              <div className="mt-5">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#a66d00]">
                  Claim Steps
                </p>
                <ol className="mt-2 space-y-2">
                  {activeRedemption.claimSteps.map((step, index) => (
                    <li
                      className="flex gap-3 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]"
                      key={`${activeRedemption.id}-${step}`}
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#dff2e9] text-[10px] font-black text-[#008751]">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {activeRedemption.fulfillmentType !== "native" && shouldShowRedemptionMessage(activeRedemption) ? (
              <p className="mt-4 rounded-[18px] bg-[var(--ve-card-muted)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                {activeRedemption.userMessage}
              </p>
            ) : null}

            <div className="mt-4">
              <RewardFulfillment
                onRefreshRedemption={refreshRedemption}
                redemption={activeRedemption}
                suppressNativeEyebrow={activeRedemption.fulfillmentType === "native"}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {activeRedemption.fulfillmentType === "native" ? (
                <>
                  <Button
                    onClick={() => {
                      setActiveRedemption(null);
                      setTab("history");
                    }}
                    type="button"
                    variant="outline"
                  >
                    View History
                  </Button>
                  <Button
                    onClick={() => setActiveRedemption(null)}
                    type="button"
                  >
                    Done
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setActiveRedemption(null)}
                    type="button"
                    variant="outline"
                  >
                    {activeRedemption.fulfillmentType === "voucher_code"
                      || activeRedemption.fulfillmentType === "qr_code"
                      ? "Done"
                      : "Later"}
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveRedemption(null);
                      setTab("history");
                    }}
                    type="button"
                  >
                    View History
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
