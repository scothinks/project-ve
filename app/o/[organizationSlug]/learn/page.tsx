import Image from "next/image";
import Link from "next/link";
import { CourseLibrary } from "@/components/course/CourseLibrary";
import {
  OrgActionLink,
  OrgBottomNav,
  OrgLearnerChrome,
  OrgLearningTopBar,
} from "@/components/organizations/OrgLearnerMobile";
import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import {
  getOrganizationLearnerAssessmentCheckpoints,
  getOrganizationLearnerAssessmentCompletionNotice,
} from "@/features/assessments/learner/data";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationDeliveryKey,
  getOrganizationDeliveryLessonProgress,
  getOrganizationWorkspaceCourses,
} from "@/features/organizations/application/learner-workspace";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { createProgressRepository } from "@/features/app/repositories/progress";
import { getPersonalizedDashboardRecommendations } from "@/lib/personalized-recommendations";
import { getCompletedLessonIds } from "@/lib/progress";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

export default async function OrganizationLearnPage({
  params,
  searchParams,
}: {
  params: OrgRouteParams;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const resolvedSearchParams = (await searchParams) ?? {};
  const completedProgrammeId = Array.isArray(resolvedSearchParams.programmeId)
    ? resolvedSearchParams.programmeId[0]
    : resolvedSearchParams.programmeId;
  const completedAssessmentVersionId = Array.isArray(resolvedSearchParams.assessmentVersionId)
    ? resolvedSearchParams.assessmentVersionId[0]
    : resolvedSearchParams.assessmentVersionId;
  const [assessmentCheckpoints, assessmentCompletionNotice, courses, lessonProgress, myOrgsState] = await Promise.all([
    getOrganizationLearnerAssessmentCheckpoints({
      hrefBuilder: ({ assessmentVersionId, programmeId }) =>
        `${orgHref(workspace, `/assessments/${assessmentVersionId}`)}?programmeId=${encodeURIComponent(programmeId)}`,
      supabase,
      userId: user.id,
      workspace,
    }),
    getOrganizationLearnerAssessmentCompletionNotice({
      assessmentVersionId: completedAssessmentVersionId,
      programmeId: completedProgrammeId,
      supabase,
      userId: user.id,
      workspace,
    }),
    getOrganizationWorkspaceCourses(supabase, workspace),
    createProgressRepository(supabase).getLessonProgress(user.id),
    getMyOrganizationState(supabase, user.id),
  ]);
  const completedLessonIds = Array.from(
    getCompletedLessonIds(
      lessonProgress,
      courses.flatMap((course) => course.lessons),
    ),
  );
  const completedLessonIdsByDeliveryKey = Object.fromEntries(
    await Promise.all(
      courses.flatMap((course) => {
        const deliveryOptions = workspace.courseDeliveryOptions[course.id] ?? [];
        return deliveryOptions.map(async (deliveryContext) => {
          const deliveryProgress = await getOrganizationDeliveryLessonProgress({
            course,
            deliveryContext,
            fallbackProgress: lessonProgress,
            supabase,
            userId: user.id,
          });
          return [
            getOrganizationDeliveryKey(course.id, deliveryContext),
            Array.from(getCompletedLessonIds(deliveryProgress, course.lessons)),
          ] as const;
        });
      }),
    ),
  );
  function getSingleDelivery(courseId: string) {
    const options = workspace.courseDeliveryOptions[courseId] ?? [];
    return options.length === 1 ? options[0] : null;
  }

  function getOrganizationCourseHref(courseId: string) {
    const href = orgHref(workspace, `/learn/${courseId}`);
    const options = workspace.courseDeliveryOptions[courseId] ?? [];

    if (options.length > 1) {
      return orgHref(workspace, "/learn");
    }

    const deliveryContext = getSingleDelivery(courseId);
    return deliveryContext ? appendOrganizationDeliverySearchParam(href, deliveryContext) : href;
  }

  function getOrganizationLessonHref(lesson: { courseId: string; id: string }) {
    const options = workspace.courseDeliveryOptions[lesson.courseId] ?? [];

    if (options.length > 1) {
      return orgHref(workspace, "/learn");
    }

    const href = orgHref(workspace, `/learn/${lesson.courseId}/lessons/${lesson.id}`);
    const deliveryContext = getSingleDelivery(lesson.courseId);
    return deliveryContext ? appendOrganizationDeliverySearchParam(href, deliveryContext) : href;
  }

  const personalizedRecommendations = await getPersonalizedDashboardRecommendations({
    supabase,
    userId: user.id,
    catalog: courses,
    lessonProgress,
    missions: [],
    profileContext: {
      scope: "organization",
      organizationId: workspace.organizationId,
    },
    hrefBuilder: {
      courseHref: (course) => getOrganizationCourseHref(course.id),
      lessonHref: (lesson) => getOrganizationLessonHref(lesson),
      missionHref: () => orgHref(workspace, "/missions"),
    },
  });
  const recommendationItems = personalizedRecommendations.sections
    .filter((section) => section.id !== "mission")
    .flatMap((section) => section.items);
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const completedCheckpoint = assessmentCompletionNotice
    ? assessmentCheckpoints.find(
        (checkpoint) =>
          checkpoint.assessmentVersionId === assessmentCompletionNotice.assessmentVersionId &&
          checkpoint.programmeId === assessmentCompletionNotice.programmeId,
      )
    : null;
  const incompleteCheckpoints = assessmentCheckpoints.filter((checkpoint) => {
    if (
      assessmentCompletionNotice &&
      checkpoint.assessmentVersionId === assessmentCompletionNotice.assessmentVersionId &&
      checkpoint.programmeId === assessmentCompletionNotice.programmeId
    ) {
      return false;
    }

    return !checkpoint.completedAt;
  });
  const requiredCheckpoint = incompleteCheckpoints.find((checkpoint) => checkpoint.isRequired)
    ?? incompleteCheckpoints[0]
    ?? null;

  return (
    <main className="learner-system orgs-learner min-h-screen">
      {assessmentCompletionNotice ? (
        <OrgLearningTopBar backHref={orgHref(workspace, "/learn")} title="Learning" />
      ) : null}
      <OrgLearnerChrome
        active="Lessons"
        balance={workspace.xpAccount.balance}
        logoUrl={workspace.branding.logoUrl}
        organizationName={organizationName}
        organizationSlug={workspace.organizationSlug}
        pointsLabel={workspace.xpAccount.label}
        showMobileHeader={!assessmentCompletionNotice}
        workspaceSwitcher={
          <LearnerWorkspaceSwitcher
            currentOrganizationSlug={workspace.organizationSlug}
            organizations={myOrgsState.organizations}
          />
        }
      />
      <section className="learner-page learner-page--standard">
        <div className="org-desktop-page-heading">
          <p>Learning</p>
          <h1>Organisation Learning</h1>
          <span>{organizationName}</span>
        </div>
        {assessmentCompletionNotice ? (
          <section className="org-completion-notice mb-6 rounded-lg border border-[color:color-mix(in_srgb,var(--learner-green)_16%,var(--learner-border))] bg-[color:color-mix(in_srgb,var(--learner-green-soft)_36%,var(--learner-surface))] p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--learner-green)_18%,transparent)] text-[0.65rem] font-black text-[var(--learner-green-deep)]">
                  OK
                </span>
                <div className="min-w-0">
                  <h1 className="org-completion-notice__desktop-title">Assessment Complete</h1>
                  <h2 className="org-completion-notice__mobile-title text-[0.78rem] font-[700] leading-4 text-[var(--learner-text)]">
                    {assessmentCompletionNotice.title} Complete
                  </h2>
                  <p className="mt-0.5 text-[0.58rem] font-medium leading-3 text-[var(--learner-text-muted)]">
                    {assessmentCompletionNotice.completionCopy}
                  </p>
                </div>
              </div>
              {completedCheckpoint ? (
                <div className="shrink-0 text-right">
                  <strong className="block text-[0.72rem] leading-3 text-[var(--learner-reward)]">
                    +{completedCheckpoint.xpAward}
                  </strong>
                  <span className="block text-[0.5rem] font-bold uppercase leading-3 text-[var(--learner-text-muted)]">
                    {workspace.xpAccount.label}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {requiredCheckpoint ? (
          <section className="org-learning-required-state mb-5 rounded-lg bg-[var(--learner-background-cream)]">
            <span className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--learner-attention-soft)_80%,white)] px-2.5 py-1 text-[0.58rem] font-extrabold text-[var(--learner-attention)]">
              Required Assessment
            </span>
            <h1 className="mt-4 text-[1.38rem] font-[650] leading-tight text-[var(--learner-text)]">
              {requiredCheckpoint.title}
            </h1>
            <p className="mt-3 text-[0.78rem] font-medium leading-5 text-[var(--learner-text-muted)]">
              {requiredCheckpoint.introductionCopy || requiredCheckpoint.description || "Complete this checkpoint to tune your organisation recommendations."}
            </p>
            <div className="mt-4 flex min-h-28 items-center justify-between rounded-lg border border-[var(--learner-border-soft)] bg-[color:color-mix(in_srgb,var(--learner-green-soft)_24%,var(--learner-surface))] p-4">
              <span className="rounded-full bg-[var(--learner-attention-soft)] px-2 py-1 text-[0.58rem] font-bold leading-3 text-[var(--learner-attention)]">
                Required Assessment
              </span>
              <strong className="max-w-[8rem] text-right text-[1.42rem] font-[650] leading-tight text-[var(--learner-text)]">
                {requiredCheckpoint.title}
              </strong>
            </div>
            <div className="mt-4 border-l-2 border-[var(--learner-green-deep)] bg-[color:color-mix(in_srgb,var(--learner-green-soft)_30%,white)] p-3">
              <p className="text-[0.74rem] font-[650] text-[var(--learner-text)]">Before you begin</p>
              <p className="mt-1 text-[0.62rem] font-medium leading-4 text-[var(--learner-text-muted)]">
                Ensure you are in a quiet environment. This assessment is timed and cannot be paused once started.
              </p>
            </div>
            <div className="mt-5">
              <OrgActionLink className="w-full" href={requiredCheckpoint.href}>
                Start Assessment
              </OrgActionLink>
            </div>
          </section>
        ) : null}

        {assessmentCompletionNotice && recommendationItems.length > 0 ? (
          <section className="org-recommendations-section mb-5">
            <h2 className="text-[1.28rem] font-[650] leading-tight text-[var(--learner-text)]">
              Recommended Next Learning
            </h2>
            <p className="mt-2 text-[0.74rem] font-medium leading-5 text-[var(--learner-text-muted)]">
              Based on your recent assessment profile.
            </p>
            <div className="mt-4 grid gap-3">
              {recommendationItems.map((item) => {
                const image = item.course?.thumbnail ?? item.course?.coverImage;

                return (
                  <Link
                    className="grid grid-cols-[minmax(0,1fr)_4rem] gap-3 rounded-lg border border-[color:color-mix(in_srgb,var(--learner-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--learner-surface)_78%,transparent)] p-3"
                    href={item.href}
                    key={`${item.content_type}:${item.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[0.56rem] font-semibold italic leading-3 text-[var(--learner-reward)]">
                        {item.reason}
                      </p>
                      <h3 className="mt-1 text-[1rem] font-[650] leading-5 text-[var(--learner-text)]">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[0.64rem] font-medium leading-4 text-[var(--learner-text-muted)]">
                        {item.description}
                      </p>
                      <span className="mt-3 inline-flex text-[0.68rem] font-[650] text-[var(--learner-green-deep)]">
                        Open
                      </span>
                    </div>
                    <div className="relative h-16 overflow-hidden rounded bg-[var(--learner-surface-soft)]">
                      {image ? (
                        <Image
                          alt={image.alt}
                          className="h-full w-full object-cover"
                          fill
                          sizes="72px"
                          src={image.src}
                        />
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {!assessmentCompletionNotice && !requiredCheckpoint ? (
          <CourseLibrary
            completedLessonIdsByDeliveryKey={completedLessonIdsByDeliveryKey}
            completedLessonIds={completedLessonIds}
            courseHrefPrefix={orgHref(workspace, "/learn")}
            courses={courses}
            deliveryOptions={workspace.courseDeliveryOptions}
            introSubtitle="Continue programme learning, revisit completed lessons, and explore available organisation courses."
            introTitle="Continue Learning"
            lessonProgress={lessonProgress}
            unitLabel={workspace.xpAccount.label}
            variant="learnerEditorial"
          />
        ) : null}
      </section>
      <OrgBottomNav active="Lessons" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
