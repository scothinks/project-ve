import { test, expect } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';
import { starterAdvice } from '../../features/ai-generation/authoring/course-discovery';
test.describe.configure({ timeout: 120_000 });
test.use({ actionTimeout: 15_000 });

test('uncertain authors shape an idea and learners; complete briefs take the direct path', async ({ browser, baseURL }, info) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage();
  let generationMutations = 0, guidanceCalls = 0;
  const capture = async (name: string) => {
    // Full-page captures must start at the top; otherwise a sticky header is
    // composited at the old focus/scroll offset after changing viewport size.
    await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
    await page.screenshot({ path: info.outputPath(name), fullPage: true });
  };
  await page.route('**/api/admin/ai/authoring', route => { if (route.request().method() === 'POST') generationMutations++; return route.continue(); });
  await page.route('**/api/admin/ai/course-guidance', route => { guidanceCalls++; return route.fulfill({ json: { advice: starterAdvice(route.request().postDataJSON().input), source: 'starter' } }); });
  // Bundled fallback fixture; guidance requests never reach a real provider.
  try {
    await page.goto(`${baseURL}/admin/courses/ai/brief`);
    await expect(page.getByRole('navigation', { name: 'Course navigation' }).getByRole('link')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Check outline cost', exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await capture('assist-start.png');
    await page.getByRole('button', { name: 'Help me choose', exact: true }).click();
    await page.getByRole('button', { name: 'Handle disagreements', exact: true }).click();
    expect(guidanceCalls).toBe(0);
    await expect(page.getByRole('button', { name: 'Generate outline · No organisation credits', exact: true })).toBeEnabled();
    await capture('assist-direction.png');
    await page.getByRole('button', { name: 'Disagree respectfully', exact: true }).focus();
    await expect(page.getByRole('button', { name: 'Disagree respectfully', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Disagree respectfully', exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Where will they use this?', exact: true })).toBeFocused();
    await capture('assist-learners.png');
    await page.getByRole('button', { name: 'Not sure yet', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your course so far' })).toBeVisible();
    await expect(page.getByLabel('Learning goal', { exact: false })).toHaveValue('Handle disagreements: Disagree respectfully');
    await expect(page.getByLabel('Who this will help', { exact: false })).toHaveValue(/general audience/i);
    await page.getByLabel('Who this will help', { exact: false }).fill('Young adults practising disagreement in everyday group situations.');
    await expect(page.getByRole('button', { name: 'Generate outline · No organisation credits', exact: true })).toBeEnabled();
    expect(generationMutations).toBe(0);
    await page.getByRole('link', { name: 'Resume earlier work', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Who this will help', { exact: false })).toHaveValue(/Young adults/);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(`guided-${width}.png`);
    }
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await capture('guided-dark.png');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await capture('guided-text-200.png');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.getByRole('button', { name: 'Back to my idea' }).click();
    await page.getByLabel('What would you like to help people do?').fill('Making fair choices');
    await expect(page.getByText('Your learner description is kept.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Build trust', exact: true }).click();
    await expect(page.getByLabel('Who this will help', { exact: false })).toHaveValue('Young adults practising disagreement in everyday group situations.');
    await page.getByRole('button', { name: 'Back to my idea' }).click();
    await page.getByRole('button', { name: 'I have a brief' }).click();
    await expect(page.getByLabel('Who this will help', { exact: false })).toHaveValue(/Young adults/);
    await expect(page.getByText('Where will they use this?', { exact: true })).toHaveCount(0);
    await page.getByLabel('Learning goal', { exact: false }).fill('Help new team members listen and ask clarifying questions before making decisions.');
    await expect(page.getByRole('button', { name: 'Generate outline · No organisation credits', exact: true })).toBeEnabled();
    expect(generationMutations).toBe(0);
  } finally { await f.cleanup(); }
});

test('a complete idea needs no redundant guidance question and keeps the supplied learners', async ({ browser, baseURL }) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage();
  let calls = 0, mutations = 0;
  const need = 'Help new team members listen before responding in weekly planning meetings.';
  try {
    await page.route('**/api/admin/ai/authoring', route => { if (route.request().method() === 'POST') mutations++; return route.continue(); });
    await page.route('**/api/admin/ai/course-guidance', route => {
      calls++; const { input } = route.request().postDataJSON();
      expect(input.seed).toBe(need); expect(input.answers).toEqual([]);
      return route.fulfill({ json: { source: 'assistant', advice: { brief: { ...input.brief, need, audience: 'New team members in weekly planning meetings.' }, question: '', choices: [], suggestedFields: ['audience'] } } });
    });
    await page.goto(`${baseURL}/admin/courses/ai/brief`);
    await page.getByLabel('What would you like to help people do?').fill(need);
    await page.getByRole('button', { name: 'Help shape my idea' }).click();
    await expect(page.getByText('Your brief is ready to review.', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Who this will help', { exact: false })).toHaveValue('New team members in weekly planning meetings.');
    await expect(page.getByRole('button', { name: 'Not sure yet', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Generate outline · No organisation credits', exact: true })).toBeEnabled();
    expect(calls).toBe(1); expect(mutations).toBe(0);
  } finally { await f.cleanup(); }
});

test('reopened expired requests refresh without starting and can return to an editable brief', async ({ browser, baseURL }) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage();
  let quotes = 0, starts = 0, reads = 0, holdReads = false, release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  try {
    const quote = checked(await f.editor.rpc('admin_quote_ai_course', { p_kind: 'course_outline', p_brief: { need: 'Make fair decisions', audience: 'New team members', tone: 'Direct', lessonCount: 2 } }));
    await page.route('**/api/admin/ai/authoring/events?**', route => route.abort());
    await page.route('**/api/admin/ai/authoring?*', async route => {
      const response = await route.fetch(); const result = await response.json();
      if (result.id === quote.id) result.quoteExpiresAt = new Date(Date.now() - 60_000).toISOString();
      else if (holdReads) { reads++; await pending; }
      await route.fulfill({ json: result }).catch(() => {});
    });
    await page.route('**/api/admin/ai/authoring', route => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
      if (body.action === 'quote') quotes++;
      if (body.action === 'start') { starts++; return route.abort(); }
      return route.continue();
    });
    await page.goto(`${baseURL}/admin/courses/ai/brief?aiResult=${quote.id}`);
    await expect(page.getByText('This request’s price has expired.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate outline · No organisation credits', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Refresh request', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Generate outline · No organisation credits', exact: true })).toBeEnabled();
    expect(quotes).toBe(1); expect(starts).toBe(0);
    // A fresh visit must offer the same edit escape hatch as an in-session quote.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Edit brief', exact: true })).toBeVisible();
    holdReads = true;
    await expect.poll(() => reads).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Edit brief', exact: true }).click();
    await expect(page.getByLabel('Learning goal', { exact: false })).toHaveValue('Make fair decisions');
    await page.getByLabel('Who this will help', { exact: false }).fill('First-time team leads');
    release!();
    await expect(page.getByRole('heading', { name: 'Review this request before generating' })).toHaveCount(0);
    await expect(page.getByLabel('Who this will help', { exact: false })).toHaveValue('First-time team leads');
    expect(quotes).toBe(1); expect(starts).toBe(0);
    await page.getByRole('link', { name: 'Resume earlier work', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
  } finally { release?.(); await f.cleanup(); }
});

test('adaptive guidance uses supplied context and late answers cannot replace an author correction', async ({ browser, baseURL }) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage();
  let calls = 0, release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.route('**/api/admin/ai/course-guidance', async route => {
      calls++; const { input } = route.request().postDataJSON();
      expect(input.seed).toBe('Our team talks over each other');
      if (calls === 2) await pending;
      const advice = { brief: { ...input.brief, need: 'Practise listening before responding in team discussions.', audience: 'Team members practising everyday discussions; starting knowledge is not specified.' }, question: calls === 1 ? 'Which discussion needs the most help?' : '', choices: calls === 1 ? ['Team meetings', 'One-to-one conversations'] : [], suggestedFields: ['need', 'audience'] };
      await route.fulfill({ json: { source: 'assistant', advice } }).catch(() => {});
    });
    await page.goto(`${baseURL}/admin/courses/ai/brief`);
    await page.getByLabel('What would you like to help people do?').fill('Our team talks over each other');
    await page.getByRole('button', { name: 'Help shape my idea' }).click();
    await expect(page.getByText('Which discussion needs the most help?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Team meetings', exact: true }).click();
    await expect.poll(() => calls).toBe(2);
    await page.getByLabel('Learning goal', { exact: false }).fill('Help meeting facilitators invite quieter participants before deciding.');
    release!();
    await expect(page.getByText('Finding a useful next step…', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Learning goal', { exact: false })).toHaveValue('Help meeting facilitators invite quieter participants before deciding.');
    await page.getByRole('button', { name: 'Back to my idea' }).click();
    await page.getByRole('button', { name: 'I have a brief' }).click();
    await expect(page.getByLabel('Learning goal', { exact: false })).toHaveValue('Help meeting facilitators invite quieter participants before deciding.');
    await expect(page.getByText('Which discussion needs the most help?', { exact: true })).toHaveCount(0);
  } finally { release?.(); await f.cleanup(); }
});

test('metered price changes require a new click; double clicks and a lost Start keep one intent', async ({ browser, baseURL }) => {
  const f = await mediaFixture(browser, baseURL!, true); const page = await f.context.newPage();
  let resultId: string | undefined, quotes = 0, starts = 0;
  try {
    checked(await f.service.from('profiles').update({ role: 'admin' }).eq('id', f.userId));
    checked(await f.editor.rpc('admin_assign_organization_plan', { p_organization_id: f.organizationId!, p_plan_key: 'professional', p_billing_status: 'active', p_entitlement_overrides: { ai_authoring_enabled: true, ai_monthly_allocation: 1000, ai_hard_limit: 1000 }, p_override_reason: 'Local priced course journey fixture' }));
    await page.route('**/api/admin/ai/authoring', async route => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
      if (body.action === 'quote') {
        quotes++; const response = await route.fetch(); const quote = await response.json();
        expect(response.ok(), JSON.stringify(quote)).toBe(true); resultId = quote.id;
        return route.fulfill({ json: { ...quote, estimatedUnits: quote.estimatedUnits + 1 } });
      }
      if (body.action === 'start') {
        starts++; checked(await f.editor.rpc('admin_start_ai_page', { p_id: body.id }));
        return route.abort(); // Persisted Start; never dispatch a real provider in this fixture.
      }
      return route.continue();
    });
    await page.goto(`${baseURL}/admin/courses/ai/brief`);
    await page.getByRole('button', { name: 'I have a brief' }).click();
    await page.getByLabel('Learning goal').fill('Practise fair decisions in a team.');
    await page.getByLabel('Who this will help').fill('New team members');
    const generate = page.getByRole('button', { name: 'Generate outline · 57 credits', exact: true });
    await expect(generate).toBeEnabled();
    await expect(page.getByText(/205 more; 262 in total/)).toBeVisible();
    await generate.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    await expect(page.getByRole('alert').filter({ hasText: 'price or scope changed' })).toBeVisible();
    expect(quotes).toBe(1); expect(starts).toBe(0);
    await expect(page.getByRole('heading', { name: 'Review this request before generating' })).toBeVisible();
    // Recovery reads show the actual retained 57-credit quote; accept it explicitly.
    await page.getByRole('button', { name: 'Generate outline · 57 credits', exact: true }).click();
    await expect.poll(() => starts).toBe(1);
    await expect(page.getByText('Planning your course', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Planning your course', { exact: true })).toBeVisible();
    expect(quotes).toBe(1); expect(starts).toBe(1);
    const result = checked(await f.editor.rpc('admin_read_ai_results', { p_id: resultId }));
    expect(result.credit.reserved).toBe(57);
  } finally { if (resultId) checked(await f.editor.rpc('admin_stop_ai_result', { p_id: resultId })); await f.cleanup(); }
});

test('plan-unavailable entry explains the reason and preserves manual creation', async ({ browser, baseURL }) => {
  const f = await mediaFixture(browser, baseURL!, true); const page = await f.context.newPage();
  try {
    await page.goto(`${baseURL}/admin/courses/choose`);
    await expect(page.getByRole('status').filter({ hasText: 'AI authoring is not available on this organisation plan.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create with AI', exact: true })).toHaveCount(0);
    await page.goto(`${baseURL}/admin/courses/ai/brief`);
    await expect(page.getByRole('link', { name: 'Start from scratch', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Help shape my idea' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Resume earlier work', exact: true })).toBeVisible();
  } finally { await f.cleanup(); }
});
