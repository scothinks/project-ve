import { expect, test } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';
import { captureTheme } from '../support/theme-adoption/capture';

test('theme baseline covers public, learner, platform and organization scopes with portals', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const admin = await mediaFixture(browser, baseURL!);
  const org = await mediaFixture(browser, baseURL!, true);
  const anonymous = await browser.newContext();
  try {
    for (const fixture of [admin, org]) {
      checked(await fixture.service.from('profiles').update({ display_name: 'Theme Review' }).eq('id', fixture.userId));
      checked(await fixture.service.from('user_value_profiles').insert({ user_id: fixture.userId, context_scope: 'platform', organization_id: null, assessment_completed_at: new Date().toISOString() }));
    }
    const publicPage = await anonymous.newPage();
    const adminPage = await admin.context.newPage();
    const orgPage = await org.context.newPage();
    for (const width of [390, 1440]) for (const mode of ['light', 'dark'] as const) {
      for (const page of [publicPage, adminPage, orgPage]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      }
      const suffix = `${width}-${mode}`;
      await publicPage.goto(baseURL!);
      await expect(publicPage.getByRole('button', { name: 'Go to screen 1' }).first()).toBeVisible();
      await captureTheme(publicPage, `welcome-${suffix}`);
      await publicPage.goto(`${baseURL}/login`);
      await publicPage.locator('input[type="email"]').focus();
      await captureTheme(publicPage, `login-focus-${suffix}`);
      await adminPage.goto(`${baseURL}/dashboard`);
      await expect(adminPage.getByRole('heading', { name: 'No Active Learning' })).toBeVisible();
      await captureTheme(adminPage, `dashboard-${suffix}`);
      await adminPage.goto(`${baseURL}/admin/courses/new`);
      await expect(adminPage.locator('input[name="title"]')).toBeVisible();
      await captureTheme(adminPage, `admin-course-${suffix}`);
      await adminPage.getByRole('combobox').first().focus();
      await adminPage.keyboard.press('Space');
      await expect(adminPage.getByRole('listbox')).toBeVisible();
      await captureTheme(adminPage, `admin-select-${suffix}`);
      await adminPage.keyboard.press('Escape');
      await expect(adminPage.getByRole('listbox')).toHaveCount(0);
      await adminPage.getByRole('button', { name: /Add a cover image/ }).click();
      await expect(adminPage.getByRole('heading', { name: 'Choose a cover image' })).toBeVisible();
      await captureTheme(adminPage, `admin-drawer-${suffix}`);
      await adminPage.keyboard.press('Escape');
      await expect(adminPage.getByRole('heading', { name: 'Choose a cover image' })).toHaveCount(0);
      await orgPage.goto(`${baseURL}/admin/courses/new`);
      await expect(orgPage.locator('input[name="title"]')).toBeVisible();
      await captureTheme(orgPage, `organization-course-${suffix}`);
    }
    await publicPage.setViewportSize({ width: 320, height: 900 });
    await publicPage.goto(`${baseURL}/login`);
    await publicPage.locator('input[type="email"]').focus();
    await captureTheme(publicPage, 'login-focus-320-dark');
  } finally {
    await anonymous.close();
    await org.cleanup();
    await admin.cleanup();
  }
});
