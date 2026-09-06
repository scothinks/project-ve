import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const orchestrationSource = readFileSync(
  new URL("../../features/ai-generation/application/job-orchestration.ts", import.meta.url),
  "utf8",
);
const textJobsSource = readFileSync(
  new URL("../../features/ai-generation/application/course-text-jobs.ts", import.meta.url),
  "utf8",
);
const mediaJobsSource = readFileSync(
  new URL("../../features/ai-generation/application/media-jobs.ts", import.meta.url),
  "utf8",
);
const jobDataSource = readFileSync(
  new URL("../../features/ai-generation/data/jobs.ts", import.meta.url),
  "utf8",
);
const processRouteSource = readFileSync(
  new URL("../../app/api/admin/ai/jobs/process/route.ts", import.meta.url),
  "utf8",
);
const learningCacheSource = readFileSync(
  new URL("../../app/admin/courses/learning-cache.ts", import.meta.url),
  "utf8",
);

test('authoring outage recovery stays on the authenticated worker and remains bounded', () => {
  const recovery = readFileSync(new URL('../../supabase/migrations/20260907020000_ai_authoring_outage_recovery.sql', import.meta.url), 'utf8');
  assert.ok(processRouteSource.indexOf('if (!isAuthorized(request))') < processRouteSource.indexOf("supabase.rpc('service_recover_ai_authoring_jobs')"));
  for (const file of ['app/api/admin/ai/authoring/route.ts', 'app/api/admin/ai/authoring/events/route.ts', 'features/ai-generation/authoring/reads.ts']) {
    assert.doesNotMatch(readFileSync(new URL('../../'+file, import.meta.url), 'utf8'), /service_recover_ai_authoring_jobs/);
  }
  assert.match(recovery, /least\(coalesce\(p_limit,20\),20\)/);
  assert.match(recovery, /for update of jobs skip locked/);
  assert.match(recovery, /interval '30 minutes'/);
  assert.match(recovery, /grant execute[^;]+to service_role/);
});

test("AI job processing remains isolated from App Router redirects", () => {
  for (const source of [
    orchestrationSource,
    textJobsSource,
    mediaJobsSource,
    jobDataSource,
    learningCacheSource,
  ]) {
    assert.doesNotMatch(source, /from ["']next\/navigation["']/);
    assert.doesNotMatch(source, /\bredirect\s*\(/);
    assert.doesNotMatch(source, /NEXT_REDIRECT/);
  }

  assert.match(
    processRouteSource,
    /from ["']@\/features\/ai-generation\/application\/job-orchestration["']/,
  );
  assert.doesNotMatch(processRouteSource, /from ["']@\/app\/admin\/courses\/ai-actions["']/);
  assert.doesNotMatch(processRouteSource, /from ["']next\/navigation["']/);
  assert.doesNotMatch(processRouteSource, /\bredirect\s*\(/);
});


test("course review reads revision fields in the existing batched lesson query", () => {
  const source=readFileSync(new URL("../../features/learning/admin/data.ts",import.meta.url),"utf8");
  const read=source.slice(source.indexOf("export async function getAdminLessons("),source.indexOf("export async function getAdminLesson("));
  assert.match(read,/\.select\("[^"\n]*draft_revision/);
  assert.doesNotMatch(read,/published_snapshot|select\("\*"/);
});
