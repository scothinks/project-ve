"use client";

import type { AdminPerkPrizeRow, AdminRewardCandidateRow } from "@/lib/admin";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { RewardThumbnailFields } from "@/components/admin/RewardThumbnailFields";
import {
  prizeTypeLabel,
  toDateInputValue,
  type PrizeType,
} from "@/features/rewards/admin/perk-prize-manager-domain";

export type PerkPrizeFormAction = (formData: FormData) => void | Promise<void>;

export type PerkPrizeManagerActions = {
  assignPerkPrizeInventory: PerkPrizeFormAction;
  deletePerkReleaseBucket: PerkPrizeFormAction;
  releasePerkPrizeInventory: PerkPrizeFormAction;
  savePerkReleaseBucket: PerkPrizeFormAction;
};

export function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-violet)]";
}

export function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

export function detailSummaryClasses() {
  return "cursor-pointer text-sm font-black text-[var(--ve-violet)]";
}

function typeButtonClasses(active: boolean) {
  return active
    ? "rounded-full bg-[var(--ve-violet)] px-3 py-2 text-xs font-black text-white"
    : "rounded-full bg-[color:color-mix(in_srgb,var(--ve-violet-soft)_82%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-violet)]";
}

export function PrizeTypeSelector({
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

export function ReadonlyPrizeIdentity({
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

export function PrizeSummaryBadges({ prize }: { prize: AdminPerkPrizeRow }) {
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

export function RewardCandidateChecklist({
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
                checked
                  ? "border-[var(--ve-violet)] bg-[color:color-mix(in_srgb,var(--ve-violet-soft)_62%,var(--ve-card))]"
                  : "border-[var(--ve-line-soft)] bg-[var(--ve-card)]"
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

export function PrizeAllocationPanel({
  actions,
  bundleRewardId,
  prize,
}: {
  actions: Pick<PerkPrizeManagerActions, "assignPerkPrizeInventory" | "releasePerkPrizeInventory">;
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
        <form action={actions.assignPerkPrizeInventory} className="space-y-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
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
          <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white" type="submit">
            Assign stock
          </button>
        </form>

        <form action={actions.releasePerkPrizeInventory} className="space-y-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
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
          <button className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] px-4 py-3 text-sm font-black text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]" type="submit">
            Release stock
          </button>
        </form>
      </div>
    </details>
  );
}

export function NativeXpPrizeFields({
  defaultTitle,
  defaultIconName,
  defaultLegacyIcon,
  defaultColor,
  defaultAmount,
}: {
  defaultTitle: string;
  defaultIconName: string;
  defaultLegacyIcon: string;
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
        <div className="mt-3">
          <RewardThumbnailFields
            color={defaultColor}
            iconName={defaultIconName}
            legacyIcon={defaultLegacyIcon}
            showUrl={false}
            title={defaultTitle}
          />
        </div>
      </details>
    </>
  );
}

export function XpBoostPrizeFields({
  defaultTitle,
  defaultIconName,
  defaultLegacyIcon,
  defaultColor,
  defaultMultiplier,
  defaultDurationHours,
  defaultUses,
}: {
  defaultTitle: string;
  defaultIconName: string;
  defaultLegacyIcon: string;
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
        <div className="mt-3">
          <RewardThumbnailFields
            color={defaultColor}
            iconName={defaultIconName}
            legacyIcon={defaultLegacyIcon}
            showUrl={false}
            title={defaultTitle}
          />
        </div>
      </details>
    </>
  );
}

export function DistributionControls({
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

export function PendingAllocationNotice({ mode }: { mode: "create" | "edit" }) {
  return (
    <div className="rounded-[12px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-shell)] px-4 py-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
      {mode === "create"
        ? "Save this reward prize first. Then assign stock to it. Chance weight, release caps, and staged buckets only unlock after this prize has an assigned pool."
        : "Assign stock to this prize first. Chance weight, release caps, and staged buckets unlock after this prize has an assigned pool."}
    </div>
  );
}

export function ReleaseBucketsSection({
  actions,
  bundleRewardId,
  prize,
}: {
  actions: Pick<PerkPrizeManagerActions, "deletePerkReleaseBucket" | "savePerkReleaseBucket">;
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
              action={actions.savePerkReleaseBucket}
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
                <button className="rounded-[12px] bg-[var(--ve-violet)] px-3 py-2 text-xs font-black text-white" type="submit">
                  Save bucket
                </button>
                <button
                  className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)]"
                  formAction={actions.deletePerkReleaseBucket}
                  type="submit"
                >
                  Remove
                </button>
              </div>
            </form>
          ))
        )}
      </div>

      <form action={actions.savePerkReleaseBucket} className="mt-4 space-y-3 rounded-[12px] border border-dashed border-[var(--ve-line)] p-3">
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
        <button className="rounded-[12px] bg-[var(--ve-violet)] px-4 py-3 text-sm font-black text-white" type="submit">
          Add bucket
        </button>
      </form>
    </details>
  );
}
