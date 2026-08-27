import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { OrgBottomNav } from "@/components/organizations/OrgLearnerMobile";
import { QuizResultDetails } from "@/components/quiz/QuizResultDetails";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationCourseDeliveryContext,
  getOrganizationWorkspaceCourse,
} from "@/features/organizations/application/learner-workspace";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

type OrganizationResultsPageProps = {
  params: Promise<{ courseId: string; lessonId: string; organizationSlug: string }>;
  searchParams: Promise<{ programmeId?: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationResultsPage({ params, searchParams }: OrganizationResultsPageProps) {
  const { courseId, lessonId, organizationSlug } = await params;
  const { programmeId } = await searchParams;
  const { supabase, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const course = await getOrganizationWorkspaceCourse(supabase, workspace, courseId);
  const deliveryContext = getOrganizationCourseDeliveryContext(workspace, courseId, programmeId);
  const lesson = course?.lessons.find((item) => item.id === lessonId) ?? null;

  if (!course || !deliveryContext || !lesson) {
    notFound();
  }

  const retryHref = lesson.retryPolicy.requiresReread
    ? appendOrganizationDeliverySearchParam(
        `${orgHref(workspace, `/learn/${course.id}/lessons/${lesson.id}`)}?page=1&retry=1`,
        deliveryContext,
      )
    : appendOrganizationDeliverySearchParam(orgHref(workspace, `/learn/${course.id}/quiz/${lesson.id}`), deliveryContext);
  const questions = lesson.quiz.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    xp: question.xp,
  }));

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader
        backHref={appendOrganizationDeliverySearchParam(orgHref(workspace, `/learn/${course.id}`), deliveryContext)}
        showMenu={false}
        title="Flash Quiz Result"
      />
      <QuizResultDetails
        lessonId={lesson.id}
        lessonsHref={appendOrganizationDeliverySearchParam(orgHref(workspace, `/learn/${course.id}`), deliveryContext)}
        questions={questions}
        retryHref={retryHref}
        storeHref={orgHref(workspace, "/rewards")}
        unitLabel={workspace.xpAccount.label}
      />

      <OrgBottomNav active="Lessons" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
