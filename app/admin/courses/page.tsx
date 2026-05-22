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
          className="rounded-[14px] border border-[#cfe5db] bg-[#edf8f1] px-4 py-3 text-sm font-black text-[#087f5b]"
          href="/admin/courses/ai/new"
        >
          AI Course Creator
        </Link>
        <Link
          className="rounded-[14px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white"
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
                <Link className="font-black hover:text-[#087f5b]" href={`/admin/courses/${course.id}`}>
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
                    className={
                      course.status === "published"
                        ? "rounded-[12px] bg-[#fff0f0] px-3 py-2 text-xs font-black text-[#c00000]"
                        : "rounded-[12px] bg-[#e4f4ed] px-3 py-2 text-xs font-black text-[#087f5b]"
                    }
                    disabled={
                      course.ai_generated
                      && course.status !== "published"
                      && course.ai_publish_status !== "ready"
                    }
                    type="submit"
                  >
                    {course.status === "published"
                      ? "Disable"
                      : course.ai_generated && course.ai_publish_status !== "ready"
                        ? "AI gates pending"
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
