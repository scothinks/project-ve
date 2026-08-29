import "server-only";

import { unstable_cache } from "next/cache";
import type {
  LearningCourseCard,
  LearningLessonCard,
} from "@/features/learning/application/course-card-model";
import type { UserMissionSummary } from "@/lib/missions";
import type { AppSupabaseClient } from "@/lib/supabase";
import {
  getCompletedLessonIds,
  getCourseProgress,
  type LessonProgressRecord,
} from "@/lib/progress";
import type {
  ContentValueTag,
  UserValueDimensionScore,
  UserValueProfile,
  ValueDimension,
} from "@/lib/values-assessment";
import {
  buildRecommendationReason,
  recommendationScoringPolicyVersion,
  scoreRecommendationCandidate,
  type RecommendationScoreComponents,
} from "@/features/recommendations/domain/scoring";
import { PERSONALIZED_RECOMMENDATION_EDITORIAL_CACHE_TAG } from "@/features/recommendations/data/editorial-cache";

type ContentTagRow = {
  id: string;
  content_type: "course" | "lesson" | "mission";
  content_id: string;
  dimension_id: string;
  weight: number;
  recommended_level: "beginner" | "intermediate" | "advanced" | null;
  outcome_type: "awareness" | "reflection" | "practice" | "action" | "assessment" | null;
  created_at: string;
  updated_at: string;
};

type UserValueProfileRow = {
  user_id: string;
  context_scope: "platform" | "organization";
  organization_id: string | null;
  latest_attempt_id: string | null;
  assessment_version_id: string | null;
  assessment_completed_at: string | null;
  readiness_level: "beginner" | "intermediate" | "advanced";
  primary_dimension_id: string | null;
  secondary_dimension_id: string | null;
  profile_summary: Record<string, unknown>;
  updated_at: string;
};

type UserValueDimensionScoreRow = {
  user_id: string;
  context_scope: "platform" | "organization";
  organization_id: string | null;
  dimension_id: string;
  score: number;
  confidence: number;
  updated_at: string;
};

type ValueDimensionRow = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  status: "active" | "archived";
};

type RecommendationSlot = "next_lesson" | "mission" | "course";

export type RecommendationProfileContext =
  | {
      scope: "organization";
      organizationId: string;
    }
  | {
      scope: "platform";
    };

type RecommendationHrefBuilder = {
  courseHref?: (course: LearningCourseCard) => string;
  lessonHref?: (lesson: LearningLessonCard) => string;
  missionHref?: () => string;
};

export type PersonalizedRecommendationItem = {
  id: string;
  content_type: "course" | "lesson" | "mission";
  title: string;
  description: string;
  href: string;
  reason: string;
  dimension_label: string | null;
  recommended_level: "beginner" | "intermediate" | "advanced" | null;
  score: number;
  score_policy_version: typeof recommendationScoringPolicyVersion;
  score_components: RecommendationScoreComponents;
  course?: LearningCourseCard;
  lesson?: LearningLessonCard;
  mission?: UserMissionSummary;
};

export type PersonalizedRecommendationSection = {
  id: RecommendationSlot;
  title: string;
  subtitle: string;
  items: PersonalizedRecommendationItem[];
};

