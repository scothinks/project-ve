import { sanitizeRichTextHtml } from '@/lib/rich-text';
import { normalizeMediaPlaceholder } from '@/lib/media-intent';
import type { AssistanceCandidate, AssistanceContext } from './assistance-contracts.ts';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid candidate.');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > limit) throw new Error('Invalid candidate text.');
  return value.trim();
}
function items(value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error('Unexpected item count.');
  return value;
}
export function validateAssistance(value: unknown, context: AssistanceContext): AssistanceCandidate {
  const candidate = record(value);
  const title = text(candidate.title, 180);
  if (context.kind === 'quiz') {
    if (!context.lessons.some(l => l.pages?.some(p => p.content.trim()))) throw new Error('Save teaching content before generating questions.');
    const seen = new Set(context.existingQuestions.map(p => p.trim().toLowerCase()));
    const questions = items(candidate.questions, context.count, context.count).map(value => {
      const q = record(value); const prompt = text(q.prompt, 500);
      if (q.questionType !== 'single_choice' || q.xp !== 10 || seen.has(prompt.toLowerCase())) throw new Error('Invalid or repeated question.');
      seen.add(prompt.toLowerCase());
      const options = items(q.options, 2, 4).map(value => {
        const o = record(value); if (typeof o.isCorrect !== 'boolean') throw new Error('Invalid answer key.');
        return { label: text(o.label, 300), isCorrect: o.isCorrect };
      });
      if (options.filter(o => o.isCorrect).length !== 1 || new Set(options.map(o => o.label.toLowerCase())).size !== options.length) throw new Error('Check the answer options.');
      return { prompt, questionType: 'single_choice' as const, xp: 10 as const, explanation: text(q.explanation, 1000), options };
    });
    return { title, questions };
  }
  if (context.kind === 'lesson_plan') return { title, suggestions: items(candidate.suggestions, 1, context.count).map(value => {
    const s = record(value); return { title: text(s.title, 180), description: text(s.description, 1000), reason: text(s.reason, 1000) };
  }) };
  const pages = items(candidate.pages, 1, 4).map(value => {
    const p = record(value);
    if (!['concept', 'scenario', 'reflection', 'summary'].includes(String(p.pageType))) throw new Error('Invalid page type.');
    const blocks = items(p.blocks, 1, 4).map(value => {
      const b = record(value); const payload = record(b.payload); const kind = String(b.blockType);
      if (['image', 'audio', 'video'].includes(kind)) return { blockType: kind as 'image' | 'audio' | 'video', payload: normalizeMediaPlaceholder(kind, payload) };
      if (kind === 'text' || kind === 'callout') {
        const body = sanitizeRichTextHtml(text(payload.body, 6000), 6000);
        if (!body.replace(/<[^>]*>/g, '').trim()) throw new Error('Teaching content is empty.');
        return kind === 'text' ? { blockType: 'text' as const, payload: { heading: text(payload.heading ?? '', 180, true), body } }
          : { blockType: 'callout' as const, payload: { title: text(payload.title, 180), variant: ['key_point', 'tip', 'warning'].includes(String(payload.variant)) ? String(payload.variant) : 'key_point', body } };
      }
      if (kind === 'table') {
        const columns = items(payload.columns, 1, 6).map(v => text(v, 180));
        const rows = items(payload.rows, 1, 12).map(v => items(v, columns.length, columns.length).map(v => text(v, 500)));
        return { blockType: 'table' as const, payload: { columns, rows } };
      }
      throw new Error('Unsupported teaching block.');
    });
    if (!blocks.some(b => ['text', 'callout', 'table'].includes(b.blockType))) throw new Error('Teaching content required.');
    return { title: text(p.title, 180), subtitle: text(p.subtitle ?? '', 300, true), pageType: p.pageType as 'concept' | 'scenario' | 'reflection' | 'summary', blocks };
  });
  return { title, description: text(candidate.description, 1000), pages };
}
