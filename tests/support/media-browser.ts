import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, type Browser } from "@playwright/test";

export function checked<T extends { data: unknown; error: { message: string } | null }>(result: T): NonNullable<T['data']> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T['data']>;
}
export async function mediaFixture(browser: Browser, baseURL: string, organization = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Media fixture writes require local Supabase.');
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = `media-release-${randomUUID()}@example.test`; const password = randomUUID() + randomUUID();
  const user = checked(await service.auth.admin.createUser({ email, password, email_confirm: true })).user!;
  const organizationId = organization ? randomUUID() : null;
  if (organizationId) {
    checked(await service.from('organizations').insert({ id: organizationId, slug: `media-${organizationId}`, name: 'Media release fixture', status: 'published', created_by: user.id }));
    checked(await service.from('organization_memberships').insert({ organization_id: organizationId, user_id: user.id, role: 'organisation_owner', status: 'active' }));
  } else checked(await service.from('profiles').update({ role: 'admin' }).eq('id', user.id));
  const context = await browser.newContext();
  const cookies: { name: string; value: string }[] = [];
  const editor = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => [], setAll: c => { cookies.push(...c); } } });
  checked(await editor.auth.signInWithPassword({ email, password }));
  await context.addCookies([...cookies, { name: 'project-ve-admin-workspace', value: organizationId ?? 'platform-catalog' }].map(c => ({ ...c, url: baseURL, sameSite: 'Lax' as const })));
  const assets: string[] = []; const courses: string[] = [];
  async function manage(id: string, action: string, fields = {}) {
    return context.request.post(`${baseURL}/api/admin/media/assets`, { data: { versionId: id, action, ...fields } });
  }
  async function upload(bytes: Buffer, assetId?: string, evidence = 'Fixture-owned image permits project reuse.') {
    const r = await context.request.post(`${baseURL}/api/admin/learning/media/upload`, { multipart: {
      file: { name: 'fixture.png', mimeType: 'image/png', buffer: bytes }, altText: 'Fixture image', rightsConfirmed: 'true', rightsEvidence: evidence, ...(assetId ? { assetId } : {}),
    } });
    if (!r.ok()) return { response: r, asset: null };
    const asset = (await r.json()).asset as { id: string; asset_id: string; url: string };
    assets.push(asset.id); return { response: r, asset };
  }
  async function register(bytes: Buffer, mime: string) {
    const path = `registry/${randomUUID()}.${mime.split('/')[1]}`;
    checked(await service.storage.from('learning-media-private').upload(path, bytes, { contentType: mime, upsert: false }));
    const asset = checked(await service.rpc('service_register_media', { p_organization_id: organizationId, p_storage_path: path, p_mime_type: mime, p_size: bytes.length, p_title: 'Playback fixture', p_alt_text: 'Playback fixture', p_rights_evidence: 'Fixture generated for testing.' }));
    assets.push(asset.id); return asset as { id: string; url: string; asset_id: string };
  }
  async function lesson(blocks: { block_type: string; payload: object }[], cover?: string) {
    const course = `media-release-${randomUUID()}`; const lesson = `media-release-${randomUUID()}`;
    checked(await service.from('courses').insert({ id: course, slug: course, title: 'Media release course', description: 'Test', category: 'Values', status: 'published', organization_id: organizationId, catalog_scope: organizationId ? 'organization_private' : 'platform' })); courses.push(course);
    checked(await service.from('lessons').insert({ id: lesson, slug: lesson, course_id: course, title: 'Media release lesson', status: 'draft' }));
    const saved = checked(await editor.rpc('admin_save_lesson_builder', { p_lesson_id: lesson, p_expected_revision: 0,
      p_pages: [{ id: 'draft-media-page', page_number: 1, title: 'Media release page', page_type: 'concept', cover_image: cover ? { url: cover } : {} }],
      p_blocks: blocks.map((b, i) => ({ ...b, id: `draft-media-block-${i}`, page_id: 'draft-media-page', sort_order: i + 1 })),
    }));
    checked(await editor.rpc('admin_publish_lesson_checked', { p_lesson_id: lesson, p_expected_revision: saved.draftRevision }));
    return { course, lesson };
  }
  async function cleanup() {
    for (const c of courses) checked(await service.from('courses').delete().eq('id', c));
    for (const id of assets.reverse()) { const r = await manage(id, 'delete'); expect(r.ok(), await r.text()).toBeTruthy(); }
    await context.close();
    if (organizationId) checked(await service.from('organizations').delete().eq('id', organizationId));
    checked(await service.auth.admin.deleteUser(user.id, true));
  }
  return { service, editor, context, organizationId, userId: user.id, manage, upload, register, lesson, cleanup };
}
