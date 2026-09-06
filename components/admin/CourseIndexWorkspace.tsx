"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import { AdminCourseCard, AdminCourseCardGrid } from "@/components/admin/AdminCourseCard";
import { AdminDrawer } from "@/components/admin/AdminDialog";
import type { CourseReadinessCheck } from "@/features/learning/admin/course-readiness";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { duplicateCourseShell, setCourseStatus } from "@/app/admin/courses/actions";
import { getPaginationWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const adminPrimaryButtonClasses =
  "inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--admin-primary-container)] px-3 text-xs font-bold text-[var(--admin-on-primary)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";
const adminSecondaryButtonClasses =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-3 text-xs font-bold text-[var(--admin-on-surface)] transition hover:bg-[var(--admin-surface-container-low)] disabled:cursor-not-allowed disabled:opacity-60";
const adminDangerButtonClasses =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--admin-error)] bg-[var(--admin-surface-milk)] px-4 text-sm font-bold text-[var(--admin-error)] transition hover:bg-[var(--admin-error)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60";

export type CourseIndexCourse = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  level: string;
  status: string;
  estimated_minutes: number;
  catalog_scope: string;
  thumbnail: Record<string, unknown> | null;
  organization_id: string | null;
  source_course_id: string | null;
  source_catalog_version: number | null;
  upstream_update_available: boolean;
  catalog_version: number;
  ai_generated: boolean;
  ai_publish_status: string;
  updated_at: string;
  lesson_count?: number;
  readiness_issues?: string[];
  readiness_blockers?: CourseReadinessCheck[];
};

type CourseIndexFilters = {
  category: string;
  level: string;
  query: string;
  sort: string;
  status: string;
};

type PaginationProps = {
  currentPage: number;
  endItem: number;
  totalItems: number;
  totalPages: number;
  startItem: number;
};

const allValue = "all";

