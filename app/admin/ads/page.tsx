import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { requireAdmin } from "@/lib/admin";
import {
  createAdMakeGoodRecommendations,
  purgeOldAdRuntimeData,
  refreshAdBillingSnapshot,
  saveAdCampaign,
  saveAdCreativeVersion,
  saveAdFlight,
  saveAdPartner,
  setAdEntityStatus,
} from "./actions";

type AdsPageProps = {
  searchParams?: Promise<{ notice?: string }>;
};

type PartnerRow = {
  id: string;
  name: string;
  status: string;
  terms_accepted_at: string | null;
};

type CampaignRow = {
  id: string;
  partner_id: string;
  name: string;
  status: string;
  campaign_type: string;
  pricing_model: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
};

type CreativeRow = {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  creative_format: string;
  current_version_id: string | null;
};

type CreativeVersionRow = {
  id: string;
  creative_id: string;
  version_number: number;
  status: string;
  headline: string | null;
  sponsor_label: string;
  disclosure_label: string;
};

type PlacementRow = {
  key: string;
  name: string;
  status: string;
};

type FlightRow = {
  id: string;
  campaign_id: string;
  creative_id: string;
  creative_version_id: string;
  placement_key: string;
  status: string;
  priority: number;
};

type EventRow = {
  event_type: string;
  qualification_status: string;
  billable_amount: number;
};

type BillingSnapshotRow = {
  id: string;
  campaign_id: string;
  period_start: string;
  period_end: string;
  billable_spend: number;
  billable_viewable_impressions: number;
  billable_clicks: number;
  filtered_event_count: number;
};

type MakeGoodRow = {
  id: string;
  campaign_id: string;
  status: string;
  reason: string;
  owed_impressions: number;
  owed_clicks: number;
};

type AuditRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  reason: string | null;
  created_at: string;
};

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function statusTone(status: string) {
  if (["active", "approved", "published"].includes(status)) return "good" as const;
  if (status === "paused" || status === "rejected") return "danger" as const;
  if (status === "submitted") return "store" as const;
  return "warning" as const;
}

function StatusForm({
  entityId,
  entityType,
}: {
  entityId: string;
  entityType: string;
}) {
  return (
    <form action={setAdEntityStatus} className="flex flex-wrap gap-2">
      <input name="entityType" type="hidden" value={entityType} />
      <input name="entityId" type="hidden" value={entityId} />
      <input
        className="rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-2 py-1 text-xs font-bold"
        name="reason"
        placeholder="Reason"
      />
      <select className="rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-2 py-1 text-xs font-bold" name="status" defaultValue="paused">
        <option value="active">Active</option>
        <option value="approved">Approved</option>
        <option value="submitted">Submitted</option>
        <option value="paused">Paused</option>
        <option value="archived">Archived</option>
        <option value="rejected">Rejected</option>
      </select>
      <button className="rounded-[10px] bg-[var(--ve-green)] px-3 py-1 text-xs font-black text-white" type="submit">
        Set
      </button>
    </form>
  );
}

