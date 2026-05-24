import Link from "next/link";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import type { Course } from "@/lib/lessons";
import { getCourseXP } from "@/lib/lessons";
import { getCourseProgress } from "@/lib/progress";
import { Card } from "@/components/ui/Card";
import { XPBadge } from "@/components/ui/XPBadge";

type CourseCardProps = {
  course: Course;
  href?: string;
  completedLessonIds?: Set<string> | string[];
};

export function CourseCard({
  course,
  href = `/courses/${course.id}`,
  completedLessonIds,
}: CourseCardProps) {
  const { completedLessons, lessonCount, progressPercent } = getCourseProgress(
    course,
    completedLessonIds,
  );

  return (
    <Link className="block" href={href}>
      <Card className="overflow-hidden" variant="lesson">
        <div className="relative h-32">
          <img
            alt={course.thumbnail.alt}
            className={`h-full w-full ${getImageFitClass(course.thumbnail)}`}
            src={course.thumbnail.src}
            style={getImagePresentationStyle(course.thumbnail)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/5" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
                {course.category}
              </p>
              <h3 className="mt-1 text-[1.65rem] font-semibold tracking-[-0.03em] leading-[1.04]">
                {course.title}
              </h3>
            </div>
            <XPBadge
              xp={getCourseXP(course)}
              className="shrink-0 bg-[var(--ve-card)] text-[#008751]"
            />
          </div>
        </div>
        <div className="p-5">
          <p className="text-[1.01rem] leading-8 text-[var(--ve-muted)]">{course.description}</p>
          <div className="mt-5 h-2 rounded-full bg-[#e8e8e8]">
            <div
              className="h-full rounded-full bg-[#008751]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-[0.9rem] font-medium tracking-[-0.01em] text-[var(--ve-muted)]">
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
