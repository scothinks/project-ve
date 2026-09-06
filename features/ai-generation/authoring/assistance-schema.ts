import type { AssistanceKind } from './assistance-contracts.ts';
const str = { type: 'string' };
const object = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const array = (items: unknown) => ({ type: 'array', items });
const choice = (...values: string[]) => ({ type: 'string', enum: values });
const block = (kind: string, payload: Record<string, unknown>) => object({ blockType: choice(kind), payload: object(payload) });
export const assistanceBlocks = { anyOf: [
  block('text', { heading: str, body: str }),
  block('callout', { variant: choice('key_point', 'tip', 'warning'), title: str, body: str }),
  block('table', { columns: array(str), rows: array(array(str)) }),
  ...['image', 'audio', 'video'].map(kind => block(kind, { src: { type: 'string', enum: [''] }, mediaIntent: object({
    version: { type: 'integer', enum: [1] }, kind: choice(kind), purpose: str,
    aspectRatio: choice('16:9', '4:3', '1:1'), required: { type: 'boolean', enum: [false] }, style: choice('inherit'),
  }) })),
] };
export function assistanceSchema(kind: AssistanceKind) {
  if (kind === 'quiz') return object({ title: str, questions: array(object({ prompt: str, questionType: choice('single_choice'), explanation: str,
    xp: { type: 'integer', enum: [10] }, options: array(object({ label: str, isCorrect: { type: 'boolean' } })),
  })) });
  if (kind === 'lesson_plan') return object({ title: str, suggestions: array(object({ title: str, description: str, reason: str })) });
  return object({ title: str, description: str, pages: array(object({ title: str, subtitle: str,
    pageType: choice('concept', 'scenario', 'reflection', 'summary'), blocks: array(assistanceBlocks),
  })) });
}
