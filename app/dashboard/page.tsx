import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { CourseCard } from "@/components/course/CourseCard";
import { BottomNav } from "@/components/navigation/BottomNav";
import { FeaturedRewardCard } from "@/components/rewards/FeaturedRewardCard";
import { LessonModuleCard } from "@/components/lesson/LessonModuleCard";
import { MissionPanel } from "@/components/missions/MissionPanel";
import { Avatar } from "@/components/profile/Avatar";
import { ReferralAttributionCapture } from "@/components/referrals/ReferralAttributionCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
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

function PersonalizedRecommendationCard({
  href,
  title,
  description,
  reason,
  dimensionLabel,
  recommendedLevel,
}: {
  href: string;
  title: string;
  description: string;
  reason: string;
  dimensionLabel: string | null;
  recommendedLevel: string | null;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        {dimensionLabel ? (
          <StatusBadge tone="trust">{dimensionLabel}</StatusBadge>
        ) : null}
        {recommendedLevel ? (
          <StatusBadge tone="neutral">{recommendedLevel}</StatusBadge>
        ) : null}
      </div>
      <h3 className="mt-3 text-[1.18rem] font-black tracking-[-0.03em]">{title}</h3>
      <p className="mt-2 text-[0.95rem] font-medium leading-6 text-[var(--ve-muted-strong)]">
        {description}
      </p>
      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-green)]">{reason}</p>
      <div className="mt-4">
        <Button className="h-10 px-4 text-sm" href={href} variant="soft">
          Open
        </Button>
      </div>
    </Card>
  );
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

        {personalizedRecommendations.sections.map((section) => (
          <div key={section.id}>
            <SectionHeader
              subtitle={section.subtitle}
              title={section.title}
            />
            <div className="mt-3 space-y-3">
              {section.items.map((item) => (
                <PersonalizedRecommendationCard
                  description={item.description}
                  dimensionLabel={item.dimension_label}
                  href={item.href}
                  key={`${section.id}:${item.id}`}
                  reason={item.reason}
                  recommendedLevel={item.recommended_level}
                  title={item.title}
                />
              ))}
            </div>
          </div>
        ))}

        <MissionPanel maxItems={1} mode="featured" />

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
