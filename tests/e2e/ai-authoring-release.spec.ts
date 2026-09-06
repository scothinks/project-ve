import { test, expect } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';

test('silent worker shows a timed delay; keyboard cancellation releases unstarted work on mobile', async ({ browser, baseURL }, info) => {
  const f = await mediaFixture(browser, baseURL!);
  const page = await f.context.newPage();
  let resultId: string | undefined;
  try {
    // A connected but silent transport must not be the clock for delay messaging.
    await page.addInitScript(() => {
      class SilentStream extends EventTarget { onmessage = null; onerror = null; close() {} }
      Object.defineProperty(window, 'EventSource', { value: SilentStream });
    });
    await page.clock.install();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const quote = checked(await f.editor.rpc('admin_quote_ai_course', { p_kind: 'course_outline', p_brief: { need: 'Make fair decisions', audience: 'Adults', tone: 'Direct', lessonCount: 2 } }));
    resultId = quote.id;
    const startedAt = Date.now();
    checked(await f.editor.rpc('admin_start_ai_page', { p_id: resultId }));
    const acknowledgementMs = Date.now() - startedAt;
    await page.goto(`${baseURL}/admin/courses/ai/brief?aiResult=${resultId}`);
    await expect(page.getByText('Waiting for the writer to start.', { exact: false })).toBeVisible();
    await page.clock.fastForward(65_000);
    await expect(page.getByText('This is taking longer than expected. Your saved checkpoints remain available.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Stop remaining work' }).press('Enter');
    await expect(page.getByRole('button', { name: 'Stop remaining work' })).toHaveCount(0);
    const stoppedNotice = page.getByRole('status').filter({ hasText: 'Generation stopped' });
    await expect(stoppedNotice).toBeVisible();
    await expect(stoppedNotice).toBeFocused();
    const stopped = checked(await f.editor.rpc('admin_read_ai_results', { p_id: resultId }));
    expect(stopped.stage).toBe('stopped');
    const jobs = checked(await f.service.from('ai_generation_jobs').select('status,attempt_count').eq('prompt->>operationId', resultId));
    expect(jobs).toEqual([{ status: 'failed', attempt_count: 0 }]);
    await info.attach('local-acknowledgement', { body: JSON.stringify({ acknowledgementMs, environment: 'local RPC fixture; no provider or hosted dispatch', startedAt: new Date(startedAt).toISOString() }), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath('stopped-mobile.png'), fullPage: true, animations: 'disabled' });
  } finally {
    if (resultId) await f.editor.rpc('admin_stop_ai_result', { p_id: resultId });
    await f.cleanup();
  }
});
