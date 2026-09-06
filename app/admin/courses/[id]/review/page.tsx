import Link from "next/link";
import { AiCourseArtwork } from "@/components/admin/ai/AiCourseArtwork";
import { notFound } from "next/navigation";
import {
  approveCourseReview,
  archiveReviewedCourse,
  publishReviewedCourse,
  restoreCourseToDraft,
  unpublishReviewedCourse,
} from "@/app/admin/courses/review-actions";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { requireAdmin } from "@/lib/admin";
import { getAdminCourseDetailPageData } from "@/features/learning/admin/course-detail-data";

type CourseReviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CourseReviewPage({ params }: CourseReviewPageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const data = await getAdminCourseDetailPageData(supabase, id);

  if (!data) {
    notFound();
  }

  const { course, readiness, lessons } = data;
  const snapshot = JSON.stringify(Object.fromEntries(lessons.filter(l=>l.status!=="archived").map(l=>[l.id,l.draft_revision])));
  const revisionFields = <><input name="courseUpdated" type="hidden" value={course.updated_at}/><input name="lessonRevisions" type="hidden" value={snapshot}/></>;
  const ready = readiness.canPublish;
  const statusLabel = course.status.charAt(0).toUpperCase() + course.status.slice(1);

  return (
    <div className="-mx-5 md:-mx-8">
      <div className="border-b border-[var(--admin-border-warm)] px-5 py-6 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface-variant)]"
          href={`/admin/courses/${course.id}`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {course.title}
        </Link>
      </div>

      <div className="flex justify-center px-6 py-12 md:py-24">
        <div className="flex w-full max-w-[600px] flex-col gap-8">
          <div className="flex flex-col items-center gap-3.5 rounded-[22px] bg-[var(--admin-surface-container-low)] px-6 py-9 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: ready
                  ? "color-mix(in srgb, var(--admin-primary) 14%, transparent)"
                  : "color-mix(in srgb, var(--admin-secondary) 14%, transparent)",
              }}
            >
              {ready ? (
                <svg aria-hidden="true" className="h-[26px] w-[26px]" fill="none" stroke="var(--admin-primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-[26px] w-[26px]" fill="none" stroke="var(--admin-secondary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
              )}
            </span>
            <h1 className="text-2xl font-black text-[var(--admin-brand-hero)]">
              {ready ? "Ready to publish" : `${readiness.blockers.length} thing${readiness.blockers.length === 1 ? "" : "s"} to finish`}
            </h1>
            <p className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">
              {ready
                ? "Everything checks out. Publish whenever you're ready."
                : "Finish the items below before this course can go live."}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {readiness.checks.map((check) => {
              const passed = check.status === "passed";
              const row = (
                <div
                  className="flex items-center gap-3.5 rounded-[16px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3.5"
                  key={check.id}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: passed
                        ? "color-mix(in srgb, var(--admin-primary) 14%, transparent)"
                        : "color-mix(in srgb, var(--admin-secondary) 14%, transparent)",
                    }}
                  >
                    {passed ? (
                      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="var(--admin-primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="var(--admin-secondary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 text-sm font-bold text-[var(--admin-on-surface)]">{check.label}</span>
                </div>
              );

              return !passed && check.href && check.id !== "editorial-lifecycle" ? (
                <Link className="block" href={check.href} key={check.id}>
                  {row}
                </Link>
              ) : (
                row
              );
            })}
          </div>

          <AiCourseArtwork courseId={course.id} thumbnail={course.thumbnail} cover={data.courseCoverAsset}/>
          <Link href={`/admin/courses/${course.id}/media`} className="text-sm font-bold underline">Earlier media and pending requests</Link>
          {!ready && <form action={approveCourseReview} className="space-y-4">
            <input name="courseId" type="hidden" value={course.id}/>{revisionFields}
            <label className="flex items-start gap-3 text-sm"><input name="reviewed" type="checkbox" required/>I have reviewed the course, lesson content, quiz answers and any attached media.</label>
            <PendingSubmitButton className="rounded-full bg-[var(--admin-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!readiness.canApprove} label="Approve reviewed course" pendingLabel="Approving…" type="submit"/>
          </form>}
          <Link
            className="self-center text-[13px] font-extrabold text-[var(--admin-primary)]"
            href={`/admin/courses/${course.id}/preview`}
          >
            Preview as a learner &rarr;
          </Link>

          {ready ? (
            <form action={publishReviewedCourse}>{revisionFields}
              <input name="courseId" type="hidden" value={course.id} />
              <PendingSubmitButton
                className="flex w-full items-center justify-center rounded-full bg-[var(--admin-primary)] px-6 py-[15px] text-sm font-extrabold text-[var(--admin-on-primary)]"
                disabled={course.status === "published"}
                label="Publish course"
                pendingLabel="Publishing..."
                type="submit"
              />
            </form>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex w-full items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-surface-container-low))] px-6 py-[15px] text-sm font-extrabold text-[var(--admin-on-primary)] opacity-60">
                Publish course
              </div>
              <p className="text-center text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                Finish the items above to publish.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 border-t border-[var(--admin-border-warm)] pt-2">
            <span className="text-xs font-bold text-[var(--admin-on-surface-variant)]">Currently {statusLabel}</span>
            {course.status === "published" ? (
              <form action={unpublishReviewedCourse}>
                <input name="courseId" type="hidden" value={course.id} />
                <button className="text-xs font-extrabold text-[var(--admin-on-surface-variant)] underline" type="submit">
                  Unpublish
                </button>
              </form>
            ) : null}
            {course.status !== "archived" ? (
              <form action={archiveReviewedCourse}>
                <input name="courseId" type="hidden" value={course.id} />
                <button className="text-xs font-extrabold text-[var(--admin-secondary)] underline" type="submit">
                  Archive course
                </button>
              </form>
            ) : null}
            {course.status === "archived" ? (
              <form action={restoreCourseToDraft}>
                <input name="courseId" type="hidden" value={course.id} />
                <button className="text-xs font-extrabold text-[var(--admin-primary)] underline" type="submit">
                  Restore to draft
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
