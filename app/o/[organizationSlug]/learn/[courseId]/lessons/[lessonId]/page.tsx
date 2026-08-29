import { notFound } from "next/navigation";
import { LessonDeliveryPage } from "@/features/learning/application/lesson-delivery-page";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationCourseDeliveryContext,
  getOrganizationWorkspaceCourse,
} from "@/features/organizations/application/learner-workspace";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

type OrganizationLessonPageProps = {
  params: Promise<{ courseId: string; lessonId: string; organizationSlug: string }>;
  searchParams: Promise<{ page?: string; programmeId?: string; ref?: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationLessonPage({
  params,
  searchParams,
}: OrganizationLessonPageProps) {
  const { courseId, lessonId, organizationSlug } = await params;
  const { page, programmeId, ref } = await searchParams;
  const { supabase, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const course = await getOrganizationWorkspaceCourse(supabase, workspace, courseId);
  const deliveryContext = getOrganizationCourseDeliveryContext(workspace, courseId, programmeId);

  if (!course || !deliveryContext || !course.lessons.some((lesson) => lesson.id === lessonId)) {
    notFound();
  }

  const courseHref = appendOrganizationDeliverySearchParam(orgHref(workspace, `/learn/${courseId}`), deliveryContext);
  const lessonBaseHref = orgHref(workspace, `/learn/${courseId}/lessons/${lessonId}`);
  const scopedLessonBaseHref = appendOrganizationDeliverySearchParam(lessonBaseHref, deliveryContext);

  return (
    <LessonDeliveryPage
      courseHref={courseHref}
      lessonHref={(pageNumber) => appendOrganizationDeliverySearchParam(`${lessonBaseHref}?page=${pageNumber}`, deliveryContext)}
      lessonId={lessonId}
      organizationId={deliveryContext.organizationId}
      pageParam={page}
      programmeId={deliveryContext.programmeId}
      quizHref={appendOrganizationDeliverySearchParam(orgHref(workspace, `/learn/${courseId}/quiz/${lessonId}`), deliveryContext)}
      refCode={ref}
      routePath={scopedLessonBaseHref}
    />
  );
}
