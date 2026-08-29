import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardSource = readFileSync(
  new URL("../../app/dashboard/page.tsx", import.meta.url),
  "utf8",
);
const secondaryDataSource = readFileSync(
  new URL("../../features/dashboard/application/secondary-data.ts", import.meta.url),
  "utf8",
);
const personalizedSource = readFileSync(
  new URL("../../lib/personalized-recommendations.ts", import.meta.url),
  "utf8",
);
const contentTagActionsSource = readFileSync(
  new URL("../../app/admin/content-value-tags/actions.ts", import.meta.url),
  "utf8",
);

test("dashboard keeps identity, XP, progress, and continue learning in the core path", () => {
  const loader = dashboardSource.slice(dashboardSource.indexOf("export default async function DashboardPage"));
  const secondaryStart = loader.indexOf("startDashboardSecondaryData");

  assert.ok(secondaryStart > 0);
  assert.ok(loader.indexOf("getCurrentUserContext()") < secondaryStart);
  assert.ok(loader.indexOf("resolveDashboardXpBalance") < secondaryStart);
  assert.ok(loader.indexOf('measureAsync("dashboard.core.learning"') < secondaryStart);
  assert.ok(loader.indexOf('measureAsync("dashboard.core.continue_learning"') < secondaryStart);
});

test("dashboard streams every optional feature behind explicit Suspense fallbacks", () => {
  for (const label of [
    "missions",
    "editorial recommendations",
    "personalized recommendations",
    "advertisement",
    "rewards",
  ]) {
    assert.match(dashboardSource, new RegExp(`SecondarySectionFallback label=\\"${label}\\"`));
  }

  assert.match(dashboardSource, /fallback={<LearnerWorkspaceSwitcher organizations={\[\]} \/>}/);
  assert.match(dashboardSource, /fallback={<LearnerNotificationControl \/>}/);
  assert.doesNotMatch(secondaryDataSource, /throw error/);
  assert.match(secondaryDataSource, /logAppError\(error, \{ operation, userId \}\)/);
});

test("personalization reads and caches editorial configuration separately from user state", () => {
  const profileLoader = personalizedSource.slice(
    personalizedSource.indexOf("async function loadProfileData"),
    personalizedSource.indexOf("async function loadEditorialRecommendationData"),
  );
  const editorialLoader = personalizedSource.slice(
    personalizedSource.indexOf("async function loadEditorialRecommendationData"),
    personalizedSource.indexOf("function buildDimensionLabelMap"),
  );

  assert.doesNotMatch(profileLoader, /unstable_cache/);
  assert.match(profileLoader, /user_value_profiles/);
  assert.match(profileLoader, /user_value_dimension_scores/);
  assert.match(editorialLoader, /unstable_cache/);
  assert.equal((editorialLoader.match(/\.from\("content_value_tags"\)/g) ?? []).length, 1);
  assert.match(editorialLoader, /PERSONALIZED_RECOMMENDATION_EDITORIAL_CACHE_TAG/);
  assert.match(contentTagActionsSource, /revalidateTag\(PERSONALIZED_RECOMMENDATION_EDITORIAL_CACHE_TAG\)/);
});
