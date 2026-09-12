import { expect, type Page } from '@playwright/test';
import { captureTheme } from './capture';

/** Supplemental specimen made from the built signature markup; not a product page. */
export async function captureTypographySpecimen(page: Page) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/login');
    await expect(page.locator('[role="img"][aria-label="Project VE"]').first()).toBeAttached();
    await page.evaluate(() => {
      const signature = document.querySelector('[role="img"][aria-label="Project VE"]')!;
      const panel = document.createElement('main');
      panel.style.cssText = 'padding:24px;display:grid;gap:24px;color:var(--ui-text);background:var(--ui-canvas)';
      const title = document.createElement('h1'); title.textContent = 'Typography specimen'; panel.append(title);
      for (const size of [16, 20, 24, 32]) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:16px';
        const label = document.createElement('span'); label.textContent = `${size}px`;
        const clone = signature.cloneNode(true) as HTMLElement;
        const mark = clone.firstElementChild as HTMLElement;
        mark.style.width = `${size}px`; mark.style.height = `${size}px`;
        row.append(label, clone); panel.append(row);
      }
      const paragraph = document.createElement('p');
      paragraph.textContent = '0123456789 · £ € ₦ · Café · Ọmọlúàbí · Ελληνικά · Кириллица';
      const italic = document.createElement('em');
      italic.style.fontSynthesis = 'none'; italic.textContent = 'Real italic: thoughtful learning, 0123456789.';
      paragraph.append(document.createElement('br'), italic); panel.append(paragraph);
      document.body.replaceChildren(panel);
    });
    await page.evaluate(async () => { await document.fonts.ready; });
    expect(await page.evaluate(() => [...document.fonts].some(face => face.status === 'loaded' && face.style === 'italic'))).toBe(true);
    await captureTheme(page, `typography-specimen-390-${colorScheme}`);
  }
}
