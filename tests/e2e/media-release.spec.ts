import { expect, test, type Page } from '@playwright/test';
import { checked, mediaFixture } from '../support/media-browser';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7l8AAAAASUVORK5CYII=', 'base64');

for (const organization of [false, true]) test(`replacement preserves bytes and rights in ${organization ? 'org' : 'catalog'} workspace`, async ({ browser, baseURL }) => {
  const f = await mediaFixture(browser, baseURL!, organization);
  try {
    const first = (await f.upload(png, undefined, 'Original permission evidence.')).asset!;
    const target = await f.lesson([{ block_type: 'text', payload: { body: 'Content stays available.' } }], first.url);
    const replacementBytes = Buffer.concat([png, Buffer.from('replacement-file-version')]);
    const second = (await f.upload(replacementBytes, first.asset_id, 'Replacement permission evidence.')).asset!;
    expect(second.id).not.toBe(first.id); expect(second.asset_id).toBe(first.asset_id);
    expect(await (await f.context.request.get(baseURL + first.url)).body()).toEqual(png);
    expect(await (await f.context.request.get(baseURL + second.url)).body()).toEqual(replacementBytes);
    const current = checked(await f.editor.from('lessons').select('published_snapshot').eq('id', target.lesson).single());
    expect(current.published_snapshot.pages[0].cover_image.url).toBe(first.url);
    expect(checked(await f.editor.from('lesson_pages').select('cover_image').eq('lesson_id', target.lesson).single()).cover_image.url).toBe(first.url);
    const list = await f.context.request.get(`${baseURL}/api/admin/media/library?manage=true`);
    const versions = (await list.json()).assets;
    expect(versions.find((v: { id: string }) => v.id === first.id).rights_evidence).toBe('Original permission evidence.');
    expect(versions.find((v: { id: string }) => v.id === second.id).rights_evidence).toBe('Replacement permission evidence.');
    expect((await f.manage(first.id, 'rights', { rightsEvidence: 'Rewrite' })).status()).toBe(403);
    const saved = checked(await f.editor.rpc('admin_save_lesson_builder', { p_lesson_id: target.lesson,
      p_expected_revision: checked(await f.editor.from('lessons').select('draft_revision').eq('id', target.lesson).single()).draft_revision,
      p_pages: [{ ...current.published_snapshot.pages[0], cover_image: { url: second.url } }], p_blocks: current.published_snapshot.blocks,
    }));
    checked(await f.editor.rpc('admin_publish_lesson_checked', { p_lesson_id: target.lesson, p_expected_revision: saved.draftRevision }));
    expect(checked(await f.editor.from('lessons').select('published_snapshot').eq('id', target.lesson).single()).published_snapshot.pages[0].cover_image.url).toBe(second.url);
    if (organization) {
      checked(await f.service.from('organization_memberships').update({ role: 'content_editor' }).eq('organization_id', f.organizationId!).eq('user_id', f.userId));
      expect((await f.upload(png, first.asset_id)).response.status()).toBe(422);
      for (const action of ['describe', 'share', 'rights', 'withdraw', 'revoke', 'delete']) expect((await f.manage(first.id, action)).status()).toBe(403);
      checked(await f.service.from('organization_memberships').update({ role: 'organisation_owner' }).eq('organization_id', f.organizationId!).eq('user_id', f.userId));
    }
  } finally {
    if (f.organizationId) checked(await f.service.from('organization_memberships').update({ role: 'organisation_owner' }).eq('organization_id', f.organizationId).eq('user_id', f.userId));
    await f.cleanup();
  }
});

function wav() {
  const samples = 24000 * 3; const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(24000,24); b.writeUInt32LE(48000,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++) b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/24000)*1000),44+i*2);
  return b;
}

async function expectVideoFrame(page: Page) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const video = page.locator('video').first();
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate(element => {
      const frame = element.getBoundingClientRect();
      return Math.abs(frame.height - frame.width * 9 / 16);
    })).toBeLessThan(1);
    await expect(video).toHaveCSS('object-fit', 'contain');
    // The source is deliberately square: its intrinsic size must not shrink the frame.
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBe(64);
  }
}

