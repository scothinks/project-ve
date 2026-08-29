import Link from "next/link";
import {
  OrgActionLink,
  OrgBottomNav,
  OrgLearnerChrome,
  OrgProgressMeter,
} from "@/components/organizations/OrgLearnerMobile";
import {
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  CompassIcon,
  KebabIcon,
  ShopIcon,
} from "@/components/organizations/OrgIcons";
import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import {
  getOrganizationLearnerAssessmentCheckpoints,
} from "@/features/assessments/learner/data";
import { createProgressRepository } from "@/features/app/repositories/progress";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationDeliveryLessonProgress,
  getOrganizationWorkspaceCourseCards,
  type OrganizationCourseDeliveryOption,
} from "@/features/organizations/application/learner-workspace";
import type { LearningCourseCard } from "@/features/learning/application/course-card-model";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import {
  getCompletedLessonIds,
  getCourseProgress,
  getCourseResumeTarget,
  type LessonProgressRecord,
} from "@/lib/progress";
import { measureAsync } from "@/lib/performance";

function displayName(profileName: string | null | undefined) {
  return profileName && !profileName.includes("@") ? profileName : "Learner";
}

type HomeLearningItem = {
  completedLessons: number;
  course: LearningCourseCard;
  deliveryContext: OrganizationCourseDeliveryOption | null;
  href: string;
  progressPercent: number;
  resumeHref: string;
  resumeLabel: string;
  totalLessons: number;
};

function appendPageParam(href: string, pageNumber?: number) {
  if (!pageNumber) return href;
  const [pathname, queryString = ""] = href.split("?");
  const params = new URLSearchParams(queryString);
  params.set("page", String(pageNumber));
  return `${pathname}?${params.toString()}`;
}

async function buildHomeLearningItems({
  courses,
  fallbackProgress,
  supabase,
  userId,
  workspace,
}: {
  courses: LearningCourseCard[];
  fallbackProgress: LessonProgressRecord[];
  supabase: Awaited<ReturnType<typeof requireOrgLearnerRoute>>["supabase"];
  userId: string;
  workspace: Awaited<ReturnType<typeof requireOrgLearnerRoute>>["workspace"];
}): Promise<HomeLearningItem[]> {
  const items = await Promise.all(
    courses.flatMap((course) => {
      const options = workspace.courseDeliveryOptions[course.id] ?? [null];

      return options.map(async (deliveryContext) => {
        const progress = deliveryContext
          ? await getOrganizationDeliveryLessonProgress({
              course,
              deliveryContext,
              fallbackProgress,
              supabase,
              userId,
            })
          : fallbackProgress;
        const completedLessonIds = getCompletedLessonIds(progress, course.lessons);
        const courseProgress = getCourseProgress(course, completedLessonIds);
        const courseHref = deliveryContext
          ? appendOrganizationDeliverySearchParam(orgHref(workspace, `/learn/${course.id}`), deliveryContext)
          : orgHref(workspace, `/learn/${course.id}`);
        const resumeTarget = getCourseResumeTarget(course, progress, completedLessonIds, {
          lessonHref: (lessonId, pageNumber) => {
            const href = orgHref(workspace, `/learn/${course.id}/lessons/${lessonId}`);
            return deliveryContext
              ? appendOrganizationDeliverySearchParam(appendPageParam(href, pageNumber), deliveryContext)
              : appendPageParam(href, pageNumber);
          },
          quizHref: (lessonId) => {
            const href = orgHref(workspace, `/learn/${course.id}/quiz/${lessonId}`);
            return deliveryContext ? appendOrganizationDeliverySearchParam(href, deliveryContext) : href;
          },
        });

        return {
          completedLessons: courseProgress.completedLessons,
          course,
          deliveryContext,
          href: courseHref,
          progressPercent: courseProgress.progressPercent,
          resumeHref: resumeTarget?.href ?? courseHref,
          resumeLabel: resumeTarget?.label ?? "Open Course",
          totalLessons: courseProgress.lessonCount,
        };
      });
    }),
  );

  return items.sort((left, right) => {
    const leftStarted = left.progressPercent > 0 && left.progressPercent < 100 ? 1 : 0;
    const rightStarted = right.progressPercent > 0 && right.progressPercent < 100 ? 1 : 0;
    if (leftStarted !== rightStarted) return rightStarted - leftStarted;
    if (left.progressPercent !== right.progressPercent) return right.progressPercent - left.progressPercent;
    return left.course.title.localeCompare(right.course.title);
  });
}

