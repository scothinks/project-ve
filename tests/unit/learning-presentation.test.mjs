import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';
import { parseSource } from '../../scripts/theme-contract/source.mjs';
import { checkContract } from '../../scripts/theme-contract/policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const stub = source => ({ shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(source)}` });
const reactUrl = import.meta.resolve('react');
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "react") return { shortCircuit: true, url: reactUrl };
    if (specifier === 'next/link') return stub('import React from "react"; export default ({children,...props})=>React.createElement("a",props,children);');
    if (specifier === '@/components/media/MediaImage') return stub('import React from "react"; export default ({fill,priority,sizes,...props})=>React.createElement("img",props);');
    if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith(pathToFileURL(root).href))) {
      const base = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : fileURLToPath(new URL(specifier, context.parentURL));
      const found = [base, `${base}.tsx`, `${base}.ts`].find(file => existsSync(file));
      if (found) return { shortCircuit: true, url: pathToFileURL(found).href };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.module.css')) return { shortCircuit: true, format: 'module', source: 'export default new Proxy({}, {get: (_, name) => name});' };
    if (url.startsWith(pathToFileURL(root).href) && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) return {
      shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return next(url, context);
  },
});
const { TenantIdentity } = await import('../../components/organizations/TenantIdentity.tsx');
const { OrgLearnerChrome } = await import('../../components/organizations/OrgLearnerMobile.tsx');
const { LearnerWorkspaceSwitcher } = await import('../../components/navigation/LearnerWorkspaceSwitcher.tsx');
const { CourseLibrary } = await import('../../components/course/CourseLibrary.tsx');
hooks.deregister();
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('tenant names and complete logo URLs are local props, with a named-text fallback', () => {
  const name = 'A very long organisation name — 学校 Ìmọ̀';
  const html = render(TenantIdentity, { name, logoUrl: '/wide-transparent-logo.svg' });
  assert.ok(html.includes(name));
  assert.match(html, /alt=""[^>]*src="\/wide-transparent-logo.svg"/);
  assert.doesNotMatch(html, /aperture|mask|object-cover/);
  assert.doesNotMatch(render(TenantIdentity, { name }), /<img/);
  const css = read('components/organizations/TenantIdentity.module.css');
  assert.match(css, /object-fit: contain/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.doesNotMatch(css, /overflow: hidden|text-overflow: ellipsis|clip-path|mask:/);
});

test('tenant A then B then personal rendering does not retain tenant identity or styles', () => {
  for (const [name, slug, other] of [['Tenant A', 'a', 'Tenant B'], ['Tenant B', 'b', 'Tenant A']]) {
    const html = render(OrgLearnerChrome, { organizationName: name, organizationSlug: slug, logoUrl: `/${slug}.svg`, active: 'Lessons', pointsLabel: 'Points', balance: 123 });
    assert.ok(html.indexOf(name) < html.indexOf('Learning on Project VE'));
    assert.ok(!html.includes(other));
    assert.match(html, /Points: 123/);
    assert.match(html, new RegExp(`aria-current="page"[^>]*href="/o/${slug}/learn"`));
    assert.doesNotMatch(html, /--(?:tenant|brand|identity)-|<style/);
  }
  const personal = render(LearnerWorkspaceSwitcher, { organizations: [] });
  assert.doesNotMatch(personal, /Tenant A|Tenant B|Learning on/);
  assert.match(personal, /aria-current="page"[^>]*href="\/dashboard"/);
});

const image = { src: '/course.jpg', alt: 'Course cover' };
const course = { id: 'shared-course', title: 'Shared course', description: 'One course, two deliveries', category: 'Learning', level: 'Core', xp: 40, estimatedMinutes: 12, thumbnail: image, lessons: [
  { id: 'lesson-one', title: 'First lesson', summary: 'Learn', estimatedMinutes: 6, xp: 20, coverImage: image, pages: [{ id: 'page-one' }, { id: 'page-two' }], quizQuestionCount: 0 },
  { id: 'lesson-two', title: 'Second lesson', summary: 'Apply', estimatedMinutes: 6, xp: 20, coverImage: image, pages: [{ id: 'page-three' }], quizQuestionCount: 0 },
] };
const progress = [{ lesson_id: 'lesson-one', completed_pages: ['page-one'], completed_modules: [], quiz_score: null, completed_at: null, updated_at: '2026-09-08T12:00:00Z' }];

test('current styling follows existing progress; new and completed courses do not get it', () => {
  const base = { courses: [course], variant: 'learnerEditorial', unitLabel: 'Points' };
  assert.doesNotMatch(render(CourseLibrary, base), /learning-current/);
  const active = render(CourseLibrary, { ...base, lessonProgress: progress });
  assert.match(active, /learning-current/);
  assert.match(active, /Points/);
  assert.match(active, /href="\/courses\/shared-course\/lessons\/lesson-one\?page=2"/);
  assert.doesNotMatch(render(CourseLibrary, { ...base, lessonProgress: progress, completedLessonIds: ['lesson-one', 'lesson-two'] }), /learning-current/);
});

test('same course keeps both programme destinations and independent completion counts', () => {
  const html = render(CourseLibrary, {
    courses: [course], variant: 'learnerEditorial', courseHrefPrefix: '/o/tenant-a/learn', unitLabel: 'Points',
    lessonProgress: progress,
    deliveryOptions: { 'shared-course': [{ programmeId: 'programme-a', label: 'Programme A' }, { programmeId: 'programme-b', label: 'Programme B' }] },
    completedLessonIdsByDeliveryKey: { 'shared-course:programme-a': ['lesson-one'], 'shared-course:programme-b': [] },
  });
  assert.match(html, /programmeId=programme-a/);
  assert.match(html, /programmeId=programme-b/);
  assert.match(html, /Programme A/);
  assert.match(html, /Programme B/);
  assert.match(html, /1\/2 lessons completed/);
  assert.match(html, /0\/2 lessons completed/);
  assert.match(html, /href="#all-learning"/);
});

test('released corners only clip a decorative pseudo-element and preview stays exactly 24px', () => {
  const css = postcss.parse(read('app/styles/learning.css'));
  css.walkDecls('clip-path', decl => assert.match(decl.parent.selector, /::before$/));
  css.walkRules(rule => {
    if (rule.selector.includes('::') && !rule.selector.includes(':dir')) assert.ok(rule.nodes.some(n => n.prop === 'pointer-events' && n.value === 'none'));
  });
  assert.doesNotMatch(read('app/styles/learning.css'), /overflow:\s*(?:hidden|clip)/);
  assert.match(read('components/ui/Card.tsx'), /rounded-\[24px\]/);
  assert.match(read('tests/e2e/lesson-preview.spec.ts'), /toHaveCSS\("border-radius", "24px"\)/);
});

test('G4 rejects a learner adapter even when its registry owner claims B5', () => {
  const scan = { ...parseSource('components/course/NewCard.tsx', 'const color = "var(--ve-card)";'), hazards: [] };
  const registry = { gate: 'G4', retired: [], roles: [], adapters: [], undefinedDefects: [], tokens: [{ token: '--ve-card', removal_gate: 'G5' }], occurrences: scan.entries.map(e => ({ ...e, owner: 'B5', disposition: 'keep', reason: 'fixture' })) };
  assert.match(checkContract(scan, registry).join('\n'), /legacy token in completed G4 scope/);
});
