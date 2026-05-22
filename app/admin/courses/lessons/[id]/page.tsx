import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import {
  LessonForm,
  QuizSettingsForm,
  QuizQuestionForm,
} from "@/components/admin/LearningForms";
import { LessonPageBuilder } from "@/components/admin/LessonPageBuilder";
import { getAdminLesson, requireAdmin } from "@/lib/admin";
import { formatXpLabel } from "@/lib/xp-format";

type LessonDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; notice?: string }>;
};

export default async function LessonDetailPage({ params, searchParams }: LessonDetailPageProps) {
  const { id } = await params;
  const { page: selectedPageId, notice } = await searchParams;
  const { supabase } = await requireAdmin();
  const detail = await getAdminLesson(supabase, id);

  if (!detail) {
    notFound();
  }

  const { lesson, pages, blocks, quiz, questions } = detail;
  const totalXp = questions.reduce((total, question) => total + question.xp, 0);

  return (
    <>
      <AdminPageHeader
        backHref={`/admin/courses/${lesson.course_id}`}
        backLabel="Course"
        eyebrow="Learning"
        title={lesson.title}
        subtitle="Shape the lesson experience from reading flow to scored quiz questions."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <AdminStatCard label="Pages" value={pages.length} />
        <AdminStatCard label="Blocks" value={blocks.length} />
        <AdminStatCard label="Questions" value={questions.length} tone="mission" />
        <AdminStatCard label="Quiz XP" value={formatXpLabel(totalXp)} tone="store" />
        <AdminCard className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Preview</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-black text-[#087f5b]">
            <Link href={`/lessons/${lesson.id}`}>Lesson</Link>
            {quiz ? <Link href={`/quiz/${lesson.id}`}>Quiz</Link> : null}
          </div>
        </AdminCard>
      </section>

      <details className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-sm">
        <summary className="cursor-pointer text-lg font-black">Lesson setup</summary>
        <div className="mt-5">
          <LessonForm courseId={lesson.course_id} lesson={lesson} />
        </div>
      </details>

      <LessonPageBuilder
        blocks={blocks}
        initialPageId={selectedPageId}
        lesson={lesson}
        pages={pages}
      />

      {quiz ? (
        <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
          <AdminCard>
            <QuizSettingsForm lessonId={lesson.id} quiz={quiz} />
          </AdminCard>
          <AdminCard>
            <h2 className="mb-1 text-lg font-black">Add question</h2>
            <p className="mb-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              XP lives on questions. Multiple choice is graded all-or-nothing.
            </p>
            <QuizQuestionForm
              lessonId={lesson.id}
              quiz={quiz}
              defaultQuestionOrder={questions.length + 1}
            />
          </AdminCard>
        </section>
      ) : null}

      {quiz ? (
        <section className="mt-6">
          <AdminCard>
            <h2 className="mb-4 text-lg font-black">Quiz questions</h2>
            {questions.length === 0 ? (
              <EmptyAdminState>No quiz questions yet.</EmptyAdminState>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => (
                  <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={question.id}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#087f5b]">
                          Question {question.question_order} · {question.question_type.replaceAll("_", " ")}
                        </p>
                        <h3 className="mt-1 font-black">{question.prompt}</h3>
                      </div>
                      <AdminStatusBadge tone="store">{formatXpLabel(question.xp)}</AdminStatusBadge>
                    </div>
                    <QuizQuestionForm lessonId={lesson.id} quiz={quiz} question={question} />
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </section>
      ) : null}
    </>
  );
}
