import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseSource, scanProduction } from '../../scripts/theme-contract/source.mjs';
import { checkContract } from '../../scripts/theme-contract/policy.mjs';

const scan = css => ({ ...parseSource('app/styles/theme-compat.css', css), hazards: [] });
function registry(baseline, overrides = {}) {
  return { gate: 'G0', retired: [], tokens: [...new Set(baseline.entries.map(e => e.value))].map(token => ({ token, removal_gate: 'G5' })),
    occurrences: baseline.entries.map(e => ({ ...e, owner: 'B5', disposition: 'retire', reason: 'fixture baseline' })), adapters: [], roles: [], undefinedDefects: [], ...overrides };
}
test('cycles fail even when every occurrence is registered', () => {
  const input = scan(':root { --ve-a: var(--ve-b); --ve-b: var(--ve-a); }');
  assert.match(checkContract(input, registry(input)).join('\n'), /token cycle/);
});
test('chained adapters and reverse semantic aliases fail', () => {
  const input = scan(':root { --ve-card: var(--ui-surface); --ui-surface: var(--ui-canvas); --ui-canvas: #fff; } .card { color:var(--ve-card) }');
  assert.match(checkContract(input, registry(input, { gate: 'G2', adapters: [{ token: '--ve-card', target: '--ui-surface', removeBy: 'G5' }] })).join('\n'), /semantic role must be terminal|chained adapter/);
});
test('missing references fail; documenting an occurrence does not define a token', () => {
  const input = scan('.card { color: var(--ve-missing); }');
  assert.match(checkContract(input, registry(input)).join('\n'), /missing token/);
});
test('moving a consumer while retaining the count fails the exact occurrence ratchet', () => {
  const before = scan(':root { --ve-card: #fff; } .a { color:var(--ve-card) }');
  const after = scan(':root { --ve-card: #fff; } .b { color:var(--ve-card) }');
  assert.match(checkContract(after, registry(before)).join('\n'), /new unclassified/);
});
test('expired adapters fail even with otherwise valid one-hop definitions', () => {
  const input = scan(':root { --ve-card: var(--ui-surface); --ui-surface: #fff; } .card { color: var(--ve-card) }');
  assert.match(checkContract(input, registry(input, { gate: 'G5', adapters: [{ token: '--ve-card', target: '--ui-surface', removeBy: 'G5' }] })).join('\n'), /expired adapter|zero-legacy/);
});
test('retired names cannot be reintroduced through inline source or CSS', () => {
  const input = parseSource('components/New.tsx', 'const style = { color: "var(--ve-dead)" };');
  assert.match(checkContract(input, registry(input, { retired: ['--ve-dead'] })).join('\n'), /retired token/);
});
test('AST decodes escaped references, ignores comments and distinguishes BEM classes', () => {
  const input = parseSource('components/New.tsx', '// var(--ve-comment)\nconst css = "var(\\u002d\\u002dve-live) card--compact";');
  assert.deepEqual(input.entries.filter(e => e.kind === 'reference').map(e => e.value), ['--ve-live']);
});
test('complete conditional class tokens are enumerable; interpolated names and CSSOM are blocked', () => {
  const safe = parseSource('components/New.tsx', 'const a = `${ok ? "text-[var(--ve-a)]" : "text-[var(--ve-b)]"} p-2`;');
  assert.deepEqual(safe.hazards, []);
  assert.equal(safe.entries.filter(e => e.kind === 'reference').length, 2);
  for (const source of ['const a = `var(--ve-${name})`;', 'el.style.setProperty(name, value);', 'sheet.insertRule(rule);', 'el.style.cssText = css;']) {
    assert.ok(parseSource('components/New.tsx', source).hazards.length, source);
  }
});
test('untracked production files and imports outside the usual roots are scanned', () => {
  const root = mkdtempSync(path.join(tmpdir(), 've-theme-contract-'));
  try {
    mkdirSync(path.join(root, 'app')); mkdirSync(path.join(root, 'shared'));
    writeFileSync(path.join(root, 'app/page.tsx'), 'import "../shared/theme.css"; const x = "var(--ve-new)";');
    writeFileSync(path.join(root, 'shared/theme.css'), ':root { --ve-new: #fff; }');
    const input = scanProduction(root);
    assert.deepEqual(Object.keys(input.files), ['app/page.tsx', 'shared/theme.css']);
    assert.equal(input.entries.filter(e => e.value === '--ve-new').length, 2);
    assert.match(checkContract(input, registry({ entries: [] })).join('\n'), /new unclassified/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('new colour literals cannot bypass the registry', () => {
  const input = parseSource('components/New.tsx', 'const classes = "text-red-500 bg-[#ff00ff]";');
  assert.equal(input.entries.filter(e => e.kind === 'colour').length, 2);
  assert.match(checkContract(input, registry({ entries: [] })).join('\n'), /new unclassified colour/);
});
