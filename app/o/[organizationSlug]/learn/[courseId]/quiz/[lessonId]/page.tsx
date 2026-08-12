import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { QuizOptions } from "@/components/quiz/QuizOptions";
import {
  appendOrganizationDeliverySearchParam,
  getOrganizationCourseDeliveryContext,
  getOrganizationWorkspaceCourse,
} from "@/features/organizations/application/learner-workspace";
import { getPublicQuiz, getQuizXP } from "@/lib/lessons";
import { formatXpLabel } from "@/lib/xp-format";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

type OrganizationQuizPageProps = {
  params: Promise<{ courseId: string; lessonId: string; organizationSlug: string }>;
  searchParams: Promise<{ programmeId?: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationQuizPage({ params, searchParams }: OrganizationQuizPageProps) {
  const { courseId, lessonId, organizationSlug } = await params;
  const { programmeId } = await searchParams;
  const { supabase, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const course = await getOrganizationWorkspaceCourse(supabase, workspace, courseId);
  const deliveryContext = getOrganizationCourseDeliveryContext(workspace, courseId, programmeId);
  const lesson = course?.lessons.find((item) => item.id === lessonId) ?? null;

  if (!course || !deliveryContext || !lesson || lesson.quiz.questions.length === 0) {
    notFound();
  }

  const quiz = getPublicQuiz(lesson.quiz, `${lesson.quiz.id}:demo-attempt`);
  const lessonHref = appendOrganizationDeliverySearchParam(
    orgHref(workspace, `/learn/${course.id}/lessons/${lesson.id}`),
    deliveryContext,
  );
  const courseHref = appendOrganizationDeliverySearchParam(orgHref(workspace, `/learn/${course.id}`), deliveryContext);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader backHref={lessonHref} showMenu={false} title="Flash Quiz" />
      <section className="learner-page learner-page--spacious">
        <div className="learner-readable mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ve-muted)]">
            {lesson.title}
          </p>
          <h1 className="mt-2 text-2xl font-black leading-8">{lesson.quiz.title}</h1>
          <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
            Up to {formatXpLabel(getQuizXP(lesson.quiz), workspace.xpAccount.label)} from unearned correct answers, subject to your daily limit.
          </p>
        </div>
        <div className="learner-readable">
          <QuizOptions
            keepLearningHref={courseHref}
            lessonHref={lessonHref}
            lessonId={lesson.id}
            organizationId={deliveryContext.organizationId}
            quizId={quiz.id}
            programmeId={deliveryContext.programmeId}
            questions={quiz.questions}
            resultHref={appendOrganizationDeliverySearchParam(
              orgHref(workspace, `/learn/${course.id}/results/${lesson.id}`),
              deliveryContext,
            )}
            unitLabel={workspace.xpAccount.label}
          />
        </div>
      </section>
    </main>
  );
}
