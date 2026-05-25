import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
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
  getLessonProgress,
} from "@/lib/progress";
import { demoRewardStoreSnapshot } from "@/lib/rewards";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getPersonalizedDashboardRecommendations } from "@/lib/personalized-recommendations";
import { getLearningCatalog } from "@/lib/supabase-learning";
import { getSupabaseMissionSummaries } from "@/lib/supabase-missions";
import { getDashboardRecommendationSections } from "@/lib/supabase-recommendations";
import { getRewardStoreSnapshot } from "@/lib/supabase-rewards";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getUserAssessmentCompletionStatus,
  learnerNeedsValuesAssessment,
} from "@/lib/values-assessment";
import { formatXpLabel } from "@/lib/xp-format";

function buildRequestOrigin(headerMap: Headers) {
  const proto = headerMap.get("x-forwarded-proto") ?? "https";
  const host = headerMap.get("x-forwarded-host") ?? headerMap.get("host");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

function ContinueLearningCard({
  item,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getContinueLearningItem>>>;
}) {
  return (
    <Card className="overflow-hidden border border-[#dff2e9]">
      <div className="h-28">
        <img
          alt={item.lesson.coverImage.alt}
          className={`h-full w-full ${getImageFitClass(item.lesson.coverImage)}`}
          src={item.lesson.coverImage.src}
          style={getImagePresentationStyle(item.lesson.coverImage)}
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#008751]">
              {item.course.title}
            </p>
            <h3 className="mt-1 text-[1.22rem] font-semibold tracking-[-0.025em] leading-7 text-[var(--foreground)]">
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

const missionStatusCopy: Record<UserMissionSummary["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  rejected: "Rejected",
  completed: "Completed",
};

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
}: {
  mission: UserMissionSummary;
  href: string;
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
    <Card className={`overflow-hidden p-5 sm:p-6 ${theme.card}`} variant="quiet">
      <div className="flex items-start gap-3">
        <div
          className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${theme.label}`}
        >
          {mission.category}
        </div>

        <div
          className={`ml-auto max-w-[72%] rounded-[18px] px-4 py-2.5 text-right sm:max-w-[18rem] ${theme.pill}`}
          title={rewardLabel}
        >
          <span className="block text-[0.95rem] font-black tracking-[-0.02em] sm:text-base">
            {rewardLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 min-w-0">
        <h3 className="text-[1.24rem] font-semibold tracking-[-0.025em] text-[var(--foreground)]">
          {mission.title}
        </h3>
        <p className="mt-3 max-w-none text-[0.98rem] font-medium leading-[1.7] text-[var(--ve-muted-strong)] sm:max-w-[34ch]">
          {mission.description}
        </p>
      </div>

      {hasStructuredProgress ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.9rem] font-semibold tracking-[-0.01em] text-[var(--ve-muted)]">
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

      <div className="mt-5">
        <Button className="h-10 px-5 text-[0.98rem]" href={href}>
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
  const { user, profile } = await getCurrentUserProfile();

  if (isSupabaseConfigured && !user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  if (isSupabaseConfigured && user) {
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

  const catalog = await getLearningCatalog(supabase);
  const requestHeaders = await headers();
  const origin = buildRequestOrigin(requestHeaders);
  const currentCourse = catalog[0];
  const rawDisplayName = profile?.display_name ?? "";
  const hasRealName = Boolean(rawDisplayName && !rawDisplayName.includes("@"));
  const displayName = hasRealName ? rawDisplayName : "Learner";
  const firstName = displayName.split(/\s+/)[0] || "Learner";
  const xpBalance = profile?.xp_balance_cached ?? 45232;
  const lessonProgress =
    isSupabaseConfigured && user && supabase ? await getLessonProgress(supabase, user.id) : [];
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
  const recommendationSections = await getDashboardRecommendationSections(supabase, catalog);
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
  const rewardSnapshot =
    isSupabaseConfigured && user && supabase
      ? await getRewardStoreSnapshot(supabase, user.id, xpBalance).catch(() => null)
      : demoRewardStoreSnapshot;
  const unreadNotificationCount =
    isSupabaseConfigured && user && supabase
      ? await getUnreadNotificationCount(supabase, user.id).catch(() => 0)
      : 0;
  const featuredRewards = (rewardSnapshot?.rewards ?? []).slice(0, 2);
  const continueLearningItem =
    isSupabaseConfigured && user && supabase
      ? await getContinueLearningItem({
          supabase,
          userId: user.id,
          catalog,
          lessonProgress,
        })
      : null;
  const missionRecommendations =
    isSupabaseConfigured && user && supabase
      ? await getSupabaseMissionSummaries({
          supabase,
          userId: user.id,
          referralCode: profile?.referral_code ?? null,
          origin,
        }).catch(() => [])
      : [];
  const personalizedRecommendations =
    isSupabaseConfigured && user && supabase
      ? await getPersonalizedDashboardRecommendations({
          supabase,
          userId: user.id,
          catalog,
          lessonProgress,
          missions: missionRecommendations,
        }).catch(() => ({ sections: [], userProfile: null, userScores: [] }))
      : { sections: [], userProfile: null, userScores: [] };
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
      <section className="rounded-b-[28px] bg-[#123c35] px-7 pb-7 pt-14 text-[#fff8df]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#fff8df]">Home</h1>
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

      <section className="space-y-6 px-6 py-6 pb-28">
        <Card className="-mt-12 p-6">
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

        <SectionHeader
          actionHref="/courses"
          actionLabel="Browse"
          subtitle="Starter packs and current focus areas."
          title="Recommended for you"
        />

        {activeRecommendationSections.length > 0 ? (
          activeRecommendationSections.map((section) => (
            <div id={section.eyebrow?.toLowerCase().replace(/\s+/g, "-") ?? section.id} key={section.id}>
              <SectionHeader
                eyebrow={section.eyebrow ?? undefined}
                subtitle={section.subtitle ?? undefined}
                title={section.title}
              />
              <div className="mt-3 space-y-3">
                {section.items.map((item) =>
                  item.type === "course" ? (
                    <CourseCard
                      completedLessonIds={completedLessonIds}
                      course={item.course}
                      key={item.id}
                    />
                  ) : (
                    <LessonModuleCard
                      completed={isLessonCompleted(item.lesson.id)}
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
                <div className="mt-3 space-y-3">
                  {starterLessons.map((lesson) => (
                    <LessonModuleCard
                      completed={isLessonCompleted(lesson.id)}
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
              You have finished the current recommendations. Browse the full library to replay lessons or go deeper.
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
            <div className="mt-3 space-y-3">
              {section.items.map((item) => (
                item.lesson ? (
                  <LessonModuleCard
                    completed={isLessonCompleted(item.lesson.id)}
                    key={`${section.id}:${item.id}`}
                    lesson={item.lesson}
                  />
                ) : item.course ? (
                  <CourseCard
                    completedLessonIds={completedLessonIds}
                    course={item.course}
                    href={item.href}
                    key={`${section.id}:${item.id}`}
                  />
                ) : null
              ))}
            </div>
          </div>
        ))}

        {recommendedMissionItems.length > 0 ? (
          <div>
            <SectionHeader
              actionHref="/missions"
              actionLabel="View all"
              subtitle="Take the next challenge that fits your path."
              title="Recommended missions"
              tone="mission"
            />
            <div className="mt-3 space-y-3">
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

        {featuredRewards.length > 0 ? (
          <SectionHeader
            actionHref="/xp-store"
            actionLabel="View all"
            subtitle="Redeem XP for currently available offers."
            title="Featured rewards"
            tone="store"
          />
        ) : null}

        {featuredRewards.length > 0 ? (
          <div className="hide-scrollbar -mx-6 flex gap-3 overflow-x-auto px-6 pb-1">
            {featuredRewards.map((reward) => (
              <FeaturedRewardCard key={reward.id} reward={reward} />
            ))}
          </div>
        ) : null}
      </section>

      <BottomNav active="Home" />
    </main>
  );
}
