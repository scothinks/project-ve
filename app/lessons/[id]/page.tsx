import { notFound } from "next/navigation";
import { LessonMenu } from "@/components/lesson/LessonMenu";
import { LessonPageLayout } from "@/components/lesson/LessonPageLayout";
import { LessonPageProgressMarker } from "@/components/lesson/LessonPageProgressMarker";
import { AppHeader } from "@/components/navigation/AppHeader";
import { ReferralCodeCapture } from "@/components/referrals/ReferralCodeCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getLearningLesson } from "@/lib/supabase-learning";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type LessonPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; ref?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const { id } = await params;
  const { page: pageParam, ref } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const detail = await getLearningLesson(supabase, id);

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
  const previousHref = `/lessons/${lesson.id}?page=${currentPageNumber - 1}`;
  const nextHref = `/lessons/${lesson.id}?page=${currentPageNumber + 1}`;
  const pageCover = page.coverImage ?? (isFirstPage ? lesson.coverImage : null);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      {ref ? <ReferralCodeCapture code={ref} /> : null}
      <LessonPageProgressMarker lessonId={lesson.id} pageId={page.id} />
      <AppHeader
        menu={
          <LessonMenu
            courseHref={`/courses/${course.id}`}
            currentPageNumber={currentPageNumber}
            lesson={lesson}
          />
        }
        title={lesson.title}
      />
      <section className="px-6 py-8">
        <Card className="overflow-hidden">
          <div className="px-6 py-7">
            <LessonPageLayout
              blocks={page.blocks}
              coverImage={pageCover}
              pageType={page.type}
              subtitle={page.subtitle}
              title={page.title}
            />
          </div>
        </Card>

        <div className="mt-7 flex justify-center gap-1.5">
          {lesson.pages.map((lessonPage) => (
            <span
              className={`size-2.5 rounded-full ${
                lessonPage.id === page.id ? "bg-[#008751]" : "bg-[var(--ve-muted-soft)]"
              }`}
              key={lessonPage.id}
            />
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {isFirstPage ? (
            <Button href="/dashboard" variant="outline">
              Dashboard
            </Button>
          ) : (
            <Button href={previousHref} variant="outline">
              Prev
            </Button>
          )}

          {isLastPage ? (
            <Button href={`/quiz/${lesson.id}`}>Take Quiz</Button>
          ) : (
            <Button href={nextHref}>Next</Button>
          )}
        </div>

        <div className="mt-8 rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-mission-soft)_62%,var(--ve-card))] px-4 py-3 text-center text-xs font-black text-[color:color-mix(in_srgb,var(--ve-mission)_42%,var(--foreground))]">
          DARKER &amp; RICHER. Because of you.
        </div>
      </section>
    </main>
  );
}
