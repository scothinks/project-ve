import Link from "next/link";
import type { Lesson } from "@/lib/lessons";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getLessonXP } from "@/lib/lessons";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/ui/Icons";
import { XPBadge } from "@/components/ui/XPBadge";

type LessonModuleCardProps = {
  lesson: Lesson;
  completed?: boolean;
};

export function LessonModuleCard({ lesson, completed = false }: LessonModuleCardProps) {
  return (
    <Link href={`/lessons/${lesson.id}`} className="block">
      <Card className="overflow-hidden" variant="lesson">
        <div className="h-24 bg-[#dff2e9]">
          <img
            alt={lesson.coverImage.alt}
            className={`h-full w-full ${getImageFitClass(lesson.coverImage)}`}
            src={lesson.coverImage.src}
            style={getImagePresentationStyle(lesson.coverImage)}
          />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[1.12rem] font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                {lesson.title}
              </p>
              <p className="mt-2 text-[0.98rem] leading-7 text-[var(--ve-muted)]">{lesson.summary}</p>
            </div>
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                completed
                  ? "bg-[#dff2e9] text-[#087f5b]"
                  : "bg-[#f3f3f3] text-[#008751]"
              }`}
            >
              {completed ? "OK" : <ChevronRightIcon className="h-4 w-4" />}
            </span>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-[0.92rem] font-medium tracking-[-0.01em] text-[var(--ve-muted)]">
              {completed ? "Completed" : `${lesson.estimatedMinutes} min`}
            </span>
            <XPBadge className="shrink-0" xp={getLessonXP(lesson)} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
