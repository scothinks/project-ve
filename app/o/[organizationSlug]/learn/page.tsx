import Link from "next/link";
import { CourseLibrary } from "@/components/course/CourseLibrary";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getOrganizationLearnerAssessmentCheckpoints } from "@/features/assessments/learner/data";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationDeliveryKey,
  getOrganizationDeliveryLessonProgress,
  getOrganizationWorkspaceCourses,
} from "@/features/organizations/application/learner-workspace";
import { createProgressRepository } from "@/features/app/repositories/progress";
import { getPersonalizedDashboardRecommendations } from "@/lib/personalized-recommendations";
import { getCompletedLessonIds } from "@/lib/progress";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

export default async function OrganizationLearnPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const [assessmentCheckpoints, courses, lessonProgress] = await Promise.all([
    getOrganizationLearnerAssessmentCheckpoints({
      hrefBuilder: ({ assessmentVersionId, programmeId }) =>
        `${orgHref(workspace, `/assessments/${assessmentVersionId}`)}?programmeId=${encodeURIComponent(programmeId)}`,
      supabase,
      userId: user.id,
      workspace,
    }),
    getOrganizationWorkspaceCourses(supabase, workspace),
    createProgressRepository(supabase).getLessonProgress(user.id),
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
  function getDefaultDelivery(courseId: string) {
    return workspace.courseDeliveryOptions[courseId]?.[0] ?? null;
  }

  function getOrganizationCourseHref(courseId: string) {
    const href = orgHref(workspace, `/learn/${courseId}`);
    const deliveryContext = getDefaultDelivery(courseId);
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
      lessonHref: (lesson) => {
        const href = orgHref(workspace, `/learn/${lesson.courseId}/lessons/${lesson.id}`);
        const deliveryContext = getDefaultDelivery(lesson.courseId);
        return deliveryContext ? appendOrganizationDeliverySearchParam(href, deliveryContext) : href;
      },
      missionHref: () => orgHref(workspace, "/missions"),
    },
  });
  const recommendationItems = personalizedRecommendations.sections
    .filter((section) => section.id !== "mission")
    .flatMap((section) => section.items);
  const organizationName = workspace.branding.shortName || workspace.branding.name;

  return (
    <main className="mobile-shell min-h-screen">
      <AppHeader title={`${organizationName} Learning`} backHref={orgHref(workspace)} showMenu={false} />
      <section className="learner-page learner-page--standard">
        <div className="mb-4">
          <Link className="text-sm font-black text-[var(--ve-green)]" href="/courses">
            Return to Project Ve
          </Link>
        </div>
        <SectionHeader
          eyebrow="Org learning"
          subtitle="Assigned programmes and organisation-accessible courses for this workspace."
        />
        {assessmentCheckpoints.length > 0 ? (
          <section className="mt-5">
            <SectionHeader
              eyebrow="Assessment checkpoints"
              subtitle={`Complete ${organizationName} assessment checkpoints to tune recommendations for this workspace.`}
            />
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {assessmentCheckpoints.map((checkpoint) => (
                <Card
                  className="flex h-full flex-col justify-between p-5"
                  key={`${checkpoint.programmeId}:${checkpoint.assessmentVersionId}`}
                  variant="quiet"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--ve-panel)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                        {checkpoint.programmeTitle}
                      </span>
                      <span className="rounded-full bg-[color:color-mix(in_srgb,var(--ve-green)_10%,var(--ve-card))] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-green)]">
                        {checkpoint.completedAt ? "Completed" : checkpoint.isRequired ? "Required" : "Optional"}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                      {checkpoint.title}
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                      {checkpoint.introductionCopy || checkpoint.description || "Answer a short assessment for this programme."}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-black text-[var(--ve-muted)]">
                      {checkpoint.xpAward} {workspace.xpAccount.label}
                    </span>
                    <Link
                      className="inline-flex h-10 items-center rounded-[12px] bg-[var(--ve-green)] px-4 text-sm font-black text-white"
                      href={checkpoint.href}
                    >
                      {checkpoint.completedAt ? "Retake" : "Start"}
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
        {recommendationItems.length > 0 ? (
          <section className="mt-5">
            <SectionHeader
              eyebrow="Recommended"
              subtitle={`Based on your ${organizationName} assessment profile.`}
            />
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {recommendationItems.map((item) => (
                <Card className="p-5" key={`${item.content_type}:${item.id}`}>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                    {item.content_type.replace("_", " ")}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                    {item.reason}
                  </p>
                  <Link
                    className="mt-4 inline-flex h-10 items-center rounded-[12px] bg-[var(--ve-green)] px-4 text-sm font-black text-white"
                    href={item.href}
                  >
                    Open
                  </Link>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
        <div className="mt-5">
          {courses.length > 0 ? (
            <CourseLibrary
              completedLessonIdsByDeliveryKey={completedLessonIdsByDeliveryKey}
              completedLessonIds={completedLessonIds}
              courseHrefPrefix={orgHref(workspace, "/learn")}
              courses={courses}
              deliveryOptions={workspace.courseDeliveryOptions}
              unitLabel={workspace.xpAccount.label}
            />
          ) : (
            <Card className="p-5 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]" variant="quiet">
              No courses are available in this organisation workspace yet.
            </Card>
          )}
        </div>
      </section>
      <BottomNav active="Lesson" />
    </main>
  );
}
