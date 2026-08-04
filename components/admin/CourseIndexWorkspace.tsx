"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Select from "@radix-ui/react-select";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  AdminPagination,
  AdminStatusBadge,
  EmptyAdminState,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { duplicateCourseShell, setCourseStatus } from "@/app/admin/courses/actions";
import { formatRewardDate } from "@/lib/rewards";

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
const columnHelper = createColumnHelper<CourseIndexCourse>();

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "draft") return "warning" as const;
  if (status === "archived") return "danger" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "draft") return "Draft";
  if (status === "archived") return "Archived";
  return status.replaceAll("_", " ");
}

function catalogScopeLabel(scope: string) {
  if (scope === "platform") return "Platform";
  if (scope === "organization_private") return "Private";
  if (scope === "adapted_platform") return "Adapted";
  return scope.replaceAll("_", " ");
}

function catalogScopeTone(scope: string) {
  if (scope === "organization_private") return "warning" as const;
  if (scope === "adapted_platform") return "store" as const;
  return "neutral" as const;
}

function readinessTone(course: CourseIndexCourse) {
  if ((course.readiness_issues ?? []).length > 0) return "warning" as const;
  if (course.status === "published") return "good" as const;
  return "neutral" as const;
}

function readinessLabel(course: CourseIndexCourse) {
  if ((course.readiness_issues ?? []).length > 0) return "Needs attention";
  if (course.status === "published") return "Published";
  return "Ready draft";
}

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

