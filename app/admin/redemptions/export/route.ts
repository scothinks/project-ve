import { NextRequest, NextResponse } from "next/server";
import { getAdminRedemptions, requireAdmin, type AdminRedemptionFilters } from "@/lib/admin";

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
}

function flattenClaimData(claimData: Record<string, unknown> | null) {
  if (!claimData) {
    return "";
  }

  return Object.entries(claimData)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");
}

export async function GET(request: NextRequest) {
  const { supabase } = await requireAdmin();
  const params = request.nextUrl.searchParams;
  const filters: AdminRedemptionFilters = {
    claimState: params.get("claimState") || undefined,
    fulfillmentType: params.get("fulfillmentType") || undefined,
    campaignId: params.get("campaignId") || undefined,
    rewardId: params.get("rewardId") || undefined,
    dateFrom: params.get("dateFrom") || undefined,
    dateTo: params.get("dateTo") || undefined,
  };
  const redemptions = await getAdminRedemptions(supabase, filters, 5000);
  const header = [
    "redemption_id",
    "reward_id",
    "reward",
    "campaign_id",
    "user_id",
    "display_name",
    "fulfillment_type",
    "claim_state",
    "xp_cost",
    "requested_at",
    "fulfilled_at",
    "refunded_at",
    "submitted_details",
    "admin_note",
  ];
  const rows = redemptions.map((redemption) => [
    redemption.id,
    redemption.reward_id,
    redemption.reward_title_snapshot ?? redemption.reward?.title ?? "",
    redemption.reward?.campaign_id ?? "",
    redemption.user_id,
    redemption.profile?.display_name ?? "",
    redemption.fulfillment_type ?? "",
    redemption.claim_state,
    redemption.xp_cost_at_redemption ?? 0,
    redemption.requested_at,
    redemption.fulfilled_at ?? "",
    redemption.refunded_at ?? "",
    flattenClaimData(redemption.claim_data),
    redemption.admin_note ?? "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="project-ve-redemptions-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
