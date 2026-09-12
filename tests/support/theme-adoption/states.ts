import { expect, type Page } from '@playwright/test';
import { captureTheme } from './capture';

// Opt-in evidence on existing workflow states; ordinary E2E keeps its cadence.
export async function captureIdentityStates(page: Page, name: string) {
  if (!process.env.THEME_EVIDENCE_DIR) return;
  const viewport = page.viewportSize();
  const originalMode = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await captureTheme(page, `${name}-${width}-${colorScheme}`);
  }
  if (viewport) await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: originalMode, reducedMotion: 'reduce' });
}
