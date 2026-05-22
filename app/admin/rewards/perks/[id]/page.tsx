import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { PerkAnalyticsPanel } from "@/components/admin/PerkAnalyticsPanel";
import { PerkPrizeManager } from "@/components/admin/PerkPrizeManager";
import { PerkEditorForm } from "@/components/admin/PerkEditorForm";
import {
  AdminCard,
  AdminPagination,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminRewardDetail, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";
import { setPerkPrizeEnabled, updateReward } from "../../[id]/actions";

type AdminPerkDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    notice?: string;
    prizePage?: string;
    drawPage?: string;
    focusPrize?: string;
  }>;
};

function getNoticeCopy(notice?: string) {
  switch (notice) {
    case "prize-added":
      return "Prize added to the pool.";
    case "rewards-added":
      return "Selected rewards added to the pool.";
    case "reward-already-added":
      return "That reward is already in this pool.";
    case "rewards-already-added":
      return "Those rewards are already in this pool.";
    case "prize-saved":
      return "Prize changes saved.";
    case "prize-enabled":
      return "Prize enabled.";
    case "prize-disabled":
      return "Prize disabled.";
    default:
      return "";
  }
}

function formatPrizeWindow(availableFrom: string | null, expiresAt: string | null) {
  if (!availableFrom && !expiresAt) {
    return "Follows reward timing";
  }

  if (!availableFrom && expiresAt) {
    return `Open until ${formatRewardDate(expiresAt)}`;
  }

  if (availableFrom && !expiresAt) {
    return `${formatRewardDate(availableFrom)} onward`;
  }

  return `${formatRewardDate(availableFrom)} to ${formatRewardDate(expiresAt)}`;
}

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function getClaimSteps(value: unknown) {
  return Array.isArray(value) ? value.filter((step): step is string => typeof step === "string") : [];
}

function getFallbackConfig(value: unknown) {
  type FallbackConfig = {
    prizeType: "native_xp" | "xp_boost";
    title: string;
    amount: number;
    multiplier: number;
    durationHours: number;
    uses: number;
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      prizeType: "native_xp" as const,
      title: "Bonus XP",
      amount: 5,
      multiplier: 2,
      durationHours: 24,
      uses: 1,
    } satisfies FallbackConfig;
  }

  const record = value as Record<string, unknown>;
  const fallback =
    record.fallback && typeof record.fallback === "object" && !Array.isArray(record.fallback)
      ? (record.fallback as Record<string, unknown>)
      : {};

  return {
    prizeType: fallback.prizeType === "xp_boost" ? "xp_boost" : "native_xp",
    title: typeof fallback.title === "string" ? fallback.title : fallback.prizeType === "xp_boost" ? "XP Boost" : "Bonus XP",
    amount: typeof fallback.amount === "number" ? fallback.amount : 5,
    multiplier: typeof fallback.multiplier === "number" ? fallback.multiplier : 2,
    durationHours: typeof fallback.durationHours === "number" ? fallback.durationHours : 24,
    uses: typeof fallback.uses === "number" ? fallback.uses : 1,
  } satisfies FallbackConfig;
}

function getStorefrontState(perk: {
  status: string;
  is_enabled: boolean;
  visibility_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  offer_expires_at: string | null;
  campaign?: { status: string; starts_at: string | null; ends_at: string | null } | null;
}, options: { hasAvailableOutcomes: boolean }) {
  const now = Date.now();
  const perkStartsAt = perk.starts_at ? new Date(perk.starts_at).getTime() : null;
  const perkEndsAt = perk.ends_at ? new Date(perk.ends_at).getTime() : null;
  const offerEndsAt = perk.offer_expires_at ? new Date(perk.offer_expires_at).getTime() : null;
  const campaignStartsAt = perk.campaign?.starts_at ? new Date(perk.campaign.starts_at).getTime() : null;
  const campaignEndsAt = perk.campaign?.ends_at ? new Date(perk.campaign.ends_at).getTime() : null;

  if (perk.status !== "published" || !perk.is_enabled) return "paused";
  if (perk.visibility_mode === "hidden") return "hidden";
  if (perk.visibility_mode === "system_only") return "system only";
  if (perk.visibility_mode === "campaign_only") return "campaign only";
  if (!perk.campaign || perk.campaign.status !== "active") return "campaign off";
  if ((campaignStartsAt && campaignStartsAt > now) || (perkStartsAt && perkStartsAt > now)) return "scheduled";
  if (
    (campaignEndsAt && campaignEndsAt <= now)
    || (perkEndsAt && perkEndsAt <= now)
    || (offerEndsAt && offerEndsAt <= now)
  ) return "ended";
  if (!options.hasAvailableOutcomes) return "pool empty";
  return "live";
}

