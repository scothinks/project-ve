import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import {
  buildCompletedMediaAsset,
  processMediaGenerationWorkItems,
  runWithBoundedConcurrency,
  summarizeMediaOutcomes,
} from "../../features/ai-generation/application/media-worker.ts";

function createMediaAsset(overrides = {}) {
  return {
    id: "asset-1",
    course_id: "course-1",
    lesson_id: "lesson-1",
    asset_type: "image",
    placement: "lesson_hero",
    source: "ai_generated",
    prompt: "Create an image",
    script: null,
    url: null,
    storage_path: null,
    provider: null,
    model: null,
    alt_text: null,
    caption: null,
    metadata: { existing: "value" },
    review_status: "draft",
    generation_status: "pending",
    generation_error: "previous failure",
    sort_order: 0,
    ...overrides,
  };
}

test("bounded concurrency runs no more than the requested worker count", async () => {
  const releases = [];
  const started = [];
  let activeCount = 0;
  let maxActiveCount = 0;

  const running = runWithBoundedConcurrency([1, 2, 3, 4], 2, async (item) => {
    started.push(item);
    activeCount += 1;
    maxActiveCount = Math.max(maxActiveCount, activeCount);
    await new Promise((resolve) => releases.push(resolve));
    activeCount -= 1;
    return item * 2;
  });

  await yieldToEventLoop();
  assert.deepEqual(started, [1, 2]);
  assert.equal(maxActiveCount, 2);

  releases.splice(0, 2).forEach((release) => release());
  await yieldToEventLoop();
  assert.deepEqual(started, [1, 2, 3, 4]);
  assert.equal(maxActiveCount, 2);

  releases.splice(0, 2).forEach((release) => release());
  const results = await running;

  assert.deepEqual(results.sort((left, right) => left - right), [2, 4, 6, 8]);
});

test("bounded concurrency handles empty input and clamps invalid limits to one worker", async () => {
  assert.deepEqual(await runWithBoundedConcurrency([], 2, async (item) => item), []);

  const order = [];
  const results = await runWithBoundedConcurrency([1, 2], 0, async (item) => {
    order.push(`start-${item}`);
    await yieldToEventLoop();
    order.push(`end-${item}`);
    return item;
  });

  assert.deepEqual(results, [1, 2]);
  assert.deepEqual(order, ["start-1", "end-1", "start-2", "end-2"]);
});

test("media outcome helpers preserve skipped counts and aggregate worker results", async () => {
  assert.deepEqual(
    summarizeMediaOutcomes(["generatedCount", "reusedCount", "failedCount", "generatedCount"], 3),
    {
      failedCount: 1,
      generatedCount: 2,
      reusedCount: 1,
      skippedCount: 3,
    },
  );

  assert.deepEqual(
    await processMediaGenerationWorkItems(
      ["generatedCount", "failedCount", "reusedCount"],
      async (outcome) => outcome,
      1,
      2,
    ),
    {
      failedCount: 1,
      generatedCount: 1,
      reusedCount: 1,
      skippedCount: 1,
    },
  );
});

test("completed media asset preserves metadata and records page cover target context", () => {
  const updatedAsset = buildCompletedMediaAsset(
    createMediaAsset(),
    { kind: "page_cover", key: "page-cover:page-1", pageId: "page-1" },
    {
      generatedAt: "2026-07-30T12:00:00.000Z",
      model: "gpt-image-1",
      provider: "openai",
      revisedPrompt: "Revised image prompt",
      storagePath: "learning-media/course-1/asset-1.png",
      url: "https://example.com/asset-1.png",
    },
  );

  assert.equal(updatedAsset.url, "https://example.com/asset-1.png");
  assert.equal(updatedAsset.storage_path, "learning-media/course-1/asset-1.png");
  assert.equal(updatedAsset.provider, "openai");
  assert.equal(updatedAsset.model, "gpt-image-1");
  assert.equal(updatedAsset.generation_status, "completed");
  assert.equal(updatedAsset.generation_error, null);
  assert.deepEqual(updatedAsset.metadata, {
    existing: "value",
    generatedAt: "2026-07-30T12:00:00.000Z",
    revisedPrompt: "Revised image prompt",
    targetKind: "page_cover",
    targetPageId: "page-1",
  });
});

test("completed media asset clears target page id for non-page-cover targets", () => {
  const updatedAsset = buildCompletedMediaAsset(
    createMediaAsset({ metadata: null }),
    { kind: "course_thumbnail", key: "course-thumbnail" },
    {
      generatedAt: "2026-07-30T12:00:00.000Z",
      model: null,
      provider: null,
      revisedPrompt: null,
      storagePath: null,
      url: null,
    },
  );

  assert.deepEqual(updatedAsset.metadata, {
    generatedAt: "2026-07-30T12:00:00.000Z",
    revisedPrompt: null,
    targetKind: "course_thumbnail",
    targetPageId: null,
  });
});
