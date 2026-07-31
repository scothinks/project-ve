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
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import {
  LessonForm,
  QuizSettingsForm,
  QuizQuestionForm,
} from "@/components/admin/LearningForms";
import { LessonPageBuilder } from "@/components/admin/LessonPageBuilder";
import {
  approveLessonMedia,
  approveLessonManualMedia,
  approveLearningMediaAsset,
  approveLessonText,
  generateLearningMediaAsset,
  generateLessonMediaAssets,
  requestLessonMediaChanges,
  requestLessonTextChanges,
  saveLearningMediaAsset,
  useLibraryMediaAsset,
} from "@/app/admin/courses/lesson-page-actions";
import { getAiMediaConfig } from "@/lib/ai-media-generator";
import { requireAdmin } from "@/lib/admin";
import { formatXpLabel } from "@/lib/xp-format";
import { LessonDetailAiMediaSection } from "@/features/learning/admin/lesson-detail-ai-media-section";
import { getAdminLessonDetailPageData } from "@/features/learning/admin/lesson-detail-data";

type LessonDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; notice?: string }>;
};

export default async function LessonDetailPage({ params, searchParams }: LessonDetailPageProps) {
  const { id } = await params;
  const { page: selectedPageId, notice } = await searchParams;
  const { supabase } = await requireAdmin();
  const data = await getAdminLessonDetailPageData(supabase, id);

  if (!data) {
    notFound();
  }

  const {
    blocks,
    hasManualLessonMedia,
    hasRequiredImageAssets,
    lesson,
    mediaApprovalBlocked,
    mediaAssets,
    mediaLibraryAssets,
    mediaValidation,
    pages,
    questions,
    quiz,
    storedMediaFeedback,
    storedTextFeedback,
    totalXp,
    valueDimensions,
    valueTags,
  } = data;
  const mediaConfig = getAiMediaConfig();

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
      <ContentValueTagEditor
        contentId={lesson.id}
        contentType="lesson"
        dimensions={valueDimensions}
        redirectTo={`/admin/courses/lessons/${lesson.id}`}
        tags={valueTags}
      />
      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <AdminStatCard label="Pages" value={pages.length} />
        <AdminStatCard label="Blocks" value={blocks.length} />
        <AdminStatCard label="Questions" value={questions.length} tone="mission" />
        <AdminStatCard label="Quiz XP" value={formatXpLabel(totalXp)} tone="store" />
        <AdminCard className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Preview</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-black text-[var(--ve-green)]">
            <Link href={`/lessons/${lesson.id}`}>Lesson</Link>
            {quiz ? <Link href={`/quiz/${lesson.id}`}>Quiz</Link> : null}
          </div>
        </AdminCard>
      </section>

      <LessonDetailAiMediaSection
        actions={{
          approveLearningMediaAsset,
          approveLessonManualMedia,
          approveLessonMedia,
          approveLessonText,
          generateLearningMediaAsset,
          generateLessonMediaAssets,
          requestLessonMediaChanges,
          requestLessonTextChanges,
          saveLearningMediaAsset,
          useLibraryMediaAsset,
        }}
        hasManualLessonMedia={hasManualLessonMedia}
        hasRequiredImageAssets={hasRequiredImageAssets}
        lesson={lesson}
        mediaApprovalBlocked={mediaApprovalBlocked}
        mediaAssets={mediaAssets}
        mediaConfig={mediaConfig}
        mediaLibraryAssets={mediaLibraryAssets}
        mediaValidation={mediaValidation}
        storedMediaFeedback={storedMediaFeedback}
        storedTextFeedback={storedTextFeedback}
      />

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
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
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
