import Image from "@/components/media/MediaImage";
import Link from "next/link";
import { coverAccent } from "@/lib/gradient-accent";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { cn } from "@/lib/utils";
import type { CourseIndexCourse } from "@/components/admin/CourseIndexWorkspace";

function statusPillClasses(status: string) {
  if (status === "published") {
    return "bg-[var(--ui-success-bg)] text-[var(--ui-success)]";
  }
  if (status === "archived") {
    return "bg-[var(--ui-surface-soft)] text-[var(--ui-text-muted)]";
  }
  return "bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]";
}

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

function scopePillClasses(scope: string) {
  if (scope === "organization_private") {
    return "bg-[color:color-mix(in_srgb,var(--ui-info)_16%,var(--ui-surface))] text-[var(--ui-info)]";
  }
  if (scope === "adapted_platform") {
    return "bg-[var(--ui-warning-bg)] text-[var(--ui-warning)]";
  }
  return "bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]";
}

function scopeLabel(scope: string) {
  if (scope === "organization_private") return "Private";
  if (scope === "adapted_platform") return "Adapted";
  return "Platform";
}

function readiness(course: CourseIndexCourse) {
  const issueCount = (course.readiness_issues ?? []).length;
  const ready = issueCount === 0;
  return {
    fillClass: ready ? "bg-[var(--ui-success)]" : "bg-[var(--ui-success)]",
    label: ready ? "Ready to publish" : `${issueCount} thing${issueCount === 1 ? "" : "s"} to finish`,
    labelClass: ready ? "text-[var(--ui-success)]" : "text-[var(--ui-text-muted)]",
    widthPercent: ready ? 100 : Math.max(15, 100 - issueCount * 20),
  };
}

export function AdminCourseCard({
  actions,
  course,
}: {
  actions?: React.ReactNode;
  course: CourseIndexCourse;
}) {
  const thumbnailUrl = typeof course.thumbnail?.url === "string" ? course.thumbnail.url : null;
  const thumbnailAlt = typeof course.thumbnail?.altText === "string" ? course.thumbnail.altText : course.title;
  const courseReadiness = readiness(course);

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] shadow-[0_2px_8px_rgba(var(--ui-shadow-rgb),0.04)]">
      <div
        className="relative flex h-[120px] shrink-0 items-center justify-center"
        style={{ background: thumbnailUrl ? undefined : `linear-gradient(135deg, ${coverAccent(course.id)})` }}
      >
        {thumbnailUrl ? (
          <Image
            alt={thumbnailAlt}
            className={getImageFitClass(course.thumbnail as { fit?: string | null })}
            fill
            sizes="(min-width: 1024px) 360px, 100vw"
            src={thumbnailUrl}
            style={getImagePresentationStyle(course.thumbnail as { positionX?: number | null; positionY?: number | null })}
          />
        ) : (
          <span className="text-3xl font-black text-[var(--ui-text)]">{course.title.charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 pt-5 px-[22px] pb-[22px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em]", statusPillClasses(course.status))}>
            {statusLabel(course.status)}
          </span>
          <span className={cn("rounded-full px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em]", scopePillClasses(course.catalog_scope))}>
            {scopeLabel(course.catalog_scope)}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ui-text-muted)]">
            {course.category || "Uncategorised"}
          </span>
        </div>

        <Link className="text-lg font-extrabold leading-[1.3] text-[var(--ui-text)]" href={`/admin/courses/${course.id}`}>
          <span className="absolute inset-0" />
          {course.title}
        </Link>

        <p className="text-[13px] font-semibold text-[var(--ui-text-muted)]">
          {course.lesson_count ?? 0} lessons &middot; {course.estimated_minutes} min
        </p>

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <div className="h-[5px] w-full overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
            <div className={cn("h-full rounded-full", courseReadiness.fillClass)} style={{ width: `${courseReadiness.widthPercent}%` }} />
          </div>
          <span className={cn("text-[11px] font-extrabold", courseReadiness.labelClass)}>{courseReadiness.label}</span>
        </div>
      </div>

      {actions ? <div className="relative z-10 border-t border-[var(--ui-border-subtle)] px-5 py-2.5">{actions}</div> : null}
    </article>
  );
}

export function AdminCourseCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3")}>
      {children}
    </div>
  );
}
