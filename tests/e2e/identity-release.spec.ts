import { captureTypographySpecimen } from '../support/theme-adoption/typography';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';
import { captureTheme } from '../support/theme-adoption/capture';
import { captureIdentityStates } from '../support/theme-adoption/states';
import { decodePng } from '../support/theme-adoption/pixels';

test('identity assets, two-tenant switching and narrow fallback presentation qualify on the built app', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const f = await mediaFixture(browser, baseURL!, true);
  const secondId = randomUUID();
  const firstName = 'North Learning Partnership';
  const secondName = 'South Community Education and Professional Development Partnership';
  try {
    checked(await f.service.from('profiles').update({ display_name: 'Identity Review' }).eq('id', f.userId));
    checked(await f.service.from('user_value_profiles').insert({ user_id: f.userId, context_scope: 'platform', organization_id: null, assessment_completed_at: new Date().toISOString() }));
    checked(await f.service.from('organizations').update({ name: firstName, logo_url: `${baseURL}/brand/aperture-a2-192.png` }).eq('id', f.organizationId!));
    checked(await f.service.from('organizations').insert({ id: secondId, slug: `identity-${secondId}`, name: secondName, status: 'published', created_by: f.userId }));
    checked(await f.service.from('organization_memberships').insert({ organization_id: secondId, user_id: f.userId, role: 'learner', status: 'active' }));
    const page = await f.context.newPage();
    const activeIdentity = page.locator('.org-desktop-chrome__identity, .org-learner-header__identity').filter({ visible: true }).first();
    await page.goto(`${baseURL}/o/media-${f.organizationId}`);
    await expect(activeIdentity).toContainText(firstName);
    await captureIdentityStates(page, 'tenant-a-logo');
    await page.getByLabel('Switch workspace').filter({ visible: true }).click();
    await page.getByRole('link', { name: secondName, exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(new RegExp(`/o/identity-${secondId}$`));
    await expect(activeIdentity).toContainText(secondName);
    await expect(activeIdentity).not.toContainText(firstName);
    await captureIdentityStates(page, 'tenant-b-long-name-no-logo');
    await page.getByLabel('Switch workspace').filter({ visible: true }).click();
    await page.locator('.workspace-switcher__row--platform').filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(activeIdentity).toHaveCount(0);
    await captureIdentityStates(page, 'personal-after-tenants');

    const manifestResponse = await page.request.get(`${baseURL}/manifest.webmanifest`);
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe('Project VE');
    for (const icon of manifest.icons) {
      const response = await page.request.get(`${baseURL}${icon.src}`);
      expect(response.headers()['content-type']).toContain('image/png');
      const image = decodePng(await response.body());
      expect(icon.sizes).toBe(`${image.width}x${image.height}`);
    }
    for (const size of [192, 512]) {
      const response = await page.request.get(`${baseURL}/icon?size=${size}`);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
      const image = decodePng(await response.body());
      expect([image.width, image.height]).toEqual([size, size]);
    }
    const apple = decodePng(await (await page.request.get(`${baseURL}/apple-icon`)).body());
    expect([apple.width, apple.height]).toEqual([180, 180]);
    const worker = await (await page.request.get(`${baseURL}/sw.js`)).text();
    for (const name of ['aperture-a2-192.png', 'aperture-a2-badge-96.png']) {
      expect(worker).toContain(name);
      expect((await page.request.get(`${baseURL}/brand/${name}`)).ok()).toBe(true);
    }
    const anonymous = await browser.newContext({ baseURL });
    try {
      const entry = await anonymous.newPage();
      const roles = JSON.parse(readFileSync('docs/evidence/theme-adoption/registry.json', 'utf8')).roles;
      for (const colorScheme of ['light', 'dark'] as const) {
        await entry.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await entry.setViewportSize({ width: 320, height: 900 });
        await entry.goto('/login');
        const values = await entry.evaluate(names => Object.fromEntries(names.map((name: string) => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()])), roles.map((r: { token: string }) => r.token));
        const normalize = (value: string) => value.replace(/\s/g, '').replace(/^#([\da-f])([\da-f])([\da-f])$/i, '#$1$1$2$2$3$3').replace(/^\./, '0.');
        for (const role of roles) expect(normalize(values[role.token]), role.token).toBe(normalize(role[colorScheme]));
        await entry.locator('input[type="email"]').focus();
        await expect(entry.locator('input[type="email"]')).toBeFocused();
        await captureTheme(entry, `entry-320-${colorScheme}`);
        await entry.evaluate(() => document.documentElement.style.fontSize = '200%');
        await expect.poll(() => entry.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const name of ['Terms', 'Privacy', 'Support']) {
          const link = entry.getByRole('link', { name, exact: true });
          const box = await link.boundingBox();
          expect(box, `${name} has a visible box`).not.toBeNull();
          expect(box!.x, `${name} stays inside the viewport`).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width, `${name} is not clipped`).toBeLessThanOrEqual(320);
        }
        await captureTheme(entry, `entry-320-text200-${colorScheme}`);
      }
      await captureTypographySpecimen(entry);
    } finally { await anonymous.close(); }
    const fallback = await browser.newContext({ baseURL, viewport: { width: 320, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
    try {
      const blockedFonts: string[] = [];
      await fallback.route('**/*.woff2', route => { blockedFonts.push(route.request().url()); return route.abort(); });
      const entry = await fallback.newPage();
      await entry.goto('/login');
      await entry.evaluate(async () => { await document.fonts.ready; });
      expect(blockedFonts.length).toBeGreaterThan(0);
      expect(await entry.evaluate(() => [...document.fonts].some(face => face.status === 'loaded'))).toBe(false);
      await expect(entry.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
      await captureTheme(entry, 'entry-fallback-fonts');
    } finally { await fallback.close(); }
  } finally {
    checked(await f.service.from('organizations').delete().eq('id', secondId));
    await f.cleanup();
  }
});
