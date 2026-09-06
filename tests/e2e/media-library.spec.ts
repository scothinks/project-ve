import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

// A real PNG exercises storage delivery, not a mocked image endpoint.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7l8AAAAASUVORK5CYII=", "base64");
test("org uploads are private and only permitted platform stock is reusable", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const users: string[] = []; const orgs: string[] = []; const contexts: BrowserContext[] = [];
  const assets: { id: string; context: BrowserContext }[] = [];
  async function session(workspace: string, admin = false) {
    const email = `media-${randomUUID()}@example.test`; const password = randomUUID() + randomUUID();
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Fixture creation failed.");
    users.push(data.user.id);
    if (admin) { const r = await service.from("profiles").update({ role: "admin" }).eq("id", data.user.id); if (r.error) throw r.error; }
    const context = await browser.newContext(); contexts.push(context);
    const cookies: { name: string; value: string }[] = [];
    const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => [], setAll: c => { cookies.push(...c); } } });
    const result = await auth.auth.signInWithPassword({ email, password }); if (result.error) throw result.error;
    await context.addCookies([...cookies, { name: "project-ve-admin-workspace", value: workspace }].map(c => ({ ...c, url: baseURL!, sameSite: "Lax" as const })));
    return { context, userId: data.user.id };
  }
  async function orgSession() {
    const id = randomUUID(); const actor = await session(id);
    const r = await service.from("organizations").insert({ id, name: `Media org ${id.slice(0, 8)}`, slug: `media-${id}`, status: "published", created_by: actor.userId }); if (r.error) throw r.error; orgs.push(id);
    const membership = await service.from("organization_memberships").insert({ organization_id: id, user_id: actor.userId, role: "organisation_owner", status: "active" }); if (membership.error) throw membership.error;
    return { ...actor, orgId: id };
  }
  async function upload(context: BrowserContext, title: string) {
    const r = await context.request.post(`${baseURL}/api/admin/learning/media/upload`, { multipart: { file: { name: "media.png", mimeType: "image/png", buffer: png }, altText: title, title, rightsConfirmed: "true", rightsEvidence: "Test-owned fixture image." } });
    expect(r.ok(), await r.text()).toBeTruthy(); const body = await r.json(); assets.push({ id: body.asset.id, context }); return body.asset as { id: string; url: string };
  }
  try {
    const a = await orgSession(); const b = await orgSession(); const platform = await session("platform-catalog", true);
    const own = await upload(a.context, "Private org image");
    expect((await a.context.request.get(baseURL + own.url)).status()).toBe(200);
    expect((await b.context.request.get(baseURL + own.url)).status()).toBe(404);
    const stock = await upload(platform.context, "Permitted platform image");
    let r = await a.context.request.get(`${baseURL}/api/admin/media/library?source=platform`);
    expect((await r.json()).assets.some((v: { id: string }) => v.id === stock.id)).toBe(false);
    r = await platform.context.request.post(`${baseURL}/api/admin/media/assets`, { data: { versionId: stock.id, action: "share", audience: "selected", organizations: [a.orgId] } }); expect(r.ok(), await r.text()).toBeTruthy();
    expect((await a.context.request.get(baseURL + stock.url)).status()).toBe(200);
    expect((await b.context.request.get(baseURL + stock.url)).status()).toBe(404);
    const page = await a.context.newPage(); await page.goto(`${baseURL}/admin/courses/new`);
    await page.locator('input[name="title"]').fill("Unsaved media course");
    await page.getByRole("button", { name: /Add a cover image/ }).click();
    await expect(page.getByRole("button", { name: /Private org image/ })).toBeVisible();
    await page.getByRole("button", { name: "Platform media", exact: true }).click();
    await page.getByRole("button", { name: /Permitted platform image/ }).click();
    await expect(page.getByRole("heading", { name: "Choose a cover image" })).not.toBeVisible();
    await expect(page.locator('input[name="title"]')).toHaveValue("Unsaved media course");
    // Picker selection grants nothing. Withdrawing before save removes preview
    // access and prevents the version from appearing in a new library request.
    r = await platform.context.request.post(`${baseURL}/api/admin/media/assets`, { data: { versionId: stock.id, action: "withdraw" } }); expect(r.ok(), await r.text()).toBeTruthy();
    expect((await a.context.request.get(baseURL + stock.url)).status()).toBe(404);
  } finally {
    for (const asset of assets.reverse()) await asset.context.request.post(`${baseURL}/api/admin/media/assets`, { data: { versionId: asset.id, action: "delete" } });
    for (const context of contexts) await context.close();
    for (const id of orgs) await service.from("organizations").delete().eq("id", id);
    for (const id of users) await service.auth.admin.deleteUser(id);
  }
});
