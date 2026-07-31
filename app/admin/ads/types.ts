export type AdminAdsView = "overview" | "launch" | "review" | "reporting" | "inventory";

export type AdsRouteProps = {
  searchParams?: Promise<{ editCampaignId?: string; editPartnerId?: string; notice?: string }>;
};

export type {
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
} from "@/features/ads/admin/types";
