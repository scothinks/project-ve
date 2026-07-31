import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminCampaignsByIds } from "@/features/campaigns/admin/data";
import {
  getAdminProfilesByIds,
  type AdminProfileRow,
} from "@/features/users/admin/data";
import {
  getAdminRewards,
  getAdminRewardsByIds,
  type AdminRewardRow,
} from "@/features/rewards/admin/data";

export type AdminRewardDetail = AdminRewardRow & {
  thumbnail: Record<string, unknown>;
  terms: string | null;
  claim_steps: unknown;
  fulfillment_config: Record<string, unknown>;
  redemption_window_days: number | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type AdminPerkPrizeRow = {
  id: string;
  bundle_reward_id: string;
  prize_type: "reward" | "native_xp" | "xp_boost";
  source_reward_id: string | null;
  title: string | null;
  thumbnail: Record<string, unknown> | null;
  config: Record<string, unknown>;
  weight: number;
  total_win_cap: number | null;
  daily_win_cap: number | null;
  available_from: string | null;
  expires_at: string | null;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  source_reward?: Pick<AdminRewardRow, "id" | "title" | "fulfillment_type" | "status" | "is_enabled"> | null;
  performance?: AdminPerkPrizePerformance | null;
  releaseBuckets?: AdminPerkPrizeReleaseBucketRow[];
  assigned_available?: number;
  source_reward_direct_available?: number;
  source_reward_total_available?: number;
  source_reward_assigned_available?: number;
};

export type AdminPerkPrizePerformance = {
  prizeId: string;
  drawsTotal: number;
  drawsToday: number;
  remainingTotal: number | null;
  remainingToday: number | null;
};

export type AdminPerkPrizeReleaseBucketRow = {
  id: string;
  prize_id: string;
  label: string | null;
  starts_at: string;
  ends_at: string | null;
  release_cap: number;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  drawsInBucket?: number;
  remainingInBucket?: number;
};

export type AdminPerkDrawRow = {
  id: string;
  bundle_reward_id: string;
  user_id: string;
  redemption_id: string;
  prize_id: string | null;
  awarded_reward_id: string | null;
  awarded_fulfillment_type: string;
  awarded_title: string;
  awarded_thumbnail: Record<string, unknown>;
  awarded_payload: Record<string, unknown>;
  award_status: string;
  created_at: string;
  profile?: AdminProfileRow;
  awarded_reward?: AdminRewardRow | null;
};

export type AdminPerkAnalytics = {
  activePrizeCount: number;
  drawsTotal: number;
  drawsToday: number;
  fallbackDrawsTotal: number;
  fallbackDrawsToday: number;
  fallbackRateTotal: number;
  fallbackRateToday: number;
};

export type AdminPerkTrendPoint = {
  date: string;
  draws: number;
  fallbackDraws: number;
};

export type AdminPerkDistributionRow = {
  key: string;
  label: string;
  draws: number;
  share: number;
};

export type AdminPerkProgramRow = {
  reward: AdminRewardRow;
  prizeCount: number;
  enabledPrizeCount: number;
  drawsTotal: number;
  drawsToday: number;
  fallbackConfigured: boolean;
};

export type AdminRewardCandidateRow = Pick<
  AdminRewardRow,
  | "id"
  | "title"
  | "distribution_mode"
  | "fulfillment_type"
  | "status"
  | "is_enabled"
  | "visibility_mode"
> & {
  total_available?: number;
  direct_available?: number;
  assigned_available?: number;
};

type AdminRewardAssignmentCountRow = {
  reward_id: string;
  total_available: number;
  direct_available: number;
  assigned_available: number;
};

type AdminPerkPrizeAssignmentCountRow = {
  prize_id: string;
  assigned_available: number;
};

export type AdminInventoryItem = {
  id: string;
  campaign_id: string | null;
  item_type: "voucher_code" | "qr_code";
  payload: Record<string, unknown>;
  status: string;
  available_from: string | null;
  expires_at: string | null;
  uploaded_at: string;
  assigned_at: string | null;
  redeemed_at: string | null;
  batch_label: string | null;
  partner_reference: string | null;
};

export type AdminInventoryAdjustment = {
  id: string;
  reward_id: string;
  campaign_id: string | null;
  delta: number;
  reason: string;
  created_at: string;
  batch_label: string | null;
  partner_reference: string | null;
};

function isMissingPerkReleaseBucketError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return /perk_prize_release_buckets/i.test(String(record.message ?? ""));
}

