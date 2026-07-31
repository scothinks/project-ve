import { AdminCard, AdminTable, EmptyAdminState } from "@/components/admin/AdminPrimitives";
import { AdsShell } from "../AdsShell";
import {
  AdminStatusBadge,
  EmptyList,
  PlacementFallbackPreview,
  SectionTitle,
  StatusForm,
  compactInputClasses,
  secondaryButtonClasses,
  statusTone,
} from "../components";
import { saveAdPlacementFallback } from "../actions";
import { loadAdsInventoryData } from "@/features/ads/admin/data";
import type { AdsRouteProps } from "../types";

export default async function AdminAdsInventoryPage({ searchParams }: AdsRouteProps) {
  const { notice } = (await searchParams) ?? {};
  const { campaigns, flights, partners, placements, versions } = await loadAdsInventoryData();
  const partnerItems = partners;
  const campaignItems = campaigns;
  const placementItems = placements;
  const versionItems = versions;
  const flightItems = flights;

  return (
    <AdsShell activeView="inventory" notice={notice}>
<section className="mt-8" id="inventory">
        <SectionTitle
          eyebrow="Inventory library"
          subtitle="Raw entities are still available for operations, but organized below the manager-facing launch and reporting views."
        >
          Partners, campaigns, placements, creatives, and flights
        </SectionTitle>
        <div className="mt-5 space-y-5">
          <AdminCard>
            <h3 className="mb-3 text-lg font-black">Partners</h3>
            {partnerItems.length ? (
              <AdminTable columns={["Sponsor", "Status", "Terms", "Action"]}>
                {partnerItems.map((partner) => (
                  <tr key={partner.id}>
                    <td className="px-4 py-4">
                      <p className="font-black">{partner.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{partner.id}</p>
                    </td>
                    <td className="px-4 py-4">
                      <AdminStatusBadge tone={statusTone(partner.status)}>{partner.status}</AdminStatusBadge>
                    </td>
                    <td className="px-4 py-4 text-xs font-bold">
                      {partner.terms_accepted_at ? "Accepted" : "Missing"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid gap-3">
                        <a className={secondaryButtonClasses} href={`/admin/ads/launch?editPartnerId=${encodeURIComponent(partner.id)}`}>
                          Edit sponsor
                        </a>
                        <StatusForm entityId={partner.id} entityType="partner" returnPath="/admin/ads/inventory" />
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            ) : (
              <EmptyAdminState>No ad partners yet.</EmptyAdminState>
            )}
	          </AdminCard>

          <AdminCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <SectionTitle
                eyebrow="Fallback campaigns"
                subtitle="Control the Advertise here house campaign per placement. These cards serve only when paid inventory is unavailable."
              >
                Advertise here placement controls
              </SectionTitle>
              <a className={secondaryButtonClasses} href="/advertise">
                View public sponsor page
              </a>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {placementItems.length ? placementItems.map((placement) => (
                <form
                  action={saveAdPlacementFallback}
                  className="grid gap-4 rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4"
                  key={placement.key}
                >
                  <input name="placementKey" type="hidden" value={placement.key} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{placement.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{placement.key}</p>
                    </div>
                    <AdminStatusBadge tone={placement.house_fallback_enabled ? "good" : "warning"}>
                      {placement.house_fallback_enabled ? "Fallback on" : "Fallback off"}
                    </AdminStatusBadge>
                  </div>
                  <PlacementFallbackPreview placement={placement} />
                  <label className="flex items-start gap-2 rounded-[14px] bg-[var(--ve-card)] p-3">
                    <input
                      className="mt-1"
                      defaultChecked={placement.house_fallback_enabled}
                      name="houseFallbackEnabled"
                      type="checkbox"
                      value="true"
                    />
                    <span>
                      <span className="block text-xs font-black">Show Advertise here fallback</span>
                      <span className="block text-[11px] font-semibold text-[var(--ve-muted)]">
                        Used only when paid inventory is unavailable for this placement.
                      </span>
                    </span>
                  </label>
                  <input
                    className={compactInputClasses}
                    name="houseFallbackEyebrow"
                    defaultValue={placement.house_fallback_eyebrow}
                    placeholder="Eyebrow"
                  />
                  <input
                    className={compactInputClasses}
                    name="houseFallbackHeadline"
                    defaultValue={placement.house_fallback_headline}
                    placeholder="Headline"
                  />
                  <textarea
                    className={compactInputClasses}
                    name="houseFallbackBody"
                    defaultValue={placement.house_fallback_body}
                    placeholder="Body"
                    rows={3}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className={compactInputClasses}
                      name="houseFallbackCtaLabel"
                      defaultValue={placement.house_fallback_cta_label}
                      placeholder="CTA label"
                    />
                    <select
                      className={compactInputClasses}
                      name="houseFallbackCtaUrl"
                      defaultValue={placement.house_fallback_cta_url}
                    >
                      <option value="/advertise">Sponsor overview</option>
                      <option value="/advertise/inquiry">Sponsor inquiry form</option>
                    </select>
                  </div>
                  <button className={secondaryButtonClasses} type="submit">
                    Save fallback
                  </button>
                </form>
              )) : <EmptyList>No placements available for fallback controls.</EmptyList>}
            </div>
          </AdminCard>

          <AdminCard>
            <h3 className="mb-3 text-lg font-black">Campaigns, placements, creatives, and flights</h3>
            <AdminTable columns={["Type", "Name", "Status", "Details", "Action"]}>
              {campaignItems.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-4 py-4 text-xs font-black uppercase">Campaign</td>
                  <td className="px-4 py-4 font-black">{campaign.name}</td>
                  <td className="px-4 py-4">
                    <AdminStatusBadge tone={statusTone(campaign.status)}>{campaign.status}</AdminStatusBadge>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold">
                    {campaign.campaign_type} · {campaign.pricing_model}
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid gap-3">
                      <a className={secondaryButtonClasses} href={`/admin/ads/launch?editCampaignId=${encodeURIComponent(campaign.id)}`}>
                        Edit campaign
                      </a>
                      <StatusForm entityId={campaign.id} entityType="campaign" returnPath="/admin/ads/inventory" />
                    </div>
                  </td>
                </tr>
              ))}
              {placementItems.map((placement) => (
                <tr key={placement.key}>
                  <td className="px-4 py-4 text-xs font-black uppercase">Placement</td>
                  <td className="px-4 py-4 font-black">{placement.name}</td>
                  <td className="px-4 py-4">
                    <AdminStatusBadge tone={statusTone(placement.status)}>{placement.status}</AdminStatusBadge>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold">
                    <div>{placement.key}</div>
                    <div className="mt-1 text-[var(--ve-muted)]">
                      Fallback: {placement.house_fallback_enabled ? "Advertise here enabled" : "Off"}
                    </div>
	                  </td>
	                  <td className="px-4 py-4">
	                    <StatusForm entityId={placement.key} entityType="placement" returnPath="/admin/ads/inventory" />
	                  </td>
                </tr>
              ))}
              {versionItems.map((version) => (
                <tr key={version.id}>
                  <td className="px-4 py-4 text-xs font-black uppercase">Creative v{version.version_number}</td>
                  <td className="px-4 py-4 font-black">{version.headline ?? version.sponsor_label}</td>
                  <td className="px-4 py-4">
                    <AdminStatusBadge tone={statusTone(version.status)}>{version.status}</AdminStatusBadge>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold">
                    {version.disclosure_label} · {version.sponsor_label}
                  </td>
                  <td className="px-4 py-4">
                    <StatusForm entityId={version.id} entityType="creative_version" returnPath="/admin/ads/inventory" />
                  </td>
                </tr>
              ))}
              {flightItems.map((flight) => (
                <tr key={flight.id}>
                  <td className="px-4 py-4 text-xs font-black uppercase">Flight</td>
                  <td className="px-4 py-4 font-black">{flight.placement_key}</td>
                  <td className="px-4 py-4">
                    <AdminStatusBadge tone={statusTone(flight.status)}>{flight.status}</AdminStatusBadge>
                  </td>
                  <td className="px-4 py-4 text-xs font-bold">Priority {flight.priority}</td>
                  <td className="px-4 py-4">
                    <StatusForm entityId={flight.id} entityType="flight" returnPath="/admin/ads/inventory" />
                  </td>
                </tr>
              ))}
            </AdminTable>
          </AdminCard>
        </div>
      </section>
    </AdsShell>
  );
}
