import "server-only";

import { toDependencyUnavailableError } from "@/lib/app-errors";
import { isDemoMode } from "@/lib/app-mode";
import { courses as seedCourses } from "@/lib/lessons";
import type { AppSupabaseClient } from "@/lib/supabase";
import {
  getLearningCatalog,
  getLearningCourse,
  getLearningCourseSummaries,
  getLearningLesson,
  getLearningQuiz,
} from "@/lib/supabase-learning";
import type { LearningRepository } from "@/features/app/repositories/contracts";
import {
  DemoLearningRepository,
  SupabaseLearningRepository,
} from "@/features/app/repositories/learning-adapters";

export function createLearningRepository(supabase: AppSupabaseClient | null): LearningRepository {
  if (isDemoMode) {
    return new DemoLearningRepository(seedCourses);
  }

  if (!supabase) {
    throw toDependencyUnavailableError(
      new Error("Supabase is required when APP_MODE=live."),
      "Learning content is temporarily unavailable.",
    );
  }

  return new SupabaseLearningRepository(supabase, {
    getCatalog: getLearningCatalog,
    getCourseSummaries: getLearningCourseSummaries,
    getCourse: getLearningCourse,
    getLesson: getLearningLesson,
    getQuiz: getLearningQuiz,
  });
}
