import "server-only";

import { toDependencyUnavailableError } from "@/lib/app-errors";
import { isDemoMode } from "@/lib/app-mode";
import { courses as seedCourses } from "@/lib/lessons";
import type { AppSupabaseClient } from "@/lib/supabase";
import {
  getLearningCatalog,
  getLearningCourse,
  getLearningLesson,
  getLearningQuiz,
} from "@/lib/supabase-learning";
import { getCachedPublishedLearningCourseCards } from "@/features/learning/data/course-card-data";
import type { LearningRepository } from "@/features/app/repositories/contracts";
import {
  DemoLearningRepository,
  SupabaseLearningRepository,
  type SupabaseLearningLoaders,
} from "@/features/app/repositories/learning-adapters";

type LearningRepositoryOverrides = Pick<
  Partial<SupabaseLearningLoaders<AppSupabaseClient>>,
  "getCourseCards"
>;

export function createLearningRepository(
  supabase: AppSupabaseClient | null,
  overrides: LearningRepositoryOverrides = {},
): LearningRepository {
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
    getCourseCards:
      overrides.getCourseCards ?? getCachedPublishedLearningCourseCards,
    getCourse: getLearningCourse,
    getLesson: getLearningLesson,
    getQuiz: getLearningQuiz,
  });
}
