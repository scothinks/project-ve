import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import { CurriculumOutlineEditor, type CurriculumLesson } from "@/components/admin/CurriculumOutlineEditor";
import { CourseWorkspaceTabs } from "@/components/admin/CourseWorkspaceTabs";
import {
  approveCourseMedia,
  approveCourseManualMedia,
  approveCourseReview,
  approveLearningMediaAsset,
  approveCourseText,
  archiveReviewedCourse,
  generateCourseMediaAssets,
  generateLearningMediaAsset,
  normalizeCourseLegacyMediaAssets,
  publishApprovedCourse,
  publishReviewedCourse,
  reviseCourseTextWithAi,
  requestCourseReviewChanges,
  requestCourseMediaChanges,
  requestCourseTextChanges,
  saveLearningMediaAsset,
  sendCourseForReview,
  unpublishReviewedCourse,
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
import { CourseMediaLibraryOverview } from "@/features/learning/admin/course-media-library-overview";
import { CourseDetailMediaRegistrySection } from "@/features/learning/admin/course-detail-media-registry-section";
import { CourseDetailShellMediaSection } from "@/features/learning/admin/course-detail-shell-media-section";
import { CourseDetailWorkflowSection } from "@/features/learning/admin/course-detail-workflow-section";
import { CourseReviewPublishSection } from "@/features/learning/admin/course-review-publish-section";
import { AiActivityPanel } from "@/features/learning/admin/ai-activity-panel";
import { getAdminAiActivity } from "@/features/learning/admin/ai-activity";
import { formatRewardDate } from "@/lib/rewards";

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; tab?: string }>;
};

function contentStatusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "archived") return "danger" as const;
  return "warning" as const;
}

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested" || status === "not_ready") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
}

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { id } = await params;
  const { notice, tab } = (await searchParams) ?? {};
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
    readiness,
  } = data;
  const mediaConfig = getAiMediaConfig();
  const derivedMinutes = lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0);
  const aiActivity = await getAdminAiActivity(supabase, {
    courseId: course.id,
    plans: expansionPlans,
  });
  const curriculumLessons: CurriculumLesson[] = lessons.map((lesson) => {
    const lessonQuiz = quizByLessonId.get(lesson.id) ?? null;
    const lessonMediaAssets = mediaAssetsByLessonId.get(lesson.id) ?? [];

    return {
      aiGenerated: lesson.ai_generated,
      aiMediaStatus: lesson.ai_media_status,
      aiPublishStatus: lesson.ai_publish_status,
      aiTextStatus: lesson.ai_text_status,
      description: lesson.description,
      estimatedMinutes: lesson.estimated_minutes,
      failedMediaCount: lessonMediaAssets.filter((asset) => asset.generation_status === "failed").length,
      hasQuiz: Boolean(lessonQuiz),
      id: lesson.id,
      mediaPendingCount: lessonMediaAssets.filter((asset) => asset.review_status !== "approved").length,
      pageCount: (pagesByLessonId.get(lesson.id) ?? []).length,
      questionCount: lessonQuiz ? questionCountByQuizId.get(lessonQuiz.id) ?? 0 : 0,
      sortOrder: lesson.sort_order,
      status: lesson.status,
      title: lesson.title,
    };
  });

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

      <AdminCard className="mb-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge tone={contentStatusTone(course.status)}>
                {course.status}
              </AdminStatusBadge>
              <AdminStatusBadge tone={workflowTone(course.ai_publish_status)}>
                {course.ai_publish_status.replaceAll("_", " ")}
              </AdminStatusBadge>
              <AdminStatusBadge tone="neutral">Project VE</AdminStatusBadge>
              {course.ai_generated ? (
                <AdminStatusBadge tone="neutral">AI assisted</AdminStatusBadge>
              ) : (
                <AdminStatusBadge tone="neutral">Manual</AdminStatusBadge>
              )}
            </div>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              {course.description || "Add the course promise and editorial overview before review."}
            </p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              Saved {formatRewardDate(course.updated_at)} · {derivedMinutes} minutes · {lessons.length} lessons
            </p>
          </div>
          <div className="flex flex-wrap gap-3 xl:justify-end">
            <Link className={adminButtonClasses()} href={`/courses/${course.id}`}>
              Preview
            </Link>
            <Link className={adminButtonClasses()} href={`/admin/courses/${course.id}?tab=review-publish`}>
              Review
            </Link>
            <Link className={adminButtonClasses("primary")} href={`/admin/courses/${course.id}?tab=review-publish`}>
              Publish
            </Link>
            <Link className={adminButtonClasses()} href={`/admin/courses/ai/planner?courseId=${course.id}`}>
              More actions
            </Link>
          </div>
        </div>
      </AdminCard>

      <CourseWorkspaceTabs
        defaultTab={tab}
        overview={
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-4">
              <AdminStatCard label="Lessons" value={lessons.length} />
              <AdminStatCard
                label="Published"
                tone="mission"
                value={lessons.filter((lesson) => lesson.status === "published").length}
              />
              <AdminStatCard
                label="Draft"
                tone="warning"
                value={lessons.filter((lesson) => lesson.status === "draft").length}
              />
              <AdminStatCard
                label="Readiness issues"
                tone={readiness.blockers.length > 0 ? "warning" : "mission"}
                value={readiness.blockers.length}
              />
            </section>
            <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_0.75fr]">
              <AdminCard>
                <CourseForm
                  categories={categories}
                  course={course}
                  derivedMinutes={derivedMinutes}
                  mediaLibraryAssets={mediaLibraryAssets}
                />
              </AdminCard>
              <div className="space-y-4">
                <AdminCard>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                    Ownership scope
                  </p>
                  <div className="mt-3">
                    <AdminStatusBadge tone="neutral">Project VE</AdminStatusBadge>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    This course currently belongs to the platform catalogue. Organisation and adapted scopes are reserved for later LMS phases.
                  </p>
                </AdminCard>
                <AdminCard>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                    Provenance
                  </p>
                  <h2 className="mt-2 text-lg font-black">
                    {course.ai_generated ? "Created with AI assistance" : "Manual course"}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminStatusBadge tone={workflowTone(course.ai_text_status)}>
                      Text {course.ai_text_status.replaceAll("_", " ")}
                    </AdminStatusBadge>
                    <AdminStatusBadge tone={workflowTone(course.ai_media_status)}>
                      Media {course.ai_media_status.replaceAll("_", " ")}
                    </AdminStatusBadge>
                  </div>
                </AdminCard>
              </div>
            </section>
            <ContentValueTagEditor
              contentId={course.id}
              contentType="course"
              dimensions={valueDimensions}
              redirectTo={`/admin/courses/${course.id}?tab=overview`}
              tags={valueTags}
            />
          </>
        }
        curriculum={
          <>
            <CourseDetailExpansionSection
              actions={{
                generateCourseExpansionPlan,
                generateLessonFromExpansionSuggestion,
              }}
              course={course}
              expansionPlans={expansionPlans}
            />
            <CurriculumOutlineEditor courseId={course.id} lessons={curriculumLessons} />
          </>
        }
        media={
          <section className="space-y-4">
            <CourseMediaLibraryOverview mediaAssets={mediaAssets} />
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
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
                derivedMinutes={derivedMinutes}
                mediaConfig={mediaConfig}
                mediaLibraryAssets={mediaLibraryAssets}
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
            </div>
          </section>
        }
        reviewPublish={
          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <CourseReviewPublishSection
              actions={{
                approveCourseReview,
                archiveReviewedCourse,
                publishReviewedCourse,
                requestCourseReviewChanges,
                sendCourseForReview,
                unpublishReviewedCourse,
              }}
              course={course}
              readiness={readiness}
            />
            <div className="space-y-4">
              <AiActivityPanel activity={aiActivity} courseId={course.id} />
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
                canPublish={readiness.canPublish}
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
            </div>
          </section>
        }
      />
    </>
  );
}