function isMissingPerkPrizeInventoryAssignmentError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return /perk_prize_id|admin_reward_assignment_counts|admin_perk_prize_assignment_counts/i.test(
    `${String(record.message ?? "")} ${String(record.details ?? "")}`,
  );
}

function getStartOfTodayInLagosIso() {
  const offsetMs = 60 * 60 * 1000;
  const nowMs = Date.now();
  const startMs = Math.floor((nowMs + offsetMs) / 86_400_000) * 86_400_000 - offsetMs;
  return new Date(startMs).toISOString();
}

export async function getAdminPerkPrograms(
  supabase: SupabaseClient,
  filters: { campaignId?: string } = {},
): Promise<AdminPerkProgramRow[]> {
  const perks = await getAdminRewards(supabase, {
    campaignId: filters.campaignId,
    distributionMode: "perk_bundle",
  });

  if (perks.length === 0) {
    return [];
  }

  const perkIds = perks.map((perk) => perk.id);
  const [prizesResult, fallbackResult] = await Promise.all([
    supabase
      .from("perk_bundle_prizes")
      .select("id, bundle_reward_id, is_enabled")
      .in("bundle_reward_id", perkIds),
    supabase
      .from("rewards")
      .select("id, fulfillment_config")
      .in("id", perkIds),
  ]);

  if (prizesResult.error) {
    throw prizesResult.error;
  }

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  const startOfTodayIso = getStartOfTodayInLagosIso();
  const prizeCounts = new Map<string, { total: number; enabled: number }>();

  for (const prize of ((prizesResult.data ?? []) as Array<{ id: string; bundle_reward_id: string; is_enabled: boolean }>)) {
    const current = prizeCounts.get(prize.bundle_reward_id) ?? { total: 0, enabled: 0 };
    current.total += 1;
    if (prize.is_enabled) {
      current.enabled += 1;
    }
    prizeCounts.set(prize.bundle_reward_id, current);
  }

  const fallbackConfigured = new Map<string, boolean>(
    ((fallbackResult.data ?? []) as Array<{ id: string; fulfillment_config: Record<string, unknown> | null }>).map((row) => {
      const config =
        row.fulfillment_config && typeof row.fulfillment_config === "object"
          ? row.fulfillment_config
          : {};
      const fallback =
        config.fallback && typeof config.fallback === "object" && !Array.isArray(config.fallback)
          ? config.fallback
          : null;
      return [row.id, Boolean(fallback)];
    }),
  );

  const drawStats = await Promise.all(
    perkIds.map(async (perkId) => {
      const [allResult, todayResult] = await Promise.all([
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", perkId),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", perkId)
          .gte("created_at", startOfTodayIso),
      ]);

      if (allResult.error) throw allResult.error;
      if (todayResult.error) throw todayResult.error;

      return [perkId, { total: allResult.count ?? 0, today: todayResult.count ?? 0 }] as const;
    }),
  );

  const drawCountMap = new Map(drawStats);

  return perks.map((perk) => {
    const prizeCount = prizeCounts.get(perk.id) ?? { total: 0, enabled: 0 };
    const draws = drawCountMap.get(perk.id) ?? { total: 0, today: 0 };

    return {
      reward: perk,
      prizeCount: prizeCount.total,
      enabledPrizeCount: prizeCount.enabled,
      drawsTotal: draws.total,
      drawsToday: draws.today,
      fallbackConfigured: fallbackConfigured.get(perk.id) ?? false,
    };
  });
}

