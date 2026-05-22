import Link from "next/link";
import { CampaignFilterSelect } from "@/components/admin/CampaignFilterSelect";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminRewards, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";
import { toggleRewardEnabled } from "./[id]/actions";

function statusTone(status: string, enabled: boolean) {
  if (!enabled) return "danger" as const;
  if (status === "published") return "good" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function getStorefrontState(reward: {
  status: string;
  is_enabled: boolean;
  visibility_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  offer_expires_at: string | null;
  total_available: number;
  campaign?: { status: string; starts_at: string | null; ends_at: string | null } | null;
}) {
  const now = Date.now();
  const rewardStartsAt = reward.starts_at ? new Date(reward.starts_at).getTime() : null;
  const rewardEndsAt = reward.ends_at ? new Date(reward.ends_at).getTime() : null;
  const offerEndsAt = reward.offer_expires_at ? new Date(reward.offer_expires_at).getTime() : null;
  const campaignStartsAt = reward.campaign?.starts_at ? new Date(reward.campaign.starts_at).getTime() : null;
  const campaignEndsAt = reward.campaign?.ends_at ? new Date(reward.campaign.ends_at).getTime() : null;

  if (reward.status !== "published" || !reward.is_enabled) {
    return "disabled";
  }

  if (reward.visibility_mode === "hidden") {
    return "hidden";
  }

  if (reward.visibility_mode === "system_only") {
    return "system only";
  }

  if (reward.visibility_mode === "campaign_only") {
    return "campaign only";
  }

  if (!reward.campaign || reward.campaign.status !== "active") {
    return "campaign off";
  }

  if ((campaignStartsAt && campaignStartsAt > now) || (rewardStartsAt && rewardStartsAt > now)) {
    return "scheduled";
  }

  if (
    (campaignEndsAt && campaignEndsAt <= now)
    || (rewardEndsAt && rewardEndsAt <= now)
    || (offerEndsAt && offerEndsAt <= now)
  ) {
    return "ended";
  }

  if (reward.total_available <= 0) {
    return "sold out";
  }

  return "live";
}

function storefrontTone(state: string) {
  if (state === "live") return "good" as const;
  if (state === "scheduled") return "warning" as const;
  if (state === "sold out") return "warning" as const;
  if (
    state === "campaign off"
    || state === "disabled"
    || state === "ended"
    || state === "hidden"
    || state === "system only"
    || state === "campaign only"
  ) return "neutral" as const;
  return "neutral" as const;
}

function formatRewardLimit(limitPeriod: string, perUserLimit: number) {
  if (limitPeriod === "none") {
    return "No per-user limit";
  }

  return `${perUserLimit} per ${limitPeriod}`;
}

function formatVisibilityMode(mode: string) {
  if (mode === "store") return "Store";
  if (mode === "system_only") return "System only";
  if (mode === "campaign_only") return "Campaign only";
  return "Hidden";
}

type AdminRewardsPageProps = {
  searchParams: Promise<{ campaign?: string; page?: string; notice?: string }>;
};

export default async function AdminRewardsPage({ searchParams }: AdminRewardsPageProps) {
  const { campaign, page, notice } = await searchParams;
  const { supabase } = await requireAdmin();
  const [rewards, campaigns] = await Promise.all([
    getAdminRewards(supabase, { campaignId: campaign, distributionMode: "direct" }),
    getAdminCampaigns(supabase),
  ]);
  const paginatedRewards = paginateItems(rewards, parsePageParam(page), 20);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="XP Store"
        title="Rewards"
        subtitle="Create rewards, update offers, and quickly enable or disable items in the XP Store."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <CampaignFilterSelect campaigns={campaigns} value={campaign} />
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[#f3ecff] px-5 text-sm font-black text-[#6c3cc2]"
            href="/admin/rewards/perks"
          >
            Manage Perks
          </Link>
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[var(--ve-panel)] px-5 text-sm font-black text-[#5f5f5a]"
            href="/admin/inventory/reallocate"
          >
            Reallocate
          </Link>
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[#fff8df] px-5 text-sm font-black text-[#a66d00]"
            href="/admin/inventory/new"
          >
            Add Inventory
          </Link>
          <Link
            className="inline-flex h-12 min-w-36 items-center justify-center rounded-[14px] bg-[#087f5b] px-5 text-sm font-black text-white"
            href="/admin/rewards/new"
          >
            Add Reward
          </Link>
        </div>
      </div>
      {rewards.length === 0 ? (
        <EmptyAdminState>No rewards found.</EmptyAdminState>
      ) : (
        <>
        <AdminTable
          columns={["Reward", "Campaign", "Cost", "Fulfillment", "Visibility", "Inventory", "Limit", "Offer ends", "Storefront", "Status", "Action"]}
        >
          {paginatedRewards.items.map((reward) => (
            <tr key={reward.id}>
              {(() => {
                const storefrontState = getStorefrontState(reward);

                return (
                  <>
              <td className="min-w-[220px] px-4 py-4">
                <Link className="font-black hover:text-[#087f5b]" href={`/admin/rewards/${reward.id}`}>
                  {reward.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {reward.description}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                {reward.campaign?.name ?? "No campaign"}
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">
                {formatXpLabel(reward.cost_xp)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 capitalize">
                {reward.fulfillment_type.replaceAll("_", " ")}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                {formatVisibilityMode(reward.visibility_mode)}
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">
                {reward.total_available}/{reward.total_uploaded}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                {formatRewardLimit(reward.limit_period, reward.per_user_limit)}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                {formatRewardDate(reward.offer_expires_at)}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={storefrontTone(storefrontState)}>
                  {storefrontState}
                </AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={statusTone(reward.status, reward.is_enabled)}>
                  {reward.is_enabled ? reward.status : "disabled"}
                </AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
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
                        ? "bg-[#fff0f0] text-[#c00000]"
                        : "bg-[#e4f4ed] text-[#087f5b]"
                    }`}
                    type="submit"
                  >
                    {reward.is_enabled ? "Disable" : "Enable"}
                  </button>
                </form>
              </td>
                  </>
                );
              })()}
            </tr>
          ))}
        </AdminTable>
        <AdminPagination
          basePath="/admin/rewards"
          currentPage={paginatedRewards.currentPage}
          searchParams={{ campaign: campaign || undefined }}
          summary={`Showing ${paginatedRewards.startItem}-${paginatedRewards.endItem} of ${paginatedRewards.totalItems} rewards`}
          totalPages={paginatedRewards.totalPages}
        />
        </>
      )}
    </>
  );
}