function buildCoursesHref(filters: CourseIndexFilters, page?: number) {
  const params = new URLSearchParams();

  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.status !== allValue) params.set("status", filters.status);
  if (filters.category !== allValue) params.set("category", filters.category);
  if (filters.level !== allValue) params.set("level", filters.level);
  if (filters.sort) params.set("sort", filters.sort);
  if (page && page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/courses?${query}` : "/admin/courses";
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="min-w-[160px] flex-1">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
        {label}
      </span>
      <AdminSelect className="mt-2" onValueChange={onChange} options={options} value={value} />
    </label>
  );
}

function statusPillClasses(active: boolean) {
  return cn(
    "inline-flex items-center justify-center rounded-full border px-[18px] py-[10px] text-[13px]",
    active
      ? "border-[var(--admin-primary)] bg-[color:color-mix(in_srgb,var(--admin-primary)_8%,transparent)] font-extrabold text-[var(--admin-primary)]"
      : "border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] font-bold text-[var(--admin-on-surface-variant)]",
  );
}

function CourseActions({
  course,
  currentHref,
}: {
  course: CourseIndexCourse;
  currentHref: string;
}) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const nextStatus = course.status === "published" ? "draft" : "published";
  const isDisabling = nextStatus === "draft";

  return (
    <div className="flex items-center justify-end">
      <AlertDialog.Root open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={`More actions for ${course.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition hover:bg-[var(--admin-surface-container-low)]"
            type="button"
          >
            ⋯
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-56 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-2 shadow-xl"
              sideOffset={6}
            >
              <DropdownMenu.Item asChild>
                <form action={duplicateCourseShell}>
                  <input name="courseId" type="hidden" value={course.id} />
                  <PendingSubmitButton
                    className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold text-[var(--admin-on-surface)] outline-none transition hover:bg-[var(--admin-surface-container-low)] disabled:cursor-not-allowed disabled:opacity-60"
                    label="Duplicate course"
                    pendingLabel="Duplicating..."
                    type="submit"
                  />
                </form>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--admin-border-warm)]" />
              <DropdownMenu.Item
                className={cn(
                  "cursor-pointer rounded-[10px] px-3 py-2 text-sm font-bold outline-none transition hover:bg-[var(--admin-surface-container-low)]",
                  isDisabling ? "text-[var(--admin-error)]" : "text-[var(--admin-primary)]",
                )}
                onSelect={(event) => {
                  event.preventDefault();
                  setStatusDialogOpen(true);
                }}
              >
                {isDisabling ? "Disable course" : "Enable course"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black text-[var(--admin-ink-charcoal)]">
              {isDisabling ? "Disable published course?" : "Enable course?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-on-surface-variant)]">
              {isDisabling
                ? `"${course.title}" will move back to draft and no longer appear as a published course.`
                : `"${course.title}" will be moved to published status. Review readiness before enabling learner access.`}
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className={cn(adminSecondaryButtonClasses, "min-h-10 px-4 text-sm")} type="button">
                Cancel
              </AlertDialog.Cancel>
              <form action={setCourseStatus}>
                <input name="courseId" type="hidden" value={course.id} />
                <input name="redirectTo" type="hidden" value={currentHref} />
                <input name="status" type="hidden" value={nextStatus} />
                <PendingSubmitButton
                  className={isDisabling ? adminDangerButtonClasses : cn(adminPrimaryButtonClasses, "min-h-10 px-4 text-sm")}
                  label={isDisabling ? "Disable course" : "Enable course"}
                  pendingLabel={isDisabling ? "Disabling..." : "Enabling..."}
                  type="submit"
                />
              </form>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

export function CourseSearchAndFilters({
  categories,
  filters,
  levels,
}: {
  categories: string[];
  filters: CourseIndexFilters;
  levels: string[];
}) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query);
  const [category, setCategory] = useState(filters.category || allValue);
  const [level, setLevel] = useState(filters.level || allValue);
  const [sort, setSort] = useState(filters.sort);

  const categoryOptions = useMemo(
    () => [
      { label: "All categories", value: allValue },
      ...categories.map((item) => ({ label: item, value: item })),
    ],
    [categories],
  );
  const levelOptions = useMemo(
    () => [
      { label: "All levels", value: allValue },
      ...levels.map((item) => ({ label: item, value: item })),
    ],
    [levels],
  );
  const moreActiveCount = [
    filters.category !== allValue && filters.category ? 1 : 0,
    filters.level !== allValue && filters.level ? 1 : 0,
  ].reduce((total, value) => total + value, 0);

  function goToStatus(status: string) {
    startTransition(() => {
      router.push(buildCoursesHref({ ...filters, status }));
    });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => {
      router.push(buildCoursesHref({ ...filters, query }));
    });
  }

  function handleMoreSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => {
      router.push(buildCoursesHref({ category, level, query: filters.query, sort, status: filters.status }));
    });
    setMoreOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <form className="relative max-w-[400px] flex-1 basis-[260px]" onSubmit={handleSearchSubmit}>
        <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-outline)]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="min-h-11 w-full rounded-full border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] py-[13px] pl-11 pr-4 text-sm font-semibold text-[var(--admin-on-surface)] outline-none transition focus:border-[var(--admin-primary)]"
          defaultValue={query}
          name="query"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your courses"
          type="search"
        />
      </form>
      {[
        { label: "All", value: allValue },
        { label: "Published", value: "published" },
        { label: "Draft", value: "draft" },
        { label: "Archived", value: "archived" },
      ].map((option) => (
        <button
          className={statusPillClasses((filters.status || allValue) === option.value)}
          disabled={isPending}
          key={option.value}
          onClick={() => goToStatus(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
      <AdminDrawer
        description="Narrow by category, level, or sort order."
        onOpenChange={setMoreOpen}
        open={moreOpen}
        title="More filters"
        trigger={
          <button className={adminSecondaryButtonClasses} type="button">
            More filters{moreActiveCount > 0 ? ` (${moreActiveCount})` : ""}
          </button>
        }
      >
        <form className="flex flex-col gap-5" onSubmit={handleMoreSubmit}>
          <FilterSelect label="Category" onChange={setCategory} options={categoryOptions} value={category} />
          <FilterSelect label="Level" onChange={setLevel} options={levelOptions} value={level} />
          <FilterSelect
            label="Sort"
            onChange={setSort}
            options={[
              { label: "Last updated newest", value: "updated_desc" },
              { label: "Last updated oldest", value: "updated_asc" },
              { label: "Title A-Z", value: "title_asc" },
              { label: "Title Z-A", value: "title_desc" },
            ]}
            value={sort}
          />
          <div className="flex justify-end gap-3 border-t border-[var(--admin-border-warm)] pt-4">
            <Link className={adminSecondaryButtonClasses} href="/admin/courses" onClick={() => setMoreOpen(false)}>
              Reset
            </Link>
            <button className={adminPrimaryButtonClasses} disabled={isPending} type="submit">
              {isPending ? "Applying..." : "Apply"}
            </button>
          </div>
        </form>
      </AdminDrawer>
    </div>
  );
}

export function CourseCreateButton() {
  return (
    <Link
      className="inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-[var(--admin-primary)] px-[26px] py-0 text-[15px] font-extrabold text-[var(--admin-on-primary)] shadow-[0_8px_24px_rgba(18,60,53,0.16)]"
      href="/admin/courses/choose"
    >
      <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </svg>
      New course
    </Link>
  );
}

export function CourseIndexWorkspace({
  courses,
  currentHref,
  filters,
  pagination,
}: {
  courses: CourseIndexCourse[];
  currentHref: string;
  filters: CourseIndexFilters;
  pagination: PaginationProps;
}) {
  return (
    <section className="space-y-5">
      {courses.length === 0 ? (
        <p className="rounded-[18px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] py-10 text-center text-sm font-bold text-[var(--admin-on-surface-variant)]">
          No courses match the current filters.
        </p>
      ) : (
        <>
          <AdminCourseCardGrid>
            {courses.map((course) => (
              <AdminCourseCard
                actions={<CourseActions course={course} currentHref={currentHref} />}
                course={course}
                key={course.id}
              />
            ))}
          </AdminCourseCardGrid>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
              Showing {pagination.startItem}-{pagination.endItem} of {pagination.totalItems} courses
            </p>
            {pagination.totalPages > 1 ? (
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Link
                  className={cn(
                    "rounded-[12px] border border-[var(--admin-border-warm)] px-3 py-2 text-xs font-black text-[var(--admin-on-surface)]",
                    pagination.currentPage === 1 && "pointer-events-none opacity-40",
                  )}
                  href={buildCoursesHref(filters, Math.max(1, pagination.currentPage - 1))}
                >
                  Prev
                </Link>
                {getPaginationWindow(pagination.currentPage, pagination.totalPages).map((page) => (
                  <Link
                    className={cn(
                      "rounded-[12px] border px-3 py-2 text-xs font-black",
                      page === pagination.currentPage
                        ? "border-[color:color-mix(in_srgb,var(--admin-primary-container)_30%,var(--admin-border-warm))] bg-[color:color-mix(in_srgb,var(--admin-primary-container)_12%,transparent)] text-[var(--admin-primary)]"
                        : "border-[var(--admin-border-warm)] text-[var(--admin-on-surface-variant)]",
                    )}
                    href={buildCoursesHref(filters, page)}
                    key={page}
                  >
                    {page}
                  </Link>
                ))}
                <Link
                  className={cn(
                    "rounded-[12px] border border-[var(--admin-border-warm)] px-3 py-2 text-xs font-black text-[var(--admin-on-surface)]",
                    pagination.currentPage === pagination.totalPages && "pointer-events-none opacity-40",
                  )}
                  href={buildCoursesHref(filters, Math.min(pagination.totalPages, pagination.currentPage + 1))}
                >
                  Next
                </Link>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
