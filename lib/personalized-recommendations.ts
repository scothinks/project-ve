import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, Lesson } from "@/lib/lessons";
import type { UserMissionSummary } from "@/lib/missions";
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
  course?: Course;
  lesson?: Lesson;
  mission?: UserMissionSummary;
};

export type PersonalizedRecommendationSection = {
  id: RecommendationSlot;
  title: string;
  subtitle: string;
  items: PersonalizedRecommendationItem[];
};

function buildReason(
  slot: RecommendationSlot,
  dimensionLabel: string | null,
  hasProfile: boolean,
) {
  if (dimensionLabel) {
    return `Recommended to help you build confidence with ${dimensionLabel}.`;
  }

  if (slot === "next_lesson") {
    return hasProfile
      ? "Suggested because it matches your Values Starter Check."
      : "A good next step for your current learning path.";
  }

  if (slot === "mission") {
    return hasProfile
      ? "Suggested because it matches your Values Starter Check."
      : "A practical next step you can take right away.";
  }

  return hasProfile
    ? "A good next step based on your Values Starter Check."
    : "A good next step for your current learning path.";
}

function scoreTag(params: {
  tag: ContentValueTag;
  readinessLevel: "beginner" | "intermediate" | "advanced" | null;
  primaryDimensionId: string | null;
  secondaryDimensionId: string | null;
}) {
  const { tag, readinessLevel, primaryDimensionId, secondaryDimensionId } = params;
  let score = 0;

  if (tag.dimensionId === primaryDimensionId) {
    score += 50;
  } else if (tag.dimensionId === secondaryDimensionId) {
    score += 35;
  }

  if (tag.recommendedLevel && tag.recommendedLevel === readinessLevel) {
    score += 20;
  } else if (!tag.recommendedLevel) {
    score += 10;
  }

  score += 10 * tag.weight;
  return score;
}

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
) {
  if (tags.length === 0) {
    return null;
  }

  let best: { tag: ContentValueTag; score: number } | null = null;

  for (const tag of tags) {
    const score = scoreTag({
      tag,
      readinessLevel: profile?.readinessLevel ?? null,
      primaryDimensionId: profile?.primaryDimensionId ?? null,
      secondaryDimensionId: profile?.secondaryDimensionId ?? null,
    });

    if (!best || score > best.score) {
      best = { tag, score };
    }
  }

  return best;
}

async function loadProfileData(supabase: SupabaseClient, userId: string) {
  const [{ data: profile }, { data: scores }, { data: dimensions }] = await Promise.all([
    supabase
      .from("user_value_profiles")
      .select(
        "user_id, latest_attempt_id, assessment_version_id, assessment_completed_at, readiness_level, primary_dimension_id, secondary_dimension_id, profile_summary, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle<UserValueProfileRow>(),
    supabase
      .from("user_value_dimension_scores")
      .select("user_id, dimension_id, score, confidence, updated_at")
      .eq("user_id", userId)
      .returns<UserValueDimensionScoreRow[]>(),
    supabase
      .from("value_dimensions")
      .select("id, label, description, sort_order, status")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<ValueDimensionRow[]>(),
  ]);

  const valueDimensions: ValueDimension[] = (dimensions ?? []).map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    description: dimension.description,
    sortOrder: dimension.sort_order,
    status: dimension.status,
  }));

  const userProfile: UserValueProfile | null = profile
    ? {
        userId: profile.user_id,
        latestAttemptId: profile.latest_attempt_id,
        assessmentVersionId: profile.assessment_version_id,
        assessmentCompletedAt: profile.assessment_completed_at,
        readinessLevel: profile.readiness_level,
        primaryDimensionId: profile.primary_dimension_id,
        secondaryDimensionId: profile.secondary_dimension_id,
        profileSummary: profile.profile_summary ?? {},
        updatedAt: profile.updated_at,
      }
    : null;

  const userScores: UserValueDimensionScore[] = (scores ?? []).map((score) => ({
    userId: score.user_id,
    dimensionId: score.dimension_id,
    score: Number(score.score),
    confidence: Number(score.confidence),
    updatedAt: score.updated_at,
  }));

  return { userProfile, userScores, valueDimensions };
}

