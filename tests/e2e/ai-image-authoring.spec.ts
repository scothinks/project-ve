import { test, expect } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7l8AAAAASUVORK5CYII=', 'base64');
test.use({ actionTimeout: 60000 });
test.describe.configure({ timeout: 240000 });
test('contextual image styles, retained preview and explicit use survive navigation', async ({ browser, baseURL }, info) => {
  const f = await mediaFixture(browser, baseURL!); const page = await f.context.newPage();
  let courseId: string | undefined;
  let imageWasApplied = false;
  const ids: string[] = []; const versions: string[] = []; let claim: { id: string; lock_token: string; lock_version: number };
  try {
    const target = await f.lesson([{ block_type: 'text', payload: { body: 'Listen to each neighbor before choosing what to do.' } }, { block_type: 'image', payload: { src: '', mediaIntent: { version: 1, kind: 'image', purpose: 'A listening circle', aspectRatio: '16:9', required: false, style: 'inherit' } } }]);
    courseId = target.course;
    await page.route('**/api/admin/ai/authoring/events?**', route => route.abort());
    await page.route('**/api/admin/ai/authoring', async route => {
      if (route.request().method() !== 'POST' || route.request().postDataJSON().action !== 'start') return route.continue();
      const id = route.request().postDataJSON().id; ids.push(id);
      const result = checked(await f.editor.rpc('admin_start_ai_page', { p_id: id }));
      claim = checked(await f.service.rpc('service_claim_ai_page', { p_id: id, p_worker: 'image-browser' }))[0];
      checked(await f.service.rpc('service_ai_image_checkpoint', { p_job: claim.id, p_worker: 'image-browser', p_token: claim.lock_token, p_version: claim.lock_version, p_action: 'begin' }));
      await route.fulfill({ json: result });
    });
    await page.goto(`${baseURL}/admin/courses/lessons/${target.lesson}`);
    await page.getByRole('button', { name: 'Add an image', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await drawer.getByRole('button', { name: 'Generate with AI', exact: true }).click();
    await expect(drawer.getByRole('textbox', { name: 'Image brief', exact: true })).toHaveValue(/Listen to each neighbor/);
    await drawer.getByRole('button', { name: 'Photography', exact: true }).click();
    await drawer.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Neighbors listening to one another');
    await drawer.getByRole('button', { name: 'Save as course default', exact: true }).click();
    await drawer.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Generate · 0 credits', exact: true })).toBeEnabled();
    expect(ids).toHaveLength(0);
    for (const width of [1280,390]) { await page.setViewportSize({ width, height: 900 }); await page.screenshot({ path: info.outputPath(`image-cost-${width}.png`), animations: 'disabled' }); expect(await drawer.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true); }
    await drawer.getByRole('button', { name: 'Generate · 0 credits', exact: true }).click();
    await expect(drawer.getByText('Creating your image…', { exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    expect(checked(await f.editor.rpc('admin_read_ai_results', { p_id: ids[0] })).stopRequested).toBe(false);
    const path = `registry/authoring-${ids[0]}.png`;
    checked(await f.service.storage.from('learning-media-private').upload(path,png,{contentType:'image/png',upsert:false}));
    checked(await f.service.rpc('service_ai_image_checkpoint', { p_job: claim!.id, p_worker: 'image-browser', p_token: claim!.lock_token, p_version: claim!.lock_version, p_action:'ready',p_file:{path,size:png.length} }));
    const retained = checked(await f.editor.rpc('admin_read_ai_results', { p_id: ids[0] })); versions.push(retained.candidate.versionId);
    const rows = checked(await f.editor.from('lesson_content_blocks').select('id,payload,page_id').in('page_id',checked(await f.editor.from('lesson_pages').select('id').eq('lesson_id',target.lesson)).map(p=>p.id)));
    const block = rows.find(b=>b.payload.mediaIntent)!; expect(block.payload.src).toBe(''); expect(block.payload.mediaStyle.preset).toBe('photography');
    await page.reload();
    // Exercise keyboard activation after navigation; focus also waits for hydration.
    await page.getByRole('button', { name: 'Add an image', exact: true }).press('Enter');
    await drawer.getByRole('button', { name: 'Generate with AI', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Use image', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('image-ready-mobile.png'), animations:'disabled' });
    // Lose the apply response after the database has committed; retained receipt must recover.
    await page.route('**/api/admin/ai/authoring', async route => {
      if (route.request().method() !== 'POST' || route.request().postDataJSON().action !== 'apply') return route.fallback();
      const response = await route.fetch(); expect(response.ok()).toBeTruthy(); await route.abort();
    });
    await drawer.getByRole('button', { name: 'Use image', exact: true }).click();
    await expect(drawer.getByText('Saved',{exact:true})).toBeVisible({timeout:30000});
    const applied = checked(await f.editor.rpc('admin_apply_ai_image', {p_id:ids[0]})); expect(applied.status).toBe('saved'); imageWasApplied = true;
    expect(checked(await f.editor.from('lesson_content_blocks').select('payload').eq('id',block.id).single()).payload.src).toBe(retained.candidate.url);
    // Subsequent autosave must preserve the applied registry reference.
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByPlaceholder('Caption (optional)', {exact:true}).fill('Everyone gets a turn');
    await expect.poll(async()=>checked(await f.editor.from('lesson_content_blocks').select('payload').eq('id',block.id).single()).payload.caption, {timeout:30000}).toBe('Everyone gets a turn');
    expect(checked(await f.editor.from('lesson_content_blocks').select('payload').eq('id',block.id).single()).payload.src).toBe(retained.candidate.url);
    await page.getByRole('button', { name: /^AI results/ }).click();
    await drawer.locator(`button[data-result-id="${ids[0]}"]`).click();
    await expect(drawer.getByText('Saved',{exact:true})).toBeVisible();
  } finally {
    for (const id of ids) await f.editor.rpc('admin_delete_ai_result',{p_id:id});
    // Referenced images cannot be deleted before the fixture course is removed.
    if (imageWasApplied) for (const id of versions) { const r=await f.manage(id,'delete'); expect(r.ok()).toBe(false); }
    if (courseId) checked(await f.service.from("courses").delete().eq("id",courseId));
    for (const id of versions) { const r = await f.manage(id,"delete"); expect(r.ok(), await r.text()).toBeTruthy(); }
    await f.cleanup();
  }
});
