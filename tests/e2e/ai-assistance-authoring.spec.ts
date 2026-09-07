import { test, expect } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';
test.use({ actionTimeout: 60_000 });
test.describe.configure({ timeout: 300_000 });
const quizCandidate = { title: 'Listening quiz suggestions', questions: [
  { prompt: 'What should we do before deciding?', questionType: 'single_choice', explanation: 'Listen to everyone before choosing.', xp: 10, options: [{ label: 'Listen to everyone', isCorrect: true }, { label: 'Ignore other views', isCorrect: false }] },
  { prompt: 'Who can contribute?', questionType: 'single_choice', explanation: 'Everyone can contribute.', xp: 10, options: [{ label: 'Everyone', isCorrect: true }, { label: 'Only the leader', isCorrect: false }] },
] };
const planCandidate = { title: 'A useful next lesson', suggestions: [{ title: 'Making fair choices', description: 'Compare the options after listening.', reason: 'Extends listening into shared decisions.' }] };
const lessonCandidate = { title: 'Making fair choices', description: 'Compare the options after listening.', pages: [{ title: 'Compare two choices', subtitle: 'Include everyone', pageType: 'scenario', blocks: [
  { blockType: 'text', payload: { body: 'Consider how each choice affects everyone.' } },
  { blockType: 'video', payload: { mediaIntent: { version: 1, kind: 'video', purpose: 'An example of comparing two choices', aspectRatio: '16:9', required: false, style: 'inherit' } } },
] }] };

test('quiz assistance preserves manual drafts, selects questions and recovers a lost save response', async ({ browser, baseURL }, info) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage(); const operations: string[] = [];
  try {
    const target = await f.lesson([{ block_type: 'text', payload: { body: 'Listen to everyone before choosing. Everyone can contribute.' } }]);
    const created = checked(await f.editor.rpc('admin_upsert_lesson', { p_lesson_id: '', p_course_id: target.course, p_title: 'Listening quiz fixture', p_description: 'Listen first', p_cover_image: {}, p_status: 'draft', p_sort_order: 2, p_estimated_minutes: 5, p_retry_mode: 'anytime', p_retry_cooldown_seconds: 3600, p_retry_requires_reread: false, p_quiz_requires_lesson_completion: false, p_max_earning_attempts: 1 }));
    target.lesson = created.lessonId;
    checked(await f.editor.rpc('admin_save_lesson_builder', { p_lesson_id: target.lesson, p_expected_revision: 0, p_pages: [{ id: 'draft-quiz-page', page_number: 1, title: 'Listen', page_type: 'concept', cover_image: {} }], p_blocks: [{ id: 'draft-quiz-block', page_id: 'draft-quiz-page', block_type: 'text', sort_order: 1, payload: { body: 'Listen to everyone before choosing. Everyone can contribute.' } }] }));
    let discardSaveResponse = false;
    await page.route('**/api/admin/ai/authoring', async route => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
      if (body.action === 'apply' && discardSaveResponse) { discardSaveResponse = false; const responses = await Promise.all([route.fetch(), route.fetch()]); for (const r of responses) expect(r.ok()).toBeTruthy(); return route.abort(); }
      if (body.action !== 'start') return route.continue();
      operations.push(body.id);
      const r = checked(await f.editor.rpc('admin_start_ai_page', { p_id: body.id }));
      const j = checked(await f.service.rpc('service_claim_ai_page', { p_id: body.id, p_worker: 'assistance-browser' }))[0];
      const context = checked(await f.service.rpc('service_ai_page_checkpoint', { p_job: j.id, p_worker: 'assistance-browser', p_token: j.lock_token, p_version: j.lock_version, p_action: 'begin' }));
      expect(JSON.stringify(context)).toContain('Listen to everyone');
      checked(await f.service.rpc('service_ai_page_checkpoint', { p_job: j.id, p_worker: 'assistance-browser', p_token: j.lock_token, p_version: j.lock_version, p_action: 'ready', p_candidate: quizCandidate }));
      await route.fulfill({ json: r });
    });
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}/quiz`);
    await page.getByRole('button', { name: 'Add question', exact: true }).click();
    await page.getByPlaceholder('Write the question').fill('Unsaved manual question');
    await page.getByRole('button', { name: 'Generate questions', exact: true }).click();
    let drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('alert')).toContainText('Save your quiz changes');
    expect(operations).toHaveLength(0);
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByPlaceholder('Write the question')).toHaveValue('Unsaved manual question');
    // Keep the blank new-question editor open through result application.
    await page.getByPlaceholder('Write the question').fill('');
    await page.getByRole('button', { name: 'Generate questions', exact: true }).click();
    drawer = page.getByRole('dialog');
    await drawer.getByText('Add direction (optional)', { exact: true }).click();
    await drawer.getByRole('combobox').selectOption('2');
    await drawer.getByRole('button', { name: 'Update price', exact: true }).click();
    await drawer.getByRole('button', { name: 'Generate · 0 credits', exact: true }).click();
    await expect(drawer.getByText('Writing and checking questions', { exact: true }).or(drawer.getByText('Not added yet', { exact: true }))).toBeVisible();
    await expect(drawer.getByText('What should we do before deciding?', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(drawer.getByText('Explanation:', { exact: false }).first()).toBeVisible();
    await drawer.getByLabel('Select question 1').uncheck();
    await drawer.getByLabel('Select question 2').check();
    await page.screenshot({ path: info.outputPath('quiz-selection.png'), animations: 'disabled' });
    discardSaveResponse = true;
    await drawer.getByRole('button', { name: 'Add selected questions' }).click();
    await expect(drawer.getByRole('link', { name: 'Open saved questions' })).toBeVisible({ timeout: 30_000 });
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByPlaceholder('Write the question')).toHaveCount(2);
    await expect(page.getByPlaceholder('Write the question').last()).toHaveValue('');
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}/quiz?aiResult=${operations[0]}`);
    drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('link', { name: 'Open saved questions' })).toBeVisible({ timeout: 30_000 });
    const receipt = checked(await f.editor.rpc('admin_apply_ai_assistance', { p_id: operations[0] }));
    expect(receipt.ids).toHaveLength(1);
    const saved = checked(await f.editor.from('quiz_questions').select('prompt').in('id', receipt.ids));
    expect(saved.map(q => q.prompt)).toEqual(['Who can contribute?']);
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByPlaceholder('Write the question').first()).toHaveValue('Who can contribute?');
  } finally { await f.cleanup(); }
});

