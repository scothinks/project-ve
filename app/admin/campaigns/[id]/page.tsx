import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
} from "@/components/admin/AdminPrimitives";
import { CampaignForm } from "@/components/admin/CampaignForm";
import { getAdminCampaign, getAdminCampaignAnalytics, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatXpLabel } from "@/lib/xp-format";

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rewardsPage?: string; notice?: string }>;
};

export default async function CampaignDetailPage({ params, searchParams }: CampaignDetailPageProps) {
  const { id } = await params;
  const { rewardsPage, notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [campaign, analytics] = await Promise.all([
    getAdminCampaign(supabase, id),
    getAdminCampaignAnalytics(supabase, id),
  ]);

  if (!campaign) {
    notFound();
  }

  const paginatedRewards = paginateItems(analytics.rewardMetrics, parsePageParam(rewardsPage), 12);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/campaigns"
        backLabel="Campaigns"
        eyebrow="Planning"
        title={campaign.name}
        subtitle="Edit campaign timing and reporting context. Launch controls live on the campaign list."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <AdminCard>
        <CampaignForm campaign={campaign} />
      </AdminCard>

      <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <AdminStatCard label="Rewards" value={`${analytics.enabledRewards}/${analytics.totalRewards}`} />
        <AdminStatCard label="Inventory Available" value={analytics.totalInventoryAvailable.toLocaleString()} />
        <AdminStatCard label="Redemptions" value={analytics.redemptionsRequested.toLocaleString()} />
        <AdminStatCard label="XP Spent" value={formatXpLabel(analytics.xpSpent)} tone="store" />
        <AdminStatCard label="Fulfilled" value={analytics.redemptionsFulfilled.toLocaleString()} />
        <AdminStatCard label="Refunded" value={analytics.redemptionsRefunded.toLocaleString()} tone="risk" />
        <AdminStatCard label="Manual Pending" value={analytics.pendingManualSubmissions.toLocaleString()} tone="warning" />
        <AdminStatCard label="Moved In / Out" value={`${analytics.reallocatedIn}/${analytics.reallocatedOut}`} />
      </section>

      <section className="mt-6">
        <AdminTable
          columns={["Reward", "Type", "Cost", "Inventory", "Purchases", "Fulfilled", "Refunded", "XP Spent"]}
        >
          {paginatedRewards.items.map((reward) => (
            <tr key={reward.rewardId}>
              <td className="min-w-[220px] px-4 py-4 font-black">{reward.title}</td>
              <td className="whitespace-nowrap px-4 py-4 capitalize">
                {reward.fulfillmentType.replaceAll("_", " ")}
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-bold">{formatXpLabel(reward.costXp)}</td>
              <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">
                {reward.totalAvailable}/{reward.totalUploaded}
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">{reward.purchases}</td>
              <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">{reward.fulfilled}</td>
              <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">{reward.refunded}</td>
              <td className="whitespace-nowrap px-4 py-4 font-bold">{formatXpLabel(reward.xpSpent)}</td>
            </tr>
          ))}
        </AdminTable>
        <AdminPagination
          basePath={`/admin/campaigns/${campaign.id}`}
          currentPage={paginatedRewards.currentPage}
          searchParams={{ rewardsPage: undefined }}
          summary={`Showing ${paginatedRewards.startItem}-${paginatedRewards.endItem} of ${paginatedRewards.totalItems} campaign rewards`}
          totalPages={paginatedRewards.totalPages}
        />
      </section>
    </>
  );
}
