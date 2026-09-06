import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaGenerationBrief, MEDIA_BRIEF_MAX_LENGTH } from '../../features/learning/admin/media-generation-brief.ts';

const payload = { mediaIntent: { version: 1, kind: 'image', purpose: 'Show how neighbours cooperate', aspectRatio: '16:9', required: false, style: 'inherit' } };
const context = {
  lesson: { title: 'Our community', description: 'Working together locally' },
  page: { title: 'Listen first', subtitle: 'Everyone has a role' },
  blocks: [
    { block_type: 'text', payload: { heading: 'Cooperation', body: '<p>Listen &amp; learn.</p><script>bad()</script>' } },
    { block_type: 'table', payload: { columns: ['Role'], rows: [['Neighbour']] } },
    { block_type: 'image', payload: { src: 'private-media-url', alt: 'Do not include asset data' } },
  ],
};
test('brief carries purpose and current lesson/page teaching context without imposing a style', () => {
  const brief = mediaGenerationBrief(payload, context);
  for (const text of ['Show how neighbours cooperate', 'Our community', 'Working together locally', 'Listen first', 'Everyone has a role', 'Listen & learn.', 'Neighbour', '16:9']) assert.ok(brief.includes(text));
  assert.doesNotMatch(brief, /<p>|bad\(\)|private-media-url|cartoon|brown|inherit/);
  assert.match(mediaGenerationBrief(payload, { ...context, lesson: { title: 'Updated lesson' } }), /Updated lesson/);
});
test('edited and deliberately cleared briefs survive recomputation; manual blocks stay unprompted', () => {
  assert.equal(mediaGenerationBrief({ ...payload, mediaBrief: 'My photographic direction' }, context), 'My photographic direction');
  assert.equal(mediaGenerationBrief({ ...payload, mediaBrief: '' }, context), '');
  assert.equal(mediaGenerationBrief({}, context), undefined);
});
test('brief input is bounded for large lesson content', () => {
  const large = mediaGenerationBrief(payload, { ...context, blocks: Array.from({ length: 100 }, () => ({ block_type: 'text', payload: { body: 'Long content '.repeat(2000) } })) });
  assert.ok(large.length <= MEDIA_BRIEF_MAX_LENGTH);
  assert.equal(mediaGenerationBrief({ mediaBrief: 'x'.repeat(9000) }, context).length, MEDIA_BRIEF_MAX_LENGTH);
});