function badgeTone(state: string) {
  if (state === "live") return "good" as const;
  if (state === "scheduled" || state === "pool empty") return "warning" as const;
  if (state === "paused") return "danger" as const;
  return "neutral" as const;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function CollapsibleSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] ${className}`}>
      <summary className="cursor-pointer list-none px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">{description}</p>
            ) : null}
          </div>
          <span className="rounded-full bg-[#f3ecff] px-3 py-1 text-xs font-black text-[#6c3cc2]">
            Open
          </span>
        </div>
      </summary>
      <div className="border-t border-[var(--ve-line-soft)] p-5">{children}</div>
    </details>
  );
}

export default async function AdminPerkDetailPage({ params, searchParams }: AdminPerkDetailPageProps) {
  const { id } = await params;
  const { notice, prizePage, drawPage, focusPrize } = await searchParams;
  const { supabase } = await requireAdmin();
  const [detail, campaigns] = await Promise.all([
    getAdminRewardDetail(supabase, id),
    getAdminCampaigns(supabase),
  ]);

  if (!detail) {
    notFound();
  }

  if (detail.reward.distribution_mode !== "perk_bundle" && detail.reward.fulfillment_type !== "perk_bundle") {
    redirect(`/admin/rewards/${detail.reward.id}`);
  }

  const {
    reward,
    perkPrizes,
    perkRewardCandidates,
    perkDrawHistory,
    perkAnalytics,
    perkTrend,
    perkDistribution,
  } = detail;
  const thumbnail = reward.thumbnail ?? {};
  const claimSteps = getClaimSteps(reward.claim_steps);
  const fallback = getFallbackConfig(reward.fulfillment_config ?? {});
  const storefrontState = getStorefrontState(reward, {
    hasAvailableOutcomes: perkAnalytics.activePrizeCount > 0 || fallback.prizeType !== undefined,
  });
  const noticeCopy = getNoticeCopy(notice);
  const paginatedPrizes = paginateItems(perkPrizes, parsePageParam(prizePage), 8);
  const paginatedDrawHistory = paginateItems(perkDrawHistory, parsePageParam(drawPage), 10);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards/perks"
        backLabel="Perks"
        eyebrow="XP Store"
        title={reward.title}
        subtitle="Operate this perk like a distribution program: control access, tune the prize pool, monitor draw outcomes, and intervene when release pressure changes."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Storefront" tone={storefrontState === "live" ? "mission" : storefrontState === "paused" ? "risk" : "warning"} value={storefrontState} />
        <AdminStatCard label="Fallback" tone="store" value={fallback.title} />
        <AdminStatCard label="Prize Options" tone="default" value={perkAnalytics.activePrizeCount} />
        <AdminStatCard label="Draws Today" tone="mission" value={perkAnalytics.drawsToday} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <AdminCard>
          <PerkEditorForm
            action={updateReward}
            campaigns={campaigns}
            mode="edit"
            perk={{
              id: reward.id,
              title: reward.title,
              description: reward.description ?? "",
              costXp: reward.cost_xp,
              visibilityMode: reward.visibility_mode,
              perUserLimit: reward.per_user_limit,
              limitPeriod: reward.limit_period,
              redemptionWindowDays: reward.redemption_window_days ?? "",
              sortOrder: reward.sort_order,
              offerExpiresAt: toDateInputValue(reward.offer_expires_at),
              thumbnailUrl: getString(thumbnail, "url"),
              thumbnailIcon: getString(thumbnail, "icon"),
              thumbnailColor: getString(thumbnail, "color"),
              terms: reward.terms ?? "",
              claimSteps,
              campaignId: reward.campaign_id,
              fallback,
            }}
          />
        </AdminCard>

        <aside className="space-y-4">
          <AdminCard>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Availability</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminStatusBadge tone={badgeTone(storefrontState)}>{storefrontState}</AdminStatusBadge>
              <AdminStatusBadge tone={reward.is_enabled ? "good" : "danger"}>
                {reward.is_enabled ? reward.status : "disabled"}
              </AdminStatusBadge>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Campaign</dt>
                <dd className="mt-1 font-bold">{reward.campaign?.name ?? "No campaign"}</dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">XP cost</dt>
                <dd className="mt-1 font-black">{formatXpLabel(reward.cost_xp)}</dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Prize pool</dt>
                <dd className="mt-1 font-black">{perkAnalytics.activePrizeCount} active outcome{perkAnalytics.activePrizeCount === 1 ? "" : "s"}</dd>
              </div>
              <div>
                <dt className="font-black text-[var(--ve-muted)]">Offer ends</dt>
                <dd className="mt-1 font-bold">{formatRewardDate(reward.offer_expires_at)}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Fallback</p>
            <h2 className="mt-2 text-lg font-black">{fallback.title}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              {fallback.prizeType === "xp_boost"
                ? `${fallback.multiplier}x boost for ${fallback.durationHours}h (${fallback.uses} use${fallback.uses === 1 ? "" : "s"})`
                : `${fallback.amount} XP if the live pool cannot award a released prize.`}
            </p>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-black">Draw log</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Open the dedicated draw view when you need to inspect winners, fallback behavior, and award timing in detail.
            </p>
            <Link
              className="mt-4 inline-flex w-full items-center justify-center rounded-[14px] bg-[#f3ecff] px-4 py-3 text-sm font-black text-[#6c3cc2]"
              href={`/admin/rewards/perks/${encodeURIComponent(reward.id)}/draws`}
            >
              Open draw log
            </Link>
          </AdminCard>
        </aside>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Lifetime Draws" tone="default" value={perkAnalytics.drawsTotal} />
        <AdminStatCard label="Fallback Rate" tone={perkAnalytics.fallbackRateTotal > 0.15 ? "warning" : "default"} value={formatPercent(perkAnalytics.fallbackRateTotal)} />
        <AdminStatCard label="Fallback Today" tone={perkAnalytics.fallbackDrawsToday > 0 ? "warning" : "default"} value={perkAnalytics.fallbackDrawsToday} />
        <AdminStatCard label="Prize Pool Health" tone={perkAnalytics.activePrizeCount === 0 ? "risk" : "default"} value={`${perkAnalytics.activePrizeCount}/${perkPrizes.length}`} />
      </section>

      {noticeCopy ? (
        <AdminCard className="mt-6 border-[#d9efe5] bg-[#f3fbf7]">
          <p className="text-sm font-black text-[#087f5b]">{noticeCopy}</p>
        </AdminCard>
      ) : null}

      <PerkAnalyticsPanel distribution={perkDistribution} trend={perkTrend} />

      <AdminCard className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Prize pool</p>
            <h2 className="mt-2 text-xl font-black">What learners can win right now</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Focus on what is released, how often it is being hit, and whether linked reward stock is under pressure.
            </p>
          </div>
        </div>
        {perkPrizes.length === 0 ? (
          <EmptyAdminState>No prize pool configured yet.</EmptyAdminState>
        ) : (
          <div className="mt-5">
            <AdminTable columns={["Prize", "Type", "Weight", "Draws today", "Draws total", "Remaining today", "Remaining total", "Window", "State", "Action"]}>
              {paginatedPrizes.items.map((prize) => (
                <tr key={prize.id}>
                  <td className="min-w-[220px] px-4 py-3">
                    <p className="font-black">
                      {prize.source_reward?.title ?? prize.title ?? "Prize"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      {prize.source_reward ? `Linked to ${prize.source_reward.fulfillment_type.replaceAll("_", " ")}` : "Native fallback-style prize"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 capitalize">{prize.prize_type.replaceAll("_", " ")}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black">{prize.weight}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black tabular-nums">{prize.performance?.drawsToday ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-black tabular-nums">{prize.performance?.drawsTotal ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {prize.performance?.remainingToday === null || prize.performance?.remainingToday === undefined
                      ? "Open"
                      : prize.performance.remainingToday}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {prize.performance?.remainingTotal === null || prize.performance?.remainingTotal === undefined
                      ? "Open"
                      : prize.performance.remainingTotal}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-[var(--ve-muted-strong)]">
                    {formatPrizeWindow(prize.available_from, prize.expires_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <AdminStatusBadge tone={prize.is_enabled ? "good" : "neutral"}>
                      {prize.is_enabled ? "enabled" : "disabled"}
                    </AdminStatusBadge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <form action={setPerkPrizeEnabled}>
                      <input name="bundleRewardId" type="hidden" value={reward.id} />
                      <input name="prizeId" type="hidden" value={prize.id} />
                      <input
                        name="redirectTo"
                        type="hidden"
                        value={`/admin/rewards/perks/${encodeURIComponent(reward.id)}`}
                      />
                      <input name="isEnabled" type="hidden" value={prize.is_enabled ? "false" : "true"} />
                      <button
                        className={`rounded-full px-3 py-2 text-xs font-black ${
                          prize.is_enabled
                            ? "bg-[#fff0f0] text-[#c00000]"
                            : "bg-[#eefaf4] text-[#087f5b]"
                        }`}
                        type="submit"
                      >
                        {prize.is_enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </AdminTable>
              <AdminPagination
                basePath={`/admin/rewards/perks/${reward.id}`}
                currentPage={paginatedPrizes.currentPage}
                searchParams={{
                  notice: notice || undefined,
                  drawPage: drawPage || undefined,
                }}
                summary={`Showing ${paginatedPrizes.startItem}-${paginatedPrizes.endItem} of ${paginatedPrizes.totalItems} prize outcomes`}
                totalPages={paginatedPrizes.totalPages}
              />
          </div>
        )}
      </AdminCard>

      <PerkPrizeManager
        bundleRewardId={reward.id}
        notice={noticeCopy}
        noticeCode={notice}
        focusedPrizeId={focusPrize}
        prizes={paginatedPrizes.items}
        rewardCandidates={perkRewardCandidates}
      />

      <section className="mt-6">
        <div>
          <h2 className="mb-3 text-lg font-black">Recent draws</h2>
          {perkDrawHistory.length === 0 ? (
            <EmptyAdminState>No perk draws yet.</EmptyAdminState>
          ) : (
            <>
              <AdminTable columns={["When", "User", "Won", "State"]}>
                {paginatedDrawHistory.items.map((draw) => (
                  <tr key={draw.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatRewardDate(draw.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-black">{draw.profile?.display_name ?? draw.profile?.referral_code ?? "Learner"}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{draw.profile?.id ?? draw.user_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-black">{draw.awarded_title}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)] capitalize">
                        {draw.prize_id ? draw.awarded_fulfillment_type.replaceAll("_", " ") : "Fallback"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <AdminStatusBadge tone={draw.award_status === "awarded" ? "good" : "neutral"}>
                        {draw.award_status}
                      </AdminStatusBadge>
                    </td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination
                basePath={`/admin/rewards/perks/${reward.id}`}
                currentPage={paginatedDrawHistory.currentPage}
                searchParams={{
                  notice: notice || undefined,
                  prizePage: prizePage || undefined,
                }}
                summary={`Showing ${paginatedDrawHistory.startItem}-${paginatedDrawHistory.endItem} of ${paginatedDrawHistory.totalItems} recent draws`}
                totalPages={paginatedDrawHistory.totalPages}
              />
            </>
          )}
        </div>
      </section>
    </>
  );
}
