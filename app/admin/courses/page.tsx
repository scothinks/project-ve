import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { setCourseStatus } from "@/app/admin/courses/actions";
import { getAdminCourses, requireAdmin } from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "published") return "Enabled";
  if (status === "draft") return "Disabled";
  return status;
}

function actionButtonClasses(kind: "success" | "danger" | "secondary") {
  if (kind === "success") {
    return "rounded-[12px] border border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_82%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-green)]";
  }

  if (kind === "danger") {
    return "rounded-[12px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)]";
  }

  return "rounded-[14px] border border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_74%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)]";
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; notice?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const courses = await getAdminCourses(supabase);
  const { page, notice } = (await searchParams) ?? {};
  const paginatedCourses = paginateItems(courses, parsePageParam(page), 20);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Learning"
        title="Courses"
        subtitle="Manage the values education catalog, lessons, pages, and quizzes."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex flex-wrap justify-end gap-3">
        <Link
          className={actionButtonClasses("secondary")}
          href="/admin/courses/ai/planner"
        >
          AI Course Planner
        </Link>
        <Link
          className="rounded-[14px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white"
          href="/admin/courses/new"
        >
          Add Course
        </Link>
      </div>
      {courses.length === 0 ? (
        <EmptyAdminState>No courses found.</EmptyAdminState>
      ) : (
        <>
        <AdminTable columns={["Course", "Category", "Level", "Minutes", "Status", "Updated", "Action"]}>
          {paginatedCourses.items.map((course) => (
            <tr key={course.id}>
              <td className="min-w-[260px] px-4 py-4">
                <Link className="font-black hover:text-[var(--ve-green)]" href={`/admin/courses/${course.id}`}>
                  {course.title}
                </Link>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{course.slug}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-4">{course.category}</td>
              <td className="whitespace-nowrap px-4 py-4 capitalize">{course.level}</td>
              <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">{course.estimated_minutes}</td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={statusTone(course.status)}>{statusLabel(course.status)}</AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4">{formatRewardDate(course.updated_at)}</td>
              <td className="whitespace-nowrap px-4 py-4">
                <form action={setCourseStatus}>
                  <input name="courseId" type="hidden" value={course.id} />
                  <input name="redirectTo" type="hidden" value="/admin/courses" />
                  <input
                    name="status"
                    type="hidden"
                    value={course.status === "published" ? "draft" : "published"}
                  />
                  <button
                    className={actionButtonClasses(course.status === "published" ? "danger" : "success")}
                    type="submit"
                  >
                    {course.status === "published"
                      ? "Disable"
                      : "Enable"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </AdminTable>
        <AdminPagination
          basePath="/admin/courses"
          currentPage={paginatedCourses.currentPage}
          summary={`Showing ${paginatedCourses.startItem}-${paginatedCourses.endItem} of ${paginatedCourses.totalItems} courses`}
          totalPages={paginatedCourses.totalPages}
        />
        </>
      )}
    </>
  );
}
