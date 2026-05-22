import type { ReactNode } from "react";
import type {
  AdminCourseRow,
  AdminLessonBlockRow,
  AdminLessonPageRow,
  AdminLessonRow,
  AdminQuizQuestionRow,
  AdminQuizRow,
} from "@/lib/admin";
import {
  saveCourse,
  saveLesson,
  saveLessonBlock,
  saveLessonPage,
  saveQuizQuestion,
  saveQuizSettings,
} from "@/app/admin/courses/actions";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#087f5b] focus:ring-4 focus:ring-[#087f5b]/10";
}

function compactFieldClasses() {
  return "mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold outline-none transition focus:border-[#087f5b] focus:ring-4 focus:ring-[#087f5b]/10";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function helperTextClasses() {
  return "mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]";
}

function getImageValue(image: Record<string, unknown> | null | undefined, key: "src" | "alt") {
  const value = image?.[key];
  return typeof value === "string" ? value : "";
}

function FormSection({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="group rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-5" open={defaultOpen}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-black">{title}</h3>
              {subtitle ? (
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">{subtitle}</p>
              ) : null}
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ve-panel)] text-sm font-black text-[#5f5f5a] transition group-open:rotate-180">
              ˅
            </span>
          </div>
        </summary>
        <div className="mt-4">{children}</div>
      </details>
    );
  }

  return (
    <section className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-5">
      <div className="mb-4">
        <h3 className="text-base font-black">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TutorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[16px] bg-[#f1f7f4] px-4 py-3 text-xs font-bold leading-5 text-[#315447]">
      {children}
    </div>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button className="rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white" type="submit">
      {children}
    </button>
  );
}

function HiddenBlockFields({
  lessonId,
  block,
}: {
  lessonId: string;
  block: AdminLessonBlockRow;
}) {
  return (
    <>
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="blockId" type="hidden" value={block.id} />
      <input name="pageId" type="hidden" value={block.page_id} />
      <input name="blockType" type="hidden" value={block.block_type} />
      <input name="sortOrder" type="hidden" value={block.sort_order} />
    </>
  );
}

function CoursePreview({
  course,
  estimatedMinutes,
}: {
  course?: AdminCourseRow | null;
  estimatedMinutes: number;
}) {
  return (
    <aside className="rounded-[22px] border border-[#e3efe9] bg-[#f6fbf8] p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#087f5b]">
        Learner card preview
      </p>
      <div className="mt-4 overflow-hidden rounded-[18px] bg-[var(--ve-card)] shadow-sm">
        <div className="h-28 bg-[#dff2e9]">
          {getImageValue(course?.thumbnail, "src") ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              src={getImageValue(course?.thumbnail, "src")}
            />
          ) : null}
        </div>
        <div className="p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#087f5b]">
            {course?.category ?? "Values Education"}
          </p>
          <h4 className="mt-2 text-lg font-black leading-6">
            {course?.title ?? "Course title"}
          </h4>
          <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            {course?.description ?? "Short learner-facing course description."}
          </p>
          <p className="mt-3 text-[11px] font-black text-[var(--ve-muted)]">
            {estimatedMinutes} min from lessons
          </p>
        </div>
      </div>
    </aside>
  );
}

