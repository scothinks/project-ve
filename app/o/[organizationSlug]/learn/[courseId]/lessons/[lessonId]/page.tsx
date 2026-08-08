import { notFound } from "next/navigation";
import { LessonDeliveryPage } from "@/features/learning/application/lesson-delivery-page";
import { getOrganizationWorkspaceCourse } from "@/features/organizations/application/learner-workspace";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

type OrganizationLessonPageProps = {
  params: Promise<{ courseId: string; lessonId: string; organizationSlug: string }>;
  searchParams: Promise<{ page?: string; ref?: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationLessonPage({
  params,
  searchParams,
}: OrganizationLessonPageProps) {
  const { courseId, lessonId, organizationSlug } = await params;
  const { page, ref } = await searchParams;
  const { supabase, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const course = await getOrganizationWorkspaceCourse(supabase, workspace, courseId);

  if (!course || !course.lessons.some((lesson) => lesson.id === lessonId)) {
    notFound();
  }

  const courseHref = orgHref(workspace, `/learn/${courseId}`);
  const lessonBaseHref = orgHref(workspace, `/learn/${courseId}/lessons/${lessonId}`);

  return (
    <LessonDeliveryPage
      courseHref={courseHref}
      dashboardHref={courseHref}
      lessonHref={(pageNumber) => `${lessonBaseHref}?page=${pageNumber}`}
      lessonId={lessonId}
      pageParam={page}
      quizHref={orgHref(workspace, `/learn/${courseId}/quiz/${lessonId}`)}
      refCode={ref}
      routePath={lessonBaseHref}
    />
  );
}
