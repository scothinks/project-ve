const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const out = path.join(__dirname, 'final');
fs.mkdirSync(out, { recursive: true });
const results = [];
async function main() {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    for (const profile of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
      { name: 'compact', width: 360, height: 640 },
      { name: 'reduced', width: 1440, height: 900, reduce: true },
      { name: 'no-js', width: 390, height: 844, noJS: true }
    ]) {
      const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, reducedMotion: profile.reduce ? 'reduce' : 'no-preference', javaScriptEnabled: !profile.noJS, deviceScaleFactor: 1 });
      await context.addInitScript(() => {
        Element.prototype.requestPointerLock = () => Promise.reject(new Error('Disabled for visual verification'));
        Element.prototype.setPointerCapture = () => {};
        Element.prototype.releasePointerCapture = () => {};
        Document.prototype.exitPointerLock = () => {};
      });
      const page = await context.newPage();
      const errors = [];
      const failed = [];
      const outside = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => failed.push(request.url()));
      page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:3341/')) outside.push(request.url()); });
      await page.goto('http://127.0.0.1:3341/', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      assert.match(await page.title(), /Learning in motion/);
      assert.equal(await page.locator('.hero-photo').evaluate(img => img.complete && img.naturalWidth > 0), true);
      if (!profile.noJS) await page.locator('html.sc-ready').waitFor();
      await page.screenshot({ path: path.join(out, `${profile.name}-hero.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${profile.name}: horizontal overflow`);
      if (!profile.noJS) {
        for (const key of ['listen', 'think', 'act']) {
          await page.locator(`[data-topic="${key}"]`).click();
          await page.locator('#start-quiz').click();
          assert.equal(await page.locator('[data-topic][aria-pressed="true"]').count(), 1);
          const topicText = (await page.locator(`[data-topic="${key}"]`).innerText()).replace('↗', '').trim();
          assert.equal(await page.locator('#shared-lesson').innerText(), topicText);
          for (const answer of ['0', '1']) {
            await page.locator(`[data-answer="${answer}"]`).click();
            assert.equal(await page.locator('#feedback strong').count(), 1);
            assert.ok((await page.locator('#feedback').innerText()).length > 80);
            assert.equal(await page.locator('[data-answer][aria-pressed="true"]').count(), 1);
          }
        }
        await page.locator('.lesson-sheet').screenshot({ path: path.join(out, `${profile.name}-sample.png`) });
        for (const mode of ['learner', 'organisation']) {
          const trigger = page.locator(`.entry-actions [data-entry="${mode}"]`);
          await trigger.click();
          assert.equal(await page.locator('#entry-dialog').evaluate(dialog => dialog.open), true);
          const handoff = new URL(await page.locator('#handoff-link').getAttribute('href'));
          assert.equal(handoff.pathname, '/login');
          assert.equal(handoff.searchParams.get('next'), mode === 'organisation' ? '/org/create' : null);
          assert.equal(await page.locator('#handoff-topic').innerText(), 'Make room for everyone');
          await page.keyboard.press('Tab');
          assert.equal(await page.locator('#entry-dialog').evaluate(dialog => dialog.contains(document.activeElement)), true);
          if (mode === 'organisation') await page.screenshot({ path: path.join(out, `${profile.name}-handoff.png`) });
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#entry-dialog').evaluate(dialog => dialog.open), false);
          assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
        }
        await page.locator('[data-topic="listen"]').click();
        await page.waitForFunction(() => document.activeElement.id === 'lesson-heading');
        await page.evaluate(() => {
          const section = document.querySelector('#together');
          const y = section.getBoundingClientRect().top + scrollY;
          scrollTo({ top: y + Math.max(0, section.offsetHeight - innerHeight) * .9, behavior: 'instant' });
        });
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(out, `${profile.name}-shared.png`) });
        if (profile.name === 'desktop') {
          const boxes = await page.locator('.shared-paper').evaluateAll(nodes => nodes.map(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })));
          assert.ok(boxes[0].bottom < boxes[1].top && boxes[1].bottom < boxes[2].top, 'Unfolded papers overlap');
          await page.setViewportSize({ width: 390, height: 844 });
          assert.equal(await page.locator('.together-stage').evaluate(el => getComputedStyle(el).position), 'relative');
          assert.ok(await page.locator('.together-section').evaluate(el => el.offsetHeight >= el.firstElementChild.offsetHeight));
          await page.setViewportSize({ width: 1440, height: 900 });
        }
      } else {
        await page.locator('noscript summary').click();
        assert.equal(await page.locator('noscript details').getAttribute('open'), '');
        assert.equal(await page.locator('.paper-mission h3').evaluate(el => getComputedStyle(el).opacity), '1');
      }
      await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(out, `${profile.name}-close.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(await page.locator('.closing-path').count(), 2);
      assert.deepEqual(errors, []);
      assert.deepEqual(failed, []);
      assert.deepEqual(outside, []);
      results.push({ profile: profile.name, passed: true, consoleErrors: errors, failedRequests: failed, externalRequests: outside });
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'interactions.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
