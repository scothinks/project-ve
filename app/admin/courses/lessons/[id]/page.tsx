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
import { LessonWorkspaceTabs } from "@/components/admin/LessonWorkspaceTabs";
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
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";

type LessonDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; notice?: string; tab?: string }>;
};

export default async function LessonDetailPage({ params, searchParams }: LessonDetailPageProps) {
  const { id } = await params;
  const { page: selectedPageId, notice, tab } = await searchParams;
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
  const { data: courseContext, error: courseContextError } = await supabase
    .from("courses")
    .select("organization_id")
    .eq("id", lesson.course_id)
    .maybeSingle();

  if (courseContextError) {
    throw courseContextError;
  }

  const organizationEntitlements = courseContext?.organization_id
    ? (await resolveOrganizationEntitlements(supabase, courseContext.organization_id)).entitlements
    : null;
  const aiGenerationAvailable = organizationEntitlements?.aiAuthoringEnabled ?? true;
  const allowedBlockTypes = organizationEntitlements?.allowedLessonBlockTypes;
  const aiActivity = await getAdminAiActivity(supabase, {
    courseId: lesson.course_id,
  });

  const indexPanel = (
    <>
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

      <AdminCard>
        <h2 className="text-lg font-black">Lesson setup</h2>
        <div className="mt-5">
          <LessonForm
            aiGenerationAvailable={aiGenerationAvailable}
            courseId={lesson.course_id}
            lesson={lesson}
            mediaLibraryAssets={mediaLibraryAssets}
          />
        </div>
      </AdminCard>
    </>
  );

  const workspacePanel = (
    <LessonPageBuilder
      aiGenerationAvailable={aiGenerationAvailable}
      allowedBlockTypes={allowedBlockTypes}
      blocks={blocks}
      initialPageId={selectedPageId}
      lesson={lesson}
      mediaLibraryAssets={mediaLibraryAssets}
      pages={pages}
    />
  );

  const reviewPanel = (
    <>
      {aiGenerationAvailable ? (
        <div className="mb-6">
          <AiActivityPanel activity={aiActivity} courseId={lesson.course_id} />
        </div>
      ) : null}

      {aiGenerationAvailable ? (
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
          aiGenerationAvailable={aiGenerationAvailable}
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
      ) : null}

      {quiz ? (
        <AssessmentBuilder lesson={lesson} questions={questions} quiz={quiz} />
      ) : (
        <AdminCard>
          <p className="text-sm font-semibold text-[var(--ve-muted-strong)]">
            This lesson does not have a quiz yet.
          </p>
        </AdminCard>
      )}
    </>
  );

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

      <LessonWorkspaceTabs defaultTab={tab} index={indexPanel} review={reviewPanel} workspace={workspacePanel} />
    </>
  );
}
