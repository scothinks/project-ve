import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { QuizOptions } from "@/components/quiz/QuizOptions";
import { getPublicQuiz, getQuizXP } from "@/lib/lessons";
import { getLearningLesson } from "@/lib/supabase-learning";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatXpLabel } from "@/lib/xp-format";

type QuizPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: QuizPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const detail = await getLearningLesson(supabase, id);

  if (!detail || detail.lesson.quiz.questions.length === 0) {
    notFound();
  }

  const { lesson } = detail;
  const quiz = getPublicQuiz(lesson.quiz, `${lesson.quiz.id}:demo-attempt`);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title="Flash Quiz" />
      <section className="px-6 py-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ve-muted)]">
            {lesson.title}
          </p>
          <h1 className="mt-2 text-2xl font-black leading-8">{lesson.quiz.title}</h1>
          <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
            Up to {formatXpLabel(getQuizXP(lesson.quiz))} from unearned correct answers, subject to your daily limit.
          </p>
        </div>
        <QuizOptions lessonId={lesson.id} quizId={quiz.id} questions={quiz.questions} />
      </section>
    </main>
  );
}
