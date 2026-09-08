import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import ts from 'typescript';

const state = { entitled: true, organizations: [] };
state.admin = { supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'course', title: 'Course', organization_id: null }, error: null }) }) }) }) } };
const require = createRequire(import.meta.url);
globalThis.__lessonAvailabilityTest = state;
const stub = source => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' || specifier === 'react/jsx-runtime') return { shortCircuit: true, url: pathToFileURL(require.resolve(specifier)).href };
  if (specifier === 'server-only') return stub('export {};');
  if (specifier === '@/lib/admin') return stub('export const requireAdmin=async()=>globalThis.__lessonAvailabilityTest.admin;');
  if (specifier === '@/features/ai-generation/authoring/lesson-availability') return { shortCircuit: true, url: pathToFileURL(path.resolve('features/ai-generation/authoring/lesson-availability.ts')).href };
  if (specifier === '@/features/organizations/application/entitlements') return stub('export const resolveOrganizationEntitlements=async(client,id)=>{const s=globalThis.__lessonAvailabilityTest;s.organizations.push(id);return {entitlements:{aiAuthoringEnabled:s.entitled}};};');
  if (specifier === '@/features/organizations/admin/entitlement-guards') return stub('export const ORGANIZATION_AI_AUTHORING_NOTICE="AI authoring is not available on this organisation plan.";');
  if (specifier === './availability') return { shortCircuit: true, url: pathToFileURL(path.resolve('features/ai-generation/authoring/availability.ts')).href };
  if (specifier === 'next/link') return stub('export default "a";');
  if (specifier === 'next/navigation') return stub('export const useRouter=()=>({refresh(){}});export const notFound=()=>{throw Error("Not found");};');
  if (specifier === '@/components/admin/AdminDialog') return stub('export const AdminDrawer=()=>null; export const AdminConfirmDialog=()=>null;');
  if (specifier === './AiAssistancePreview') return stub('export const AiAssistancePreview=()=>null;');
  if (specifier === './AiPageAuthoring') return stub('import {createElement} from "react"; export const AiPageAuthoring=props=>createElement("button",null,props.resultsLabel);');
  if (specifier === './AiPageResult') return stub('export const aiButton="",aiPrimary="",aiField="";');
  if (specifier === './useAuthoringResult') return stub('export const useAuthoringResult=(id,open)=>{globalThis.__lessonAvailabilityTest.watch={id,open};return false;};export const authoringRequest=()=>{throw Error("Render must not request generation");};export class AuthoringRequestError extends Error {}');
  if (specifier === '@/components/admin/ai/AiAssistanceAuthoring') return stub('export const AiAssistanceAuthoring=globalThis.__lessonAvailabilityTest.component;');
  if (specifier === '@/features/ai-generation/authoring/contracts') return stub('export const creditLabel=()=>"";');
  if (specifier === '@/features/ai-generation/authoring/pricing-labels') return stub('export const pricedAction=()=>"";');
  return next(specifier, context);
} });
const { getLessonAssistanceAvailability } = await import('../../features/ai-generation/authoring/lesson-availability.ts');
const source = readFileSync(new URL('../../components/admin/ai/AiAssistanceAuthoring.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { AiAssistanceAuthoring } = await import('data:text/javascript,' + encodeURIComponent(code));
state.component = AiAssistanceAuthoring;
const pageSource = readFileSync(new URL('../../app/admin/courses/[id]/expand/page.tsx', import.meta.url), 'utf8');
const pageCode = ts.transpileModule(pageSource, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { default: expandPage } = await import('data:text/javascript,' + encodeURIComponent(pageCode));
hooks.deregister();

async function configured(fn) {
  const keys = ['AI_AUTHORING_PAGE_PILOT_ENABLED', 'OPENAI_API_KEY'];
  const previous = keys.map(key => process.env[key]);
  process.env.AI_AUTHORING_PAGE_PILOT_ENABLED = 'true';
  process.env.OPENAI_API_KEY = randomUUID();
  state.entitled = true; state.organizations = [];
  try { await fn(); } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
}

test('lesson suggestions check rollout, provider and the destination course plan', async () => configured(async () => {
  const admin = { supabase: {} };
  assert.deepEqual(await getLessonAssistanceAvailability(admin, null), { enabled: true, reason: null });
  assert.deepEqual(state.organizations, []);
  state.entitled = false;
  assert.match((await getLessonAssistanceAvailability(admin, 'destination-org')).reason, /organisation plan/);
  assert.deepEqual(state.organizations, ['destination-org']);
  assert.equal((await getLessonAssistanceAvailability(admin, null)).enabled, true);
  state.entitled = true;
  for (const flag of ['false', '']) {
    process.env.AI_AUTHORING_PAGE_PILOT_ENABLED = flag;
    assert.match((await getLessonAssistanceAvailability(admin, null)).reason, /not enabled/);
  }
  process.env.AI_AUTHORING_PAGE_PILOT_ENABLED = 'true';
  delete process.env.OPENAI_API_KEY;
  assert.match((await getLessonAssistanceAvailability(admin, null)).reason, /temporarily unavailable/);
}));

test('disabled lesson assistance renders an explanation and recovery instead of a blank entry', () => {
  const html = renderToStaticMarkup(createElement(AiAssistanceAuthoring, {
    courseId: 'course', kind: 'lesson_plan', enabled: false,
    unavailableReason: 'AI suggestions are temporarily unavailable.', initialResultId: 'retained-result',
  }));
  assert.match(html, /role="status"/);
  assert.match(html, /AI suggestions are temporarily unavailable/);
  assert.match(html, /edit manually or resume saved work/);
  assert.match(html, /Resume earlier work/);
  assert.doesNotMatch(html, />Suggest lessons</);
});

test('enabled lesson assistance renders the action without an unavailable notice', () => {
  const html = renderToStaticMarkup(createElement(AiAssistanceAuthoring, { courseId: 'course', kind: 'lesson_plan', enabled: true }));
  assert.match(html, />Suggest lessons</);
  assert.doesNotMatch(html, /AI suggestions are not enabled/);
});

test('direct lesson suggestion URLs preserve recovery and a way back when rollout is off', async () => configured(async () => {
  process.env.AI_AUTHORING_PAGE_PILOT_ENABLED = 'false';
  const html = renderToStaticMarkup(await expandPage({ params: Promise.resolve({ id: 'course' }), searchParams: Promise.resolve({ aiResult: 'retained-result' }) }));
  assert.match(html, /AI suggestions are not enabled yet/);
  assert.match(html, /Back to course/);
  assert.match(html, /href="\/admin\/courses\/course"/);
  assert.match(html, /Resume earlier work/);
  assert.deepEqual(state.watch, { id: 'retained-result', open: true });
  assert.doesNotMatch(html, />Suggest lessons</);
}));