function mapTag(row: ContentTagRow): ContentValueTag {
  return {
    id: row.id,
    contentType: row.content_type,
    contentId: row.content_id,
    dimensionId: row.dimension_id,
    weight: Number(row.weight),
    recommendedLevel: row.recommended_level,
    outcomeType: row.outcome_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pickBestTag(
  tags: ContentValueTag[],
  profile: UserValueProfile | null,
  userScores: UserValueDimensionScore[],
  options?: {
    completed?: boolean;
    recentlySeen?: boolean;
    progressionRelevant?: boolean;
    editorialPriority?: number;
  },
) {
  if (tags.length === 0) {
    return null;
  }

  const aggregateComponents = scoreRecommendationCandidate({
    tag: null,
    tags,
    profile,
    userScores,
    completed: options?.completed ?? false,
    recentlySeen: options?.recentlySeen,
    progressionRelevant: options?.progressionRelevant,
    editorialPriority: options?.editorialPriority,
  });
  let bestTag: {
    tag: ContentValueTag;
    score: number;
  } | null = null;

  for (const tag of tags) {
    const components = scoreRecommendationCandidate({
      tag,
      profile,
      userScores,
      completed: options?.completed ?? false,
      recentlySeen: options?.recentlySeen,
      progressionRelevant: options?.progressionRelevant,
      editorialPriority: options?.editorialPriority,
    });
    const score = components.total;

    if (!bestTag || score > bestTag.score) {
      bestTag = { tag, score };
    }
  }

  return bestTag
    ? {
        tag: bestTag.tag,
        score: aggregateComponents.total,
        components: aggregateComponents,
      }
    : null;
}

function scoreUntaggedCandidate(options?: {
  completed?: boolean;
  recentlySeen?: boolean;
  progressionRelevant?: boolean;
  editorialPriority?: number;
}) {
  return scoreRecommendationCandidate({
    tag: null,
    profile: null,
    userScores: [],
    completed: options?.completed ?? false,
    recentlySeen: options?.recentlySeen,
    progressionRelevant: options?.progressionRelevant,
    editorialPriority: options?.editorialPriority,
  });
}

function normalizeRecommendationProfileContext(
  context?: RecommendationProfileContext,
): RecommendationProfileContext {
  return context?.scope === "organization"
    ? context
    : { scope: "platform" };
}

async function loadProfileData(
  supabase: AppSupabaseClient,
  userId: string,
  context?: RecommendationProfileContext,
) {
  const normalizedContext = normalizeRecommendationProfileContext(context);
  const profileQuery = supabase
    .from("user_value_profiles")
    .select(
      "user_id, context_scope, organization_id, latest_attempt_id, assessment_version_id, assessment_completed_at, readiness_level, primary_dimension_id, secondary_dimension_id, profile_summary, updated_at",
    )
    .eq("user_id", userId)
    .eq("context_scope", normalizedContext.scope);
  const scoreQuery = supabase
    .from("user_value_dimension_scores")
    .select("user_id, context_scope, organization_id, dimension_id, score, confidence, updated_at")
    .eq("user_id", userId)
    .eq("context_scope", normalizedContext.scope);

  if (normalizedContext.scope === "organization") {
    profileQuery.eq("organization_id", normalizedContext.organizationId);
    scoreQuery.eq("organization_id", normalizedContext.organizationId);
  } else {
    profileQuery.is("organization_id", null);
    scoreQuery.is("organization_id", null);
  }

  const [{ data: profile }, { data: scores }] = await Promise.all([
    profileQuery.maybeSingle(),
    scoreQuery,
  ]);

  const typedProfile = profile as UserValueProfileRow | null;
  const userProfile: UserValueProfile | null = typedProfile
    ? {
        userId: typedProfile.user_id,
        contextScope: typedProfile.context_scope,
        organizationId: typedProfile.organization_id,
        latestAttemptId: typedProfile.latest_attempt_id,
        assessmentVersionId: typedProfile.assessment_version_id,
        assessmentCompletedAt: typedProfile.assessment_completed_at,
        readinessLevel: typedProfile.readiness_level,
        primaryDimensionId: typedProfile.primary_dimension_id,
        secondaryDimensionId: typedProfile.secondary_dimension_id,
        profileSummary: typedProfile.profile_summary ?? {},
        updatedAt: typedProfile.updated_at,
      }
    : null;

  const userScores: UserValueDimensionScore[] = ((scores ?? []) as UserValueDimensionScoreRow[]).map((score) => ({
    userId: score.user_id,
    contextScope: score.context_scope,
    organizationId: score.organization_id,
    dimensionId: score.dimension_id,
    score: Number(score.score),
    confidence: Number(score.confidence),
    updatedAt: score.updated_at,
  }));

  return { userProfile, userScores };
}

async function loadEditorialRecommendationData(
  supabase: AppSupabaseClient,
  candidateIds: {
    courseIds: string[];
    lessonIds: string[];
  missionIds: string[];
  },
) {
  const courseIds = Array.from(new Set(candidateIds.courseIds)).sort();
  const lessonIds = Array.from(new Set(candidateIds.lessonIds)).sort();
  const missionIds = Array.from(new Set(candidateIds.missionIds)).sort();
  const contentIds = Array.from(new Set([...courseIds, ...lessonIds, ...missionIds]));
  const allowedKeys = new Set([
    ...courseIds.map((id) => `course:${id}`),
    ...lessonIds.map((id) => `lesson:${id}`),
    ...missionIds.map((id) => `mission:${id}`),
  ]);

  // Only published content tags and active dimensions are cacheable editorial
  // configuration. The authenticated user's profile and scores are loaded by
  // loadProfileData and never enter this cross-user cache.
  return unstable_cache(
    async () => {
      const [tagsResult, dimensionsResult] = await Promise.all([
        contentIds.length > 0
          ? supabase
              .from("content_value_tags")
              .select("id, content_type, content_id, dimension_id, weight, recommended_level, outcome_type, created_at, updated_at")
              .in("content_id", contentIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("value_dimensions")
          .select("id, label, description, sort_order, status")
          .eq("status", "active")
          .order("sort_order", { ascending: true }),
      ]);

      if (tagsResult.error) throw tagsResult.error;
      if (dimensionsResult.error) throw dimensionsResult.error;

      const tags = ((tagsResult.data ?? []) as ContentTagRow[])
        .filter((row) => allowedKeys.has(`${row.content_type}:${row.content_id}`))
        .map(mapTag);
      const valueDimensions: ValueDimension[] = ((dimensionsResult.data ?? []) as ValueDimensionRow[])
        .map((dimension) => ({
          id: dimension.id,
          label: dimension.label,
          description: dimension.description,
          sortOrder: dimension.sort_order,
          status: dimension.status,
        }));

      return { tags, valueDimensions };
    },
    [
      PERSONALIZED_RECOMMENDATION_EDITORIAL_CACHE_TAG,
      `courses:${courseIds.join(",")}`,
      `lessons:${lessonIds.join(",")}`,
      `missions:${missionIds.join(",")}`,
    ],
    {
      revalidate: 300,
      tags: [PERSONALIZED_RECOMMENDATION_EDITORIAL_CACHE_TAG],
    },
  )();
}

function buildDimensionLabelMap(dimensions: ValueDimension[]) {
  return new Map(dimensions.map((dimension) => [dimension.id, dimension.label]));
}

function makeSection(
  id: RecommendationSlot,
  title: string,
  subtitle: string,
  item: PersonalizedRecommendationItem | null,
): PersonalizedRecommendationSection | null {
  if (!item) {
    return null;
  }

  return {
    id,
    title,
    subtitle,
    items: [item],
  };
}

function buildFallbackScore() {
  return scoreUntaggedCandidate({
    progressionRelevant: false,
    recentlySeen: false,
  });
}

function getFallbackReason(slot: RecommendationSlot) {
  return slot === "mission"
    ? "A practical next step you can take right away."
    : "A good next step for your current learning path.";
}

function reasonForRecommendation(params: {
  slot: RecommendationSlot;
  dimensionLabel: string | null;
  components: RecommendationScoreComponents;
  hasProfile: boolean;
}) {
  return buildRecommendationReason({
    dimensionLabel: params.dimensionLabel,
    components: params.components,
    hasProfile: params.hasProfile,
    fallbackReason: getFallbackReason(params.slot),
  });
}

export async function getPersonalizedDashboardRecommendations({
  supabase,
  userId,
  catalog,
  lessonProgress,
  missions,
  profileContext,
  hrefBuilder,
}: {
  supabase: AppSupabaseClient | null;
  userId: string;
  catalog: LearningCourseCard[];
  lessonProgress: LessonProgressRecord[];
  missions: UserMissionSummary[];
  profileContext?: RecommendationProfileContext;
  hrefBuilder?: RecommendationHrefBuilder;
}) {
  if (!supabase || catalog.length === 0) {
    return {
      sections: [] as PersonalizedRecommendationSection[],
      userProfile: null as UserValueProfile | null,
      userScores: [] as UserValueDimensionScore[],
    };
  }

  const allLessons = catalog.flatMap((course) => course.lessons);
  const [{ userProfile, userScores }, { tags, valueDimensions }] = await Promise.all([
    loadProfileData(supabase, userId, profileContext),
    loadEditorialRecommendationData(supabase, {
      courseIds: catalog.map((course) => course.id),
      lessonIds: allLessons.map((lesson) => lesson.id),
      missionIds: missions.map((mission) => mission.id),
    }),
  ]);
  const courseHref = hrefBuilder?.courseHref ?? ((course: LearningCourseCard) => `/courses/${course.id}`);
  const lessonHref = hrefBuilder?.lessonHref ?? ((lesson: LearningLessonCard) => `/lessons/${lesson.id}`);
  const missionHref = hrefBuilder?.missionHref ?? (() => "/missions");
  const dimensionLabels = buildDimensionLabelMap(valueDimensions);
  const completedLessonIds = getCompletedLessonIds(lessonProgress, allLessons);
  const completedCourseIds = new Set(
    catalog
      .filter((course) => {
        const progress = getCourseProgress(course, completedLessonIds);
        return progress.lessonCount > 0 && progress.completedLessons === progress.lessonCount;
      })
      .map((course) => course.id),
  );

  const tagsByKey = new Map<string, ContentValueTag[]>();
  for (const tag of tags) {
    const key = `${tag.contentType}:${tag.contentId}`;
    const existing = tagsByKey.get(key) ?? [];
    existing.push(tag);
    tagsByKey.set(key, existing);
  }

  const hasProfile = Boolean(userProfile?.assessmentCompletedAt);
  const seenCourseIds = new Set<string>();
  const courseById = new Map(catalog.map((course) => [course.id, course]));
  const progressByLessonId = new Map(lessonProgress.map((progress) => [progress.lesson_id, progress]));

  function lessonHasExposure(lesson: LearningLessonCard) {
    const progress = progressByLessonId.get(lesson.id);
    return Boolean(progress && ((progress.completed_pages?.length ?? 0) > 0 || progress.completed_at));
  }

  function lessonIsProgressionRelevant(lesson: LearningLessonCard) {
    if (lessonHasExposure(lesson)) {
      return true;
    }

    const course = courseById.get(lesson.courseId);
    if (!course) {
      return false;
    }

    const lessonIndex = course.lessons.findIndex((item) => item.id === lesson.id);
    if (lessonIndex <= 0) {
      return true;
    }

    return course.lessons
      .slice(0, lessonIndex)
      .some((previousLesson) => completedLessonIds.has(previousLesson.id));
  }

  function courseHasExposure(course: LearningCourseCard) {
    return course.lessons.some((lesson) => lessonHasExposure(lesson) || completedLessonIds.has(lesson.id));
  }

  function courseIsProgressionRelevant(course: LearningCourseCard) {
    return course.lessons.length > 0 && !completedCourseIds.has(course.id);
  }

  const lessonCandidates = allLessons
    .filter((lesson) => !completedLessonIds.has(lesson.id))
    .map((lesson) => {
      const best = pickBestTag(
        tagsByKey.get(`lesson:${lesson.id}`) ?? [],
        userProfile,
        userScores,
        {
          completed: completedLessonIds.has(lesson.id),
          progressionRelevant: lessonIsProgressionRelevant(lesson),
          recentlySeen: lessonHasExposure(lesson),
        },
      );
      const fallbackComponents = scoreUntaggedCandidate({
        completed: completedLessonIds.has(lesson.id),
        progressionRelevant: lessonIsProgressionRelevant(lesson),
        recentlySeen: lessonHasExposure(lesson),
      });
      const baseScore = best?.score ?? fallbackComponents.total;
      const duplicatePenalty = seenCourseIds.has(lesson.courseId) ? -30 : 0;
      const components = best?.components ?? fallbackComponents;

      return {
        lesson,
        bestTag: best?.tag ?? null,
        components: {
          ...components,
          total: Number((components.total + duplicatePenalty).toFixed(2)),
        },
        score: baseScore + duplicatePenalty,
      };
    })
    .sort((first, second) => second.score - first.score || first.lesson.order - second.lesson.order);

  const selectedLessonCandidate = lessonCandidates[0] ?? null;
  if (selectedLessonCandidate) {
    seenCourseIds.add(selectedLessonCandidate.lesson.courseId);
  }

  const missionCandidates = missions
    .filter((mission) => mission.status !== "completed")
    .map((mission) => {
      const best = pickBestTag(
        tagsByKey.get(`mission:${mission.id}`) ?? [],
        userProfile,
        userScores,
        {
          completed: false,
          progressionRelevant: true,
          recentlySeen: mission.status !== "not_started",
        },
      );
      const fallbackComponents = scoreUntaggedCandidate({
        progressionRelevant: true,
        recentlySeen: mission.status !== "not_started",
      });
      const components = best?.components ?? fallbackComponents;

      return {
        mission,
        bestTag: best?.tag ?? null,
        components,
        score: components.total,
      };
    })
    .sort((first, second) => second.score - first.score || first.mission.title.localeCompare(second.mission.title));

  const courseCandidates = catalog
    .filter((course) => !completedCourseIds.has(course.id))
    .map((course) => {
      const best = pickBestTag(
        tagsByKey.get(`course:${course.id}`) ?? [],
        userProfile,
        userScores,
        {
          completed: completedCourseIds.has(course.id),
          progressionRelevant: courseIsProgressionRelevant(course),
          recentlySeen: courseHasExposure(course),
          editorialPriority: course.level === "beginner" ? 3 : 0,
        },
      );
      const fallbackComponents = scoreUntaggedCandidate({
        completed: completedCourseIds.has(course.id),
        progressionRelevant: courseIsProgressionRelevant(course),
        recentlySeen: courseHasExposure(course),
        editorialPriority: course.level === "beginner" ? 3 : 0,
      });
      const baseScore = best?.score ?? fallbackComponents.total;
      const duplicatePenalty = seenCourseIds.has(course.id) ? -30 : 0;
      const components = best?.components ?? fallbackComponents;
      return {
        course,
        bestTag: best?.tag ?? null,
        components: {
          ...components,
          total: Number((components.total + duplicatePenalty).toFixed(2)),
        },
        score: baseScore + duplicatePenalty,
      };
    })
    .sort((first, second) => second.score - first.score || first.course.estimatedMinutes - second.course.estimatedMinutes);

  const selectedCourseCandidate = courseCandidates[0] ?? null;

  const fallbackLesson = allLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? null;
  const fallbackCourse = catalog.find((course) => !completedCourseIds.has(course.id)) ?? null;
  const fallbackMission = missions.find((mission) => mission.status !== "completed") ?? null;

  const lessonRecommendation =
    selectedLessonCandidate
      ? {
          id: selectedLessonCandidate.lesson.id,
          content_type: "lesson" as const,
          title: selectedLessonCandidate.lesson.title,
          description: selectedLessonCandidate.lesson.summary,
          href: lessonHref(selectedLessonCandidate.lesson),
          reason: reasonForRecommendation({
            slot: "next_lesson",
            dimensionLabel: selectedLessonCandidate.bestTag
              ? (dimensionLabels.get(selectedLessonCandidate.bestTag.dimensionId) ?? null)
              : null,
            components: selectedLessonCandidate.components,
            hasProfile,
          }),
          dimension_label: selectedLessonCandidate.bestTag
            ? (dimensionLabels.get(selectedLessonCandidate.bestTag.dimensionId) ?? null)
            : null,
          recommended_level: selectedLessonCandidate.bestTag?.recommendedLevel ?? null,
          score: Number(selectedLessonCandidate.score.toFixed(2)),
          score_policy_version: recommendationScoringPolicyVersion,
          score_components: selectedLessonCandidate.components,
          lesson: selectedLessonCandidate.lesson,
        }
      : fallbackLesson
        ? {
            id: fallbackLesson.id,
            content_type: "lesson" as const,
            title: fallbackLesson.title,
            description: fallbackLesson.summary,
            href: lessonHref(fallbackLesson),
            reason: "A good next step for your current learning path.",
            dimension_label: null,
            recommended_level: null,
            score: 0,
            score_policy_version: recommendationScoringPolicyVersion,
            score_components: buildFallbackScore(),
            lesson: fallbackLesson,
          }
        : null;

  const missionRecommendation =
    missionCandidates[0]
      ? {
          id: missionCandidates[0].mission.id,
          content_type: "mission" as const,
          title: missionCandidates[0].mission.title,
          description: missionCandidates[0].mission.description,
          href: missionHref(),
          reason: reasonForRecommendation({
            slot: "mission",
            dimensionLabel: missionCandidates[0].bestTag
              ? (dimensionLabels.get(missionCandidates[0].bestTag.dimensionId) ?? null)
              : null,
            components: missionCandidates[0].components,
            hasProfile,
          }),
          dimension_label: missionCandidates[0].bestTag
            ? (dimensionLabels.get(missionCandidates[0].bestTag.dimensionId) ?? null)
            : null,
          recommended_level: missionCandidates[0].bestTag?.recommendedLevel ?? null,
          score: Number(missionCandidates[0].score.toFixed(2)),
          score_policy_version: recommendationScoringPolicyVersion,
          score_components: missionCandidates[0].components,
          mission: missionCandidates[0].mission,
        }
      : fallbackMission
        ? {
            id: fallbackMission.id,
            content_type: "mission" as const,
            title: fallbackMission.title,
            description: fallbackMission.description,
            href: missionHref(),
            reason: "A practical next step you can take right away.",
            dimension_label: null,
            recommended_level: null,
            score: 0,
            score_policy_version: recommendationScoringPolicyVersion,
            score_components: buildFallbackScore(),
            mission: fallbackMission,
          }
        : null;

  const courseRecommendation =
    selectedCourseCandidate
      ? {
          id: selectedCourseCandidate.course.id,
          content_type: "course" as const,
          title: selectedCourseCandidate.course.title,
          description: selectedCourseCandidate.course.description,
          href: courseHref(selectedCourseCandidate.course),
          reason: reasonForRecommendation({
            slot: "course",
            dimensionLabel: selectedCourseCandidate.bestTag
              ? (dimensionLabels.get(selectedCourseCandidate.bestTag.dimensionId) ?? null)
              : null,
            components: selectedCourseCandidate.components,
            hasProfile,
          }),
          dimension_label: selectedCourseCandidate.bestTag
            ? (dimensionLabels.get(selectedCourseCandidate.bestTag.dimensionId) ?? null)
            : null,
          recommended_level: selectedCourseCandidate.bestTag?.recommendedLevel ?? null,
          score: Number(selectedCourseCandidate.score.toFixed(2)),
          score_policy_version: recommendationScoringPolicyVersion,
          score_components: selectedCourseCandidate.components,
          course: selectedCourseCandidate.course,
        }
      : fallbackCourse
        ? {
            id: fallbackCourse.id,
            content_type: "course" as const,
            title: fallbackCourse.title,
            description: fallbackCourse.description,
            href: courseHref(fallbackCourse),
            reason: "A good next step for your current learning path.",
            dimension_label: null,
            recommended_level: null,
            score: 0,
            score_policy_version: recommendationScoringPolicyVersion,
            score_components: buildFallbackScore(),
            course: fallbackCourse,
          }
        : null;

  const sections = [
    makeSection(
      "next_lesson",
      "Recommended next lesson",
      "A focused next step for where you are starting from.",
      lessonRecommendation,
    ),
    makeSection(
      "mission",
      "Recommended mission",
      "Put the lesson into action with a practical challenge.",
      missionRecommendation,
    ),
    makeSection(
      "course",
      "Recommended course",
      "Go deeper with a course that fits your current path.",
      courseRecommendation,
    ),
  ].filter((section): section is PersonalizedRecommendationSection => Boolean(section));

  return {
    sections,
    userProfile,
    userScores,
  };
}
