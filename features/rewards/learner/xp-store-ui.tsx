"use client";

import { FormEvent, useState } from "react";
import Image from "@/components/media/MediaImage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RewardThumbnailVisual } from "@/components/rewards/RewardThumbnailVisual";
import type { RewardRedemption, StoreReward } from "@/lib/rewards";
import { cn } from "@/lib/utils";
import {
  buildPseudoQrSvg,
  getNativeOutcomeDetails,
  parseText,
  sanitizeFieldValue,
} from "@/features/rewards/learner/xp-store-domain";

export function RewardThumb({
  thumbnail,
  title,
}: {
  thumbnail: StoreReward["thumbnail"] | RewardRedemption["rewardThumbnail"];
  title: string;
}) {
  return (
    <RewardThumbnailVisual
      defaultColor="#f4fbf7"
      iconClassName="h-[58%] w-[58%] text-[var(--ui-artwork-ink)]"
      textClassName="text-[11px] font-black text-[var(--ui-artwork-ink)]"
      thumbnail={thumbnail}
      title={title}
    />
  );
}

export function StoreLoadingState() {
  return (
    <section className="learner-page learner-page--standard">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-full bg-[var(--ui-surface-muted)]" />
          <div className="h-4 w-56 rounded-full bg-[var(--ui-surface-muted)]" />
        </div>
        <div className="h-8 w-20 rounded-full bg-[var(--ui-action-soft)]" />
      </div>
      <Card className="mt-5 space-y-4 p-5" variant="store">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-full bg-[var(--ui-reward-bg)]" />
            <div className="h-7 w-28 rounded-full bg-[var(--ui-surface-muted)]" />
          </div>
          <div className="h-8 w-16 rounded-[18px] bg-[var(--ui-reward-bg)]" />
        </div>
      </Card>
      <div className="mx-auto mt-5 grid max-w-[28rem] grid-cols-2 gap-2 rounded-[18px] bg-[var(--ui-reward-bg)] p-1">
        <div className="h-10 rounded-[14px] bg-[var(--ui-surface)]" />
        <div className="h-10 rounded-[14px] bg-[var(--ui-reward-bg)]" />
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <Card className="flex gap-4 p-4" key={item} variant="store">
            <div className="size-20 shrink-0 rounded-[18px] bg-[var(--ui-reward-bg)]" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-36 rounded-full bg-[var(--ui-surface-muted)]" />
              <div className="h-3 w-full rounded-full bg-[var(--ui-surface-muted)]" />
              <div className="h-3 w-2/3 rounded-full bg-[var(--ui-surface-muted)]" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function RewardFulfillment({
  redemption,
  onRefreshRedemption,
  suppressNativeEyebrow = false,
}: {
  redemption: RewardRedemption;
  onRefreshRedemption?: (redemptionId: string) => Promise<RewardRedemption | null>;
  suppressNativeEyebrow?: boolean;
}) {
  const payload = redemption.fulfillmentPayload;
  const [copiedCode, setCopiedCode] = useState(false);
  const redemptionExpired =
    redemption.claimState === "expired" ||
    Boolean(redemption.redemptionExpiresAt && new Date(redemption.redemptionExpiresAt) <= new Date());

  async function copyCode(value: string) {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  }

  if (redemptionExpired) {
    return (
      <div className="rounded-[18px] bg-[var(--ui-warning-bg)] px-4 py-3 text-xs font-bold leading-5 text-[var(--ui-warning)]">
        This reward redemption has expired.
      </div>
    );
  }

  if (redemption.fulfillmentType === "manual") {
    if (redemption.claimState === "fulfilled") {
      return (
        <div className="rounded-[18px] bg-[var(--ui-surface-inset)] px-4 py-3 text-xs font-bold leading-5 text-[var(--ui-text-muted)]">
          This reward has been fulfilled.
        </div>
      );
    }

    if (redemption.claimState === "details_submitted") {
      return (
        <div className="rounded-[18px] bg-[var(--ui-surface)] px-4 py-3 text-xs font-bold leading-5 text-[var(--ui-action)]">
          Submitted for processing.
        </div>
      );
    }

    return <ManualClaimForm onRefreshRedemption={onRefreshRedemption} redemption={redemption} />;
  }

  if (redemption.fulfillmentType === "voucher_code") {
    const code = parseText(payload.code) || "Code pending";

    return (
      <div className="rounded-[8px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4 shadow-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ui-reward)]">
              Voucher Code
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--ui-text-muted)]">
              Use this code with the partner to redeem your reward.
            </p>
          </div>
          <div className="rounded-full bg-[var(--ui-reward-bg)] px-3 py-2 text-[11px] font-black text-[var(--ui-reward)]">
            Ready
          </div>
        </div>
        <div className="mt-4 rounded-[8px] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ui-text-muted)]">
            Voucher Code
          </p>
          <p className="mt-2 break-all text-[1.15rem] font-black tracking-[0.16em] text-[var(--ui-text)]">
            {code}
          </p>
        </div>
        {code !== "Code pending" ? (
          <button
            className="mt-3 w-full rounded-[8px] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-xs font-black text-[var(--ui-action)]"
            onClick={() => void copyCode(code)}
            type="button"
          >
            {copiedCode ? "Copied" : "Copy Code"}
          </button>
        ) : null}
      </div>
    );
  }

  if (redemption.fulfillmentType === "qr_code") {
    const qrPayload = parseText(payload.qrPayload) || redemption.id;

    return (
    <div className="rounded-[8px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4 shadow-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ui-info)]">
              Scan Pass
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--ui-info)]">
              Present this pass when a partner needs to verify your reward.
            </p>
          </div>
          <div className="rounded-full bg-[var(--ui-info-bg)] px-3 py-2 text-[11px] font-black text-[var(--ui-info)]">
            Ready
          </div>
        </div>
        <div className="mt-4 rounded-[8px] bg-[var(--ui-surface)] p-4">
          <Image
            alt="Reward pass"
            className="mx-auto size-44 rounded-[18px]"
            height={176}
            src={buildPseudoQrSvg(qrPayload)}
            unoptimized
            width={176}
          />
          <div className="mt-4 rounded-[16px] bg-[var(--ui-surface-muted)] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
              Pass Reference
            </p>
            <p className="mt-1 break-all text-xs font-black text-[var(--ui-text)]">{qrPayload}</p>
          </div>
        </div>
      </div>
    );
  }

  if (redemption.fulfillmentType === "external_link") {
    const url = parseText(payload.url);
    return (
      <Button
        className="w-full text-[var(--ui-on-action)]"
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
    <div className="rounded-[8px] border border-[var(--ui-surface-soft)] bg-[var(--ui-surface-soft)] p-4 shadow-none">
      {!suppressNativeEyebrow ? (
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text)]">
          {nativeOutcome.eyebrow}
        </p>
      ) : null}
      <p className="mt-2 text-[1.55rem] font-black text-[var(--ui-text)]">
        {nativeOutcome.emphasis}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
        {nativeOutcome.description}
      </p>
    </div>
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
          "w-full rounded-[18px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--ui-focus)]";

        return (
          <label className="block" key={field.id}>
            <span className="text-[11px] font-bold text-[var(--ui-text-muted)]">{field.label}</span>
            {field.type === "select" ? (
              <select
                className={cn(commonClasses, "mt-1")}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.id]: event.target.value }))
                }
                required={field.required}
                value={values[field.id] ?? ""}
              >
                <option value="">Choose an option</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
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
      {message ? <p className="text-xs font-bold text-[var(--ui-success)]">{message}</p> : null}
    </form>
  );
}
