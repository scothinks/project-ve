import Link from "next/link";
import { CourseLibrary } from "@/components/course/CourseLibrary";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getOrganizationDeliveryKey,
  getOrganizationDeliveryLessonProgress,
  getOrganizationWorkspaceCourses,
} from "@/features/organizations/application/learner-workspace";
import { createProgressRepository } from "@/features/app/repositories/progress";
import { getCompletedLessonIds } from "@/lib/progress";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

export default async function OrganizationLearnPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const [courses, lessonProgress] = await Promise.all([
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
