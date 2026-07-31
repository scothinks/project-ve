"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExperienceHeader } from "@/components/ui/ExperienceHeader";
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
      iconClassName="h-[58%] w-[58%] text-[var(--ve-green)]"
      textClassName="text-[11px] font-black text-[var(--ve-green)]"
      thumbnail={thumbnail}
      title={title}
    />
  );
}

export function StoreLoadingState() {
  return (
    <section className="learner-page learner-page--standard">
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
      <div className="mx-auto mt-5 grid max-w-[28rem] grid-cols-2 gap-2 rounded-[18px] bg-[#fff4c4] p-1">
        <div className="h-10 rounded-[14px] bg-[var(--ve-card)]" />
        <div className="h-10 rounded-[14px] bg-[#ffedab]" />
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
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
          <Image
            alt="Reward pass"
            className="mx-auto size-44 rounded-[18px]"
            height={176}
            src={buildPseudoQrSvg(qrPayload)}
            unoptimized
            width={176}
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