test('lesson suggestions quote drafting separately, retain refinements and add a reviewable draft', async ({ browser, baseURL }, info) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage(); const operations: Array<{ id: string; kind: string }> = [];
  try {
    const target = await f.lesson([{ block_type: 'text', payload: { body: 'Listen to everyone before choosing.' } }]);
    await page.route('**/api/admin/ai/authoring', async route => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
      if (body.action !== 'start') return route.continue();
      const r = checked(await f.editor.rpc('admin_start_ai_page', { p_id: body.id })); operations.push({ id: body.id, kind: r.kind });
      const j = checked(await f.service.rpc('service_claim_ai_page', { p_id: body.id, p_worker: 'lesson-browser' }))[0];
      checked(await f.service.rpc('service_ai_page_checkpoint', { p_job: j.id, p_worker: 'lesson-browser', p_token: j.lock_token, p_version: j.lock_version, p_action: 'begin' }));
      checked(await f.service.rpc('service_ai_page_checkpoint', { p_job: j.id, p_worker: 'lesson-browser', p_token: j.lock_token, p_version: j.lock_version, p_action: 'ready', p_candidate: r.kind === 'lesson_plan' ? planCandidate : lessonCandidate }));
      await route.fulfill({ json: r });
    });
    await page.goto(`${baseURL}/admin/courses/${target.course}`);
    await page.getByRole('link', { name: 'Suggest lessons with AI', exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/admin/courses/${target.course}/expand`);
    await expect(page.getByRole('button', { name: 'Resume earlier work', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI results', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Suggest lessons', exact: true }).click();
    let drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Drafting is charged separately.')).toBeVisible();
    await drawer.getByRole('button', { name: 'Recommend · 0 credits', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Draft this lesson' })).toBeVisible({ timeout: 30_000 });
    expect(checked(await f.editor.from('lessons').select('id').eq('course_id', target.course))).toHaveLength(1);
    await drawer.getByRole('button', { name: 'Draft this lesson' }).click();
    await expect(drawer.getByText('One lesson draft. Media is added separately.')).toBeVisible();
    expect(operations).toHaveLength(1);
    await drawer.getByRole('button', { name: 'Generate · 0 credits', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Add lesson', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(drawer.getByText('Video placeholder · Optional')).toBeVisible();
    await drawer.getByRole('button', { name: 'Create another version' }).click();
    await drawer.getByLabel('What would you like to change?').fill('Make the example easier for beginners.');
    await drawer.getByRole('button', { name: 'Update price', exact: true }).click();
    await drawer.getByRole('button', { name: 'Generate · 0 credits', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Add lesson', exact: true })).toBeVisible({ timeout: 30_000 });
    expect(checked(await f.editor.rpc('admin_read_ai_results', { p_id: operations[1].id })).candidate).toBeTruthy();
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goto(`${baseURL}/admin/courses/ai-results`);
    await page.locator(`button[data-result-id="${operations[2].id}"]`).click();
    await page.getByRole('link', { name: 'Review in course' }).click();
    drawer = page.getByRole('dialog');
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(drawer.getByRole('button', { name: 'Add lesson', exact: true })).toBeVisible();
      expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath(`lesson-result-${width}.png`), animations: 'disabled' });
    }
    await drawer.getByRole('button', { name: 'Add lesson', exact: true }).click();
    await expect(drawer.getByRole('link', { name: 'Open saved lesson' })).toBeVisible();
    const savedResult = checked(await f.editor.rpc('admin_read_ai_results', { p_id: operations[2].id }));
    const lessonId = savedResult.receipt.lessonId;
    expect(checked(await f.editor.from('lessons').select('status').eq('id', lessonId).single()).status).toBe('draft');
    await drawer.getByRole('link', { name: 'Open saved lesson' }).click();
    const media = checked(await f.editor.from('lesson_content_blocks').select('id,page_id,payload,sort_order').in('page_id', checked(await f.editor.from('lesson_pages').select('id').eq('lesson_id', lessonId)).map(p => p.id))).find(b => b.payload.mediaIntent)!;
    checked(await f.editor.rpc('admin_upsert_lesson_block', { p_block_id: media.id, p_page_id: media.page_id, p_block_type: 'video', p_sort_order: media.sort_order, p_payload: { ...media.payload, mediaIntent: { ...media.payload.mediaIntent, required: true } } }));
    await page.goto(`${baseURL}/admin/courses/lessons/${lessonId}/preview?section=review`);
    await page.getByRole('checkbox', { name: /I have reviewed the lesson text, quiz and any media/ }).check();
    await page.getByRole('button', { name: 'Mark lesson reviewed' }).click();
    await expect(page.getByText('Lesson review complete.', { exact: true })).toBeVisible();
    const reviewed = checked(await f.editor.from('lessons').select('ai_publish_status,draft_revision').eq('id', lessonId).single());
    expect(reviewed.ai_publish_status).toBe('ready');
    const published = await f.context.request.post(`${baseURL}/api/admin/learning/publish-lesson`, { data: { lessonId, courseId: target.course, expectedRevision: reviewed.draft_revision } });
    expect(published.ok(), await published.text()).toBeTruthy();
    expect(checked(await f.editor.from('learning_media_assets').select('id').eq('course_id', target.course))).toHaveLength(0);
  } finally { await f.cleanup(); }
});


test('a lesson without a quiz can add its first reviewed AI question', async ({ browser, baseURL }) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage();
  try {
    const target = await f.lesson([{ block_type: 'text', payload: { body: 'Listen to everyone before deciding.' } }]);
    await page.route('**/api/admin/ai/authoring', async route => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
      if (body.action !== 'start') return route.continue();
      const result = checked(await f.editor.rpc('admin_start_ai_page', { p_id: body.id }));
      const job = checked(await f.service.rpc('service_claim_ai_page', { p_id: body.id, p_worker: 'first-quiz-browser' }))[0];
      const lease = { p_job: job.id, p_worker: 'first-quiz-browser', p_token: job.lock_token, p_version: job.lock_version };
      checked(await f.service.rpc('service_ai_page_checkpoint', { ...lease, p_action: 'begin' }));
      checked(await f.service.rpc('service_ai_page_checkpoint', { ...lease, p_action: 'ready', p_candidate: { ...quizCandidate, questions: [quizCandidate.questions[0]] } }));
      await route.fulfill({ json: result });
    });
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}/quiz`);
    await page.getByRole('button', { name: 'Generate questions', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await drawer.getByRole('button', { name: 'Generate · 0 credits', exact: true }).click();
    await drawer.getByRole('button', { name: 'Add selected questions' }).click();
    await expect(drawer.getByRole('link', { name: 'Open saved questions' })).toBeVisible();
    await drawer.getByRole('link', { name: 'Open saved questions' }).click();
    await expect(page.getByPlaceholder('Write the question')).toHaveValue(quizCandidate.questions[0].prompt);
  } finally { await f.cleanup(); }
});
