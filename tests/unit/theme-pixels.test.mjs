import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareThemePixels } from '../support/theme-adoption/pixels.ts';
const image = () => ({ width: 8, height: 8, data: new Uint8Array(8 * 8 * 4).fill(255) });
function edge() { const i = image(); i.data.fill(0, 0, 4); i.data[3] = 255; return i; }
test('identical pixels pass independently of PNG encoding', () => assert.equal(compareThemePixels(image(), image()).passed, true));
test('a one-level change in a flat field is rejected', () => {
  const a = image(), b = image(); b.data[40]--;
  assert.equal(compareThemePixels(a, b).passed, false);
});
test('tiny antialiasing variation is accepted only at an existing edge', () => {
  const a = edge(), b = edge(); b.data[0] = 2;
  assert.equal(compareThemePixels(a, b).passed, true);
  b.data[0] = 3; assert.equal(compareThemePixels(a, b).passed, false);
});
test('geometry, alpha changes and widespread edge variation are rejected', () => {
  assert.equal(compareThemePixels(image(), { ...image(), width: 9 }).passed, false);
  const a = edge(), b = edge(); b.data[3] = 254;
  assert.equal(compareThemePixels(a, b).passed, false);
  b.data[3] = 255; b.data[0] = 1; b.data[4] = 254;
  assert.equal(compareThemePixels(a, b).passed, false);
});
