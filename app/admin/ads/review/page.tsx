import { AdminCard } from "@/components/admin/AdminPrimitives";
import { AdsShell } from "../AdsShell";
import { AdminStatusBadge, EmptyList, SectionTitle, StatusForm, statusTone } from "../components";
import { loadAdsReviewData } from "../data";
import type { AdsRouteProps } from "../types";

export default async function AdminAdsReviewPage({ searchParams }: AdsRouteProps) {
  const { notice } = (await searchParams) ?? {};
  const { campaigns, flights, partners, placements, versions } = await loadAdsReviewData();
  const partnerItems = partners;
  const campaignItems = campaigns;
  const versionItems = versions;
  const placementItems = placements;
  const flightItems = flights;

  return (
    <AdsShell activeView="review" notice={notice}>
<section className="mt-8" id="review">
        <SectionTitle
          eyebrow="Review queue"
          subtitle="Approve, reject, pause, or archive ads with explicit audit context. This is the operational safety layer."
        >
          Approvals and kill switches
        </SectionTitle>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <AdminCard>
            <h3 className="text-lg font-black">Creative approvals</h3>
            <div className="mt-4 space-y-3">
              {versionItems.length ? versionItems.map((version) => (
                <div className="rounded-[18px] border border-[var(--ve-line-soft)] p-4" key={version.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{version.headline ?? "Untitled creative"}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                        {version.sponsor_label} · version {version.version_number} · {version.disclosure_label}
                      </p>
                    </div>
                    <AdminStatusBadge tone={statusTone(version.status)}>{version.status}</AdminStatusBadge>
                  </div>
                  <div className="mt-4">
                    <StatusForm entityId={version.id} entityType="creative_version" />
                  </div>
                </div>
              )) : <EmptyList>No creative versions yet.</EmptyList>}
            </div>
          </AdminCard>

          <AdminCard>
            <h3 className="text-lg font-black">Emergency controls</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Pause an entire sponsor, campaign, placement, or flight when there is a brand issue, broken redirect, or delivery concern.
            </p>
            <div className="mt-4 space-y-3">
              {[
                ...partnerItems.map((item) => ({ id: item.id, label: item.name, meta: "Partner", status: item.status, type: "partner" })),
                ...campaignItems.map((item) => ({ id: item.id, label: item.name, meta: "Campaign", status: item.status, type: "campaign" })),
                ...placementItems.map((item) => ({ id: item.key, label: item.name, meta: "Placement", status: item.status, type: "placement" })),
                ...flightItems.map((item) => ({ id: item.id, label: item.placement_key, meta: "Flight", status: item.status, type: "flight" })),
              ].slice(0, 12).map((item) => (
                <div className="rounded-[18px] border border-[var(--ve-line-soft)] p-4" key={`${item.type}-${item.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{item.label}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{item.meta}</p>
                    </div>
                    <AdminStatusBadge tone={statusTone(item.status)}>{item.status}</AdminStatusBadge>
                  </div>
                  <div className="mt-4">
                    <StatusForm entityId={item.id} entityType={item.type} />
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      </section>
    </AdsShell>
  );
}
