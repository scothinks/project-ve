import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";

/** Five operations maximum, independent of card count. Identity is supplied by the route. */
export async function getEconomyOverview(
  supabase: SupabaseClient,
  workspaceId: string | null,
) {
  const catalog = workspaceId === PLATFORM_CATALOG_WORKSPACE_ID;
  const organization = workspaceId && !catalog ? workspaceId : null;
  let rewards = supabase
    .from("rewards")
    .select(
      "id, title, status, is_enabled, total_available, distribution_mode, visibility_mode",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .limit(1000);
  let missions = supabase
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  let proofs = supabase
    .from("mission_proofs")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");
  if (organization) {
    rewards = rewards.eq("organization_id", organization);
    missions = missions.eq("organization_id", organization);
    proofs = proofs.eq("organization_id", organization);
  } else if (catalog) {
    rewards = rewards.is("organization_id", null);
    missions = missions.eq("catalog_scope", "platform");
    proofs = proofs.is("organization_id", null);
  }
  const campaigns = supabase
    .from("campaigns")
    .select("id, name, description, budget_label, starts_at, ends_at")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(4);
  // Empty FK embeds filter ownership without transferring IDs or reward records.
  // PostgREST resource embedding supports OR across not-null embedded resources.
  let redemptionQuery = supabase
    .from("reward_redemptions")
    .select(
      "id, source:rewards!reward_redemptions_reward_id_fkey(), awarded:rewards!reward_redemptions_awarded_reward_id_fkey()",
      { count: "exact", head: true },
    )
    .eq("claim_state", "details_submitted")
    .eq("fulfillment_type", "manual")
    .is("fulfilled_at", null);
  if (organization) {
    redemptionQuery = redemptionQuery
      .eq("source.organization_id", organization)
      .eq("awarded.organization_id", organization)
      .or("source.not.is.null,awarded.not.is.null");
  } else if (catalog) {
    redemptionQuery = redemptionQuery
      .is("source.organization_id", null)
      .is("awarded.organization_id", null)
      .or("source.not.is.null,awarded.not.is.null");
  }
  const [
    rewardResult,
    missionResult,
    proofResult,
    campaignResult,
    redemptionResult,
  ] = await Promise.all([
    rewards,
    missions,
    proofs,
    organization ? Promise.resolve({ data: [], error: null }) : campaigns,
    redemptionQuery,
  ]);
  for (const result of [
    rewardResult,
    missionResult,
    proofResult,
    campaignResult,
    redemptionResult,
  ]) {
    if (result.error) throw result.error;
  }
  const rows = rewardResult.data ?? [];
  const complete = (rewardResult.count ?? 0) <= rows.length;
  return {
    rewardCount: rewardResult.count ?? 0,
    missionCount: missionResult.count ?? 0,
    pendingProofItems: proofResult.count ?? 0,
    manualClaims: redemptionResult.count,
    stockAttention: rows
      .filter(
        (row) =>
          row.distribution_mode === "direct" &&
          row.status === "published" &&
          row.is_enabled &&
          row.visibility_mode === "store" &&
          row.total_available <= 0,
      )
      .slice(0, 6),
    campaigns: campaignResult.data ?? [],
    attentionLimited: !complete,
  };
}
