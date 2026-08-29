import Link from "next/link";
import Image from "next/image";
import type { LearningCourseCard } from "@/features/learning/application/course-card-model";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getCourseProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { XPBadge } from "@/components/ui/XPBadge";

type CourseCardProps = {
  course: LearningCourseCard;
  href?: string;
  completedLessonIds?: Set<string> | string[];
  desktopLayout?: "stacked" | "horizontal";
  contextLabel?: string;
  unitLabel?: string;
};

export function CourseCard({
  course,
  href = `/courses/${course.id}`,
  completedLessonIds,
  desktopLayout = "stacked",
  contextLabel,
  unitLabel = "XP",
}: CourseCardProps) {
  const { completedLessons, lessonCount, progressPercent } = getCourseProgress(
    course,
    completedLessonIds,
  );

  return (
    <Link className="block" href={href}>
      <Card
        className={cn(
          "overflow-hidden",
          desktopLayout === "horizontal" && "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]",
        )}
        variant="lesson"
      >
        <div
          className={cn(
            "relative h-32",
            desktopLayout === "horizontal" ? "lg:h-full lg:min-h-[12rem]" : "lg:h-28",
          )}
        >
          <Image
            alt={course.thumbnail.alt}
            className={`h-full w-full ${getImageFitClass(course.thumbnail)}`}
            fill
            sizes={
              desktopLayout === "horizontal"
                ? "(max-width: 768px) 100vw, 224px"
                : "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 360px"
            }
            src={course.thumbnail.src}
            style={getImagePresentationStyle(course.thumbnail)}
          />
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/60 to-black/5",
              desktopLayout === "horizontal" && "lg:from-black/15 lg:to-transparent",
            )}
          />
          <div
            className={cn(
              "absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white",
              desktopLayout === "horizontal" && "lg:hidden",
            )}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
                {course.category}
              </p>
              <h3
                className={cn(
                  "mt-1 text-[1.65rem] font-semibold leading-[1.04] tracking-[-0.03em]",
                  desktopLayout === "horizontal" ? "lg:text-[1.15rem]" : "lg:text-[1.35rem]",
                )}
              >
                {course.title}
              </h3>
            </div>
            <XPBadge
              xp={course.xp}
              unitLabel={unitLabel}
              className="shrink-0 bg-[var(--ve-card)] text-[#008751]"
            />
          </div>
        </div>
        <div
          className={cn("p-5 lg:p-4", desktopLayout === "horizontal" && "lg:flex lg:flex-col")}
        >
          {desktopLayout === "horizontal" ? (
            <div className="hidden lg:block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#008751]">
                    {course.category}
                  </p>
                  <h3 className="mt-1 text-[1.18rem] font-semibold leading-7 tracking-[-0.025em] text-[var(--foreground)]">
                    {course.title}
                  </h3>
                </div>
                <XPBadge
                  xp={course.xp}
                  unitLabel={unitLabel}
                  className="shrink-0 bg-[#dff2e9] text-[#008751]"
                />
              </div>
            </div>
          ) : null}
          <p
            className={cn(
              "text-[1.01rem] leading-8 text-[var(--ve-muted)] lg:text-[0.94rem] lg:leading-7",
              desktopLayout === "horizontal" && "lg:mt-3 lg:line-clamp-3",
            )}
          >
            {course.description}
          </p>
          {contextLabel ? (
            <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-green)]">
              {contextLabel}
            </p>
          ) : null}
          <div className="mt-5 h-2 rounded-full bg-[#e8e8e8]">
            <div
              className="h-full rounded-full bg-[#008751]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--ve-muted)] lg:mt-auto lg:pt-4">
            <span>
              {completedLessons}/{lessonCount} lessons completed
            </span>
            <span>{course.estimatedMinutes} min</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
