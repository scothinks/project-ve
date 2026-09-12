// Manual local gate: needs the sealed candidate and a retained pre-adoption build.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { hash } from './theme-contract/source.mjs';

const prior = process.env.THEME_PRIOR_BUILD_ROOT;
const output = process.env.THEME_ROLLBACK_OUTPUT;
if (!prior || !output || !process.env.THEME_CANDIDATE_MANIFEST) throw Error('Provide prior build root, candidate manifest and external rollback output directory.');
const candidate = JSON.parse(readFileSync(process.env.THEME_CANDIDATE_MANIFEST, 'utf8'));
const roots = [prior, process.cwd()];
const ports = [3411, 3412];
const children = [];
const logs = [];
let active = 0;
let browser;
mkdirSync(output, { recursive: true });
const proxy = createServer(async (request, response) => {
  try {
    const asset = request.url.startsWith('/_next/static/') || request.url.startsWith('/brand/');
    let upstream = await fetch(`http://127.0.0.1:${ports[active]}${request.url}`, { redirect: 'manual' });
    // Model required whole-release asset retention; hosting must independently
    // demonstrate this capability before promotion is authorised.
    if (upstream.status === 404 && asset) upstream = await fetch(`http://127.0.0.1:${ports[1 - active]}${request.url}`, { redirect: 'manual' });
    response.statusCode = upstream.status;
    for (const [name, value] of upstream.headers) if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(name)) response.setHeader(name, value);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) { response.statusCode = 502; response.end(String(error)); }
});
try {
  for (const [index, root] of roots.entries()) {
    const child = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/next/dist/bin/next'), 'start', '-p', String(ports[index])], { cwd: root, env: { ...process.env, PROJECT_VE_LOCAL_E2E: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    child.stdout.on('data', bytes => logs.push(bytes.toString()));
    child.stderr.on('data', bytes => logs.push(bytes.toString()));
    let ready = false;
    for (let attempt = 0; attempt < 120 && !ready; attempt++) {
      try { ready = (await fetch(`http://127.0.0.1:${ports[index]}/login`)).ok; } catch { /* startup */ }
      if (!ready) await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, `Build ${index} did not start`);
  }
  await new Promise(resolve => proxy.listen(3410, '127.0.0.1', resolve));
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const oldPage = await context.newPage();
  const nextPage = await context.newPage();
  const failures = [];
  context.on('response', response => { if (response.url().startsWith('http://127.0.0.1:3410/') && response.status() >= 400) failures.push({ url: new URL(response.url()).pathname, status: response.status() }); });
  const origin = 'http://127.0.0.1:3410';
  async function snapshot(page, label) {
    await page.goto(`${origin}/login`);
    await page.evaluate(async () => { await document.fonts.ready; });
    const state = await page.evaluate(() => ({ title: document.title, bodyFont: getComputedStyle(document.body).fontFamily, background: getComputedStyle(document.body).backgroundColor, links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')), assets: performance.getEntriesByType('resource').map(resource => resource.name).filter(url => url.includes('/_next/static/') || url.includes('/brand/')) }));
    assert.equal(state.title, 'Project VE');
    const bytes = await page.screenshot({ fullPage: true, animations: 'disabled' });
    writeFileSync(path.join(output, `${label}.png`), bytes);
    return { ...state, screenshotSha256: hash(bytes) };
  }
  const before = await snapshot(oldPage, 'previous');
  active = 1;
  const current = await snapshot(nextPage, 'candidate');
  assert.notEqual(current.bodyFont, before.bodyFont);
  const retained = [];
  for (const url of [...new Set(before.assets)]) {
    const response = await context.request.get(url, { headers: { 'cache-control': 'no-cache' } });
    assert.ok(response.ok(), `Already-open prior asset missing: ${url}`);
    retained.push({ path: new URL(url).pathname, sha256: hash(await response.body()) });
  }
  // An already-open previous page still follows real navigation after promotion.
  await oldPage.locator('input[type="email"]').fill('rollback@example.test');
  await oldPage.reload();
  await oldPage.waitForSelector('input[type="email"]');
  active = 0;
  const restored = await snapshot(nextPage, 'restored');
  assert.equal(restored.bodyFont, before.bodyFont);
  assert.equal(restored.background, before.background);
  assert.deepEqual(restored.links, before.links);
  for (const url of [...new Set(current.assets)]) assert.ok((await context.request.get(url)).ok(), `Candidate asset missing after rollback: ${url}`);
  assert.deepEqual(failures, []);
  writeFileSync(path.join(output, 'result.json'), JSON.stringify({ candidateSourceSha256: candidate.sourceSha256, candidateBuildId: candidate.buildId, previousBuildId: readFileSync(path.join(prior, '.next-e2e/BUILD_ID'), 'utf8').trim(), before, current, restored, retained, missingAssets: failures, limitation: 'Local proxy explicitly retains both immutable asset sets. Hosted retention and release approval remain separate requirements.' }, null, 2) + '\n');
  console.log('Previous → candidate → previous passed; prior and candidate assets retained.');
} finally {
  await browser?.close();
  proxy.close();
  for (const child of children) child.kill('SIGTERM');
  writeFileSync(path.join(output, 'server.log'), logs.join(''));
}
