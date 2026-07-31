import "server-only";

import { requireAdmin } from "@/features/admin/application/context";
import type {
  AuditRow,
  BillingSnapshotRow,
  CampaignRow,
  CreativeRow,
  CreativeVersionRow,
  EventRow,
  FlightRow,
  HouseFallbackEventRow,
  MakeGoodRow,
  PartnerRow,
  PlacementRow,
  SponsorInquiryRow,
} from "./types";

const partnerSelect =
  "id, name, status, contact_name, contact_email, website_url, allowed_cta_domains, terms_accepted_at, contract_reference, notes";
const campaignSelect =
  "id, partner_id, name, status, campaign_type, budget_label, pricing_model, rate_amount, currency, minor_unit, rounding_mode, gross_budget_amount, billable_budget_amount, spend_cap_amount, allow_overspend, overspend_tolerance_percent, contracted_impressions, contracted_clicks, contracted_viewable_impressions, included_content_tags, excluded_content_tags, included_course_categories, excluded_course_categories, included_course_ids, excluded_course_ids, included_lesson_ids, excluded_lesson_ids, excluded_page_types, competitor_exclusion_keys, priority, pacing_mode, starts_at, ends_at, timezone, make_good_policy, notes";
const placementSelect =
  "key, name, status, house_fallback_enabled, house_fallback_eyebrow, house_fallback_headline, house_fallback_body, house_fallback_cta_label, house_fallback_cta_url";

