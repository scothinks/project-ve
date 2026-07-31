import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatCard,
} from "@/components/admin/AdminPrimitives";
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import { saveLesson, setLessonStatus } from "@/app/admin/courses/actions";
import {
  approveCourseMedia,
  approveCourseManualMedia,
  approveLearningMediaAsset,
  approveCourseText,
  generateCourseMediaAssets,
  generateLearningMediaAsset,
  normalizeCourseLegacyMediaAssets,
  publishApprovedCourse,
  reviseCourseTextWithAi,
  requestCourseMediaChanges,
  requestCourseTextChanges,
  saveLearningMediaAsset,
  useLibraryMediaAsset,
  generateCourseExpansionPlan,
  generateLessonFromExpansionSuggestion,
  generatePlannedLessonsFromSelectedPlan,
} from "@/app/admin/courses/detail-page-actions";
import { CourseForm } from "@/components/admin/LearningForms";
import { getAiMediaConfig } from "@/lib/ai-media-generator";
import { requireAdmin } from "@/lib/admin";
import { getAdminCourseDetailPageData } from "@/features/learning/admin/course-detail-data";
import { CourseDetailExpansionSection } from "@/features/learning/admin/course-detail-expansion-section";
import { CourseDetailLessonReviewSection } from "@/features/learning/admin/course-detail-lesson-review-section";
import { CourseDetailMediaRegistrySection } from "@/features/learning/admin/course-detail-media-registry-section";
import { CourseDetailShellMediaSection } from "@/features/learning/admin/course-detail-shell-media-section";
import { CourseDetailWorkflowSection } from "@/features/learning/admin/course-detail-workflow-section";

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lessonsPage?: string; notice?: string }>;
};

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { id } = await params;
  const { lessonsPage, notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const data = await getAdminCourseDetailPageData(supabase, id);

  if (!data) {
    notFound();
  }

  const {
    course,
    lessons,
    categories,
    mediaAssets,
    expansionPlans,
    valueDimensions,
    valueTags,
    plannerShellPlan,
    plannerShellSelection,
    showPlannedLessonContinuation,
    mediaValidation,
    hasRequiredImageAssets,
    mediaLibraryAssets,
    hasManualCourseMedia,
    optionalWarningCounts,
    optionalWarningByAssetId,
    storedTextFeedback,
    storedMediaFeedback,
    legacyMediaAssetCount,
    courseThumbnailAsset,
    courseCoverAsset,
    pagesByLessonId,
    quizByLessonId,
    questionCountByQuizId,
    mediaAssetsByLessonId,
    mediaApprovalBlocked,
  } = data;
  const mediaConfig = getAiMediaConfig();

  return (
    <>
      <AdminPageHeader
        backHref="/admin/courses"
        backLabel="Courses"
        eyebrow="Learning"
        title={course.title}
        subtitle="Build the learner journey: course promise, lesson sequence, and publish readiness."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <ContentValueTagEditor
        contentId={course.id}
        contentType="course"
        dimensions={valueDimensions}
        redirectTo={`/admin/courses/${course.id}`}
        tags={valueTags}
      />
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Lessons" value={lessons.length} />
        <AdminStatCard
          label="Published"
          tone="mission"
          value={lessons.filter((lesson) => lesson.status === "published").length}
        />
        <AdminStatCard
          label="Disabled"
          tone="warning"
          value={lessons.filter((lesson) => lesson.status === "draft").length}
        />
        <AdminCard className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Preview</p>
          <Link className="mt-3 text-sm font-black text-[var(--ve-green)]" href={`/courses/${course.id}`}>
            Open learner course
          </Link>
        </AdminCard>
      </section>
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <CourseDetailWorkflowSection
          actions={{
            approveCourseMedia,
            approveCourseManualMedia,
            approveCourseText,
            generateCourseMediaAssets,
            generatePlannedLessonsFromSelectedPlan,
            publishApprovedCourse,
            requestCourseMediaChanges,
            requestCourseTextChanges,
            reviseCourseTextWithAi,
          }}
          course={course}
          hasManualCourseMedia={hasManualCourseMedia}
          hasRequiredImageAssets={hasRequiredImageAssets}
          mediaApprovalBlocked={mediaApprovalBlocked}
          mediaConfig={mediaConfig}
          mediaValidation={mediaValidation}
          optionalWarningCounts={optionalWarningCounts}
          plannerShellPlan={plannerShellPlan}
          plannerShellSelection={plannerShellSelection}
          showPlannedLessonContinuation={showPlannedLessonContinuation}
          storedMediaFeedback={storedMediaFeedback}
          storedTextFeedback={storedTextFeedback}
        />

        <CourseDetailMediaRegistrySection
          actions={{
            approveLearningMediaAsset,
            generateLearningMediaAsset,
            normalizeCourseLegacyMediaAssets,
            saveLearningMediaAsset,
            useLibraryMediaAsset,
          }}
          course={course}
          hasRequiredImageAssets={hasRequiredImageAssets}
          legacyMediaAssetCount={legacyMediaAssetCount}
          mediaApprovalBlocked={mediaApprovalBlocked}
          mediaAssets={mediaAssets}
          mediaConfig={mediaConfig}
          mediaLibraryAssets={mediaLibraryAssets}
          mediaValidation={mediaValidation}
          optionalWarningByAssetId={optionalWarningByAssetId}
          optionalWarningCounts={optionalWarningCounts}
        />
      </section>
      <CourseDetailExpansionSection
        actions={{
          generateCourseExpansionPlan,
          generateLessonFromExpansionSuggestion,
        }}
        course={course}
        expansionPlans={expansionPlans}
      />
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminCard>
          <CourseForm
            categories={categories}
            course={course}
            derivedMinutes={lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0)}
          />
        </AdminCard>
        <CourseDetailShellMediaSection
          actions={{
            approveLearningMediaAsset,
            generateLearningMediaAsset,
            saveLearningMediaAsset,
            useLibraryMediaAsset,
          }}
          course={course}
          courseCoverAsset={courseCoverAsset}
          courseThumbnailAsset={courseThumbnailAsset}
          derivedMinutes={lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0)}
          mediaConfig={mediaConfig}
          mediaLibraryAssets={mediaLibraryAssets}
        />
      </section>

      <CourseDetailLessonReviewSection
        actions={{
          saveLesson,
          setLessonStatus,
        }}
        course={course}
        lessons={lessons}
        lessonsPage={lessonsPage}
        mediaAssetsByLessonId={mediaAssetsByLessonId}
        pagesByLessonId={pagesByLessonId}
        questionCountByQuizId={questionCountByQuizId}
        quizByLessonId={quizByLessonId}
      />
    </>
  );
}
