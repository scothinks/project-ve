import "server-only";

import { headers } from "next/headers";
import type { LearningCourseCard } from "@/features/learning/application/course-card-model";
import { createMissionRepository } from "@/features/app/repositories/missions";
import { createRewardRepository } from "@/features/app/repositories/rewards";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { logAppError } from "@/lib/app-errors";
import { isDemoMode, isLiveMode } from "@/lib/app-mode";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { measureAsync } from "@/lib/performance";
import { getPersonalizedDashboardRecommendations } from "@/lib/personalized-recommendations";
import type { LessonProgressRecord } from "@/lib/progress";
import type { AppSupabaseClient } from "@/lib/supabase";
import { getDashboardRecommendationSections } from "@/lib/supabase-recommendations";

const emptyOrganizationState = { invitations: [], organizations: [] };
const emptyPersonalizedRecommendations = {
  sections: [],
  userProfile: null,
  userScores: [],
};

function buildRequestOrigin(headerMap: Headers) {
  const proto = headerMap.get("x-forwarded-proto") ?? "https";
  const host = headerMap.get("x-forwarded-host") ?? headerMap.get("host");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

async function withLoggedFallback<T>({
  fallback,
  operation,
  task,
  userId,
}: {
  fallback: T;
  operation: string;
  task: () => Promise<T>;
  userId?: string | null;
}) {
  try {
    return await measureAsync(operation, task);
  } catch (error) {
    logAppError(error, { operation, userId });
    return fallback;
  }
}

export function startDashboardSecondaryData({
  catalog,
  lessonProgress,
  referralCode,
  repositoryUserId,
  supabase,
  userId,
  xpBalance,
}: {
  catalog: LearningCourseCard[];
  lessonProgress: LessonProgressRecord[];
  referralCode: string | null;
  repositoryUserId: string;
  supabase: AppSupabaseClient | null;
  userId: string | null;
  xpBalance: number;
}) {
  const missionRepository = createMissionRepository(supabase);
  const rewardRepository = createRewardRepository(supabase);

  const missions = (async () => {
    if (!userId && !isDemoMode) return [];

    return withLoggedFallback({
      fallback: [],
      operation: "dashboard.secondary.missions",
      task: async () => {
        const requestHeaders = await headers();
        return missionRepository.getSummaries({
          userId: userId ?? repositoryUserId,
          referralCode: userId ? referralCode : null,
          origin: buildRequestOrigin(requestHeaders),
        });
      },
      userId,
    });
  })();

  const rewards = isLiveMode && userId
    ? withLoggedFallback({
        fallback: null,
        operation: "dashboard.secondary.rewards",
        task: () => rewardRepository.getStoreSnapshot(userId, xpBalance),
        userId,
      })
    : isDemoMode
      ? withLoggedFallback({
          fallback: null,
          operation: "dashboard.secondary.rewards",
          task: () => rewardRepository.getStoreSnapshot(repositoryUserId, xpBalance),
          userId,
        })
      : Promise.resolve(null);

  const editorialRecommendations = withLoggedFallback({
    fallback: [],
    operation: "dashboard.secondary.editorial_recommendations",
    task: () => getDashboardRecommendationSections(supabase, catalog),
    userId,
  });

  const personalizedRecommendations = isLiveMode && userId && supabase
    ? missions.then((missionItems) => withLoggedFallback({
        fallback: emptyPersonalizedRecommendations,
        operation: "dashboard.secondary.personalized_recommendations",
        task: () => getPersonalizedDashboardRecommendations({
          supabase,
          userId,
          catalog,
          lessonProgress,
          missions: missionItems,
        }),
        userId,
      }))
    : Promise.resolve(emptyPersonalizedRecommendations);

  const adSegments = withLoggedFallback({
    fallback: [],
    operation: "dashboard.secondary.ad_segments",
    task: () => getLearnerAdSegments(supabase, userId),
    userId,
  });
  const homeFeedAd = adSegments.then((segmentKeys) => withLoggedFallback({
    fallback: null,
    operation: "dashboard.secondary.home_feed_ad",
    task: () => getAdDecision(supabase, {
      placementKey: "home_feed_card",
      route: "/dashboard",
      userId,
      contentValueTags: [],
      segmentKeys,
    }),
    userId,
  }));

  const organizations = supabase && userId
    ? withLoggedFallback({
        fallback: emptyOrganizationState,
        operation: "dashboard.secondary.organizations",
        task: () => getMyOrganizationState(supabase, userId),
        userId,
      })
    : Promise.resolve(emptyOrganizationState);

  const unreadNotifications = isLiveMode && userId && supabase
    ? withLoggedFallback({
        fallback: 0,
        operation: "dashboard.secondary.unread_notifications",
        task: () => getUnreadNotificationCount(supabase, userId),
        userId,
      })
    : Promise.resolve(0);

  return {
    editorialRecommendations,
    homeFeedAd,
    missions,
    organizations,
    personalizedRecommendations,
    rewards,
    unreadNotifications,
  };
}

export type DashboardSecondaryData = ReturnType<typeof startDashboardSecondaryData>;
