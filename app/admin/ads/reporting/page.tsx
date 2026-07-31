import { AdminCard } from "@/components/admin/AdminPrimitives";
import { AdsShell } from "../AdsShell";
import {
  AdminStatusBadge,
  EmptyList,
  Field,
  SectionTitle,
  formatDate,
  formatMoneyMinor,
  formatPercent,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
  statusTone,
} from "../components";
import { createAdMakeGoodRecommendations, purgeOldAdRuntimeData, refreshAdBillingSnapshot } from "../actions";
import { loadAdsReportingData } from "@/features/ads/admin/data";
import type { AdsRouteProps } from "../types";

export default async function AdminAdsReportingPage({ searchParams }: AdsRouteProps) {
  const { notice } = (await searchParams) ?? {};
  const { auditEvents, billingSnapshots, campaigns, houseFallbackEvents, makeGoods, recentEvents, sponsorInquiries } = await loadAdsReportingData();
  const eventItems = recentEvents;
  const billableEvents = eventItems.filter((event) => event.qualification_status === "billable");
  const filteredEvents = eventItems.filter((event) => event.qualification_status === "filtered");
  const viewableEvents = billableEvents.filter((event) => event.event_type === "viewable_impression");
  const clickEvents = billableEvents.filter((event) => event.event_type === "click");
  const houseFallbackViewableEvents = houseFallbackEvents.filter((event) => event.event_type === "viewable_impression");
  const houseFallbackClickEvents = houseFallbackEvents.filter((event) => event.event_type === "click");
  const houseFallbackCtr = houseFallbackViewableEvents.length
    ? houseFallbackClickEvents.length / houseFallbackViewableEvents.length
    : 0;
  const campaignItems = campaigns;
  const snapshotItems = billingSnapshots;
  const sponsorInquiryItems = sponsorInquiries;
  const makeGoodItems = makeGoods;
  const auditItems = auditEvents;

  return (
    <AdsShell activeView="reporting" notice={notice}>
<section className="mt-8" id="reporting">
        <SectionTitle
          eyebrow="Reporting"
          subtitle="Manager-level billing and traffic-quality controls, with operational jobs kept explicit and auditable."
        >
          Delivery, billing, and quality
        </SectionTitle>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <AdminCard>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Recent events</p>
                <p className="mt-2 text-2xl font-black">{eventItems.length}</p>
              </div>
              <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Viewable</p>
                <p className="mt-2 text-2xl font-black">{viewableEvents.length}</p>
              </div>
              <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Clicks</p>
                <p className="mt-2 text-2xl font-black">{clickEvents.length}</p>
              </div>
              <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Filtered</p>
                <p className="mt-2 text-2xl font-black">{filteredEvents.length}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Fallback views</p>
                <p className="mt-2 text-2xl font-black">{houseFallbackViewableEvents.length}</p>
              </div>
              <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Fallback clicks</p>
                <p className="mt-2 text-2xl font-black">{houseFallbackClickEvents.length}</p>
              </div>
              <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Fallback CTR</p>
                <p className="mt-2 text-2xl font-black">{formatPercent(houseFallbackCtr)}</p>
              </div>
            </div>
            <form action={refreshAdBillingSnapshot} className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Campaign">
                <select className={inputClasses} name="campaignId" required>
                  <option value="">Select campaign</option>
                  {campaignItems.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Period start">
                <input className={inputClasses} name="periodStart" type="datetime-local" required />
              </Field>
              <Field label="Period end">
                <input className={inputClasses} name="periodEnd" type="datetime-local" required />
              </Field>
              <div className="flex items-end">
                <button className={primaryButtonClasses} type="submit">
                  Refresh billing snapshot
                </button>
              </div>
            </form>
          </AdminCard>

          <AdminCard>
            <h3 className="text-lg font-black">Ops jobs</h3>
            <div className="mt-4 space-y-3">
              <form action={createAdMakeGoodRecommendations} className="rounded-[18px] border border-[var(--ve-line-soft)] p-4">
                <p className="text-sm font-black">Make-good recommendations</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Checks completed campaigns for under-delivery and creates draft recommendations.
                </p>
                <button className={secondaryButtonClasses} type="submit">
                  Recommend make-goods
                </button>
              </form>
              <form action={purgeOldAdRuntimeData} className="rounded-[18px] border border-[var(--ve-line-soft)] p-4">
                <p className="text-sm font-black">Retention cleanup</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Aggregates eligible raw events, then purges expired runtime data.
                </p>
                <button className={secondaryButtonClasses} type="submit">
                  Run retention cleanup
                </button>
              </form>
            </div>
          </AdminCard>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <AdminCard>
            <h3 className="mb-3 text-lg font-black">Latest billing snapshots</h3>
            {snapshotItems.length ? (
              <div className="space-y-3">
                {snapshotItems.map((snapshot) => (
                  <div className="rounded-[16px] bg-[var(--ve-panel)] p-4" key={snapshot.id}>
                    <p className="font-black">{snapshot.campaign_id}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      {formatDate(snapshot.period_start)} → {formatDate(snapshot.period_end)}
                    </p>
                    <p className="mt-2 text-sm font-bold">
                      {snapshot.billable_viewable_impressions} viewable · {snapshot.billable_clicks} clicks · spend {formatMoneyMinor(snapshot.billable_spend)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyList>No billing snapshots yet.</EmptyList>
            )}
          </AdminCard>

          <AdminCard>
            <h3 className="mb-3 text-lg font-black">Sponsor inquiries</h3>
            <div className="space-y-3">
              {sponsorInquiryItems.length ? sponsorInquiryItems.map((inquiry) => (
                <div className="rounded-[16px] bg-[var(--ve-panel)] p-4" key={inquiry.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{inquiry.organization_name}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                        {inquiry.contact_name} · {inquiry.email}
                      </p>
                    </div>
                    <AdminStatusBadge tone={statusTone(inquiry.status)}>{inquiry.status}</AdminStatusBadge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
                    {inquiry.campaign_goal}
                  </p>
                </div>
              )) : <EmptyList>No sponsor inquiries yet.</EmptyList>}
            </div>
          </AdminCard>

          <AdminCard>
            <h3 className="mb-3 text-lg font-black">Make-goods and audit trail</h3>
            <div className="grid gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Make-goods</p>
                <div className="mt-2 space-y-2">
                  {makeGoodItems.length ? makeGoodItems.map((makeGood) => (
                    <p className="rounded-[14px] bg-[var(--ve-panel)] p-3 text-xs font-bold" key={makeGood.id}>
                      {makeGood.campaign_id}: {makeGood.status} · {makeGood.owed_impressions} impressions · {makeGood.owed_clicks} clicks
                    </p>
                  )) : <p className="text-sm font-semibold text-[var(--ve-muted)]">No make-goods yet.</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Audit log</p>
                <div className="mt-2 space-y-2">
                  {auditItems.length ? auditItems.map((event) => (
                    <p className="rounded-[14px] bg-[var(--ve-panel)] p-3 text-xs font-bold" key={event.id}>
                      {event.event_type} · {event.entity_type}/{event.entity_id}
                    </p>
                  )) : <p className="text-sm font-semibold text-[var(--ve-muted)]">No audit events yet.</p>}
                </div>
              </div>
            </div>
          </AdminCard>
        </div>
      </section>
    </AdsShell>
  );
}
