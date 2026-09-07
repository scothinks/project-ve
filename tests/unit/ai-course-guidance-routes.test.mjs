import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const state = {}; globalThis.__guidedRouteTest = state;
const stub = source => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return stub('export {};');
  if (specifier === 'next/server') return { shortCircuit: true, url: pathToFileURL(path.resolve('node_modules/next/server.js')).href };
  if (specifier === '@/lib/admin') return stub('export const PLATFORM_CATALOG_WORKSPACE_ID="platform-catalog"; export const requireAdmin=async()=>{const s=globalThis.__guidedRouteTest;if(s.denied)throw new Error("Sign in required");return s.admin;};');
  if (specifier === '@/features/organizations/admin/entitlement-guards') return stub('export const getAdminWorkspaceAiAuthoringNotice=async()=>globalThis.__guidedRouteTest.notice;');
  if (specifier === '@/features/ai-generation/authoring/course-discovery-provider') return stub('export const generateCourseAdvice=async input=>{const s=globalThis.__guidedRouteTest;s.provider.push(input);if(s.fail)throw new Error("Provider unavailable");return s.advice;};');
  if (specifier.startsWith('@/')) { const file = path.resolve(specifier.slice(2)) + '.ts'; if (existsSync(file)) return { shortCircuit: true, url: pathToFileURL(file).href }; }
  if (specifier.startsWith('./') && context.parentURL?.endsWith('/course-availability.ts')) return { shortCircuit: true, url: new URL(specifier + '.ts', context.parentURL).href };
  return next(specifier, context);
} });
const { POST } = await import('../../app/api/admin/ai/course-guidance/route.ts');
const { GET } = await import('../../app/api/admin/ai/course-pricing/route.ts');
const { getCourseAvailability } = await import('../../features/ai-generation/authoring/course-availability.ts');
hooks.deregister();
const input = { seed: 'Our team talks over each other', answers: [], brief: { need: 'Listen before responding', audience: 'New team members', tone: 'Direct', lessonCount: 3 } };
function setup() {
  Object.assign(state, { calls: [], provider: [], notice: null, denied: false, fail: false, rpcError: null, allowance: true, advice: { brief: input.brief, question: '', choices: [], suggestedFields: [] } });
  state.admin = { workspace: { type: 'organization', id: 'selected-workspace' }, supabase: { rpc: async (name, args) => { state.calls.push([name, args]); return { data: name === 'admin_reserve_ai_course_guidance' ? state.allowance : { estimatedUnits: 57 }, error: state.rpcError }; } } };
}
function request(overrides = {}) { return new Request('http://localhost/api/admin/ai/course-guidance', { method: 'POST', body: JSON.stringify({ input, requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(), ...overrides }) }); }
async function configured(fn) {
  const keys = ['AI_AUTHORING_PAGE_PILOT_ENABLED', 'AI_AUTHORING_GUIDANCE_ENABLED', 'OPENAI_API_KEY'];
  const previous = keys.map(key => process.env[key]);
  process.env.AI_AUTHORING_PAGE_PILOT_ENABLED = 'true'; process.env.AI_AUTHORING_GUIDANCE_ENABLED = 'true'; process.env.OPENAI_API_KEY = crypto.randomUUID();
  try { await fn(); } finally { keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }); }
}
test('guidance requires an explicit authenticated, bounded request and one selected-workspace allowance', async () => configured(async () => {
  setup(); state.denied = true; await assert.rejects(() => POST(request()), /Sign in/); assert.equal(state.calls.length, 0);
  setup(); assert.equal((await POST(request({ input: { ...input, seed: 'x'.repeat(1201) } }))).status, 400); assert.equal(state.calls.length, 0);
  const response = await POST(request()); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).source, 'assistant'); assert.deepEqual(state.provider, [input]);
  assert.deepEqual(state.calls.map(c => c[0]), ['admin_reserve_ai_course_guidance']); assert.equal(state.calls[0][1].p_organization_id, 'selected-workspace');
}));
test('disabled guidance, unavailable plan and exhausted allowance preserve a usable brief without provider dispatch', async () => configured(async () => {
  for (const condition of ['flag', 'pilot', 'plan', 'allowance', 'rpc']) {
    setup(); process.env.AI_AUTHORING_GUIDANCE_ENABLED = 'true'; process.env.AI_AUTHORING_PAGE_PILOT_ENABLED = 'true';
    if (condition === 'flag') delete process.env.AI_AUTHORING_GUIDANCE_ENABLED;
    if (condition === 'pilot') delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;
    if (condition === 'plan') state.notice = 'Plan unavailable';
    if (condition === 'allowance') state.allowance = false;
    if (condition === 'rpc') state.rpcError = { code: '42501' };
    const body = await (await POST(request())).json(); assert.equal(body.source, 'starter'); assert.ok(body.advice.brief.need); assert.ok(body.advice.brief.audience); assert.equal(state.provider.length, 0);
    assert.equal(state.calls.length, ['allowance', 'rpc'].includes(condition) ? 1 : 0);
  }
}));
test('provider failure consumes only its bounded attempt and returns editable fallback without charging or generating', async () => configured(async () => {
  setup(); state.fail = true; const body = await (await POST(request())).json(); assert.equal(body.source, 'starter'); assert.match(body.notice, /could not finish/);
  assert.deepEqual(state.calls.map(c => c[0]), ['admin_reserve_ai_course_guidance']); assert.equal(state.provider.length, 1);
}));
test('price GET validates scope and does one read-only RPC in the selected workspace', async () => {
  setup(); const get = query => GET(new Request('http://localhost/api/admin/ai/course-pricing?' + query));
  for (const query of ['kind=course_draft&lessons=7', 'kind=course_draft&questions=4', 'kind=page', 'kind=course_draft&retryId=invalid']) assert.equal((await get(query)).status, 400);
  assert.equal(state.calls.length, 0);
  const response = await get('kind=course_draft&lessons=2&questions=1&organizationId=untrusted'); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(state.calls, [['admin_preview_ai_course_price', { p_kind: 'course_draft', p_lessons: 2, p_questions: 1, p_retry_id: undefined, p_organization_id: 'selected-workspace' }]]); assert.equal(state.provider.length, 0);
  state.admin.workspace.id = 'platform-catalog'; await get('kind=course_outline'); assert.equal(state.calls.at(-1)[1].p_organization_id, undefined);
  state.rpcError = { code: '42501', message: 'private details' }; const denied = await get('kind=course_outline'); assert.equal(denied.status, 403); assert.doesNotMatch(JSON.stringify(await denied.json()), /private details/);
});
test('availability is request-scoped, read-only and distinguishes plan, pilot and provider availability', async () => configured(async () => {
  setup(); assert.equal((await getCourseAvailability()).enabled, true);
  state.notice = 'Plan unavailable'; assert.equal((await getCourseAvailability()).reason, 'Plan unavailable'); state.notice = null;
  delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED; assert.match((await getCourseAvailability()).reason, /not enabled/);
  process.env.AI_AUTHORING_PAGE_PILOT_ENABLED = 'true'; delete process.env.OPENAI_API_KEY; assert.match((await getCourseAvailability()).reason, /temporarily unavailable/);
  assert.equal(state.calls.length, 0); assert.equal(state.provider.length, 0);
  const source = readFileSync('features/ai-generation/authoring/course-availability.ts', 'utf8'); assert.match(source, /cache\(async/); assert.doesNotMatch(source, /unstable_cache|createSupabaseAdminClient|\.insert\(|\.update\(/);
}));
