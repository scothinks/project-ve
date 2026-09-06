import assert from 'node:assert/strict';
import test from 'node:test';
import { pageAssistantInstructions, readPageAdvice } from '../../features/ai-generation/authoring/page-assistant.ts';

test('assistant considers teaching content rather than filling a page-type quota', () => {
  const prompt = pageAssistantInstructions({ existingPages: [{ title: 'Working together', pageType: 'concept', content: 'Listen before deciding how to help.' }] });
  assert.match(prompt, /Listen before deciding how to help/);
  assert.match(prompt, /not just headings or page count/);
  assert.match(prompt, /review_quiz/);
  assert.match(prompt, /empty instruction is a request for your judgment/);
});
test('a page recommendation may go earlier in the lesson and needs a concrete reason', () => {
  assert.equal(readPageAdvice({ decision: 'page', reason: 'An example before the summary makes this practical.', position: 2 }, 6).position, 2);
  for (const patch of [{ position: 8 }, { position: 1.5 }, { position: '2' }, { reason: '' }, { decision: 'publish' }]) {
    assert.throws(() => readPageAdvice({ decision: 'page', reason: 'Useful example', position: 2, ...patch }, 6));
  }
});
test('moving on requires nonempty, untruncated context and cannot hide a page in the result', () => {
  const advice = { decision: 'review_quiz', reason: 'The lesson has an explanation and a worked example.', position: 1, blocks: [] };
  assert.equal(readPageAdvice(advice, 6).decision, 'review_quiz');
  assert.throws(() => readPageAdvice(advice, 0));
  assert.throws(() => readPageAdvice(advice, 6, true));
  assert.throws(() => readPageAdvice({ ...advice, blocks: [{ blockType: 'text' }] }, 6));
});
