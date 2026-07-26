import type { ReactNode } from "react";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { requireAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";
import {
  createAdMakeGoodRecommendations,
  purgeOldAdRuntimeData,
  refreshAdBillingSnapshot,
  saveAdCampaign,
  saveAdCreativeVersion,
  saveAdFlight,
  saveAdPlacementFallback,
  saveAdPartner,
  setAdEntityStatus,
} from "./actions";

type AdsPageProps = {
  searchParams?: Promise<{ editCampaignId?: string; editPartnerId?: string; notice?: string }>;
};

type PartnerRow = {
  id: string;
  name: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  website_url: string | null;
  allowed_cta_domains: string[] | null;
  terms_accepted_at: string | null;
  contract_reference: string | null;
  notes: string | null;
};

type CampaignRow = {
  id: string;
  partner_id: string;
  name: string;
  status: string;
  campaign_type: string;
  budget_label: string | null;
  pricing_model: string;
  rate_amount: number;
  currency: string;
  minor_unit: number;
  rounding_mode: string;
  gross_budget_amount: number | null;
  billable_budget_amount: number | null;
  spend_cap_amount: number | null;
  allow_overspend: boolean;
  overspend_tolerance_percent: number;
  contracted_impressions: number | null;
  contracted_clicks: number | null;
  contracted_viewable_impressions: number | null;
  included_content_tags: string[] | null;
  excluded_content_tags: string[] | null;
  included_course_categories: string[] | null;
  excluded_course_categories: string[] | null;
  included_course_ids: string[] | null;
  excluded_course_ids: string[] | null;
  included_lesson_ids: string[] | null;
  excluded_lesson_ids: string[] | null;
  excluded_page_types: string[] | null;
  competitor_exclusion_keys: string[] | null;
  priority: number;
  pacing_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  make_good_policy: string | null;
  notes: string | null;
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
  house_fallback_enabled: boolean;
  house_fallback_eyebrow: string;
  house_fallback_headline: string;
  house_fallback_body: string;
  house_fallback_cta_label: string;
  house_fallback_cta_url: string;
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

type HouseFallbackEventRow = {
  event_type: string;
  placement_key: string;
};

type SponsorInquiryRow = {
  id: string;
  contact_name: string;
  organization_name: string;
  email: string;
  campaign_goal: string;
  status: string;
  created_at: string;
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

const inputClasses =
  "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3.5 py-3 text-sm font-semibold outline-none transition placeholder:text-[var(--ve-muted)] focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green-soft)_72%,transparent)]";
const compactInputClasses =
  "rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-xs font-bold outline-none focus:border-[var(--ve-green)]";
const secondaryButtonClasses =
  "inline-flex min-h-10 items-center justify-center rounded-[13px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 text-xs font-black text-[var(--ve-muted-strong)] transition hover:border-[color:color-mix(in_srgb,var(--ve-green)_26%,var(--ve-line))] hover:text-[var(--ve-green)]";
const primaryButtonClasses =
  "inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--ve-green)] px-5 text-sm font-black text-white shadow-sm transition hover:translate-y-[-1px]";

function statusTone(status: string) {
  if (["active", "approved", "published"].includes(status)) return "good" as const;
  if (status === "paused" || status === "rejected") return "danger" as const;
  if (status === "submitted") return "store" as const;
  return "warning" as const;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMoneyMinor(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(value);
}

function listValue(value: string[] | null | undefined) {
  return value?.join(", ") ?? "";
}

function Field({
  children,
  help,
  label,
  span = false,
}: {
  children: ReactNode;
  help?: string;
  label: string;
  span?: boolean;
}) {
  return (
    <label className={span ? "md:col-span-2" : undefined}>
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
        {label}
      </span>
      {children}
      {help ? (
        <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          {help}
        </span>
      ) : null}
    </label>
  );
}

function SectionTitle({
  children,
  eyebrow,
  subtitle,
}: {
  children: ReactNode;
  eyebrow?: string;
  subtitle?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-xl font-black tracking-[-0.02em]">{children}</h2>
      {subtitle ? (
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "good" | "warning" | "danger";
  value: ReactNode;
}) {
  const toneClasses = {
    default: "text-[var(--foreground)]",
    good: "text-[var(--ve-green)]",
    warning: "text-[color:color-mix(in_srgb,var(--ve-store)_66%,var(--foreground))]",
    danger: "text-[var(--ve-danger)]",
  };

  return (
    <div className="rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
        {label}
      </p>
      <p className={cn("mt-3 text-3xl font-black tracking-[-0.04em]", toneClasses[tone])}>
        {value}
      </p>
    </div>
  );
}

function WorkflowCard({
  children,
  step,
  title,
}: {
  children: ReactNode;
  step: string;
  title: string;
}) {
  return (
    <AdminCard className="overflow-hidden p-0">
      <div className="border-b border-[var(--ve-line-soft)] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_48%,var(--ve-card))] px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
          {step}
        </p>
        <h3 className="mt-1 text-lg font-black">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </AdminCard>
  );
}

function AdvancedPanel({
  children,
  summary,
}: {
  children: ReactNode;
  summary: string;
}) {
  return (
    <details className="md:col-span-2 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
      <summary className="cursor-pointer text-sm font-black text-[var(--foreground)]">
        {summary}
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </details>
  );
}

function StatusForm({
  entityId,
  entityType,
}: {
  entityId: string;
  entityType: string;
}) {
  return (
    <form action={setAdEntityStatus} className="grid min-w-[260px] gap-2">
      <input name="entityType" type="hidden" value={entityType} />
      <input name="entityId" type="hidden" value={entityId} />
      <div className="flex gap-2">
        <select className={compactInputClasses} name="status" defaultValue="paused">
          <option value="active">Activate</option>
          <option value="approved">Approve</option>
          <option value="submitted">Mark submitted</option>
          <option value="paused">Pause now</option>
          <option value="archived">Archive</option>
          <option value="rejected">Reject</option>
        </select>
        <button className="rounded-[12px] bg-[var(--ve-green)] px-3 text-xs font-black text-white" type="submit">
          Apply
        </button>
      </div>
      <input
        className={compactInputClasses}
        name="reason"
        placeholder="Required context for audit log"
      />
    </form>
  );
}

function EmptyList({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-panel)] p-5 text-sm font-semibold text-[var(--ve-muted)]">
      {children}
    </div>
  );
}

function PlacementFallbackPreview({ placement }: { placement: PlacementRow }) {
  return (
    <div className="rounded-[18px] border border-[color:color-mix(in_srgb,var(--ve-green)_16%,var(--ve-line-soft))] bg-[var(--ve-card)] p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
        Advertise here
      </p>
      <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
        Project VE Partnerships
      </p>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
        {placement.house_fallback_eyebrow}
      </p>
      <h4 className="mt-2 text-base font-black leading-6 tracking-[-0.02em]">
        {placement.house_fallback_headline}
      </h4>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
        {placement.house_fallback_body}
      </p>
      <div className="mt-4 inline-flex min-h-9 items-center rounded-full bg-[var(--ve-green)] px-4 text-xs font-black text-white">
        {placement.house_fallback_cta_label}
      </div>
    </div>
  );
}

export default async function AdminAdsPage({ searchParams }: AdsPageProps) {
  const { supabase } = await requireAdmin();
  const { editCampaignId, editPartnerId, notice } = (await searchParams) ?? {};
  const [
    { data: partners },
    { data: campaigns },
    { data: creatives },
    { data: versions },
    { data: placements },
    { data: flights },
    { data: recentEvents },
    { data: houseFallbackEvents },
    { data: sponsorInquiries },
    { data: billingSnapshots },
    { data: makeGoods },
    { data: auditEvents },
  ] = await Promise.all([
    supabase
      .from("ad_partners")
      .select("id, name, status, contact_name, contact_email, website_url, allowed_cta_domains, terms_accepted_at, contract_reference, notes")
      .order("created_at", { ascending: false })
      .returns<PartnerRow[]>(),
    supabase
      .from("ad_campaigns")
      .select("id, partner_id, name, status, campaign_type, budget_label, pricing_model, rate_amount, currency, minor_unit, rounding_mode, gross_budget_amount, billable_budget_amount, spend_cap_amount, allow_overspend, overspend_tolerance_percent, contracted_impressions, contracted_clicks, contracted_viewable_impressions, included_content_tags, excluded_content_tags, included_course_categories, excluded_course_categories, included_course_ids, excluded_course_ids, included_lesson_ids, excluded_lesson_ids, excluded_page_types, competitor_exclusion_keys, priority, pacing_mode, starts_at, ends_at, timezone, make_good_policy, notes")
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
      .select("key, name, status, house_fallback_enabled, house_fallback_eyebrow, house_fallback_headline, house_fallback_body, house_fallback_cta_label, house_fallback_cta_url")
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
      .from("ad_house_fallback_events")
      .select("event_type, placement_key")
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<HouseFallbackEventRow[]>(),
    supabase
      .from("ad_sponsor_inquiries")
      .select("id, contact_name, organization_name, email, campaign_goal, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<SponsorInquiryRow[]>(),
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
  const houseFallbackEventItems = houseFallbackEvents ?? [];
  const sponsorInquiryItems = sponsorInquiries ?? [];
  const snapshotItems = billingSnapshots ?? [];
  const makeGoodItems = makeGoods ?? [];
  const auditItems = auditEvents ?? [];
  const activeCampaigns = campaignItems.filter((campaign) => campaign.status === "active");
  const pendingCreatives = versionItems.filter((version) => version.status === "submitted");
  const activePlacements = placementItems.filter((placement) => placement.status === "active");
  const selectedPartner = partnerItems.find((partner) => partner.id === editPartnerId);
  const selectedCampaign = campaignItems.find((campaign) => campaign.id === editCampaignId);
  const billableEvents = eventItems.filter((event) => event.qualification_status === "billable");
  const filteredEvents = eventItems.filter((event) => event.qualification_status === "filtered");
  const viewableEvents = billableEvents.filter((event) => event.event_type === "viewable_impression");
  const clickEvents = billableEvents.filter((event) => event.event_type === "click");
  const houseFallbackViewableEvents = houseFallbackEventItems.filter(
    (event) => event.event_type === "viewable_impression",
  );
  const houseFallbackClickEvents = houseFallbackEventItems.filter(
    (event) => event.event_type === "click",
  );
  const houseFallbackCtr = houseFallbackViewableEvents.length
    ? houseFallbackClickEvents.length / houseFallbackViewableEvents.length
    : 0;
  const ivtRate = eventItems.length ? filteredEvents.length / eventItems.length : 0;
  const ctr = viewableEvents.length ? clickEvents.length / viewableEvents.length : 0;
  const missingTermsPartners = partnerItems.filter(
    (partner) => partner.status === "active" && !partner.terms_accepted_at,
  );
  const pausedEntities =
    partnerItems.filter((item) => item.status === "paused").length +
    campaignItems.filter((item) => item.status === "paused").length +
    placementItems.filter((item) => item.status === "paused").length +
    flightItems.filter((item) => item.status === "paused").length;

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Direct ads"
        title="Ads Manager"
        subtitle="Plan, launch, govern, and report first-party sponsorship campaigns without exposing operational complexity by default."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active campaigns" tone="good" value={activeCampaigns.length} />
        <MetricCard label="Pending approvals" tone={pendingCreatives.length ? "warning" : "default"} value={pendingCreatives.length} />
        <MetricCard label="Active placements" value={`${activePlacements.length}/${placementItems.length || 0}`} />
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
              <a className={secondaryButtonClasses} href="#launch">
                Build campaign
              </a>
              <a className={secondaryButtonClasses} href="#library">
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

      <section className="mt-6 rounded-[22px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-5">
          {[
            ["Overview", "#overview"],
            ["Launch Studio", "#launch"],
            ["Approvals", "#approvals"],
            ["Reports", "#reports"],
            ["Inventory", "#library"],
          ].map(([label, href]) => (
            <a
              className="rounded-[16px] px-4 py-3 text-center text-sm font-black text-[var(--ve-muted-strong)] transition hover:bg-[var(--ve-panel)] hover:text-[var(--ve-green)]"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </div>
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

      <section className="mt-10" id="launch">
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

      <section className="mt-10" id="approvals">
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

      <section className="mt-10" id="reports">
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

      <section className="mt-10" id="library">
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
                        <a className={secondaryButtonClasses} href={`/admin/ads?editPartnerId=${encodeURIComponent(partner.id)}#launch`}>
                          Edit sponsor
                        </a>
                        <StatusForm entityId={partner.id} entityType="partner" />
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
                      <a className={secondaryButtonClasses} href={`/admin/ads?editCampaignId=${encodeURIComponent(campaign.id)}#launch`}>
                        Edit campaign
                      </a>
                      <StatusForm entityId={campaign.id} entityType="campaign" />
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
                    <div className="grid gap-4">
                      <form action={saveAdPlacementFallback} className="grid min-w-[320px] gap-2 rounded-[16px] bg-[var(--ve-panel)] p-3">
                        <input name="placementKey" type="hidden" value={placement.key} />
                        <PlacementFallbackPreview placement={placement} />
                        <label className="flex items-start gap-2">
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
                              Used only when paid inventory is unavailable.
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
                      <StatusForm entityId={placement.key} entityType="placement" />
                    </div>
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
                    <StatusForm entityId={version.id} entityType="creative_version" />
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
                    <StatusForm entityId={flight.id} entityType="flight" />
                  </td>
                </tr>
              ))}
            </AdminTable>
          </AdminCard>
        </div>
      </section>
    </>
  );
}
