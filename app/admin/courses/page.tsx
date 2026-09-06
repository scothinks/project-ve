import Link from "next/link";
import { AiPageAuthoring } from "@/components/admin/ai/AiPageAuthoring";
import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import {
  CourseCreateButton,
  CourseSearchAndFilters,
  CourseIndexWorkspace,
  type CourseIndexCourse,
} from "@/components/admin/CourseIndexWorkspace";
import { SparkleIcon } from "@/components/ui/Icons";
import { getAdminCourses, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";

type CourseSort = "title_asc" | "title_desc" | "updated_asc" | "updated_desc";

const pageSize = 12;
const defaultSort: CourseSort = "updated_desc";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeFilter(value: string | string[] | undefined) {
  return firstSearchValue(value)?.trim() || "all";
}

function normalizeQuery(value: string | string[] | undefined) {
  return firstSearchValue(value)?.trim() ?? "";
}

function normalizeSort(value: string | string[] | undefined): CourseSort {
  const sort = firstSearchValue(value);

  if (
    sort === "title_asc"
    || sort === "title_desc"
    || sort === "updated_asc"
    || sort === "updated_desc"
  ) {
    return sort;
  }

  return defaultSort;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function matchesText(course: CourseIndexCourse, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLocaleLowerCase();

  return [
    course.title,
    course.slug,
    course.description ?? "",
    course.category ?? "",
    course.level,
    course.status,
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

function sortCourses(courses: CourseIndexCourse[], sort: CourseSort) {
  return [...courses].sort((first, second) => {
    if (sort === "title_asc") {
      return first.title.localeCompare(second.title);
    }

    if (sort === "title_desc") {
      return second.title.localeCompare(first.title);
    }

    const firstDate = new Date(first.updated_at).getTime();
    const secondDate = new Date(second.updated_at).getTime();

    return sort === "updated_asc" ? firstDate - secondDate : secondDate - firstDate;
  });
}

function buildCurrentHref(filters: {
  category: string;
  level: string;
  page: string | undefined;
  query: string;
  sort: CourseSort;
  status: string;
}) {
  const params = new URLSearchParams();

  if (filters.query) params.set("query", filters.query);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.level !== "all") params.set("level", filters.level);
  if (filters.sort !== defaultSort) params.set("sort", filters.sort);
  if (filters.page && filters.page !== "1") params.set("page", filters.page);

  const query = params.toString();
  return query ? `/admin/courses?${query}` : "/admin/courses";
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string | string[];
    level?: string | string[];
    notice?: string | string[];
    page?: string | string[];
    query?: string | string[];
    sort?: string | string[];
    status?: string | string[];
  }>;
}) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const courses = await getAdminCourses(supabase) as CourseIndexCourse[];
  const pendingActionsCount = courses.reduce((total, course) => total + (course.readiness_issues?.length ?? 0), 0);
  const filters = {
    category: normalizeFilter(params.category),
    level: normalizeFilter(params.level),
    query: normalizeQuery(params.query),
    sort: normalizeSort(params.sort),
    status: normalizeFilter(params.status),
  };
  const page = firstSearchValue(params.page);
  const notice = firstSearchValue(params.notice);
  const categories = Array.from(
    new Set(courses.map((course) => course.category?.trim()).filter(isNonEmptyString)),
  ).sort((first, second) => first.localeCompare(second));
  const levels = Array.from(new Set(courses.map((course) => course.level).filter(isNonEmptyString))).sort(
    (first, second) => first.localeCompare(second),
  );
  const filteredCourses = sortCourses(
    courses.filter((course) => {
      const statusMatches = filters.status === "all" || course.status === filters.status;
      const categoryMatches = filters.category === "all" || course.category === filters.category;
      const levelMatches = filters.level === "all" || course.level === filters.level;

      return statusMatches && categoryMatches && levelMatches && matchesText(course, filters.query);
    }),
    filters.sort,
  );
  const paginatedCourses = paginateItems(filteredCourses, parsePageParam(page), pageSize);

  const pendingActionsPillClasses = pendingActionsCount > 0
    ? "border-[color:color-mix(in_srgb,var(--admin-secondary)_32%,var(--admin-border-warm))] text-[var(--admin-secondary)]"
    : "border-[var(--admin-border-warm)] text-[var(--admin-on-surface-variant)]";

  return (
    <div className="-mx-5 -my-6 md:-mx-8 md:-my-8">
    <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-16 md:py-14">
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--admin-primary)]">Your workspace</p>
          <h1 className="text-[40px] font-black leading-[1.05] tracking-[-0.02em] text-[var(--admin-brand-hero)]">
            Courses
          </h1>
          <p className="max-w-[520px] text-[15px] font-medium leading-6 text-[var(--admin-on-surface-variant)]">
            Everything you&apos;re teaching, in one place. Pick one up where you left off, or start something new.
          </p>
        </div>
        <div className="flex items-stretch gap-2.5">
          <AiPageAuthoring />
          <Link
            className={`inline-flex items-center gap-1.5 rounded-full border bg-[var(--admin-surface-milk)] px-4 py-[9px] text-xs font-extrabold ${pendingActionsPillClasses}`}
            href="/admin/courses/pending-actions"
          >
            <svg aria-hidden="true" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            {pendingActionsCount === 0
              ? "All caught up"
              : `${pendingActionsCount} action${pendingActionsCount === 1 ? "" : "s"} needed`}
          </Link>
          <Link
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-[9px] text-xs font-extrabold text-[var(--admin-on-surface-variant)]"
            href="/admin/courses/ai-credits"
          >
            <SparkleIcon className="h-[15px] w-[15px]" />
            AI credits
          </Link>
          <CourseCreateButton />
        </div>
      </div>
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-6">
        <CourseSearchAndFilters categories={categories} filters={filters} levels={levels} />
      </div>
      <CourseIndexWorkspace
        courses={paginatedCourses.items}
        currentHref={buildCurrentHref({ ...filters, page })}
        filters={filters}
        pagination={{
          currentPage: paginatedCourses.currentPage,
          endItem: paginatedCourses.endItem,
          startItem: paginatedCourses.startItem,
          totalItems: paginatedCourses.totalItems,
          totalPages: paginatedCourses.totalPages,
        }}
      />
    </div>
    </div>
  );
}
