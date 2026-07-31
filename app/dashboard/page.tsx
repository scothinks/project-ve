import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { CourseCard } from "@/components/course/CourseCard";
import { BottomNav } from "@/components/navigation/BottomNav";
import { FeaturedRewardCard } from "@/components/rewards/FeaturedRewardCard";
import { LessonModuleCard } from "@/components/lesson/LessonModuleCard";
import { Avatar } from "@/components/profile/Avatar";
import { ReferralAttributionCapture } from "@/components/referrals/ReferralAttributionCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { logAppError } from "@/lib/app-errors";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import {
  getMissionRewardLabel,
  type MissionCategory,
  type UserMissionSummary,
} from "@/lib/missions";
import {
  getCompletedLessonIds,
  getContinueLearningItem,
  getCourseProgress,
} from "@/lib/progress";
import type { RewardStoreSnapshot } from "@/lib/rewards";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { resolveDashboardXpBalance } from "@/lib/observability";
import { measureAsync } from "@/lib/performance";
import { getPersonalizedDashboardRecommendations } from "@/lib/personalized-recommendations";
import { getDashboardRecommendationSections } from "@/lib/supabase-recommendations";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isDemoMode, isLiveMode } from "@/lib/app-mode";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { createMissionRepository } from "@/features/app/repositories/missions";
import { createProgressRepository } from "@/features/app/repositories/progress";
import { createRewardRepository } from "@/features/app/repositories/rewards";
import {
  getUserAssessmentCompletionStatus,
  learnerNeedsValuesAssessment,
} from "@/lib/values-assessment";
import { formatXpLabel } from "@/lib/xp-format";
import { getAdDecision, getLearnerAdSegments } from "@/lib/ads";

