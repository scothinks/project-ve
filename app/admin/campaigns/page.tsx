import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, requireAdmin } from "@/lib/admin";
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
  const { supabase } = await requireAdmin();
  const campaigns = await getAdminCampaigns(supabase);
  const { page, notice } = (await searchParams) ?? {};
  const paginatedCampaigns = paginateItems(campaigns, parsePageParam(page), 20);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Planning"
        title="Campaigns"
        subtitle="Group rewards and inventory by campaign, quarter, month, partner period, or budget window."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex justify-end">
        <Link
          className="rounded-[14px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white"
          href="/admin/campaigns/new"
        >
          Add Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <EmptyAdminState>No campaigns found.</EmptyAdminState>
      ) : (
        <>
        <AdminTable columns={["Campaign", "Store state", "Period", "Reporting", "Updated", "Action"]}>
          {paginatedCampaigns.items.map((campaign) => {
            const state = getCampaignState(campaign);
            const isEnabled = campaign.status === "active";

            return (
              <tr key={campaign.id}>
                <td className="min-w-[260px] px-4 py-4">
                  <Link className="font-black hover:text-[var(--ve-green)]" href={`/admin/campaigns/${campaign.id}`}>
                    {campaign.name}
                  </Link>
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{campaign.slug}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <AdminStatusBadge tone={campaignTone(state)}>{state}</AdminStatusBadge>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {formatRewardDate(campaign.starts_at)} - {campaign.ends_at ? formatRewardDate(campaign.ends_at) : "Open"}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {campaign.budget_label ?? "No reporting label"}
                </td>
                <td className="whitespace-nowrap px-4 py-4">{formatRewardDate(campaign.updated_at)}</td>
                <td className="whitespace-nowrap px-4 py-4">
                  <form action={setCampaignEnabled}>
                    <input name="campaignId" type="hidden" value={campaign.id} />
                    <input name="isEnabled" type="hidden" value={isEnabled ? "false" : "true"} />
                    <input name="redirectTo" type="hidden" value="/admin/campaigns" />
                    <button
                      className={`rounded-[12px] px-3 py-2 text-xs font-black ${
                        isEnabled
                          ? "bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] text-[var(--ve-danger)]"
                          : "bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] text-[var(--ve-green)]"
                      }`}
                      type="submit"
                    >
                      {isEnabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </AdminTable>
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
