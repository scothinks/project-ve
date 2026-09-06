"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LessonPageCard } from "@/components/lesson/LessonPageLayout";
import { mapPreviewBlock } from "@/features/learning/admin/lesson-page-builder-domain";
import { creditLabel, isGenerating, resultLabel, type AuthoringResult } from "@/features/ai-generation/authoring/contracts";
import { AdminConfirmDialog } from "@/components/admin/AdminDialog";

export const aiButton = "min-h-11 rounded-full border border-[var(--admin-border-warm)] px-5 py-2 text-sm font-extrabold disabled:opacity-50";
export const aiPrimary = `${aiButton} border-transparent bg-[var(--admin-primary)] text-[var(--admin-on-primary)]`;
export const aiField = "mt-2 w-full rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-3 text-sm outline-none focus:border-[var(--admin-primary)]";

export function AiPageResult({ result, busy, reconnecting, applying, currentLessonId, enabled, onApply, onStop, onRefine, onDelete, onCheck }: {
  result: AuthoringResult; busy: boolean; reconnecting: boolean; applying: boolean; currentLessonId?: string; enabled: boolean;
  onApply: () => void; onStop: () => void; onRefine: () => void; onDelete: () => void; onCheck: () => void;
}) {
  const active = isGenerating(result);
  const reviewQuiz = result.candidate?.decision === "review_quiz";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const delayed = active && now - new Date(result.updatedAt).getTime() > 30_000;
  return <div className="space-y-6">
    <div aria-live="polite" role="status" className="rounded-[16px] bg-[var(--admin-surface-container-low)] p-5">
      <p className="font-extrabold">{applying ? busy ? "Saving…" : "Checking save…" : result.applicationState === "not_saved" ? "Not saved" : resultLabel(result)}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-on-surface-variant)]">{applying ? "You can leave this panel. We’ll confirm whether your page was saved." : reconnecting
        ? "Reconnecting to your saved result. No new generation has started." : active
          ? result.stopRequested ? "The current request may finish. We’ll keep any completed page and confirm the credits used."
          : delayed ? "This is taking longer than usual. Your request is saved; you can return through AI results."
          : "You can watch here or return through AI results. We’ll keep your page." : result.applicationError ?? result.failure ?? (reviewQuiz ? "Your recommendation is saved in AI results. No page has been added; review your quiz when you’re ready." : result.candidate ? "Your result is saved in AI results. Adding it won’t use more credits." : "No page was added to your lesson.")}</p>
      <p className="mt-3 text-xs font-semibold">{creditLabel(result)}</p>
    </div>
    {result.targetAvailable === false && <p className="text-sm leading-6">The original lesson is no longer available. Your result is retained here; no lesson will be recreated automatically.</p>}
    {active && <ol aria-label="Generation progress" className="grid grid-cols-3 gap-3 text-xs font-bold">
      {(result.assistant ? ["Request accepted", "Reviewing lesson", "Suggestion ready"] : ["Request accepted", "Writing page", "Page ready"]).map((label, i) => {
        const current = result.stage === "starting" ? 0 : 1;
        return <li aria-current={i === current ? "step" : undefined} key={label} className={i <= current ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface-variant)]"}>
          <span aria-hidden="true" className={`mb-2 block h-1 rounded-full ${i <= current ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-border-warm)]"} ${i === current ? "animate-pulse motion-reduce:animate-none" : ""}`} />{label}
        </li>;
      })}
    </ol>}
    {result.candidate?.reason && <section className="space-y-3 rounded-2xl border border-[var(--admin-border-warm)] p-5">
      <h3 className="font-extrabold">{reviewQuiz ? result.candidate.title : "Why this page helps"}</h3>
      <p className="text-sm leading-6">{result.candidate.reason}</p>
      {!reviewQuiz && <p className="text-sm font-semibold">Suggested placement: page {result.position}</p>}
      {reviewQuiz && <p className="text-xs leading-5">This is a suggestion to move on. Your quiz and lesson still need your review before publishing.</p>}
    </section>}
    {result.candidate && !reviewQuiz && <LessonPageCard isPreview pageType={result.candidate.pageType === "scenario" ? "example" : result.candidate.pageType}
      title={result.candidate.title} subtitle={result.candidate.subtitle}
      blocks={result.candidate.blocks.map((b, i) => mapPreviewBlock({ id: `${result.id}-${i}`, page_id: result.id,
        block_type: b.blockType, sort_order: i + 1, payload: b.payload }))} />}
    <div className="flex flex-wrap gap-3">
      {active && <button className={aiButton} disabled={busy || result.stopRequested} onClick={onStop} type="button">{result.stopRequested ? "Stopping…" : "Stop generation"}</button>}
      {applying ? <button className={aiButton} onClick={onCheck} type="button">Check save status</button> : result.receipt
        ? <Link className={aiPrimary} href={`/admin/courses/lessons/${result.receipt.lessonId}?page=${result.receipt.pageId}`}>Open saved page</Link>
        : reviewQuiz && result.targetAvailable !== false ? <Link className={aiPrimary} href={`/admin/courses/lessons/${result.lessonId}/quiz`}>Review quiz</Link>
        : result.candidate && result.targetAvailable !== false && (currentLessonId === result.lessonId
          ? <button className={aiPrimary} disabled={busy} onClick={onApply} type="button">Add page</button>
          : <Link className={aiPrimary} href={`/admin/courses/lessons/${result.lessonId}?aiResult=${result.id}`}>Review in lesson</Link>)}
      {!active && enabled && result.targetAvailable !== false && currentLessonId === result.lessonId && <button className={aiButton} disabled={busy || applying} onClick={onRefine} type="button">{reviewQuiz ? "Explore another idea" : result.candidate ? "Create another version" : "Try again"}</button>}
      {!active && <AdminConfirmDialog title="Delete this result?" description="This removes the saved candidate. Pages already added to a lesson stay in place. Generation credits will not be refunded."
        confirmLabel="Delete result" onConfirm={onDelete} trigger={<button className={aiButton} disabled={busy || applying} type="button">Delete result</button>} />}
    </div>
  </div>;
}
