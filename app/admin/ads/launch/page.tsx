import { AdminCard } from "@/components/admin/AdminPrimitives";
import { AdsShell } from "../AdsShell";
import {
  AdvancedPanel,
  Field,
  SectionTitle,
  WorkflowCard,
  formatDateTimeLocal,
  inputClasses,
  listValue,
  primaryButtonClasses,
} from "../components";
import { loadAdsLaunchData } from "@/features/ads/admin/data";
import type { AdsRouteProps } from "../types";
import { saveAdCampaign, saveAdCreativeVersion, saveAdFlight, saveAdPartner } from "../actions";

export default async function AdminAdsLaunchPage({ searchParams }: AdsRouteProps) {
  const { editCampaignId, editPartnerId, notice } = (await searchParams) ?? {};
  const { campaigns, creatives, partners, placements, versions } = await loadAdsLaunchData();
  const selectedPartner = partners.find((partner) => partner.id === editPartnerId);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === editCampaignId);
  const partnerItems = partners;
  const campaignItems = campaigns;
  const creativeItems = creatives;
  const versionItems = versions;
  const placementItems = placements;

  return (
    <AdsShell activeView="launch" notice={notice}>
<section className="mt-8" id="launch">
        <SectionTitle
          eyebrow="Launch studio"
          subtitle="Create or update sponsor inventory in the same order a non-technical manager thinks about launch readiness."
        >
          Build a direct campaign
        </SectionTitle>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <WorkflowCard step="Step 1" title="Sponsor partner">
            <p className="text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              {selectedPartner
                ? `Editing ${selectedPartner.name}. Clear the edit link to create a new sponsor.`
                : "Capture who the sponsor is, where clicks are allowed to go, and whether commercial terms are accepted."}
            </p>
            <form action={saveAdPartner} className="mt-5 grid gap-4 md:grid-cols-2">
              <input name="partnerId" type="hidden" value={selectedPartner?.id ?? ""} />
              <Field label="Sponsor name">
                <input className={inputClasses} name="name" required defaultValue={selectedPartner?.name ?? ""} />
              </Field>
              <Field label="Partner status">
                <select className={inputClasses} name="status" defaultValue={selectedPartner?.status ?? "draft"}>
                  <option value="draft">Draft — not ready</option>
                  <option value="active">Active — can serve paid ads</option>
                  <option value="paused">Paused — stop delivery</option>
                </select>
              </Field>
              <Field label="Primary contact">
                <input className={inputClasses} name="contactName" defaultValue={selectedPartner?.contact_name ?? ""} />
              </Field>
              <Field label="Contact email">
                <input className={inputClasses} name="contactEmail" type="email" defaultValue={selectedPartner?.contact_email ?? ""} />
              </Field>
              <Field label="Sponsor website" help="Used as the default allowed click domain. Must use HTTPS.">
                <input className={inputClasses} name="websiteUrl" type="url" defaultValue={selectedPartner?.website_url ?? ""} />
              </Field>
              <Field label="Contract reference" help="Link this record to the signed IO, agreement, or internal tracker.">
                <input className={inputClasses} name="contractReference" defaultValue={selectedPartner?.contract_reference ?? ""} />
              </Field>
              <AdvancedPanel summary="Advanced click safety">
                <Field label="Additional allowed click domains" help="Comma-separated. Example: partner.com, shop.partner.com">
                  <input className={inputClasses} name="allowedCtaDomains" defaultValue={listValue(selectedPartner?.allowed_cta_domains)} />
                </Field>
                <Field label="Partner notes" span>
                  <textarea className={inputClasses} name="notes" rows={3} defaultValue={selectedPartner?.notes ?? ""} />
                </Field>
              </AdvancedPanel>
              <label className="md:col-span-2 flex items-start gap-3 rounded-[16px] bg-[var(--ve-panel)] p-4">
                <input className="mt-1" name="termsAccepted" type="checkbox" value="true" defaultChecked={Boolean(selectedPartner?.terms_accepted_at)} />
                <span>
                  <span className="block text-sm font-black">Sponsor accepted Project VE ads terms v1</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Paid campaigns are blocked until terms are recorded.
                  </span>
                </span>
              </label>
              <div className="md:col-span-2">
                <button className={primaryButtonClasses} type="submit">
                  {selectedPartner ? "Update sponsor partner" : "Save sponsor partner"}
                </button>
              </div>
            </form>
          </WorkflowCard>

          <WorkflowCard step="Step 2" title="Campaign brief">
            <p className="text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              {selectedCampaign
                ? `Editing ${selectedCampaign.name}. Clear the edit link to create a new campaign.`
                : "Define the commercial terms, schedule, and delivery intent. Advanced targeting stays tucked away until needed."}
            </p>
            <form action={saveAdCampaign} className="mt-5 grid gap-4 md:grid-cols-2">
              <input name="campaignId" type="hidden" value={selectedCampaign?.id ?? ""} />
              <Field label="Sponsor">
                <select className={inputClasses} name="partnerId" required defaultValue={selectedCampaign?.partner_id ?? ""}>
                  <option value="">Select sponsor</option>
                  {partnerItems.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Campaign name">
                <input className={inputClasses} name="name" required defaultValue={selectedCampaign?.name ?? ""} />
              </Field>
              <Field label="Budget label">
                <input className={inputClasses} name="budgetLabel" placeholder="Q3 learner awareness package" defaultValue={selectedCampaign?.budget_label ?? ""} />
              </Field>
              <Field label="Campaign status">
                <select className={inputClasses} name="status" defaultValue={selectedCampaign?.status ?? "draft"}>
                  <option value="draft">Draft — planning</option>
                  <option value="active">Active — eligible to serve</option>
                  <option value="paused">Paused — stop delivery</option>
                </select>
              </Field>
              <Field label="Campaign type">
                <select className={inputClasses} name="campaignType" defaultValue={selectedCampaign?.campaign_type ?? "guaranteed"}>
                  <option value="guaranteed">Guaranteed sponsor campaign</option>
                  <option value="priority">Priority sponsor campaign</option>
                  <option value="house">House promotion</option>
                  <option value="bonus">Bonus / make-good delivery</option>
                </select>
              </Field>
              <Field label="Pricing model">
                <select className={inputClasses} name="pricingModel" defaultValue={selectedCampaign?.pricing_model ?? "flat_fee"}>
                  <option value="flat_fee">Flat fee</option>
                  <option value="cpm">CPM — viewable impressions</option>
                  <option value="cpc">CPC — clicks</option>
                  <option value="house">House</option>
                  <option value="make_good">Make-good</option>
                </select>
              </Field>
              <Field label="Rate" help="Stored in minor units for billing accuracy. Example: 150000 for ₦1,500.00.">
                <input className={inputClasses} name="rateAmount" type="number" defaultValue={selectedCampaign?.rate_amount ?? 0} />
              </Field>
              <Field label="Currency">
                <input className={inputClasses} name="currency" maxLength={3} defaultValue={selectedCampaign?.currency ?? "NGN"} />
              </Field>
              <Field label="Start date">
                <input className={inputClasses} name="startsAt" type="datetime-local" defaultValue={formatDateTimeLocal(selectedCampaign?.starts_at ?? null)} />
              </Field>
              <Field label="End date">
                <input className={inputClasses} name="endsAt" type="datetime-local" defaultValue={formatDateTimeLocal(selectedCampaign?.ends_at ?? null)} />
              </Field>
              <Field label="Pacing">
                <select className={inputClasses} name="pacingMode" defaultValue={selectedCampaign?.pacing_mode ?? "even"}>
                  <option value="even">Even delivery</option>
                  <option value="asap">Deliver as soon as eligible</option>
                  <option value="manual">Manual priority only</option>
                </select>
              </Field>
              <Field label="Business priority">
                <input className={inputClasses} name="priority" type="number" defaultValue={selectedCampaign?.priority ?? 0} />
              </Field>
              <Field label="Pacing timezone" help="Defines billing days, budget windows, and daily frequency caps.">
                <input className={inputClasses} name="timezone" defaultValue={selectedCampaign?.timezone ?? "Africa/Lagos"} />
              </Field>

              <AdvancedPanel summary="Budget, currency, and reconciliation">
                <Field label="Currency minor unit">
                  <input className={inputClasses} name="minorUnit" type="number" min={0} max={4} defaultValue={selectedCampaign?.minor_unit ?? 2} />
                </Field>
                <Field label="Rounding policy">
                  <select className={inputClasses} name="roundingMode" defaultValue={selectedCampaign?.rounding_mode ?? "half_up"}>
                    <option value="half_up">Round half up</option>
                    <option value="floor">Round down</option>
                    <option value="ceil">Round up</option>
                  </select>
                </Field>
                <Field label="Gross budget">
                  <input className={inputClasses} name="grossBudgetAmount" type="number" min={0} defaultValue={selectedCampaign?.gross_budget_amount ?? ""} />
                </Field>
                <Field label="Billable budget">
                  <input className={inputClasses} name="billableBudgetAmount" type="number" min={0} defaultValue={selectedCampaign?.billable_budget_amount ?? ""} />
                </Field>
                <Field label="Spend cap">
                  <input className={inputClasses} name="spendCapAmount" type="number" min={0} defaultValue={selectedCampaign?.spend_cap_amount ?? ""} />
                </Field>
                <Field label="Overspend tolerance %">
                  <input className={inputClasses} name="overspendTolerancePercent" type="number" min={0} defaultValue={selectedCampaign?.overspend_tolerance_percent ?? 0} />
                </Field>
                <label className="flex items-center gap-2 rounded-[14px] bg-[var(--ve-card)] p-3">
                  <input name="allowOverspend" type="checkbox" value="true" defaultChecked={Boolean(selectedCampaign?.allow_overspend)} />
                  <span className="text-sm font-bold">Allow controlled overspend</span>
                </label>
              </AdvancedPanel>

              <AdvancedPanel summary="Delivery goals">
                <Field label="Contracted impressions">
                  <input className={inputClasses} name="contractedImpressions" type="number" min={0} defaultValue={selectedCampaign?.contracted_impressions ?? ""} />
                </Field>
                <Field label="Contracted viewable impressions">
                  <input className={inputClasses} name="contractedViewableImpressions" type="number" min={0} defaultValue={selectedCampaign?.contracted_viewable_impressions ?? ""} />
                </Field>
                <Field label="Contracted clicks">
                  <input className={inputClasses} name="contractedClicks" type="number" min={0} defaultValue={selectedCampaign?.contracted_clicks ?? ""} />
                </Field>
              </AdvancedPanel>

              <AdvancedPanel summary="Audience, content, and brand safety">
                <Field label="Include content tags" help="Comma-separated values profile/content tags.">
                  <input className={inputClasses} name="includedContentTags" defaultValue={listValue(selectedCampaign?.included_content_tags)} />
                </Field>
                <Field label="Exclude content tags">
                  <input className={inputClasses} name="excludedContentTags" defaultValue={listValue(selectedCampaign?.excluded_content_tags)} />
                </Field>
                <Field label="Include course categories">
                  <input className={inputClasses} name="includedCourseCategories" defaultValue={listValue(selectedCampaign?.included_course_categories)} />
                </Field>
                <Field label="Exclude course categories">
                  <input className={inputClasses} name="excludedCourseCategories" defaultValue={listValue(selectedCampaign?.excluded_course_categories)} />
                </Field>
                <Field label="Include course IDs">
                  <input className={inputClasses} name="includedCourseIds" defaultValue={listValue(selectedCampaign?.included_course_ids)} />
                </Field>
                <Field label="Exclude course IDs">
                  <input className={inputClasses} name="excludedCourseIds" defaultValue={listValue(selectedCampaign?.excluded_course_ids)} />
                </Field>
                <Field label="Include lesson IDs">
                  <input className={inputClasses} name="includedLessonIds" defaultValue={listValue(selectedCampaign?.included_lesson_ids)} />
                </Field>
                <Field label="Exclude lesson IDs">
                  <input className={inputClasses} name="excludedLessonIds" defaultValue={listValue(selectedCampaign?.excluded_lesson_ids)} />
                </Field>
                <Field label="Exclude page types">
                  <input className={inputClasses} name="excludedPageTypes" defaultValue={listValue(selectedCampaign?.excluded_page_types)} />
                </Field>
                <Field label="Competitor categories">
                  <input className={inputClasses} name="competitorExclusionKeys" defaultValue={listValue(selectedCampaign?.competitor_exclusion_keys)} />
                </Field>
              </AdvancedPanel>

              <AdvancedPanel summary="Internal notes and make-good policy">
                <Field label="Make-good policy" span>
                  <textarea className={inputClasses} name="makeGoodPolicy" rows={3} defaultValue={selectedCampaign?.make_good_policy ?? ""} />
                </Field>
                <Field label="Notes" span>
                  <textarea className={inputClasses} name="notes" rows={3} defaultValue={selectedCampaign?.notes ?? ""} />
                </Field>
              </AdvancedPanel>

              <div className="md:col-span-2">
                <button className={primaryButtonClasses} type="submit">
                  {selectedCampaign ? "Update campaign brief" : "Save campaign brief"}
                </button>
              </div>
            </form>
          </WorkflowCard>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <WorkflowCard step="Step 3" title="Creative submission">
            <p className="text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Submit native sponsor copy and first-party assets. Approval happens separately to preserve review integrity.
            </p>
            <form action={saveAdCreativeVersion} className="mt-5 grid gap-4 md:grid-cols-2">
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
              <Field label="Creative set">
                <select className={inputClasses} name="creativeId" defaultValue="">
                  <option value="">Create new creative set</option>
                  {creativeItems.map((creative) => (
                    <option key={creative.id} value={creative.id}>
                      {creative.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Creative name">
                <input className={inputClasses} name="name" required />
              </Field>
              <Field label="Format">
                <select className={inputClasses} name="creativeFormat" defaultValue="native_card">
                  <option value="native_card">Native card</option>
                </select>
              </Field>
              <Field label="Creative set status">
                <select className={inputClasses} name="creativeStatus" defaultValue="active">
                  <option value="active">Active creative set</option>
                  <option value="paused">Paused creative set</option>
                  <option value="archived">Archived creative set</option>
                </select>
              </Field>
              <Field label="Creative rotation weight">
                <input className={inputClasses} name="weight" type="number" min={1} defaultValue={1} />
              </Field>
              <Field label="Submission status">
                <select className={inputClasses} name="versionStatus" defaultValue="submitted">
                  <option value="draft">Draft</option>
                  <option value="submitted">Submit for review</option>
                </select>
              </Field>
              <Field label="Sponsor display name">
                <input className={inputClasses} name="sponsorLabel" required />
              </Field>
              <Field label="Ad disclosure">
                <input className={inputClasses} name="disclosureLabel" required defaultValue="Sponsored" />
              </Field>
              <Field label="Headline">
                <input className={inputClasses} name="headline" required />
              </Field>
              <Field label="Body copy" span>
                <textarea className={inputClasses} name="body" rows={3} required />
              </Field>
              <Field label="Eyebrow">
                <input className={inputClasses} name="eyebrow" />
              </Field>
              <Field label="CTA label">
                <input className={inputClasses} name="ctaLabel" required />
              </Field>
              <Field label="CTA URL" help="Must be HTTPS and allowed for this partner.">
                <input className={inputClasses} name="ctaUrl" type="url" required />
              </Field>
              <Field label="Native image" help="JPG, PNG, or WebP. At least 600×338 and close to 16:9.">
                <input className={inputClasses} name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" />
              </Field>
              <Field label="Image alt text" help="Required for accessibility; write what the image communicates.">
                <input className={inputClasses} name="imageAlt" />
              </Field>
              <Field label="Legal text" span>
                <textarea className={inputClasses} name="legalText" rows={2} />
              </Field>
              <div className="md:col-span-2">
                <button className={primaryButtonClasses} type="submit">
                  Save creative for review
                </button>
              </div>
            </form>
          </WorkflowCard>

          <AdminCard className="self-start">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
              Native preview
            </p>
            <div className="mt-4 overflow-hidden rounded-[24px] border border-[color:color-mix(in_srgb,var(--ve-green)_16%,var(--ve-line-soft))] bg-[var(--ve-card)] shadow-sm">
              <div className="h-32 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--ve-green-soft)_70%,white),color-mix(in_srgb,var(--ve-violet-soft)_60%,white))]" />
              <div className="p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
                  Sponsored
                </p>
                <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
                  Sponsor name
                </p>
                <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                  Optional eyebrow
                </p>
                <h3 className="mt-2 text-lg font-black leading-6 tracking-[-0.02em]">
                  Native ad headline appears here
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  Body copy should be clear, sponsor-safe, and visibly separate from lesson content.
                </p>
                <div className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--ve-green)] px-5 text-sm font-black text-white">
                  CTA label
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-[16px] bg-[var(--ve-panel)] p-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Approval checks: visible disclosure, sponsor identity, HTTPS CTA, accessible alt text, approved asset, placement-compatible format.
            </div>
          </AdminCard>
        </div>

        <div className="mt-5">
          <WorkflowCard step="Step 4" title="Placement flight">
            <p className="text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Connect an approved creative version to a placement, then set delivery limits and brand-safety exclusions.
            </p>
            <form action={saveAdFlight} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              <Field label="Creative version">
                <select className={inputClasses} name="creativeVersionId" required>
                  <option value="">Select approved/submitted version</option>
                  {versionItems.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.sponsor_label} · v{version.version_number} · {version.status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Placement">
                <select className={inputClasses} name="placementKey" defaultValue="lesson_footer_card">
                  {placementItems.map((placement) => (
                    <option key={placement.key} value={placement.key}>
                      {placement.name} · {placement.status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Flight status">
                <select className={inputClasses} name="status" defaultValue="active">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </Field>
              <Field label="Flight priority">
                <input className={inputClasses} name="priority" type="number" defaultValue={0} />
              </Field>
              <Field label="Rotation weight">
                <input className={inputClasses} name="weight" type="number" min={1} defaultValue={1} />
              </Field>
              <Field label="Flight start">
                <input className={inputClasses} name="startsAt" type="datetime-local" />
              </Field>
              <Field label="Flight end">
                <input className={inputClasses} name="endsAt" type="datetime-local" />
              </Field>
              <Field label="Lesson sequence page" help="Optional. Use only when this creative should appear on a specific lesson page.">
                <input className={inputClasses} name="sequencePageNumber" type="number" min={0} />
              </Field>
              <label className="flex items-start gap-3 rounded-[16px] bg-[var(--ve-panel)] p-4">
                <input className="mt-1" name="allowConsecutiveCreative" type="checkbox" value="true" />
                <span>
                  <span className="block text-sm font-black">Allow consecutive lesson pages</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Leave off unless this flight is intentionally sequenced across adjacent lesson screens.
                  </span>
                </span>
              </label>

              <AdvancedPanel summary="Audience segments and experiments">
                <Field label="Include learner segments">
                  <input className={inputClasses} name="includedSegmentKeys" />
                </Field>
                <Field label="Exclude learner segments">
                  <input className={inputClasses} name="excludedSegmentKeys" />
                </Field>
                <Field label="Experiment name">
                  <input className={inputClasses} name="experimentKey" />
                </Field>
                <Field label="Experiment variants">
                  <input className={inputClasses} name="experimentVariants" placeholder="control,treatment" />
                </Field>
              </AdvancedPanel>

              <AdvancedPanel summary="Frequency caps">
                <Field label="Max paid ads per session">
                  <input className={inputClasses} name="sessionMaxPaidAds" type="number" min={0} defaultValue={5} />
                </Field>
                <Field label="Campaign impressions per learner per day">
                  <input className={inputClasses} name="userDailyCampaignImpressions" type="number" min={0} defaultValue={3} />
                </Field>
                <Field label="Creative impressions per learner per day">
                  <input className={inputClasses} name="userDailyCreativeVersionImpressions" type="number" min={0} defaultValue={2} />
                </Field>
                <Field label="Sponsor impressions per learner per week">
                  <input className={inputClasses} name="userWeeklyPartnerImpressions" type="number" min={0} defaultValue={5} />
                </Field>
              </AdvancedPanel>

              <AdvancedPanel summary="Brand-safety exclusions">
                <Field label="Avoid content tags">
                  <input className={inputClasses} name="brandExcludedContentTags" />
                </Field>
                <Field label="Avoid page types">
                  <input className={inputClasses} name="brandExcludedPageTypes" />
                </Field>
                <Field label="Only allow page types">
                  <input className={inputClasses} name="brandIncludedPageTypes" />
                </Field>
                <Field label="Competing sponsor categories">
                  <input className={inputClasses} name="competitorExclusionKeys" />
                </Field>
              </AdvancedPanel>

              <AdvancedPanel summary="Flight goals">
                <Field label="Impression goal">
                  <input className={inputClasses} name="deliveryGoalImpressions" type="number" min={0} />
                </Field>
                <Field label="Click goal">
                  <input className={inputClasses} name="deliveryGoalClicks" type="number" min={0} />
                </Field>
              </AdvancedPanel>

              <div className="xl:col-span-3">
                <button className={primaryButtonClasses} type="submit">
                  Save placement flight
                </button>
              </div>
            </form>
          </WorkflowCard>
        </div>
      </section>
    </AdsShell>
  );
}
