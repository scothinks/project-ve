import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { QuizResultDetails } from "@/components/quiz/QuizResultDetails";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ResultsPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const learningRepository = createLearningRepository(supabase);
  const detail = await learningRepository.getLesson(id);

  if (!detail) {
    notFound();
  }

  const { lesson } = detail;
  const retryHref = lesson.retryPolicy.requiresReread
    ? `/lessons/${lesson.id}?page=1&retry=1`
    : `/quiz/${lesson.id}`;
  const questions = lesson.quiz.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    xp: question.xp,
  }));

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title="Flash Quiz Result" />
      <QuizResultDetails
        lessonId={lesson.id}
        questions={questions}
        retryHref={retryHref}
      />

      <BottomNav active="Store" />
    </main>
  );
}
