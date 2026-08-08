import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { QuizOptions } from "@/components/quiz/QuizOptions";
import { getOrganizationWorkspaceCourse } from "@/features/organizations/application/learner-workspace";
import { getPublicQuiz, getQuizXP } from "@/lib/lessons";
import { formatXpLabel } from "@/lib/xp-format";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

type OrganizationQuizPageProps = {
  params: Promise<{ courseId: string; lessonId: string; organizationSlug: string }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationQuizPage({ params }: OrganizationQuizPageProps) {
  const { courseId, lessonId, organizationSlug } = await params;
  const { supabase, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const course = await getOrganizationWorkspaceCourse(supabase, workspace, courseId);
  const lesson = course?.lessons.find((item) => item.id === lessonId) ?? null;

  if (!course || !lesson || lesson.quiz.questions.length === 0) {
    notFound();
  }

  const quiz = getPublicQuiz(lesson.quiz, `${lesson.quiz.id}:demo-attempt`);
  const lessonHref = orgHref(workspace, `/learn/${course.id}/lessons/${lesson.id}`);
  const courseHref = orgHref(workspace, `/learn/${course.id}`);

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
            Up to {formatXpLabel(getQuizXP(lesson.quiz))} from unearned correct answers, subject to your daily limit.
          </p>
        </div>
        <div className="learner-readable">
          <QuizOptions
            keepLearningHref={courseHref}
            lessonHref={lessonHref}
            lessonId={lesson.id}
            quizId={quiz.id}
            questions={quiz.questions}
            resultHref={orgHref(workspace, `/learn/${course.id}/results/${lesson.id}`)}
          />
        </div>
      </section>
    </main>
  );
}
