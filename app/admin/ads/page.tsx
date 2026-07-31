import { AdminCard } from "@/components/admin/AdminPrimitives";
import { AdsShell } from "./AdsShell";
import {
  EmptyList,
  MetricCard,
  SectionTitle,
  AdminStatusBadge,
  formatDate,
  formatPercent,
  secondaryButtonClasses,
  statusTone,
} from "./components";
import { loadAdsOverviewData } from "@/features/ads/admin/data";
import type { AdsRouteProps } from "./types";

export default async function AdminAdsPage({ searchParams }: AdsRouteProps) {
  const { notice } = (await searchParams) ?? {};
  const { campaigns, flights, partners, placements, recentEvents, versions } = await loadAdsOverviewData();
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active");
  const pendingCreatives = versions.filter((version) => version.status === "submitted");
  const activePlacements = placements.filter((placement) => placement.status === "active");
  const billableEvents = recentEvents.filter((event) => event.qualification_status === "billable");
  const filteredEvents = recentEvents.filter((event) => event.qualification_status === "filtered");
  const viewableEvents = billableEvents.filter((event) => event.event_type === "viewable_impression");
  const clickEvents = billableEvents.filter((event) => event.event_type === "click");
  const ivtRate = recentEvents.length ? filteredEvents.length / recentEvents.length : 0;
  const ctr = viewableEvents.length ? clickEvents.length / viewableEvents.length : 0;
  const missingTermsPartners = partners.filter(
    (partner) => partner.status === "active" && !partner.terms_accepted_at,
  );
  const pausedEntities =
    partners.filter((item) => item.status === "paused").length +
    campaigns.filter((item) => item.status === "paused").length +
    placements.filter((item) => item.status === "paused").length +
    flights.filter((item) => item.status === "paused").length;
  const campaignItems = campaigns;

  return (
    <AdsShell activeView="overview" notice={notice}>
<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Active campaigns" tone="good" value={activeCampaigns.length} />
            <MetricCard label="Pending approvals" tone={pendingCreatives.length ? "warning" : "default"} value={pendingCreatives.length} />
            <MetricCard label="Active placements" value={`${activePlacements.length}/${placements.length || 0}`} />
            <MetricCard label="Viewable CTR" value={formatPercent(ctr)} />
            <MetricCard label="Filtered traffic" tone={ivtRate > 0.1 ? "danger" : "default"} value={formatPercent(ivtRate)} />
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            <AdminCard className="lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionTitle
                  eyebrow="Command center"
                  subtitle="Use this area to spot blockers before launching or renewing sponsor inventory."
                >
                  Today’s ad operations
                </SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <a className={secondaryButtonClasses} href="/admin/ads/launch">
                    Build campaign
                  </a>
                  <a className={secondaryButtonClasses} href="/admin/ads/inventory">
                    Review inventory
                  </a>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] bg-[var(--ve-panel)] p-4">
                  <p className="text-sm font-black">Creative review</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    {pendingCreatives.length
                      ? `${pendingCreatives.length} creative version${pendingCreatives.length === 1 ? "" : "s"} waiting for approval.`
                      : "No creative approvals waiting."}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[var(--ve-panel)] p-4">
                  <p className="text-sm font-black">Partner readiness</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    {missingTermsPartners.length
                      ? `${missingTermsPartners.length} active partner${missingTermsPartners.length === 1 ? "" : "s"} missing accepted terms.`
                      : "All active partners have accepted terms."}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[var(--ve-panel)] p-4">
                  <p className="text-sm font-black">Safety controls</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    {pausedEntities
                      ? `${pausedEntities} partner/campaign/flight record${pausedEntities === 1 ? "" : "s"} paused.`
                      : "No active kill-switch pauses."}
                  </p>
                </div>
              </div>
            </AdminCard>

            <AdminCard>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                Launch checklist
              </p>
              <div className="mt-4 space-y-3">
                {[
                  ["1", "Partner approved terms"],
                  ["2", "Campaign budget and schedule"],
                  ["3", "Creative reviewed and approved"],
                  ["4", "Placement flight configured"],
                  ["5", "Reporting snapshot ready"],
                ].map(([step, label]) => (
                  <div className="flex items-center gap-3" key={step}>
                    <span className="grid size-7 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--ve-green-soft)_76%,var(--ve-card))] text-xs font-black text-[var(--ve-green)]">
                      {step}
                    </span>
                    <span className="text-sm font-bold text-[var(--ve-muted-strong)]">{label}</span>
                  </div>
                ))}
              </div>
            </AdminCard>
          </section>
      <section className="mt-8" id="overview">
        <SectionTitle
          eyebrow="Portfolio"
          subtitle="A manager-facing readout of what is live, blocked, and billable. This replaces raw event tables as the first thing ad ops sees."
        >
          Campaign health
        </SectionTitle>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {campaignItems.slice(0, 6).map((campaign) => (
            <AdminCard key={campaign.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black">{campaign.name}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                    {campaign.campaign_type} · {campaign.pricing_model}
                  </p>
                </div>
                <AdminStatusBadge tone={statusTone(campaign.status)}>{campaign.status}</AdminStatusBadge>
              </div>
              <div className="mt-4 grid gap-3 text-xs font-bold text-[var(--ve-muted-strong)]">
                <p>Schedule: {formatDate(campaign.starts_at)} → {formatDate(campaign.ends_at)}</p>
                <p>Priority: {campaign.priority}</p>
              </div>
            </AdminCard>
          ))}
          {!campaignItems.length ? <EmptyList>No campaigns yet. Start with Launch Studio.</EmptyList> : null}
        </div>
      </section>
    </AdsShell>
  );
}
