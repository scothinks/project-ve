'use client';
import { useCallback, useRef, useState } from 'react';
import type { AuthoringResult } from '@/features/ai-generation/authoring/contracts';
import type { CourseBrief, CourseOutline, CourseResult } from '@/features/ai-generation/authoring/course-contracts';
import { validateCourseBrief } from '@/features/ai-generation/authoring/course-discovery';
import { quoteMatchesPrice, type CoursePrice } from '@/features/ai-generation/authoring/course-pricing';
import { authoringRequest, AuthoringRequestError, useAuthoringResult } from './useAuthoringResult';

export function useCourseJourney(initialId?: string) {
  const [id, setId] = useState(initialId), [result, setResult] = useState<CourseResult | null>(null);
  const [brief, setBrief] = useState<CourseBrief>({ need: '', audience: '', tone: 'Conversational', lessonCount: 3 });
  const [outline, updateOutline] = useState<CourseOutline | null>(null), [questions, setQuestions] = useState(0);
  const outlineRef = useRef<CourseOutline | null>(null);
  const setOutline = useCallback((value: CourseOutline | null) => { outlineRef.current = value; updateOutline(value); }, []);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [checking, setChecking] = useState(false);
  const [savedOutline, setSavedOutline] = useState('');
  const loaded = useRef<string | undefined>(undefined), target = useRef(initialId), lock = useRef(false), editRevision = useRef(0);
  const receive = useCallback((raw: AuthoringResult) => {
    const r = raw as unknown as CourseResult;
    if (target.current && r.id !== target.current) return;
    setResult(r); setId(r.id);
    if (loaded.current !== r.id) {
      loaded.current = r.id; editRevision.current = r.outlineRevision;
      setOutline(r.outline); setSavedOutline(JSON.stringify(r.outline)); setBrief(r.brief); setQuestions(r.questionsPerLesson);
    } else if (!outlineRef.current && r.outline) {
      editRevision.current = r.outlineRevision; setSavedOutline(JSON.stringify(r.outline)); setOutline(r.outline);
    }
    if (r.receipt || r.applicationState === 'not_saved') setChecking(false);
  }, [setOutline]);
  const reconnecting = useAuthoringResult(id, !!id, receive);
  const accept = (r: CourseResult) => {
    target.current = r.id; receive(r as unknown as AuthoringResult);
    window.history.replaceState(null, '', `?aiResult=${encodeURIComponent(r.id)}`);
  };
  const read = async () => {
    if (!target.current) return;
    const response = await fetch(`/api/admin/ai/authoring?id=${encodeURIComponent(target.current)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('We could not check this result. Your saved work is retained.');
    receive(await response.json());
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (e) {
      setError(e instanceof Error ? e.message : 'This action could not be completed.');
      if (target.current) await read().catch(() => {});
    } finally { lock.current = false; setBusy(false); }
  };
  const request = async (body: Record<string, unknown>) => accept(await authoringRequest<CourseResult>(body));
  const saveOutline = async () => {
    if (!result || !outline) throw new Error('Reopen your outline before continuing.');
    const saved = await authoringRequest<CourseResult>({ action: 'saveOutline', id: result.id, revision: editRevision.current, outline });
    editRevision.current = saved.outlineRevision; setSavedOutline(JSON.stringify(saved.outline)); receive(saved as unknown as AuthoringResult);
    return saved;
  };
  const generate = async (body: Record<string, unknown>, price: CoursePrice) => {
    const quoted = await authoringRequest<CourseResult>({ action: 'quote', ...body });
    // Retain the intent before any billable start. A lost start response recovers
    // this same ID, and never creates another paid request automatically.
    accept(quoted);
    if (!quoteMatchesPrice(quoted, price)) throw new Error('The price or scope changed. Review the updated request before generating.');
    await request({ action: 'start', id: quoted.id });
  };
  const generateOutline = (price: CoursePrice) => generate({ kind: 'course_outline', brief: validateCourseBrief(brief) }, price);
  const generateDraft = async (price: CoursePrice) => {
    const saved = await saveOutline();
    await generate({ kind: 'course_draft', parentId: saved.id, revision: saved.outlineRevision, questionsPerLesson: questions }, price);
  };
  const refine = async (direction: string, price: CoursePrice) => {
    if (!result) return;
    if (result.kind === 'course_outline' && result.stage === 'ready') await saveOutline();
    await generate({ kind: 'course_outline', parentId: result.id, refinement: direction }, price);
  };
  const retry = async (price: CoursePrice) => {
    if (result) await generate({ kind: 'course_draft', parentId: result.id, revision: result.outlineRevision, retry: true }, price);
  };
  const refreshQuote = async () => {
    if (!result) return;
    if (result.kind === 'course_outline') await request({ action: 'quote', kind: result.kind, brief: result.brief, parentId: result.parentId ?? undefined, refinement: result.refinement });
    else if (result.parentId) {
      const response = await fetch(`/api/admin/ai/authoring?id=${result.parentId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Reopen the earlier outline to review its price.');
      const parent = await response.json() as CourseResult;
      await request({ action: 'quote', kind: result.kind, parentId: parent.id, revision: parent.outlineRevision, questionsPerLesson: result.questionsPerLesson, retry: parent.kind === 'course_draft' });
    }
  };
  const apply = async () => {
    if (!result) return;
    setChecking(true);
    try {
      const receipt = await authoringRequest<CourseResult['receipt']>({ action: 'apply', id: result.id });
      setResult({ ...result, receipt, applicationState: 'saved' }); setChecking(false);
    } catch (e) { if (e instanceof AuthoringRequestError && e.status < 500) setChecking(false); throw e; }
  };
  const reloadOutline = () => { if (result) { setOutline(result.outline); setSavedOutline(JSON.stringify(result.outline)); editRevision.current = result.outlineRevision; setError(''); } };
  const editBrief = () => { target.current = undefined; loaded.current = undefined; setResult(null); setId(undefined); setOutline(null); setError(''); window.history.replaceState(null, '', window.location.pathname); };
  return { id, result, brief, setBrief, outline, setOutline, questions, setQuestions, busy, error, checking, reconnecting, editRevision,
    dirty: !id ? !!brief.need.trim() : result?.kind === 'course_outline' && result.stage === 'ready' && JSON.stringify(outline) !== savedOutline,
    run, read, request, saveOutline, generateOutline, generateDraft, refine, retry, refreshQuote, apply, reloadOutline, editBrief };
}
