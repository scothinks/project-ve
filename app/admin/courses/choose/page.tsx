import Link from "next/link";
import { getCourseAvailability } from "@/features/ai-generation/authoring/course-availability";

export default async function ChooseCourseCreationPage() {
  const availability = await getCourseAvailability();
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-10">
      <div>
        <Link
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--admin-on-surface-variant)]"
          href="/admin/courses"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Courses
        </Link>
        <h1 className="text-[36px] font-black leading-[1.1] tracking-[-0.02em] text-[var(--admin-brand-hero)]">
          How do you want to start?
        </h1>
        <p className="mt-2.5 max-w-[520px] text-[15px] font-medium leading-[1.6] text-[var(--admin-on-surface-variant)]">
          Pick whichever gets you moving fastest — you can always change your mind later.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div
          className="flex flex-col gap-4 rounded-[22px] border-[1.5px] border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-7 text-left shadow-[0_2px_8px_rgba(18,60,53,0.04)] transition hover:border-[var(--admin-primary)]"
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-[14px]"
            style={{ background: "linear-gradient(135deg, var(--admin-accent-violet), var(--admin-accent-sky))" }}
          >
            <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
          </span>
          <div>
            <h2 className="mb-1.5 text-[17px] font-extrabold text-[var(--admin-on-surface)]">{availability.enabled ? <Link href="/admin/courses/ai/brief" className="underline underline-offset-4">Create with AI</Link> : 'Create with AI'}</h2>
            <p className="text-[13px] font-medium leading-[1.5] text-[var(--admin-on-surface-variant)]">
              Start with a rough idea or get help choosing a goal and learners. Review the outline before drafting your course.
            </p>
            {!availability.enabled && <p role="status" className="mt-3 text-sm">{availability.reason} <Link className="font-bold underline" href="/admin/courses/ai-results">Open saved AI results</Link></p>}
          </div>
        </div>

        <Link
          className="flex flex-col gap-4 rounded-[22px] border-[1.5px] border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-7 text-left shadow-[0_2px_8px_rgba(18,60,53,0.04)] transition hover:border-[var(--admin-primary)]"
          href="/admin/courses/new"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--admin-surface-container-low)]">
            <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" stroke="var(--admin-primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
          <div>
            <h2 className="mb-1.5 text-[17px] font-extrabold text-[var(--admin-on-surface)]">Start from scratch</h2>
            <p className="text-[13px] font-medium leading-[1.5] text-[var(--admin-on-surface-variant)]">
              Build it yourself, lesson by lesson, exactly your way.
            </p>
          </div>
        </Link>

        <Link
          className="flex flex-col gap-4 rounded-[22px] border-[1.5px] border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-7 text-left shadow-[0_2px_8px_rgba(18,60,53,0.04)] transition hover:border-[var(--admin-primary)]"
          href="/admin/courses/remix"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--admin-surface-container-low)]">
            <svg aria-hidden="true" className="h-[22px] w-[22px]" fill="none" stroke="var(--admin-secondary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M17 2.1 21 6l-4 3.9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="m7 21.9-4-3.9 4-3.9" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </span>
          <div>
            <h2 className="mb-1.5 text-[17px] font-extrabold text-[var(--admin-on-surface)]">Remix a course</h2>
            <p className="text-[13px] font-medium leading-[1.5] text-[var(--admin-on-surface-variant)]">
              Start from one of your existing courses and make it your own.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
