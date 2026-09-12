import { reviewAssistanceLesson } from "@/app/admin/courses/lessons/assistance-review-actions";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { getAssessmentIssues } from "@/features/learning/admin/assessment-builder-domain";
import type { getAdminLesson } from "@/features/learning/admin/data";

export function LessonReviewSummary({ data, valueCount }: {
  mediaReady: boolean;
  data: NonNullable<Awaited<ReturnType<typeof getAdminLesson>>>; valueCount: number;
}) {
  const { lesson, pages, blocks, questions, quiz } = data;
  const base = `/admin/courses/lessons/${lesson.id}`;
  const populatedPages = new Set(blocks.map((block) => block.page_id));
  const incompletePages = pages.filter((page) => !page.title.trim() || !populatedPages.has(page.id));
  const quizIssues = quiz ? getAssessmentIssues(questions) : [];
  const assistantDraft = lesson.ai_generated;
  const needsTextReview = lesson.ai_generated && lesson.ai_text_status !== "approved";
  const needsMediaReview = lesson.ai_generated && lesson.ai_media_status !== "approved";
  const checks = [
    { title: "Pages", detail: pages.length === 0 ? "Add your first lesson page." : incompletePages.length ? `${incompletePages.length} ${incompletePages.length === 1 ? "page needs" : "pages need"} a title or content.` : `${pages.length} ${pages.length === 1 ? "page has a title" : "pages have titles"} and content.`, href: incompletePages[0] ? `${base}?page=${incompletePages[0].id}` : base, action: "Edit pages" },
    { title: "Quiz", detail: quizIssues[0]?.message ?? (questions.length ? `${questions.length} ${questions.length === 1 ? "question" : "questions"} checked. Answer choices and feedback are complete.` : lesson.quiz_requires_lesson_completion ? "Add a quiz to check understanding." : "No quiz added. You can add one if it suits this lesson."), href: `${base}/quiz`, action: "Edit quiz" },
    { title: "Values", detail: valueCount ? `${valueCount} ${valueCount === 1 ? "value" : "values"} chosen to help learners discover this lesson.` : "No values chosen. This is optional; you can add them later.", href: `${base}/values`, action: "Choose values" },
  ];
  return <section aria-label="Lesson review" className="space-y-6 rounded-3xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-6">
    <div><h1 className="text-2xl font-black">Before you publish</h1><p className="mt-2 text-sm leading-6">Check the pages and try the quiz in preview. Use the links below to finish anything that needs attention.</p></div>
    <ul className="space-y-4">{checks.map((check) => <li className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ui-border-subtle)] pb-4" key={check.title}><div><h2 className="font-extrabold">{check.title}</h2><p className="mt-1 text-sm">{check.detail}</p></div><Link className="text-sm font-bold text-[var(--ui-action)]" href={check.href}>{check.action}</Link></li>)}</ul>
    {assistantDraft && (needsTextReview || needsMediaReview) ? <form action={reviewAssistanceLesson} className="space-y-3">
      <input name="lessonId" type="hidden" value={lesson.id} /><input name="revision" type="hidden" value={lesson.draft_revision} />
      <label className="flex items-start gap-2 text-sm"><input className="mt-1" name="reviewed" required type="checkbox" />I have reviewed the lesson text, quiz and any media. Optional placeholders can remain empty.</label>
      <PendingSubmitButton className="rounded-full bg-[var(--ui-action)] px-4 py-2 text-sm font-extrabold text-[var(--ui-on-action)]" label="Mark lesson reviewed" pendingLabel="Saving review…" />
    </form> : null}
    {assistantDraft && !needsTextReview && !needsMediaReview ? <p className="text-sm">Lesson review complete.</p> : null}
    <Link className="text-sm font-bold underline" href={`/admin/courses/${lesson.course_id}/media`}>Review earlier media and lesson covers</Link>
    <p className="text-sm text-[var(--ui-text-muted)]">When you have finished reviewing, return to the editor to publish. Publishing runs the final checks and makes the saved lesson available to learners.</p>
  </section>;
}
