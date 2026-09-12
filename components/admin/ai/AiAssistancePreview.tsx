"use client";
import { LessonPageCard } from '@/components/lesson/LessonPageLayout';
import { mapPreviewBlock } from '@/features/learning/admin/lesson-page-builder-domain';
import type { AssistanceResult } from '@/features/ai-generation/authoring/assistance-contracts';
import { aiButton } from './AiPageResult';
export function AiAssistancePreview({ result, selection, setSelection, disabled, onDraft }: {
  result: AssistanceResult; selection: number[]; setSelection: (items: number[]) => void; disabled: boolean; onDraft?: (index: number) => void;
}) {
  const candidate = result.candidate;
  if (!candidate) return null;
  return <section className="space-y-5" aria-label="Generated result">
    <h3 className="text-xl font-extrabold">{candidate.title}</h3>
    {'questions' in candidate && candidate.questions.map((q, i) => <article key={i} className="space-y-3 rounded-2xl border border-[var(--ui-border-subtle)] p-5">
      <label className="flex items-start gap-3 font-bold"><input type="checkbox" aria-label={`Select question ${i + 1}`} disabled={disabled} checked={selection.includes(i)} onChange={e => setSelection(e.target.checked ? [...selection, i].sort() : selection.filter(n => n !== i))} />{q.prompt}</label>
      <ul className="space-y-2 text-sm">{q.options.map((o, n) => <li key={n}>{o.label}{o.isCorrect && <strong> · Correct answer</strong>}</li>)}</ul>
      <p className="text-sm leading-6"><strong>Explanation: </strong>{q.explanation}</p>
    </article>)}
    {'suggestions' in candidate && candidate.suggestions.map((s, i) => <article key={i} className="space-y-3 rounded-2xl border border-[var(--ui-border-subtle)] p-5">
      <h4 className="font-extrabold">{s.title}</h4><p className="text-sm leading-6">{s.description}</p><p className="text-sm leading-6">{s.reason}</p>
      {onDraft && <button className={aiButton} type="button" disabled={disabled} onClick={() => onDraft(i)}>Draft this lesson</button>}
    </article>)}
    {'pages' in candidate && <><p className="text-sm leading-6">{candidate.description}</p>{candidate.pages.map((p, i) => <LessonPageCard key={i} isPreview title={p.title} subtitle={p.subtitle} pageType={p.pageType === 'scenario' ? 'example' : p.pageType}
      blocks={p.blocks.map((b, j) => mapPreviewBlock({ id: `${result.id}-${i}-${j}`, page_id: result.id, block_type: b.blockType, payload: b.payload, sort_order: j + 1 }))} />)}</>}
  </section>;
}