async function loadRelevantTags(
  supabase: SupabaseClient,
  candidateIds: {
    courseIds: string[];
    lessonIds: string[];
  missionIds: string[];
  },
) {
  if (
    candidateIds.courseIds.length === 0
    && candidateIds.lessonIds.length === 0
    && candidateIds.missionIds.length === 0
  ) {
    return [];
  }

  const [courseTagsResult, lessonTagsResult, missionTagsResult] = await Promise.all([
    candidateIds.courseIds.length > 0
      ? supabase
          .from("content_value_tags")
          .select("id, content_type, content_id, dimension_id, weight, recommended_level, outcome_type, created_at, updated_at")
          .eq("content_type", "course")
          .in("content_id", candidateIds.courseIds)
          .returns<ContentTagRow[]>()
      : Promise.resolve({ data: [] as ContentTagRow[], error: null }),
    candidateIds.lessonIds.length > 0
      ? supabase
          .from("content_value_tags")
          .select("id, content_type, content_id, dimension_id, weight, recommended_level, outcome_type, created_at, updated_at")
          .eq("content_type", "lesson")
          .in("content_id", candidateIds.lessonIds)
          .returns<ContentTagRow[]>()
      : Promise.resolve({ data: [] as ContentTagRow[], error: null }),
    candidateIds.missionIds.length > 0
      ? supabase
          .from("content_value_tags")
          .select("id, content_type, content_id, dimension_id, weight, recommended_level, outcome_type, created_at, updated_at")
          .eq("content_type", "mission")
          .in("content_id", candidateIds.missionIds)
          .returns<ContentTagRow[]>()
      : Promise.resolve({ data: [] as ContentTagRow[], error: null }),
  ]);

  const rows: ContentTagRow[] = [];

  for (const result of [courseTagsResult, lessonTagsResult, missionTagsResult]) {
    if (!result.error && result.data) {
      rows.push(...result.data);
    }
  }

  return rows.map(mapTag);
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

export async function getPersonalizedDashboardRecommendations({
  supabase,
  userId,
  catalog,
  lessonProgress,
  missions,
}: {
  supabase: SupabaseClient | null;
  userId: string;
  catalog: Course[];
  lessonProgress: LessonProgressRecord[];
  missions: UserMissionSummary[];
}) {
  if (!supabase || catalog.length === 0) {
    return {
      sections: [] as PersonalizedRecommendationSection[],
      userProfile: null as UserValueProfile | null,
      userScores: [] as UserValueDimensionScore[],
    };
  }

  const { userProfile, userScores, valueDimensions } = await loadProfileData(supabase, userId);
  const dimensionLabels = buildDimensionLabelMap(valueDimensions);
  const allLessons = catalog.flatMap((course) => course.lessons);
  const completedLessonIds = getCompletedLessonIds(lessonProgress, allLessons);
  const completedCourseIds = new Set(
    catalog
      .filter((course) => {
        const progress = getCourseProgress(course, completedLessonIds);
        return progress.lessonCount > 0 && progress.completedLessons === progress.lessonCount;
      })
      .map((course) => course.id),
  );

  const tags = await loadRelevantTags(supabase, {
    courseIds: catalog.map((course) => course.id),
    lessonIds: allLessons.map((lesson) => lesson.id),
    missionIds: missions.map((mission) => mission.id),
  });

  const tagsByKey = new Map<string, ContentValueTag[]>();
  for (const tag of tags) {
    const key = `${tag.contentType}:${tag.contentId}`;
    const existing = tagsByKey.get(key) ?? [];
    existing.push(tag);
    tagsByKey.set(key, existing);
  }

  const hasProfile = Boolean(userProfile?.assessmentCompletedAt);
  const seenCourseIds = new Set<string>();

  const lessonCandidates = allLessons
    .filter((lesson) => !completedLessonIds.has(lesson.id))
    .map((lesson) => {
      const best = pickBestTag(tagsByKey.get(`lesson:${lesson.id}`) ?? [], userProfile);
      const baseScore =
        best?.score
        ?? (lesson.status === "completed" ? -100 : lesson.courseId ? 12 : 10);
      const duplicatePenalty = seenCourseIds.has(lesson.courseId) ? -30 : 0;

      return {
        lesson,
        bestTag: best?.tag ?? null,
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
      const best = pickBestTag(tagsByKey.get(`mission:${mission.id}`) ?? [], userProfile);
      const baseScore = best?.score ?? 8;

      return {
        mission,
        bestTag: best?.tag ?? null,
        score: baseScore,
      };
    })
    .sort((first, second) => second.score - first.score || first.mission.title.localeCompare(second.mission.title));

  const courseCandidates = catalog
    .filter((course) => !completedCourseIds.has(course.id))
    .map((course) => {
      const best = pickBestTag(tagsByKey.get(`course:${course.id}`) ?? [], userProfile);
      const baseScore = best?.score ?? (course.level === "beginner" ? 14 : 10);
      const duplicatePenalty = seenCourseIds.has(course.id) ? -30 : 0;
      return {
        course,
        bestTag: best?.tag ?? null,
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
          href: `/lessons/${selectedLessonCandidate.lesson.id}`,
          reason: buildReason(
            "next_lesson",
            selectedLessonCandidate.bestTag
              ? (dimensionLabels.get(selectedLessonCandidate.bestTag.dimensionId) ?? null)
              : null,
            hasProfile,
          ),
          dimension_label: selectedLessonCandidate.bestTag
            ? (dimensionLabels.get(selectedLessonCandidate.bestTag.dimensionId) ?? null)
            : null,
          recommended_level: selectedLessonCandidate.bestTag?.recommendedLevel ?? null,
          score: Number(selectedLessonCandidate.score.toFixed(2)),
          lesson: selectedLessonCandidate.lesson,
        }
      : fallbackLesson
        ? {
            id: fallbackLesson.id,
            content_type: "lesson" as const,
            title: fallbackLesson.title,
            description: fallbackLesson.summary,
            href: `/lessons/${fallbackLesson.id}`,
            reason: "A good next step for your current learning path.",
            dimension_label: null,
            recommended_level: null,
            score: 0,
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
          href: "/missions",
          reason: buildReason(
            "mission",
            missionCandidates[0].bestTag
              ? (dimensionLabels.get(missionCandidates[0].bestTag.dimensionId) ?? null)
              : null,
            hasProfile,
          ),
          dimension_label: missionCandidates[0].bestTag
            ? (dimensionLabels.get(missionCandidates[0].bestTag.dimensionId) ?? null)
            : null,
          recommended_level: missionCandidates[0].bestTag?.recommendedLevel ?? null,
          score: Number(missionCandidates[0].score.toFixed(2)),
          mission: missionCandidates[0].mission,
        }
      : fallbackMission
        ? {
            id: fallbackMission.id,
            content_type: "mission" as const,
            title: fallbackMission.title,
            description: fallbackMission.description,
            href: "/missions",
            reason: "A practical next step you can take right away.",
            dimension_label: null,
            recommended_level: null,
            score: 0,
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
          href: `/courses/${selectedCourseCandidate.course.id}`,
          reason: buildReason(
            "course",
            selectedCourseCandidate.bestTag
              ? (dimensionLabels.get(selectedCourseCandidate.bestTag.dimensionId) ?? null)
              : null,
            hasProfile,
          ),
          dimension_label: selectedCourseCandidate.bestTag
            ? (dimensionLabels.get(selectedCourseCandidate.bestTag.dimensionId) ?? null)
            : null,
          recommended_level: selectedCourseCandidate.bestTag?.recommendedLevel ?? null,
          score: Number(selectedCourseCandidate.score.toFixed(2)),
          course: selectedCourseCandidate.course,
        }
      : fallbackCourse
        ? {
            id: fallbackCourse.id,
            content_type: "course" as const,
            title: fallbackCourse.title,
            description: fallbackCourse.description,
            href: `/courses/${fallbackCourse.id}`,
            reason: "A good next step for your current learning path.",
            dimension_label: null,
            recommended_level: null,
            score: 0,
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
