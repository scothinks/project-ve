"use client";

import { useMemo, useState } from "react";
import type { AdminPerkPrizeRow, AdminRewardCandidateRow } from "@/lib/admin";
import { AdminCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { RewardThumbnailFields } from "@/components/admin/RewardThumbnailFields";
import {
  assignPerkPrizeInventory,
  deletePerkPrize,
  deletePerkReleaseBucket,
  releasePerkPrizeInventory,
  saveBulkPerkRewardPrizes,
  savePerkPrize,
  savePerkReleaseBucket,
} from "@/app/admin/rewards/[id]/actions";
import {
  canSavePrizeDetails,
  describePrize,
  getAddPrizeHelperCopy,
  getFocusedPrizeNotice,
  getNativeXpDefaultTitle,
  getPerkPrizeThumbnailDefaults,
  getXpBoostDefaultTitle,
  prizeTypeLabel,
  type PrizeType,
} from "@/features/rewards/admin/perk-prize-manager-domain";
import {
  DistributionControls,
  NativeXpPrizeFields,
  PendingAllocationNotice,
  PrizeAllocationPanel,
  PrizeSummaryBadges,
  PrizeTypeSelector,
  ReadonlyPrizeIdentity,
  ReleaseBucketsSection,
  RewardCandidateChecklist,
  XpBoostPrizeFields,
  detailSummaryClasses,
  fieldClasses,
  labelClasses,
  type PerkPrizeManagerActions,
} from "@/features/rewards/admin/perk-prize-manager-ui";

const perkPrizeManagerActions = {
  assignPerkPrizeInventory,
  deletePerkReleaseBucket,
  releasePerkPrizeInventory,
  savePerkReleaseBucket,
} satisfies PerkPrizeManagerActions;

function PrizeEditorCard({
  bundleRewardId,
  focusedPrizeId,
  noticeCode,
  prize,
}: {
  bundleRewardId: string;
  focusedPrizeId?: string;
  noticeCode?: string;
  prize: AdminPerkPrizeRow;
}) {
  const prizeType: PrizeType = prize.prize_type;
  const { color, iconName, legacyIcon } = getPerkPrizeThumbnailDefaults(prize);
  const hasAssignedPool = (prize.assigned_available ?? 0) > 0;
  const canSaveDetails = canSavePrizeDetails(prize);
  const canRemovePrize = true;
  const linkedRewardLabel =
    prize.source_reward?.title ?? prize.source_reward_id ?? prize.title ?? "Linked reward";
  const saveFormId = `save-perk-prize-${prize.id}`;
  const redirectTo = `/admin/rewards/perks/${bundleRewardId}`;
  const isFocusedPrize = focusedPrizeId === prize.id;
  const inlineNotice = getFocusedPrizeNotice(focusedPrizeId, noticeCode, prize.id);

  return (
    <details className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4" open={isFocusedPrize}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <p className="text-base font-black">{describePrize(prize)}</p>
          <PrizeSummaryBadges prize={prize} />
        </div>
        <span className="rounded-full bg-[var(--ve-card)] px-3 py-2 text-xs font-black text-[var(--ve-violet)]">
          Edit
        </span>
      </summary>

      {inlineNotice ? (
        <div className="mt-4 rounded-[12px] border border-[color:color-mix(in_srgb,var(--ve-green)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)]">
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
              defaultIconName={iconName || "coins"}
              defaultLegacyIcon={legacyIcon}
              defaultTitle={prize.title ?? getNativeXpDefaultTitle(Number(prize.config.amount ?? 5))}
            />
          ) : null}

          {prizeType === "xp_boost" ? (
            <XpBoostPrizeFields
              defaultColor={color || "#fff6ed"}
              defaultDurationHours={Number(prize.config.durationHours ?? 24)}
              defaultIconName={iconName || "bolt"}
              defaultLegacyIcon={legacyIcon}
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
        <PrizeAllocationPanel
          actions={perkPrizeManagerActions}
          bundleRewardId={bundleRewardId}
          prize={prize}
        />
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
            <div className="mt-3 space-y-4">
              <label className="md:col-span-2">
                <span className={labelClasses()}>Override title</span>
                <input className={fieldClasses()} defaultValue={prize.title ?? ""} name="title" />
              </label>
              <RewardThumbnailFields
                color={color}
                iconName={iconName}
                legacyIcon={legacyIcon}
                showUrl={false}
                title={prize.title ?? linkedRewardLabel}
              />
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

      {prizeType !== "reward" || hasAssignedPool ? (
        <div className="mt-4">
          <ReleaseBucketsSection
            actions={perkPrizeManagerActions}
            bundleRewardId={bundleRewardId}
            prize={prize}
          />
        </div>
      ) : null}

      {canSaveDetails || canRemovePrize ? (
        <div className="mt-6 border-t border-[var(--ve-line-soft)] pt-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Final actions</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canSaveDetails ? (
              <button
                className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white"
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
                  className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-danger)]"
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

  const helperCopy = useMemo(() => getAddPrizeHelperCopy(prizeType), [prizeType]);

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
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--ve-violet-soft)_82%,var(--ve-card))] text-[var(--ve-violet)] transition-transform ${
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
                defaultIconName="coins"
                defaultLegacyIcon=""
                defaultTitle="Bonus XP"
              />
            ) : null}

            {prizeType === "xp_boost" ? (
              <XpBoostPrizeFields
                defaultColor="#fff6ed"
                defaultDurationHours={24}
                defaultIconName="bolt"
                defaultLegacyIcon=""
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
                defaultOpen={true}
                defaultSortOrder={0}
                defaultTotalCap={null}
                defaultWeight={1}
              />
            )}

            {prizeType !== "reward" ? (
              <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white" type="submit">
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
                className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
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
        <div className="mt-4 rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-green)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)]">
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
            />
          ))
        )}
      </div>
    </AdminCard>
  );
}
