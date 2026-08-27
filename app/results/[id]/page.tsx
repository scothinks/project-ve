import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { QuizResultDetails } from "@/components/quiz/QuizResultDetails";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

type ResultsPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);
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
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <div className="hidden lg:block">
        <LearnerTopChrome
          active="Lessons"
          avatarUrl={profile?.avatar_url}
          displayName={displayName}
          email={user?.email}
        />
      </div>
      <AppHeader title="Flash Quiz Result" />
      <QuizResultDetails
        lessonId={lesson.id}
        questions={questions}
        retryHref={retryHref}
      />

      <div className="lg:hidden">
        <BottomNav active="Lessons" />
      </div>
    </main>
  );
}