export async function getAdminRewardDetail(supabase: SupabaseClient, rewardId: string) {
  const detailSelect =
    "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, offer_expires_at, updated_at, thumbnail, terms, claim_steps, fulfillment_config, redemption_window_days, sort_order, starts_at, ends_at";
  const { data: reward, error } = await supabase
    .from("rewards")
    .select(`${detailSelect}, distribution_mode`)
    .eq("id", rewardId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const resolvedReward: AdminRewardDetail | null = (reward as AdminRewardDetail | null) ?? null;

  if (!resolvedReward) {
    return null;
  }

  const [itemsResult, adjustmentsResult, perkPrizesResult, perkRewardCandidatesResult] = await Promise.all([
    supabase
      .from("reward_inventory_items")
      .select("id, campaign_id, item_type, payload, status, available_from, expires_at, uploaded_at, assigned_at, redeemed_at, batch_label, partner_reference")
      .eq("reward_id", rewardId)
      .order("uploaded_at", { ascending: false })
      .limit(50),
    supabase
      .from("reward_inventory_adjustments")
      .select("id, reward_id, campaign_id, delta, reason, created_at, batch_label, partner_reference")
      .eq("reward_id", rewardId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("perk_bundle_prizes")
      .select("id, bundle_reward_id, prize_type, source_reward_id, title, thumbnail, config, weight, total_win_cap, daily_win_cap, available_from, expires_at, sort_order, is_enabled, created_at, updated_at")
      .eq("bundle_reward_id", rewardId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("rewards")
      .select("id, title, fulfillment_type, visibility_mode, distribution_mode, status, is_enabled, total_available")
      .neq("id", rewardId)
      .order("title", { ascending: true }),
  ]);

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  if (adjustmentsResult.error) {
    throw adjustmentsResult.error;
  }

  if (perkPrizesResult.error) {
    throw perkPrizesResult.error;
  }

  if (perkRewardCandidatesResult.error) {
    throw perkRewardCandidatesResult.error;
  }

  let perkRewardCandidates = ((perkRewardCandidatesResult.data ?? []) as AdminRewardCandidateRow[])
    .filter((candidate) => candidate.distribution_mode !== "perk_bundle");

  if (perkRewardCandidates.length > 0) {
    const assignmentCountsResult = await supabase
      .rpc("admin_reward_assignment_counts", {
        p_reward_ids: perkRewardCandidates.map((candidate) => candidate.id),
      });

    if (assignmentCountsResult.error && !isMissingPerkPrizeInventoryAssignmentError(assignmentCountsResult.error)) {
      throw assignmentCountsResult.error;
    }

    const assignmentCountRows = Array.isArray(assignmentCountsResult.data)
      ? assignmentCountsResult.data
      : [];
    const assignmentCounts = new Map(
      assignmentCountRows.map((row: AdminRewardAssignmentCountRow) => [row.reward_id, row]),
    );

    perkRewardCandidates = perkRewardCandidates.map((candidate) => {
      const stats = assignmentCounts.get(candidate.id);
      return {
        ...candidate,
        total_available: (stats?.total_available ?? candidate.total_available ?? 0) as number,
        direct_available: (stats?.direct_available ?? candidate.total_available ?? 0) as number,
        assigned_available: (stats?.assigned_available ?? 0) as number,
      };
    });
  }

  const allPerkRewardCandidates = perkRewardCandidates;
  const sourceRewards = new Map(
    allPerkRewardCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const perkPrizeRows = (perkPrizesResult.data ?? []) as AdminPerkPrizeRow[];
  const existingRewardPrizeIds = new Set(
    perkPrizeRows
      .filter((prize) => prize.prize_type === "reward" && Boolean(prize.source_reward_id))
      .map((prize) => prize.source_reward_id as string),
  );
  perkRewardCandidates = allPerkRewardCandidates.filter(
    (candidate) => !existingRewardPrizeIds.has(candidate.id),
  );

  const isPerk = resolvedReward.distribution_mode === "perk_bundle";
  let perkPrizePerformance = new Map<string, AdminPerkPrizePerformance>();
  let perkPrizeReleaseBuckets = new Map<string, AdminPerkPrizeReleaseBucketRow[]>();
  let perkDrawHistory: AdminPerkDrawRow[] = [];
  let perkAnalytics: AdminPerkAnalytics = {
    activePrizeCount: 0,
    drawsTotal: 0,
    drawsToday: 0,
    fallbackDrawsTotal: 0,
    fallbackDrawsToday: 0,
    fallbackRateTotal: 0,
    fallbackRateToday: 0,
  };
  let perkTrend: AdminPerkTrendPoint[] = [];
  let perkDistribution: AdminPerkDistributionRow[] = [];

  if (isPerk) {
    const startOfTodayIso = getStartOfTodayInLagosIso();
    const prizeRows = perkPrizeRows;
    const trendStartDate = new Date();
    trendStartDate.setUTCDate(trendStartDate.getUTCDate() - 13);
    trendStartDate.setUTCHours(0, 0, 0, 0);
    const trendStartIso = trendStartDate.toISOString();

    const [
      recentDrawsResult,
      totalDrawsResult,
      todayDrawsResult,
      fallbackTotalResult,
      fallbackTodayResult,
      trendDrawsResult,
      releaseBucketsResult,
      prizeAssignmentCountsResult,
    ] =
      await Promise.all([
        supabase
          .from("perk_bundle_draws")
          .select("id, bundle_reward_id, user_id, redemption_id, prize_id, awarded_reward_id, awarded_fulfillment_type, awarded_title, awarded_thumbnail, awarded_payload, award_status, created_at")
          .eq("bundle_reward_id", rewardId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId)
          .gte("created_at", startOfTodayIso),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId)
          .is("prize_id", null),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId)
          .is("prize_id", null)
          .gte("created_at", startOfTodayIso),
        supabase
          .from("perk_bundle_draws")
          .select("id, prize_id, created_at")
          .eq("bundle_reward_id", rewardId)
          .gte("created_at", trendStartIso)
          .order("created_at", { ascending: true }),
        supabase
          .from("perk_prize_release_buckets")
          .select("id, prize_id, label, starts_at, ends_at, release_cap, sort_order, is_enabled, created_at, updated_at")
          .in("prize_id", prizeRows.map((prize) => prize.id))
          .order("sort_order", { ascending: true })
          .order("starts_at", { ascending: true }),
        supabase
          .rpc("admin_perk_prize_assignment_counts", {
            p_prize_ids: prizeRows.map((prize) => prize.id),
          }),
      ]);

    if (recentDrawsResult.error) throw recentDrawsResult.error;
    if (totalDrawsResult.error) throw totalDrawsResult.error;
    if (todayDrawsResult.error) throw todayDrawsResult.error;
    if (fallbackTotalResult.error) throw fallbackTotalResult.error;
    if (fallbackTodayResult.error) throw fallbackTodayResult.error;
    if (trendDrawsResult.error) throw trendDrawsResult.error;
    if (releaseBucketsResult.error && !isMissingPerkReleaseBucketError(releaseBucketsResult.error)) {
      throw releaseBucketsResult.error;
    }
    if (
      prizeAssignmentCountsResult.error
      && !isMissingPerkPrizeInventoryAssignmentError(prizeAssignmentCountsResult.error)
    ) {
      throw prizeAssignmentCountsResult.error;
    }

    const prizeAssignmentCountRows = Array.isArray(prizeAssignmentCountsResult.data)
      ? prizeAssignmentCountsResult.data
      : [];
    const prizeAssignmentCounts = new Map(
      prizeAssignmentCountRows.map((row: AdminPerkPrizeAssignmentCountRow) => [row.prize_id, row.assigned_available]),
    );

    const performanceRows = await Promise.all(
      prizeRows.map(async (prize) => {
        const [totalResult, todayResult] = await Promise.all([
          supabase
            .from("perk_bundle_draws")
            .select("id", { count: "exact", head: true })
            .eq("prize_id", prize.id),
          supabase
            .from("perk_bundle_draws")
            .select("id", { count: "exact", head: true })
            .eq("prize_id", prize.id)
            .gte("created_at", startOfTodayIso),
        ]);

        if (totalResult.error) throw totalResult.error;
        if (todayResult.error) throw todayResult.error;

        const drawsTotal = totalResult.count ?? 0;
        const drawsToday = todayResult.count ?? 0;

        return {
          prizeId: prize.id,
          drawsTotal,
          drawsToday,
          remainingTotal:
            prize.total_win_cap === null ? null : Math.max(0, prize.total_win_cap - drawsTotal),
          remainingToday:
            prize.daily_win_cap === null ? null : Math.max(0, prize.daily_win_cap - drawsToday),
        } satisfies AdminPerkPrizePerformance;
      }),
    );

    perkPrizePerformance = new Map(performanceRows.map((row) => [row.prizeId, row]));

    const bucketRows = (releaseBucketsResult.data ?? []) as AdminPerkPrizeReleaseBucketRow[];
    const trendDrawRows = (trendDrawsResult.data ?? []) as Array<{ id: string; prize_id: string | null; created_at: string }>;
    const bucketsByPrize = new Map<string, AdminPerkPrizeReleaseBucketRow[]>();

    for (const bucket of bucketRows) {
      const drawsInBucket = trendDrawRows.filter((draw) => {
        if (draw.prize_id !== bucket.prize_id) return false;
        const createdAt = new Date(draw.created_at).getTime();
        const startsAt = new Date(bucket.starts_at).getTime();
        const endsAt = bucket.ends_at ? new Date(bucket.ends_at).getTime() : null;
        return createdAt >= startsAt && (endsAt === null || createdAt < endsAt);
      }).length;

      const nextBucket = {
        ...bucket,
        drawsInBucket,
        remainingInBucket: Math.max(0, bucket.release_cap - drawsInBucket),
      };

      const current = bucketsByPrize.get(bucket.prize_id) ?? [];
      current.push(nextBucket);
      bucketsByPrize.set(bucket.prize_id, current);
    }

    perkPrizeReleaseBuckets = bucketsByPrize;

    const recentDraws = (recentDrawsResult.data ?? []) as AdminPerkDrawRow[];
    const [profiles, awardedRewards] = await Promise.all([
      getAdminProfilesByIds(
        supabase,
        recentDraws.map((draw) => draw.user_id),
      ),
      getAdminRewardsByIds(
        supabase,
        recentDraws.map((draw) => draw.awarded_reward_id ?? ""),
      ),
    ]);

    perkDrawHistory = recentDraws.map((draw) => ({
      ...draw,
      profile: profiles.get(draw.user_id),
      awarded_reward: draw.awarded_reward_id ? awardedRewards.get(draw.awarded_reward_id) ?? null : null,
    }));

    const drawsTotal = totalDrawsResult.count ?? 0;
    const drawsToday = todayDrawsResult.count ?? 0;
    const fallbackDrawsTotal = fallbackTotalResult.count ?? 0;
    const fallbackDrawsToday = fallbackTodayResult.count ?? 0;
    const trendDraws = trendDrawRows;
    const trendMap = new Map<string, { draws: number; fallbackDraws: number }>();

    for (let offset = 13; offset >= 0; offset -= 1) {
      const pointDate = new Date();
      pointDate.setUTCDate(pointDate.getUTCDate() - offset);
      const key = pointDate.toISOString().slice(0, 10);
      trendMap.set(key, { draws: 0, fallbackDraws: 0 });
    }

    for (const draw of trendDraws) {
      const key = draw.created_at.slice(0, 10);
      const current = trendMap.get(key);
      if (!current) continue;
      current.draws += 1;
      if (!draw.prize_id) {
        current.fallbackDraws += 1;
      }
    }

    perkTrend = Array.from(trendMap.entries()).map(([date, value]) => ({
      date,
      draws: value.draws,
      fallbackDraws: value.fallbackDraws,
    }));

    const totalPrizeDraws = performanceRows.reduce((sum, row) => sum + row.drawsTotal, 0);
    perkDistribution = prizeRows
      .map((prize) => {
        const draws = perkPrizePerformance.get(prize.id)?.drawsTotal ?? 0;
        const linkedReward = prize.source_reward_id ? sourceRewards.get(prize.source_reward_id) : null;
        return {
          key: prize.id,
          label: linkedReward?.title ?? prize.title ?? prize.source_reward_id ?? "Prize",
          draws,
          share: totalPrizeDraws > 0 ? draws / totalPrizeDraws : 0,
        };
      })
      .filter((row) => row.draws > 0)
      .sort((a, b) => b.draws - a.draws);

    if (fallbackDrawsTotal > 0) {
      perkDistribution.push({
        key: "fallback",
        label: "Fallback",
        draws: fallbackDrawsTotal,
        share: drawsTotal > 0 ? fallbackDrawsTotal / drawsTotal : 0,
      });
    }

    perkAnalytics = {
      activePrizeCount: prizeRows.filter((prize) => prize.is_enabled).length,
      drawsTotal,
      drawsToday,
      fallbackDrawsTotal,
      fallbackDrawsToday,
      fallbackRateTotal: drawsTotal > 0 ? fallbackDrawsTotal / drawsTotal : 0,
      fallbackRateToday: drawsToday > 0 ? fallbackDrawsToday / drawsToday : 0,
    };

    const decoratedPrizeRows = prizeRows.map((prize) => ({
      ...prize,
      assigned_available: Number(prizeAssignmentCounts.get(prize.id) ?? 0),
      source_reward_direct_available: prize.source_reward_id
        ? Number(sourceRewards.get(prize.source_reward_id)?.direct_available ?? 0)
        : 0,
      source_reward_total_available: prize.source_reward_id
        ? Number(sourceRewards.get(prize.source_reward_id)?.total_available ?? 0)
        : 0,
      source_reward_assigned_available: prize.source_reward_id
        ? Number(sourceRewards.get(prize.source_reward_id)?.assigned_available ?? 0)
        : 0,
    }));
    perkPrizeRows.splice(0, perkPrizeRows.length, ...decoratedPrizeRows);
  }

  return {
    reward: {
      ...resolvedReward,
      campaign: resolvedReward.campaign_id
        ? (await getAdminCampaignsByIds(supabase, [resolvedReward.campaign_id])).get(resolvedReward.campaign_id) ?? null
        : null,
    },
    inventoryItems: (itemsResult.data ?? []) as AdminInventoryItem[],
    adjustments: (adjustmentsResult.data ?? []) as AdminInventoryAdjustment[],
    perkPrizes: perkPrizeRows.map((prize) => ({
      ...prize,
      source_reward: prize.source_reward_id ? sourceRewards.get(prize.source_reward_id) ?? null : null,
      performance: perkPrizePerformance.get(prize.id) ?? null,
      releaseBuckets: perkPrizeReleaseBuckets.get(prize.id) ?? [],
    })),
    perkRewardCandidates,
    perkDrawHistory,
    perkAnalytics,
    perkTrend,
    perkDistribution,
  };
}

export async function getAdminPerkDraws(
  supabase: SupabaseClient,
  rewardId: string,
  limit = 250,
) {
  const { data, error } = await supabase
    .from("perk_bundle_draws")
    .select("id, bundle_reward_id, user_id, redemption_id, prize_id, awarded_reward_id, awarded_fulfillment_type, awarded_title, awarded_thumbnail, awarded_payload, award_status, created_at")
    .eq("bundle_reward_id", rewardId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const draws = (data ?? []) as AdminPerkDrawRow[];
  const [profiles, awardedRewards] = await Promise.all([
    getAdminProfilesByIds(
      supabase,
      draws.map((draw) => draw.user_id),
    ),
    getAdminRewardsByIds(
      supabase,
      draws.map((draw) => draw.awarded_reward_id ?? ""),
    ),
  ]);

  return draws.map((draw) => ({
    ...draw,
    profile: profiles.get(draw.user_id),
    awarded_reward: draw.awarded_reward_id ? awardedRewards.get(draw.awarded_reward_id) ?? null : null,
  }));
}
