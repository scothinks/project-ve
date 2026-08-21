"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { XPBadge } from "@/components/ui/XPBadge";
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
import {
  claimStateLabels,
  distributionLabels,
  fulfillmentLabels,
  getNativeOutcomeDetails,
  shouldShowRedemptionMessage,
  type Tab,
} from "@/features/rewards/learner/xp-store-domain";
import {
  RewardFulfillment,
  RewardThumb,
  StoreLoadingState,
} from "@/features/rewards/learner/xp-store-ui";

export function XPStore({
  disableRedemption = false,
  apiPath = "/api/rewards",
  redeemPathPrefix = "/api/rewards",
  initialAuthRequired = false,
  initialSnapshot = null,
  workspaceLabel = "XP",
}: {
  disableRedemption?: boolean;
  apiPath?: string;
  redeemPathPrefix?: string;
  initialAuthRequired?: boolean;
  initialSnapshot?: RewardStoreSnapshot | null;
  workspaceLabel?: string;
}) {
  const [snapshot, setSnapshot] = useState<RewardStoreSnapshot | null>(initialSnapshot);
  const [tab, setTab] = useState<Tab>("store");
  const [expandedRewardId, setExpandedRewardId] = useState<string | null>(null);
  const [expandedRedemptionId, setExpandedRedemptionId] = useState<string | null>(null);
  const [activeRedemption, setActiveRedemption] = useState<RewardRedemption | null>(null);
  const [confirmReward, setConfirmReward] = useState<StoreReward | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialSnapshot && !initialAuthRequired);
  const [redeeming, setRedeeming] = useState(false);
  const [authRequired, setAuthRequired] = useState(initialAuthRequired);
  const [storePage, setStorePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const activeNativeOutcome =
    activeRedemption?.fulfillmentType === "native"
      ? getNativeOutcomeDetails(activeRedemption)
      : null;
  const rewardItems = useMemo(() => snapshot?.rewards ?? [], [snapshot?.rewards]);
  const featuredReward = rewardItems[0] ?? null;
  const catalogueRewards = useMemo(() => rewardItems.slice(1), [rewardItems]);
  const redemptionItems = useMemo(() => snapshot?.redemptions ?? [], [snapshot?.redemptions]);
  const paginatedRewards = useMemo(
    () => paginateItems(catalogueRewards, storePage, 6),
    [catalogueRewards, storePage],
  );
  const paginatedRedemptions = useMemo(
    () => paginateItems(redemptionItems, historyPage, 6),
    [redemptionItems, historyPage],
  );

  const loadStore = useCallback(async function loadStore() {
    const response = await fetch(apiPath, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setSnapshot(null);
      setAuthRequired(response.status === 401);
      setMessage(data.error ?? "Could not load the reward store.");
      setLoading(false);
      return null;
    }

    const nextSnapshot = data as RewardStoreSnapshot;
    setAuthRequired(false);
    setSnapshot(nextSnapshot);
    setLoading(false);
    return nextSnapshot;
  }, [apiPath]);

  useEffect(() => {
    function reload() {
      void loadStore();
    }

    window.addEventListener("xp-store:reload", reload);
    return () => window.removeEventListener("xp-store:reload", reload);
  }, [loadStore]);

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

  useEffect(() => {
    if (tab === "history" && redemptionItems.length > 0 && !expandedRedemptionId) {
      setExpandedRedemptionId(redemptionItems[0]!.id);
    }
  }, [expandedRedemptionId, redemptionItems, tab]);

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

    const response = await fetch(`${redeemPathPrefix}/${confirmReward.id}/redeem`, {
      method: "POST",
    });
    const data = await response.json();

    setRedeeming(false);

    if (!response.ok) {
      setConfirmReward(null);
      setMessage(data.error ?? `Could not redeem ${workspaceLabel} for this reward.`);
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
      <section className="learner-page learner-page--spacious">
        <Card className="p-6" variant="store">
          <p className="text-sm font-bold">{message ?? "Could not load the reward store."}</p>
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
    <section className="store-panel learner-page learner-page--standard">
      <div className="store-panel__header flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.55rem] font-black tracking-[-0.02em] text-[var(--foreground)]">
            XP Store
          </h1>
          <p className="store-panel__subtitle mt-1 hidden text-[0.82rem] font-medium leading-5 text-[var(--ve-muted)] lg:block">
            Redeem your hard-earned XP for exclusive rewards.
          </p>
        </div>
        <span className="store-panel__balance shrink-0 rounded-full bg-[#dff2e9] px-3 py-2 text-[0.72rem] font-black tabular-nums text-[#087f5b]">
          {formatXpLabel(snapshot.xpBalance, workspaceLabel)}
        </span>
      </div>

      <div className="store-panel__tabs mt-5 flex border-b border-[var(--ve-line-soft)]">
        <button
          className={cn(
            "min-h-10 border-b-2 px-1.5 text-[0.78rem] font-semibold tracking-[-0.01em]",
            tab === "store"
              ? "border-[#087f5b] text-[#087f5b]"
              : "border-transparent text-[var(--ve-muted)]",
          )}
          onClick={() => setTab("store")}
          type="button"
        >
          Store
        </button>
        <button
          className={cn(
            "ml-5 min-h-10 border-b-2 px-1.5 text-[0.78rem] font-semibold tracking-[-0.01em]",
            tab === "history"
              ? "border-[#087f5b] text-[#087f5b]"
              : "border-transparent text-[var(--ve-muted)]",
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
        <>
          {featuredReward ? (
            <div className="store-feature mt-5">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ve-muted)]">
                Featured
              </p>
              <Card className="store-feature__card !rounded-[8px] overflow-hidden p-0" variant="store">
                <div className="store-feature__media h-36 w-full overflow-hidden bg-[#fff8df]">
                  <RewardThumb thumbnail={featuredReward.thumbnail} title={featuredReward.title} />
                </div>
                <div className="store-feature__body p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[1rem] font-semibold leading-6 tracking-[-0.01em] text-[var(--foreground)]">
                        {featuredReward.title}
                      </h2>
                      <p className="mt-1 text-[0.8rem] font-medium leading-5 text-[var(--ve-muted)]">
                        {featuredReward.description}
                      </p>
                    </div>
                    <XPBadge
                      xp={featuredReward.costXp}
                      unitLabel={workspaceLabel}
                      className="h-8 shrink-0 bg-[#dff2e9] px-3 text-xs text-[#087f5b]"
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-end">
                    <Button
                      className="h-9 px-5 text-[0.78rem]"
                      disabled={
                        disableRedemption
                        || snapshot.xpBalance < featuredReward.costXp
                        || featuredReward.isSoldOut
                      }
                      onClick={() => setConfirmReward(featuredReward)}
                      type="button"
                      variant={
                        !disableRedemption
                        && snapshot.xpBalance >= featuredReward.costXp
                        && !featuredReward.isSoldOut
                          ? "primary"
                          : "outline"
                      }
                    >
                      {disableRedemption
                        ? "View only"
                        : featuredReward.isSoldOut
                          ? "Sold Out"
                          : snapshot.xpBalance < featuredReward.costXp
                            ? "Locked"
                            : "Redeem"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          <div className="store-catalogue-heading mt-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ve-muted)]">
              Catalogue
            </p>
          </div>
          <div className="store-catalogue-grid grid grid-cols-2 gap-3 lg:grid-cols-3">
            {snapshot.rewards.length === 0 ? (
              <Card className="!rounded-[8px] col-span-2 p-6 text-center lg:col-span-3" variant="store">
                <p className="text-sm font-black">No rewards available</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  New rewards will appear here when they are available.
                </p>
              </Card>
            ) : paginatedRewards.items.length === 0 ? (
              <Card className="!rounded-[8px] col-span-2 p-5 text-center lg:col-span-3" variant="store">
                <p className="text-sm font-black">More rewards soon</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Check history for redeemed rewards, or return when the catalogue refreshes.
                </p>
              </Card>
            ) : paginatedRewards.items.map((reward) => {
            const expanded = expandedRewardId === reward.id;
            const canRedeem = !disableRedemption && snapshot.xpBalance >= reward.costXp && !reward.isSoldOut;

            return (
              <Card className="store-reward-card !rounded-[8px] overflow-hidden p-3" key={reward.id} variant="store">
                <div className="grid gap-3">
                  <div className="aspect-square w-full shrink-0 overflow-hidden rounded-[10px] bg-[var(--ve-card-muted)]">
                    <RewardThumb thumbnail={reward.thumbnail} title={reward.title} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0">
                        <h2 className="line-clamp-2 text-[0.82rem] font-semibold leading-5 tracking-[-0.01em] text-[var(--foreground)]">
                          {reward.title}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-[0.7rem] font-medium leading-4 text-[var(--ve-muted)]">
                          {reward.description}
                        </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <XPBadge
                        xp={reward.costXp}
                        unitLabel={workspaceLabel}
                        className="h-7 shrink-0 bg-[#dff2e9] px-2 text-[0.68rem] text-[#087f5b]"
                      />
                      <button
                        className="text-left text-[0.72rem] font-medium tracking-[-0.01em] text-[#087f5b]"
                        onClick={() => setExpandedRewardId(expanded ? null : reward.id)}
                        type="button"
                      >
                        {expanded ? "Hide details" : "Details"}
                      </button>
                    </div>
                    <div className="mt-3">
                      <Button
                        className="h-9 w-full px-3 text-[0.75rem]"
                        disabled={!canRedeem}
                        onClick={() => setConfirmReward(reward)}
                        type="button"
                        variant={canRedeem ? "primary" : "outline"}
                      >
                        {disableRedemption
                          ? "View only"
                          : reward.isSoldOut
                          ? "Sold Out"
                          : snapshot.xpBalance < reward.costXp
                            ? "Locked"
                            : "Get"}
                      </Button>
                    </div>
                  </div>
                </div>

                {expanded ? (
                    <div className="mt-5 border-t border-[var(--ve-line-soft)] pt-5">
                    <div className="grid grid-cols-1 gap-4 text-xs font-bold text-[var(--ve-muted)] min-[390px]:grid-cols-2">
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
          </div>
          <PaginationControls
            className="mt-5 pt-2"
            currentPage={paginatedRewards.currentPage}
            onPageChange={(nextPage) => {
              setExpandedRewardId(null);
              setStorePage(nextPage);
            }}
            totalPages={paginatedRewards.totalPages}
          />
        </>
      ) : (
        <>
          <div className="store-history-grid mt-5 grid gap-3 lg:grid-cols-2">
            {snapshot.redemptions.length === 0 ? (
              <Card className="p-6 text-center" variant="store">
                <p className="text-sm font-black">No purchases yet</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Redeem {workspaceLabel} for a reward, then return here to manage it.
                </p>
              </Card>
            ) : (
              paginatedRedemptions.items.map((redemption) => {
              const expanded = expandedRedemptionId === redemption.id;

              return (
                <Card
                  className={cn(
                    "store-history-card !rounded-[8px] overflow-hidden p-5",
                    expanded && "store-history-card--expanded",
                  )}
                  key={redemption.id}
                  variant="store"
                >
                  <div className="store-history-card__summary grid gap-3 min-[390px]:grid-cols-[5rem_minmax(0,1fr)] min-[390px]:items-start">
                    <div className="store-history-card__media size-16 shrink-0 overflow-hidden rounded-[10px]">
                      <RewardThumb
                        thumbnail={redemption.rewardThumbnail}
                        title={redemption.rewardTitle}
                      />
                    </div>
                    <div className="store-history-card__copy min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-[1.06rem] font-semibold leading-6 tracking-[-0.02em] text-[var(--foreground)]">
                            {redemption.rewardTitle}
                          </h2>
                          <p className="mt-2 text-[0.92rem] font-medium leading-6 tracking-[-0.01em] text-[var(--ve-muted)]">
                            {formatXpLabel(redemption.xpCost, workspaceLabel)} spent
                          </p>
                          <p className="store-history-card__date mt-1 text-[0.72rem] font-bold text-[var(--ve-muted)]">
                            Redeemed {formatRewardDate(redemption.requestedAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#dff2e9] px-3 py-1.5 text-[11px] font-black text-[#087f5b]">
                          {claimStateLabels[redemption.claimState]}
                        </span>
                      </div>
                      <button
                        className="mt-5 text-left text-[0.95rem] font-medium tracking-[-0.01em] text-[#a66d00]"
                        onClick={() => setExpandedRedemptionId(expanded ? null : redemption.id)}
                        type="button"
                      >
                        {expanded ? "Hide claim" : "View claim"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="store-history-card__fulfillment mt-5 space-y-5 border-t border-[var(--ve-line-soft)] pt-5">
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
          </div>
          <PaginationControls
            className="mt-5 pt-2"
            currentPage={paginatedRedemptions.currentPage}
            onPageChange={(nextPage) => {
              setExpandedRedemptionId(null);
              setHistoryPage(nextPage);
            }}
            totalPages={paginatedRedemptions.totalPages}
          />
        </>
      )}

      {confirmReward ? (
        <div className="store-redemption-overlay fixed inset-0 z-40 grid place-items-end bg-black/30 px-4 py-6">
          <Card className="store-redemption-dialog w-full max-w-[430px] !rounded-[8px] overflow-hidden p-0">
            <div className="store-redemption-dialog__media h-32 w-full bg-[#fff8df]">
              <RewardThumb thumbnail={confirmReward.thumbnail} title={confirmReward.title} />
            </div>
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a66d00]">
                Confirm Redemption
              </p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.02em]">{confirmReward.title}</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-[18px] bg-[var(--ve-card-muted)] p-3 text-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                    Cost
                  </p>
                  <p className="mt-1 text-xs font-black tabular-nums">
                    {formatXpLabel(confirmReward.costXp, workspaceLabel)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                    Current
                  </p>
                  <p className="mt-1 text-xs font-black tabular-nums">
                    {formatXpLabel(snapshot.xpBalance, workspaceLabel)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                    After
                  </p>
                  <p className="mt-1 text-xs font-black tabular-nums">
                    {formatXpLabel(Math.max(0, snapshot.xpBalance - confirmReward.costXp), workspaceLabel)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                {confirmReward.distributionMode === "perk_bundle"
                  ? `This will spend ${formatXpLabel(confirmReward.costXp, workspaceLabel)} to reveal a surprise reward.`
                  : `This spends ${formatXpLabel(confirmReward.costXp, workspaceLabel)} and adds the reward to your history.`}
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
            </div>
          </Card>
        </div>
      ) : null}

      {activeRedemption ? (
        <div className="store-claim-overlay fixed inset-0 z-50 grid place-items-end bg-black/30 px-4 py-6">
          <Card className="store-claim-dialog w-full max-w-[430px] !rounded-[8px] p-5">
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
