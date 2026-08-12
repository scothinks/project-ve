import Link from "next/link";
import Image from "next/image";
import type { Lesson } from "@/lib/lessons";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getLessonXP } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/ui/Icons";
import { XPBadge } from "@/components/ui/XPBadge";

type LessonModuleCardProps = {
  lesson: Lesson;
  completed?: boolean;
  desktopLayout?: "stacked" | "horizontal";
  href?: string;
  unitLabel?: string;
};

export function LessonModuleCard({
  lesson,
  completed = false,
  desktopLayout = "stacked",
  href = `/lessons/${lesson.id}`,
  unitLabel = "XP",
}: LessonModuleCardProps) {
  return (
    <Link href={href} className="block h-full">
      <Card
        className={cn(
          "h-full overflow-hidden",
          desktopLayout === "horizontal"
            ? "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]"
            : "flex flex-col",
        )}
        variant="lesson"
      >
        <div
          className={cn(
            "relative h-32 bg-[#dff2e9]",
            desktopLayout === "horizontal" ? "lg:h-full lg:min-h-[12rem]" : "lg:h-28",
          )}
        >
          <Image
            alt={lesson.coverImage.alt}
            className={`h-full w-full ${getImageFitClass(lesson.coverImage)}`}
            fill
            sizes={
              desktopLayout === "horizontal"
                ? "(max-width: 768px) 100vw, 224px"
                : "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 360px"
            }
            src={lesson.coverImage.src}
            style={getImagePresentationStyle(lesson.coverImage)}
          />
        </div>
        <div className="flex flex-1 flex-col p-5 lg:p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[1.12rem] font-semibold tracking-[-0.02em] text-[var(--foreground)] lg:text-[1rem]",
                  desktopLayout === "horizontal" && "lg:text-[1.12rem]",
                )}
              >
                {lesson.title}
              </p>
              <p
                className={cn(
                  "mt-2 text-[0.98rem] leading-7 text-[var(--ve-muted)] lg:text-[0.92rem] lg:leading-6",
                  desktopLayout === "horizontal" && "lg:line-clamp-3",
                )}
              >
                {lesson.summary}
              </p>
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
          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <span className="text-[0.92rem] font-medium tracking-[-0.01em] text-[var(--ve-muted)]">
              {completed ? "Completed" : `${lesson.estimatedMinutes} min`}
            </span>
            <XPBadge className="shrink-0" unitLabel={unitLabel} xp={getLessonXP(lesson)} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