function selectLabel(
  value: string,
  options: Array<{ label: string; value: string }>,
) {
  return options.find((option) => option.value === value)?.label ?? "All";
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
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
        {label}
      </span>
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger className="mt-2 flex min-h-11 w-full items-center justify-between rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-left text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]">
          <Select.Value>{selectLabel(value, options)}</Select.Value>
          <Select.Icon className="text-[var(--ve-muted)]">v</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="z-50 overflow-hidden rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-1 shadow-xl"
            position="popper"
            sideOffset={6}
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  className="cursor-pointer rounded-[10px] px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-[var(--ve-panel)] data-[state=checked]:text-[var(--ve-green)]"
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </label>
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link className={adminButtonClasses("primary", "px-3 text-xs")} href={`/admin/courses/${course.id}`}>
        Open workspace
      </Link>
      <AlertDialog.Root open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={`More actions for ${course.title}`}
            className={adminButtonClasses("secondary", "px-3 text-xs")}
            type="button"
          >
            More
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-56 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-2 shadow-xl"
              sideOffset={6}
            >
              <DropdownMenu.Item asChild>
                <form action={duplicateCourseShell}>
                  <input name="courseId" type="hidden" value={course.id} />
                  <PendingSubmitButton
                    className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-bold outline-none transition hover:bg-[var(--ve-panel)] focus-visible:ring-4 focus-visible:ring-[color:color-mix(in_srgb,var(--ve-green)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                    label="Duplicate course"
                    pendingLabel="Duplicating..."
                    type="submit"
                  />
                </form>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--ve-line-soft)]" />
              <DropdownMenu.Item
                className={`cursor-pointer rounded-[10px] px-3 py-2 text-sm font-bold outline-none transition hover:bg-[var(--ve-panel)] focus-visible:ring-4 ${
                  isDisabling
                    ? "text-[var(--ve-danger)] focus-visible:ring-[color:color-mix(in_srgb,var(--ve-danger)_14%,transparent)]"
                    : "text-[var(--ve-green)] focus-visible:ring-[color:color-mix(in_srgb,var(--ve-green)_14%,transparent)]"
                }`}
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
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-5 shadow-xl">
            <AlertDialog.Title className="text-lg font-black">
              {isDisabling ? "Disable published course?" : "Enable course?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              {isDisabling
                ? `"${course.title}" will move back to draft and no longer appear as a published course.`
                : `"${course.title}" will be moved to published status. Review readiness before enabling learner access.`}
            </AlertDialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel className={adminButtonClasses("secondary")} type="button">
                Cancel
              </AlertDialog.Cancel>
              <form action={setCourseStatus}>
                <input name="courseId" type="hidden" value={course.id} />
                <input name="redirectTo" type="hidden" value={currentHref} />
                <input name="status" type="hidden" value={nextStatus} />
                <PendingSubmitButton
                  className={adminButtonClasses(isDisabling ? "danger" : "primary")}
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

export function CourseIndexWorkspace({
  categories,
  courses,
  currentHref,
  filters,
  levels,
  pagination,
  templateCourses,
  totalCourseCount,
}: {
  categories: string[];
  courses: CourseIndexCourse[];
  currentHref: string;
  filters: CourseIndexFilters;
  levels: string[];
  pagination: PaginationProps;
  templateCourses: CourseIndexCourse[];
  totalCourseCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query);
  const [status, setStatus] = useState(filters.status || allValue);
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

  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Course",
        cell: (info) => {
          const course = info.row.original;

          return (
            <div className="min-w-[280px]">
              <Link className="font-black hover:text-[var(--ve-green)]" href={`/admin/courses/${course.id}`}>
                {course.title}
              </Link>
              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{course.slug}</p>
              {course.source_course_id ? (
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                  Adapted from {course.source_course_id}
                </p>
              ) : null}
              <p className="mt-2 line-clamp-2 max-w-md text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
                {course.description || "No course promise added yet."}
              </p>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "scope",
        header: "Scope",
        cell: (info) => {
          const course = info.row.original;

          return (
            <div className="min-w-[150px]">
              <AdminStatusBadge tone={catalogScopeTone(course.catalog_scope)}>
                {catalogScopeLabel(course.catalog_scope)}
              </AdminStatusBadge>
              {course.catalog_scope === "adapted_platform" ? (
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {course.upstream_update_available
                    ? "Update available"
                    : `Source v${course.source_catalog_version ?? "unknown"}`}
                </p>
              ) : null}
              {course.catalog_scope !== "platform" && course.organization_id ? (
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Organisation owned
                </p>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "metadata",
        header: "Category and level",
        cell: (info) => {
          const course = info.row.original;

          return (
            <div className="min-w-[170px]">
              <p className="font-bold">{course.category || "Uncategorised"}</p>
              <p className="mt-1 text-xs font-black capitalize text-[var(--ve-muted)]">{course.level}</p>
            </div>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: "Editorial status",
        cell: (info) => (
          <AdminStatusBadge tone={statusTone(info.getValue())}>{statusLabel(info.getValue())}</AdminStatusBadge>
        ),
      }),
      columnHelper.display({
        id: "lessons",
        header: "Lessons",
        cell: (info) => {
          const course = info.row.original;

          return (
            <div className="whitespace-nowrap">
              <p className="font-black tabular-nums">{course.lesson_count ?? 0}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                {course.estimated_minutes} min
              </p>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "readiness",
        header: "Readiness",
        cell: (info) => {
          const course = info.row.original;
          const issues = course.readiness_issues ?? [];

          return (
            <div className="min-w-[220px]">
              <AdminStatusBadge tone={readinessTone(course)}>{readinessLabel(course)}</AdminStatusBadge>
              {issues.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {issues.slice(0, 2).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                  {issues.length > 2 ? <li>{issues.length - 2} more issue(s)</li> : null}
                </ul>
              ) : (
                <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">No obvious blockers.</p>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("updated_at", {
        header: "Last updated",
        cell: (info) => (
          <span className="whitespace-nowrap text-sm font-bold">{formatRewardDate(info.getValue())}</span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <CourseActions course={info.row.original} currentHref={currentHref} />
        ),
      }),
    ],
    [currentHref],
  );

  const table = useReactTable({
    data: courses,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  function applyFilters() {
    startTransition(() => {
      router.push(buildCoursesHref({ category, level, query, sort, status }));
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  const filterSearchParams = {
    category: filters.category === allValue ? undefined : filters.category,
    level: filters.level === allValue ? undefined : filters.level,
    query: filters.query || undefined,
    sort: filters.sort || undefined,
    status: filters.status === allValue ? undefined : filters.status,
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-[var(--foreground)]">
            {pagination.totalItems} matching course{pagination.totalItems === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
            {totalCourseCount} total in the Project VE platform catalogue.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Start blank</p>
          <h2 className="mt-2 text-lg font-black">Create a course setup</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Begin with title, promise, category, thumbnail, lessons, pages and assessment.
          </p>
          <Link className={adminButtonClasses("primary", "mt-4 px-3 text-xs")} href="/admin/courses/new">
            Start blank
          </Link>
        </div>

        <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Use a template</p>
          <h2 className="mt-2 text-lg font-black">Duplicate an existing course</h2>
          <form action={duplicateCourseShell} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Source course</span>
              <select className="mt-2 min-h-11 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-sm font-bold" name="courseId" required>
                <option value="">Choose source</option>
                {templateCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">New title</span>
              <input
                className="mt-2 min-h-11 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-sm font-bold"
                name="templateTitle"
                placeholder="Copy of source title"
              />
            </label>
            <PendingSubmitButton
              className={adminButtonClasses("secondary", "px-3 text-xs")}
              label="Use template"
              pendingLabel="Duplicating..."
              type="submit"
            />
          </form>
        </div>

        <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Create with AI</p>
          <h2 className="mt-2 text-lg font-black">Plan before generating</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Capture the need, audience and outcomes, review the proposed curriculum, then create the course.
          </p>
          <Link className={adminButtonClasses("success", "mt-4 px-3 text-xs")} href="/admin/courses/ai/planner">
            Create with AI
          </Link>
        </div>
      </div>

      <form
        className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(150px,1fr))_auto] xl:items-end">
          <label>
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
              Search
            </span>
            <input
              className="mt-2 min-h-11 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 text-sm font-bold outline-none transition placeholder:text-[var(--ve-muted)] focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, slug, category, or description"
              type="search"
              value={query}
            />
          </label>
          <FilterSelect
            label="Status"
            onChange={setStatus}
            options={[
              { label: "All statuses", value: allValue },
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
              { label: "Archived", value: "archived" },
            ]}
            value={status}
          />
          <FilterSelect
            label="Category"
            onChange={setCategory}
            options={categoryOptions}
            value={category}
          />
          <FilterSelect
            label="Level"
            onChange={setLevel}
            options={levelOptions}
            value={level}
          />
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
          <div className="flex gap-2">
            <button className={adminButtonClasses("primary", "px-3 text-xs")} disabled={isPending} type="submit">
              {isPending ? "Applying..." : "Apply"}
            </button>
            <Link className={adminButtonClasses("secondary", "px-3 text-xs")} href="/admin/courses">
              Reset
            </Link>
          </div>
        </div>
      </form>

      {courses.length === 0 ? (
        <EmptyAdminState>No courses match the current filters.</EmptyAdminState>
      ) : (
        <>
          <div className="overflow-hidden rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-[var(--ve-panel)] text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th className="whitespace-nowrap px-4 py-3" key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-[var(--ve-line-soft)]">
                  {table.getRowModel().rows.map((row) => (
                    <tr className="align-top hover:bg-[var(--ve-panel)]/60" key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td className="px-4 py-4" key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <AdminPagination
            basePath="/admin/courses"
            currentPage={pagination.currentPage}
            searchParams={filterSearchParams}
            summary={`Showing ${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems} courses`}
            totalPages={pagination.totalPages}
          />
        </>
      )}
    </section>
  );
}