export default async function OrganizationLearnerHomePage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { profile, supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const [courses, lessonProgress, assessmentCheckpoints, myOrgsState] = await Promise.all([
    measureAsync("org.home.learning_course_cards", () =>
      getOrganizationWorkspaceCourseCards(supabase, workspace),
    ),
    createProgressRepository(supabase).getLessonProgress(user.id),
    getOrganizationLearnerAssessmentCheckpoints({
      hrefBuilder: ({ assessmentVersionId, programmeId }) =>
        `${orgHref(workspace, `/assessments/${assessmentVersionId}`)}?programmeId=${encodeURIComponent(programmeId)}`,
      supabase,
      userId: user.id,
      workspace,
    }),
    getMyOrganizationState(supabase, user.id),
  ]);
  const learningItems = await buildHomeLearningItems({
    courses,
    fallbackProgress: lessonProgress,
    supabase,
    userId: user.id,
    workspace,
  });
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const name = displayName(profile.display_name);
  const activeLearningItem =
    learningItems.find((item) => item.progressPercent > 0 && item.progressPercent < 100) ??
    learningItems.find((item) => item.progressPercent < 100) ??
    learningItems[0] ??
    null;
  const requiredAssessment = assessmentCheckpoints.find((checkpoint) => checkpoint.isRequired && !checkpoint.completedAt)
    ?? assessmentCheckpoints.find((checkpoint) => !checkpoint.completedAt)
    ?? null;
  const totalLessons = learningItems.reduce((sum, item) => sum + item.totalLessons, 0);
  const completedLessons = learningItems.reduce((sum, item) => sum + item.completedLessons, 0);
  const programmeProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : null;
  const isCaughtUp = !requiredAssessment && (!activeLearningItem || activeLearningItem.progressPercent >= 100);

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <OrgLearnerChrome
        active="Home"
        balance={workspace.xpAccount.balance}
        logoUrl={workspace.branding.logoUrl}
        organizationName={organizationName}
        organizationSlug={workspace.organizationSlug}
        pointsLabel={workspace.xpAccount.label}
        workspaceSwitcher={
          <LearnerWorkspaceSwitcher
            currentOrganizationSlug={workspace.organizationSlug}
            organizations={myOrgsState.organizations}
          />
        }
      />
      <section className="learner-page learner-page--standard">
        {isCaughtUp ? (
          <div className="org-home-caught-up grid gap-5 pt-4">
            <div className="mx-auto grid size-16 place-items-center rounded-full border border-[var(--learner-border-soft)] bg-[var(--learner-surface)]">
              <span className="grid size-8 place-items-center rounded-full bg-[var(--learner-green-deep)] text-white">
                <CheckIcon className="size-4" />
              </span>
            </div>
            <div className="text-center">
              <h1 className="text-[1.38rem] font-[650] leading-tight text-[var(--learner-text)]">
                You&apos;re up to date
              </h1>
              <p className="mx-auto mt-2 max-w-[17rem] text-[0.76rem] font-medium leading-5 text-[var(--learner-text-muted)]">
                All required lessons are complete. Enjoy the downtime or explore further.
              </p>
            </div>
            {programmeProgress !== null ? (
              <section className="org-mobile-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[1rem] font-[650] leading-5 text-[var(--learner-text)]">
                    Programme Progress
                  </h2>
                  <span className="rounded bg-[color:color-mix(in_srgb,var(--learner-green-soft)_75%,white)] px-2 py-1 text-[0.56rem] font-bold leading-3 text-[var(--learner-green-deep)]">
                    {programmeProgress}% complete
                  </span>
                </div>
                <div className="mt-3">
                  <OrgProgressMeter value={programmeProgress} />
                </div>
              </section>
            ) : null}

            <section>
              <p className="org-mobile-section-label uppercase">Suggested next steps</p>
              <div className="mt-3 grid gap-3">
                <Link
                  className="org-mobile-card flex items-center gap-3 p-3"
                  href={orgHref(workspace, "/learn")}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[color:color-mix(in_srgb,var(--learner-reward-soft)_80%,white)] text-[var(--learner-reward)]">
                    <BookIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.78rem] font-[650] text-[var(--learner-text)]">Explore Library</span>
                    <p className="mt-0.5 text-[0.62rem] font-medium leading-4 text-[var(--learner-text-muted)]">
                      Deepen your knowledge with available courses.
                    </p>
                  </span>
                  <ArrowRightIcon className="size-4 shrink-0 text-[var(--learner-text-muted)]" />
                </Link>
                <div className="grid grid-cols-2 gap-3">
                  <Link className="org-mobile-card block p-3" href={orgHref(workspace, "/missions")}>
                    <span className="grid size-9 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--learner-green)_14%,transparent)] text-[var(--learner-green-deep)]">
                      <CompassIcon className="size-4" />
                    </span>
                    <span className="mt-2 block text-[0.72rem] font-[650] text-[var(--learner-text)]">Browse Missions</span>
                    <p className="mt-0.5 text-[0.58rem] font-medium leading-4 text-[var(--learner-text-muted)]">Complete tasks and earn rewards</p>
                  </Link>
                  <Link className="org-mobile-card block p-3" href={orgHref(workspace, "/rewards")}>
                    <span className="grid size-9 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--learner-green)_14%,transparent)] text-[var(--learner-green-deep)]">
                      <ShopIcon className="size-4" />
                    </span>
                    <span className="mt-2 block text-[0.72rem] font-[650] text-[var(--learner-text)]">Store</span>
                    <p className="mt-0.5 text-[0.58rem] font-medium leading-4 text-[var(--learner-text-muted)]">Spend {workspace.xpAccount.label}</p>
                  </Link>
                </div>
              </div>
            </section>
            <aside className="org-home-side" aria-label="Organisation context">
              <section className="org-mobile-card org-home-context-card">
                <p>{workspace.xpAccount.label}</p>
                <strong>{new Intl.NumberFormat("en-US").format(workspace.xpAccount.balance)}</strong>
                <span>Available in {organizationName}</span>
              </section>
              <section className="org-mobile-card org-home-context-card">
                <p>Workspace</p>
                <strong>{organizationName}</strong>
                <span>Use the switcher in the header to change organisation context.</span>
              </section>
              <Link className="org-mobile-card org-home-context-card block" href={orgHref(workspace, "/notifications")}>
                <p>Workspace updates</p>
                <strong>Notifications</strong>
                <span>Review messages for this organisation.</span>
              </Link>
            </aside>
          </div>
        ) : (
          <div className="org-home-active grid gap-4">
            <div className="org-home-intro">
              <h1 className="text-[1.35rem] font-[650] leading-tight text-[var(--learner-text)]">
                Welcome back, {name}.
              </h1>
              <p className="mt-1 text-[0.76rem] font-medium leading-5 text-[var(--learner-text-muted)]">
                Continue your required lessons and prepare for upcoming assessments.
              </p>
            </div>
            {activeLearningItem ? (
              <section className="org-mobile-card org-home-continue relative overflow-hidden p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="org-mobile-kicker">In progress</span>
                  <KebabIcon className="size-4 text-[var(--learner-text-muted)]" />
                </div>
                <Link className="mt-2 block" href={activeLearningItem.href}>
                  <h2 className="text-[1rem] font-[650] leading-5 text-[var(--learner-text)]">
                    {activeLearningItem.course.title}
                  </h2>
                  <p className="mt-1 text-[0.68rem] font-medium leading-4 text-[var(--learner-text-muted)]">
                    {activeLearningItem.deliveryContext?.label ?? activeLearningItem.course.category}
                    {activeLearningItem.totalLessons > 0 ? ` - Module ${Math.min(activeLearningItem.completedLessons + 1, activeLearningItem.totalLessons)}` : ""}
                  </p>
                </Link>
                <div className="mt-3 pb-2">
                  <OrgActionLink className="w-full" href={activeLearningItem.resumeHref}>
                    {activeLearningItem.resumeLabel.replace("Course", "Learning")}
                  </OrgActionLink>
                </div>
                <OrgProgressMeter flush value={activeLearningItem.progressPercent} />
              </section>
            ) : null}

            {requiredAssessment ? (
              <Link
                className="org-mobile-card org-home-required block border-[color:color-mix(in_srgb,var(--learner-reward)_58%,var(--learner-border))] bg-[var(--learner-background-cream)] p-3"
                href={requiredAssessment.href}
              >
                <p className="org-mobile-gold-kicker">Required Assessment</p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[1rem] font-[650] leading-5 text-[var(--learner-text)]">
                      {requiredAssessment.title}
                    </h2>
                  </div>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--learner-reward)] text-[var(--learner-reward)]">
                    <ArrowRightIcon className="size-4" />
                  </span>
                </div>
              </Link>
            ) : null}
            <aside className="org-home-side" aria-label="Organisation context">
              <section className="org-mobile-card org-home-context-card">
                <p>{workspace.xpAccount.label}</p>
                <strong>{new Intl.NumberFormat("en-US").format(workspace.xpAccount.balance)}</strong>
                <span>Earned through required learning, missions, and assessments.</span>
              </section>
              <section className="org-mobile-card org-home-context-card">
                <p>Organisation</p>
                <strong>{organizationName}</strong>
                <span>Your active workspace is set by the organisation context.</span>
              </section>
              <Link className="org-mobile-card org-home-context-card block" href={orgHref(workspace, "/notifications")}>
                <p>Workspace updates</p>
                <strong>Notifications</strong>
                <span>Review messages for this organisation.</span>
              </Link>
            </aside>
          </div>
        )}
      </section>
      <OrgBottomNav active="Home" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
