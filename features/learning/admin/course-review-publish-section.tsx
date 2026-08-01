import Link from "next/link";
import {
  AdminCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { CourseReadinessResult } from "@/features/learning/admin/course-readiness";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type CourseReviewAction = (formData: FormData) => void | Promise<void>;

type CourseReviewPublishSectionProps = {
  actions: {
    approveCourseReview: CourseReviewAction;
    archiveReviewedCourse: CourseReviewAction;
    publishReviewedCourse: CourseReviewAction;
    requestCourseReviewChanges: CourseReviewAction;
    sendCourseForReview: CourseReviewAction;
    unpublishReviewedCourse: CourseReviewAction;
  };
  course: AdminCourseDetailPageData["course"];
  readiness: CourseReadinessResult;
};

const lifecycleSteps = [
  "Draft",
  "In review",
  "Changes requested",
  "Approved",
  "Published",
  "Archived",
];

function statusTone(status: string) {
  if (status === "passed") return "good" as const;
  if (status === "blocked") return "danger" as const;
  return "warning" as const;
}

function lifecycleTone(lifecycle: CourseReadinessResult["lifecycle"]) {
  if (lifecycle === "approved" || lifecycle === "published") return "good" as const;
  if (lifecycle === "changes_requested" || lifecycle === "archived") return "danger" as const;
  if (lifecycle === "in_review") return "warning" as const;
  return "neutral" as const;
}

function buttonClasses(tone: "primary" | "danger" | "neutral" = "primary") {
  if (tone === "danger") {
    return "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_76%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-danger)] disabled:cursor-not-allowed disabled:opacity-60";
  }

  if (tone === "neutral") {
    return "rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-4 py-3 text-sm font-black text-[var(--ve-muted-strong)] disabled:cursor-not-allowed disabled:opacity-60";
  }

  return "rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60";
}

export function CourseReviewPublishSection({
  actions,
  course,
  readiness,
}: CourseReviewPublishSectionProps) {
  const redirectTo = `/admin/courses/${course.id}?tab=review-publish`;

  return (
    <AdminCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
            Review and publish
          </p>
          <h2 className="mt-2 text-lg font-black">Course readiness</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge tone={lifecycleTone(readiness.lifecycle)}>
            {readiness.lifecycleLabel}
          </AdminStatusBadge>
          <AdminStatusBadge tone={readiness.canPublish ? "good" : "danger"}>
            {readiness.blockers.length} blocker{readiness.blockers.length === 1 ? "" : "s"}
          </AdminStatusBadge>
          <AdminStatusBadge tone={readiness.warnings.length > 0 ? "warning" : "good"}>
            {readiness.warnings.length} warning{readiness.warnings.length === 1 ? "" : "s"}
          </AdminStatusBadge>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-6">
        {lifecycleSteps.map((step) => {
          const active = step === readiness.lifecycleLabel;
          return (
            <div
              className={`rounded-[12px] border px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.1em] ${
                active
                  ? "border-[var(--ve-green)] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] text-[var(--ve-green)]"
                  : "border-[var(--ve-line-soft)] bg-[var(--ve-panel)] text-[var(--ve-muted)]"
              }`}
              key={step}
            >
              {step}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3">
        {readiness.checks.map((item) => (
          <div
            className="grid gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4 md:grid-cols-[9rem_1fr_auto] md:items-center"
            key={item.id}
          >
            <AdminStatusBadge tone={statusTone(item.status)}>
              {item.status}
            </AdminStatusBadge>
            <div>
              <p className="text-sm font-black">{item.label}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">{item.detail}</p>
            </div>
            {item.href ? (
              <Link className="text-sm font-black text-[var(--ve-green)]" href={item.href}>
                Open
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <form action={actions.sendCourseForReview}>
          <input name="courseId" type="hidden" value={course.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <PendingSubmitButton
            className={buttonClasses("neutral")}
            disabled={readiness.lifecycle === "published" || readiness.lifecycle === "archived"}
            label="Send for review"
            pendingLabel="Sending..."
            type="submit"
          />
        </form>
        <form action={actions.approveCourseReview}>
          <input name="courseId" type="hidden" value={course.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <PendingSubmitButton
            className={buttonClasses()}
            disabled={!readiness.canApprove || readiness.lifecycle === "published" || readiness.lifecycle === "archived"}
            label="Approve"
            pendingLabel="Approving..."
            type="submit"
          />
        </form>
        <form action={actions.publishReviewedCourse}>
          <input name="courseId" type="hidden" value={course.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <PendingSubmitButton
            className={buttonClasses()}
            disabled={!readiness.canPublish || readiness.lifecycle === "published" || readiness.lifecycle === "archived"}
            label="Publish"
            pendingLabel="Publishing..."
            type="submit"
          />
        </form>
        <Link className={buttonClasses("neutral")} href={`/courses/${course.id}`}>
          Learner preview
        </Link>
        {course.status === "published" ? (
          <form action={actions.unpublishReviewedCourse}>
            <input name="courseId" type="hidden" value={course.id} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <PendingSubmitButton
              className={buttonClasses("neutral")}
              label="Unpublish"
              pendingLabel="Unpublishing..."
              type="submit"
            />
          </form>
        ) : null}
        {course.status !== "archived" ? (
          <form action={actions.archiveReviewedCourse}>
            <input name="courseId" type="hidden" value={course.id} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <PendingSubmitButton
              className={buttonClasses("danger")}
              label="Archive"
              pendingLabel="Archiving..."
              type="submit"
            />
          </form>
        ) : null}
      </div>

      <form action={actions.requestCourseReviewChanges} className="mt-5 rounded-[14px] border border-[var(--ve-line-soft)] p-4">
        <input name="courseId" type="hidden" value={course.id} />
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <label className="block">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
            Reviewer feedback
          </span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
            name="reviewFeedback"
            placeholder="Summarize the changes required before approval."
            required
          />
        </label>
        <PendingSubmitButton
          className={`${buttonClasses("danger")} mt-4`}
          disabled={readiness.lifecycle === "published" || readiness.lifecycle === "archived"}
          label="Request changes"
          pendingLabel="Saving feedback..."
          type="submit"
        />
      </form>
    </AdminCard>
  );
}
