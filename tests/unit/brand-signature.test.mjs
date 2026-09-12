import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';

const root = new URL('../../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './BrandSignature') return next('./BrandSignature.tsx', context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/BrandSignature.module.css')) return {
      shortCircuit: true, format: 'module',
      source: 'export default new Proxy({}, {get: (_, name) => name});',
    };
    if (/\/components\/brand\/\w+\.tsx$/.test(url)) return {
      shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});
const { BrandSignature } = await import('../../components/brand/BrandSignature.tsx');
const { PlatformEndorsement } = await import('../../components/brand/PlatformEndorsement.tsx');
hooks.deregister();
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('horizontal, compact and icon-only signatures have one canonical accessible name', () => {
  for (const layout of ['horizontal', 'compact']) {
    for (const markSize of [16, 20, 24, 32]) {
      const html = render(BrandSignature, { layout, markSize });
      assert.equal((html.match(/aria-label="Project VE"/g) ?? []).length, 1);
      assert.equal((html.match(/role="img"/g) ?? []).length, 1);
      assert.match(html, /aria-hidden="true" class="words"/);
      assert.match(html, /project<\/span><span class="ve">v<span class="slash">\/<\/span>e/);
      assert.match(html, new RegExp(`width:${markSize}px;height:${markSize}px`));
      assert.equal((html.match(/class="mark"/g) ?? []).length, 1);
    }
  }
  const icon = render(BrandSignature, { markOnly: true });
  assert.match(icon, /aria-label="Project VE"/);
  assert.doesNotMatch(icon, /class="words"/);
  assert.doesNotMatch(render(BrandSignature, { decorative: true }), /aria-label|role="img"/);
});

test('endorsement exposes one phrase, with all visual fragments decorative', () => {
  const html = render(PlatformEndorsement);
  assert.equal((html.match(/aria-label=/g) ?? []).length, 1);
  assert.match(html, /aria-label="Learning on Project VE"/);
  assert.equal((html.match(/role="img"/g) ?? []).length, 1);
  assert.match(html, /aria-hidden="true" class="signature/);
});

test('Aperture geometry exactly matches the frozen A.2 export', () => {
  const frozen = read('docs/evidence/theme-adoption/b3-frozen-aperture.svg');
  const current = read('public/brand/aperture-a2.svg');
  assert.deepEqual([...current.matchAll(/\bd="([^"]+)"/g)].map(m => m[1]), [...frozen.matchAll(/\bd="([^"]+)"/g)].map(m => m[1]));
  assert.equal(current.match(/viewBox="([^"]+)"/)[1], frozen.match(/viewBox="([^"]+)"/)[1]);
});

test('Open recipe and scoped descendants resist inherited uppercase and circular slots', () => {
  const css = postcss.parse(read('components/brand/BrandSignature.module.css'));
  const declarations = selector => Object.fromEntries(css.nodes.find(n => n.selector === selector).nodes.map(n => [n.prop, n.value]));
  const signature = declarations('.signature');
  assert.equal(signature['font-weight'], '600');
  assert.equal(signature['letter-spacing'], '-0.018em');
  assert.equal(signature['text-transform'], 'none');
  assert.equal(signature.gap, '7px');
  assert.equal(signature['font-size'], '1rem');
  assert.equal(declarations('.words').gap, '0.22em');
  assert.equal(declarations('.slash')['font-weight'], '500');
  assert.equal(declarations('.slash')['margin-inline'], '0.035em');
  assert.equal(declarations('.compact .words')['flex-direction'], 'column');
  assert.match(declarations('.mark').mask, /aperture-a2\.svg/);
  assert.doesNotMatch(read('app/globals.css'), /\.org-desktop-chrome__brand span\s*\{/);
});

test('approved font payload and coverage fallback assets stay within the fixed budgets', () => {
  const payload = JSON.parse(read('docs/evidence/theme-adoption/b3-font-payload.json'));
  const faces = [...payload.fonts, ...payload.coverageFallback];
  let total = 0;
  for (const face of faces) {
    const bytes = readFileSync(new URL(face.path, root));
    assert.equal(bytes.length, face.bytes, face.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), face.sha256, face.path);
    total += bytes.length;
  }
  assert.equal(total, payload.totalWoff2Bytes);
  assert.ok(total <= payload.budget.totalWoff2Bytes);
  assert.ok(payload.fonts.find(f => f.name === 'SourceSans3').bytes <= payload.budget.normalBodyBytes);
  assert.ok(payload.fonts.filter(f => f.name.startsWith('SourceSans3')).reduce((sum, f) => sum + f.bytes, 0) <= payload.budget.sansWithItalicsBytes);
  assert.ok(payload.fonts.every(f => f.coveragePreserved));
  for (const face of payload.coverageFallback) {
    for (const cp of payload.missingFromSourceSans) {
      assert.ok(face.codepoints.includes(cp));
      assert.ok(read('app/fonts/coverage.css').includes(`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`));
    }
    const original = readFileSync(new URL(face.sourcePath, root));
    assert.equal(createHash('sha256').update(original).digest('hex'), face.sourceSha256);
  }
});

test('real italic faces load on demand and Serif is absent from the root layout', () => {
  for (const file of ['app/fonts/body.ts', 'app/fonts/display.ts']) {
    const loader = read(file);
    assert.match(loader, /preload: false/);
    assert.match(loader, /Italic\.woff2", weight: "200 900", style: "italic"/);
    assert.match(loader, /\.woff2", weight: "200 900", style: "normal"/);
  }
  assert.doesNotMatch(read('app/layout.tsx'), /fonts\/display|SourceSerif|font-geist/);
  assert.match(read('app/org/page.tsx'), /displayFont\.variable/);
  assert.doesNotMatch(read('app/globals.css'), /--font-geist|--learner-body-font/);
});
