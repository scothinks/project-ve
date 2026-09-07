"use client";
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminDrawer, AdminConfirmDialog } from '@/components/admin/AdminDialog';
import { AiAssistancePreview } from './AiAssistancePreview';
import { AiPageAuthoring } from './AiPageAuthoring';
import { aiButton, aiPrimary, aiField } from './AiPageResult';
import { authoringRequest, AuthoringRequestError, useAuthoringResult } from './useAuthoringResult';
import { creditLabel, type AuthoringResult } from '@/features/ai-generation/authoring/contracts';
import type { AssistanceKind, AssistanceResult, AssistanceReceipt } from '@/features/ai-generation/authoring/assistance-contracts';

import { pricedAction } from '@/features/ai-generation/authoring/pricing-labels';

type Setup = { kind: AssistanceKind; parent?: AssistanceResult; selected?: number };
const titles = { quiz: 'Generate questions', lesson_plan: 'Suggest lessons', lesson_draft: 'Draft lesson' };
export function AiAssistanceAuthoring({ courseId, lessonId, kind, enabled, unavailableReason, initialResultId, beforeAction, refreshOnApply = true }: {
  courseId: string; lessonId?: string; kind: 'quiz' | 'lesson_plan'; enabled: boolean; initialResultId?: string;
  beforeAction?: () => Promise<void>; refreshOnApply?: boolean;
  unavailableReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initialResultId));
  const [setup, setSetup] = useState<Setup | null>(null);
  const [result, setResult] = useState<AssistanceResult | null>(null);
  const [id, setId] = useState(initialResultId);
  const [focus, setFocus] = useState(''); const [refinement, setRefinement] = useState(''); const [count, setCount] = useState(1);
  const [selection, setSelection] = useState<number[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [uncertain, setUncertain] = useState(false);
  const refreshed = useRef<string | null>(null); const pendingSave = useRef<string | null>(null); const selectedResult = useRef<string | null>(null);
  const receive = useCallback((value: AuthoringResult) => {
    const r = value as unknown as AssistanceResult;
    if (!['quiz', 'lesson_plan', 'lesson_draft'].includes(r.kind)) { setError('Open this result from AI results.'); return; }
    setResult(r);
    if (r.id !== selectedResult.current || r.selection) {
      selectedResult.current = r.id;
      setSelection(r.selection ?? (r.candidate && 'questions' in r.candidate ? r.candidate.questions.map((_, i) => i) : [0]));
    }
    // The first read may precede prepare. Keep an uncertain request uncertain.
    setUncertain(r.applicationState === 'checking' || (pendingSave.current === r.id && !r.receipt && r.applicationState !== 'not_saved'));
    if (r.receipt || r.applicationState === 'not_saved') pendingSave.current = null;
    if (refreshOnApply && r.receipt && refreshed.current !== r.id) { refreshed.current = r.id; router.refresh(); }
  }, [router, refreshOnApply]);
  const reconnecting = useAuthoringResult(id, open && !setup, receive);
  const [delayed, setDelayed] = useState(false);
  const active = result?.stage === 'starting' || result?.stage === 'writing';
  useEffect(() => {
    if (!active || !result) return;
    const tick = () => setDelayed(Date.now() - new Date(result.updatedAt).getTime() > 30000);
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [active, result]);
  async function run(fn: () => Promise<void>) {
    if (busy) return; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Your work is retained. Try again.'); } finally { setBusy(false); }
  }
  async function quote(next = setup, direction = focus, changes = refinement, size = count) {
    if (!next) return;
    await beforeAction?.();
    const r = await authoringRequest<AssistanceResult>({ action: 'quote', courseId, lessonId: next.kind === 'quiz' ? lessonId : undefined,
      kind: next.kind, focus: direction, count: next.kind === 'lesson_draft' ? 1 : size, parentId: (next.parent?.candidate || next.parent?.kind === "lesson_draft") ? next.parent.id : undefined,
      selected: next.selected, refinement: changes });
    setResult(r); setId(r.id);
  }
  function begin(next: Setup) {
    setOpen(true); setSetup(next); setResult(null); setId(undefined); setError('');
    const direction = next.parent?.focus ?? focus;
    setFocus(direction); setRefinement('');
    void run(() => quote(next, direction, '', count));
  }
  async function apply(replay = false) {
    if (!result) return;
    if (!replay) await beforeAction?.();
    pendingSave.current = result.id; setUncertain(true);
    try {
      const receipt = await authoringRequest<AssistanceReceipt>({ action: 'apply', id: result.id, selection: result.selection ?? selection });
      receive({ ...result, receipt, applicationState: 'saved' } as unknown as AuthoringResult);
    } catch (e) {
      if (e instanceof AuthoringRequestError && e.status < 500) { pendingSave.current = null; setUncertain(false); }
      throw e;
    }
  }
  const saving = uncertain || result?.applicationState === 'checking';
  const canUse = result?.courseId === courseId && (result.kind !== 'quiz' || result.lessonId === lessonId) && result.targetAvailable !== false;
  const stateLabel = saving ? busy ? 'Saving…' : 'Checking save…' : result?.receipt ? 'Saved' : result?.applicationState === 'not_saved' ? 'Not saved'
    : result?.stopRequested && active ? 'Stopping…' : result?.stage === 'starting' ? 'Request accepted' : result?.stage === 'writing'
      ? result.kind === 'quiz' ? 'Writing and checking questions' : result.kind === 'lesson_plan' ? 'Planning lessons' : 'Writing your lesson'
      : result?.stage === 'ready' ? 'Not added yet' : result?.stage === 'failed' ? 'Needs attention' : result?.stage === 'stopped' ? 'Stopped' : 'Ready to start';
  return <>
    {!enabled && <p role="status" className="rounded-2xl border border-[var(--admin-border-warm)] p-5 text-sm leading-6">{unavailableReason ?? 'AI suggestions are not enabled yet.'} You can still edit manually or resume saved work.</p>}
    <div className="flex flex-wrap items-center gap-2">
      {enabled && <button type="button" className={aiButton} disabled={busy} onClick={() => begin({ kind })}>{titles[kind]}</button>}
      <AiPageAuthoring lessonId={lessonId} courseId={courseId} resultsLabel={kind === 'lesson_plan' ? 'Resume earlier work' : undefined} />
    </div>
    <AdminDrawer open={open} onOpenChange={setOpen} title={setup ? titles[setup.kind] : 'Your AI result'} description="Saved in AI results." widthClassName="w-full max-w-[720px]">
      <div className="space-y-5">
        {error && <p role="alert" className="text-sm leading-6 text-[var(--admin-error)]">{error}</p>}
        {setup ? <form className="space-y-5" onSubmit={e => { e.preventDefault(); void run(() => quote()); }}>
          <p className="text-sm">{setup.kind === 'quiz' ? 'I’ll check understanding of your saved lesson.' : setup.kind === 'lesson_plan' ? 'I’ll suggest what this course needs next.' : 'Review the draft before adding it.'}</p>
          <details className="rounded-xl border border-[var(--admin-border-warm)] p-4"><summary className="cursor-pointer text-sm font-bold">Add direction (optional)</summary>
            <label className="mt-3 block text-sm font-bold">Focus or audience<textarea className={aiField} maxLength={1000} rows={3} value={focus} disabled={busy} onChange={e => { setFocus(e.target.value); setResult(null); }} /></label>
            {setup.kind !== 'lesson_draft' && <label className="mt-3 block text-sm font-bold">{setup.kind === 'quiz' ? 'Questions' : 'Suggestions'}<select className={aiField} value={count} disabled={busy} onChange={e => { setCount(Number(e.target.value)); setResult(null); }}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label>}
          </details>
          {setup.parent?.kind === setup.kind && <label className="block text-sm font-bold">What would you like to change?<textarea className={aiField} maxLength={1000} rows={3} value={refinement} disabled={busy} onChange={e => { setRefinement(e.target.value); setResult(null); }} /></label>}
          {result ? <div className="space-y-4 rounded-2xl bg-[var(--admin-surface-container-low)] p-5">
            <p className="text-sm">{result.kind === 'lesson_plan' ? 'Drafting is charged separately.' : result.kind === 'lesson_draft' ? 'One lesson draft. Media is added separately.' : `${result.count} single-choice question${result.count === 1 ? '' : 's'}.`}</p>
            <p className="text-xs">Price valid for 10 minutes.</p>
            <button className={aiPrimary} type="button" disabled={busy} onClick={() => void run(async () => {
              await beforeAction?.(); const r = await authoringRequest<AssistanceResult>({ action: 'start', id: result.id });
              receive(r as unknown as AuthoringResult); setSetup(null);
            })}>{busy ? 'Starting…' : pricedAction(setup.kind === 'lesson_plan' ? 'Recommend' : 'Generate', result)}</button>
          </div> : <button className={aiPrimary} disabled={busy} type="submit">{busy ? 'Preparing…' : 'Update price'}</button>}
        </form> : result ? <>
          <div role="status" aria-live="polite" className="space-y-2 rounded-2xl bg-[var(--admin-surface-container-low)] p-5">
            <p className="font-extrabold">{stateLabel}</p><p className="text-sm leading-6">{reconnecting ? 'Reconnecting to your saved result.' : saving ? 'You can close this panel and return to check the save.' : result.applicationError ?? result.failure ?? (active ? delayed ? 'This is taking longer than usual. Your request is saved.' : 'You can watch here or return through AI results.' : 'Adding a result uses no more credits.')}</p>
            <p className="text-xs">{creditLabel(result as unknown as AuthoringResult)}</p>
          </div>
          {!canUse && <p className="text-sm">The original destination is unavailable here. Your result is retained.</p>}
          <AiAssistancePreview result={result} selection={selection} setSelection={setSelection} disabled={busy || Boolean(saving) || Boolean(result.receipt)} onDraft={enabled && canUse ? i => begin({ kind: 'lesson_draft', parent: result, selected: i }) : undefined} />
          <div className="flex flex-wrap gap-3">
            {active && <button className={aiButton} type="button" disabled={busy || result.stopRequested} onClick={() => void run(async () => receive(await authoringRequest({ action: 'stop', id: result.id })))}>Stop generation</button>}
            {saving ? <button className={aiButton} type="button" disabled={busy} onClick={() => void run(() => apply(true))}>Check save status</button> : result.receipt
              ? <Link className={aiPrimary} href={`/admin/courses/lessons/${result.receipt.lessonId}${result.kind === 'quiz' ? '/quiz' : ''}`}>{result.kind === 'quiz' ? 'Open saved questions' : 'Open saved lesson'}</Link>
              : result.candidate && result.kind !== 'lesson_plan' && canUse && <button className={aiPrimary} type="button" disabled={busy || !selection.length} onClick={() => void run(() => apply())}>{result.kind === 'quiz' ? 'Add selected questions' : 'Add lesson'}</button>}
            {!active && enabled && canUse && <button className={aiButton} type="button" disabled={busy || Boolean(saving)} onClick={() => begin({ kind: result.kind, parent: result })}>{result.candidate ? 'Create another version' : 'Try again'}</button>}
            {!active && <AdminConfirmDialog title="Delete this result?" description="Added content stays in place. Generation credits are not refunded." confirmLabel="Delete result" onConfirm={() => void run(async () => { await authoringRequest({ action: 'delete', id: result.id }); setOpen(false); })} trigger={<button className={aiButton} type="button" disabled={busy || Boolean(saving)}>Delete result</button>} />}
          </div>
        </> : <p role="status">Loading your saved result…</p>}
      </div>
    </AdminDrawer>
  </>;
}
