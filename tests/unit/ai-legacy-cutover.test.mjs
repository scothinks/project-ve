import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {legacyMediaHref} from '../../features/ai-generation/authoring/legacy-contracts.ts';
test('legacy resolution links lead to existing contextual controls and preserve unresolved briefs',()=>{
 const brief={id:'brief',status:'mapped',targetKind:'block',targetId:'block'};
 assert.equal(legacyMediaHref('course',brief,[{kind:'block',id:'block',lessonId:'lesson',pageId:'page'}]),'/admin/courses/lessons/lesson?page=page#block-block');
 assert.equal(legacyMediaHref('course',{...brief,targetKind:'course_cover'},[]),'/admin/courses/course/review#course-artwork');
 assert.equal(legacyMediaHref('course',{...brief,status:'needs_resolution'},[]),'/admin/courses/course/media#brief-brief');
 assert.equal(legacyMediaHref('course',brief,[]),'/admin/courses/course/media#brief-brief');
});
test('old media grid and starter actions are retired while accepted workers remain',()=>{
 assert.equal(existsSync('features/learning/admin/course-media-workspace.tsx'),false);
 assert.equal(existsSync('features/learning/admin/lesson-detail-ai-media-section.tsx'),false);
 assert.doesNotMatch(readFileSync('app/admin/courses/ai-actions.ts','utf8'),/export async function (generateCourseMedia|generateLessonMedia|generateLearningMedia|normalizeCourseLegacyMedia|regenerateLearningMedia)/);
 assert.match(readFileSync('features/ai-generation/application/job-orchestration.ts','utf8'),/processMediaAssetsJob/);
 assert.match(readFileSync('app/admin/courses/[id]/settings/page.tsx','utf8'),/Earlier media and pending requests/);
});
