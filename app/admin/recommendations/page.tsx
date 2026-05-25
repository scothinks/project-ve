import {
  AdminCard,
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import {
  addRecommendationItem,
  createDefaultRecommendationSections,
  deleteRecommendationItem,
  saveRecommendationSection,
  setRecommendationSectionStatus,
} from "@/app/admin/recommendations/actions";
import {
  getAdminCourses,
  getAdminLessons,
  getAdminRecommendationSections,
  requireAdmin,
  type AdminRecommendationSection,
} from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function toDateTimeInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function itemCountLabel(section: AdminRecommendationSection) {
  const count = section.items.length;
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function previewCountLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function SectionForm({
  nextSortOrder,
  section,
}: {
  nextSortOrder: number;
  section?: AdminRecommendationSection;
}) {
  return (
    <form action={saveRecommendationSection} className="grid gap-4 md:grid-cols-2">
      <input name="sectionId" type="hidden" value={section?.id ?? ""} />
      <label>
        <span className={labelClasses()}>Title</span>
        <input className={fieldClasses()} name="title" required defaultValue={section?.title ?? ""} />
      </label>
      <label>
        <span className={labelClasses()}>Eyebrow</span>
        <input className={fieldClasses()} name="eyebrow" defaultValue={section?.eyebrow ?? ""} />
      </label>
      <label className="md:col-span-2">
        <span className={labelClasses()}>Subtitle</span>
        <input className={fieldClasses()} name="subtitle" defaultValue={section?.subtitle ?? ""} />
      </label>
      <label>
        <span className={labelClasses()}>Status</span>
        <select className={fieldClasses()} name="status" defaultValue={section?.status ?? "draft"}>
          <option value="draft">Disabled</option>
          <option value="published">Enabled</option>
        </select>
      </label>
      <label>
        <span className={labelClasses()}>Order</span>
        <input
          className={fieldClasses()}
          name="sortOrder"
          type="number"
          defaultValue={section?.sort_order ?? nextSortOrder}
        />
      </label>
      <label>
        <span className={labelClasses()}>Starts</span>
        <input
          className={fieldClasses()}
          name="startsAt"
          type="datetime-local"
          defaultValue={toDateTimeInputValue(section?.starts_at ?? null)}
        />
      </label>
      <label>
        <span className={labelClasses()}>Ends</span>
        <input
          className={fieldClasses()}
          name="endsAt"
          type="datetime-local"
          defaultValue={toDateTimeInputValue(section?.ends_at ?? null)}
        />
      </label>
      <div className="md:col-span-2">
        <button
          className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white"
          type="submit"
        >
          {section ? "Save section" : "Create section"}
        </button>
      </div>
    </form>
  );
}

export default async function AdminRecommendationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ sectionsPage?: string; notice?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { sectionsPage, notice } = (await searchParams) ?? {};
  const [sections, courses, lessons] = await Promise.all([
    getAdminRecommendationSections(supabase),
    getAdminCourses(supabase),
    getAdminLessons(supabase),
  ]);
  const selectableItems = [
    ...courses.map((course) => ({
      label: `Course - ${course.title}`,
      value: `course:${course.id}`,
    })),
    ...lessons.map((lesson) => ({
      label: `Lesson - ${lesson.title}`,
      value: `lesson:${lesson.id}`,
    })),
  ];
  const nextSortOrder =
    sections.reduce((highest, section) => Math.max(highest, section.sort_order), 0) + 1;
  const paginatedSections = paginateItems(sections, parsePageParam(sectionsPage), 8);
  const starterCourse = courses[0] ?? null;
  const starterLessons = starterCourse
    ? lessons
        .filter((lesson) => lesson.course_id === starterCourse.id)
        .sort((first, second) => first.sort_order - second.sort_order)
    : [];

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Home"
        title="Recommendations"
        subtitle="Configure the editorial sections learners see on the home screen. User-state personalization comes later."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <AdminCard>
          <h2 className="mb-1 text-lg font-black">Add section</h2>
          <p className="mb-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            Start with simple dashboard groups like Starter Pack or Focus of the Week.
          </p>
          <SectionForm nextSortOrder={nextSortOrder} />
        </AdminCard>

        <div className="space-y-4">
          {sections.length === 0 ? (
            <>
              <AdminCard>
                <h2 className="text-lg font-black">Default section preview</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                  No recommendation rows exist yet, so these sections are not saved yet. This is
                  the current default setup the tutor can create and then edit.
                </p>
                <form action={createDefaultRecommendationSections} className="mt-4">
                  <button
                    className="rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-xs font-black text-white"
                    type="submit"
                  >
                    Create default sections
                  </button>
                </form>
              </AdminCard>

              <AdminCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                      Starter Pack
                    </p>
                    <h2 className="mt-1 text-xl font-black">Start Learning</h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                      Begin with practical values lessons learners can use right away.
                    </p>
                  </div>
                  <AdminStatusBadge tone="good">Default</AdminStatusBadge>
                </div>
                <div className="mt-4 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                    Assigned lessons
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
                    {previewCountLabel(starterLessons.length)}
                  </p>
                  {starterLessons.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {starterLessons.map((lesson) => (
                        <div
                          className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-4 py-3"
                          key={lesson.id}
                        >
                          <p className="text-sm font-black">{lesson.title}</p>
                          <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
                            Lesson - {lesson.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-[var(--ve-muted)]">
                      No lessons available in the first course yet.
                    </p>
                  )}
                </div>
              </AdminCard>

              <AdminCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                      Focus Area
                    </p>
                    <h2 className="mt-1 text-xl font-black">Browse Courses</h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                      Keep this empty until a tutor deliberately curates the courses that belong
                      in focus.
                    </p>
                  </div>
                  <AdminStatusBadge tone="good">Default</AdminStatusBadge>
                </div>
                <div className="mt-4 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                    Assigned courses
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
                    0 items
                  </p>
                  <p className="mt-3 text-xs font-bold text-[var(--ve-muted)]">
                    No courses are assigned by default. Add them manually after review.
                  </p>
                </div>
              </AdminCard>
            </>
          ) : (
            <>
              <AdminCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">Existing sections</h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                      Each section below accepts courses or lessons. Assignment happens inside the
                      section card.
                    </p>
                  </div>
                  <form action={createDefaultRecommendationSections}>
                    <button
                      className="rounded-[12px] bg-[var(--ve-panel)] px-4 py-2 text-xs font-black text-[var(--ve-muted-strong)]"
                      type="submit"
                    >
                      Reset defaults
                    </button>
                  </form>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {paginatedSections.items.map((section) => (
                    <a
                      className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-4"
                      href={`#${section.id}`}
                      key={`${section.id}-summary`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                            {section.eyebrow ?? "Recommendation"}
                          </p>
                          <h3 className="mt-1 text-base font-black">{section.title}</h3>
                        </div>
                        <AdminStatusBadge tone={statusTone(section.status)}>
                          {section.status === "published" ? "Enabled" : "Disabled"}
                        </AdminStatusBadge>
                      </div>
                      <p className="mt-2 text-xs font-bold text-[var(--ve-muted)]">
                        {itemCountLabel(section)}
                      </p>
                    </a>
                  ))}
                </div>
                <AdminPagination
                  basePath="/admin/recommendations"
                  currentPage={paginatedSections.currentPage}
                  summary={`Showing ${paginatedSections.startItem}-${paginatedSections.endItem} of ${paginatedSections.totalItems} recommendation sections`}
                  totalPages={paginatedSections.totalPages}
                />
              </AdminCard>

              {paginatedSections.items.map((section) => (
                <AdminCard key={section.id}>
                  <div id={section.id} className="flex flex-wrap items-start justify-between gap-3 scroll-mt-24">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                        {section.eyebrow ?? "Recommendation"}
                      </p>
                      <h2 className="mt-1 text-xl font-black">{section.title}</h2>
                      {section.subtitle ? (
                        <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                          {section.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <AdminStatusBadge tone={statusTone(section.status)}>
                        {section.status === "published" ? "Enabled" : "Disabled"}
                      </AdminStatusBadge>
                      <form action={setRecommendationSectionStatus}>
                        <input name="sectionId" type="hidden" value={section.id} />
                        <input
                          name="status"
                          type="hidden"
                          value={section.status === "published" ? "draft" : "published"}
                        />
                        <button
                          className={
                            section.status === "published"
                              ? "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)]"
                              : "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-green)]"
                          }
                          type="submit"
                        >
                          {section.status === "published" ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </div>
                  </div>

                  <details className="mt-5 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
                    <summary className="cursor-pointer text-sm font-black">Edit section</summary>
                    <div className="mt-4">
                      <SectionForm nextSortOrder={nextSortOrder} section={section} />
                    </div>
                  </details>

                  <div className="mt-5">
                    <h3 className="text-sm font-black">Assigned items</h3>
                    {section.items.length === 0 ? (
                      <p className="mt-2 rounded-[14px] bg-[var(--ve-panel)] px-4 py-3 text-xs font-bold text-[var(--ve-muted)]">
                        No items yet. Add courses or lessons below.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {section.items.map((item) => (
                          <div
                            className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-4 py-3"
                            key={item.id}
                          >
                            <div>
                              <p className="text-sm font-black">{item.label}</p>
                              <p className="mt-1 text-xs font-bold capitalize text-[var(--ve-muted)]">
                                {item.item_type} - {item.status}
                              </p>
                            </div>
                            <form action={deleteRecommendationItem}>
                              <input name="itemId" type="hidden" value={item.id} />
                              <button
                                className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)]"
                                type="submit"
                              >
                                Remove
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectableItems.length === 0 ? (
                      <EmptyAdminState>No courses or lessons available to assign yet.</EmptyAdminState>
                    ) : (
                      <form
                        action={addRecommendationItem}
                        className="mt-4 grid gap-3 md:grid-cols-[1fr_7rem_auto]"
                      >
                        <input name="sectionId" type="hidden" value={section.id} />
                        <label>
                          <span className={labelClasses()}>Assign course or lesson</span>
                          <select className={fieldClasses()} name="itemRef" required>
                            <option value="">Select item</option>
                            {selectableItems.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className={labelClasses()}>Order</span>
                          <input
                            className={fieldClasses()}
                            name="sortOrder"
                            type="number"
                            defaultValue={section.items.length + 1}
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            className="h-10 rounded-[12px] bg-[var(--ve-green)] px-4 text-xs font-black text-white"
                            type="submit"
                          >
                            Add item
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </AdminCard>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