export function CourseForm({
  categories = [],
  course,
  derivedMinutes,
  nextSortOrder = 0,
}: {
  categories?: string[];
  course?: AdminCourseRow | null;
  derivedMinutes?: number;
  nextSortOrder?: number;
}) {
  const estimatedMinutes = derivedMinutes ?? course?.estimated_minutes ?? 0;
  const sortOrder = course?.sort_order ?? nextSortOrder;
  const categoryOptions = Array.from(
    new Set([
      course?.category,
      "Values Education",
      ...categories,
    ].filter(Boolean) as string[]),
  );

  return (
    <form action={saveCourse} className="space-y-5">
      <input name="courseId" type="hidden" value={course?.id ?? ""} />
      <input name="sortOrder" type="hidden" value={sortOrder} />
      <input name="estimatedMinutes" type="hidden" value={estimatedMinutes} />
      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <FormSection
            collapsible
            defaultOpen={!course?.id}
            title="Course identity"
            subtitle="Set the promise of the course in language a tutor and learner can quickly understand."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Title</span>
                <input className={fieldClasses()} name="title" required defaultValue={course?.title ?? ""} />
              </label>
              <label>
                <span className={labelClasses()}>Category</span>
                <input
                  className={fieldClasses()}
                  defaultValue={course?.category ?? "Values Education"}
                  list="course-category-options"
                  name="category"
                  required
                />
                <datalist id="course-category-options">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
                <p className={helperTextClasses()}>
                  Select an existing category or type a new one.
                </p>
              </label>
            </div>
            <label className="mt-4 block">
              <span className={labelClasses()}>Description</span>
              <textarea className={`${fieldClasses()} min-h-28 resize-none`} name="description" required defaultValue={course?.description ?? ""} />
              <p className={helperTextClasses()}>Keep this direct. It appears on course cards and discovery surfaces.</p>
            </label>
          </FormSection>

          <FormSection
            title="Publishing and pacing"
            subtitle="Course duration is derived from the lesson estimates in this course."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                <span className={labelClasses()}>Level</span>
                <select className={fieldClasses()} name="level" defaultValue={course?.level ?? "beginner"}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label>
                <span className={labelClasses()}>Status</span>
                <select className={fieldClasses()} name="status" defaultValue={course?.status ?? "draft"}>
                  <option value="draft">Draft</option>
                  <option disabled={Boolean(course?.ai_generated && course.status !== "published")} value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                {course?.ai_generated ? (
                  <p className={helperTextClasses()}>
                    AI-generated courses publish through the workflow panel after text and media approval.
                  </p>
                ) : null}
              </label>
              <div className="rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3">
                <span className={labelClasses()}>Minutes</span>
                <p className="mt-2 text-sm font-black tabular-nums">{estimatedMinutes}</p>
                <p className="mt-1 text-[11px] font-bold text-[var(--ve-muted)]">From lesson estimates</p>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Course thumbnail"
            subtitle="Use a warm, real image that tells the learner what kind of values practice this course contains."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Thumbnail URL</span>
                <input className={fieldClasses()} name="thumbnailUrl" defaultValue={getImageValue(course?.thumbnail, "src")} />
              </label>
              <label>
                <span className={labelClasses()}>Thumbnail alt</span>
                <input className={fieldClasses()} name="thumbnailAlt" defaultValue={getImageValue(course?.thumbnail, "alt")} />
              </label>
            </div>
          </FormSection>
        </div>
        <CoursePreview course={course} estimatedMinutes={estimatedMinutes} />
      </div>
      <SubmitButton>Save course</SubmitButton>
    </form>
  );
}

export function LessonForm({
  lesson,
  courseId,
}: {
  lesson?: AdminLessonRow | null;
  courseId: string;
}) {
  return (
    <form action={saveLesson} className="space-y-5">
      <input name="lessonId" type="hidden" value={lesson?.id ?? ""} />
      <input name="courseId" type="hidden" value={lesson?.course_id ?? courseId} />

      <FormSection
        title="Lesson setup"
        subtitle="A lesson is the teachable unit. Pages carry the actual sub-lessons, examples, media, and reflection prompts."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Title</span>
            <input className={fieldClasses()} name="title" required defaultValue={lesson?.title ?? ""} />
          </label>
          <label>
            <span className={labelClasses()}>Status</span>
            <select className={fieldClasses()} name="status" defaultValue={lesson?.status ?? "draft"}>
              <option value="draft">Draft</option>
              <option disabled={Boolean(lesson?.ai_generated && lesson.status !== "published")} value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            {lesson?.ai_generated ? (
              <p className={helperTextClasses()}>
                AI-generated lessons publish from the parent course workflow after text and media approval.
              </p>
            ) : null}
          </label>
        </div>
        <label className="mt-4 block">
          <span className={labelClasses()}>Learner summary</span>
          <textarea className={`${fieldClasses()} min-h-24 resize-none`} name="description" defaultValue={lesson?.description ?? ""} />
        </label>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Sort order</span>
            <input className={fieldClasses()} name="sortOrder" type="number" defaultValue={lesson?.sort_order ?? 0} />
          </label>
          <label>
            <span className={labelClasses()}>Minutes</span>
            <input className={fieldClasses()} min={0} name="estimatedMinutes" type="number" defaultValue={lesson?.estimated_minutes ?? 0} />
          </label>
        </div>
      </FormSection>

      <FormSection title="Cover image">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Cover image URL</span>
            <input className={fieldClasses()} name="coverImageUrl" defaultValue={getImageValue(lesson?.cover_image, "src")} />
          </label>
          <label>
            <span className={labelClasses()}>Cover image alt</span>
            <input className={fieldClasses()} name="coverImageAlt" defaultValue={getImageValue(lesson?.cover_image, "alt")} />
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Quiz access and retry rules"
        subtitle="These rules protect XP earning while still allowing practice and rereading."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <label>
            <span className={labelClasses()}>Retry mode</span>
            <select className={fieldClasses()} name="retryMode" defaultValue={lesson?.retry_mode ?? "anytime"}>
              <option value="anytime">Anytime</option>
              <option value="cooldown">Cooldown</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label>
            <span className={labelClasses()}>Cooldown seconds</span>
            <input className={fieldClasses()} min={0} name="retryCooldownSeconds" type="number" defaultValue={lesson?.retry_cooldown_seconds ?? ""} />
          </label>
          <label>
            <span className={labelClasses()}>Rewarded attempts</span>
            <input className={fieldClasses()} min={1} name="maxEarningAttempts" type="number" defaultValue={lesson?.max_earning_attempts ?? ""} />
          </label>
          <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
            <label className="flex items-start gap-3 text-sm font-black">
              <input className="mt-1" name="retryRequiresReread" type="checkbox" defaultChecked={lesson?.retry_requires_reread ?? true} />
              <span>
                Must reread
                <span className="block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Retrying requires all pages again.
                </span>
              </span>
            </label>
          </div>
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-[16px] bg-[var(--ve-panel)] p-4 text-sm font-black">
          <input className="mt-1" name="quizRequiresLessonCompletion" type="checkbox" defaultChecked={lesson?.quiz_requires_lesson_completion ?? true} />
          <span>
            Quiz requires lesson completion
            <span className="block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Learners must read every page before the quiz becomes available.
            </span>
          </span>
        </label>
      </FormSection>

      <SubmitButton>Save lesson</SubmitButton>
    </form>
  );
}

