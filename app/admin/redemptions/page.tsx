import Link from "next/link";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminRedemptions, getAdminRewards, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";
import { fulfillRedemption, refundRedemption } from "./actions";

function claimTone(claimState: string) {
  if (claimState === "fulfilled") return "good" as const;
  if (claimState === "details_submitted" || claimState === "purchased") return "warning" as const;
  if (claimState === "refunded" || claimState === "cancelled" || claimState === "expired") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function renderClaimData(claimData: Record<string, unknown> | null) {
  if (!claimData) {
    return <p className="text-xs font-semibold text-[var(--ve-muted)]">No submitted details yet.</p>;
  }

  const entries = Object.entries(claimData);

  if (entries.length === 0) {
    return <p className="text-xs font-semibold text-[var(--ve-muted)]">No submitted details yet.</p>;
  }

  return (
    <dl className="grid gap-2 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-2" key={key}>
          <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
            {key}
          </dt>
          <dd className="mt-1 break-words text-xs font-bold">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

type AdminRedemptionsPageProps = {
  searchParams?: Promise<{
    claimState?: string;
    fulfillmentType?: string;
    campaignId?: string;
    rewardId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    notice?: string;
  }>;
};

function fieldClasses() {
  return "h-11 rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-sm font-semibold outline-none focus:border-[var(--ve-green)]";
}

export default async function AdminRedemptionsPage({ searchParams }: AdminRedemptionsPageProps) {
  const params = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [redemptions, campaigns, rewards] = await Promise.all([
    getAdminRedemptions(supabase, params),
    getAdminCampaigns(supabase),
    getAdminRewards(supabase),
  ]);
  const exportHref = `/admin/redemptions/export?${new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString()}`;
  const paginatedRedemptions = paginateItems(redemptions, parsePageParam(params.page), 12);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards"
        backLabel="Rewards"
        eyebrow="XP Store"
        title="Redemptions"
        subtitle="Review reward purchases, submitted fulfillment details, and refund eligible pending rewards."
      />
      {params.notice ? <AdminNoticeBanner>{params.notice}</AdminNoticeBanner> : null}
      <form className="mb-4 grid gap-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 md:grid-cols-3 xl:grid-cols-6">
        <select className={fieldClasses()} name="claimState" defaultValue={params.claimState ?? ""}>
          <option value="">All states</option>
          <option value="purchased">Purchased</option>
          <option value="details_submitted">Details submitted</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
        <select className={fieldClasses()} name="fulfillmentType" defaultValue={params.fulfillmentType ?? ""}>
          <option value="">All fulfillment</option>
          <option value="manual">Manual</option>
          <option value="voucher_code">Voucher</option>
          <option value="qr_code">QR</option>
          <option value="external_link">External link</option>
          <option value="native">Native</option>
        </select>
        <select className={fieldClasses()} name="campaignId" defaultValue={params.campaignId ?? ""}>
          <option value="">All campaigns</option>
          <option value="none">No campaign</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
          ))}
        </select>
        <select className={fieldClasses()} name="rewardId" defaultValue={params.rewardId ?? ""}>
          <option value="">All rewards</option>
          {rewards.map((reward) => (
            <option key={reward.id} value={reward.id}>{reward.title}</option>
          ))}
        </select>
        <input className={fieldClasses()} name="dateFrom" type="date" defaultValue={params.dateFrom ?? ""} />
        <input className={fieldClasses()} name="dateTo" type="date" defaultValue={params.dateTo ?? ""} />
        <div className="flex gap-2 md:col-span-3 xl:col-span-6">
          <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white" type="submit">
            Apply filters
          </button>
          <Link className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] px-4 py-2 text-xs font-black text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]" href={exportHref}>
            Export CSV
          </Link>
        </div>
      </form>
      {redemptions.length === 0 ? (
        <EmptyAdminState>No redemptions found.</EmptyAdminState>
      ) : (
        <>
        <section className="space-y-4">
          {paginatedRedemptions.items.map((redemption) => {
            const canRefund =
              !redemption.fulfilled_at &&
              redemption.claim_state !== "refunded" &&
              redemption.claim_state !== "cancelled";

            return (
              <AdminCard key={redemption.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black">
                          {redemption.reward_title_snapshot ?? redemption.reward_id}
                        </h2>
                        <AdminStatusBadge tone={claimTone(redemption.claim_state)}>
                          {redemption.claim_state.replaceAll("_", " ")}
                        </AdminStatusBadge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[var(--ve-muted-strong)]">
                        {redemption.profile?.display_name ?? "Unknown user"} ·{" "}
                        {formatXpLabel(redemption.xp_cost_at_redemption ?? 0)} ·{" "}
                        {formatRewardDate(redemption.requested_at)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
                        {redemption.fulfillment_type?.replaceAll("_", " ") ?? "unknown fulfillment"}
                        {redemption.redemption_expires_at
                          ? ` · Redeem by ${formatRewardDate(redemption.redemption_expires_at)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                        View details
                      </span>
                      <span className="grid size-10 place-items-center rounded-full bg-[var(--ve-panel)] text-lg font-black text-[var(--ve-muted-strong)] transition group-open:rotate-180">
                        ˅
                      </span>
                    </div>
                  </summary>

                  <div className="mt-4 border-t border-[var(--ve-line-soft)] pt-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                      <div>
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                          Submitted details
                        </p>
                        {renderClaimData(redemption.claim_data)}
                      </div>

                      <div className="grid h-fit gap-2">
                        {redemption.claim_state !== "fulfilled" && redemption.claim_state !== "refunded" ? (
                          <form action={fulfillRedemption} className="space-y-2">
                            <input name="redemptionId" type="hidden" value={redemption.id} />
                            <input
                              className="w-full rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-2 text-xs font-semibold outline-none"
                              maxLength={500}
                              name="note"
                              placeholder="Fulfillment note"
                            />
                            <button
                              className="w-full rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-green)]"
                              type="submit"
                            >
                              Mark fulfilled
                            </button>
                          </form>
                        ) : null}

                        {canRefund ? (
                          <form action={refundRedemption} className="space-y-2">
                            <input name="redemptionId" type="hidden" value={redemption.id} />
                            <input
                              className="w-full rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-2 text-xs font-semibold outline-none"
                              maxLength={500}
                              name="reason"
                              placeholder="Refund reason"
                            />
                            <button
                              className="w-full rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)]"
                              type="submit"
                            >
                              Refund XP
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </details>
              </AdminCard>
            );
          })}
        </section>
        <AdminPagination
          basePath="/admin/redemptions"
          currentPage={paginatedRedemptions.currentPage}
          searchParams={{
            claimState: params.claimState || undefined,
            fulfillmentType: params.fulfillmentType || undefined,
            campaignId: params.campaignId || undefined,
            rewardId: params.rewardId || undefined,
            dateFrom: params.dateFrom || undefined,
            dateTo: params.dateTo || undefined,
          }}
          summary={`Showing ${paginatedRedemptions.startItem}-${paginatedRedemptions.endItem} of ${paginatedRedemptions.totalItems} redemptions`}
          totalPages={paginatedRedemptions.totalPages}
        />
        </>
      )}
    </>
  );
}
