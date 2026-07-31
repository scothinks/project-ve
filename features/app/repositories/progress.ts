import "server-only";

import { toDependencyUnavailableError } from "@/lib/app-errors";
import { isDemoMode } from "@/lib/app-mode";
import { getDemoLessonProgress } from "@/lib/demo-progress-store";
import type { AppSupabaseClient } from "@/lib/supabase";
import { getLessonProgress } from "@/lib/progress";
import type { ProgressRepository } from "@/features/app/repositories/contracts";
import {
  DemoProgressRepository,
  SupabaseProgressRepository,
} from "@/features/app/repositories/progress-adapters";

export function createProgressRepository(supabase: AppSupabaseClient | null): ProgressRepository {
  if (isDemoMode) {
    return new DemoProgressRepository(getDemoLessonProgress);
  }

  if (!supabase) {
    throw toDependencyUnavailableError(
      new Error("Supabase is required when APP_MODE=live."),
      "Progress is temporarily unavailable.",
    );
  }

  return new SupabaseProgressRepository(supabase, getLessonProgress);
}
