import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getAdminCourse } from "@/features/learning/admin/data";
import { getAdminCourseInsights } from "@/features/reporting/admin/course-insights";

type CourseInsightsPageProps = {
  params: Promise<{ id: string }>;
};

const DROP_OFF_THRESHOLD = 20;

export default async function CourseInsightsPage({ params }: CourseInsightsPageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const course = await getAdminCourse(supabase, id);

  if (!course) {
    notFound();
  }

  const insights = await getAdminCourseInsights(supabase, id);
  const lessonsWithAttentionFlag = insights.lessons.map((lesson, index) => {
    const previousReach = index === 0 ? 100 : insights.lessons[index - 1].reachedPercent;
    return {
      ...lesson,
      needsAttention: previousReach - lesson.reachedPercent >= DROP_OFF_THRESHOLD,
    };
  });

  return (
    <div className="-mx-5 md:-mx-8">
      <div className="border-b border-[var(--ui-border-subtle)] px-5 py-6 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)]"
          href={`/admin/courses/${course.id}`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {course.title}
        </Link>
      </div>

      <div className="flex justify-center px-6 py-12 md:py-24">
        <div className="flex w-full max-w-[820px] flex-col">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--ui-text)]">Insights</p>
          <h1 className="mt-2.5 text-[32px] font-black leading-[1.1] tracking-[-0.01em] text-[var(--ui-text)]">
            How this course is actually doing
          </h1>
          <p className="mt-1.5 text-sm font-medium leading-[1.6] text-[var(--ui-text-muted)]">
            Based on learners who have started this course so far.
          </p>

          <div className="mt-9 grid gap-3.5 sm:grid-cols-4">
            <div className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--ui-text-muted)]">Started</p>
              <p className="mt-1.5 text-2xl font-black text-[var(--ui-text)]">{insights.startedLearners}</p>
            </div>
            <div className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--ui-text-muted)]">Completed</p>
              <p className="mt-1.5 text-2xl font-black text-[var(--ui-text)]">{insights.completionRate}%</p>
            </div>
            <div className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--ui-text-muted)]">Avg quiz score</p>
              <p className="mt-1.5 text-2xl font-black text-[var(--ui-text)]">{insights.averageQuizScore}%</p>
            </div>
            <div className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--ui-text-muted)]">Avg time to finish</p>
              <p className="mt-1.5 text-2xl font-black text-[var(--ui-text)]">{insights.averageDaysToFinish}d</p>
            </div>
          </div>

          {insights.lessons.length === 0 ? (
            <p className="mt-9 rounded-[16px] border border-dashed border-[var(--ui-border-subtle)] px-4 py-6 text-center text-sm font-semibold text-[var(--ui-text-muted)]">
              No lessons yet — insights will appear once this course has content and learners.
            </p>
          ) : (
            <>
              <p className="mb-1 mt-9 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
                Where learners drop off
              </p>
              <p className="mb-4 text-[13px] font-medium text-[var(--ui-text-muted)]">
                Share of starters who reached each lesson.
              </p>
              <div className="flex flex-col gap-2.5">
                {lessonsWithAttentionFlag.map((lesson) => (
                  <div className="flex items-center gap-3.5" key={lesson.id}>
                    <span className="w-[180px] shrink-0 truncate text-[13px] font-bold text-[var(--ui-text)]">
                      {lesson.title}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded-lg bg-[var(--ui-surface-soft)]">
                      <div
                        className="h-full rounded-lg bg-[var(--ui-action)]"
                        style={{ width: `${lesson.reachedPercent}%` }}
                      />
                    </div>
                    <span className="w-[70px] shrink-0 text-right text-[13px] font-extrabold text-[var(--ui-text)]">
                      {lesson.reachedPercent}%
                    </span>
                    {lesson.needsAttention ? (
                      <span className="shrink-0 rounded-full bg-[color:color-mix(in_srgb,var(--ui-warning)_14%,var(--ui-surface))] px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ui-warning)]">
                        Needs attention
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <p className="mb-4 mt-9 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
                Lesson-by-lesson
              </p>
              <div className="flex flex-col gap-2.5">
                {insights.lessons.map((lesson) => (
                  <div
                    className="flex items-center gap-3.5 rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-4 py-3"
                    key={lesson.id}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ui-text)]">
                      {lesson.title}
                    </span>
                    <span className="w-[110px] shrink-0 text-xs font-semibold text-[var(--ui-text-muted)]">
                      {lesson.completedPercent}% completed
                    </span>
                    <span className="w-[110px] shrink-0 text-xs font-semibold text-[var(--ui-text-muted)]">
                      {lesson.averageQuizScore}% avg quiz
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
