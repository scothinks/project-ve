"use client";

import { useMemo, useState } from "react";
import type { AdminPerkPrizeRow, AdminRewardCandidateRow } from "@/lib/admin";
import { AdminCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  assignPerkPrizeInventory,
  deletePerkPrize,
  deletePerkReleaseBucket,
  releasePerkPrizeInventory,
  saveBulkPerkRewardPrizes,
  savePerkPrize,
  savePerkReleaseBucket,
} from "@/app/admin/rewards/[id]/actions";

type PrizeType = "reward" | "native_xp" | "xp_boost";

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[#6c3cc2]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

function detailSummaryClasses() {
  return "cursor-pointer text-sm font-black text-[#6c3cc2]";
}

function typeButtonClasses(active: boolean) {
  return active
    ? "rounded-full bg-[#6c3cc2] px-3 py-2 text-xs font-black text-white"
    : "rounded-full bg-[#f3effa] px-3 py-2 text-xs font-black text-[#6c3cc2]";
}

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function describePrize(prize: AdminPerkPrizeRow) {
  if (prize.prize_type === "reward") {
    return prize.source_reward?.title ?? prize.source_reward_id ?? "Linked reward";
  }

  if (prize.prize_type === "native_xp") {
    return `${Number(prize.config.amount ?? 0)} XP bonus`;
  }

  return `${Number(prize.config.multiplier ?? 0)}x XP boost`;
}

function prizeTypeLabel(prizeType: PrizeType) {
  if (prizeType === "reward") return "Real reward";
  if (prizeType === "native_xp") return "Bonus XP";
  return "XP boost";
}

function getNativeXpDefaultTitle(amount: number) {
  return amount > 0 ? `+${amount} XP` : "Bonus XP";
}

function getXpBoostDefaultTitle(multiplier: number) {
  return multiplier > 0 ? `${multiplier}x XP Boost` : "XP Boost";
}

function PrizeTypeSelector({
  prizeType,
  onChange,
}: {
  prizeType: PrizeType;
  onChange: (value: PrizeType) => void;
}) {
  return (
    <div>
      <span className={labelClasses()}>Prize type</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["reward", "native_xp", "xp_boost"] as PrizeType[]).map((type) => (
          <button
            className={typeButtonClasses(prizeType === type)}
            key={type}
            onClick={() => onChange(type)}
            type="button"
          >
            {prizeTypeLabel(type)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadonlyPrizeIdentity({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-4 py-3">
      <p className={labelClasses()}>{label}</p>
      <p className="mt-2 text-sm font-black text-[var(--foreground)]">{value}</p>
      {helper ? (
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">{helper}</p>
      ) : null}
    </div>
  );
}

function PrizeSummaryBadges({ prize }: { prize: AdminPerkPrizeRow }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <AdminStatusBadge tone="store">{prize.prize_type.replaceAll("_", " ")}</AdminStatusBadge>
      <AdminStatusBadge tone={prize.is_enabled ? "good" : "neutral"}>
        {prize.is_enabled ? "enabled" : "disabled"}
      </AdminStatusBadge>
      <AdminStatusBadge tone="neutral">
        weight {prize.weight}
      </AdminStatusBadge>
      <AdminStatusBadge tone="neutral">
        {prize.performance?.drawsToday ?? 0} today
      </AdminStatusBadge>
      <AdminStatusBadge tone="neutral">
        {prize.performance?.drawsTotal ?? 0} total
      </AdminStatusBadge>
      {typeof prize.assigned_available === "number" ? (
        <AdminStatusBadge tone="neutral">
          {prize.assigned_available} assigned
        </AdminStatusBadge>
      ) : null}
    </div>
  );
}

function LinkedRewardField({
  rewardCandidates,
  value,
  onChange,
}: {
  rewardCandidates: AdminRewardCandidateRow[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="md:col-span-2">
      <span className={labelClasses()}>Linked reward</span>
      <select
        className={fieldClasses()}
        name="sourceRewardId"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Select reward</option>
        {rewardCandidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.title} ({candidate.direct_available ?? 0} free)
          </option>
        ))}
      </select>
    </label>
  );
}

function RewardCandidateChecklist({
  rewardCandidates,
  selectedRewardIds,
  onToggle,
}: {
  rewardCandidates: AdminRewardCandidateRow[];
  selectedRewardIds: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <span className={labelClasses()}>Rewards to add</span>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {rewardCandidates.map((candidate) => {
          const checked = selectedRewardIds.includes(candidate.id);

          return (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-3 ${
                checked ? "border-[#6c3cc2] bg-[#faf8ff]" : "border-[var(--ve-line-soft)] bg-[var(--ve-card)]"
              }`}
              key={candidate.id}
            >
              <input
                checked={checked}
                className="mt-1"
                name="sourceRewardIds"
                onChange={() => onToggle(candidate.id)}
                type="checkbox"
                value={candidate.id}
              />
              <div className="min-w-0">
                <p className="text-sm font-black">{candidate.title}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted-strong)]">
                  {candidate.direct_available ?? 0} free for direct store · {candidate.assigned_available ?? 0} already assigned · {candidate.total_available ?? 0} total live
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function RewardPrizeFields({
  rewardCandidates,
  defaultValue,
  defaultTitle = "",
  defaultIcon = "",
  defaultColor = "",
}: {
  rewardCandidates: AdminRewardCandidateRow[];
  defaultValue?: string;
  defaultTitle?: string;
  defaultIcon?: string;
  defaultColor?: string;
}) {
  const [selectedRewardId, setSelectedRewardId] = useState(defaultValue ?? "");
  const selectedReward = rewardCandidates.find((candidate) => candidate.id === selectedRewardId);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <LinkedRewardField
          onChange={setSelectedRewardId}
          rewardCandidates={rewardCandidates}
          value={selectedRewardId}
        />
      </div>
      {selectedReward ? (
        <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
            Reward stock guide
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Total live</p>
              <p className="mt-1 text-lg font-black">{selectedReward.total_available ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Free for direct store</p>
              <p className="mt-1 text-lg font-black">{selectedReward.direct_available ?? 0}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Already assigned to perks</p>
              <p className="mt-1 text-lg font-black">{selectedReward.assigned_available ?? 0}</p>
            </div>
          </div>
        </div>
      ) : null}
      <details className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3">
        <summary className={detailSummaryClasses()}>Optional learner card override</summary>
        <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Leave this untouched unless the perk should present the reward with a different label or tile.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <label className="md:col-span-2">
            <span className={labelClasses()}>Override title</span>
            <input className={fieldClasses()} defaultValue={defaultTitle} name="title" />
          </label>
          <label>
            <span className={labelClasses()}>Override icon</span>
            <input className={fieldClasses()} defaultValue={defaultIcon} name="thumbnailIcon" />
          </label>
          <label>
            <span className={labelClasses()}>Override color</span>
            <input className={fieldClasses()} defaultValue={defaultColor} name="thumbnailColor" />
          </label>
        </div>
      </details>
    </>
  );
}

function PrizeAllocationPanel({
  bundleRewardId,
  prize,
}: {
  bundleRewardId: string;
  prize: AdminPerkPrizeRow;
}) {
  if (prize.prize_type !== "reward") {
    return null;
  }

  return (
    <details className="mt-4 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3">
      <summary className={detailSummaryClasses()}>Assigned stock</summary>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
        This prize only draws from the stock assigned here. Direct store redemptions use the remaining unassigned stock.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div className="rounded-[12px] bg-[var(--ve-shell)] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Assigned to this prize</p>
          <p className="mt-1 text-lg font-black">{prize.assigned_available ?? 0}</p>
        </div>
        <div className="rounded-[12px] bg-[var(--ve-shell)] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Free on reward</p>
          <p className="mt-1 text-lg font-black">{prize.source_reward_direct_available ?? 0}</p>
        </div>
        <div className="rounded-[12px] bg-[var(--ve-shell)] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Total live on reward</p>
          <p className="mt-1 text-lg font-black">{prize.source_reward_total_available ?? 0}</p>
        </div>
        <div className="rounded-[12px] bg-[var(--ve-shell)] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Assigned across perks</p>
          <p className="mt-1 text-lg font-black">{prize.source_reward_assigned_available ?? 0}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <form action={assignPerkPrizeInventory} className="space-y-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
          <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
          <input name="prizeId" type="hidden" value={prize.id} />
          <p className="text-sm font-black">Assign stock to this prize</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Quantity</span>
              <input className={fieldClasses()} min={1} name="quantity" type="number" />
            </label>
            <label>
              <span className={labelClasses()}>Available from</span>
              <input className={fieldClasses()} name="availableFrom" type="datetime-local" />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Expires</span>
              <input className={fieldClasses()} name="expiresAt" type="datetime-local" />
            </label>
            <label>
              <span className={labelClasses()}>Reason</span>
              <input className={fieldClasses()} name="reason" placeholder="Reserve stock for this perk prize" />
            </label>
          </div>
          <button className="rounded-[12px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white" type="submit">
            Assign stock
          </button>
        </form>

        <form action={releasePerkPrizeInventory} className="space-y-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
          <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
          <input name="prizeId" type="hidden" value={prize.id} />
          <p className="text-sm font-black">Release stock back to direct pool</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Quantity</span>
              <input className={fieldClasses()} min={1} name="quantity" type="number" />
            </label>
            <label>
              <span className={labelClasses()}>Reason</span>
              <input className={fieldClasses()} name="reason" placeholder="Return unused stock to the reward" />
            </label>
          </div>
          <button className="rounded-[12px] bg-[#fff8df] px-4 py-3 text-sm font-black text-[#a66d00]" type="submit">
            Release stock
          </button>
        </form>
      </div>
    </details>
  );
}

function NativeXpPrizeFields({
  defaultTitle,
  defaultIcon,
  defaultColor,
  defaultAmount,
}: {
  defaultTitle: string;
  defaultIcon: string;
  defaultColor: string;
  defaultAmount: number;
}) {
  return (
    <>
      <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
        <p className="text-sm font-black">What learner gets</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Set the XP amount first, then give the outcome a short learner-facing label.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="md:col-span-2">
            <span className={labelClasses()}>Learner title</span>
            <input className={fieldClasses()} defaultValue={defaultTitle} name="title" />
          </label>
          <label>
            <span className={labelClasses()}>XP amount</span>
            <input className={fieldClasses()} defaultValue={defaultAmount} min={1} name="amount" type="number" />
          </label>
        </div>
      </div>
      <details className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3">
        <summary className={detailSummaryClasses()}>Tile styling</summary>
        <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Only change this if the learner card should use a different icon or color.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Icon</span>
            <input className={fieldClasses()} defaultValue={defaultIcon} name="thumbnailIcon" />
          </label>
          <label>
            <span className={labelClasses()}>Tile color</span>
            <input className={fieldClasses()} defaultValue={defaultColor} name="thumbnailColor" />
          </label>
        </div>
      </details>
    </>
  );
}

function XpBoostPrizeFields({
  defaultTitle,
  defaultIcon,
  defaultColor,
  defaultMultiplier,
  defaultDurationHours,
  defaultUses,
}: {
  defaultTitle: string;
  defaultIcon: string;
  defaultColor: string;
  defaultMultiplier: number;
  defaultDurationHours: number;
  defaultUses: number;
}) {
  return (
    <>
      <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
        <p className="text-sm font-black">What learner gets</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Set the boost label, multiplier, duration, and number of uses the learner unlocks.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="md:col-span-4">
            <span className={labelClasses()}>Learner title</span>
            <input className={fieldClasses()} defaultValue={defaultTitle} name="title" />
          </label>
          <label>
            <span className={labelClasses()}>Multiplier</span>
            <input className={fieldClasses()} defaultValue={defaultMultiplier} min={1.1} name="multiplier" step="0.1" type="number" />
          </label>
          <label>
            <span className={labelClasses()}>Boost hours</span>
            <input className={fieldClasses()} defaultValue={defaultDurationHours} min={1} name="durationHours" type="number" />
          </label>
          <label>
            <span className={labelClasses()}>Boost uses</span>
            <input className={fieldClasses()} defaultValue={defaultUses} min={1} name="uses" type="number" />
          </label>
        </div>
      </div>
      <details className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3">
        <summary className={detailSummaryClasses()}>Tile styling</summary>
        <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Only change this if the learner card should use a different icon or color.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Icon</span>
            <input className={fieldClasses()} defaultValue={defaultIcon} name="thumbnailIcon" />
          </label>
          <label>
            <span className={labelClasses()}>Tile color</span>
            <input className={fieldClasses()} defaultValue={defaultColor} name="thumbnailColor" />
          </label>
        </div>
      </details>
    </>
  );
}

function DistributionControls({
  defaultWeight,
  defaultTotalCap,
  defaultDailyCap,
  defaultSortOrder,
  defaultAvailableFrom,
  defaultExpiresAt,
  defaultEnabled,
  defaultOpen = false,
  helperText,
  derivedAssignedPool,
  deriveTimingFromAssignedStock = false,
}: {
  defaultWeight: number;
  defaultTotalCap?: number | null;
  defaultDailyCap?: number | null;
  defaultSortOrder: number;
  defaultAvailableFrom?: string | null;
  defaultExpiresAt?: string | null;
  defaultEnabled: boolean;
  defaultOpen?: boolean;
  helperText?: string;
  derivedAssignedPool?: number | null;
  deriveTimingFromAssignedStock?: boolean;
}) {
  return (
    <details className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3" open={defaultOpen}>
      <summary className={detailSummaryClasses()}>Distribution controls</summary>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
        {helperText ?? "Control draw weight, release caps, timing, and whether this prize is currently active."}
      </p>
      <div className="mt-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-3 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
        <p className="font-black text-[var(--foreground)]">How chance weight works</p>
        <p className="mt-1">
          Weight is relative chance, not a percentage. A prize with weight 2 is about twice as likely to be drawn as a prize with weight 1, before caps, windows, and stock limits reduce availability.
        </p>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-4">
        <label>
          <span className={labelClasses()}>Chance weight</span>
          <input className={fieldClasses()} defaultValue={defaultWeight} min={1} name="weight" type="number" />
        </label>
        {typeof derivedAssignedPool === "number" ? (
          <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-3">
            <p className={labelClasses()}>Assigned pool</p>
            <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{derivedAssignedPool}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Total wins come from the stock assigned to this prize.
            </p>
          </div>
        ) : (
          <label>
            <span className={labelClasses()}>Total cap</span>
            <input className={fieldClasses()} defaultValue={defaultTotalCap ?? ""} min={1} name="totalWinCap" type="number" />
          </label>
        )}
        <label>
          <span className={labelClasses()}>Daily cap</span>
          <input className={fieldClasses()} defaultValue={defaultDailyCap ?? ""} min={1} name="dailyWinCap" type="number" />
        </label>
        <label>
          <span className={labelClasses()}>Sort order</span>
          <input className={fieldClasses()} defaultValue={defaultSortOrder} name="sortOrder" type="number" />
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {deriveTimingFromAssignedStock ? (
          <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-3 md:col-span-2">
            <p className={labelClasses()}>Availability window</p>
            <p className="mt-2 text-sm font-black text-[var(--foreground)]">Follows assigned stock</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Set available from and expiry when assigning stock. Release buckets can still stage that assigned pool further.
            </p>
          </div>
        ) : (
          <>
            <label>
              <span className={labelClasses()}>Available from</span>
              <input className={fieldClasses()} defaultValue={toDateInputValue(defaultAvailableFrom ?? null)} name="availableFrom" type="datetime-local" />
            </label>
            <label>
              <span className={labelClasses()}>Expires</span>
              <input className={fieldClasses()} defaultValue={toDateInputValue(defaultExpiresAt ?? null)} name="expiresAt" type="datetime-local" />
            </label>
          </>
        )}
        <label className="flex items-center gap-3 rounded-[12px] bg-[var(--ve-shell)] px-3 py-3 text-sm font-black">
          <input defaultChecked={defaultEnabled} name="isEnabled" type="checkbox" />
          Enabled
        </label>
      </div>
    </details>
  );
}

function PendingAllocationNotice({ mode }: { mode: "create" | "edit" }) {
  return (
    <div className="rounded-[12px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-shell)] px-4 py-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
      {mode === "create"
        ? "Save this reward prize first. Then assign stock to it. Chance weight, release caps, and staged buckets only unlock after this prize has an assigned pool."
        : "Assign stock to this prize first. Chance weight, release caps, and staged buckets unlock after this prize has an assigned pool."}
    </div>
  );
}

function ReleaseBucketsSection({
  bundleRewardId,
  prize,
}: {
  bundleRewardId: string;
  prize: AdminPerkPrizeRow;
}) {
  return (
    <details className="mt-4 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3">
      <summary className={detailSummaryClasses()}>Release buckets</summary>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
        Use buckets only when you need staged release windows beyond the basic daily and total caps.
      </p>

      <div className="mt-4 space-y-3">
        {(prize.releaseBuckets ?? []).length === 0 ? (
          <p className="text-xs font-semibold text-[var(--ve-muted)]">
            No release buckets yet. This prize currently relies on the prize-level caps and schedule above.
          </p>
        ) : (
          (prize.releaseBuckets ?? []).map((bucket) => (
            <form
              action={savePerkReleaseBucket}
              className="space-y-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3"
              key={bucket.id}
            >
              <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
              <input name="prizeId" type="hidden" value={prize.id} />
              <input name="bucketId" type="hidden" value={bucket.id} />

              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge tone={bucket.is_enabled ? "good" : "neutral"}>
                  {bucket.is_enabled ? "enabled" : "disabled"}
                </AdminStatusBadge>
                <AdminStatusBadge tone="neutral">
                  {bucket.drawsInBucket ?? 0}/{bucket.release_cap} used
                </AdminStatusBadge>
                <AdminStatusBadge tone="neutral">
                  {bucket.remainingInBucket ?? bucket.release_cap} left
                </AdminStatusBadge>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label>
                  <span className={labelClasses()}>Label</span>
                  <input className={fieldClasses()} defaultValue={bucket.label ?? ""} name="label" />
                </label>
                <label>
                  <span className={labelClasses()}>Starts</span>
                  <input className={fieldClasses()} defaultValue={toDateInputValue(bucket.starts_at)} name="startsAt" type="datetime-local" />
                </label>
                <label>
                  <span className={labelClasses()}>Ends</span>
                  <input className={fieldClasses()} defaultValue={toDateInputValue(bucket.ends_at)} name="endsAt" type="datetime-local" />
                </label>
                <label>
                  <span className={labelClasses()}>Release cap</span>
                  <input className={fieldClasses()} defaultValue={bucket.release_cap} min={1} name="releaseCap" type="number" />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label>
                  <span className={labelClasses()}>Sort order</span>
                  <input className={fieldClasses()} defaultValue={bucket.sort_order} name="sortOrder" type="number" />
                </label>
                <label className="flex items-center gap-3 rounded-[12px] bg-[var(--ve-card)] px-3 py-3 text-sm font-black md:col-span-2">
                  <input defaultChecked={bucket.is_enabled} name="isEnabled" type="checkbox" />
                  Enabled
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-[12px] bg-[#6c3cc2] px-3 py-2 text-xs font-black text-white" type="submit">
                  Save bucket
                </button>
                <button
                  className="rounded-[12px] bg-[#fff0f0] px-3 py-2 text-xs font-black text-[#c00000]"
                  formAction={deletePerkReleaseBucket}
                  type="submit"
                >
                  Remove
                </button>
              </div>
            </form>
          ))
        )}
      </div>

      <form action={savePerkReleaseBucket} className="mt-4 space-y-3 rounded-[12px] border border-dashed border-[var(--ve-line)] p-3">
        <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
        <input name="prizeId" type="hidden" value={prize.id} />
        <p className="text-sm font-black">Add release bucket</p>
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className={labelClasses()}>Label</span>
            <input className={fieldClasses()} name="label" placeholder="Week 1" />
          </label>
          <label>
            <span className={labelClasses()}>Starts</span>
            <input className={fieldClasses()} name="startsAt" type="datetime-local" />
          </label>
          <label>
            <span className={labelClasses()}>Ends</span>
            <input className={fieldClasses()} name="endsAt" type="datetime-local" />
          </label>
          <label>
            <span className={labelClasses()}>Release cap</span>
            <input className={fieldClasses()} defaultValue={10} min={1} name="releaseCap" type="number" />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className={labelClasses()}>Sort order</span>
            <input className={fieldClasses()} defaultValue={0} name="sortOrder" type="number" />
          </label>
          <label className="flex items-center gap-3 rounded-[12px] bg-[var(--ve-shell)] px-3 py-3 text-sm font-black md:col-span-2">
            <input defaultChecked name="isEnabled" type="checkbox" />
            Enabled
          </label>
        </div>
        <button className="rounded-[12px] bg-[#6c3cc2] px-4 py-3 text-sm font-black text-white" type="submit">
          Add bucket
        </button>
      </form>
    </details>
  );
}

function PrizeEditorCard({
  bundleRewardId,
  focusedPrizeId,
  noticeCode,
  prize,
  rewardCandidates,
}: {
  bundleRewardId: string;
  focusedPrizeId?: string;
  noticeCode?: string;
  prize: AdminPerkPrizeRow;
  rewardCandidates: AdminRewardCandidateRow[];
}) {
  const prizeType: PrizeType = prize.prize_type;
  const icon = typeof prize.thumbnail?.icon === "string" ? prize.thumbnail.icon : "";
  const color = typeof prize.thumbnail?.color === "string" ? prize.thumbnail.color : "";
  const hasAssignedPool = (prize.assigned_available ?? 0) > 0;
  const canSaveDetails = prizeType !== "reward" || hasAssignedPool;
  const canRemovePrize = true;
  const linkedRewardLabel =
    prize.source_reward?.title ?? prize.source_reward_id ?? prize.title ?? "Linked reward";
  const saveFormId = `save-perk-prize-${prize.id}`;
  const redirectTo = `/admin/rewards/perks/${bundleRewardId}`;
  const isFocusedPrize = focusedPrizeId === prize.id;
  const inlineNotice =
    isFocusedPrize && noticeCode === "prize-saved"
      ? "Prize changes saved."
      : isFocusedPrize && noticeCode === "prize-enabled"
        ? "Prize enabled."
        : isFocusedPrize && noticeCode === "prize-disabled"
          ? "Prize disabled."
          : "";

  return (
    <details className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4" open={isFocusedPrize}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <p className="text-base font-black">{describePrize(prize)}</p>
          <PrizeSummaryBadges prize={prize} />
        </div>
        <span className="rounded-full bg-[var(--ve-card)] px-3 py-2 text-xs font-black text-[#6c3cc2]">
          Edit
        </span>
      </summary>

      {inlineNotice ? (
        <div className="mt-4 rounded-[12px] border border-[#cde8db] bg-[#eefaf4] px-4 py-3 text-sm font-black text-[#087f5b]">
          {inlineNotice}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {prizeType === "reward" ? (
          <ReadonlyPrizeIdentity
            helper="Prize type is fixed after this outcome is added to the pool."
            label="Prize type"
            value={prizeTypeLabel(prizeType)}
          />
        ) : (
          <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-4 py-3 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge tone="store">{prizeTypeLabel(prizeType)}</AdminStatusBadge>
              <span className="text-xs font-semibold text-[var(--ve-muted)]">
                Outcome type is fixed after this prize is added to the pool.
              </span>
            </div>
          </div>
        )}
        {prizeType === "reward" ? (
          <ReadonlyPrizeIdentity
            helper="Linked reward is fixed here. Remove this prize and add a different reward if you need a different pool item."
            label="Linked reward"
            value={linkedRewardLabel}
          />
        ) : null}
      </div>

      {prizeType === "native_xp" || prizeType === "xp_boost" ? (
        <form action={savePerkPrize} className="mt-4 space-y-4" id={saveFormId}>
          <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
          <input name="prizeId" type="hidden" value={prize.id} />
          <input name="prizeType" type="hidden" value={prizeType} />
          <input name="redirectTo" type="hidden" value={redirectTo} />

          {prizeType === "native_xp" ? (
            <NativeXpPrizeFields
              defaultAmount={Number(prize.config.amount ?? 5)}
              defaultColor={color || "#f4fbf7"}
              defaultIcon={icon || "XP"}
              defaultTitle={prize.title ?? getNativeXpDefaultTitle(Number(prize.config.amount ?? 5))}
            />
          ) : null}

          {prizeType === "xp_boost" ? (
            <XpBoostPrizeFields
              defaultColor={color || "#fff6ed"}
              defaultDurationHours={Number(prize.config.durationHours ?? 24)}
              defaultIcon={icon || "BOOST"}
              defaultMultiplier={Number(prize.config.multiplier ?? 2)}
              defaultTitle={prize.title ?? getXpBoostDefaultTitle(Number(prize.config.multiplier ?? 2))}
              defaultUses={Number(prize.config.uses ?? 1)}
            />
          ) : null}

          <DistributionControls
            defaultAvailableFrom={prize.available_from}
            defaultDailyCap={prize.daily_win_cap}
            defaultEnabled={prize.is_enabled}
            defaultExpiresAt={prize.expires_at}
            defaultSortOrder={prize.sort_order}
            defaultTotalCap={prize.total_win_cap}
            defaultWeight={prize.weight}
            helperText="Control draw weight, release caps, timing, and whether this prize is currently active."
          />
        </form>
      ) : null}

      {prizeType === "reward" ? (
        <PrizeAllocationPanel bundleRewardId={bundleRewardId} prize={prize} />
      ) : null}

      {prizeType === "reward" && canSaveDetails ? (
        <form action={savePerkPrize} className="mt-4 space-y-4" id={saveFormId}>
          <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
          <input name="prizeId" type="hidden" value={prize.id} />
          <input name="prizeType" type="hidden" value={prizeType} />
          <input name="sourceRewardId" type="hidden" value={prize.source_reward_id ?? ""} />
          <input name="redirectTo" type="hidden" value={redirectTo} />

          <details className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3">
            <summary className={detailSummaryClasses()}>Optional learner card override</summary>
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Leave this untouched unless the perk should present the linked reward with a different label or tile.
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-4">
              <label className="md:col-span-2">
                <span className={labelClasses()}>Override title</span>
                <input className={fieldClasses()} defaultValue={prize.title ?? ""} name="title" />
              </label>
              <label>
                <span className={labelClasses()}>Override icon</span>
                <input className={fieldClasses()} defaultValue={icon} name="thumbnailIcon" />
              </label>
              <label>
                <span className={labelClasses()}>Override color</span>
                <input className={fieldClasses()} defaultValue={color} name="thumbnailColor" />
              </label>
            </div>
          </details>

          <DistributionControls
            defaultDailyCap={prize.daily_win_cap}
            defaultEnabled={prize.is_enabled}
            defaultSortOrder={prize.sort_order}
            defaultWeight={prize.weight}
            deriveTimingFromAssignedStock
            derivedAssignedPool={prize.assigned_available ?? 0}
            helperText={`This prize currently has ${prize.assigned_available ?? 0} unit${(prize.assigned_available ?? 0) === 1 ? "" : "s"} assigned. Use daily cap and weight only if you want to slow down release below that assigned pool.`}
          />
        </form>
      ) : null}
      {prizeType === "reward" && !canSaveDetails ? (
        <div className="mt-4">
          <PendingAllocationNotice mode="edit" />
        </div>
      ) : null}

      {(prizeType !== "reward" || hasAssignedPool) ? (
        <div className="mt-4">
          <ReleaseBucketsSection bundleRewardId={bundleRewardId} prize={prize} />
        </div>
      ) : null}

      {canSaveDetails || canRemovePrize ? (
        <div className="mt-6 border-t border-[var(--ve-line-soft)] pt-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Final actions</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canSaveDetails ? (
              <button
                className="rounded-[12px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white"
                form={saveFormId}
                type="submit"
              >
                Save prize
              </button>
            ) : null}
            {canRemovePrize ? (
              <form action={deletePerkPrize}>
                <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
                <input name="prizeId" type="hidden" value={prize.id} />
                <button
                  className="rounded-[12px] bg-[#fff0f0] px-4 py-3 text-sm font-black text-[#c00000]"
                  type="submit"
                >
                  Remove prize
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </details>
  );
}

function AddPrizeCard({
  bundleRewardId,
  rewardCandidates,
}: {
  bundleRewardId: string;
  rewardCandidates: AdminRewardCandidateRow[];
}) {
  const [open, setOpen] = useState(false);
  const [prizeType, setPrizeType] = useState<PrizeType>("reward");
  const [selectedRewardIds, setSelectedRewardIds] = useState<string[]>([]);
  const redirectTo = `/admin/rewards/perks/${bundleRewardId}`;

  function toggleSelectedReward(rewardId: string) {
    setSelectedRewardIds((current) =>
      current.includes(rewardId)
        ? current.filter((value) => value !== rewardId)
        : [...current, rewardId],
    );
  }

  const helperCopy = useMemo(() => {
    if (prizeType === "reward") {
      return "Add one or more real rewards into this perk. Save them first, then assign stock to each prize and tune release behavior only where needed.";
    }
    if (prizeType === "native_xp") {
      return "Add a lightweight XP outcome for consolation or quick wins.";
    }
    return "Add a temporary XP boost outcome without touching real reward inventory.";
  }, [prizeType]);

  return (
    <section className="mt-6 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
      <button
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <div>
          <h3 className="text-lg font-black">Add prize</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">{helperCopy}</p>
        </div>
        <span
          aria-hidden="true"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3effa] text-[#6c3cc2] transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
            <path
              d="m6 3 5 5-5 5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-[var(--ve-line-soft)] pt-4">
        <form action={savePerkPrize} className="space-y-4">
          <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
          <input name="prizeType" type="hidden" value={prizeType} />
          <input name="redirectTo" type="hidden" value={redirectTo} />

          <PrizeTypeSelector onChange={setPrizeType} prizeType={prizeType} />

          {prizeType === "reward" ? (
            <RewardCandidateChecklist
              onToggle={toggleSelectedReward}
              rewardCandidates={rewardCandidates}
              selectedRewardIds={selectedRewardIds}
            />
          ) : null}

          {prizeType === "native_xp" ? (
            <NativeXpPrizeFields
              defaultAmount={5}
              defaultColor="#f4fbf7"
              defaultIcon="XP"
              defaultTitle="Bonus XP"
            />
          ) : null}

          {prizeType === "xp_boost" ? (
            <XpBoostPrizeFields
              defaultColor="#fff6ed"
              defaultDurationHours={24}
              defaultIcon="BOOST"
              defaultMultiplier={2}
              defaultTitle="XP Boost"
              defaultUses={1}
            />
          ) : null}

          {prizeType === "reward" ? (
            <PendingAllocationNotice mode="create" />
          ) : (
            <DistributionControls
              defaultAvailableFrom={null}
              defaultDailyCap={null}
              defaultEnabled={true}
              defaultExpiresAt={null}
              defaultSortOrder={0}
              defaultTotalCap={null}
              defaultWeight={1}
              defaultOpen={true}
            />
          )}

          {prizeType !== "reward" ? (
            <button className="rounded-[12px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white" type="submit">
              Add prize
            </button>
          ) : null}
        </form>

        {prizeType === "reward" ? (
          <form action={saveBulkPerkRewardPrizes} className="space-y-4 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
            <input name="bundleRewardId" type="hidden" value={bundleRewardId} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            {selectedRewardIds.map((rewardId) => (
              <input key={rewardId} name="sourceRewardIds" type="hidden" value={rewardId} />
            ))}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-black">Add selected rewards</h4>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
                  This only creates the prize records. After that, assign stock to each one. Chance weight, caps, and release buckets stay hidden until a prize has an assigned pool.
                </p>
              </div>
              <AdminStatusBadge tone="neutral">
                {selectedRewardIds.length} selected
              </AdminStatusBadge>
            </div>
            <button
              className="rounded-[12px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              disabled={selectedRewardIds.length === 0}
              type="submit"
            >
              Add selected rewards
            </button>
          </form>
        ) : null}
      </div>
      ) : null}
    </section>
  );
}

export function PerkPrizeManager({
  bundleRewardId,
  focusedPrizeId,
  notice,
  noticeCode,
  prizes,
  rewardCandidates,
}: {
  bundleRewardId: string;
  focusedPrizeId?: string;
  notice?: string;
  noticeCode?: string;
  prizes: AdminPerkPrizeRow[];
  rewardCandidates: AdminRewardCandidateRow[];
}) {
  return (
    <AdminCard className="mt-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
          Perk Prize Pool
        </p>
        <h2 className="mt-2 text-xl font-black">What this perk can award</h2>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
          Configure each outcome by type. Keep the prize itself simple, then open distribution or release controls only when you need them.
        </p>
      </div>

      {notice ? (
        <div className="mt-4 rounded-[16px] border border-[#cde8db] bg-[#eefaf4] px-4 py-3 text-sm font-black text-[#087f5b]">
          {notice}
        </div>
      ) : null}

      <AddPrizeCard bundleRewardId={bundleRewardId} rewardCandidates={rewardCandidates} />

      <div className="mt-5 space-y-4">
        {prizes.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-shell)] px-4 py-5 text-sm font-semibold text-[var(--ve-muted)]">
            No prize pool configured yet. Start by adding one outcome.
          </div>
        ) : (
          prizes.map((prize) => (
            <PrizeEditorCard
              bundleRewardId={bundleRewardId}
              focusedPrizeId={focusedPrizeId}
              key={prize.id}
              noticeCode={noticeCode}
              prize={prize}
              rewardCandidates={rewardCandidates}
            />
          ))
        )}
      </div>
    </AdminCard>
  );
}
