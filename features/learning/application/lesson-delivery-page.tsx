import { notFound } from "next/navigation";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { LessonMenu } from "@/components/lesson/LessonMenu";
import { LessonPageLayout } from "@/components/lesson/LessonPageLayout";
import { LessonPageProgressMarker } from "@/components/lesson/LessonPageProgressMarker";
import { AppHeader } from "@/components/navigation/AppHeader";
import { ReferralCodeCapture } from "@/components/referrals/ReferralCodeCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { withLoggedFallback } from "@/lib/app-errors";
import { getAdContentValueTags, getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type LessonDeliveryPageProps = {
  courseHref?: string;
  dashboardHref?: string;
  lessonHref?: (pageNumber: number) => string;
  lessonId: string;
  quizHref?: string;
  refCode?: string;
  routePath?: string;
  pageParam?: string;
};

export async function LessonDeliveryPage({
  courseHref,
  dashboardHref = "/dashboard",
  lessonHref,
  lessonId,
  pageParam,
  quizHref,
  refCode,
  routePath,
}: LessonDeliveryPageProps) {
  const supabase = await createSupabaseServerClient();
  const learningRepository = createLearningRepository(supabase);
  const [detail, userResult] = await Promise.all([
    learningRepository.getLesson(lessonId),
    supabase ? supabase.auth.getUser() : Promise.resolve({ data: { user: null } }),
  ]);

  if (!detail) {
    notFound();
  }

  const { lesson, course } = detail;
  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const currentPageNumber = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), lesson.pages.length)
    : 1;
  const page = lesson.pages[currentPageNumber - 1];
  const isFirstPage = currentPageNumber === 1;
  const isLastPage = currentPageNumber === lesson.pages.length;
  const makeLessonHref = lessonHref ?? ((pageNumber: number) => `/lessons/${lesson.id}?page=${pageNumber}`);
  const previousHref = makeLessonHref(currentPageNumber - 1);
  const nextHref = makeLessonHref(currentPageNumber + 1);
  const pageCover = page.coverImage ?? (isFirstPage ? lesson.coverImage : null);
  const {
    data: { user },
  } = userResult;
  const [contentValueTags, segmentKeys] = await Promise.all([
    withLoggedFallback({
      context: {
        operation: "lesson.ads.content_value_tags",
        resourceId: lesson.id,
        userId: user?.id,
        metadata: { courseId: course.id },
      },
      fallback: [],
      promise: getAdContentValueTags(supabase, {
        courseId: course.id,
        lessonId: lesson.id,
      }),
    }),
    withLoggedFallback({
      context: {
        operation: "lesson.ads.segments",
        resourceId: lesson.id,
        userId: user?.id,
      },
      fallback: [],
      promise: getLearnerAdSegments(supabase, user?.id),
    }),
  ]);
  const footerAd = await getAdDecision(supabase, {
    placementKey: "lesson_footer_card",
    route: routePath ?? `/lessons/${lesson.id}`,
    userId: user?.id,
    courseId: course.id,
    courseCategory: course.category,
    lessonId: lesson.id,
    pageId: page.id,
    pageNumber: currentPageNumber,
    pageType: page.type,
    contentValueTags,
    segmentKeys,
  });

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      {refCode ? <ReferralCodeCapture code={refCode} /> : null}
      <LessonPageProgressMarker lessonId={lesson.id} pageId={page.id} />
      <AppHeader
        menu={
          <LessonMenu
            courseHref={courseHref ?? `/courses/${course.id}`}
            currentPageNumber={currentPageNumber}
            lesson={lesson}
          />
        }
        title={lesson.title}
      />
      <section className="learner-page learner-page--spacious">
        <Card className="learner-readable overflow-hidden">
          <div className="px-6 py-7 lg:px-10 lg:py-10">
            <LessonPageLayout
              blocks={page.blocks}
              coverImage={pageCover}
              pageType={page.type}
              subtitle={page.subtitle}
              title={page.title}
            />
          </div>
        </Card>

        <div className="mx-auto mt-7 flex max-w-3xl justify-center gap-1.5">
          {lesson.pages.map((lessonPage) => (
            <span
              className={`size-2.5 rounded-full ${
                lessonPage.id === page.id ? "bg-[#008751]" : "bg-[var(--ve-muted-soft)]"
              }`}
              key={lessonPage.id}
            />
          ))}
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3">
          {isFirstPage ? (
            <Button href={dashboardHref} variant="outline">
              Dashboard
            </Button>
          ) : (
            <Button href={previousHref} variant="outline">
              Prev
            </Button>
          )}

          {isLastPage ? (
            <Button href={quizHref ?? `/quiz/${lesson.id}`}>Take Quiz</Button>
          ) : (
            <Button href={nextHref}>Next</Button>
          )}
        </div>

        <div className="mx-auto mt-8 max-w-3xl">
          <DirectAdCard ad={footerAd} />
        </div>
      </section>
    </main>
  );
}
