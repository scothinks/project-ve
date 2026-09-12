import { EconomyPageHeader as AdminPageHeader } from "@/components/admin/economy/EconomyPrimitives";
import { EconomyCard, StorefrontChecklist } from "@/components/admin/economy/EconomyPrimitives";
import { storefrontChecklist, rewardLimit } from "@/features/reward-economy/vocabulary";
import Link from "next/link";
import { CampaignFilterSelect } from "@/components/admin/CampaignFilterSelect";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminRewards, requireAdminWorkspaceRole } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";
import { toggleRewardEnabled } from "./[id]/actions";

function formatVisibilityMode(mode: string) {
  if (mode === "store") return "Store";
  if (mode === "system_only") return "System only";
  if (mode === "campaign_only") return "Campaign only";
  return "Hidden";
}

function formatOwnerScope(reward: { owner_scope: string; shared_with_programmes: boolean }) {
  if (reward.owner_scope === "platform_owned") {
    return reward.shared_with_programmes ? "Shared platform" : "Platform";
  }

  if (reward.owner_scope === "organization_owned") {
    return "Organisation";
  }

  if (reward.owner_scope === "programme_sponsored") {
    return "Programme";
  }

  return reward.owner_scope.replaceAll("_", " ");
}

type AdminRewardsPageProps = {
  searchParams: Promise<{ campaign?: string; page?: string; notice?: string; q?: string; state?: string }>;
};

export default async function AdminRewardsPage({ searchParams }: AdminRewardsPageProps) {
  const { campaign, page, notice, q = "", state = "" } = await searchParams;
  const { supabase } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
  ]);
  const [rewards, campaigns] = await Promise.all([
    getAdminRewards(supabase, { campaignId: campaign, distributionMode: "direct" }),
    getAdminCampaigns(supabase),
  ]);
  const paginatedRewards = paginateItems(rewards.filter(reward => (!q || reward.title.toLowerCase().includes(q.toLowerCase())) && (!state || storefrontChecklist(reward).state === state)), parsePageParam(page), 20);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/economy"
        backLabel="Reward economy"
        eyebrow="XP Store"
        title="Rewards"
        subtitle="Create rewards, update offers, and quickly enable or disable items in the XP Store."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <CampaignFilterSelect campaigns={campaigns} value={campaign} />
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--ui-action-soft)_82%,var(--ui-surface))] px-5 text-sm font-black text-[var(--ui-on-action-soft)]"
            href="/admin/rewards/perks"
          >
            Manage Perks
          </Link>
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[var(--ui-surface-inset)] px-5 text-sm font-black text-[var(--ui-text-muted)]"
            href="/admin/inventory/reallocate"
          >
            Reallocate
          </Link>
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[color:color-mix(in_srgb,var(--ui-action-soft)_82%,var(--ui-surface))] px-5 text-sm font-black text-[var(--ui-on-action-soft)]"
            href="/admin/inventory/new"
          >
            Add Inventory
          </Link>
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[var(--ui-action)] px-5 text-sm font-black text-[var(--ui-on-action)]"
            href="/admin/rewards/new"
          >
            Add Reward
          </Link>
        </div>
      </div>
      <form className="mb-5 flex flex-wrap gap-3"><input type="hidden" name="campaign" value={campaign ?? ""} /><input aria-label="Find a reward" className="min-w-0 rounded-xl border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2" defaultValue={q} name="q" placeholder="Find a reward" type="search" /><select aria-label="Store visibility" className="rounded-xl border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2" defaultValue={state} name="state"><option value="">All visibility states</option>{["live", "disabled", "hidden", "system only", "campaign only", "campaign off", "scheduled", "ended", "sold out"].map(value => <option key={value} value={value}>{value}</option>)}</select><button className="rounded-xl bg-[var(--ui-action)] px-4 py-2 font-semibold text-[var(--ui-on-action)]" type="submit">Apply</button></form>
      {paginatedRewards.totalItems === 0 ? (
        <EmptyAdminState>No rewards found.</EmptyAdminState>
      ) : (
        <>
        <div className="grid gap-4 xl:grid-cols-2">
          {paginatedRewards.items.map((reward) => <EconomyCard key={reward.id} title={reward.title} href={`/admin/rewards/${reward.id}`} eyebrow={<><AdminStatusBadge tone={storefrontChecklist(reward).state === "live" ? "good" : "neutral"}>{storefrontChecklist(reward).state}</AdminStatusBadge><span>{reward.campaign?.name ?? "No campaign"}</span></>} actions={<>
            <Link className="rounded-xl bg-[var(--ui-surface-inset)] px-3 py-2 font-semibold" href={`/admin/rewards/${reward.id}`}>Manage reward →</Link>
            <Link className="px-3 py-2 font-semibold" href={`/admin/inventory/new?rewardId=${reward.id}&campaignId=${reward.campaign_id ?? ""}`}>Add stock</Link>
            <form action={toggleRewardEnabled}>
                  <input name="rewardId" type="hidden" value={reward.id} />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={campaign ? `/admin/rewards?campaign=${encodeURIComponent(campaign)}` : "/admin/rewards"}
                  />
                  <input
                    name="isEnabled"
                    type="hidden"
                    value={reward.is_enabled ? "false" : "true"}
                  />
                  <button
                    className={`rounded-[12px] px-3 py-2 text-xs font-black ${
                      reward.is_enabled
                        ? "bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] text-[var(--ui-danger)]"
                        : "bg-[color:color-mix(in_srgb,var(--ui-action-soft)_78%,var(--ui-surface))] text-[var(--ui-action)]"
                    }`}
                    type="submit"
                  >
                    {reward.is_enabled ? "Disable" : "Enable"}
                  </button>
                </form>
          </>}>
            <p>{reward.description}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[var(--ui-text)]"><span className="font-semibold">{formatXpLabel(reward.cost_xp)}</span><span>{reward.total_available} available · {reward.total_uploaded} uploaded</span></div>
            <p>{reward.fulfillment_type.replaceAll("_", " ")} · {rewardLimit(reward.limit_period, reward.per_user_limit)}</p>
            <StorefrontChecklist reward={reward} />
            <details><summary className="cursor-pointer font-semibold">Terms & ownership</summary>{reward.terms ? <p className="mt-3 whitespace-pre-wrap">{reward.terms}</p> : null}<dl className="mt-3 grid grid-cols-2 gap-3"><div><dt>Owner</dt><dd>{formatOwnerScope(reward)}</dd></div><div><dt>Distribution</dt><dd>{formatVisibilityMode(reward.visibility_mode)}</dd></div><div><dt>Offer ends</dt><dd>{formatRewardDate(reward.offer_expires_at)}</dd></div><div><dt>Claim window</dt><dd>{reward.redemption_window_days ? `${reward.redemption_window_days} days after purchase` : "No claim deadline"}</dd></div><div><dt>Editorial status</dt><dd>{reward.status} · {reward.is_enabled ? "enabled" : "disabled"}</dd></div></dl></details>
          </EconomyCard>)}
        </div>
        <AdminPagination
          basePath="/admin/rewards"
          currentPage={paginatedRewards.currentPage}
          searchParams={{ campaign: campaign || undefined, q: q || undefined, state: state || undefined }}
          summary={`Showing ${paginatedRewards.startItem}-${paginatedRewards.endItem} of ${paginatedRewards.totalItems} rewards`}
          totalPages={paginatedRewards.totalPages}
        />
        </>
      )}
    </>
  );
}
