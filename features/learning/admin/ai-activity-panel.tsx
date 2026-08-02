import Link from "next/link";
import {
  AdminCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import type { AdminAiActivity } from "@/features/learning/admin/ai-activity";

type AiActivityPanelProps = {
  activity: AdminAiActivity;
  courseId?: string;
};

function statusTone(status: string) {
  if (status === "completed") return "good" as const;
  if (status === "failed") return "danger" as const;
  if (status === "running") return "warning" as const;
  return "neutral" as const;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function jobLabel(jobType: string) {
  return jobType.replaceAll("_", " ");
}

export function AiActivityPanel({
  activity,
  courseId,
}: AiActivityPanelProps) {
  const plannerHref = courseId ? `/admin/courses/ai/planner?courseId=${courseId}` : "/admin/courses/ai/planner";

  return (
    <AdminCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
            AI activity
          </p>
          <h2 className="mt-2 text-lg font-black">Queue and review</h2>
        </div>
        <Link className="text-sm font-black text-[var(--ve-green)]" href={plannerHref}>
          Open planner
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <AdminStatusBadge tone={activity.summary.queued > 0 ? "warning" : "neutral"}>
          {activity.summary.queued} queued
        </AdminStatusBadge>
        <AdminStatusBadge tone={activity.summary.running > 0 ? "warning" : "neutral"}>
          {activity.summary.running} running
        </AdminStatusBadge>
        <AdminStatusBadge tone={activity.summary.needsReview > 0 ? "warning" : "good"}>
          {activity.summary.needsReview} needs review
        </AdminStatusBadge>
        <AdminStatusBadge tone={activity.summary.failed > 0 ? "danger" : "good"}>
          {activity.summary.failed} failed
        </AdminStatusBadge>
        <AdminStatusBadge tone="good">
          {activity.summary.completed} completed
        </AdminStatusBadge>
      </div>

      <div className="mt-5 space-y-3">
        {activity.plansNeedingReview.length > 0 ? (
          activity.plansNeedingReview.slice(0, 3).map((plan) => (
            <Link
              className="block rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4 transition hover:border-[var(--ve-green)]"
              href={`/admin/courses/ai/planner?${courseId ? `courseId=${courseId}&` : ""}plan=${plan.id}`}
              key={plan.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">
                    {plan.mode === "new_course" ? "Course proposal" : "Curriculum proposal"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                    Created {formatTime(plan.created_at)}
                  </p>
                </div>
                <AdminStatusBadge tone="warning">{plan.status}</AdminStatusBadge>
              </div>
            </Link>
          ))
        ) : null}

        {activity.jobs.length === 0 && activity.plansNeedingReview.length === 0 ? (
          <EmptyAdminState>No AI activity yet.</EmptyAdminState>
        ) : (
          activity.jobs.map((job) => (
            <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4" key={job.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black capitalize">{jobLabel(job.job_type)}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                    {job.entity_type} · Updated {formatTime(job.updated_at)}
                  </p>
                </div>
                <AdminStatusBadge tone={statusTone(job.status)}>{job.status}</AdminStatusBadge>
              </div>
              {job.error ? (
                <p className="mt-3 text-xs font-semibold leading-5 text-[var(--ve-danger)]">{job.error}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </AdminCard>
  );
}
