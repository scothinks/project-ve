import Image from "@/components/media/MediaImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseDetailLessonList } from "@/components/course/CourseDetailLessonList";
import { Card } from "@/components/ui/Card";
import { XPBadge } from "@/components/ui/XPBadge";
import { requireAdmin } from "@/lib/admin";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getCourseXP } from "@/lib/lessons";
import { getAdminCoursePreview } from "@/lib/supabase-learning";

type CoursePreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CoursePreviewPage({ params }: CoursePreviewPageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const course = await getAdminCoursePreview(supabase, id);

  if (!course) {
    notFound();
  }

  const heroImage = course.coverImage ?? course.thumbnail;
  const firstLessonHref = course.lessons[0]
    ? `/admin/courses/lessons/${course.lessons[0].id}/preview`
    : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--admin-surface-container-low)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-6 py-5 md:px-10">
        <Link
          className="flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface-variant)]"
          href={`/admin/courses/${course.id}`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to editing
        </Link>
        <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Previewing the real learner page
        </span>
      </div>

      <div className="flex flex-1 justify-center px-6 py-8 md:px-8">
        <div className="flex w-full max-w-[480px] flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="relative h-44 w-full">
              <Image
                alt={heroImage.alt}
                className={getImageFitClass(heroImage)}
                fill
                sizes="480px"
                src={heroImage.src}
                style={getImagePresentationStyle(heroImage)}
              />
            </div>
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
                <div className="h-full w-0 rounded-full bg-[#008751]" />
              </div>
              {firstLessonHref ? (
                <Link
                  className="mt-5 flex w-full items-center justify-center rounded-full bg-[#008751] px-4 py-3 text-sm font-extrabold text-white"
                  href={firstLessonHref}
                >
                  Start Lesson 1
                </Link>
              ) : null}
            </div>
          </Card>

          <section>
            <h2 className="text-[17px] font-bold">Lessons</h2>
            {course.lessons.length === 0 ? (
              <Card className="mt-3 rounded-[18px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-5">
                <p className="text-sm font-black">No lessons currently.</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  This course doesn&apos;t have any lessons yet.
                </p>
              </Card>
            ) : (
              <div className="mt-3">
                <CourseDetailLessonList
                  completedLessonIds={[]}
                  lessonHrefBase="/admin/courses/lessons"
                  lessonHrefSuffix="/preview"
                  lessons={course.lessons}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
