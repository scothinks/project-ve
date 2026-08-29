import "server-only";

import { toDependencyUnavailableError } from "@/lib/app-errors";
import { isDemoMode } from "@/lib/app-mode";
import { getMissionSummaries } from "@/lib/demo-progress-store";
import type { AppSupabaseClient } from "@/lib/supabase";
import { getSupabaseMissionSummaries } from "@/lib/supabase-missions";
import type { MissionRepository } from "@/features/app/repositories/contracts";
import {
  DemoMissionRepository,
  SupabaseMissionRepository,
} from "@/features/app/repositories/mission-adapters";

export function createMissionRepository(supabase: AppSupabaseClient | null): MissionRepository {
  if (isDemoMode) {
    return new DemoMissionRepository((params) =>
      getMissionSummaries(params.userId, params.origin, params.referralCode),
    );
  }

  if (!supabase) {
    throw toDependencyUnavailableError(
      new Error("Supabase is required when APP_MODE=live."),
      "Missions are temporarily unavailable.",
    );
  }

  return new SupabaseMissionRepository(supabase, (client, params) =>
    getSupabaseMissionSummaries({
      supabase: client,
      userId: params.userId,
      referralCode: params.referralCode,
      origin: params.origin,
    }),
  );
}
