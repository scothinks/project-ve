export type AdminAdsView = "overview" | "launch" | "review" | "reporting" | "inventory";

export type AdsRouteProps = {
  searchParams?: Promise<{ editCampaignId?: string; editPartnerId?: string; notice?: string }>;
};

export type PartnerRow = {
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

export type CampaignRow = {
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

export type CreativeRow = {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  creative_format: string;
  current_version_id: string | null;
};

export type CreativeVersionRow = {
  id: string;
  creative_id: string;
  version_number: number;
  status: string;
  headline: string | null;
  sponsor_label: string;
  disclosure_label: string;
};

export type PlacementRow = {
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

export type FlightRow = {
  id: string;
  campaign_id: string;
  creative_id: string;
  creative_version_id: string;
  placement_key: string;
  status: string;
  priority: number;
};

export type EventRow = {
  event_type: string;
  qualification_status: string;
  billable_amount: number;
};

export type HouseFallbackEventRow = {
  event_type: string;
  placement_key: string;
};

export type SponsorInquiryRow = {
  id: string;
  contact_name: string;
  organization_name: string;
  email: string;
  campaign_goal: string;
  status: string;
  created_at: string;
};

export type BillingSnapshotRow = {
  id: string;
  campaign_id: string;
  period_start: string;
  period_end: string;
  billable_spend: number;
  billable_viewable_impressions: number;
  billable_clicks: number;
  filtered_event_count: number;
};

export type MakeGoodRow = {
  id: string;
  campaign_id: string;
  status: string;
  reason: string;
  owed_impressions: number;
  owed_clicks: number;
};

export type AuditRow = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  reason: string | null;
  created_at: string;
};
