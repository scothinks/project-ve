import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { compareThemePixels, decodePng } from './pixels';

const registry = JSON.parse(readFileSync('docs/evidence/theme-adoption/registry.json', 'utf8'));
const tokens: string[] = registry.gate === 'G5' || registry.gate === 'G6'
  ? [...registry.roles.map((r: { token: string }) => r.token), '--ui-font-body']
  : registry.tokens.filter((t: { disposition: string }) => t.disposition !== 'DELETE_UNUSED').map((t: { token: string }) => t.token);
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

export async function captureTheme(page: Page, name: string) {
  const output = process.env.THEME_EVIDENCE_DIR ?? path.join('test-results', 'theme-adoption');
  if (process.env.THEME_CANDIDATE_MANIFEST && !/admin-(select|drawer)/.test(name)) await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect(page.locator('body')).toBeVisible();
  // Wait for deterministic local images and two painted frames, not a fixed sleep.
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter(i => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight).map(i => i.decode().catch(() => undefined)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  mkdirSync(output, { recursive: true });
  let bytes: Buffer = Buffer.alloc(0);
  let previous: Buffer | null = null;
  await expect.poll(async () => {
    bytes = await page.screenshot({ fullPage: !/admin-(select|drawer)/.test(name), animations: 'disabled', caret: 'hide' });
    // Chromium can vary curve-edge antialiasing between otherwise stable frames.
    // Apply the existing parity bound; moving geometry and flat-field changes fail.
    const stable = previous !== null && compareThemePixels(decodePng(previous), decodePng(bytes)).passed;
    previous = bytes;
    return stable;
  }, { message: `${name}: wait for two identical painted frames`, intervals: [100, 200, 400], timeout: 10_000 }).toBe(true);
  writeFileSync(path.join(output, `${name}.png`), bytes);
  const styles = await page.evaluate(names => {
    const properties = ['color','background-color','background-image','border-top-color','border-top-width','border-radius','outline-color','outline-width','outline-style','outline-offset','box-shadow','font-family','font-size','font-weight','line-height','color-scheme'];
    const values = (el: Element, pseudo: string | null = null) => Object.fromEntries(properties.map(p => [p, getComputedStyle(el, pseudo).getPropertyValue(p)]));
    const elements = [...document.querySelectorAll('body, main, header, nav, h1, h2, h3, p, a, button, input, textarea, select, [role="dialog"], [role="listbox"], [role="option"]')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const scopes = [...document.querySelectorAll('html, body, main, .learner-shell, .dashboard-shell, .admin-shell, [role="dialog"], [role="listbox"]')];
    return {
      elements: elements.map(el => ({ tag: el.tagName, role: el.getAttribute('role'), styles: values(el), placeholder: el.matches('input, textarea') ? values(el, '::placeholder') : null })),
      scopes: scopes.map(el => ({ tag: el.tagName, className: el.className, tokens: Object.fromEntries(names.map(n => [n, getComputedStyle(el).getPropertyValue(n).trim()])) })),
      focus: document.activeElement ? { tag: document.activeElement.tagName, visible: document.activeElement.matches(':focus-visible'), styles: values(document.activeElement) } : null,
    };
  }, tokens);
  const serialized = JSON.stringify(styles, null, 2) + '\n';
  writeFileSync(path.join(output, `${name}.styles.json`), serialized);
  if (process.env.THEME_CANDIDATE_MANIFEST) {
    const pairs = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext('2d')!;
      function rgba(value: string) {
        context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
      }
      const over = (a: number[], b: number[]) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3])).concat(1);
      const luminance = (rgb: number[]) => rgb.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const imageRects = [...document.querySelectorAll('img,video,canvas')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => el.getBoundingClientRect());
      return [...document.querySelectorAll('h1,h2,h3,p,a,button,input,label,span')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && (el.matches('input') || [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()))).map(el => {
        const style = getComputedStyle(el); const ancestors: Element[] = [];
        for (let parent: Element | null = el; parent; parent = parent.parentElement) ancestors.unshift(parent);
        let background = [255, 255, 255, 1]; let complex = false; let groupEffect = false;
        for (const ancestor of ancestors) {
          const computed = getComputedStyle(ancestor);
          const layer = rgba(computed.backgroundColor);
          // An opaque child surface obscures a gradient behind it.
          if (layer[3] === 1) complex = false;
          if (computed.backgroundImage !== 'none') complex = true;
          if (Number(computed.opacity) < 1) groupEffect = true;
          for (const pseudo of ['::before', '::after']) {
            const decoration = getComputedStyle(ancestor, pseudo);
            if (!['none', 'normal'].includes(decoration.content) && decoration.backgroundColor !== 'rgba(0, 0, 0, 0)') groupEffect = true;
          }
          background = over(layer, background);
        }
        const rect = el.getBoundingClientRect();
        const imageOverlap = imageRects.some(image => rect.left < image.right && rect.right > image.left && rect.top < image.bottom && rect.bottom > image.top);
        const foreground = over(rgba(style.color), background);
        const a = luminance(foreground), b = luminance(background);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        const disabled = Boolean(el.closest(':disabled,[aria-disabled="true"]'));
        return { tag: el.tagName, text: (el.textContent ?? '').trim().slice(0, 100), foreground, background, ratio, minimum: large ? 3 : 4.5, disabled, imageOverlap, complex: complex || groupEffect || imageOverlap, passes: disabled || complex || groupEffect || imageOverlap ? null : ratio >= (large ? 3 : 4.5) };
      });
    });
    writeFileSync(path.join(output, `${name}.contrast.json`), JSON.stringify(pairs, null, 2) + '\n');
    expect(pairs.filter(pair => pair.passes === false), `${name}: readable text on flat rendered backgrounds`).toEqual([]);
  }
  const fonts = process.env.THEME_CANDIDATE_MANIFEST ? await page.evaluate(() => ({
    requested: performance.getEntriesByType('resource').filter(entry => /\.woff2(?:\?|$)/.test(entry.name)).map(entry => {
      const resource = entry as PerformanceResourceTiming;
      return { path: new URL(resource.name).pathname, transferBytes: resource.transferSize, encodedBytes: resource.encodedBodySize };
    }),
    loaded: [...document.fonts].filter(face => face.status === 'loaded').map(face => ({ family: face.family, style: face.style, weight: face.weight })),
    preloads: [...document.querySelectorAll('link[rel="preload"][as="font"]')].map(link => link.getAttribute('href')),
  })) : null;
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const candidate = process.env.THEME_CANDIDATE_MANIFEST ? JSON.parse(readFileSync(process.env.THEME_CANDIDATE_MANIFEST, 'utf8')) : null;
  writeFileSync(path.join(output, `${name}.evidence.json`), JSON.stringify({ sourceSha, ...(candidate ? { sourceSha256: candidate.sourceSha256, buildId: candidate.buildId, captureHelperSha256: digest(readFileSync('tests/support/theme-adoption/capture.ts')), fonts } : {}), name, viewport: page.viewportSize(), browser: page.context().browser()?.version(), imageSha256: digest(bytes), stylesSha256: digest(serialized) }, null, 2) + '\n');
  if (process.env.THEME_COMPARE_DIR) {
    const baseline = process.env.THEME_COMPARE_DIR;
    expect(styles, `${name}: computed colour/font/focus parity`).toEqual(JSON.parse(readFileSync(path.join(baseline, `${name}.styles.json`), 'utf8')));
    const comparison = compareThemePixels(decodePng(readFileSync(path.join(baseline, `${name}.png`))), decodePng(bytes));
    writeFileSync(path.join(output, `${name}.comparison.json`), JSON.stringify(comparison, null, 2) + '\n');
    expect(comparison.passed, `${name}: screenshot parity ${JSON.stringify(comparison)}`).toBe(true);
  }
}
