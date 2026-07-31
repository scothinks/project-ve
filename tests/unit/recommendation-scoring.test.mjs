import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecommendationReason,
  recommendationScoringPolicyVersion,
  scoreRecommendationCandidate,
} from "../../features/recommendations/domain/scoring.ts";

const profile = {
  readinessLevel: "beginner",
  assessmentCompletedAt: "2026-07-31T08:00:00.000Z",
};

const tag = {
  dimensionId: "civic-trust",
  weight: 4,
  recommendedLevel: "beginner",
};

function score(overrides = {}) {
  return scoreRecommendationCandidate({
    tag,
    profile,
    userScores: [
      {
        dimensionId: "civic-trust",
        score: 80,
        confidence: 0.9,
      },
    ],
    completed: false,
    recentlySeen: false,
    progressionRelevant: true,
    ...overrides,
  });
}

test("recommendation scoring records the v2 policy version", () => {
  assert.equal(score().policyVersion, recommendationScoringPolicyVersion);
  assert.equal(score().policyVersion, "v2");
});

test("changing dimension score changes ranking predictably", () => {
  const low = score({
    userScores: [{ dimensionId: "civic-trust", score: 20, confidence: 0.9 }],
  });
  const high = score({
    userScores: [{ dimensionId: "civic-trust", score: 90, confidence: 0.9 }],
  });

  assert.ok(high.dimensionFit > low.dimensionFit);
  assert.ok(high.total > low.total);
});

test("low-confidence scores influence ranking less than high-confidence scores", () => {
  const lowConfidence = score({
    userScores: [{ dimensionId: "civic-trust", score: 90, confidence: 0.2 }],
  });
  const highConfidence = score({
    userScores: [{ dimensionId: "civic-trust", score: 90, confidence: 0.95 }],
  });

  assert.ok(highConfidence.dimensionFit > lowConfidence.dimensionFit);
  assert.ok(highConfidence.assessmentConfidence > lowConfidence.assessmentConfidence);
  assert.ok(highConfidence.total > lowConfidence.total);
});

test("dimension fit aggregates multiple content dimension tags", () => {
  const singleTag = score({
    tag: { dimensionId: "civic-trust", weight: 2, recommendedLevel: "beginner" },
  });
  const multiTag = score({
    tag: null,
    tags: [
      { dimensionId: "civic-trust", weight: 2, recommendedLevel: "beginner" },
      { dimensionId: "community-action", weight: 2, recommendedLevel: "beginner" },
    ],
    userScores: [
      { dimensionId: "civic-trust", score: 80, confidence: 0.9 },
      { dimensionId: "community-action", score: 70, confidence: 0.8 },
    ],
  });

  assert.ok(multiTag.dimensionFit > singleTag.dimensionFit);
  assert.ok(multiTag.total > singleTag.total);
});

test("primary and secondary labels do not outrank stronger score and confidence data", () => {
  const primaryButWeak = score({
    tag: { dimensionId: "civic-trust", weight: 4, recommendedLevel: "beginner" },
    userScores: [{ dimensionId: "civic-trust", score: 20, confidence: 0.4 }],
  });
  const nonPrimaryButStrong = score({
    tag: { dimensionId: "financial-integrity", weight: 4, recommendedLevel: "beginner" },
    userScores: [{ dimensionId: "financial-integrity", score: 95, confidence: 0.95 }],
  });

  assert.ok(nonPrimaryButStrong.dimensionFit > primaryButWeak.dimensionFit);
  assert.ok(nonPrimaryButStrong.total > primaryButWeak.total);
});

test("readiness mismatch is penalized by policy", () => {
  const matched = score();
  const mismatched = score({
    tag: { ...tag, recommendedLevel: "advanced" },
  });

  assert.ok(matched.readinessFit > mismatched.readinessFit);
  assert.ok(matched.total > mismatched.total);
});

test("completed content is deprioritized", () => {
  const incomplete = score({ completed: false });
  const completed = score({ completed: true });

  assert.ok(completed.completionStatus < incomplete.completionStatus);
  assert.ok(completed.total < incomplete.total);
});

test("scoring is deterministic for the same input", () => {
  assert.deepEqual(score(), score());
});

test("recommendation reason corresponds to actual scoring", () => {
  const components = score();
  const reason = buildRecommendationReason({
    dimensionLabel: "Civic Trust",
    components,
    hasProfile: true,
    fallbackReason: "Fallback.",
  });

  assert.match(reason, /assessment score strongly matches Civic Trust/);
});
