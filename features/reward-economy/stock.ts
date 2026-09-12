import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Stock context: four bounded projections, then two set-wise name lookups. No code payloads. */
export async function getEconomyStock(
  supabase: SupabaseClient,
  scope: { rewardId: string } | { campaignId: string },
) {
  const column = "rewardId" in scope ? "reward_id" : "campaign_id";
  const id = "rewardId" in scope ? scope.rewardId : scope.campaignId;
  const batches = supabase
    .from("reward_inventory_batches")
    .select(
      "id, reward_id, batch_label, partner_reference, imported_rows, status, available_from, expires_at, created_at",
    )
    .eq(column, id)
    .order("created_at", { ascending: false })
    .limit(25);
  const allocations = supabase
    .from("reward_quantity_allocations")
    .select(
      "id, reward_id, batch_label, partner_reference, quantity_available, quantity_total, allocation_type, available_from, expires_at, created_at",
    )
    .eq(column, id)
    .order("created_at", { ascending: false })
    .limit(25);
  const adjustments = supabase
    .from("reward_inventory_adjustments")
    .select("id, reward_id, delta, reason, batch_label, created_at")
    .eq(column, id)
    .order("created_at", { ascending: false })
    .limit(25);
  let moves = supabase
    .from("reward_inventory_reallocations")
    .select(
      "id, reward_id, from_campaign_id, to_campaign_id, quantity, reason, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(25);
  moves =
    "rewardId" in scope
      ? moves.eq("reward_id", id)
      : moves.or(`from_campaign_id.eq.${id},to_campaign_id.eq.${id}`);
  const results = await Promise.all([batches, allocations, adjustments, moves]);
  for (const result of results) if (result.error) throw result.error;
  const batchRows = results[0].data ?? [];
  const allocationRows = results[1].data ?? [];
  const adjustmentRows = results[2].data ?? [];
  const moveRows = results[3].data ?? [];
  const rewardIds = [
    ...new Set(
      results.flatMap((result) =>
        (result.data ?? []).map((row) => row.reward_id),
      ),
    ),
  ];
  const campaignIds = [
    ...new Set(
      moveRows
        .flatMap((row) => [row.from_campaign_id, row.to_campaign_id])
        .filter(Boolean),
    ),
  ];
  const [rewardNames, campaignNames] = await Promise.all([
    rewardIds.length
      ? supabase.from("rewards").select("id, title").in("id", rewardIds)
      : Promise.resolve({ data: [], error: null }),
    campaignIds.length
      ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (rewardNames.error) throw rewardNames.error;
  if (campaignNames.error) throw campaignNames.error;
  const rewards = new Map(
    (rewardNames.data ?? []).map((row) => [row.id, row.title]),
  );
  const campaigns = new Map(
    (campaignNames.data ?? []).map((row) => [row.id, row.name]),
  );
  return {
    batches: batchRows.map((row) => ({
      ...row,
      rewardTitle: rewards.get(row.reward_id) ?? "Reward unavailable",
    })),
    allocations: allocationRows.map((row) => ({
      ...row,
      rewardTitle: rewards.get(row.reward_id) ?? "Reward unavailable",
    })),
    movements: [
      ...adjustmentRows.map((row) => ({
        id: row.id,
        rewardTitle: rewards.get(row.reward_id) ?? "Reward unavailable",
        quantity: row.delta,
        reason: row.reason,
        context: row.batch_label ?? "Stock adjustment",
        createdAt: row.created_at,
      })),
      ...moveRows.map((row) => ({
        id: row.id,
        rewardTitle: rewards.get(row.reward_id) ?? "Reward unavailable",
        quantity: row.quantity,
        reason: row.reason,
        context: `${campaigns.get(row.from_campaign_id) ?? "No campaign"} → ${campaigns.get(row.to_campaign_id) ?? "No campaign"}`,
        createdAt: row.created_at,
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 25),
  };
}
