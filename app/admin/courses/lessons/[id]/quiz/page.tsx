import { AiAssistanceAuthoring } from "@/components/admin/ai/AiAssistanceAuthoring";
import { pageAuthoringEnabled } from "@/features/ai-generation/authoring/availability";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard, AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { AssessmentBuilder } from "@/components/admin/AssessmentBuilder";
import { LessonAuthoringSteps } from "@/components/admin/LessonAuthoringSteps";
import { requireAdmin } from "@/lib/admin";
import { formatXpLabel } from "@/lib/xp-format";
import { getAdminLesson } from "@/features/learning/admin/data";

type LessonQuizPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; aiResult?: string }>;
};

export default async function LessonQuizPage({ params, searchParams }: LessonQuizPageProps) {
  const { id } = await params;
  const { notice, aiResult } = await searchParams;
  const { supabase } = await requireAdmin();
  const data = await getAdminLesson(supabase, id);

  if (!data) {
    notFound();
  }

  const { lesson, pages, questions, quiz } = data;
  const totalXp = questions.reduce((total, question) => total + question.xp, 0);

  return (
    <div className="-mx-5 md:-mx-8">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border-subtle)] px-5 py-5 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)]"
          href={`/admin/courses/lessons/${lesson.id}`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {lesson.title}
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ui-surface-soft)] px-4 py-[9px] text-[13px] font-extrabold text-[var(--ui-action)]">
          {formatXpLabel(totalXp)} total
        </span>
      </div>

      <LessonAuthoringSteps current="quiz" lessonId={lesson.id} pageCount={pages.length} questionCount={questions.length} />
      <div className="mx-auto max-w-[720px] px-5 py-8 md:px-10">
        {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
        <h1 className="text-2xl font-black text-[var(--ui-text)]">Check what learners understood</h1>
        <p className="mt-2 text-sm font-semibold text-[var(--ui-text-muted)]">Add questions based on your lesson pages. Save each question, then choose the values this lesson helps learners explore.</p>
        {quiz ? (
          <AssessmentBuilder key={quiz.id} lesson={lesson} questions={questions} quiz={quiz} aiEnabled={pageAuthoringEnabled()} initialResultId={aiResult} />
        ) : (
          <AdminCard>
            <p className="text-sm font-semibold text-[var(--ui-text-muted)]">
              This lesson does not have a quiz yet.
            </p>
            <AiAssistanceAuthoring refreshOnApply={false} courseId={lesson.course_id} lessonId={lesson.id} kind="quiz" enabled={pageAuthoringEnabled()} initialResultId={aiResult} />
          </AdminCard>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link className="text-sm font-bold text-[var(--ui-text-muted)]" href={`/admin/courses/lessons/${lesson.id}`}>Back to pages</Link>
          <Link className="rounded-full bg-[var(--ui-action)] px-5 py-3 text-sm font-extrabold text-[var(--ui-on-action)]" href={`/admin/courses/lessons/${lesson.id}/values`}>Next: Values</Link>
        </div>
      </div>
    </div>
  );
}
