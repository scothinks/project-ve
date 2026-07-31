type ReadinessLevel = "beginner" | "intermediate" | "advanced";

export const recommendationScoringPolicyVersion = "v2" as const;

export type RecommendationContentTag = {
  dimensionId: string;
  weight: number;
  recommendedLevel: ReadinessLevel | null;
};

export type RecommendationUserProfile = {
  readinessLevel: ReadinessLevel;
  assessmentCompletedAt: string | null;
} | null;

export type RecommendationDimensionScore = {
  dimensionId: string;
  score: number;
  confidence: number;
};

export type RecommendationScoreComponents = {
  policyVersion: typeof recommendationScoringPolicyVersion;
  dimensionFit: number;
  assessmentConfidence: number;
  readinessFit: number;
  contentWeight: number;
  progressionRelevance: number;
  completionStatus: number;
  novelty: number;
  editorial: number;
  total: number;
};

export type RecommendationScoringInput = {
  tag: RecommendationContentTag | null;
  tags?: RecommendationContentTag[];
  profile: RecommendationUserProfile;
  userScores: RecommendationDimensionScore[];
  completed: boolean;
  recentlySeen?: boolean;
  progressionRelevant?: boolean;
  editorialPriority?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundComponent(value: number) {
  return Number(value.toFixed(2));
}

export function scoreRecommendationCandidate(
  input: RecommendationScoringInput,
): RecommendationScoreComponents {
  const tags = input.tags ?? (input.tag ? [input.tag] : []);
  const scoreByDimension = new Map(input.userScores.map((score) => [score.dimensionId, score]));
  let rawDimensionFit = 0;
  let weightedConfidence = 0;
  let confidenceWeight = 0;
  let normalizedContentWeightTotal = 0;

  for (const tag of tags) {
    const dimensionScore = scoreByDimension.get(tag.dimensionId) ?? null;
    const normalizedUserScore = dimensionScore
      ? clamp(Number(dimensionScore.score), 0, 100) / 100
      : 0;
    const confidence = dimensionScore
      ? clamp(Number(dimensionScore.confidence), 0, 1)
      : input.profile?.assessmentCompletedAt
        ? 0.2
        : 0;
    const normalizedContentWeight = clamp(Number(tag.weight), 0, 5) / 5;

    rawDimensionFit += normalizedUserScore * confidence * normalizedContentWeight * 60;
    weightedConfidence += confidence * normalizedContentWeight;
    confidenceWeight += normalizedContentWeight;
    normalizedContentWeightTotal += normalizedContentWeight;
  }

  const dimensionFit = clamp(rawDimensionFit, 0, 60);
  const confidence = confidenceWeight > 0 ? weightedConfidence / confidenceWeight : 0;
  const normalizedContentWeight = clamp(normalizedContentWeightTotal, 0, 1);
  const readinessTag =
    tags.find((tag) => tag.recommendedLevel === input.profile?.readinessLevel) ??
    tags.find((tag) => tag.recommendedLevel) ??
    tags[0] ??
    null;
  const readinessFit =
    readinessTag?.recommendedLevel && input.profile
      ? readinessTag.recommendedLevel === input.profile.readinessLevel
        ? 20
        : -12
      : tags.length > 0
        ? 8
        : 0;
  const contentWeight = normalizedContentWeight * 12;
  const progressionRelevance = input.progressionRelevant === false ? 0 : 8;
  const completionStatus = input.completed ? -80 : 0;
  const novelty = input.recentlySeen ? -10 : 10;
  const editorial = clamp(input.editorialPriority ?? 0, -10, 10);
  const assessmentConfidence = confidence * 10;
  const total =
    dimensionFit +
    assessmentConfidence +
    readinessFit +
    contentWeight +
    progressionRelevance +
    completionStatus +
    novelty +
    editorial;

  return {
    policyVersion: recommendationScoringPolicyVersion,
    dimensionFit: roundComponent(dimensionFit),
    assessmentConfidence: roundComponent(assessmentConfidence),
    readinessFit: roundComponent(readinessFit),
    contentWeight: roundComponent(contentWeight),
    progressionRelevance: roundComponent(progressionRelevance),
    completionStatus: roundComponent(completionStatus),
    novelty: roundComponent(novelty),
    editorial: roundComponent(editorial),
    total: roundComponent(total),
  };
}

export function buildRecommendationReason(params: {
  dimensionLabel: string | null;
  components: RecommendationScoreComponents;
  hasProfile: boolean;
  fallbackReason: string;
}) {
  const { components, dimensionLabel, fallbackReason, hasProfile } = params;

  if (dimensionLabel && components.dimensionFit > 0) {
    return `Recommended because your assessment score strongly matches ${dimensionLabel}.`;
  }

  if (dimensionLabel && components.readinessFit > 0) {
    return `Recommended because ${dimensionLabel} fits your current readiness level.`;
  }

  return hasProfile
    ? "Recommended because it fits your Values Starter Check profile."
    : fallbackReason;
}
