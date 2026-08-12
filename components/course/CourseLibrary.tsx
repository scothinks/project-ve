"use client";

import { useEffect, useMemo, useState } from "react";
import { CourseCard } from "@/components/course/CourseCard";
import { Button } from "@/components/ui/Button";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { paginateItems } from "@/lib/pagination";
import type { Course } from "@/lib/lessons";
import { cn } from "@/lib/utils";
import type { OrganizationCourseDeliveryOption } from "@/features/organizations/application/learner-workspace";

type CourseLibraryProps = {
  courses: Course[];
  courseHrefPrefix?: string;
  completedLessonIds?: string[];
  completedLessonIdsByDeliveryKey?: Record<string, string[]>;
  deliveryOptions?: Record<string, OrganizationCourseDeliveryOption[]>;
  unitLabel?: string;
};

function getDeliveryKey(courseId: string, option: OrganizationCourseDeliveryOption | null) {
  return `${courseId}:${option?.programmeId ?? "organization"}`;
}

export function CourseLibrary({
  courseHrefPrefix = "/courses",
  courses,
  completedLessonIds = [],
  completedLessonIdsByDeliveryKey,
  deliveryOptions,
  unitLabel = "XP",
}: CourseLibraryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const normalizedQuery = query.trim().toLowerCase();

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(courses.map((course) => course.category)))],
    [courses],
  );

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        const searchableText = [
          course.title,
          course.description,
          course.category,
          course.level,
          course.lessons.map((lesson) => `${lesson.title} ${lesson.summary}`).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
        const matchesCategory = category === "all" || course.category === category;

        return matchesQuery && matchesCategory;
      }),
    [category, courses, normalizedQuery],
  );
  const hasActiveSearch = normalizedQuery.length > 0 || category !== "all";
  const courseItems = useMemo(
    () => filteredCourses.flatMap((course) => {
      const options = deliveryOptions?.[course.id] ?? [null];
      return options.map((option) => ({ course, option }));
    }),
    [deliveryOptions, filteredCourses],
  );
  const paginatedCourses = useMemo(() => paginateItems(courseItems, page, 6), [courseItems, page]);

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, category]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex min-h-[5.25rem] flex-col justify-center rounded-[18px] border border-[#d8ded9] bg-[var(--ve-card)] px-4 focus-within:border-[var(--ve-green)] lg:min-h-[4.75rem] lg:px-5">
          <div className="flex items-center gap-3">
          <svg
            aria-hidden="true"
            className="size-4 shrink-0 text-[var(--ve-green)]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="m20 20-4.6-4.6m2.1-5.2a7.3 7.3 0 1 1-14.6 0 7.3 7.3 0 0 1 14.6 0Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.4"
            />
          </svg>
          <input
            aria-label="Search courses"
            className="min-w-0 flex-1 bg-transparent text-[1.05rem] font-medium tracking-[-0.01em] text-[#171717] outline-none placeholder:font-medium placeholder:text-[#b9b9b9]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses, lessons, values"
            type="search"
            value={query}
          />
          {query ? (
            <button
              className="text-xs font-semibold text-[var(--ve-muted)]"
              onClick={() => setQuery("")}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-[0.9rem] font-medium tracking-[-0.01em] text-[#959595]">
          Showing {paginatedCourses.startItem}-{paginatedCourses.endItem} of {paginatedCourses.totalItems} {paginatedCourses.totalItems === 1 ? "course" : "courses"}
        </p>
        </div>
      </div>

      <div className="sticky top-[107px] z-10 -mx-6 overflow-hidden bg-[color:color-mix(in_srgb,var(--ve-card)_95%,transparent)] py-3 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:backdrop-blur-0">
        <div className="hide-scrollbar flex flex-nowrap gap-2 overflow-x-auto px-6 lg:flex-wrap lg:px-0">
          {categories.map((item) => (
            <button
              className={cn(
                "min-h-11 min-w-11 shrink-0 rounded-[14px] border border-[var(--ve-line)] px-4 text-[0.92rem] font-medium tracking-[-0.01em] text-[var(--ve-muted-strong)]",
                category === item &&
                  "border-[var(--ve-green)] bg-[var(--ve-green-soft)] text-[var(--ve-green)]",
              )}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item === "all" ? "All" : item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:max-w-[48rem]">
        {filteredCourses.length > 0 ? (
            paginatedCourses.items.map(({ course, option }) => (
            <CourseCard
              completedLessonIds={
                completedLessonIdsByDeliveryKey?.[getDeliveryKey(course.id, option)] ?? completedLessonIds
              }
              course={course}
              desktopLayout="horizontal"
              contextLabel={option?.label}
              href={`${courseHrefPrefix.replace(/\/$/, "")}/${encodeURIComponent(course.id)}${option?.programmeId ? `?programmeId=${encodeURIComponent(option.programmeId)}` : ""}`}
              key={`${course.id}:${option?.programmeId ?? "organization"}`}
              unitLabel={unitLabel}
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--ve-line)] p-6 text-center">
            <p className="text-sm font-bold">No courses found</p>
            <p className="mt-2 text-xs leading-5 text-[var(--ve-muted)]">
              Try another search term or category.
            </p>
            {hasActiveSearch ? (
              <Button
                className="mt-4 h-9 px-4 text-xs"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
                type="button"
                variant="outline"
              >
                Reset search
              </Button>
            ) : null}
          </div>
        )}
      </div>
      <PaginationControls
        className="pt-2"
        currentPage={paginatedCourses.currentPage}
        onPageChange={setPage}
        totalPages={paginatedCourses.totalPages}
      />
    </div>
  );
}
