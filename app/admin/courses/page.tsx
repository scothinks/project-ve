import {
  AdminNoticeBanner,
  AdminPageHeader,
} from "@/components/admin/AdminPrimitives";
import {
  CourseIndexWorkspace,
  type CourseIndexCourse,
} from "@/components/admin/CourseIndexWorkspace";
import { AiActivityPanel } from "@/features/learning/admin/ai-activity-panel";
import { getAdminAiActivity } from "@/features/learning/admin/ai-activity";
import { getAdminAiCoursePlans, getAdminCourses, requireAdmin } from "@/lib/admin";
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
  const [courses, newCoursePlans, expansionPlans] = await Promise.all([
    getAdminCourses(supabase) as Promise<CourseIndexCourse[]>,
    getAdminAiCoursePlans(supabase, { mode: "new_course", limit: 6 }),
    getAdminAiCoursePlans(supabase, { mode: "expand_course", limit: 6 }),
  ]);
  const aiActivity = await getAdminAiActivity(supabase, {
    plans: [...newCoursePlans, ...expansionPlans],
  });
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

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Learning"
        title="Courses"
        subtitle="Find, review, duplicate, and open course workspaces from one content index."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-6">
        <AiActivityPanel activity={aiActivity} />
      </div>
      <CourseIndexWorkspace
        categories={categories}
        courses={paginatedCourses.items}
        currentHref={buildCurrentHref({ ...filters, page })}
        filters={filters}
        levels={levels}
        pagination={{
          currentPage: paginatedCourses.currentPage,
          endItem: paginatedCourses.endItem,
          startItem: paginatedCourses.startItem,
          totalItems: paginatedCourses.totalItems,
          totalPages: paginatedCourses.totalPages,
        }}
        templateCourses={courses}
        totalCourseCount={courses.length}
      />
    </>
  );
}
