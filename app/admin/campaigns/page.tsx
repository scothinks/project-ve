import { EconomyPageHeader as AdminPageHeader } from "@/components/admin/economy/EconomyPrimitives";
import { EconomyCard } from "@/components/admin/economy/EconomyPrimitives";
import { availabilityLabel } from "@/features/reward-economy/vocabulary";
import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns } from "@/lib/admin";
import { requirePlatformRewardCampaignManager } from "@/features/campaigns/admin/access";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { setCampaignEnabled } from "./actions";

function getCampaignState(campaign: {
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}) {
  const now = Date.now();
  const startsAt = campaign.starts_at ? new Date(campaign.starts_at).getTime() : null;
  const endsAt = campaign.ends_at ? new Date(campaign.ends_at).getTime() : null;

  if (campaign.status !== "active") {
    return "disabled";
  }

  if (startsAt && startsAt > now) {
    return "scheduled";
  }

  if (endsAt && endsAt <= now) {
    return "ended";
  }

  return "live";
}

function campaignTone(state: string) {
  if (state === "live") return "good" as const;
  if (state === "scheduled") return "warning" as const;
  if (state === "disabled") return "neutral" as const;
  return "neutral" as const;
}

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; notice?: string }>;
}) {
  const { supabase } = await requirePlatformRewardCampaignManager();
  const campaigns = await getAdminCampaigns(supabase);
  const { page, notice } = (await searchParams) ?? {};
  const paginatedCampaigns = paginateItems(campaigns, parsePageParam(page), 20);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/economy"
        backLabel="Reward economy"
        eyebrow="Planning"
        title="Campaigns"
        subtitle="Group rewards and inventory by campaign, quarter, month, partner period, or budget window."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex justify-end">
        <Link
          className="rounded-[14px] bg-[var(--ui-action)] px-4 py-3 text-sm font-black text-[var(--ui-on-action)]"
          href="/admin/campaigns/new"
        >
          Add Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <EmptyAdminState>No campaigns found.</EmptyAdminState>
      ) : (
        <>
        <div className="grid gap-4 xl:grid-cols-2">{paginatedCampaigns.items.map(campaign => {
          const state = getCampaignState(campaign); const isEnabled = campaign.status === "active";
          return <EconomyCard key={campaign.id} title={campaign.name} href={`/admin/campaigns/${campaign.id}`} eyebrow={<AdminStatusBadge tone={campaignTone(state)}>{state}</AdminStatusBadge>} actions={<><Link className="px-3 py-2 font-semibold" href={`/admin/campaigns/${campaign.id}`}>View campaign →</Link><Link className="px-3 py-2 font-semibold" href={`/admin/inventory/new?campaignId=${campaign.id}`}>Add stock</Link><form action={setCampaignEnabled}>
                    <input name="campaignId" type="hidden" value={campaign.id} />
                    <input name="isEnabled" type="hidden" value={isEnabled ? "false" : "true"} />
                    <input name="redirectTo" type="hidden" value="/admin/campaigns" />
                    <button
                      className={`rounded-[12px] px-3 py-2 text-xs font-black ${
                        isEnabled
                          ? "bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] text-[var(--ui-danger)]"
                          : "bg-[color:color-mix(in_srgb,var(--ui-action-soft)_78%,var(--ui-surface))] text-[var(--ui-action)]"
                      }`}
                      type="submit"
                    >
                      {isEnabled ? "Disable" : "Enable"}
                    </button>
                  </form></>}>
            <p>{campaign.description || "No campaign description yet."}</p><p>{availabilityLabel(campaign.starts_at, campaign.ends_at)}</p><p className="font-semibold text-[var(--ui-text)]">{campaign.budget_label ?? "No reporting label"}</p><details><summary className="cursor-pointer">Campaign details</summary><p>{campaign.slug} · Updated {formatRewardDate(campaign.updated_at)}</p></details>
          </EconomyCard>;
        })}</div>
        <AdminPagination
          basePath="/admin/campaigns"
          currentPage={paginatedCampaigns.currentPage}
          summary={`Showing ${paginatedCampaigns.startItem}-${paginatedCampaigns.endItem} of ${paginatedCampaigns.totalItems} campaigns`}
          totalPages={paginatedCampaigns.totalPages}
        />
        </>
      )}
    </>
  );
}
