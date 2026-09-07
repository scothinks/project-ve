import type { CourseBrief } from './course-contracts.ts';

export const discoveryStarters = ['Handle disagreements', 'Make fair decisions', 'Build trust'];
export const learnerChoices = ['At work', 'In education', 'In a community group', 'In everyday life'];
export type DiscoveryAnswer = { question: string; answer: string };
export type DiscoveryInput = { seed: string; answers: DiscoveryAnswer[]; brief: CourseBrief };
export type DiscoveryAdvice = {
  brief: CourseBrief;
  question: string;
  choices: string[];
  suggestedFields: Array<'need' | 'audience'>;
};
export type DiscoveryResponse = { advice: DiscoveryAdvice; source: 'assistant' | 'starter'; notice?: string };
const tones = ['Conversational', 'Formal', 'Inspirational', 'Direct'];

function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error('Keep your idea and answers short enough to review.');
  return value.trim();
}
export function validateCourseBrief(value: unknown): CourseBrief {
  if (!value || typeof value !== 'object') throw new Error('Review your course idea first.');
  const b = value as CourseBrief;
  if (!Number.isInteger(b.lessonCount) || b.lessonCount < 1 || b.lessonCount > 6 || !tones.includes(b.tone)) throw new Error('Choose a tone and one to six lessons.');
  return { need: text(b.need, 2000), audience: text(b.audience, 500), tone: b.tone, lessonCount: b.lessonCount };
}
export function validateDiscoveryInput(value: unknown): DiscoveryInput {
  if (!value || typeof value !== 'object') throw new Error('Add an idea or choose a starting point.');
  const v = value as DiscoveryInput;
  if (!Array.isArray(v.answers) || v.answers.length > 3) throw new Error('Review the proposed brief to continue.');
  const result = { seed: text(v.seed, 1200), answers: v.answers.map(a => ({ question: text(a.question, 300), answer: text(a.answer, 500) })), brief: validateCourseBrief(v.brief) };
  if (JSON.stringify(result).length > 7000) throw new Error('Shorten the idea or answers before continuing.');
  return result;
}
export function validateDiscoveryAdvice(value: unknown): DiscoveryAdvice {
  if (!value || typeof value !== 'object') throw new Error('The suggestion could not be read.');
  const v = value as DiscoveryAdvice;
  if (!Array.isArray(v.choices) || v.choices.length > 3 || !Array.isArray(v.suggestedFields)
    || v.suggestedFields.some(f => f !== 'need' && f !== 'audience')) throw new Error('The suggestion could not be read.');
  const question = text(v.question, 300, true);
  const choices = v.choices.map(c => text(c, 300));
  if (!question && choices.length) throw new Error('Suggestions need a question.');
  return { brief: validateCourseBrief(v.brief), question, choices, suggestedFields: [...new Set(v.suggestedFields)] };
}

// Bundled prompts remain usable without a provider. They are labelled starting
// suggestions, never presented as an AI diagnosis or as confirmed learner facts.
export function starterAdvice(input: DiscoveryInput): DiscoveryAdvice {
  const { seed, answers, brief } = input;
  const need = answers[0]?.answer && answers[0].answer !== 'Not sure yet' ? `${seed}: ${answers[0].answer}` : seed;
  const audience = answers[1]?.answer && answers[1].answer !== 'Not sure yet'
    ? learnerChoices.includes(answers[1].answer)
      ? `Learners applying this ${answers[1].answer.toLowerCase()}; no specialist knowledge assumed.`
      : answers[1].answer
    : brief.audience || 'A general audience; no specialist knowledge assumed.';
  const choices = /toleran|disagree|conflict/i.test(seed)
    ? ['Disagree respectfully', 'Work across differences', 'Respond to exclusion']
    : /trust|honest|integrity/i.test(seed)
      ? ['Keep commitments', 'Speak honestly when it is difficult', 'Rebuild trust after mistakes']
      : ['Understand the basics', 'Apply this in everyday situations', 'Make thoughtful decisions'];
  return {
    brief: { ...brief, need, audience },
    question: answers.length === 0 ? 'What would you like learners to be able to do?' : answers.length === 1 ? 'Where will they use this?' : '',
    choices: answers.length === 0 ? choices : answers.length === 1 ? learnerChoices.slice(0, 3) : [],
    suggestedFields: ['need', 'audience'],
  };
}
