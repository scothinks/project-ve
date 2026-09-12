import Link from "next/link";
import { getAdminCourses, requireAdmin } from "@/lib/admin";
import type { CourseIndexCourse } from "@/components/admin/CourseIndexWorkspace";

const AI_CHECK_IDS = new Set(["ai-text", "ai-media"]);

export default async function PendingActionsPage() {
  const { supabase } = await requireAdmin();
  const courses = await getAdminCourses(supabase) as CourseIndexCourse[];

  const readinessActions = courses
    .flatMap((course) =>
      (course.readiness_blockers ?? [])
        .filter((check) => !AI_CHECK_IDS.has(check.id))
        .map((check) => ({ check, course })),
    );
  const aiReviewActions = courses
    .flatMap((course) =>
      (course.readiness_blockers ?? [])
        .filter((check) => AI_CHECK_IDS.has(check.id))
        .map((check) => ({ check, course })),
    );
  const hasNoPendingActions = readinessActions.length === 0 && aiReviewActions.length === 0;

  return (
    <div className="-mx-5 md:-mx-8">
      <div className="border-b border-[var(--ui-border-subtle)] px-5 py-6 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)]"
          href="/admin/courses"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Courses
        </Link>
      </div>

      <div className="flex justify-center px-6 py-12 md:py-24">
        <div className="flex w-full max-w-[820px] flex-col">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--ui-text)]">
            Pending actions
          </p>
          <h1 className="mt-2.5 text-[32px] font-black leading-[1.1] tracking-[-0.01em] text-[var(--ui-text)]">
            What needs your attention
          </h1>
          <p className="mt-2.5 max-w-[560px] text-sm font-medium leading-[1.6] text-[var(--ui-text-muted)]">
            Everything across your courses that&apos;s blocking readiness or waiting on a review — not just
            AI-generated content.
          </p>

          {hasNoPendingActions ? (
            <div className="mt-8 rounded-[20px] border-[1.5px] border-dashed border-[var(--ui-border-subtle)] px-6 py-12 text-center text-[var(--ui-text-muted)]">
              <p className="text-[15px] font-extrabold text-[var(--ui-text)]">All caught up</p>
              <p className="mt-1 text-[13px] font-medium">Nothing needs your attention right now.</p>
            </div>
          ) : null}

          {readinessActions.length > 0 ? (
            <div className="mt-8">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
                Readiness blockers
              </p>
              <div className="flex flex-col gap-2.5">
                {readinessActions.map(({ check, course }) => (
                  <div
                    className="flex items-center gap-3.5 rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-[18px] py-3.5"
                    key={`${course.id}-${check.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[var(--ui-text)]">{course.title}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ui-text-muted)]">
                        {check.detail}
                      </p>
                    </div>
                    <Link
                      className="shrink-0 rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] px-[18px] py-[9px] text-xs font-extrabold text-[var(--ui-text)]"
                      href={check.href ?? `/admin/courses/${course.id}`}
                    >
                      Review course
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {aiReviewActions.length > 0 ? (
            <div className="mt-8">
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
                AI content awaiting review
              </p>
              <div className="flex flex-col gap-2.5">
                {aiReviewActions.map(({ check, course }) => (
                  <div
                    className="flex items-center gap-3.5 rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-[18px] py-3.5"
                    key={`${course.id}-${check.id}`}
                  >
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:color-mix(in_srgb,var(--ui-info)_14%,transparent)] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ui-info)]">
                      {check.id === "ai-text" ? "Text" : "Media"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[var(--ui-text)]">{course.title}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ui-text-muted)]">
                        {check.detail}
                      </p>
                    </div>
                    <Link
                      className="shrink-0 rounded-full bg-[var(--ui-action)] px-[18px] py-[9px] text-xs font-extrabold text-[var(--ui-on-action)]"
                      href={check.href ?? `/admin/courses/${course.id}/review`}
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
