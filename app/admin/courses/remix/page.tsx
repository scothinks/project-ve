import Image from "@/components/media/MediaImage";
import Link from "next/link";
import { duplicateCourseShell } from "@/app/admin/courses/actions";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { coverAccent } from "@/lib/gradient-accent";
import { getImageFitClass, getImagePresentationStyle } from "@/lib/image-presentation";
import { getAdminCourses, requireAdmin } from "@/lib/admin";

export default async function RemixCoursePage() {
  const { supabase } = await requireAdmin();
  const courses = await getAdminCourses(supabase);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-10">
      <div>
        <Link
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)]"
          href="/admin/courses/choose"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--ui-warning)]">
          Remix a course
        </p>
        <h1 className="mt-2.5 text-[32px] font-black leading-[1.15] tracking-[-0.01em] text-[var(--ui-text)]">
          Which course do you want to remix?
        </h1>
        <p className="mt-2.5 max-w-[520px] text-[15px] font-medium leading-[1.6] text-[var(--ui-text-muted)]">
          We&apos;ll copy its structure so you can adjust it without starting from zero.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {courses.map((course) => {
          const thumbnailUrl = typeof course.thumbnail?.url === "string" ? course.thumbnail.url : null;
          const thumbnailAlt = typeof course.thumbnail?.altText === "string" ? course.thumbnail.altText : course.title;

          return (
            <form action={duplicateCourseShell} key={course.id}>
              <input name="courseId" type="hidden" value={course.id} />
              <PendingSubmitButton
                className="flex w-full flex-col overflow-hidden rounded-[20px] border-[1.5px] border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-0 text-left transition hover:border-[var(--ui-action)] disabled:cursor-not-allowed disabled:opacity-60"
                label={
                  <>
                    <div
                      className="relative flex h-[110px] items-center justify-center"
                      style={{ background: thumbnailUrl ? undefined : `linear-gradient(135deg, ${coverAccent(course.id)})` }}
                    >
                      {thumbnailUrl ? (
                        <Image
                          alt={thumbnailAlt}
                          className={getImageFitClass(course.thumbnail as { fit?: string | null })}
                          fill
                          sizes="(min-width: 1024px) 360px, 100vw"
                          src={thumbnailUrl}
                          style={getImagePresentationStyle(course.thumbnail as { positionX?: number | null; positionY?: number | null })}
                        />
                      ) : (
                        <span className="text-[26px] font-black text-[var(--ui-text)]">{course.title.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 px-[18px] pb-[18px] pt-4">
                      <h3 className="text-[15px] font-extrabold leading-[1.3] text-[var(--ui-text)]">{course.title}</h3>
                      <p className="text-xs font-semibold text-[var(--ui-text-muted)]">
                        {course.lesson_count ?? 0} lessons
                      </p>
                    </div>
                  </>
                }
                pendingLabel="Duplicating…"
                type="submit"
              />
            </form>
          );
        })}
      </div>
    </div>
  );
}
