import { notFound } from "next/navigation";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LessonModuleCard } from "@/components/lesson/LessonModuleCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { XPBadge } from "@/components/ui/XPBadge";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getCourseXP, getLessonXP } from "@/lib/lessons";
import {
  getCompletedLessonIds,
  getCourseProgress,
  getCourseResumeTarget,
  getLessonProgress,
} from "@/lib/progress";
import { getLearningCourse } from "@/lib/supabase-learning";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { formatXpLabel } from "@/lib/xp-format";

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;
  const [{ user }, supabase] = await Promise.all([
    getCurrentUserProfile(),
    createSupabaseServerClient(),
  ]);
  const course = await getLearningCourse(supabase, id);

  if (!course) {
    notFound();
  }

  const lessonProgress =
    isSupabaseConfigured && user && supabase ? await getLessonProgress(supabase, user.id) : [];
  const completedLessonIds = getCompletedLessonIds(lessonProgress, course.lessons);
  const { progressPercent } = getCourseProgress(course, completedLessonIds);
  const resumeTarget = getCourseResumeTarget(course, lessonProgress, completedLessonIds);
  const heroImage = course.coverImage ?? course.thumbnail;

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title={course.title} backHref="/courses" showMenu={false} />
      <section className="px-6 py-8 pb-28">
        <Card className="overflow-hidden">
          <img
            alt={heroImage.alt}
            className={`h-40 w-full ${getImageFitClass(heroImage)}`}
            src={heroImage.src}
            style={getImagePresentationStyle(heroImage)}
          />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">
                  {course.category}
                </p>
                <h1 className="mt-2 text-2xl font-black leading-8">{course.title}</h1>
              </div>
              <XPBadge className="shrink-0" xp={getCourseXP(course)} />
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              {course.description}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[18px] bg-[var(--ve-card-muted)] p-3">
                <p className="text-[10px] font-bold uppercase text-[var(--ve-muted)]">Level</p>
                <p className="mt-1 text-xs font-black capitalize text-[var(--foreground)]">{course.level}</p>
              </div>
              <div className="rounded-[18px] bg-[var(--ve-card-muted)] p-3">
                <p className="text-[10px] font-bold uppercase text-[var(--ve-muted)]">Time</p>
                <p className="mt-1 text-xs font-black text-[var(--foreground)]">{course.estimatedMinutes}m</p>
              </div>
              <div className="rounded-[18px] bg-[var(--ve-card-muted)] p-3">
                <p className="text-[10px] font-bold uppercase text-[var(--ve-muted)]">Lessons</p>
                <p className="mt-1 text-xs font-black text-[var(--foreground)]">{course.lessons.length}</p>
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-[var(--ve-line-soft)]">
              <div
                className="h-full rounded-full bg-[#008751]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {resumeTarget ? (
              <Button className="mt-5 w-full" href={resumeTarget.href}>
                {resumeTarget.label}
              </Button>
            ) : null}
          </div>
        </Card>

        <section className="mt-8">
          <h2 className="text-[17px] font-bold">Lessons</h2>
          {course.lessons.length === 0 ? (
            <Card className="mt-3 rounded-[18px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-5">
              <p className="text-sm font-black">No lessons currently.</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                This course is live, but the lessons are still being reviewed. Check back soon.
              </p>
            </Card>
          ) : (
            <div className="mt-3 space-y-4">
              {course.lessons.map((lesson) => (
                <div key={lesson.id}>
                  <LessonModuleCard completed={completedLessonIds.has(lesson.id)} lesson={lesson} />
                  <p className="mt-2 px-1 text-[11px] font-bold text-[var(--ve-muted)]">
                    {lesson.pages.length} pages ·{" "}
                    {completedLessonIds.has(lesson.id)
                      ? "Lesson complete"
                      : `${formatXpLabel(getLessonXP(lesson))} total`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
      <BottomNav active="Lesson" />
    </main>
  );
}
