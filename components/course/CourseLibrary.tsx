"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CourseCard } from "@/components/course/CourseCard";
import { Button } from "@/components/ui/Button";
import { CheckCircleIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { PaginationControls } from "@/components/ui/PaginationControls";
import type { OrganizationCourseDeliveryOption } from "@/features/organizations/application/learner-workspace";
import type {
  LearningCourseCard,
  LearningLessonCard,
} from "@/features/learning/application/course-card-model";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { paginateItems } from "@/lib/pagination";
import {
  getCourseProgress,
  getCourseResumeTarget,
  type LessonProgressRecord,
} from "@/lib/progress";
import { cn } from "@/lib/utils";
import { formatXpLabel } from "@/lib/xp-format";

type CourseLibraryProps = {
  courses: LearningCourseCard[];
  courseHrefPrefix?: string;
  completedLessonIds?: string[];
  completedLessonIdsByDeliveryKey?: Record<string, string[]>;
  deliveryOptions?: Record<string, OrganizationCourseDeliveryOption[]>;
  introSubtitle?: string;
  introTitle?: string;
  lessonProgress?: LessonProgressRecord[];
  unitLabel?: string;
  variant?: "browser" | "learnerEditorial";
};

type CourseLibraryItem = {
  completedAt: string | null;
  completedLessons: number;
  course: LearningCourseCard;
  href: string;
  isCompleted: boolean;
  isInProgress: boolean;
  key: string;
  lessonCount: number;
  option: OrganizationCourseDeliveryOption | null;
  progressPercent: number;
  resumeTarget: { href: string; label: string } | null;
  startedLesson: LearningLessonCard | null;
};

function getDeliveryKey(courseId: string, option: OrganizationCourseDeliveryOption | null) {
  return `${courseId}:${option?.programmeId ?? "organization"}`;
}

function getUniqueDeliveryOptions(
  options: OrganizationCourseDeliveryOption[] | undefined,
): Array<OrganizationCourseDeliveryOption | null> {
  if (!options) {
    return [null];
  }

  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.programmeId ?? "organization";

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildCourseHref(
  courseHrefPrefix: string,
  courseId: string,
  option: OrganizationCourseDeliveryOption | null,
) {
  return `${courseHrefPrefix.replace(/\/$/, "")}/${encodeURIComponent(courseId)}${
    option?.programmeId ? `?programmeId=${encodeURIComponent(option.programmeId)}` : ""
  }`;
}

function appendCourseDeliveryParams(
  href: string,
  option: OrganizationCourseDeliveryOption | null,
  pageNumber?: number,
) {
  const [pathname, queryString = ""] = href.split("?");
  const params = new URLSearchParams(queryString);

  if (pageNumber) {
    params.set("page", String(pageNumber));
  }

  if (option?.programmeId) {
    params.set("programmeId", option.programmeId);
  }

  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function buildLessonHref(
  courseHrefPrefix: string,
  courseId: string,
  lessonId: string,
  option: OrganizationCourseDeliveryOption | null,
  pageNumber?: number,
) {
  return appendCourseDeliveryParams(
    `${courseHrefPrefix.replace(/\/$/, "")}/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    option,
    pageNumber,
  );
}

function buildQuizHref(
  courseHrefPrefix: string,
  courseId: string,
  lessonId: string,
  option: OrganizationCourseDeliveryOption | null,
) {
  return appendCourseDeliveryParams(
    `${courseHrefPrefix.replace(/\/$/, "")}/${encodeURIComponent(courseId)}/quiz/${encodeURIComponent(lessonId)}`,
    option,
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatCompletedAt(value: string | null) {
  if (!value) {
    return "Completed";
  }

  return `Completed ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))}`;
}

function getCoursePageProgress(
  course: LearningCourseCard,
  completedLessonIds: Set<string>,
  lessonProgress: LessonProgressRecord[],
) {
  const progressByLessonId = new Map(lessonProgress.map((record) => [record.lesson_id, record]));
  let completedPages = 0;
  let totalPages = 0;

  for (const lesson of course.lessons) {
    const lessonPageIds = lesson.pages.map((page) => page.id);
    totalPages += lessonPageIds.length;

    if (completedLessonIds.has(lesson.id)) {
      completedPages += lessonPageIds.length;
      continue;
    }

    const record = progressByLessonId.get(lesson.id);
    const completedPageIds = new Set(record?.completed_pages ?? record?.completed_modules ?? []);
    completedPages += lessonPageIds.filter((pageId) => completedPageIds.has(pageId)).length;
  }

  if (totalPages === 0) {
    return getCourseProgress(course, completedLessonIds).progressPercent;
  }

  return Math.round((completedPages / totalPages) * 100);
}

function getLatestCourseProgressRecord(
  course: LearningCourseCard,
  lessonProgress: LessonProgressRecord[],
) {
  const lessonIds = new Set(course.lessons.map((lesson) => lesson.id));

  return (
    lessonProgress
      .filter((record) => lessonIds.has(record.lesson_id))
      .sort((left, right) => {
        const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0;
        const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0;
        return rightTime - leftTime;
      })[0] ?? null
  );
}

function getStartedLesson(
  course: LearningCourseCard,
  latestRecord: LessonProgressRecord | null,
) {
  if (!latestRecord) {
    return null;
  }

  return course.lessons.find((lesson) => lesson.id === latestRecord.lesson_id) ?? null;
}

function getCompletedAt(course: LearningCourseCard, lessonProgress: LessonProgressRecord[]) {
  const lessonIds = new Set(course.lessons.map((lesson) => lesson.id));
  const completedTimes = lessonProgress
    .filter((record) => lessonIds.has(record.lesson_id) && record.completed_at)
    .map((record) => record.completed_at as string)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  return completedTimes[0] ?? null;
}

function getEditorialCta(item: CourseLibraryItem) {
  if (item.isCompleted) {
    return "Review Course";
  }

  if (item.isInProgress) {
    return "Continue Course";
  }

  return "Start Learning";
}

export function CourseLibrary({
  courseHrefPrefix = "/courses",
  courses,
  completedLessonIds = [],
  completedLessonIdsByDeliveryKey,
  deliveryOptions,
  introSubtitle = "Discover new pathways, deepen your understanding, and shape your own curriculum.",
  introTitle = "Explore Lessons",
  lessonProgress = [],
  unitLabel = "XP",
  variant = "browser",
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
    () =>
      filteredCourses.flatMap((course) => {
        const options = getUniqueDeliveryOptions(deliveryOptions?.[course.id]);
        return options.map((option) => ({ course, option }));
      }),
    [deliveryOptions, filteredCourses],
  );
  const paginatedCourses = useMemo(() => paginateItems(courseItems, page, 6), [courseItems, page]);

  const editorialItems = useMemo<CourseLibraryItem[]>(
    () =>
      courses.flatMap((course) => {
        const options = getUniqueDeliveryOptions(deliveryOptions?.[course.id]);

        return options.map((option) => {
          const deliveryKey = getDeliveryKey(course.id, option);
          const itemCompletedLessonIds = new Set(
            completedLessonIdsByDeliveryKey?.[deliveryKey] ?? completedLessonIds,
          );
          const progress = getCourseProgress(course, itemCompletedLessonIds);
          const latestRecord = getLatestCourseProgressRecord(course, lessonProgress);
          const pageProgressPercent = getCoursePageProgress(
            course,
            itemCompletedLessonIds,
            lessonProgress,
          );
          const hasStarted = Boolean(
            latestRecord &&
              ((latestRecord.completed_pages?.length ?? 0) > 0 ||
                (latestRecord.completed_modules?.length ?? 0) > 0 ||
                latestRecord.completed_at),
          );
          const isCompleted =
            progress.lessonCount > 0 && progress.completedLessons === progress.lessonCount;
          const href = buildCourseHref(courseHrefPrefix, course.id, option);

          return {
            completedAt: getCompletedAt(course, lessonProgress),
            completedLessons: progress.completedLessons,
            course,
            href,
            isCompleted,
            isInProgress: hasStarted && !isCompleted,
            key: `${course.id}:${option?.programmeId ?? "catalog"}`,
            lessonCount: progress.lessonCount,
            option,
            progressPercent: Math.max(progress.progressPercent, pageProgressPercent),
            resumeTarget: getCourseResumeTarget(course, lessonProgress, itemCompletedLessonIds, {
              lessonHref: (lessonId, pageNumber) =>
                buildLessonHref(courseHrefPrefix, course.id, lessonId, option, pageNumber),
              quizHref: (lessonId) => buildQuizHref(courseHrefPrefix, course.id, lessonId, option),
            }),
            startedLesson: getStartedLesson(course, latestRecord),
          };
        });
      }),
    [
      completedLessonIds,
      completedLessonIdsByDeliveryKey,
      courseHrefPrefix,
      courses,
      deliveryOptions,
      lessonProgress,
    ],
  );

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, category]);

  if (variant !== "learnerEditorial") {
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
              Showing {paginatedCourses.startItem}-{paginatedCourses.endItem} of{" "}
              {paginatedCourses.totalItems}{" "}
              {paginatedCourses.totalItems === 1 ? "course" : "courses"}
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
                  completedLessonIdsByDeliveryKey?.[getDeliveryKey(course.id, option)] ??
                  completedLessonIds
                }
                contextLabel={option?.label}
                course={course}
                desktopLayout="horizontal"
                href={buildCourseHref(courseHrefPrefix, course.id, option)}
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

  if (editorialItems.length === 0) {
    return (
      <div className="course-library-empty">
        <p>No published courses yet.</p>
        <span>Check back soon for new learning pathways.</span>
      </div>
    );
  }

  const isMultiDeliveryCourse = (item: CourseLibraryItem) =>
    (deliveryOptions?.[item.course.id]?.length ?? 0) > 1;
  const directEditorialItems = editorialItems.filter((item) => !isMultiDeliveryCourse(item));
  const inProgressItems = directEditorialItems.filter((item) => item.isInProgress);
  const completedItems = directEditorialItems.filter((item) => item.isCompleted);
  const featuredItem =
    inProgressItems[0] ??
    editorialItems.find((item) => !item.isCompleted) ??
    editorialItems[0];
  const featuredCourseDeliveryCount = new Set(
    editorialItems
      .filter((item) => item.course.id === featuredItem.course.id)
      .map((item) => item.option?.programmeId ?? "organization"),
  ).size;
  const featuredHref = featuredCourseDeliveryCount > 1
    ? "#all-learning"
    : (featuredItem.resumeTarget?.href ?? featuredItem.href);
  const pickUpItems = inProgressItems
    .filter((item) => item.key !== featuredItem.key)
    .slice(0, 2);
  const curatedItems = editorialItems
    .filter((item) => item.key !== featuredItem.key && !item.isCompleted && !isMultiDeliveryCourse(item))
    .slice(0, 3);

  return (
    <div className="course-library">
      <section className="course-library-intro">
        <h1>{introTitle}</h1>
        <p>{introSubtitle}</p>
      </section>

      <section aria-label="Featured learning" className="course-library-section">
        <article className="course-library-feature">
          <div className="course-library-feature__image">
            <Image
              alt={featuredItem.course.thumbnail.alt}
              className={`h-full w-full ${getImageFitClass(featuredItem.course.thumbnail)}`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 680px"
              src={featuredItem.course.thumbnail.src}
              style={getImagePresentationStyle(featuredItem.course.thumbnail)}
            />
            <span className="course-library-feature__badge">
              {featuredItem.isInProgress ? "In Progress" : "New"}
            </span>
          </div>
          <div className="course-library-feature__body">
            <div className="course-library-feature__title-row">
              <div>
                <p>{featuredItem.course.category}</p>
                <h2>{featuredItem.course.title}</h2>
              </div>
              <span aria-hidden="true" className="course-library-bookmark" />
            </div>
            <p className="course-library-feature__description">{featuredItem.course.description}</p>
            <div className="course-library-meta-row">
              <span>{featuredItem.lessonCount} lessons</span>
              <span>{formatDuration(featuredItem.course.estimatedMinutes)}</span>
              <span>{formatXpLabel(featuredItem.course.xp, unitLabel)}</span>
            </div>
            {featuredItem.progressPercent > 0 ? (
              <div className="course-library-progress">
                <span>{featuredItem.progressPercent}% Complete</span>
                <div className="learner-progress-track">
                  <div
                    className="learner-progress-fill"
                    style={{ width: `${featuredItem.progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
            <Button
              className="course-library-primary-action"
              href={featuredHref}
            >
              {getEditorialCta(featuredItem)}
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </article>
      </section>

      {pickUpItems.length > 0 ? (
        <section className="course-library-section">
          <h2 className="course-library-section__label">Pick Up Where You Left Off</h2>
          <div className="course-library-pickup-grid">
            {pickUpItems.map((item) => (
              <Link
                className="course-library-pickup-card"
                href={item.resumeTarget?.href ?? item.href}
                key={item.key}
              >
                <div className="course-library-pickup-card__image">
                  <Image
                    alt={item.course.thumbnail.alt}
                    className={`h-full w-full ${getImageFitClass(item.course.thumbnail)}`}
                    fill
                    sizes="96px"
                    src={item.course.thumbnail.src}
                    style={getImagePresentationStyle(item.course.thumbnail)}
                  />
                </div>
                <div className="min-w-0">
                  <span>{item.startedLesson?.title ?? item.course.category}</span>
                  <h3>{item.course.title}</h3>
                  <p>{item.progressPercent}% complete</p>
                </div>
                <div className="course-library-pickup-card__progress">
                  <div style={{ width: `${item.progressPercent}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {curatedItems.length > 0 ? (
        <section className="course-library-section">
          <div className="course-library-section__heading">
            <h2>Curated for You</h2>
            <a href="#all-learning">See all</a>
          </div>
          <div className="course-library-curated-grid">
            {curatedItems.map((item) => (
              <Link className="course-library-curated-card" href={item.href} key={item.key}>
                <div className="course-library-curated-card__image">
                  <Image
                    alt={item.course.thumbnail.alt}
                    className={`h-full w-full ${getImageFitClass(item.course.thumbnail)}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 360px"
                    src={item.course.thumbnail.src}
                    style={getImagePresentationStyle(item.course.thumbnail)}
                  />
                </div>
                <div>
                  <h3>{item.course.title}</h3>
                  <span>{item.lessonCount} lessons</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {completedItems.length > 0 ? (
        <section className="course-library-section">
          <h2 className="course-library-section__label">Recently Completed</h2>
          <div className="course-library-completed-grid">
            {completedItems.slice(0, 2).map((item) => (
              <Link className="course-library-completed-card" href={item.href} key={item.key}>
                <span aria-hidden="true" className="course-library-completed-card__icon">
                  <CheckCircleIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3>{item.course.title}</h3>
                  <p>{formatCompletedAt(item.completedAt)}</p>
                </div>
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="course-library-browser" id="all-learning">
        <div className="course-library-section__heading">
          <h2>All Learning</h2>
          <span>
            {paginatedCourses.totalItems} {paginatedCourses.totalItems === 1 ? "course" : "courses"}
          </span>
        </div>
        <div className="course-library-search">
          <div className="course-library-search__field">
            <svg aria-hidden="true" className="size-4 shrink-0" fill="none" viewBox="0 0 24 24">
              <path
                d="m20 20-4.6-4.6m2.1-5.2a7.3 7.3 0 1 1-14.6 0 7.3 7.3 0 0 1 14.6 0Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.4"
              />
            </svg>
            <input
              aria-label="Search courses"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search courses"
              type="search"
              value={query}
            />
            {query ? (
              <button onClick={() => setQuery("")} type="button">
                Clear
              </button>
            ) : null}
          </div>
          <div className="course-library-category-rail hide-scrollbar">
            {categories.map((item) => (
              <button
                className={cn(category === item && "is-active")}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                {item === "all" ? "All" : item}
              </button>
            ))}
          </div>
        </div>

        {filteredCourses.length > 0 ? (
          <div className="course-library-list">
            {paginatedCourses.items.map(({ course, option }) => {
              const deliveryKey = getDeliveryKey(course.id, option);
              const itemCompletedLessonIds = new Set(
                completedLessonIdsByDeliveryKey?.[deliveryKey] ?? completedLessonIds,
              );
              const progress = getCourseProgress(course, itemCompletedLessonIds);

              return (
                <Link
                  className="course-library-list-card"
                  href={buildCourseHref(courseHrefPrefix, course.id, option)}
                  key={`${course.id}:${option?.programmeId ?? "catalog"}`}
                >
                  <div className="course-library-list-card__image">
                    <Image
                      alt={course.thumbnail.alt}
                      className={`h-full w-full ${getImageFitClass(course.thumbnail)}`}
                      fill
                      sizes="96px"
                      src={course.thumbnail.src}
                      style={getImagePresentationStyle(course.thumbnail)}
                    />
                  </div>
                  <div className="min-w-0">
                    <p>{option?.label ?? course.category}</p>
                    <h3>{course.title}</h3>
                    <span>
                      {progress.completedLessons}/{progress.lessonCount} lessons completed ·{" "}
                      {formatDuration(course.estimatedMinutes)}
                    </span>
                  </div>
                  <strong>{progress.progressPercent}%</strong>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="course-library-empty">
            <p>No courses found</p>
            <span>Try another search term or category.</span>
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
        <PaginationControls
          className="pt-4"
          currentPage={paginatedCourses.currentPage}
          onPageChange={setPage}
          totalPages={paginatedCourses.totalPages}
        />
      </section>
    </div>
  );
}