test('real audio/video play and seek in 16:9 frames; revocation renders unavailable states without blocking lesson', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const f = await mediaFixture(browser, baseURL!);
  const anonymous = await browser.newContext();
  try {
    const generator = await f.context.newPage(); await generator.goto(baseURL!);
    const webm = Buffer.from(await generator.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
      const stream=canvas.captureStream(10); const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}); const chunks: Blob[]=[];
      recorder.ondataavailable=e=>chunks.push(e.data);
      const stopped = new Promise<void>(resolve=>{recorder.onstop=()=>resolve();}); recorder.start();
      for(let i=0;i<30;i++){canvas.getContext('2d')!.fillStyle=i%2?'red':'blue';canvas.getContext('2d')!.fillRect(0,0,64,64);await new Promise(r=>setTimeout(r,100));}
      recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
      return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
    }));
    await generator.close();
    const audio = await f.register(wav(), 'audio/wav'); const video = await f.register(webm, 'video/webm'); const image = (await f.upload(png)).asset!;
    const target=await f.lesson([{block_type:'text',payload:{body:'Remaining lesson content.'}},{block_type:'audio',payload:{src:audio.url}},{block_type:'video',payload:{src:video.url}},{block_type:'image',payload:{src:image.url,alt:'Fixture image'}}]);
    const page=await f.context.newPage();await page.goto(`${baseURL}/lessons/${target.lesson}`);
    for(const tag of ['audio','video']){
      const player=page.locator(tag).first(); await expect(player).toBeVisible();
      await expect(player).toHaveAttribute('src', /^\/api\/media\//);
      await player.evaluate(async element=>{const media=element as HTMLMediaElement;media.muted=true;await Promise.race([media.play(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Playback did not start')),10000))]);});
      await expect.poll(()=>player.evaluate(e=>(e as HTMLMediaElement).currentTime)).toBeGreaterThan(0.1);
      await player.evaluate(e=>{(e as HTMLMediaElement).currentTime=1;});
      await expect.poll(()=>player.evaluate(e=>(e as HTMLMediaElement).currentTime)).toBeGreaterThanOrEqual(1);
    }
    await expectVideoFrame(page);
    const preview = await f.context.newPage();
    await preview.goto(`${baseURL}/admin/courses/lessons/${target.lesson}/preview`);
    await expectVideoFrame(preview);
    await preview.goto(`${baseURL}/admin/courses/lessons/${target.lesson}`);
    await expectVideoFrame(preview);
    await preview.close();
    const partial=await anonymous.request.get(baseURL+audio.url,{headers:{Range:'bytes=0-43'}});
    expect(partial.status()).toBe(206);expect(partial.headers()['content-range']).toBe(`bytes 0-43/${wav().length}`);expect((await partial.body()).length).toBe(44);
    expect(partial.headers()['cache-control']).toContain('no-store');expect(partial.headers()['location']).toBeUndefined();
    const invalid=await anonymous.request.get(baseURL+audio.url,{headers:{Range:'bytes=99999999-'}});expect(invalid.status()).toBe(416);
    for(const asset of [audio,video,image]) expect((await f.manage(asset.id,'revoke_asset')).ok()).toBeTruthy();
    await page.reload();await expect(page.getByText('Remaining lesson content.')).toBeVisible();
    await expect(page.getByRole('img',{name:'Media unavailable'})).toBeVisible();
    await expect(page.getByRole('status').filter({hasText:'Audio unavailable.'})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'Video unavailable.'})).toBeVisible();
    const draft=await f.context.newPage();
    let releaseScripts!: () => void;
    const hydration = new Promise<void>(resolve => { releaseScripts = resolve; });
    await draft.route('**/_next/static/**/*.js', async route => { await hydration; await route.continue(); });
    try {
      await draft.goto(`${baseURL}/admin/courses/lessons/${target.lesson}/preview`, { waitUntil: 'commit' });
      // Force the native preload error to happen before React can attach handlers.
      await expect.poll(() => draft.locator('audio').evaluate(e => Boolean((e as HTMLMediaElement).error))).toBe(true);
    } finally { releaseScripts(); }
    await expect(draft.getByText('Remaining lesson content.')).toBeVisible();
    await expect(draft.getByRole('img',{name:'Media unavailable'})).toBeVisible();
    await expect(draft.getByText('Audio unavailable.',{exact:true})).toBeVisible();await expect(draft.getByText('Video unavailable.',{exact:true})).toBeVisible();
    expect((await f.editor.rpc('admin_publish_lesson', {p_lesson_id:target.lesson})).error?.message).toContain('Replace revoked media');
    const issues=await f.context.request.get(`${baseURL}/api/admin/media/issues`);expect((await issues.json()).issues.some((i:{courseId:string})=>i.courseId===target.course)).toBe(true);
  } finally { await anonymous.close();await f.cleanup(); }
});
