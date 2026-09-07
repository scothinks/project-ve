'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/AdminDialog';
import { AdminCard } from '@/components/admin/AdminPrimitives';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { creditLabel, type AuthoringResult } from '@/features/ai-generation/authoring/contracts';
import type { CourseAvailability } from '@/features/ai-generation/authoring/course-availability';
import { authoringRequest } from './useAuthoringResult';
import { AiCourseOutlineEditor, courseField } from './AiCourseOutlineEditor';
import { AiCourseDiscovery } from './AiCourseDiscovery';
import { AiCoursePreview } from './AiCoursePreview';
import { CourseGenerateAction } from './CourseGenerateAction';
import { CourseLeaveGuard } from './CourseLeaveGuard';
import { CourseQuoteReview } from './CourseQuoteReview';
import { aiButton, aiPrimary } from './AiPageResult';
import { useAuthoringDelay } from './useAuthoringDelay';
import { useCourseJourney } from './useCourseJourney';

export function AiCourseAuthoring({ availability, initialId }: { availability: CourseAvailability; initialId?: string }) {
  const journey = useCourseJourney(initialId);
  const { result, id, brief, outline, busy, checking, error, run } = journey;
  const [refinement, setRefinement] = useState('');
  const progressRef = useRef<HTMLDivElement>(null);
  const active = result?.stage === 'starting' || result?.stage === 'writing';
  const terminal = !!result && ['ready', 'failed', 'stopped'].includes(result.stage);
  const delayed = useAuthoringDelay(active, result?.updatedAt, 60_000);
  const enabled = availability.enabled && (!result || result.workspaceId === availability.workspaceId);
  const step = result?.receipt ? 3 : result?.kind === 'course_draft' ? 2 : result ? 1 : 0;
  const steps = ['Shape your idea', 'Outline', 'Draft', 'Review'];
  return <div data-outline-revision={result?.outlineRevision} className="mx-auto w-full max-w-4xl space-y-6 px-1 pb-28 pt-4 md:py-8">
    <CourseLeaveGuard dirty={!!journey.dirty && !busy} />
    <nav className="flex flex-wrap gap-4 text-sm font-bold"><Link href="/admin/courses/choose">← Courses</Link><Link href="/admin/courses/ai-results">AI results</Link>{result?.parentId && <Link href={`?aiResult=${result.parentId}`}>Earlier version / outline</Link>}</nav>
    <header><p className="text-sm font-bold">Create with AI</p><h1 className="mt-2 text-3xl font-black leading-tight">{result?.receipt ? 'Your course is saved' : result?.kind === 'course_draft' ? 'Your course draft' : result ? 'Shape your course outline' : 'Good courses start with a little help'}</h1><p className="mt-3 max-w-2xl text-sm leading-6">{result ? 'Your generated work stays in AI results. Review and save it when you are ready.' : 'Bring a rough idea, a problem to solve, or let us help you choose. Together, we’ll turn it into something worth learning.'}</p></header>
    <ol aria-label="Course creation progress" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2">{steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${index === step ? 'font-black' : 'opacity-70'}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs">{index < step ? '✓' : index + 1}</span>{label}{index < step && <span className="sr-only"> completed</span>}</li>)}</ol>
    {!enabled && <AdminCard><div role="status" className="space-y-3"><h2 className="font-bold">{availability.reason || 'Switch to this result’s workspace to generate more.'}</h2><p className="text-sm">You can still open saved results or create a course yourself.</p><div className="flex flex-wrap gap-3"><Link className={aiPrimary} href="/admin/courses/new">Start from scratch</Link><Link className={aiButton} href="/admin/courses/ai-results">Open AI results</Link></div></div></AdminCard>}
    {error && <p role="alert" className="rounded-xl border p-4 text-sm">{error}</p>}
    {journey.reconnecting && <p role="status">Reconnecting to your saved progress…</p>}
    {!initialId && availability.enabled && <div hidden={!!result || !!id}>
      <AiCourseDiscovery brief={brief} onChange={journey.setBrief} disabled={busy} guidanceEnabled={availability.guidanceEnabled}>
        <CourseGenerateAction kind="course_outline" lessons={brief.lessonCount} enabled={!id && enabled} busy={busy} valid={!!brief.need.trim() && !!brief.audience.trim()} label="Generate outline" onGenerate={price => void run(() => journey.generateOutline(price))} />
      </AiCourseDiscovery>
    </div>}
    {!result && id && <p role="status">Loading your saved result…</p>}
    {result?.deleted ? <p>This result was deleted. Any saved course remains in Courses.</p> : result && <>
      {result.stage === 'quote' ? <CourseQuoteReview result={result} enabled={enabled} busy={busy} onStart={() => void run(() => journey.request({ action: 'start', id: result.id }))} onRefresh={() => void run(journey.refreshQuote)} onEdit={!initialId && !result.parentId && result.kind === 'course_outline' ? journey.editBrief : undefined} /> : <p className="text-sm">{creditLabel(result as unknown as AuthoringResult)}</p>}
      {(active || result.stage === 'stopped') && <AdminCard><div ref={progressRef} tabIndex={-1} role="status" aria-live="polite"><strong>{result.stage === 'stopped' ? 'Generation stopped' : result.stopRequested ? 'Stopping…' : result.kind === 'course_outline' ? 'Planning your course' : `${result.completedCount} of ${result.totalCount} lessons ready`}</strong><p className="mt-2 text-sm leading-6">{result.stage === 'stopped' ? 'Completed work remains available below and in AI results.' : delayed ? 'This is taking longer than expected. Your saved checkpoints remain available.' : result.stage === 'starting' ? 'Your request was accepted. Waiting for the writer to start.' : 'Each finished lesson appears after it has been checked and saved.'}</p></div></AdminCard>}
      {result.failure && <p role="status" className="text-sm">{result.failure}</p>}
      {result.kind === 'course_outline' && result.stage === 'ready' && outline && <AdminCard className="space-y-5">
        <div><h2 className="text-xl font-bold">Make this outline yours</h2><p className="mt-2 text-sm">Adjust what each lesson teaches, change the order, or add a missing step.</p></div>
        {result.outlineRevision !== journey.editRevision.current && <div className="space-y-3" role="status"><p>Another edit was saved. Your unsaved text stays here until you choose to reload.</p><AdminConfirmDialog title="Reload the saved outline?" description="This replaces the unsaved outline edits shown here with the latest saved version." confirmLabel="Reload outline" onConfirm={journey.reloadOutline} trigger={<button className={aiButton} disabled={busy}>Reload saved outline</button>} /></div>}
        <AiCourseOutlineEditor key={`${result.id}:${journey.editRevision.current}`} value={outline} onChange={journey.setOutline} disabled={busy} />
        <p role="status" className="text-xs">{journey.dirty ? 'Unsaved outline changes' : 'Outline saved'}</p>
        <div className="space-y-2"><label htmlFor="course-quiz-scope" className="text-sm font-bold">Quiz scope</label><AdminSelect id="course-quiz-scope" disabled={busy} value={String(journey.questions)} onValueChange={value => journey.setQuestions(Number(value))} options={[{label:'No quizzes',value:'0'},...[1,2,3].map(n=>({label:`${n} question${n>1?'s':''} per lesson`,value:String(n)}))]} /></div>
        <button type="button" className={aiButton} disabled={busy} onClick={() => void run(async () => { await journey.saveOutline(); })}>Save outline</button>
        <CourseGenerateAction kind="course_draft" lessons={outline.lessons.length} questions={journey.questions} enabled={enabled} busy={busy} label="Generate course draft" onGenerate={price => void run(() => journey.generateDraft(price))} />
      </AdminCard>}
      {result.kind === 'course_draft' && result.stage !== 'quote' && <><p role="status" className="font-bold">{result.completedCount} of {result.totalCount} lessons ready</p><AiCoursePreview result={result} /></>}
      {(checking || result.applicationState === 'checking') && !result.receipt && <AdminCard className="space-y-3"><p role="status">Checking save… Resolve this outcome before trying again.</p><button className={aiButton} disabled={busy} onClick={() => void run(journey.read)}>Check save</button><button className={aiButton} disabled={busy} onClick={() => void run(journey.apply)}>Recover this save</button></AdminCard>}
      {result.receipt ? <AdminCard className="space-y-4"><h2 className="text-xl font-bold">Ready for your editorial review</h2><p className="text-sm leading-6">Check the lesson content and quiz answers, and choose the required cover artwork. You’ll approve and publish separately.</p><div className="flex flex-wrap gap-3"><Link className={aiPrimary} href={`/admin/courses/${result.receipt.courseId}/review`}>Review course</Link><Link className={aiButton} href={`/admin/courses/${result.receipt.courseId}`}>Open saved course</Link></div></AdminCard>
        : terminal && result.kind === 'course_draft' && result.completedCount > 0 && !checking && result.applicationState !== 'checking' && <AdminCard className="space-y-3"><p className="text-sm">This is a generated result, not yet a saved course. Saving creates an editable draft.</p><button className={aiPrimary} disabled={busy} onClick={() => void run(journey.apply)}>{result.completedCount === result.totalCount ? 'Save course draft' : `Save only ${result.completedCount} completed lesson${result.completedCount > 1 ? 's' : ''}`}</button></AdminCard>}
      {terminal && !result.receipt && result.kind === 'course_draft' && result.completedCount < result.totalCount && <AdminCard><CourseGenerateAction kind="course_draft" lessons={result.totalCount} questions={result.questionsPerLesson} retryId={result.id} enabled={enabled && !checking && result.applicationState !== 'checking'} busy={busy} label="Retry unfinished lessons" onGenerate={price => void run(() => journey.retry(price))} /></AdminCard>}
      {terminal && <details className="space-y-3 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-bold">Refine the outline in a new version</summary><textarea aria-label="Refinement direction" className={courseField} maxLength={1000} disabled={busy} value={refinement} onChange={e => setRefinement(e.target.value)} /><p className="text-sm">Your earlier outline and completed drafts stay available. This creates a separately requested outline.</p><CourseGenerateAction kind="course_outline" lessons={result.brief.lessonCount} enabled={enabled} busy={busy} valid={!!refinement.trim()} label="Generate refined outline" onGenerate={price => void run(() => journey.refine(refinement, price))} /></details>}
      <div className="flex flex-wrap gap-3">{active && <button className={aiButton} disabled={busy || result.stopRequested} onClick={() => void run(async () => { await journey.request({ action: 'stop', id: result.id }); progressRef.current?.focus(); })}>Stop remaining work</button>}
        {!active && <AdminConfirmDialog title="Delete this result?" description="Completed draft content in this result will be deleted. Saved courses stay in place. Generation credits are not refunded." confirmLabel="Delete result" onConfirm={() => run(async () => { await authoringRequest({ action: 'delete', id: result.id }); await journey.read(); })} trigger={<button className={aiButton} disabled={busy || checking || result.applicationState === 'checking'}>Delete result</button>} />}
      </div>
    </>}
  </div>;
}