function buildRequestOrigin(headerMap: Headers) {
  const proto = headerMap.get("x-forwarded-proto") ?? "https";
  const host = headerMap.get("x-forwarded-host") ?? headerMap.get("host");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

async function withLoggedDashboardFallback<T>({
  fallback,
  operation,
  promise,
  userId,
}: {
  fallback: T;
  operation: string;
  promise: Promise<T>;
  userId?: string | null;
}) {
  try {
    return await promise;
  } catch (error) {
    logAppError(error, { operation, userId });
    return fallback;
  }
}

function ContinueLearningCard({
  item,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getContinueLearningItem>>>;
}) {
  return (
    <Card className="overflow-hidden border border-[#dff2e9] lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="relative h-28 lg:h-full lg:min-h-[12rem]">
        <Image
          alt={item.lesson.coverImage.alt}
          className={`h-full w-full ${getImageFitClass(item.lesson.coverImage)}`}
          fill
          sizes="(max-width: 768px) 100vw, 260px"
          src={item.lesson.coverImage.src}
          style={getImagePresentationStyle(item.lesson.coverImage)}
        />
      </div>
      <div className="p-5 lg:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#008751]">
              {item.course.title}
            </p>
            <h3 className="mt-1 text-[1.18rem] font-semibold leading-7 tracking-[-0.025em] text-[var(--foreground)]">
              {item.lesson.title}
            </h3>
          </div>
          <StatusBadge tone="trust">{item.statusLabel}</StatusBadge>
        </div>
        <p className="mt-3 text-[0.96rem] font-medium leading-6 text-[var(--ve-muted)]">
          {item.helperText}
        </p>
        <div className="mt-5 h-2 rounded-full bg-[#e8e8e8]">
          <div
            className="h-full rounded-full bg-[#008751]"
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
        <div className="mt-5 flex justify-end">
          <Button href={item.href} className="h-10 px-5 text-[0.98rem]">
            {item.ctaLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function XpBalanceCard({
  completedCourses,
  totalCourses,
  xpBalance,
}: {
  completedCourses: number;
  totalCourses: number;
  xpBalance: number;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            XP Balance
          </p>
          <p className="mt-1 max-w-[11rem] whitespace-nowrap text-[clamp(1.25rem,6vw,1.75rem)] font-black leading-none tabular-nums">
            {formatXpLabel(xpBalance)}
          </p>
        </div>
        <Button href="/xp-store" className="h-10 px-5 text-[0.98rem]" variant="soft">
          Redeem
        </Button>
      </div>
      <div className="mt-6 h-2 rounded-full bg-[#e8e8e8]">
        <div
          className="h-full rounded-full bg-[#008751]"
          style={{
            width: totalCourses > 0 ? `${(completedCourses / totalCourses) * 100}%` : "0%",
          }}
        />
      </div>
      <p className="mt-3 text-right text-[0.88rem] font-medium tracking-[-0.01em] text-[var(--ve-muted)]">
        {completedCourses}/{totalCourses} courses completed
      </p>
    </Card>
  );
}

function FeaturedRewardsSection({
  rewards,
  compact = false,
}: {
  rewards: RewardStoreSnapshot["rewards"];
  compact?: boolean;
}) {
  if (rewards.length === 0) return null;

  return (
    <div>
      <SectionHeader
        actionHref="/xp-store"
        actionLabel="View all"
        subtitle="Redeem XP for currently available offers."
        title="Featured rewards"
        tone="store"
      />
      <div
        className={
          compact
            ? "mt-3 space-y-2.5"
            : "mt-3 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2"
        }
      >
        {rewards.map((reward) => (
          <FeaturedRewardCard compact key={reward.id} reward={reward} />
        ))}
      </div>
    </div>
  );
}

const missionStatusCopy: Record<UserMissionSummary["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  rejected: "Rejected",
  completed: "Completed",
};

const secondaryDashboardCardListClass =
  "mt-3 grid gap-3 lg:max-w-[calc(100%-2rem)] xl:max-w-[calc(100%-3rem)]";

const recommendedMissionTheme: Record<
  MissionCategory,
  {
    card: string;
    pill: string;
    label: string;
    progress: string;
  }
> = {
  course: {
    card: "border-[#c7e6d8] bg-[#edf9f2] shadow-[0_16px_36px_rgba(8,127,91,0.12)]",
    pill: "bg-[#def3e8] text-[#087f5b]",
    label: "bg-[#daf1e4] text-[#087f5b]",
    progress: "bg-[#109365]",
  },
  referral: {
    card: "border-[#d9c7ff] bg-[#f3ebff] shadow-[0_16px_36px_rgba(107,67,204,0.16)]",
    pill: "bg-[#ece3ff] text-[#6b43cc]",
    label: "bg-[#e8ddff] text-[#6b43cc]",
    progress: "bg-[#8d68f2]",
  },
  feedback: {
    card: "border-[#ffcbb6] bg-[#fff0e8] shadow-[0_16px_36px_rgba(255,122,89,0.16)]",
    pill: "bg-[#ffe7dc] text-[#c94f2e]",
    label: "bg-[#ffe1d5] text-[#c94f2e]",
    progress: "bg-[#ff7a59]",
  },
  campaign: {
    card: "border-[#f1db8d] bg-[#fff5d9] shadow-[0_16px_36px_rgba(192,138,0,0.16)]",
    pill: "bg-[#fff0c8] text-[#a36d00]",
    label: "bg-[#ffefc2] text-[#a36d00]",
    progress: "bg-[#d59a13]",
  },
  custom: {
    card: "border-[#d6dde6] bg-[#f1f5f9] shadow-[0_16px_36px_rgba(16,16,16,0.09)]",
    pill: "bg-[#e8edf5] text-[#475569]",
    label: "bg-[#e5ebf3] text-[#475569]",
    progress: "bg-[#64748b]",
  },
};

function RecommendedMissionCard({
  mission,
  href,
  compact = false,
}: {
  mission: UserMissionSummary;
  href: string;
  compact?: boolean;
}) {
  const theme = recommendedMissionTheme[mission.category];
  const rewardLabel = getMissionRewardLabel(mission);
  const progressPercent =
    mission.targetCount > 0 ? Math.min(100, (mission.progressCount / mission.targetCount) * 100) : 0;
  const hasStructuredProgress =
    !mission.referral &&
    (mission.targetCount > 1 ||
      mission.progressCount > 0 ||
      mission.status === "completed" ||
      mission.requiresProof ||
      mission.status === "submitted" ||
      mission.status === "under_review" ||
      mission.status === "rejected");

  return (
    <Card
      className={`overflow-hidden ${compact ? "p-4" : "p-5 sm:p-6"} ${theme.card}`}
      variant="quiet"
    >
      <div className="flex items-start gap-3">
        <div
          className={`inline-flex rounded-full font-black uppercase ${
            compact
              ? "px-2.5 py-1 text-[10px] tracking-[0.12em]"
              : "px-3 py-1 text-[11px] tracking-[0.14em]"
          } ${theme.label}`}
        >
          {mission.category}
        </div>

        <div
          className={`ml-auto text-right ${
            compact
              ? "max-w-[62%] rounded-[16px] px-3 py-2"
              : "max-w-[72%] rounded-[18px] px-4 py-2.5 sm:max-w-[18rem]"
          } ${theme.pill}`}
          title={rewardLabel}
        >
          <span
            className={`block font-black tracking-[-0.02em] ${
              compact ? "text-[0.9rem]" : "text-[0.95rem] sm:text-base"
            }`}
          >
            {rewardLabel}
          </span>
        </div>
      </div>

      <div className={`${compact ? "mt-4" : "mt-5"} min-w-0`}>
        <h3
          className={`${compact ? "text-[1.05rem]" : "text-[1.24rem]"} font-semibold tracking-[-0.025em] text-[var(--foreground)]`}
        >
          {mission.title}
        </h3>
        <p
          className={`${
            compact
              ? "mt-2 line-clamp-3 text-[0.86rem] leading-6"
              : "mt-3 text-[0.98rem] leading-[1.7] sm:max-w-[34ch]"
          } max-w-none font-medium text-[var(--ve-muted-strong)]`}
        >
          {mission.description}
        </p>
      </div>

      {hasStructuredProgress ? (
        <div className={compact ? "mt-4" : "mt-5"}>
          <div
            className={`flex flex-wrap items-center justify-between gap-2 font-semibold tracking-[-0.01em] text-[var(--ve-muted)] ${
              compact ? "text-[0.8rem]" : "text-[0.9rem]"
            }`}
          >
            <span className="min-w-0 flex-1">
              {mission.completionLabel ?? missionStatusCopy[mission.status]}
            </span>
            <span className="shrink-0">
              {mission.progressCount}/{mission.targetCount}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[color:color-mix(in_srgb,var(--ve-card)_65%,transparent)]">
            <div
              className={`h-full rounded-full ${theme.progress}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className={compact ? "mt-4" : "mt-5"}>
        <Button className={compact ? "h-9 px-4 text-sm" : "h-10 px-5 text-[0.98rem]"} href={href}>
          Open mission
        </Button>
      </div>
    </Card>
  );
}

function buildRecommendedMissionItems(params: {
  personalizedSection:
    | Awaited<ReturnType<typeof getPersonalizedDashboardRecommendations>>["sections"][number]
    | undefined;
  featuredMission: UserMissionSummary | null;
}) {
  const { personalizedSection, featuredMission } = params;
  const items: Array<{
    id: string;
    href: string;
    mission: UserMissionSummary;
  }> = [];

  const personalizedItem = personalizedSection?.items[0] ?? null;

  if (personalizedItem && personalizedItem.content_type === "mission") {
    const mission = personalizedItem.mission ?? featuredMission;

    if (!mission) {
      return items;
    }

    items.push({
      id: personalizedItem.id,
      href: personalizedItem.href,
      mission,
    });
  }

  if (featuredMission && featuredMission.id !== personalizedItem?.id) {
    items.push({
      id: featuredMission.id,
      href: "/missions",
      mission: featuredMission,
    });
  }

  return items;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);
  const learningRepository = createLearningRepository(supabase);
  const progressRepository = createProgressRepository(supabase);
  const rewardRepository = createRewardRepository(supabase);
  const missionRepository = createMissionRepository(supabase);
  const repositoryUserId = user?.id ?? "demo-user";

  if (isLiveMode && !user) {
    redirect("/login");
  }

  if (isLiveMode && user) {
    const assessmentStatus = await getUserAssessmentCompletionStatus(supabase, user.id);

    if (
      learnerNeedsValuesAssessment({
        role: profile?.role,
        assessmentCompletedAt: assessmentStatus?.assessment_completed_at ?? null,
      })
    ) {
      redirect("/onboarding/assessment");
    }
  }

  const [catalog, requestHeaders] = await Promise.all([
    measureAsync("dashboard.learning_catalog", () => learningRepository.getCatalog()),
    headers(),
  ]);
  const origin = buildRequestOrigin(requestHeaders);
  const currentCourse = catalog[0];
  const rawDisplayName = profile?.display_name ?? "";
  const hasRealName = Boolean(rawDisplayName && !rawDisplayName.includes("@"));
  const displayName = hasRealName ? rawDisplayName : "Learner";
  const firstName = displayName.split(/\s+/)[0] || "Learner";

  const xpBalance = resolveDashboardXpBalance({
    isConfigured: isLiveMode,
    profile,
    userId: user?.id,
  });
  const [
    lessonProgress,
    recommendationSections,
    rewardSnapshot,
    unreadNotificationCount,
    missionRecommendations,
    dashboardAdSegments,
  ] = await measureAsync("dashboard.primary_data_batch", () => Promise.all([
    user || isDemoMode
      ? progressRepository.getLessonProgress(repositoryUserId)
      : Promise.resolve([]),
    getDashboardRecommendationSections(supabase, catalog),
    isLiveMode && user
      ? withLoggedDashboardFallback({
          fallback: null,
          operation: "dashboard.reward_store.load",
          promise: rewardRepository.getStoreSnapshot(user.id, xpBalance),
          userId: user.id,
        })
      : isDemoMode
        ? rewardRepository.getStoreSnapshot(repositoryUserId, xpBalance)
        : Promise.resolve(null),
    isLiveMode && user && supabase
      ? withLoggedDashboardFallback({
          fallback: 0,
          operation: "dashboard.notifications.unread_count",
          promise: getUnreadNotificationCount(supabase, user.id),
          userId: user.id,
        })
      : Promise.resolve(0),
    isLiveMode && user
      ? withLoggedDashboardFallback({
          fallback: [],
          operation: "dashboard.missions.load",
          promise: missionRepository.getSummaries({
            userId: user.id,
            referralCode: profile?.referral_code ?? null,
            origin,
          }),
          userId: user.id,
        })
      : isDemoMode
        ? missionRepository.getSummaries({
            userId: repositoryUserId,
            referralCode: null,
            origin,
          })
        : Promise.resolve([]),
    withLoggedDashboardFallback({
      fallback: [],
      operation: "dashboard.ads.segments",
      promise: getLearnerAdSegments(supabase, user?.id),
      userId: user?.id,
    }),
  ]));
  const completedLessonIds = getCompletedLessonIds(
    lessonProgress,
    catalog.flatMap((course) => course.lessons),
  );
  const isLessonCompleted = (lessonId: string) => completedLessonIds.has(lessonId);
  const isCourseCompleted = (course: (typeof catalog)[number]) => {
    const progress = getCourseProgress(course, completedLessonIds);
    return progress.lessonCount > 0 && progress.completedLessons === progress.lessonCount;
  };
  const completedCourses = catalog.filter((course) => {
    return isCourseCompleted(course);
  }).length;
  const totalCourses = catalog.length;
  const hasPublishedRecommendationSections = recommendationSections.length > 0;
  const activeRecommendationSections = recommendationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.type === "course"
          ? !isCourseCompleted(item.course)
          : !isLessonCompleted(item.lesson.id),
      ),
    }))
    .filter((section) => section.items.length > 0);
  const starterLessons = (currentCourse?.lessons ?? []).filter(
    (lesson) => !isLessonCompleted(lesson.id),
  );
  const featuredRewards = (rewardSnapshot?.rewards ?? []).slice(0, 2);
  const [continueLearningItem, personalizedRecommendations, homeFeedAd] = await measureAsync("dashboard.secondary_data_batch", () => Promise.all([
    isLiveMode && user && supabase
      ? getContinueLearningItem({
          supabase,
          userId: user.id,
          catalog,
          lessonProgress,
        })
      : Promise.resolve(null),
    isLiveMode && user && supabase
      ? withLoggedDashboardFallback({
          fallback: { sections: [], userProfile: null, userScores: [] },
          operation: "dashboard.personalized_recommendations.load",
          promise: getPersonalizedDashboardRecommendations({
            supabase,
            userId: user.id,
            catalog,
            lessonProgress,
            missions: missionRecommendations,
          }),
          userId: user.id,
        })
      : Promise.resolve({ sections: [], userProfile: null, userScores: [] }),
    getAdDecision(supabase, {
      placementKey: "home_feed_card",
      route: "/dashboard",
      userId: user?.id,
      contentValueTags: [],
      segmentKeys: dashboardAdSegments,
    }),
  ]));
  const featuredMission = missionRecommendations[0] ?? null;
  const personalizedMissionSection = personalizedRecommendations.sections.find(
    (section) => section.id === "mission",
  );
  const nonMissionPersonalizedSections = personalizedRecommendations.sections.filter(
    (section) => section.id !== "mission",
  );
  const recommendedMissionItems = buildRecommendedMissionItems({
    personalizedSection: personalizedMissionSection,
    featuredMission,
  });
  return (
    <main className="mobile-shell min-h-screen">
      <ReferralAttributionCapture />
      <section className="rounded-b-[28px] bg-[#123c35] px-7 pb-7 pt-14 text-[#fff8df] lg:mx-[clamp(1.75rem,3vw,3rem)] lg:mt-8 lg:rounded-[36px] lg:px-10 lg:pt-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#fff8df]">
              Project VE
            </h1>
            <p className="mt-2 text-[0.98rem] font-medium tracking-[-0.01em] text-[#d9efe5]">
              Welcome back, <span className="font-semibold text-[#f4fbf7]">{firstName}</span>
            </p>
          </div>
          <Link
            aria-label={
              unreadNotificationCount > 0
                ? `Open profile with ${unreadNotificationCount} unread notifications`
                : "Open profile"
            }
            className="relative rounded-full border-[5px] border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            href="/profile"
          >
            {unreadNotificationCount > 0 ? (
              <span className="absolute right-1 top-1 z-10 size-3 rounded-full border-2 border-[#123c35] bg-[#ff7a59]" />
            ) : null}
            <Avatar
              avatarUrl={profile?.avatar_url}
              className="size-[54px] text-[1.02rem]"
              email={user?.email}
              name={rawDisplayName}
            />
          </Link>
        </div>
      </section>

      <section className="learner-page learner-page--standard">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)] lg:items-start lg:gap-7 xl:gap-8">
          <div className="space-y-6">
            <div className="-mt-12 lg:hidden">
              <XpBalanceCard
                completedCourses={completedCourses}
                totalCourses={totalCourses}
                xpBalance={xpBalance}
              />
            </div>

            <div className="lg:hidden">
              <DirectAdCard ad={homeFeedAd} />
            </div>

            {continueLearningItem ? (
              <div>
                <SectionHeader
                  subtitle="Jump back into the exact step you were working on."
                  title="Continue learning"
                />
                <div className="mt-3">
                  <ContinueLearningCard item={continueLearningItem} />
                </div>
              </div>
            ) : null}

            {activeRecommendationSections.length > 0 ? (
              <SectionHeader
                actionHref="/courses"
                actionLabel="Browse"
                subtitle="Starter packs and current focus areas."
                title="Recommended for you"
              />
            ) : null}

            {activeRecommendationSections.length > 0 ? (
              activeRecommendationSections.map((section) => (
                <div
                  id={section.eyebrow?.toLowerCase().replace(/\s+/g, "-") ?? section.id}
                  key={section.id}
                >
                  <SectionHeader
                    eyebrow={section.eyebrow ?? undefined}
                    subtitle={section.subtitle ?? undefined}
                    title={section.title}
                  />
                  <div className={secondaryDashboardCardListClass}>
                    {section.items.map((item) =>
                      item.type === "course" ? (
                        <CourseCard
                          completedLessonIds={completedLessonIds}
                          course={item.course}
                          desktopLayout="horizontal"
                          key={item.id}
                        />
                      ) : (
                        <LessonModuleCard
                          completed={isLessonCompleted(item.lesson.id)}
                          desktopLayout="horizontal"
                          key={item.id}
                          lesson={item.lesson}
                        />
                      ),
                    )}
                  </div>
                </div>
              ))
            ) : catalog.length > 0 && !hasPublishedRecommendationSections ? (
              <>
                {starterLessons.length ? (
                  <div id="lessons">
                    <SectionHeader
                      eyebrow="Starter pack"
                      subtitle="Begin with practical choices and everyday values."
                    />
                    <div className={secondaryDashboardCardListClass}>
                      {starterLessons.map((lesson) => (
                        <LessonModuleCard
                          completed={isLessonCompleted(lesson.id)}
                          desktopLayout="horizontal"
                          key={lesson.id}
                          lesson={lesson}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <Card className="p-5">
                  <h2 className="text-base font-black">Browse the course library</h2>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Focus area recommendations stay empty until a tutor curates them. You can still
                    browse all published courses any time.
                  </p>
                  <div className="mt-4">
                    <Button href="/courses" className="h-10 px-4 text-xs" variant="soft">
                      Browse courses
                    </Button>
                  </div>
                </Card>
              </>
            ) : catalog.length > 0 ? (
              <Card className="p-5">
                <h2 className="text-base font-black">You are caught up</h2>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  You have finished the current recommendations. Browse the full library to replay
                  lessons or go deeper.
                </p>
                <div className="mt-4">
                  <Button href="/courses" className="h-10 px-4 text-xs" variant="soft">
                    Browse courses
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-5">
                <h2 className="text-base font-black">No lessons yet</h2>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  New values education courses will appear here when they are published.
                </p>
              </Card>
            )}

            {nonMissionPersonalizedSections.map((section) => (
              <div key={section.id}>
                <SectionHeader
                  subtitle={section.subtitle}
                  title={section.title}
                />
                <div className={secondaryDashboardCardListClass}>
                  {section.items.map((item) => (
                    item.lesson ? (
                      <LessonModuleCard
                        completed={isLessonCompleted(item.lesson.id)}
                        desktopLayout="horizontal"
                        key={`${section.id}:${item.id}`}
                        lesson={item.lesson}
                      />
                    ) : item.course ? (
                      <CourseCard
                        completedLessonIds={completedLessonIds}
                        course={item.course}
                        desktopLayout="horizontal"
                        href={item.href}
                        key={`${section.id}:${item.id}`}
                      />
                    ) : null
                  ))}
                </div>
              </div>
            ))}

            {recommendedMissionItems.length > 0 ? (
              <div className="lg:hidden">
                <SectionHeader
                  actionHref="/missions"
                  actionLabel="View all"
                  subtitle="Take the next challenge that fits your path."
                  title="Recommended missions"
                  tone="mission"
                />
                <div className="learner-card-grid mt-3">
                  {recommendedMissionItems.map((item) => (
                    <RecommendedMissionCard
                      href={item.href}
                      key={`recommended-mission:${item.id}`}
                      mission={item.mission}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="lg:hidden">
              <FeaturedRewardsSection rewards={featuredRewards} />
            </div>
          </div>

          <aside className="hidden space-y-5 lg:block">
            <div className="-mt-12">
              <XpBalanceCard
                completedCourses={completedCourses}
                totalCourses={totalCourses}
                xpBalance={xpBalance}
              />
            </div>

            <DirectAdCard ad={homeFeedAd} />

            {recommendedMissionItems.length > 0 ? (
              <div>
                <SectionHeader
                  actionHref="/missions"
                  actionLabel="View all"
                  subtitle="Take the next challenge that fits your path."
                  title="Missions"
                  tone="mission"
                />
                <div className="mt-3 space-y-3">
                  {recommendedMissionItems.slice(0, 2).map((item) => (
                    <RecommendedMissionCard
                      compact
                      href={item.href}
                      key={`desktop-mission:${item.id}`}
                      mission={item.mission}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <FeaturedRewardsSection compact rewards={featuredRewards} />
          </aside>
        </div>
      </section>

      <BottomNav active="Home" />
    </main>
  );
}
