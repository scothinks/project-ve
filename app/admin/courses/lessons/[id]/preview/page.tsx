import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonAuthoringSteps } from "@/components/admin/LessonAuthoringSteps";
import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { LessonReviewSummary } from "@/components/admin/LessonReviewSummary";
import { getAdminContentValueTags } from "@/features/content-values/admin/data";
import { LessonQuizPreview } from "@/components/admin/LessonQuizPreview";
import { LessonPageCard } from "@/components/lesson/LessonPageLayout";
import { Card } from "@/components/ui/Card";
import { validateMediaApproval } from "@/lib/ai-media-workflow";
import { getAdminLearningMediaAssets, getAdminLesson } from "@/features/learning/admin/data";
import { mapPreviewBlock, toPreviewImageAsset } from "@/features/learning/admin/lesson-page-builder-domain";
import { requireAdmin } from "@/lib/admin";

type LessonPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string; section?: string; notice?: string }>;
};

const navigationClass = "rounded-full border border-[var(--ui-border-subtle)] px-4 py-2 text-sm font-extrabold text-[var(--ui-text)]";

export default async function LessonPreviewPage({ params, searchParams }: LessonPreviewPageProps) {
  const { id } = await params;
  const { page: pageParam, section, notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const data = await getAdminLesson(supabase, id);
  if (!data) notFound();

  const { lesson, pages, blocks, quiz, questions } = data;
  const sortedPages = [...pages].sort((first, second) => first.page_number - second.page_number);
  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const currentPageNumber = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), sortedPages.length)
    : 1;
  const currentPage = sortedPages[currentPageNumber - 1];
  const showQuiz = section === "quiz";
  const showReview = section === "review";
  const [valueTags, mediaAssets] = showReview ? await Promise.all([
    getAdminContentValueTags(supabase, "lesson", id),
    lesson.ai_generated ? getAdminLearningMediaAssets(supabase, { courseId: lesson.course_id, lessonId: id }) : Promise.resolve([]),
  ]) : [[], []];
  const mediaValidation = validateMediaApproval(mediaAssets);
  const mediaReady = !mediaValidation.missingRequiredAssets.length && !mediaValidation.failedRequiredAssets.length;
  const base = `/admin/courses/lessons/${lesson.id}`;
  const preview = `${base}/preview`;
  const previewBlocks = currentPage ? blocks
    .filter((block) => block.page_id === currentPage.id)
    .sort((first, second) => first.sort_order - second.sort_order)
    .map(mapPreviewBlock) : [];
  const pageCover = currentPage
    ? toPreviewImageAsset(currentPage.cover_image, currentPage.title)
      ?? (currentPageNumber === 1 ? toPreviewImageAsset(lesson.cover_image, lesson.title) : null)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ui-surface-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-6 py-5 md:px-10">
        <Link className="text-sm font-bold text-[var(--ui-text-muted)]" href={showQuiz ? `${base}/quiz` : `${base}${currentPage ? `?page=${currentPage.id}` : ""}`}>
          {showQuiz ? "Back to quiz editing" : "Back to editing"}
        </Link>
        <p className="text-xs font-bold text-[var(--ui-text-muted)]">Saved lesson preview · No progress or XP recorded</p>
      </div>
      <LessonAuthoringSteps current="preview" lessonId={lesson.id} pageCount={pages.length} questionCount={questions.length} />
      <nav aria-label="Preview contents" className="flex flex-wrap justify-center gap-2 px-4 pt-5">
        {sortedPages.map((page, index) => (
          <Link aria-current={!showQuiz && !showReview && index + 1 === currentPageNumber ? "page" : undefined} className={`${navigationClass} aria-[current=page]:bg-[var(--ui-surface)] aria-[current=page]:border-[var(--ui-action)]`} href={`${preview}?page=${index + 1}`} key={page.id} title={page.title}>
            Page {index + 1}
          </Link>
        ))}
        <Link aria-current={showQuiz ? "page" : undefined} className={`${navigationClass} aria-[current=page]:bg-[var(--ui-surface)] aria-[current=page]:border-[var(--ui-action)]`} href={`${preview}?section=quiz`}>Quiz</Link>
        <Link aria-current={showReview ? "page" : undefined} className={`${navigationClass} aria-[current=page]:bg-[var(--ui-surface)] aria-[current=page]:border-[var(--ui-action)]`} href={`${preview}?section=review`}>Review</Link>
      </nav>
      {notice ? <div className="mx-auto w-full max-w-3xl px-4 pt-4"><AdminNoticeBanner>{notice}</AdminNoticeBanner></div> : null}

      <div className="flex flex-1 justify-center px-4 py-8 md:px-8">
        <div className="w-full min-w-0 max-w-3xl">
          {showReview ? <LessonReviewSummary data={data} mediaReady={mediaReady} valueCount={valueTags.length} /> : showQuiz ? (
            <section aria-label="Lesson quiz preview" className="space-y-5">
              <div>
                <p className="text-xs font-bold text-[var(--ui-text-muted)]">{lesson.title} · Quiz</p>
                <h1 className="mt-2 text-2xl font-black">{quiz?.title ?? "Lesson quiz"}</h1>
              </div>
              {questions.length > 0 ? (
                <LessonQuizPreview key={quiz?.id} questions={[...questions].sort((a, b) => a.question_order - b.question_order)} />
              ) : (
                <Card className="space-y-3 p-6">
                  <h2 className="text-lg font-black">No quiz questions yet</h2>
                  <p className="text-sm text-[var(--ui-text-muted)]">Add questions after writing your lesson pages, then return here to try the full lesson.</p>
                  <Link className="inline-block font-bold text-[var(--ui-action)]" href={`${base}/quiz`}>Go to quiz setup</Link>
                </Card>
              )}
            </section>
          ) : currentPage ? (
            <LessonPageCard blocks={previewBlocks} coverImage={pageCover} isPreview pageNumber={currentPageNumber} pageType={currentPage.page_type} subtitle={currentPage.subtitle} title={currentPage.title} totalPages={sortedPages.length} />
          ) : (
            <Card className="space-y-3 p-6">
              <h1 className="text-xl font-black">No lesson pages yet</h1>
              <p className="text-sm text-[var(--ui-text-muted)]">Start with the lesson pages, then add a quiz to check what learners understood.</p>
              <Link className="inline-block font-bold text-[var(--ui-action)]" href={base}>Create lesson pages</Link>
            </Card>
          )}
        </div>
      </div>

      <nav aria-label="Preview navigation" className="flex flex-wrap items-center justify-center gap-3 border-t border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-4 py-4">
        {showReview ? (
          <>
            <Link className={navigationClass} href={`${preview}?section=quiz`}>Back to quiz preview</Link>
            <Link className={navigationClass} href={base}>Return to lesson editor</Link>
          </>
        ) : showQuiz ? (
          <>
            {pages.length > 0 ? <Link className={navigationClass} href={`${preview}?page=${pages.length}`}>Back to last page</Link> : null}
            <Link className={navigationClass} href={`${preview}?section=review`}>Next: Review</Link>
          </>
        ) : (
          <>
            {currentPageNumber > 1 ? <Link className={navigationClass} href={`${preview}?page=${currentPageNumber - 1}`}>Previous page</Link> : null}
            {currentPage ? <span className="text-xs font-bold text-[var(--ui-text-muted)]">Page {currentPageNumber} of {pages.length}</span> : null}
            <Link className={navigationClass} href={currentPageNumber < pages.length ? `${preview}?page=${currentPageNumber + 1}` : `${preview}?section=quiz`}>
              {currentPageNumber < pages.length ? "Next page" : "Continue to quiz"}
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