export function LessonPageForm({
  lessonId,
  page,
  defaultPageNumber,
}: {
  lessonId: string;
  page?: AdminLessonPageRow | null;
  defaultPageNumber?: number;
}) {
  return (
    <form action={saveLessonPage} className="space-y-4">
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="pageId" type="hidden" value={page?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
        <label>
          <span className={labelClasses()}>Page title</span>
          <input className={compactFieldClasses()} name="title" required defaultValue={page?.title ?? ""} />
        </label>
        <label>
          <span className={labelClasses()}>Number</span>
          <input className={compactFieldClasses()} min={1} name="pageNumber" required type="number" defaultValue={page?.page_number ?? defaultPageNumber ?? 1} />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Subtitle</span>
          <input className={compactFieldClasses()} name="subtitle" defaultValue={page?.subtitle ?? ""} />
        </label>
        <label>
          <span className={labelClasses()}>Page type</span>
          <select className={compactFieldClasses()} name="pageType" defaultValue={page?.page_type ?? "concept"}>
            <option value="primer">Primer</option>
            <option value="concept">Concept</option>
            <option value="example">Example</option>
            <option value="reflection">Reflection</option>
            <option value="summary">Summary</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Page image URL</span>
          <input className={compactFieldClasses()} name="coverImageUrl" defaultValue={getImageValue(page?.cover_image, "src")} />
        </label>
        <label>
          <span className={labelClasses()}>Page image alt</span>
          <input className={compactFieldClasses()} name="coverImageAlt" defaultValue={getImageValue(page?.cover_image, "alt")} />
        </label>
      </div>
      <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
        Save page
      </button>
    </form>
  );
}

export function LessonBlockForm({
  lessonId,
  pages,
  block,
  defaultSortOrder,
}: {
  lessonId: string;
  pages: AdminLessonPageRow[];
  block?: AdminLessonBlockRow | null;
  defaultSortOrder?: number;
}) {
  return (
    <form action={saveLessonBlock} className="space-y-4">
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="blockId" type="hidden" value={block?.id ?? ""} />
      <TutorNote>
        Choose the block type first, then fill only the fields that apply. Table rows use one row per line and comma-separated cells.
      </TutorNote>
      <div className="grid gap-3 md:grid-cols-4">
        <label>
          <span className={labelClasses()}>Page</span>
          <select className={compactFieldClasses()} name="pageId" required defaultValue={block?.page_id ?? ""}>
            <option value="">Select page</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>{page.page_number}. {page.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClasses()}>Type</span>
          <select className={compactFieldClasses()} name="blockType" defaultValue={block?.block_type ?? "text"}>
            <option value="text">Text</option>
            <option value="callout">Callout</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="table">Table</option>
          </select>
        </label>
        <label>
          <span className={labelClasses()}>Sort order</span>
          <input className={compactFieldClasses()} name="sortOrder" type="number" defaultValue={block?.sort_order ?? defaultSortOrder ?? 1} />
        </label>
        <label>
          <span className={labelClasses()}>Variant</span>
          <input className={compactFieldClasses()} name="variant" placeholder="key_point" defaultValue={String(block?.payload.variant ?? "")} />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Heading / title</span>
          <input className={compactFieldClasses()} name="heading" defaultValue={String(block?.payload.heading ?? block?.payload.title ?? "")} />
        </label>
        <label>
          <span className={labelClasses()}>Media URL</span>
          <input className={compactFieldClasses()} name="src" defaultValue={String(block?.payload.src ?? "")} />
        </label>
      </div>
      <label className="block">
        <span className={labelClasses()}>Body / transcript</span>
        <textarea className={`${compactFieldClasses()} min-h-24 resize-none`} name="body" defaultValue={String(block?.payload.body ?? block?.payload.transcript ?? "")} />
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label>
          <span className={labelClasses()}>Alt text</span>
          <input className={compactFieldClasses()} name="alt" defaultValue={String(block?.payload.alt ?? "")} />
        </label>
        <label>
          <span className={labelClasses()}>Caption</span>
          <input className={compactFieldClasses()} name="caption" defaultValue={String(block?.payload.caption ?? "")} />
        </label>
        <label>
          <span className={labelClasses()}>Table columns</span>
          <input className={compactFieldClasses()} name="columns" placeholder="Column 1, Column 2" defaultValue={Array.isArray(block?.payload.columns) ? block?.payload.columns.join(", ") : ""} />
        </label>
      </div>
      <label className="block">
        <span className={labelClasses()}>Table rows</span>
        <textarea
          className={`${compactFieldClasses()} min-h-24 resize-none font-mono text-xs`}
          name="rows"
          placeholder={"Value one, Value two\nAnother value, Another value"}
          defaultValue={Array.isArray(block?.payload.rows) ? block.payload.rows.map((row) => Array.isArray(row) ? row.join(", ") : String(row)).join("\n") : ""}
        />
      </label>
      <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
        Save block
      </button>
    </form>
  );
}

const blockToolbarItems = [
  { type: "text", label: "Text" },
  { type: "callout", label: "Callout" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
  { type: "audio", label: "Audio" },
  { type: "table", label: "Table" },
];

export function AddBlockToolbar({
  lessonId,
  pageId,
  nextSortOrder,
}: {
  lessonId: string;
  pageId: string;
  nextSortOrder: number;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-2">
      {blockToolbarItems.map((item) => (
        <form action={saveLessonBlock} key={item.type}>
          <input name="lessonId" type="hidden" value={lessonId} />
          <input name="blockId" type="hidden" value="" />
          <input name="pageId" type="hidden" value={pageId} />
          <input name="blockType" type="hidden" value={item.type} />
          <input name="sortOrder" type="hidden" value={nextSortOrder} />
          <input name="variant" type="hidden" value="key_point" />
          <input name="heading" type="hidden" value="" />
          <input name="body" type="hidden" value="" />
          <input name="src" type="hidden" value="" />
          <input name="alt" type="hidden" value="" />
          <input name="caption" type="hidden" value="" />
          <input name="columns" type="hidden" value="" />
          <input name="rows" type="hidden" value="" />
          <button
            className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-black transition hover:bg-[#e9f4ef] hover:text-[#087f5b]"
            type="submit"
          >
            + {item.label}
          </button>
        </form>
      ))}
    </div>
  );
}

export function ContentBlockEditor({
  lessonId,
  block,
}: {
  lessonId: string;
  block: AdminLessonBlockRow;
}) {
  const payload = block.payload ?? {};
  const title = String(payload.title ?? payload.heading ?? "");
  const body = String(payload.body ?? payload.transcript ?? "");

  if (block.block_type === "image") {
    return (
      <form action={saveLessonBlock} className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
        <HiddenBlockFields block={block} lessonId={lessonId} />
        <div className="flex items-center justify-between gap-3">
          <p className={labelClasses()}>Image block</p>
          <span className="text-xs font-black text-[var(--ve-muted)]">#{block.sort_order}</span>
        </div>
        <label className="block">
          <span className={labelClasses()}>Image URL</span>
          <input className={compactFieldClasses()} name="src" defaultValue={String(payload.src ?? "")} />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Alt text</span>
            <input className={compactFieldClasses()} name="alt" defaultValue={String(payload.alt ?? "")} />
          </label>
          <label>
            <span className={labelClasses()}>Caption</span>
            <input className={compactFieldClasses()} name="caption" defaultValue={String(payload.caption ?? "")} />
          </label>
        </div>
        <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
          Save image
        </button>
      </form>
    );
  }

  if (block.block_type === "video" || block.block_type === "audio") {
    const mediaLabel = block.block_type === "video" ? "Video" : "Audio";

    return (
      <form action={saveLessonBlock} className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
        <HiddenBlockFields block={block} lessonId={lessonId} />
        <div className="flex items-center justify-between gap-3">
          <p className={labelClasses()}>{mediaLabel} block</p>
          <span className="text-xs font-black text-[var(--ve-muted)]">#{block.sort_order}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>{mediaLabel} title</span>
            <input className={compactFieldClasses()} name="heading" defaultValue={title} />
          </label>
          <label>
            <span className={labelClasses()}>Media URL</span>
            <input className={compactFieldClasses()} name="src" defaultValue={String(payload.src ?? "")} />
          </label>
        </div>
        <label className="block">
          <span className={labelClasses()}>Transcript / notes</span>
          <textarea className={`${compactFieldClasses()} min-h-24 resize-none`} name="body" defaultValue={body} />
        </label>
        <label className="block">
          <span className={labelClasses()}>Caption</span>
          <input className={compactFieldClasses()} name="caption" defaultValue={String(payload.caption ?? "")} />
        </label>
        <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
          Save {mediaLabel.toLowerCase()}
        </button>
      </form>
    );
  }

  if (block.block_type === "table") {
    return (
      <form action={saveLessonBlock} className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
        <HiddenBlockFields block={block} lessonId={lessonId} />
        <div className="flex items-center justify-between gap-3">
          <p className={labelClasses()}>Table block</p>
          <span className="text-xs font-black text-[var(--ve-muted)]">#{block.sort_order}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Table title</span>
            <input className={compactFieldClasses()} name="heading" defaultValue={title} />
          </label>
          <label>
            <span className={labelClasses()}>Columns</span>
            <input className={compactFieldClasses()} name="columns" placeholder="Situation, Fair action" defaultValue={Array.isArray(payload.columns) ? payload.columns.join(", ") : ""} />
          </label>
        </div>
        <label className="block">
          <span className={labelClasses()}>Rows</span>
          <textarea
            className={`${compactFieldClasses()} min-h-28 resize-none font-mono text-xs`}
            name="rows"
            placeholder={"A queue is long, Wait your turn\nA teammate made a mistake, Correct kindly"}
            defaultValue={Array.isArray(payload.rows) ? payload.rows.map((row) => Array.isArray(row) ? row.join(", ") : String(row)).join("\n") : ""}
          />
        </label>
        <label className="block">
          <span className={labelClasses()}>Caption</span>
          <input className={compactFieldClasses()} name="caption" defaultValue={String(payload.caption ?? "")} />
        </label>
        <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
          Save table
        </button>
      </form>
    );
  }

  if (block.block_type === "callout") {
    return (
      <form action={saveLessonBlock} className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
        <HiddenBlockFields block={block} lessonId={lessonId} />
        <div className="flex items-center justify-between gap-3">
          <p className={labelClasses()}>Callout block</p>
          <span className="text-xs font-black text-[var(--ve-muted)]">#{block.sort_order}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
          <label>
            <span className={labelClasses()}>Variant</span>
            <select className={compactFieldClasses()} name="variant" defaultValue={String(payload.variant ?? "key_point")}>
              <option value="key_point">Key point</option>
              <option value="tip">Tip</option>
              <option value="warning">Warning</option>
              <option value="example">Example</option>
            </select>
          </label>
          <label>
            <span className={labelClasses()}>Title</span>
            <input className={compactFieldClasses()} name="heading" defaultValue={title} />
          </label>
        </div>
        <label className="block">
          <span className={labelClasses()}>Body</span>
          <textarea className={`${compactFieldClasses()} min-h-24 resize-none`} name="body" defaultValue={body} />
        </label>
        <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
          Save callout
        </button>
      </form>
    );
  }

  return (
    <form action={saveLessonBlock} className="space-y-3 rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
      <HiddenBlockFields block={block} lessonId={lessonId} />
      <div className="flex items-center justify-between gap-3">
        <p className={labelClasses()}>Text block</p>
        <span className="text-xs font-black text-[var(--ve-muted)]">#{block.sort_order}</span>
      </div>
      <label className="block">
        <span className={labelClasses()}>Heading</span>
        <input className={compactFieldClasses()} name="heading" defaultValue={title} />
      </label>
      <label className="block">
        <span className={labelClasses()}>Text</span>
        <textarea className={`${compactFieldClasses()} min-h-36 resize-none text-base leading-7`} name="body" defaultValue={body} />
      </label>
      <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
        Save text
      </button>
    </form>
  );
}

export function QuizSettingsForm({
  lessonId,
  quiz,
}: {
  lessonId: string;
  quiz: AdminQuizRow;
}) {
  return (
    <form action={saveQuizSettings} className="space-y-4">
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="quizId" type="hidden" value={quiz.id} />
      <FormSection
        title="Quiz publishing"
        subtitle="Publish the quiz only when the lesson pages and scored questions are ready for learners."
      >
        <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
          <label>
            <span className={labelClasses()}>Quiz title</span>
            <input className={fieldClasses()} name="quizTitle" required defaultValue={quiz.title} />
          </label>
          <label>
            <span className={labelClasses()}>Quiz status</span>
            <select className={fieldClasses()} name="quizStatus" defaultValue={quiz.status}>
              <option value="draft">Draft</option>
              <option disabled={Boolean(quiz.ai_generated && quiz.status !== "published")} value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <p className={helperTextClasses()}>Current version: {quiz.version}. Editing questions increments the version for future attempts.</p>
      </FormSection>
      <SubmitButton>Save quiz</SubmitButton>
    </form>
  );
}

export function QuizQuestionForm({
  lessonId,
  quiz,
  question,
  defaultQuestionOrder,
}: {
  lessonId: string;
  quiz: AdminQuizRow;
  question?: AdminQuizQuestionRow | null;
  defaultQuestionOrder?: number;
}) {
  const options = question?.options ?? [];

  return (
    <form action={saveQuizQuestion} className="space-y-4">
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="quizId" type="hidden" value={quiz.id} />
      <input name="questionId" type="hidden" value={question?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-[1fr_11rem_7rem_7rem]">
        <label>
          <span className={labelClasses()}>Question</span>
          <input className={compactFieldClasses()} name="prompt" required defaultValue={question?.prompt ?? ""} />
        </label>
        <label>
          <span className={labelClasses()}>Type</span>
          <select className={compactFieldClasses()} name="questionType" defaultValue={question?.question_type ?? "single_choice"}>
            <option value="single_choice">Single choice</option>
            <option value="multiple_choice">Multiple choice</option>
            <option value="true_false">True/false</option>
          </select>
        </label>
        <label>
          <span className={labelClasses()}>XP</span>
          <input className={compactFieldClasses()} min={1} name="xp" required type="number" defaultValue={question?.xp ?? 10} />
        </label>
        <label>
          <span className={labelClasses()}>Order</span>
          <input className={compactFieldClasses()} min={1} name="questionOrder" required type="number" defaultValue={question?.question_order ?? defaultQuestionOrder ?? 1} />
        </label>
      </div>
      <label className="block">
        <span className={labelClasses()}>Explanation</span>
        <input className={compactFieldClasses()} name="explanation" defaultValue={question?.explanation ?? ""} />
        <p className={helperTextClasses()}>Used internally for review and future feedback. We do not expose the correct answer on the result screen.</p>
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((index) => (
          <label className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4" key={index}>
            <span className={labelClasses()}>Option {index}</span>
            <input className={compactFieldClasses()} name={`option${index}`} defaultValue={options[index - 1]?.label ?? ""} />
            <span className="mt-3 flex items-center gap-2 text-xs font-bold">
              <input name={`correct${index}`} type="checkbox" defaultChecked={options[index - 1]?.is_correct ?? false} />
              Correct answer
            </span>
          </label>
        ))}
      </div>
      <button className="rounded-[12px] bg-[#087f5b] px-4 py-2 text-xs font-black text-white" type="submit">
        Save question
      </button>
    </form>
  );
}
