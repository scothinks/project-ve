import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { QuizResultDetails } from "@/components/quiz/QuizResultDetails";
import { getOrganizationWorkspaceCourse } from "@/features/organizations/application/learner-workspace";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

type OrganizationResultsPageProps = {
  params: Promise<{ courseId: string; lessonId: string; organizationSlug: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationResultsPage({ params }: OrganizationResultsPageProps) {
  const { courseId, lessonId, organizationSlug } = await params;
  const { supabase, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const course = await getOrganizationWorkspaceCourse(supabase, workspace, courseId);
  const lesson = course?.lessons.find((item) => item.id === lessonId) ?? null;

  if (!course || !lesson) {
    notFound();
  }

  const retryHref = lesson.retryPolicy.requiresReread
    ? `${orgHref(workspace, `/learn/${course.id}/lessons/${lesson.id}`)}?page=1&retry=1`
    : orgHref(workspace, `/learn/${course.id}/quiz/${lesson.id}`);
  const questions = lesson.quiz.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    xp: question.xp,
  }));

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader backHref={orgHref(workspace, `/learn/${course.id}`)} showMenu={false} title="Flash Quiz Result" />
      <QuizResultDetails
        lessonId={lesson.id}
        lessonsHref={orgHref(workspace, `/learn/${course.id}`)}
        questions={questions}
        retryHref={retryHref}
        storeHref={orgHref(workspace, "/rewards")}
      />

      <BottomNav active="Store" />
    </main>
  );
}
