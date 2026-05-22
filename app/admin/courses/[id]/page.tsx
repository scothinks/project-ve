import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { saveLesson, setLessonStatus } from "@/app/admin/courses/actions";
import { CourseForm } from "@/components/admin/LearningForms";
import {
  getAdminCourse,
  getAdminCourseCategories,
  getAdminLessons,
  requireAdmin,
} from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";

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

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lessonsPage?: string; notice?: string }>;
};

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { id } = await params;
  const { lessonsPage, notice } = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [course, lessons, categories] = await Promise.all([
    getAdminCourse(supabase, id),
    getAdminLessons(supabase, { courseId: id }),
    getAdminCourseCategories(supabase),
  ]);

  if (!course) {
    notFound();
  }

  const paginatedLessons = paginateItems(lessons, parsePageParam(lessonsPage), 12);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/courses"
        backLabel="Courses"
        eyebrow="Learning"
        title={course.title}
        subtitle="Build the learner journey: course promise, lesson sequence, and publish readiness."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Lessons" value={lessons.length} />
        <AdminStatCard
          label="Published"
          tone="mission"
          value={lessons.filter((lesson) => lesson.status === "published").length}
        />
        <AdminStatCard
          label="Disabled"
          tone="warning"
          value={lessons.filter((lesson) => lesson.status === "draft").length}
        />
        <AdminCard className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Preview</p>
          <Link className="mt-3 text-sm font-black text-[#087f5b]" href={`/courses/${course.id}`}>
            Open learner course
          </Link>
        </AdminCard>
      </section>
      <AdminCard>
        <CourseForm
          categories={categories}
          course={course}
          derivedMinutes={lessons.reduce((total, lesson) => total + lesson.estimated_minutes, 0)}
        />
      </AdminCard>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <AdminCard>
          <h2 className="mb-4 text-lg font-black">Lessons</h2>
          {lessons.length === 0 ? (
            <EmptyAdminState>No lessons yet.</EmptyAdminState>
          ) : (
            <>
              <AdminTable columns={["Lesson", "Minutes", "Retry", "Status", "Action"]}>
                {paginatedLessons.items.map((lesson) => (
                  <tr key={lesson.id}>
                    <td className="min-w-[260px] px-4 py-4">
                      <Link className="font-black hover:text-[#087f5b]" href={`/admin/courses/lessons/${lesson.id}`}>
                        {lesson.title}
                      </Link>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{lesson.slug}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold">{lesson.estimated_minutes}</td>
                    <td className="whitespace-nowrap px-4 py-4 capitalize">{lesson.retry_mode}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <AdminStatusBadge tone={statusTone(lesson.status)}>{statusLabel(lesson.status)}</AdminStatusBadge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <form action={setLessonStatus}>
                        <input name="courseId" type="hidden" value={course.id} />
                        <input name="lessonId" type="hidden" value={lesson.id} />
                        <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
                        <input
                          name="status"
                          type="hidden"
                          value={lesson.status === "published" ? "draft" : "published"}
                        />
                        <button
                          className={
                            lesson.status === "published"
                              ? "rounded-[12px] bg-[#fff0f0] px-3 py-2 text-xs font-black text-[#c00000]"
                              : "rounded-[12px] bg-[#e4f4ed] px-3 py-2 text-xs font-black text-[#087f5b]"
                          }
                          type="submit"
                        >
                          {lesson.status === "published" ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </AdminTable>
              <AdminPagination
                basePath={`/admin/courses/${course.id}`}
                currentPage={paginatedLessons.currentPage}
                summary={`Showing ${paginatedLessons.startItem}-${paginatedLessons.endItem} of ${paginatedLessons.totalItems} lessons`}
                totalPages={paginatedLessons.totalPages}
              />
            </>
          )}
        </AdminCard>
        <AdminCard>
          <h2 className="mb-1 text-lg font-black">Add lesson</h2>
          <p className="mb-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            Create a blank lesson and continue in the full lesson builder.
          </p>
          <form action={saveLesson}>
            <input name="lessonId" type="hidden" value="" />
            <input name="courseId" type="hidden" value={course.id} />
            <input name="title" type="hidden" value={`Untitled lesson ${lessons.length + 1}`} />
            <input name="description" type="hidden" value="" />
            <input name="coverImageUrl" type="hidden" value="" />
            <input name="coverImageAlt" type="hidden" value="" />
            <input name="status" type="hidden" value="draft" />
            <input name="sortOrder" type="hidden" value={lessons.length + 1} />
            <input name="estimatedMinutes" type="hidden" value="0" />
            <input name="retryMode" type="hidden" value="anytime" />
            <input name="retryCooldownSeconds" type="hidden" value="" />
            <input name="retryRequiresReread" type="hidden" value="on" />
            <input name="quizRequiresLessonCompletion" type="hidden" value="on" />
            <input name="maxEarningAttempts" type="hidden" value="" />
            <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}`} />
            <button
              className="inline-flex w-full items-center justify-center rounded-[14px] bg-[#087f5b] px-4 py-3 text-sm font-black text-white transition hover:bg-[#066f4f]"
              type="submit"
            >
              + Add lesson
            </button>
          </form>
        </AdminCard>
      </section>
    </>
  );
}
