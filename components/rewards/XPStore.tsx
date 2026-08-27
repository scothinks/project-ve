"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { CalendarXIcon, CoinIcon, LockIcon, ShoppingBagIcon } from "@/components/rewards/RewardIcons";
import { CheckCircleIcon, StarBadgeIcon } from "@/components/missions/MissionIcons";
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
  storeName = "XP Store",
  workspaceLabel = "XP",
}: {
  disableRedemption?: boolean;
  apiPath?: string;
  redeemPathPrefix?: string;
  initialAuthRequired?: boolean;
  initialSnapshot?: RewardStoreSnapshot | null;
  storeName?: string;
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
      <div className="store-panel__header flex items-center justify-between gap-3">
        <h1 className="truncate text-[1.4rem] font-black tracking-[-0.02em] text-[var(--ve-green)]">
          {storeName}
        </h1>
        <span className="store-panel__balance flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-[var(--ve-card-muted)] px-3 py-1.5 text-[0.78rem] font-black tabular-nums text-[var(--ve-muted-strong)]">
          <StarBadgeIcon className="size-3.5 text-[#a66d00]" />
          {formatXpLabel(snapshot.xpBalance, workspaceLabel)}
        </span>
      </div>

      <div className="store-panel__tabs mt-5 flex gap-6 border-b border-[var(--ve-line-soft)]">
        <button
          className={cn(
            "min-h-10 border-b-2 px-0.5 text-[0.85rem] font-semibold tracking-[-0.01em]",
            tab === "store"
              ? "border-[var(--ve-green)] text-[var(--ve-green)]"
              : "border-transparent text-[var(--ve-muted)]",
          )}
          onClick={() => setTab("store")}
          type="button"
        >
          Store
        </button>
        <button
          className={cn(
            "min-h-10 border-b-2 px-0.5 text-[0.85rem] font-semibold tracking-[-0.01em]",
            tab === "history"
              ? "border-[var(--ve-green)] text-[var(--ve-green)]"
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
                Featured Reward
              </p>
              <Card className="store-feature__card !rounded-[8px] overflow-hidden p-0" variant="store">
                <div className="store-feature__media h-48 w-full overflow-hidden bg-[#fff8df]">
                  <RewardThumb thumbnail={featuredReward.thumbnail} title={featuredReward.title} />
                </div>
                <div className="store-feature__body p-4">
                  <h2 className="text-[1.06rem] font-semibold leading-6 tracking-[-0.01em] text-[var(--foreground)]">
                    {featuredReward.title}
                  </h2>
                  <p className="mt-1 text-[0.8rem] font-medium leading-5 text-[var(--ve-muted)]">
                    {featuredReward.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[0.85rem] font-black text-[#a66d00]">
                      <CoinIcon className="size-4" />
                      {formatXpLabel(featuredReward.costXp, workspaceLabel)}
                    </span>
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
                            ? "Insufficient"
                            : "Redeem"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          <div className="store-catalogue-heading mt-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ve-muted)]">
              Standard Issue Catalogue
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
            const isLocked = !reward.isSoldOut && snapshot.xpBalance < reward.costXp;

            return (
              <Card
                className={cn("store-reward-card !rounded-[8px] overflow-hidden p-0", (reward.isSoldOut || isLocked) && "opacity-80")}
                key={reward.id}
                variant="store"
              >
                <div className="relative h-32 w-full overflow-hidden bg-[var(--ve-card-muted)]">
                  <RewardThumb thumbnail={reward.thumbnail} title={reward.title} />
                  {reward.isSoldOut || isLocked ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/20">
                      <LockIcon className="size-6 text-white" />
                    </div>
                  ) : null}
                </div>
                <div className="p-3">
                  <div className="min-w-0">
                      <h2 className="line-clamp-2 text-[0.82rem] font-semibold leading-5 tracking-[-0.01em] text-[var(--foreground)]">
                        {reward.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-[0.7rem] font-medium leading-4 text-[var(--ve-muted)]">
                        {reward.description}
                      </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[0.72rem] font-black text-[#a66d00]">
                      <CoinIcon className="size-3.5" />
                      {formatXpLabel(reward.costXp, workspaceLabel)}
                    </span>
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
                          ? "Insufficient"
                          : "Redeem"}
                    </Button>
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
                      <RewardThumb thumbnail={redemption.rewardThumbnail} title={redemption.rewardTitle} />
                    </div>
                    <div className="store-history-card__copy min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--ve-card-muted)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--ve-muted-strong)]">
                        <CheckCircleIcon className="size-3" />
                        {claimStateLabels[redemption.claimState]}
                      </span>
                      <h2 className="mt-1.5 line-clamp-2 text-[1.02rem] font-semibold leading-6 tracking-[-0.01em] text-[var(--foreground)]">
                        {redemption.rewardTitle}
                      </h2>
                      <p className="mt-1 text-[0.78rem] font-medium leading-5 text-[var(--ve-muted)]">
                        Redeemed {formatRewardDate(redemption.requestedAt)}
                      </p>
                      <button
                        className="mt-4 text-left text-[0.85rem] font-medium tracking-[-0.01em] text-[#a66d00]"
                        onClick={() => setExpandedRedemptionId(expanded ? null : redemption.id)}
                        type="button"
                      >
                        {expanded ? "Hide details" : "View claim details"}
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="store-history-card__fulfillment mt-5 space-y-5 border-t border-[var(--ve-line-soft)] pt-5">
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

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ve-muted)]">
                            <CoinIcon className="size-3.5" />
                            Cost
                          </span>
                          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                            {formatXpLabel(redemption.xpCost, workspaceLabel)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ve-muted)]">
                            <CalendarXIcon className="size-3.5" />
                            Expires
                          </span>
                          <p className={cn("mt-1 text-sm font-semibold", redemption.redemptionExpiresAt ? "text-[#c94f2e]" : "text-[var(--foreground)]")}>
                            {redemption.redemptionExpiresAt
                              ? formatRewardDate(redemption.redemptionExpiresAt)
                              : "No expiry"}
                          </p>
                        </div>
                      </div>
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
        <div className="store-redemption-overlay fixed inset-0 z-40 grid place-items-end bg-black/30 px-0 sm:px-4 sm:py-6">
          <Card className="store-redemption-dialog w-full max-w-[430px] !rounded-[8px] rounded-b-none overflow-hidden p-0 sm:mx-auto sm:rounded-b-[8px]">
            <div className="store-redemption-dialog__media relative h-32 w-full bg-[#fff8df]">
              <RewardThumb thumbnail={confirmReward.thumbnail} title={confirmReward.title} />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--ve-card)]/70 to-transparent" />
            </div>
            <div className="px-5 pb-5 pt-0 text-center">
              <div className="relative -mt-8 inline-grid size-14 place-items-center rounded-full border-4 border-[var(--ve-card)] bg-[#dff2e9] text-[#087f5b] shadow-sm">
                <ShoppingBagIcon className="size-6" />
              </div>
              <h2 className="mt-3 text-[1.15rem] font-black tracking-[-0.02em]">Redeem Reward</h2>
              <p className="mx-auto mt-2 max-w-[280px] text-sm font-medium leading-6 text-[var(--ve-muted)]">
                {confirmReward.distributionMode === "perk_bundle" ? (
                  <>
                    This will spend{" "}
                    <strong className="font-semibold text-[var(--ve-green)]">
                      {formatXpLabel(confirmReward.costXp, workspaceLabel)}
                    </strong>{" "}
                    to reveal a surprise reward.
                  </>
                ) : (
                  <>
                    This will redeem{" "}
                    <strong className="font-semibold text-[var(--ve-green)]">
                      {formatXpLabel(confirmReward.costXp, workspaceLabel)}
                    </strong>{" "}
                    for <strong className="font-semibold text-[var(--foreground)]">{confirmReward.title}</strong> and
                    add it to your History.
                  </>
                )}
              </p>

              <div className="mt-4 space-y-2 rounded-lg border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-3">
                <div className="flex items-center justify-between text-sm font-semibold text-[var(--ve-muted-strong)]">
                  <span>Current Balance</span>
                  <span>{formatXpLabel(snapshot.xpBalance, workspaceLabel)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-[#c94f2e]">
                  <span>Cost</span>
                  <span>-{formatXpLabel(confirmReward.costXp, workspaceLabel)}</span>
                </div>
                <div className="h-px bg-[var(--ve-line-soft)]" />
                <div className="flex items-center justify-between text-[0.98rem] font-black text-[var(--ve-green)]">
                  <span>After Redemption</span>
                  <span>
                    {formatXpLabel(Math.max(0, snapshot.xpBalance - confirmReward.costXp), workspaceLabel)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 bg-[var(--ve-card-muted)] p-4 md:flex-row-reverse">
              <Button className="gap-2" disabled={redeeming} onClick={() => void redeemReward()} type="button">
                {redeeming ? "Redeeming..." : "Confirm"}
                {!redeeming ? <CheckCircleIcon className="size-4" /> : null}
              </Button>
              <Button
                disabled={redeeming}
                onClick={() => setConfirmReward(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
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
