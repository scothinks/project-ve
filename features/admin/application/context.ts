import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
  type UserProfile,
} from "@/lib/supabase-server";
import { isLiveMode } from "@/lib/app-mode";

type CountableTable =
  | "profiles"
  | "rewards"
  | "reward_redemptions"
  | "mission_proofs"
  | "missions"
  | "campaigns"
  | "xp_transactions";

export type AdminContext = {
  supabase: SupabaseClient;
  profile: UserProfile;
};

export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();

  if (!isLiveMode || !supabase) {
    redirect("/login");
  }

  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user) {
    redirect("/login");
  }

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return { supabase, profile };
}

async function getExactCount(supabase: SupabaseClient, table: CountableTable) {
  const { count, error } = await supabase.from(table).select("id", {
    count: "exact",
    head: true,
  });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getAdminOverview(supabase: SupabaseClient) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalRewards,
    totalMissions,
    totalCampaigns,
    pendingRedemptions,
    pendingProofItems,
    earnedToday,
  ] = await Promise.all([
    getExactCount(supabase, "profiles"),
    getExactCount(supabase, "rewards"),
    getExactCount(supabase, "missions"),
    getExactCount(supabase, "campaigns"),
    supabase
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .in("claim_state", ["details_submitted", "purchased"]),
    supabase
      .from("mission_proofs")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("xp_transactions")
      .select("amount")
      .eq("direction", "earn")
      .gte("created_at", todayStart.toISOString()),
  ]);

  if (pendingRedemptions.error) {
    throw pendingRedemptions.error;
  }

  if (pendingProofItems.error) {
    throw pendingProofItems.error;
  }

  if (earnedToday.error) {
    throw earnedToday.error;
  }

  return {
    totalUsers,
    totalRewards,
    totalMissions,
    totalCampaigns,
    pendingRedemptions: pendingRedemptions.count ?? 0,
    pendingProofItems: pendingProofItems.count ?? 0,
    xpEarnedToday: ((earnedToday.data ?? []) as Array<{ amount: number }>).reduce(
      (total, row) => total + row.amount,
      0,
    ),
  };
}