export default async function AdminAdsPage({ searchParams }: AdsPageProps) {
  const { supabase } = await requireAdmin();
  const { notice } = (await searchParams) ?? {};
	  const [
	    { data: partners },
	    { data: campaigns },
	    { data: creatives },
	    { data: versions },
	    { data: placements },
	    { data: flights },
	    { data: recentEvents },
	    { data: billingSnapshots },
	    { data: makeGoods },
	    { data: auditEvents },
	  ] = await Promise.all([
    supabase
      .from("ad_partners")
      .select("id, name, status, terms_accepted_at")
      .order("created_at", { ascending: false })
      .returns<PartnerRow[]>(),
    supabase
      .from("ad_campaigns")
      .select("id, partner_id, name, status, campaign_type, pricing_model, priority, starts_at, ends_at")
      .order("created_at", { ascending: false })
      .returns<CampaignRow[]>(),
    supabase
      .from("ad_creatives")
      .select("id, campaign_id, name, status, creative_format, current_version_id")
      .order("created_at", { ascending: false })
      .returns<CreativeRow[]>(),
    supabase
      .from("ad_creative_versions")
      .select("id, creative_id, version_number, status, headline, sponsor_label, disclosure_label")
      .order("created_at", { ascending: false })
      .returns<CreativeVersionRow[]>(),
    supabase
      .from("ad_placements")
      .select("key, name, status")
      .order("key")
      .returns<PlacementRow[]>(),
	    supabase
	      .from("ad_flights")
	      .select("id, campaign_id, creative_id, creative_version_id, placement_key, status, priority")
	      .order("created_at", { ascending: false })
	      .returns<FlightRow[]>(),
	    supabase
	      .from("ad_events")
	      .select("event_type, qualification_status, billable_amount")
	      .order("created_at", { ascending: false })
	      .limit(1000)
	      .returns<EventRow[]>(),
	    supabase
	      .from("ad_billing_snapshots")
	      .select("id, campaign_id, period_start, period_end, billable_spend, billable_viewable_impressions, billable_clicks, filtered_event_count")
	      .order("created_at", { ascending: false })
	      .limit(10)
	      .returns<BillingSnapshotRow[]>(),
	    supabase
	      .from("ad_make_goods")
	      .select("id, campaign_id, status, reason, owed_impressions, owed_clicks")
	      .order("created_at", { ascending: false })
	      .limit(10)
	      .returns<MakeGoodRow[]>(),
	    supabase
	      .from("ad_audit_events")
	      .select("id, event_type, entity_type, entity_id, reason, created_at")
	      .order("created_at", { ascending: false })
	      .limit(12)
	      .returns<AuditRow[]>(),
	  ]);

  const partnerItems = partners ?? [];
  const campaignItems = campaigns ?? [];
  const creativeItems = creatives ?? [];
  const versionItems = versions ?? [];
	  const placementItems = placements ?? [];
	  const flightItems = flights ?? [];
	  const eventItems = recentEvents ?? [];
	  const snapshotItems = billingSnapshots ?? [];
	  const makeGoodItems = makeGoods ?? [];
	  const auditItems = auditEvents ?? [];
	  const billableEvents = eventItems.filter((event) => event.qualification_status === "billable");
	  const filteredEvents = eventItems.filter((event) => event.qualification_status === "filtered");

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Direct ads"
        title="Ads"
        subtitle="Manage first-party direct placements, native creatives, review states, flights, and kill switches."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <AdminCard>
          <h2 className="text-lg font-black">Partner</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            V1 is admin-mediated. A partner must have accepted terms before paid delivery.
          </p>
          <form action={saveAdPartner} className="mt-4 grid gap-4 md:grid-cols-2">
	            <label>
	              <span className={labelClasses()}>Name</span>
	              <input className={fieldClasses()} name="name" required />
	            </label>
	            <label>
	              <span className={labelClasses()}>Status</span>
              <select className={fieldClasses()} name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Contact</span>
              <input className={fieldClasses()} name="contactName" />
            </label>
            <label>
              <span className={labelClasses()}>Email</span>
              <input className={fieldClasses()} name="contactEmail" type="email" />
            </label>
	            <label>
	              <span className={labelClasses()}>Website HTTPS URL</span>
	              <input className={fieldClasses()} name="websiteUrl" type="url" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Allowed CTA domains CSV</span>
	              <input className={fieldClasses()} name="allowedCtaDomains" placeholder="partner.com, shop.partner.com" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Contract reference</span>
	              <input className={fieldClasses()} name="contractReference" />
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input name="termsAccepted" type="checkbox" value="true" />
              <span className="text-sm font-bold">Partner accepted Project VE ads terms v1</span>
            </label>
            <div className="md:col-span-2">
              <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white" type="submit">
                Save partner
              </button>
            </div>
          </form>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-black">Campaign</h2>
          <form action={saveAdCampaign} className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Partner</span>
              <select className={fieldClasses()} name="partnerId" required>
                <option value="">Select partner</option>
                {partnerItems.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
	            <label>
	              <span className={labelClasses()}>Name</span>
	              <input className={fieldClasses()} name="name" required />
	            </label>
	            <label>
	              <span className={labelClasses()}>Budget label</span>
	              <input className={fieldClasses()} name="budgetLabel" />
	            </label>
            <label>
              <span className={labelClasses()}>Status</span>
              <select className={fieldClasses()} name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Type</span>
              <select className={fieldClasses()} name="campaignType" defaultValue="guaranteed">
                <option value="guaranteed">Guaranteed</option>
                <option value="priority">Priority</option>
                <option value="house">House</option>
                <option value="bonus">Bonus</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Pricing</span>
              <select className={fieldClasses()} name="pricingModel" defaultValue="flat_fee">
                <option value="flat_fee">Flat fee</option>
                <option value="cpm">CPM</option>
                <option value="cpc">CPC</option>
                <option value="house">House</option>
                <option value="make_good">Make-good</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Rate minor units</span>
              <input className={fieldClasses()} name="rateAmount" type="number" defaultValue={0} />
            </label>
	            <label>
	              <span className={labelClasses()}>Currency</span>
	              <input className={fieldClasses()} name="currency" maxLength={3} defaultValue="NGN" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Minor unit</span>
	              <input className={fieldClasses()} name="minorUnit" type="number" min={0} max={4} defaultValue={2} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Rounding</span>
	              <select className={fieldClasses()} name="roundingMode" defaultValue="half_up">
	                <option value="half_up">Half up</option>
	                <option value="floor">Floor</option>
	                <option value="ceil">Ceil</option>
	              </select>
	            </label>
	            <label>
	              <span className={labelClasses()}>Timezone</span>
	              <input className={fieldClasses()} name="timezone" defaultValue="Africa/Lagos" />
            </label>
            <label>
              <span className={labelClasses()}>Starts</span>
              <input className={fieldClasses()} name="startsAt" type="datetime-local" />
            </label>
	            <label>
	              <span className={labelClasses()}>Ends</span>
	              <input className={fieldClasses()} name="endsAt" type="datetime-local" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Priority</span>
	              <input className={fieldClasses()} name="priority" type="number" defaultValue={0} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Pacing</span>
	              <select className={fieldClasses()} name="pacingMode" defaultValue="even">
	                <option value="even">Even</option>
	                <option value="asap">ASAP</option>
	                <option value="manual">Manual</option>
	              </select>
	            </label>
	            <label>
	              <span className={labelClasses()}>Included tags CSV</span>
	              <input className={fieldClasses()} name="includedContentTags" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Included course categories CSV</span>
	              <input className={fieldClasses()} name="includedCourseCategories" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Included courses CSV</span>
	              <input className={fieldClasses()} name="includedCourseIds" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Included lessons CSV</span>
	              <input className={fieldClasses()} name="includedLessonIds" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Excluded tags CSV</span>
	              <input className={fieldClasses()} name="excludedContentTags" />
            </label>
	            <label>
	              <span className={labelClasses()}>Excluded lessons CSV</span>
	              <input className={fieldClasses()} name="excludedLessonIds" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Excluded categories CSV</span>
	              <input className={fieldClasses()} name="excludedCourseCategories" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Excluded courses CSV</span>
	              <input className={fieldClasses()} name="excludedCourseIds" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Excluded page types CSV</span>
	              <input className={fieldClasses()} name="excludedPageTypes" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Competitor keys CSV</span>
	              <input className={fieldClasses()} name="competitorExclusionKeys" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Spend cap minor units</span>
	              <input className={fieldClasses()} name="spendCapAmount" type="number" min={0} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Gross budget minor units</span>
	              <input className={fieldClasses()} name="grossBudgetAmount" type="number" min={0} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Billable budget minor units</span>
	              <input className={fieldClasses()} name="billableBudgetAmount" type="number" min={0} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Contracted viewable impressions</span>
	              <input className={fieldClasses()} name="contractedViewableImpressions" type="number" min={0} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Contracted impressions</span>
	              <input className={fieldClasses()} name="contractedImpressions" type="number" min={0} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Contracted clicks</span>
	              <input className={fieldClasses()} name="contractedClicks" type="number" min={0} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Overspend tolerance %</span>
	              <input className={fieldClasses()} name="overspendTolerancePercent" type="number" min={0} defaultValue={0} />
	            </label>
	            <label className="flex items-center gap-2">
	              <input name="allowOverspend" type="checkbox" value="true" />
	              <span className="text-sm font-bold">Allow overspend tolerance</span>
	            </label>
            <div className="md:col-span-2">
              <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white" type="submit">
                Save campaign
              </button>
            </div>
          </form>
        </AdminCard>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <AdminCard>
          <h2 className="text-lg font-black">Creative version</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            New visible copy or image creates a new immutable version. Native cards require clear disclosure.
          </p>
          <form action={saveAdCreativeVersion} className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Campaign</span>
              <select className={fieldClasses()} name="campaignId" required>
                <option value="">Select campaign</option>
                {campaignItems.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Existing creative</span>
              <select className={fieldClasses()} name="creativeId" defaultValue="">
                <option value="">Create new creative</option>
                {creativeItems.map((creative) => (
                  <option key={creative.id} value={creative.id}>
                    {creative.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Creative name</span>
              <input className={fieldClasses()} name="name" required />
            </label>
            <label>
              <span className={labelClasses()}>Format</span>
              <select className={fieldClasses()} name="creativeFormat" defaultValue="native_card">
                <option value="native_card">Native card</option>
                <option value="text_card">Text card</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Version status</span>
	              <select className={fieldClasses()} name="versionStatus" defaultValue="submitted">
	                <option value="draft">Draft</option>
	                <option value="submitted">Submitted</option>
	              </select>
            </label>
            <label>
              <span className={labelClasses()}>Sponsor label</span>
              <input className={fieldClasses()} name="sponsorLabel" required />
            </label>
            <label>
              <span className={labelClasses()}>Disclosure</span>
              <input className={fieldClasses()} name="disclosureLabel" required defaultValue="Sponsored" />
            </label>
            <label>
              <span className={labelClasses()}>Headline</span>
              <input className={fieldClasses()} name="headline" required />
            </label>
            <label className="md:col-span-2">
              <span className={labelClasses()}>Body</span>
              <textarea className={fieldClasses()} name="body" rows={3} />
            </label>
            <label>
              <span className={labelClasses()}>CTA label</span>
              <input className={fieldClasses()} name="ctaLabel" />
            </label>
            <label>
              <span className={labelClasses()}>CTA HTTPS URL</span>
              <input className={fieldClasses()} name="ctaUrl" type="url" />
            </label>
            <label>
              <span className={labelClasses()}>Native image upload</span>
              <input className={fieldClasses()} name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" />
            </label>
            <label>
              <span className={labelClasses()}>Image alt text</span>
              <input className={fieldClasses()} name="imageAlt" />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white" type="submit">
                Save creative version
              </button>
            </div>
          </form>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-black">Flight</h2>
          <form action={saveAdFlight} className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Campaign</span>
              <select className={fieldClasses()} name="campaignId" required>
                <option value="">Select campaign</option>
                {campaignItems.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Creative version</span>
              <select className={fieldClasses()} name="creativeVersionId" required>
                <option value="">Select version</option>
                {versionItems.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.sponsor_label} v{version.version_number} - {version.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Placement</span>
              <select className={fieldClasses()} name="placementKey" defaultValue="lesson_footer_card">
                {placementItems.map((placement) => (
                  <option key={placement.key} value={placement.key}>
                    {placement.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Status</span>
              <select className={fieldClasses()} name="status" defaultValue="active">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Priority</span>
              <input className={fieldClasses()} name="priority" type="number" defaultValue={0} />
            </label>
            <label>
              <span className={labelClasses()}>Sequence page</span>
              <input className={fieldClasses()} name="sequencePageNumber" type="number" min={0} />
            </label>
            <label>
              <span className={labelClasses()}>Included segments CSV</span>
              <input className={fieldClasses()} name="includedSegmentKeys" />
            </label>
	            <label>
	              <span className={labelClasses()}>Excluded segments CSV</span>
	              <input className={fieldClasses()} name="excludedSegmentKeys" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Session max paid ads</span>
	              <input className={fieldClasses()} name="sessionMaxPaidAds" type="number" min={0} defaultValue={5} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Daily campaign cap</span>
	              <input className={fieldClasses()} name="userDailyCampaignImpressions" type="number" min={0} defaultValue={3} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Daily creative cap</span>
	              <input className={fieldClasses()} name="userDailyCreativeVersionImpressions" type="number" min={0} defaultValue={2} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Weekly partner cap</span>
	              <input className={fieldClasses()} name="userWeeklyPartnerImpressions" type="number" min={0} defaultValue={5} />
	            </label>
	            <label>
	              <span className={labelClasses()}>Brand excluded tags CSV</span>
	              <input className={fieldClasses()} name="brandExcludedContentTags" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Brand excluded page types CSV</span>
	              <input className={fieldClasses()} name="brandExcludedPageTypes" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Brand included page types CSV</span>
	              <input className={fieldClasses()} name="brandIncludedPageTypes" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Flight competitor keys CSV</span>
	              <input className={fieldClasses()} name="competitorExclusionKeys" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Experiment key</span>
	              <input className={fieldClasses()} name="experimentKey" />
	            </label>
	            <label>
	              <span className={labelClasses()}>Experiment variants CSV</span>
	              <input className={fieldClasses()} name="experimentVariants" placeholder="control,treatment" />
	            </label>
	            <div className="md:col-span-2">
              <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white" type="submit">
                Save flight
              </button>
            </div>
          </form>
        </AdminCard>
	      </section>

	      <section className="mt-6 grid gap-5 xl:grid-cols-2">
	        <AdminCard>
	          <h2 className="text-lg font-black">Reporting operations</h2>
	          <div className="mt-4 grid gap-3 md:grid-cols-3">
	            <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
	              <p className={labelClasses()}>Recent events</p>
	              <p className="mt-2 text-2xl font-black">{eventItems.length}</p>
	            </div>
	            <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
	              <p className={labelClasses()}>Billable</p>
	              <p className="mt-2 text-2xl font-black">{billableEvents.length}</p>
	            </div>
	            <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
	              <p className={labelClasses()}>Filtered IVT</p>
	              <p className="mt-2 text-2xl font-black">{filteredEvents.length}</p>
	            </div>
	          </div>
	          <form action={refreshAdBillingSnapshot} className="mt-5 grid gap-4 md:grid-cols-2">
	            <label>
	              <span className={labelClasses()}>Campaign</span>
	              <select className={fieldClasses()} name="campaignId" required>
	                <option value="">Select campaign</option>
	                {campaignItems.map((campaign) => (
	                  <option key={campaign.id} value={campaign.id}>
	                    {campaign.name}
	                  </option>
	                ))}
	              </select>
	            </label>
	            <label>
	              <span className={labelClasses()}>Period start</span>
	              <input className={fieldClasses()} name="periodStart" type="datetime-local" required />
	            </label>
	            <label>
	              <span className={labelClasses()}>Period end</span>
	              <input className={fieldClasses()} name="periodEnd" type="datetime-local" required />
	            </label>
	            <div className="flex flex-wrap items-end gap-2">
	              <button className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white" type="submit">
	                Refresh snapshot
	              </button>
	            </div>
	          </form>
	          <div className="mt-4 flex flex-wrap gap-2">
	            <form action={createAdMakeGoodRecommendations}>
	              <button className="rounded-[12px] border border-[var(--ve-line)] px-4 py-2 text-xs font-black" type="submit">
	                Recommend make-goods
	              </button>
	            </form>
	            <form action={purgeOldAdRuntimeData}>
	              <button className="rounded-[12px] border border-[var(--ve-line)] px-4 py-2 text-xs font-black" type="submit">
	                Run retention cleanup
	              </button>
	            </form>
	          </div>
	        </AdminCard>

	        <AdminCard>
	          <h2 className="mb-3 text-lg font-black">Billing and audit</h2>
	          <div className="space-y-4">
	            <div>
	              <p className={labelClasses()}>Latest snapshots</p>
	              <div className="mt-2 space-y-2">
	                {snapshotItems.length ? snapshotItems.map((snapshot) => (
	                  <p key={snapshot.id} className="rounded-[12px] bg-[var(--ve-panel)] p-3 text-xs font-bold">
	                    {snapshot.campaign_id}: {snapshot.billable_viewable_impressions} viewable · {snapshot.billable_clicks} clicks · spend {snapshot.billable_spend}
	                  </p>
	                )) : <p className="text-sm font-semibold text-[var(--ve-muted)]">No billing snapshots yet.</p>}
	              </div>
	            </div>
	            <div>
	              <p className={labelClasses()}>Make-goods</p>
	              <div className="mt-2 space-y-2">
	                {makeGoodItems.length ? makeGoodItems.map((makeGood) => (
	                  <p key={makeGood.id} className="rounded-[12px] bg-[var(--ve-panel)] p-3 text-xs font-bold">
	                    {makeGood.campaign_id}: {makeGood.status} · {makeGood.owed_impressions} impressions · {makeGood.owed_clicks} clicks
	                  </p>
	                )) : <p className="text-sm font-semibold text-[var(--ve-muted)]">No make-goods yet.</p>}
	              </div>
	            </div>
	            <div>
	              <p className={labelClasses()}>Audit log</p>
	              <div className="mt-2 space-y-2">
	                {auditItems.length ? auditItems.map((event) => (
	                  <p key={event.id} className="rounded-[12px] bg-[var(--ve-panel)] p-3 text-xs font-bold">
	                    {event.event_type} · {event.entity_type}/{event.entity_id}
	                  </p>
	                )) : <p className="text-sm font-semibold text-[var(--ve-muted)]">No audit events yet.</p>}
	              </div>
	            </div>
	          </div>
	        </AdminCard>
	      </section>

	      <section className="mt-8 space-y-6">
        <AdminCard>
          <h2 className="mb-3 text-lg font-black">Partners</h2>
          {partnerItems.length ? (
            <AdminTable columns={["Partner", "Status", "Terms", "Kill switch"]}>
              {partnerItems.map((partner) => (
                <tr key={partner.id}>
                  <td className="px-4 py-4">
                    <p className="font-black">{partner.name}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{partner.id}</p>
                  </td>
                  <td className="px-4 py-4"><AdminStatusBadge tone={statusTone(partner.status)}>{partner.status}</AdminStatusBadge></td>
                  <td className="px-4 py-4 text-xs font-bold">{partner.terms_accepted_at ? "Accepted" : "Missing"}</td>
                  <td className="px-4 py-4"><StatusForm entityId={partner.id} entityType="partner" /></td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <EmptyAdminState>No ad partners yet.</EmptyAdminState>
          )}
        </AdminCard>

        <AdminCard>
          <h2 className="mb-3 text-lg font-black">Campaigns, creatives, and flights</h2>
          <AdminTable columns={["Type", "Name", "Status", "Details", "Kill switch"]}>
            {campaignItems.map((campaign) => (
              <tr key={campaign.id}>
                <td className="px-4 py-4 text-xs font-black uppercase">Campaign</td>
                <td className="px-4 py-4 font-black">{campaign.name}</td>
                <td className="px-4 py-4"><AdminStatusBadge tone={statusTone(campaign.status)}>{campaign.status}</AdminStatusBadge></td>
                <td className="px-4 py-4 text-xs font-bold">{campaign.campaign_type} · {campaign.pricing_model}</td>
                <td className="px-4 py-4"><StatusForm entityId={campaign.id} entityType="campaign" /></td>
              </tr>
            ))}
            {versionItems.map((version) => (
              <tr key={version.id}>
                <td className="px-4 py-4 text-xs font-black uppercase">Creative v{version.version_number}</td>
                <td className="px-4 py-4 font-black">{version.headline ?? version.sponsor_label}</td>
                <td className="px-4 py-4"><AdminStatusBadge tone={statusTone(version.status)}>{version.status}</AdminStatusBadge></td>
                <td className="px-4 py-4 text-xs font-bold">{version.disclosure_label} · {version.sponsor_label}</td>
                <td className="px-4 py-4"><StatusForm entityId={version.id} entityType="creative_version" /></td>
              </tr>
            ))}
            {flightItems.map((flight) => (
              <tr key={flight.id}>
                <td className="px-4 py-4 text-xs font-black uppercase">Flight</td>
                <td className="px-4 py-4 font-black">{flight.placement_key}</td>
                <td className="px-4 py-4"><AdminStatusBadge tone={statusTone(flight.status)}>{flight.status}</AdminStatusBadge></td>
                <td className="px-4 py-4 text-xs font-bold">Priority {flight.priority}</td>
                <td className="px-4 py-4"><StatusForm entityId={flight.id} entityType="flight" /></td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      </section>
    </>
  );
}
