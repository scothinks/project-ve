'use client';
import { useEffect, useRef, useState } from 'react';
import type { CourseBrief } from '@/features/ai-generation/authoring/course-contracts';
import { discoveryStarters, starterAdvice, type DiscoveryAdvice, type DiscoveryAnswer, type DiscoveryResponse } from '@/features/ai-generation/authoring/course-discovery';
import { AdminCard } from '@/components/admin/AdminPrimitives';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { aiButton, aiPrimary } from './AiPageResult';
import { courseField } from './AiCourseOutlineEditor';

export function AiCourseDiscovery({ brief, onChange, disabled, guidanceEnabled, children }: {
  brief: CourseBrief; onChange: (brief: CourseBrief) => void; disabled: boolean; guidanceEnabled: boolean; children: React.ReactNode;
}) {
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<'start' | 'guided' | 'direct'>('start');
  const [answers, setAnswers] = useState<DiscoveryAnswer[]>([]);
  const [advice, setAdvice] = useState<DiscoveryAdvice | null>(null);
  const [answer, setAnswer] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('Starting suggestions');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [showStarters, setShowStarters] = useState(false);
  const session = useRef('');
  const pending = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const edited = useRef(new Set<'need' | 'audience'>());
  const summary = useRef<HTMLDivElement>(null);
  const question = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (advice) (advice.question ? question.current : summary.current)?.focus(); }, [advice]);
  function invalidate() { revision.current++; pending.current?.abort(); setLoading(false); }
  async function guide(nextSeed: string, nextAnswers: DiscoveryAnswer[], bundled = false) {
    invalidate();
    const version = revision.current;
    const input = { seed: nextSeed, answers: nextAnswers, brief: { ...brief, need: nextAnswers.length ? brief.need || nextSeed : nextSeed, audience: nextAnswers.length ? brief.audience || 'A general audience; no specialist knowledge assumed.' : 'A general audience; no specialist knowledge assumed.' } };
    const controller = new AbortController(); pending.current = controller;
    const acceptAdvice = (next: DiscoveryAdvice) => {
      const accepted = { ...next, brief: { ...next.brief }, suggestedFields: next.suggestedFields.filter(field => !edited.current.has(field)) };
      for (const field of edited.current) accepted.brief[field] = brief[field];
      setAdvice(accepted); setAnswers(nextAnswers); onChange(accepted.brief); setSuggested(accepted.suggestedFields);
    };
    setMode('guided'); setLoading(true); setNotice(''); setAnswer('');
    try {
      let result: DiscoveryResponse;
      if (guidanceEnabled && !bundled) {
        session.current ||= crypto.randomUUID();
        const response = await fetch('/api/admin/ai/course-guidance', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, sessionId: session.current, requestId: crypto.randomUUID() }) });
        result = await response.json();
        if (!response.ok) throw new Error('Guidance could not finish. You can still edit your course idea.');
      } else result = { advice: starterAdvice(input), source: 'starter' };
      if (version !== revision.current) return;
      acceptAdvice(result.advice);
      setSource(result.source === 'assistant' ? 'AI suggestion' : 'Starting suggestions'); setNotice(result.notice || '');
    } catch {
      if (version !== revision.current) return;
      const fallback = starterAdvice(input);
      acceptAdvice(fallback);
      setSource('Starting suggestions'); setNotice('Guidance could not finish. Use these starting suggestions or edit the summary.');
    } finally { if (version === revision.current) setLoading(false); }
  }
  function choose(value: string) {
    if (!advice?.question || answers.length >= 3) return;
    void guide(seed, [...answers, { question: advice.question, answer: value }]);
  }
  function edit(field: keyof CourseBrief, value: string | number) {
    invalidate(); setSuggested(current => current.filter(f => f !== field));
    if (field === 'need' || field === 'audience') edited.current.add(field);
    onChange({ ...brief, [field]: value });
  }
  function changeDirection() { invalidate(); setMode('start'); setAdvice(null); setAnswers([]); setSuggested([]); }
  const busy = disabled || loading;
  return <div className="space-y-5">
    {mode === 'start' ? <AdminCard className="space-y-5">
      <div><h2 className="text-xl font-bold">A rough idea is enough</h2><p className="mt-2 text-sm leading-6">Start with a topic, a situation, or something you would like to change. We’ll help you shape the course and who it could help.</p></div>
      <label className="block text-sm font-bold">What would you like to help people do?
        <textarea className={courseField} rows={3} maxLength={1200} disabled={disabled} value={seed} placeholder="Tolerance, making fair decisions, or ‘our team talks over each other’…" onChange={e => { setSeed(e.target.value); edited.current.clear(); onChange({ ...brief, need: e.target.value, audience: '' }); }} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={aiPrimary} disabled={disabled || !seed.trim()} onClick={() => { onChange({ ...brief, need: seed, audience: '' }); void guide(seed, []); }}>Help shape my idea</button>
        <button type="button" className={aiButton} disabled={disabled} aria-expanded={showStarters} onClick={() => setShowStarters(!showStarters)}>Help me choose</button>
        <button type="button" className={aiButton} disabled={disabled} onClick={() => { invalidate(); setMode('direct'); if (seed && !brief.need) onChange({ ...brief, need: seed }); }}>I have a brief</button>
      </div>
      {showStarters && <div className="space-y-3"><p className="text-sm">Choose a starting point, or write something else above.</p><div className="flex flex-wrap gap-2">{discoveryStarters.map(s => <button type="button" key={s} className={aiButton} disabled={disabled} onClick={() => { edited.current.clear(); setSeed(s); onChange({ ...brief, need: s, audience: '' }); void guide(s, [], true); }}>{s}</button>)}</div></div>}
      <p className="text-xs leading-5">No outline or course is generated until you accept the brief and its outline price. Your setup stays here while you edit; it is not saved across reloads.</p>
    </AdminCard> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{mode === 'guided' ? 'Shape it together, or edit the summary directly.' : 'Already know what you need? Go straight to your outline.'}</p><button type="button" className={aiButton} disabled={disabled} onClick={changeDirection}>Back to my idea</button></div>
      {mode === 'guided' && <AdminCard className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide">{source}</p>
        {loading ? <p role="status">Finding a useful next step…</p> : advice?.question ? <>
          <h2 ref={question} tabIndex={-1} className="text-lg font-bold">{advice.question}</h2>
          <div className="flex flex-wrap gap-2">{advice.choices.map(c => <button type="button" key={c} className={`${aiButton} max-w-full text-left`} disabled={busy} onClick={() => choose(c)}>{c}</button>)}<button type="button" className={aiButton} disabled={busy} onClick={() => choose('Not sure yet')}>Not sure yet</button></div>
          <div className="flex flex-col gap-2 sm:flex-row"><label className="min-w-0 flex-1 text-sm">Or use your own words<input className={courseField} value={answer} maxLength={500} disabled={busy} onChange={e => setAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (answer.trim()) choose(answer); } }} /></label><button type="button" className={`${aiButton} self-end`} disabled={busy || !answer.trim()} onClick={() => choose(answer)}>Use my answer</button></div>
          <button type="button" className="text-sm font-bold underline underline-offset-4" disabled={busy} onClick={() => { setAdvice({ ...advice, question: '', choices: [] }); summary.current?.focus(); }}>Continue with the suggested brief</button>
        </> : <p role="status">Your brief is ready to review. Change anything before generating.</p>}
        {notice && <p role="status" className="text-sm leading-6">{notice}</p>}
      </AdminCard>}
      <AdminCard className="space-y-5"><div ref={summary} tabIndex={-1}><h2 className="text-xl font-bold">Your course so far</h2><p className="mt-2 text-sm leading-6">Edit this until it feels right. Suggested details are a starting point, not assumptions about your learners.</p></div>
        <label className="block text-sm font-bold">Learning goal {suggested.includes('need') && <span className="ml-2 text-xs font-normal">Suggested</span>}<textarea className={courseField} rows={3} maxLength={2000} value={brief.need} disabled={disabled} onChange={e => edit('need', e.target.value)} /></label>
        <label className="block text-sm font-bold">Who this will help {suggested.includes('audience') && <span className="ml-2 text-xs font-normal">Suggested</span>}<textarea className={courseField} rows={2} maxLength={500} value={brief.audience} disabled={disabled} placeholder="For example, new team members practising everyday decisions" onChange={e => edit('audience', e.target.value)} /></label>
        {!brief.audience.trim() && <button type="button" className={aiButton} disabled={disabled} onClick={() => { edit('audience', 'A general audience; no specialist knowledge assumed.'); setSuggested(current => [...current, 'audience']); }}>Suggest a broad audience</button>}
        <p className="text-xs">This guides the teaching. It does not change who can access the course.</p>
        <details><summary className="cursor-pointer text-sm font-bold">Course options · {brief.lessonCount} lessons · {brief.tone}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><label htmlFor="course-discovery-tone" className="text-sm font-bold">Tone</label><AdminSelect id="course-discovery-tone" value={brief.tone} disabled={disabled} onValueChange={value => edit('tone', value)} options={['Conversational', 'Formal', 'Inspirational', 'Direct'].map(t => ({label:t,value:t}))} /></div>
          <label className="text-sm font-bold">Number of lessons<input className={courseField} type="number" min={1} max={6} value={brief.lessonCount} disabled={disabled} onChange={e => edit('lessonCount', Number(e.target.value))} /></label>
        </div></details>
        <fieldset disabled={loading} aria-busy={loading}>{children}</fieldset>
      </AdminCard>
    </>}
  </div>;
}
