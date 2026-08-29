import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { getAdminCourses } from "@/features/learning/admin/data";
import { getCourseEditorialLifecycle } from "@/features/learning/admin/course-readiness";
import { getAdminMissions } from "@/features/missions/admin/data";
import { getAdminRewards } from "@/features/rewards/admin/data";

export type AdminCatalogOverview = {
  coursesPublished: number;
  coursesPublishedLastSevenDays: number;
  coursesInReview: number;
  missionsPublished: number;
  points: {
    label: string;
    awarded: number;
    spent: number;
  } | null;
  pendingRewardClaims: number;
};

const PENDING_CLAIM_STATES = new Set(["details_submitted", "purchased"]);

async function getPlatformPointsSummary(supabase: SupabaseClient) {
  const { data: account, error: accountError } = await supabase
    .from("xp_accounts")
    .select("id, name, plural_name")
    .eq("scope", "platform")
    .eq("is_default", true)
    .maybeSingle();

  if (accountError || !account) {
    return null;
  }

  const { data, error } = await supabase
    .from("xp_transactions")
    .select("amount, direction")
    .eq("xp_account_id", account.id);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ amount: number; direction: string }>;

  return {
    label: account.plural_name || account.name || "Points",
    awarded: rows.filter((row) => row.direction === "earn").reduce((sum, row) => sum + row.amount, 0),
    spent: rows.filter((row) => row.direction === "spend").reduce((sum, row) => sum + row.amount, 0),
  };
}

async function getPendingCatalogRewardClaimCount(supabase: SupabaseClient) {
  const rewards = await getAdminRewards(supabase, {}, PLATFORM_CATALOG_WORKSPACE_ID);
  const rewardIds = rewards.map((reward) => reward.id);

  if (rewardIds.length === 0) {
    return 0;
  }

  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("claim_state")
    .in("reward_id", rewardIds);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ claim_state: string }>).filter((row) =>
    PENDING_CLAIM_STATES.has(row.claim_state),
  ).length;
}

/**
 * A deliberately narrow overview for the Platform Catalog pseudo-workspace —
 * only the metrics that make sense for organization_id-null content (course
 * and mission publishing, platform points circulation, catalog reward
 * claims). No learners, programmes, cohorts, onboarding checklist, or
 * cross-org activity — none of that has a real backing row for a workspace
 * that isn't a real organisation.
 */
export async function getAdminCatalogOverview(supabase: SupabaseClient): Promise<AdminCatalogOverview> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const [courses, missions, points, pendingRewardClaims] = await Promise.all([
    getAdminCourses(supabase, PLATFORM_CATALOG_WORKSPACE_ID),
    getAdminMissions(supabase, PLATFORM_CATALOG_WORKSPACE_ID),
    getPlatformPointsSummary(supabase),
    getPendingCatalogRewardClaimCount(supabase),
  ]);

  const publishedCourses = courses.filter((course) => course.status === "published");
  const coursesPublishedLastSevenDays = publishedCourses.filter(
    (course) => new Date(course.updated_at).getTime() >= sevenDaysAgo,
  ).length;
  const coursesInReview = courses.filter(
    (course) => getCourseEditorialLifecycle(course) === "in_review",
  ).length;
  const publishedMissions = missions.filter((mission) => mission.status === "published");

  return {
    coursesPublished: publishedCourses.length,
    coursesPublishedLastSevenDays,
    coursesInReview,
    missionsPublished: publishedMissions.length,
    points,
    pendingRewardClaims,
  };
}
