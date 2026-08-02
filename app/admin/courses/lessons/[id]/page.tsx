import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatCard,
} from "@/components/admin/AdminPrimitives";
import { AssessmentBuilder } from "@/components/admin/AssessmentBuilder";
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import { LessonForm } from "@/components/admin/LearningForms";
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
import { AiActivityPanel } from "@/features/learning/admin/ai-activity-panel";
import { getAdminAiActivity } from "@/features/learning/admin/ai-activity";

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
  const aiActivity = await getAdminAiActivity(supabase, {
    courseId: lesson.course_id,
  });

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

      <div className="mb-6">
        <AiActivityPanel activity={aiActivity} courseId={lesson.course_id} />
      </div>

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
          <LessonForm courseId={lesson.course_id} lesson={lesson} mediaLibraryAssets={mediaLibraryAssets} />
        </div>
      </details>

      <LessonPageBuilder
        blocks={blocks}
        initialPageId={selectedPageId}
        lesson={lesson}
        mediaLibraryAssets={mediaLibraryAssets}
        pages={pages}
      />

      {quiz ? <AssessmentBuilder lesson={lesson} questions={questions} quiz={quiz} /> : null}
    </>
  );
}
