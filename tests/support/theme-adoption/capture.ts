import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

const registry = JSON.parse(readFileSync('docs/evidence/theme-adoption/registry.json', 'utf8'));
const tokens: string[] = registry.tokens.filter((t: { disposition: string }) => t.disposition !== 'DELETE_UNUSED').map((t: { token: string }) => t.token);
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

export async function captureTheme(page: Page, name: string) {
  const output = process.env.THEME_EVIDENCE_DIR ?? path.join('test-results', 'theme-adoption');
  await page.evaluate(async () => { await document.fonts.ready; });
  await expect(page.locator('body')).toBeVisible();
  // Wait for deterministic local images and two painted frames, not a fixed sleep.
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter(i => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight).map(i => i.decode().catch(() => undefined)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  mkdirSync(output, { recursive: true });
  let bytes: Buffer = Buffer.alloc(0);
  let previous = '';
  await expect.poll(async () => {
    bytes = await page.screenshot({ fullPage: !/admin-(select|drawer)/.test(name), animations: 'disabled', caret: 'hide' });
    const current = digest(bytes);
    const stable = current === previous;
    previous = current;
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
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(path.join(output, `${name}.evidence.json`), JSON.stringify({ sourceSha, name, viewport: page.viewportSize(), browser: page.context().browser()?.version(), imageSha256: digest(bytes), stylesSha256: digest(serialized) }, null, 2) + '\n');
  if (process.env.THEME_COMPARE_DIR) {
    const baseline = process.env.THEME_COMPARE_DIR;
    expect(styles, `${name}: computed colour/font/focus parity`).toEqual(JSON.parse(readFileSync(path.join(baseline, `${name}.styles.json`), 'utf8')));
    expect(digest(bytes), `${name}: exact screenshot parity`).toBe(digest(readFileSync(path.join(baseline, `${name}.png`))));
  }
}