export async function loadAdsOverviewData() {
  const { supabase } = await requireAdmin();
  const [
    { data: partners },
    { data: campaigns },
    { data: versions },
    { data: placements },
    { data: flights },
    { data: recentEvents },
  ] = await Promise.all([
    supabase.from("ad_partners").select(partnerSelect).order("created_at", { ascending: false }),
    supabase.from("ad_campaigns").select(campaignSelect).order("created_at", { ascending: false }),
    supabase
      .from("ad_creative_versions")
      .select("id, creative_id, version_number, status, headline, sponsor_label, disclosure_label")
      .order("created_at", { ascending: false }),
    supabase.from("ad_placements").select(placementSelect).order("key"),
    supabase
      .from("ad_flights")
      .select("id, campaign_id, creative_id, creative_version_id, placement_key, status, priority")
      .order("created_at", { ascending: false }),
    supabase
      .from("ad_events")
      .select("event_type, qualification_status, billable_amount")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  return {
    partners: (partners ?? []) as PartnerRow[],
    campaigns: (campaigns ?? []) as CampaignRow[],
    versions: (versions ?? []) as CreativeVersionRow[],
    placements: (placements ?? []) as PlacementRow[],
    flights: (flights ?? []) as FlightRow[],
    recentEvents: (recentEvents ?? []) as EventRow[],
  };
}

export async function loadAdsLaunchData() {
  const { supabase } = await requireAdmin();
  const [
    { data: partners },
    { data: campaigns },
    { data: creatives },
    { data: versions },
    { data: placements },
  ] = await Promise.all([
    supabase.from("ad_partners").select(partnerSelect).order("created_at", { ascending: false }),
    supabase.from("ad_campaigns").select(campaignSelect).order("created_at", { ascending: false }),
    supabase
      .from("ad_creatives")
      .select("id, campaign_id, name, status, creative_format, current_version_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("ad_creative_versions")
      .select("id, creative_id, version_number, status, headline, sponsor_label, disclosure_label")
      .order("created_at", { ascending: false }),
    supabase.from("ad_placements").select(placementSelect).order("key"),
  ]);

  return {
    partners: (partners ?? []) as PartnerRow[],
    campaigns: (campaigns ?? []) as CampaignRow[],
    creatives: (creatives ?? []) as CreativeRow[],
    versions: (versions ?? []) as CreativeVersionRow[],
    placements: (placements ?? []) as PlacementRow[],
  };
}

export async function loadAdsReviewData() {
  const { supabase } = await requireAdmin();
  const [
    { data: partners },
    { data: campaigns },
    { data: versions },
    { data: placements },
    { data: flights },
  ] = await Promise.all([
    supabase.from("ad_partners").select(partnerSelect).order("created_at", { ascending: false }),
    supabase.from("ad_campaigns").select(campaignSelect).order("created_at", { ascending: false }),
    supabase
      .from("ad_creative_versions")
      .select("id, creative_id, version_number, status, headline, sponsor_label, disclosure_label")
      .order("created_at", { ascending: false }),
    supabase.from("ad_placements").select(placementSelect).order("key"),
    supabase
      .from("ad_flights")
      .select("id, campaign_id, creative_id, creative_version_id, placement_key, status, priority")
      .order("created_at", { ascending: false }),
  ]);

  return {
    partners: (partners ?? []) as PartnerRow[],
    campaigns: (campaigns ?? []) as CampaignRow[],
    versions: (versions ?? []) as CreativeVersionRow[],
    placements: (placements ?? []) as PlacementRow[],
    flights: (flights ?? []) as FlightRow[],
  };
}

export async function loadAdsReportingData() {
  const { supabase } = await requireAdmin();
  const [
    { data: campaigns },
    { data: recentEvents },
    { data: houseFallbackEvents },
    { data: sponsorInquiries },
    { data: billingSnapshots },
    { data: makeGoods },
    { data: auditEvents },
  ] = await Promise.all([
    supabase.from("ad_campaigns").select(campaignSelect).order("created_at", { ascending: false }),
    supabase
      .from("ad_events")
      .select("event_type, qualification_status, billable_amount")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("ad_house_fallback_events")
      .select("event_type, placement_key")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("ad_sponsor_inquiries")
      .select("id, contact_name, organization_name, email, campaign_goal, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("ad_billing_snapshots")
      .select("id, campaign_id, period_start, period_end, billable_spend, billable_viewable_impressions, billable_clicks, filtered_event_count")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ad_make_goods")
      .select("id, campaign_id, status, reason, owed_impressions, owed_clicks")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ad_audit_events")
      .select("id, event_type, entity_type, entity_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    campaigns: (campaigns ?? []) as CampaignRow[],
    recentEvents: (recentEvents ?? []) as EventRow[],
    houseFallbackEvents: (houseFallbackEvents ?? []) as HouseFallbackEventRow[],
    sponsorInquiries: (sponsorInquiries ?? []) as SponsorInquiryRow[],
    billingSnapshots: (billingSnapshots ?? []) as BillingSnapshotRow[],
    makeGoods: (makeGoods ?? []) as MakeGoodRow[],
    auditEvents: (auditEvents ?? []) as AuditRow[],
  };
}

export async function loadAdsInventoryData() {
  const { supabase } = await requireAdmin();
  const [
    { data: partners },
    { data: campaigns },
    { data: versions },
    { data: placements },
    { data: flights },
  ] = await Promise.all([
    supabase.from("ad_partners").select(partnerSelect).order("created_at", { ascending: false }),
    supabase
      .from("ad_campaigns")
      .select("id, partner_id, name, status, campaign_type, pricing_model")
      .order("created_at", { ascending: false }),
    supabase
      .from("ad_creative_versions")
      .select("id, creative_id, version_number, status, headline, sponsor_label, disclosure_label")
      .order("created_at", { ascending: false }),
    supabase.from("ad_placements").select(placementSelect).order("key"),
    supabase
      .from("ad_flights")
      .select("id, campaign_id, creative_id, creative_version_id, placement_key, status, priority")
      .order("created_at", { ascending: false }),
  ]);

  return {
    partners: (partners ?? []) as PartnerRow[],
    campaigns: (campaigns ?? []) as CampaignRow[],
    versions: (versions ?? []) as CreativeVersionRow[],
    placements: (placements ?? []) as PlacementRow[],
    flights: (flights ?? []) as FlightRow[],
  };
}
