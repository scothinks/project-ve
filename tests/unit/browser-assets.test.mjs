import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/og') return next('next/og.js', context);
    if (specifier.endsWith('/BrowserIcon')) return next(`${specifier}.tsx`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (/\/(?:components\/brand\/BrowserIcon\.tsx|app\/(?:icon\/route\.ts|apple-icon\.tsx|manifest\.ts))$/.test(url)) return {
      shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});
const { GET } = await import('../../app/icon/route.ts');
const { default: appleIcon } = await import('../../app/apple-icon.tsx');
const { default: manifest } = await import('../../app/manifest.ts');
hooks.deregister();

test('static browser/install exports exactly render the frozen geometry with 24-unit clear space', async () => {
  const geometry = read('public/brand/aperture-a2.svg').match(/\bd="([^"]+)"/)[1];
  assert.equal(read('components/brand/BrowserIcon.tsx').match(/const aperturePath = "([^"]+)"/)[1], geometry);
  assert.match(read('components/brand/BrowserIcon.tsx'), /viewBox="-24 -24 144 144"/);
  for (const size of [32, 180, 192, 512, 96]) {
    const badge = size === 96;
    const file = new URL(`public/brand/aperture-a2-${badge ? 'badge-' : ''}${size}.png`, root);
    const actual = sharp(readFileSync(file));
    const metadata = await actual.metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
    const expected = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-24 -24 144 144">${badge ? '' : '<rect x="-24" y="-24" width="144" height="144" fill="#f6f3ed"/>'}<path fill="${badge ? '#ffffff' : '#583c63'}" d="${geometry}"/></svg>`;
    assert.deepEqual(await actual.ensureAlpha().raw().toBuffer(), await sharp(Buffer.from(expected)).ensureAlpha().raw().toBuffer());
  }
});

test('legacy icon endpoint returns actual requested PNG sizes with bounded fallback', async () => {
  for (const [query, size] of [['', 512], ['?size=32', 32], ['?size=192', 192], ['?size=512', 512], ['?size=99999', 512], ['?size=invalid', 512]]) {
    const response = GET(new Request(`http://localhost/icon${query}`));
    assert.equal(response.headers.get('content-type'), 'image/png');
    const bytes = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, size, query);
    assert.equal(metadata.height, size, query);
    const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...pixels.subarray(0, 4)], [246, 243, 237, 255]);
    assert.ok(pixels.some((value, index) => index % 4 === 0 && value === 88), 'Aperture action ink is rendered');
  }
  const apple = await sharp(Buffer.from(await appleIcon().arrayBuffer())).metadata();
  assert.equal(apple.width, 180);
  assert.equal(apple.height, 180);
});

test('manifest, metadata and notification assets declare the files and sizes actually shipped', async () => {
  const data = manifest();
  assert.equal(data.name, 'Project VE');
  assert.equal(data.short_name, 'Project VE');
  assert.equal(data.start_url, '/');
  assert.equal(data.background_color, '#f6f3ed');
  assert.equal(data.theme_color, '#f6f3ed');
  assert.doesNotMatch(data.description, /values education/i);
  for (const icon of data.icons) {
    const metadata = await sharp(readFileSync(new URL(`public${icon.src}`, root))).metadata();
    assert.equal(icon.sizes, `${metadata.width}x${metadata.height}`);
    assert.equal(icon.type, 'image/png');
  }
  const layout = read('app/layout.tsx');
  assert.match(layout, /aperture-a2-32\.png/);
  assert.match(layout, /aperture-a2-180\.png/);
  assert.match(layout, /prefers-color-scheme: light.*#f6f3ed/);
  assert.match(layout, /prefers-color-scheme: dark.*#201c23/);
  const serviceWorker = read('app/sw.js/route.ts');
  assert.match(serviceWorker, /icon: "\/brand\/aperture-a2-192\.png"/);
  assert.match(serviceWorker, /badge: "\/brand\/aperture-a2-badge-96\.png"/);
});
