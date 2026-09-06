import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { publishedLessonContent } from "../../features/learning/application/published-lesson-content.ts";
import { lessonMetadataKey, createBuilderSnapshotKey } from "../../features/learning/admin/lesson-page-builder-domain.ts";

const snapshot = {
  lesson: { title: "Published" },
  pages: [{ id: "page-a", page_number: 1, title: "Published page", subtitle: null, page_type: "concept", cover_image: {} }],
  blocks: [{ id: "block-a", page_id: "page-a", block_type: "text", sort_order: 1, payload: { body: "Published body" } }],
};
test("published content derives ownership from the requested lesson and never substitutes drafts", () => {
  const content = publishedLessonContent("lesson-a", snapshot);
  assert.equal(content.pages[0].lesson_id, "lesson-a");
  assert.equal(content.blocks[0].payload.body, "Published body");
  assert.throws(() => publishedLessonContent("lesson-a", null), /snapshot is invalid/);
  assert.throws(() => publishedLessonContent("lesson-a", { ...snapshot, blocks: [{ ...snapshot.blocks[0], page_id: "foreign" }] }), /different lesson/);
});
test("publication drift includes metadata and ignores JSON object key order", () => {
  assert.notEqual(lessonMetadataKey({ title: "Draft" }), lessonMetadataKey(snapshot.lesson));
  assert.notEqual(lessonMetadataKey({ estimated_minutes: 5 }), lessonMetadataKey({ estimated_minutes: 9 }));
  const blocks = snapshot.blocks;
  assert.equal(createBuilderSnapshotKey(snapshot.pages, blocks), createBuilderSnapshotKey(snapshot.pages, [{ ...blocks[0], payload: { body: "Published body" } }]));
  assert.equal(lessonMetadataKey({ cover_image: { src: "image", alt: "alt" } }), lessonMetadataKey({ cover_image: { alt: "alt", src: "image" } }));
});
test("learner reads stay on published projections and cards exclude snapshot bodies", () => {
  const content = readFileSync(new URL("../../lib/supabase-learning.ts", import.meta.url), "utf8");
  const publishedLoader = content.slice(content.indexOf("async function loadMappedPublishedCourses"), content.indexOf("export async function getLearningCatalog"));
  assert.doesNotMatch(publishedLoader, /\.from\("lesson_pages"\)|\.from\("lesson_content_blocks"\)/);
  assert.match(publishedLoader, /publishedLessonContent/);
  const cards = readFileSync(new URL("../../features/learning/data/course-card-data.ts", import.meta.url), "utf8");
  assert.match(cards, /\.from\("learner_lessons"\)/);
  assert.match(cards, /\.from\("learner_lesson_page_references"\)/);
  const projections = readFileSync(new URL("../../features/learning/data/course-card-projections.ts", import.meta.url), "utf8");
  assert.doesNotMatch(projections, /published_snapshot|payload/);
});
