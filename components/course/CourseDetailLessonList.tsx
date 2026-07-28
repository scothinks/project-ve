"use client";

import { useState } from "react";
import { LessonModuleCard } from "@/components/lesson/LessonModuleCard";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { paginateItems } from "@/lib/pagination";
import type { Lesson } from "@/lib/lessons";
import { getLessonXP } from "@/lib/lessons";
import { formatXpLabel } from "@/lib/xp-format";

type CourseDetailLessonListProps = {
  lessons: Lesson[];
  completedLessonIds: string[];
};

const lessonsPerPage = 6;

export function CourseDetailLessonList({
  lessons,
  completedLessonIds,
}: CourseDetailLessonListProps) {
  const [page, setPage] = useState(1);
  const paginatedLessons = paginateItems(lessons, page, lessonsPerPage);

  return (
    <div className="space-y-3">
      <p className="text-[0.9rem] font-medium tracking-[-0.01em] text-[#959595]">
        Showing {paginatedLessons.startItem}-{paginatedLessons.endItem} of{" "}
        {paginatedLessons.totalItems}{" "}
        {paginatedLessons.totalItems === 1 ? "lesson" : "lessons"}
      </p>
      <div className="learner-card-grid">
        {paginatedLessons.items.map((lesson) => {
          const completed = completedLessonIds.includes(lesson.id);

          return (
            <div className="flex h-full flex-col" key={lesson.id}>
              <LessonModuleCard completed={completed} lesson={lesson} />
              <p className="mt-2 px-1 text-[11px] font-bold text-[var(--ve-muted)]">
                {lesson.pages.length} pages · {completed ? "Lesson complete" : `${formatXpLabel(getLessonXP(lesson))} total`}
              </p>
            </div>
          );
        })}
      </div>
      <PaginationControls
        className="pt-1"
        currentPage={paginatedLessons.currentPage}
        onPageChange={setPage}
        totalPages={paginatedLessons.totalPages}
      />
    </div>
  );
}
