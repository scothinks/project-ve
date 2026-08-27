import { notFound } from "next/navigation";
import { DirectAdCard } from "@/components/ads/DirectAdCard";
import { LessonMenu } from "@/components/lesson/LessonMenu";
import { LessonPageLayout } from "@/components/lesson/LessonPageLayout";
import { LessonPageProgressMarker } from "@/components/lesson/LessonPageProgressMarker";
import { AppHeader } from "@/components/navigation/AppHeader";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { ReferralCodeCapture } from "@/components/referrals/ReferralCodeCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { createLearningRepository } from "@/features/app/repositories/learning";
import { withLoggedFallback } from "@/lib/app-errors";
import { getAdContentValueTags, getAdDecision, getLearnerAdSegments } from "@/lib/ads";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

type LessonDeliveryPageProps = {
  courseHref?: string;
  dashboardHref?: string;
  lessonHref?: (pageNumber: number) => string;
  lessonId: string;
  quizHref?: string;
  refCode?: string;
  routePath?: string;
  pageParam?: string;
  organizationId?: string | null;
  programmeId?: string | null;
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
  organizationId,
  programmeId,
}: LessonDeliveryPageProps) {
  const supabase = await createSupabaseServerClient();
  const learningRepository = createLearningRepository(supabase);
  const [detail, { user, profile }] = await Promise.all([
    learningRepository.getLesson(lessonId),
    getCurrentUserProfile(supabase),
  ]);

  if (!detail) {
    notFound();
  }

  const { lesson, course } = detail;
  if (lesson.pages.length === 0) {
    notFound();
  }

  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const currentPageNumber = Number.isFinite(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), lesson.pages.length)
    : 1;
  const page = lesson.pages[currentPageNumber - 1];
  if (!page) {
    notFound();
  }

  const isFirstPage = currentPageNumber === 1;
  const isLastPage = currentPageNumber === lesson.pages.length;
  const makeLessonHref = lessonHref ?? ((pageNumber: number) => `/lessons/${lesson.id}?page=${pageNumber}`);
  const previousHref = makeLessonHref(currentPageNumber - 1);
  const nextHref = makeLessonHref(currentPageNumber + 1);
  const pageCover = page.coverImage ?? (isFirstPage ? lesson.coverImage : null);
  const rawDisplayName = profile?.display_name ?? "";
  const displayName = rawDisplayName && !rawDisplayName.includes("@") ? rawDisplayName : "Learner";
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
  const footerAd = await withLoggedFallback({
    context: {
      operation: "lesson.ads.decision",
      resourceId: lesson.id,
      userId: user?.id,
      metadata: { courseId: course.id, pageId: page.id },
    },
    fallback: null,
    promise: getAdDecision(supabase, {
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
    }),
  });

  const progressPercent = Math.round((currentPageNumber / lesson.pages.length) * 100);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      {refCode ? <ReferralCodeCapture code={refCode} /> : null}
      <LessonPageProgressMarker
        lessonId={lesson.id}
        organizationId={organizationId}
        pageId={page.id}
        programmeId={programmeId}
      />
      {!organizationId ? (
        <div className="hidden lg:block">
          <LearnerTopChrome
            active="Lessons"
            avatarUrl={profile?.avatar_url}
            displayName={displayName}
            email={user?.email}
          />
        </div>
      ) : null}
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
              pageNumber={currentPageNumber}
              pageType={page.type}
              subtitle={page.subtitle}
              title={page.title}
              totalPages={lesson.pages.length}
            />
          </div>
        </Card>

        <div className="mx-auto mt-7 max-w-3xl">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--ve-muted-strong)]">
            <span>Module Progress</span>
            <span className="text-[var(--ve-green)]">{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]">
            <div
              className="h-full rounded-full bg-[var(--ve-green)] transition-all duration-500 ease-in-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-3">
          {isFirstPage ? (
            <Button href={dashboardHref} variant="outline">
              Dashboard
            </Button>
          ) : (
            <Button className="gap-1.5" href={previousHref} variant="outline">
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
          )}

          {isLastPage ? (
            <Button href={quizHref ?? `/quiz/${lesson.id}`}>Take Quiz</Button>
          ) : (
            <Button className="gap-1.5" href={nextHref}>
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          )}
        </div>

        <div className="mx-auto mt-8 max-w-3xl">
          <DirectAdCard ad={footerAd} />
        </div>
      </section>
    </main>
  );
}
