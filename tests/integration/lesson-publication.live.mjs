import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createLearningRepository } from "../../features/app/repositories/learning.ts";
import { getAdminCoursePreview } from "../../lib/supabase-learning.ts";

function value(result) {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
test("published repositories isolate drafts and concurrent editors cannot overwrite each other", async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const editor = createClient(url, key, { auth: { persistSession: false } });
  const reader = createClient(url, key, { auth: { persistSession: false } });
  const suffix = randomUUID();
  const email = `lesson-publication-${suffix}@example.test`;
  const password = randomUUID() + randomUUID();
  const courseId = `course-cutover-${suffix}`;
  const lessonId = `lesson-cutover-${suffix}`;
  const user = value(await service.auth.admin.createUser({ email, password, email_confirm: true })).user;
  try {
    value(await service.from("profiles").update({ role: "admin" }).eq("id", user.id));
    value(await editor.auth.signInWithPassword({ email, password }));
    value(await service.from("courses").insert({ id: courseId, slug: courseId, title: "Publication contract", description: "Test", category: "Values", status: "published" }));
    value(await service.from("lessons").insert({ id: lessonId, course_id: courseId, slug: lessonId, title: "Published lesson", status: "draft", estimated_minutes: 5 }));
    const pages = [{ id: "draft-page-a", page_number: 1, title: "Published page", subtitle: null, page_type: "concept", cover_image: {} }];
    const blocks = [{ id: "draft-block-a", page_id: "draft-page-a", block_type: "text", sort_order: 1, payload: { body: "Published content" } }];
    const saved = value(await editor.rpc("admin_save_lesson_builder", { p_lesson_id: lessonId, p_expected_revision: 0, p_pages: pages, p_blocks: blocks }));
    const publication = value(await editor.rpc("admin_publish_lesson_checked", { p_lesson_id: lessonId, p_expected_revision: saved.draftRevision }));
    const baseline = publication.publishedSnapshot;
    const changes = ["Editor one", "Editor two"].map((title) => editor.rpc("admin_save_lesson_builder", {
      p_lesson_id: lessonId, p_expected_revision: publication.draftRevision,
      p_pages: baseline.pages.map((page) => ({ ...page, title })), p_blocks: baseline.blocks,
    }));
    const concurrent = await Promise.all(changes);
    assert.equal(concurrent.filter((result) => !result.error).length, 1, JSON.stringify(concurrent.map(({error}) => error)));
    assert.equal(concurrent.filter((result) => result.error?.code === "PT409").length, 1, JSON.stringify(concurrent.map(({error}) => error)));
    const winner = concurrent.find((result) => !result.error).data;
    assert.deepEqual(value(await reader.from("lessons").select("title").eq("id", lessonId)), []);
    assert.deepEqual(value(await reader.from("lesson_pages").select("title").eq("lesson_id", lessonId)), []);
    const published = value(await reader.from("learner_lessons").select("title,published_snapshot").eq("id", lessonId).single());
    assert.equal(published.title, "Published lesson");
    assert.deepEqual(published.published_snapshot, baseline);
    const repository = createLearningRepository(reader);
    const learnerLesson = await repository.getLesson(lessonId);
    assert.equal(learnerLesson.lesson.pages[0].title, "Published page");
    const preview = await getAdminCoursePreview(editor, courseId);
    assert.match(preview.lessons[0].pages[0].title, /^Editor (one|two)$/);
    const staleRevert = await editor.rpc("admin_revert_lesson_checked", { p_lesson_id: lessonId, p_expected_revision: publication.draftRevision });
    assert.equal(staleRevert.error?.code, "PT409");
    value(await editor.rpc("admin_revert_lesson_checked", { p_lesson_id: lessonId, p_expected_revision: winner.draftRevision }));
    const restored = value(await editor.from("lesson_pages").select("title").eq("lesson_id", lessonId).single());
    assert.equal(restored.title, "Published page");
  } finally {
    await service.from("courses").delete().eq("id", courseId);
    await service.auth.admin.deleteUser(user.id);
  }
});
