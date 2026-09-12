import { expect, test } from '@playwright/test';
import { captureIdentityStates } from '../support/theme-adoption/states';

test('organisation entry loads the real display italic only on its expressive route', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/org');
  await expect(page.locator('.orgs-landing__title')).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(await page.evaluate(() => [...document.fonts].some(face => face.status === 'loaded' && face.style === 'italic' && /displayFont/.test(face.family)))).toBe(true);
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(0);
  await captureIdentityStates(page, 'organization-entry-display-italic');
});
