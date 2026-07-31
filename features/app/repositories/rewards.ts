import "server-only";

import { toDependencyUnavailableError } from "@/lib/app-errors";
import { isDemoMode } from "@/lib/app-mode";
import {
  demoRewardStoreSnapshot,
} from "@/lib/rewards";
import type { AppSupabaseClient } from "@/lib/supabase";
import { getRewardStoreSnapshot } from "@/lib/supabase-rewards";
import type { RewardRepository } from "@/features/app/repositories/contracts";
import {
  DemoRewardRepository,
  SupabaseRewardRepository,
} from "@/features/app/repositories/reward-adapters";

export function createRewardRepository(supabase: AppSupabaseClient | null): RewardRepository {
  if (isDemoMode) {
    return new DemoRewardRepository(() => demoRewardStoreSnapshot);
  }

  if (!supabase) {
    throw toDependencyUnavailableError(
      new Error("Supabase is required when APP_MODE=live."),
      "Reward store is temporarily unavailable.",
    );
  }

  return new SupabaseRewardRepository(supabase, getRewardStoreSnapshot);
}
