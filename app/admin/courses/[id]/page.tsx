import Image from "@/components/media/MediaImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { CurriculumOutlineEditor, type CurriculumLesson } from "@/components/admin/CurriculumOutlineEditor";
import { requireAdmin } from "@/lib/admin";
import { getAdminCourseDetailPageData } from "@/features/learning/admin/course-detail-data";
import { getLessonAssistanceAvailability } from "@/features/ai-generation/authoring/lesson-availability";

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string }>;
};

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { id } = await params;
  const { notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const data = await getAdminCourseDetailPageData(supabase, id);

  if (!data) {
    notFound();
  }

  const {
    course,
    lessons,
    mediaAssets,
    pagesByLessonId,
    quizByLessonId,
    questionCountByQuizId,
    mediaAssetsByLessonId,
  } = data;
  const aiAvailability = await getLessonAssistanceAvailability({ supabase }, course.organization_id);
  const derivedMinutes = lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0);
  const thumbnailUrl = typeof course.thumbnail?.url === "string" ? course.thumbnail.url : null;
  const thumbnailAlt = typeof course.thumbnail?.altText === "string" ? course.thumbnail.altText : course.title;
  const curriculumLessons: CurriculumLesson[] = lessons.map((lesson) => {
    const lessonQuiz = quizByLessonId.get(lesson.id) ?? null;
    const lessonMediaAssets = mediaAssetsByLessonId.get(lesson.id) ?? [];

    return {
      aiGenerated: lesson.ai_generated,
      aiMediaStatus: lesson.ai_media_status,
      aiPublishStatus: lesson.ai_publish_status,
      aiTextStatus: lesson.ai_text_status,
      coverImage: lesson.cover_image,
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
      <div className="-mx-5 mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border-subtle)] px-5 py-6 md:-mx-8 md:px-16">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)] hover:text-[var(--ui-action)]"
          href="/admin/courses"
        >
          ← Courses
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center rounded-full bg-[var(--ui-surface-soft)] px-4 py-[9px] text-[13px] font-bold text-[var(--ui-text-muted)]">
            {derivedMinutes} min total
          </span>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-5 py-[10px] text-[13px] font-extrabold text-[var(--ui-text)]"
            href={`/admin/courses/${course.id}/insights`}
          >
            Insights
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-5 py-[10px] text-[13px] font-extrabold text-[var(--ui-text)]"
            href={`/admin/courses/${course.id}/preview`}
          >
            Preview
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-[var(--ui-action)] px-[22px] py-[10px] text-[13px] font-extrabold text-[var(--ui-on-action)] shadow-[0_4px_14px_rgba(var(--ui-shadow-rgb),0.14)]"
            href={`/admin/courses/${course.id}/review`}
          >
            Review &amp; Publish
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[820px]">
        {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

        <div className="mb-10 flex items-start gap-5">
          <Link
            className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-[16px] bg-[var(--ui-action)]"
            href={`/admin/courses/${course.id}/settings`}
            title="Change course cover in Course settings"
          >
            {thumbnailUrl ? (
              <Image alt={thumbnailAlt} className="object-cover" fill sizes="64px" src={thumbnailUrl} />
            ) : (
              <span className="flex h-full items-center justify-center text-xl font-black text-[var(--ui-text)]">
                {course.title.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--ui-text)]">
              Course workspace
            </p>
            <h1 className="mt-2.5 text-[34px] font-black tracking-[-0.02em] text-[var(--ui-text)]">
              {course.title}
            </h1>
            <p className="mt-2.5 text-[15px] font-medium text-[var(--ui-text-muted)]">
              {course.description || "Add a course description in Course settings."}
            </p>
          </div>
        </div>

        <CurriculumOutlineEditor
          aiGenerationAvailable={aiAvailability.enabled}
          aiSuggestHref={aiAvailability.enabled ? `/admin/courses/${course.id}/expand` : undefined}
          aiSuggestUnavailableReason={aiAvailability.reason ?? undefined}
          courseId={course.id}
          lessons={curriculumLessons}
          mediaLibraryAssets={mediaAssets}
        />
      </div>
    </>
  );
}
