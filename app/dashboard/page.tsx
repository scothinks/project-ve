import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { BottomNav } from "@/components/navigation/BottomNav";
import {
  LearnerNotificationControl,
  LearnerTopChrome,
} from "@/components/navigation/LearnerTopChrome";
import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { BoostIcon, FlagIcon, HubIcon, MedalIcon } from "@/components/missions/MissionIcons";
import { FeaturedRewardCard } from "@/components/rewards/FeaturedRewardCard";
import { ReferralAttributionCapture } from "@/components/referrals/ReferralAttributionCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChatIcon, ChevronRightIcon, GraduationCapIcon, SparkleIcon } from "@/components/ui/Icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import type {
  LearningCourseCard,
  LearningLessonCard,
} from "@/features/learning/application/course-card-model";
import {
  getMissionBoostDetails,
  getMissionRewardEffect,
  getMissionRewardLabel,
  type MissionCategory,
  type UserMissionSummary,
} from "@/lib/missions";
import {
  getCompletedLessonIds,
  getContinueLearningItem,
  getCourseProgress,
  type ContinueLearningItem,
  type LessonProgressRecord,
} from "@/lib/progress";
import type { RewardStoreSnapshot } from "@/lib/rewards";
import { resolveDashboardXpBalance } from "@/lib/observability";
import { measureAsync } from "@/lib/performance";
import { getCurrentUserContext } from "@/lib/supabase-server";
import { isDemoMode, isLiveMode } from "@/lib/app-mode";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { createProgressRepository } from "@/features/app/repositories/progress";
import {
  getUserAssessmentCompletionStatus,
  learnerNeedsValuesAssessment,
} from "@/lib/values-assessment";
import { formatXpAmount, formatXpLabel } from "@/lib/xp-format";
import {
  startDashboardSecondaryData,
  type DashboardSecondaryData,
} from "@/features/dashboard/application/secondary-data";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="learner-progress-track">
      <div className="learner-progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function ContinueLearningCard({
  item,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getContinueLearningItem>>>;
}) {
  return (
    <Card className="dashboard-hero-card overflow-hidden" variant="quiet">
      <div className="dashboard-hero-card__image">
        <Image
          alt={item.lesson.coverImage.alt}
          className={`h-full w-full ${getImageFitClass(item.lesson.coverImage)}`}
          fill
          sizes="(max-width: 768px) 100vw, 820px"
          src={item.lesson.coverImage.src}
          style={getImagePresentationStyle(item.lesson.coverImage)}
        />
        <div className="dashboard-hero-card__scrim" />
        <div className="dashboard-hero-card__copy">
          <p>{item.statusLabel}</p>
          <h2>{item.lesson.title}</h2>
          <span>{item.course.title}</span>
        </div>
      </div>
      <div className="dashboard-hero-card__body">
        <div className="flex items-center justify-between gap-3">
          <p className="dashboard-meta">Progress</p>
          <p className="dashboard-progress-value">{item.progressPercent}%</p>
        </div>
        <ProgressBar value={item.progressPercent} />
        <p className="dashboard-hero-card__helper">{item.helperText}</p>
        <div className="mt-4 flex">
          <Button href={item.href} className="dashboard-primary-action">
            {item.ctaLabel}
            <ChevronRightIcon className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function getDemoContinueLearningItem({
  catalog,
  lessonProgress,
}: {
  catalog: LearningCourseCard[];
  lessonProgress: LessonProgressRecord[];
}): ContinueLearningItem | null {
  const lessonById = new Map(
    catalog.flatMap((course) => course.lessons.map((lesson) => [lesson.id, { lesson, course }] as const)),
  );
  const startedLessons = lessonProgress
    .map((record) => {
      const entry = lessonById.get(record.lesson_id);
      if (!entry || (record.completed_pages?.length ?? 0) === 0) {
        return null;
      }

      const completedPageIds = new Set(record.completed_pages ?? []);
      const totalPages = entry.lesson.pages.length;
      const completedPageCount = entry.lesson.pages.filter((page) => completedPageIds.has(page.id)).length;

      if (completedPageCount >= totalPages) {
        return null;
      }

      return {
        ...entry,
        completedPageCount,
        record,
        totalPages,
        progressPercent: totalPages > 0 ? Math.round((completedPageCount / totalPages) * 100) : 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      const rightUpdated = right.record.updated_at ? new Date(right.record.updated_at).getTime() : 0;
      const leftUpdated = left.record.updated_at ? new Date(left.record.updated_at).getTime() : 0;
      return rightUpdated - leftUpdated;
    });

  const candidate = startedLessons[0];
  if (!candidate) {
    return null;
  }

  const nextPage =
    candidate.lesson.pages.find((page) => !new Set(candidate.record.completed_pages ?? []).has(page.id)) ??
    candidate.lesson.pages[candidate.completedPageCount];
  const nextPageNumber = nextPage?.order ?? Math.min(candidate.completedPageCount + 1, candidate.totalPages);

  return {
    course: candidate.course,
    lesson: candidate.lesson,
    href: `/lessons/${candidate.lesson.id}?page=${nextPageNumber}`,
    ctaLabel: "Continue",
    helperText: `${candidate.completedPageCount}/${candidate.totalPages} pages completed`,
    progressPercent: candidate.progressPercent,
    statusLabel: `Page ${Math.min(candidate.completedPageCount + 1, candidate.totalPages)} of ${candidate.totalPages}`,
  };
}

function XpBalanceCard({
  xpBalance,
}: {
  xpBalance: number;
}) {
  return (
    <Card className="dashboard-xp-card" variant="quiet">
      <p className="dashboard-meta">Your balance</p>
      <p className="dashboard-xp-card__value">
        <span>{formatXpAmount(xpBalance)}</span>
        <small>XP</small>
      </p>
    </Card>
  );
}

function shouldShowMissionProgress(mission: UserMissionSummary) {
  return !mission.referral && mission.targetCount > 0;
}

function getMissionProgressUnit(mission: UserMissionSummary) {
  switch (mission.validationType) {
    case "course_completed":
      return mission.targetCount === 1 ? "Course" : "Courses";
    case "lesson_completed":
    case "lesson_count_completed":
      return mission.targetCount === 1 ? "Module" : "Modules";
    case "proof_upload":
    case "manual_review":
      return mission.targetCount === 1 ? "Task" : "Tasks";
    case "referral_friend_completed_lessons":
      return mission.targetCount === 1 ? "Lesson" : "Lessons";
    default:
      return mission.targetCount === 1 ? "Step" : "Steps";
  }
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
    <div className="dashboard-reward-section">
      <SectionHeader
        actionHref="/xp-store"
        actionLabel="View all"
        title="Featured rewards"
        tone="store"
      />
      <div
        className={
          compact
            ? "mt-3 space-y-2.5"
            : "mt-3 grid grid-cols-1 gap-3"
        }
      >
        {rewards.map((reward) => (
          <FeaturedRewardCard compact={compact} key={reward.id} reward={reward} />
        ))}
      </div>
    </div>
  );
}

const secondaryDashboardCardListClass =
  "dashboard-recommendation-grid mt-3";

const recommendedMissionTheme: Record<
  MissionCategory,
  {
    card: string;
    pill: string;
    label: string;
    progress: string;
    icon: (props: { className?: string }) => ReactNode;
  }
> = {
  course: {
    card: "border-[var(--learner-border)] bg-[var(--learner-surface)]",
    pill: "bg-[var(--learner-reward-soft)] text-[var(--learner-reward)]",
    label: "bg-[var(--learner-green-soft)] text-[var(--learner-green)]",
    progress: "bg-[var(--learner-mission)]",
    icon: GraduationCapIcon,
  },
  referral: {
    card: "border-[var(--learner-border)] bg-[var(--learner-surface)]",
    pill: "bg-[var(--learner-reward-soft)] text-[var(--learner-reward)]",
    label: "bg-[var(--learner-reward-soft)] text-[var(--learner-reward)]",
    progress: "bg-[var(--learner-reward)]",
    icon: HubIcon,
  },
  feedback: {
    card: "border-[var(--learner-border)] bg-[var(--learner-surface)]",
    pill: "bg-[var(--learner-attention-soft)] text-[var(--learner-attention)]",
    label: "bg-[var(--learner-attention-soft)] text-[var(--learner-attention)]",
    progress: "bg-[var(--learner-attention)]",
    icon: ChatIcon,
  },
  campaign: {
    card: "border-[var(--learner-border)] bg-[var(--learner-surface)]",
    pill: "bg-[var(--learner-mission-soft)] text-[var(--learner-mission-text)]",
    label: "bg-[var(--learner-mission-soft)] text-[var(--learner-mission-text)]",
    progress: "bg-[var(--learner-mission)]",
    icon: FlagIcon,
  },
  custom: {
    card: "border-[var(--learner-border)] bg-[var(--learner-surface)]",
    pill: "bg-[var(--learner-surface-soft)] text-[var(--learner-text-muted)]",
    label: "bg-[var(--learner-surface-soft)] text-[var(--learner-text-muted)]",
    progress: "bg-[var(--learner-text-muted)]",
    icon: MedalIcon,
  },
};

function RecommendedMissionCard({
  mission,
  href,
  compact = false,
  mobileTeaser = false,
}: {
  mission: UserMissionSummary;
  href: string;
  compact?: boolean;
  mobileTeaser?: boolean;
}) {
  const theme = recommendedMissionTheme[mission.category];
  const CategoryIcon = theme.icon;
  const rewardLabel = getMissionRewardLabel(mission);
  const boostDetails = getMissionRewardEffect(mission) === "boost" ? getMissionBoostDetails(mission) : null;
  const progressPercent =
    mission.targetCount > 0 ? Math.min(100, (mission.progressCount / mission.targetCount) * 100) : 0;
  const hasStructuredProgress = shouldShowMissionProgress(mission);

  return (
    <Card
      className={`dashboard-mission-card overflow-hidden ${
        mobileTeaser ? "dashboard-mission-card--mobile-teaser" : ""
      } ${compact ? "p-4" : "p-5"} ${theme.card}`}
      variant="quiet"
    >
      <div className="dashboard-mission-card__layout">
        <span className="dashboard-mission-card__icon" aria-hidden="true">
          <CategoryIcon className="size-4" />
        </span>
        <div className="dashboard-mission-card__main">
          <div className="dashboard-mission-card__top">
            <div
              className={`dashboard-mission-card__category inline-flex rounded-[10px] font-black uppercase ${
                compact
                  ? "px-2.5 py-1 text-[10px] tracking-[0.12em]"
                  : "px-3 py-1 text-[11px] tracking-[0.14em]"
              } ${theme.label}`}
            >
              {mission.category}
            </div>

            <div
              className={`dashboard-mission-card__reward ml-auto text-right ${
                compact
                  ? "max-w-[62%] rounded-[16px] px-3 py-2"
                  : "max-w-[72%] rounded-[18px] px-4 py-2.5 sm:max-w-[18rem]"
              } ${theme.pill}`}
              title={boostDetails ? `${boostDetails.multiplier}x ${boostDetails.unitLabel} Boost` : rewardLabel}
            >
              {boostDetails ? (
                <span
                  className={`inline-flex items-center gap-1.5 font-black tracking-[-0.02em] ${
                    compact ? "text-[0.9rem]" : "text-[0.95rem] sm:text-base"
                  }`}
                >
                  {boostDetails.multiplier}x
                  <BoostIcon className="size-[1.05em]" />
                </span>
              ) : (
                <span
                  className={`block font-black tracking-[-0.02em] ${
                    compact ? "text-[0.9rem]" : "text-[0.95rem] sm:text-base"
                  }`}
                >
                  {rewardLabel}
                </span>
              )}
            </div>
          </div>

          <div className={`${compact ? "mt-4" : "mt-5"} dashboard-mission-card__content min-w-0`}>
            <h3
              className={`${compact ? "text-[1.05rem]" : "text-[1.24rem]"} dashboard-mission-card__title font-semibold tracking-[-0.025em] text-[var(--foreground)]`}
            >
              {mission.title}
            </h3>
            <p
              className={`${
                compact
                  ? "mt-2 line-clamp-3 text-[0.86rem] leading-6"
                  : "mt-3 text-[0.98rem] leading-[1.7] sm:max-w-[34ch]"
              } dashboard-mission-card__body max-w-none font-medium text-[var(--ve-muted-strong)]`}
            >
              {mission.description}
            </p>
          </div>

          {hasStructuredProgress ? (
            <div className={`${compact ? "mt-4" : "mt-5"} dashboard-mission-card__progress`}>
              <div
                className={`flex flex-wrap items-center justify-between gap-2 font-semibold tracking-[-0.01em] text-[var(--ve-muted)] ${
                  compact ? "text-[0.8rem]" : "text-[0.9rem]"
                }`}
              >
                <span className="dashboard-mission-card__progress-label min-w-0 flex-1">
                  Progress
                </span>
                <span className="dashboard-mission-card__progress-count shrink-0">
                  {mission.progressCount} / {mission.targetCount} {getMissionProgressUnit(mission)}
                </span>
                <span className="dashboard-mission-card__progress-percent shrink-0">
                  {Math.round(progressPercent)}%
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

          <div className={`${compact ? "mt-4" : "mt-5"} dashboard-mission-card__action-row`}>
            <Button
              className={`${compact ? "h-9 px-4 text-sm" : "h-10 px-5 text-[0.98rem]"} dashboard-mission-action`}
              href={href}
              variant="outline"
            >
              Continue Mission
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DashboardCourseCard({
  completedLessonIds,
  course,
  href,
}: {
  completedLessonIds: Set<string>;
  course: LearningCourseCard;
  href?: string;
}) {
  const { completedLessons, lessonCount, progressPercent } = getCourseProgress(
    course,
    completedLessonIds,
  );

  return (
    <Link className="dashboard-curated-card" href={href ?? `/courses/${course.id}`}>
      <div className="dashboard-curated-card__image">
        <Image
          alt={course.thumbnail.alt}
          className={`h-full w-full ${getImageFitClass(course.thumbnail)}`}
          fill
          sizes="(max-width: 768px) 50vw, 360px"
          src={course.thumbnail.src}
          style={getImagePresentationStyle(course.thumbnail)}
        />
      </div>
      <div className="dashboard-curated-card__body">
        <div className="flex items-start justify-between gap-3">
          <span className="dashboard-tag">{course.category}</span>
          <span className="dashboard-bookmark" aria-hidden="true" />
        </div>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <ProgressBar value={progressPercent} />
        <div className="dashboard-curated-card__meta">
          <span>
            {completedLessons}/{lessonCount} modules
          </span>
          <span>{formatXpLabel(course.xp)}</span>
        </div>
        <span className="dashboard-curated-card__cta">Start Course</span>
      </div>
    </Link>
  );
}

function DashboardLessonCard({
  completed,
  lesson,
}: {
  completed: boolean;
  lesson: LearningLessonCard;
}) {
  return (
    <Link className="dashboard-curated-card" href={`/lessons/${lesson.id}`}>
      <div className="dashboard-curated-card__image">
        <Image
          alt={lesson.coverImage.alt}
          className={`h-full w-full ${getImageFitClass(lesson.coverImage)}`}
          fill
          sizes="(max-width: 768px) 50vw, 360px"
          src={lesson.coverImage.src}
          style={getImagePresentationStyle(lesson.coverImage)}
        />
      </div>
      <div className="dashboard-curated-card__body">
        <div className="flex items-start justify-between gap-3">
          <span className="dashboard-tag">{completed ? "Complete" : "Lesson"}</span>
          <span className="dashboard-bookmark" aria-hidden="true" />
        </div>
        <h3>{lesson.title}</h3>
        <p>{lesson.summary}</p>
        <div className="dashboard-curated-card__meta">
          <span>{completed ? "Completed" : `${lesson.estimatedMinutes} min`}</span>
          <span>{formatXpLabel(lesson.xp)}</span>
        </div>
        <span className="dashboard-curated-card__cta">
          {completed ? "Review Lesson" : "Start Lesson"}
        </span>
      </div>
    </Link>
  );
}

function buildRecommendedMissionItems(params: {
  personalizedSection:
    | Awaited<DashboardSecondaryData["personalizedRecommendations"]>["sections"][number]
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

function getMobileMissionItems(
  items: Array<{
    id: string;
    href: string;
    mission: UserMissionSummary;
  }>,
) {
  return [...items]
    .sort((left, right) => {
      return Number(shouldShowMissionProgress(right.mission)) - Number(shouldShowMissionProgress(left.mission));
    })
    .slice(0, 1);
}

function SecondarySectionFallback({ label }: { label: string }) {
  return (
    <div
      aria-label={`${label} loading`}
      className="min-h-24 animate-pulse rounded-[18px] bg-[var(--learner-surface-soft)]"
      data-dashboard-secondary-fallback={label}
      role="status"
    />
  );
}

async function DashboardWorkspaceSwitcher({
  organizations,
}: {
  organizations: DashboardSecondaryData["organizations"];
}) {
  const state = await organizations;
  return <LearnerWorkspaceSwitcher organizations={state.organizations} />;
}

async function DashboardNotificationControl({
  unreadNotifications,
}: {
  unreadNotifications: DashboardSecondaryData["unreadNotifications"];
}) {
  const count = await unreadNotifications;
  return <LearnerNotificationControl unreadNotificationCount={count} />;
}

async function EditorialRecommendationSections({
  catalog,
  completedLessonIds,
  recommendationSections,
}: {
  catalog: LearningCourseCard[];
  completedLessonIds: Set<string>;
  recommendationSections: DashboardSecondaryData["editorialRecommendations"];
}) {
  const sections = await recommendationSections;
  const isLessonCompleted = (lessonId: string) => completedLessonIds.has(lessonId);
  const isCourseCompleted = (course: LearningCourseCard) => {
    const progress = getCourseProgress(course, completedLessonIds);
    return progress.lessonCount > 0 && progress.completedLessons === progress.lessonCount;
  };
  const activeSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.type === "course"
          ? !isCourseCompleted(item.course)
          : !isLessonCompleted(item.lesson.id),
      ),
    }))
    .filter((section) => section.items.length > 0);
  const starterLessons = (catalog[0]?.lessons ?? []).filter(
    (lesson) => !isLessonCompleted(lesson.id),
  );

  if (activeSections.length > 0) {
    return (
      <section data-dashboard-secondary="editorial-recommendations">
        <SectionHeader actionHref="/courses" actionLabel="View all" title="Curated for You" />
        <div className={secondaryDashboardCardListClass}>
          {activeSections.flatMap((section) =>
            section.items.slice(0, 2).map((item) =>
              item.type === "course" ? (
                <DashboardCourseCard
                  completedLessonIds={completedLessonIds}
                  course={item.course}
                  key={item.id}
                />
              ) : (
                <DashboardLessonCard
                  completed={isLessonCompleted(item.lesson.id)}
                  key={item.id}
                  lesson={item.lesson}
                />
              ),
            ),
          )}
        </div>
      </section>
    );
  }

  if (catalog.length > 0 && sections.length === 0) {
    return (
      <section data-dashboard-secondary="editorial-recommendations">
        <SectionHeader actionHref="/courses" actionLabel="View all" title="Curated for You" />
        {starterLessons.length ? (
          <div className="mt-3" id="lessons">
            <SectionHeader
              eyebrow="Starter pack"
              subtitle="Begin with practical choices and everyday values."
            />
            <div className={secondaryDashboardCardListClass}>
              {starterLessons.map((lesson) => (
                <DashboardLessonCard
                  completed={isLessonCompleted(lesson.id)}
                  key={lesson.id}
                  lesson={lesson}
                />
              ))}
            </div>
          </div>
        ) : null}
        <Card className="mt-3 p-5">
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
      </section>
    );
  }

  if (catalog.length > 0) {
    return (
      <Card className="p-5" data-dashboard-secondary="editorial-recommendations">
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
    );
  }

  return (
    <Card className="p-5" data-dashboard-secondary="editorial-recommendations">
      <h2 className="text-base font-black">No lessons yet</h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
        New values education courses will appear here when they are published.
      </p>
    </Card>
  );
}

async function PersonalizedRecommendationSections({
  completedLessonIds,
  personalizedRecommendations,
}: {
  completedLessonIds: Set<string>;
  personalizedRecommendations: DashboardSecondaryData["personalizedRecommendations"];
}) {
  const result = await personalizedRecommendations;
  const sections = result.sections.filter((section) => section.id !== "mission");

  if (sections.length === 0) return null;

  return sections.map((section) => (
    <section data-dashboard-secondary="personalized-recommendations" key={section.id}>
      <SectionHeader subtitle={section.subtitle} title={section.title} />
      <div className={secondaryDashboardCardListClass}>
        {section.items.map((item) =>
          item.lesson ? (
            <DashboardLessonCard
              completed={completedLessonIds.has(item.lesson.id)}
              key={`${section.id}:${item.id}`}
              lesson={item.lesson}
            />
          ) : item.course ? (
            <DashboardCourseCard
              completedLessonIds={completedLessonIds}
              course={item.course}
              href={item.href}
              key={`${section.id}:${item.id}`}
            />
          ) : null,
        )}
      </div>
    </section>
  ));
}

async function DashboardMissionSection({
  compact,
  missions,
  personalizedRecommendations,
}: {
  compact: boolean;
  missions: DashboardSecondaryData["missions"];
  personalizedRecommendations: DashboardSecondaryData["personalizedRecommendations"];
}) {
  const [missionItems, personalized] = await Promise.all([missions, personalizedRecommendations]);
  const personalizedMissionSection = personalized.sections.find((section) => section.id === "mission");
  const items = buildRecommendedMissionItems({
    personalizedSection: personalizedMissionSection,
    featuredMission: missionItems[0] ?? null,
  });
  const visibleItems = compact ? items.slice(0, 2) : getMobileMissionItems(items);

  if (visibleItems.length === 0) return null;

  if (compact) {
    return (
      <section className="dashboard-mission-section" data-dashboard-secondary="missions">
        <Card className="dashboard-mission-surface" variant="quiet">
          <SectionHeader actionHref="/missions" actionLabel="View all" title="Active Missions" tone="mission" />
          <div className="mt-3 space-y-3">
            {visibleItems.map((item) => (
              <RecommendedMissionCard
                compact
                href={item.href}
                key={`desktop-mission:${item.id}`}
                mission={item.mission}
              />
            ))}
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section
      className="dashboard-mobile-section dashboard-mission-section"
      data-dashboard-secondary="missions"
    >
      <div className="dashboard-mobile-mission-panel">
        <SectionHeader title="Active Missions" />
        <div className="mt-3 space-y-3">
          {visibleItems.map((item) => (
            <RecommendedMissionCard
              compact
              href={item.href}
              key={`mobile-mission:${item.id}`}
              mission={item.mission}
              mobileTeaser
            />
          ))}
        </div>
      </div>
    </section>
  );
}

async function DashboardRewardsSection({
  compact = false,
  rewards,
}: {
  compact?: boolean;
  rewards: DashboardSecondaryData["rewards"];
}) {
  const snapshot = await rewards;
  return (
    <div
      className={compact ? undefined : "dashboard-mobile-section"}
      data-dashboard-secondary="rewards"
    >
      <FeaturedRewardsSection compact={compact} rewards={(snapshot?.rewards ?? []).slice(0, 2)} />
    </div>
  );
}

async function DashboardAdSection({
  className,
  homeFeedAd,
}: {
  className?: string;
  homeFeedAd: DashboardSecondaryData["homeFeedAd"];
}) {
  const ad = await homeFeedAd;
  return (
    <div className={className} data-dashboard-secondary="ads">
      <DirectAdCard ad={ad} className="dashboard-sponsored-card" />
    </div>
  );
}

export default async function DashboardPage() {
  const { supabase, user, profile } = await getCurrentUserContext();

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

  const learningRepository = createLearningRepository(supabase);
  const progressRepository = createProgressRepository(supabase);
  const repositoryUserId = user?.id ?? "demo-user";

  const [catalog, lessonProgress] = await measureAsync("dashboard.core.learning", () => Promise.all([
    measureAsync("dashboard.learning_course_cards", () => learningRepository.getCourseCards()),
    user || isDemoMode
      ? progressRepository.getLessonProgress(repositoryUserId)
      : Promise.resolve([]),
  ]));
  const rawDisplayName = profile?.display_name ?? "";
  const hasRealName = Boolean(rawDisplayName && !rawDisplayName.includes("@"));
  const displayName = hasRealName ? rawDisplayName : "Learner";
  const firstName = displayName.split(/\s+/)[0] || "Learner";

  const xpBalance = resolveDashboardXpBalance({
    isConfigured: isLiveMode,
    profile,
    userId: user?.id,
  });
  const completedLessonIds = getCompletedLessonIds(
    lessonProgress,
    catalog.flatMap((course) => course.lessons),
  );
  const continueLearningItem = await measureAsync("dashboard.core.continue_learning", () =>
    isLiveMode && user && supabase
      ? getContinueLearningItem({
          supabase,
          userId: user.id,
          catalog,
          lessonProgress,
        })
      : isDemoMode
        ? Promise.resolve(getDemoContinueLearningItem({ catalog, lessonProgress }))
        : Promise.resolve(null),
  );
  const secondary = startDashboardSecondaryData({
    catalog,
    lessonProgress,
    referralCode: profile?.referral_code ?? null,
    repositoryUserId,
    supabase,
    userId: user?.id ?? null,
    xpBalance,
  });
  return (
    <main className="learner-system dashboard-learner min-h-screen">
      <ReferralAttributionCapture />
      <LearnerTopChrome
        active="Home"
        avatarUrl={profile?.avatar_url}
        displayName={displayName}
        email={user?.email}
        notificationControl={(
          <Suspense fallback={<LearnerNotificationControl />}>
            <DashboardNotificationControl unreadNotifications={secondary.unreadNotifications} />
          </Suspense>
        )}
        workspaceSwitcher={(
          <Suspense fallback={<LearnerWorkspaceSwitcher organizations={[]} />}>
            <DashboardWorkspaceSwitcher organizations={secondary.organizations} />
          </Suspense>
        )}
      />

      <section className="dashboard-welcome">
        <p>Good morning,</p>
        <div className="flex items-start justify-between gap-4">
          <h1>
            Welcome back,
            <br />
            {firstName}
          </h1>
          <div className="dashboard-welcome__xp">
            <span>{xpBalance.toLocaleString()}</span>
            <small>XP</small>
          </div>
        </div>
      </section>

      <section className="dashboard-canvas">
        <div className="dashboard-main-column">
          {continueLearningItem ? (
            <section data-dashboard-core="continue-learning">
              <SectionHeader title="Continue Learning" />
              <div className="mt-3">
                <ContinueLearningCard item={continueLearningItem} />
              </div>
            </section>
          ) : (
            <section className="dashboard-empty-hero" data-dashboard-core="continue-learning">
              <div className="dashboard-empty-hero__icon">
                <SparkleIcon className="h-8 w-8" />
              </div>
              <h2>No Active Learning</h2>
              <p>There&rsquo;s currently no learning available to continue.</p>
              <Button className="dashboard-empty-hero__action" href="/courses">
                Explore Course Library
              </Button>
            </section>
          )}

          <Suspense fallback={<SecondarySectionFallback label="missions" />}>
            <DashboardMissionSection
              compact={false}
              missions={secondary.missions}
              personalizedRecommendations={secondary.personalizedRecommendations}
            />
          </Suspense>

          <Suspense fallback={<SecondarySectionFallback label="editorial recommendations" />}>
            <EditorialRecommendationSections
              catalog={catalog}
              completedLessonIds={completedLessonIds}
              recommendationSections={secondary.editorialRecommendations}
            />
          </Suspense>

          <Suspense fallback={<SecondarySectionFallback label="personalized recommendations" />}>
            <PersonalizedRecommendationSections
              completedLessonIds={completedLessonIds}
              personalizedRecommendations={secondary.personalizedRecommendations}
            />
          </Suspense>

          <Suspense fallback={<SecondarySectionFallback label="advertisement" />}>
            <DashboardAdSection
              className="dashboard-mobile-section dashboard-mobile-ad-section"
              homeFeedAd={secondary.homeFeedAd}
            />
          </Suspense>

          <Suspense fallback={<SecondarySectionFallback label="rewards" />}>
            <DashboardRewardsSection rewards={secondary.rewards} />
          </Suspense>
        </div>

        <aside className="dashboard-side-column">
          <XpBalanceCard
            xpBalance={xpBalance}
          />

          <Suspense fallback={<SecondarySectionFallback label="missions" />}>
            <DashboardMissionSection
              compact
              missions={secondary.missions}
              personalizedRecommendations={secondary.personalizedRecommendations}
            />
          </Suspense>

          <Suspense fallback={<SecondarySectionFallback label="advertisement" />}>
            <DashboardAdSection homeFeedAd={secondary.homeFeedAd} />
          </Suspense>

          <Suspense fallback={<SecondarySectionFallback label="rewards" />}>
            <DashboardRewardsSection compact rewards={secondary.rewards} />
          </Suspense>
        </aside>
      </section>

      <footer className="dashboard-footer">
        <p>© 2024 Project Ve.</p>
        <nav aria-label="Project Ve footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>

      <div className="learner-mobile-nav">
        <BottomNav active="Home" />
      </div>
    </main>
  );
}
