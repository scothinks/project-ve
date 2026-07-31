import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManagedImageBlockPayload,
  buildPagesByLessonId,
  findManagedImageBlock,
  getManagedImageBlockIds,
  normalizeLegacyMediaAssetType,
  resolveManualMediaTargetKind,
} from "../../features/ai-generation/application/media-targets.ts";

function asset(overrides = {}) {
  return {
    id: "asset-1",
    url: "https://example.com/image.png",
    alt_text: "",
    caption: "Budget caption",
    placement: "page_1_image",
    ...overrides,
  };
}

test("managed image block payload preserves existing presentation fields and stamps asset ownership", () => {
  assert.deepEqual(
    buildManagedImageBlockPayload(
      asset({ alt_text: "Budget alt", caption: "" }),
      {
        fit: "contain",
        positionX: 25,
        stale: "kept",
      },
    ),
    {
      fit: "contain",
      positionX: 25,
      stale: "kept",
      src: "https://example.com/image.png",
      alt: "Budget alt",
      caption: "",
      aiManagedByAssetId: "asset-1",
      aiManagedKind: "learning_media_asset",
      aiGenerated: true,
    },
  );
});

test("managed image block payload falls back from alt text to caption and placement", () => {
  assert.equal(buildManagedImageBlockPayload(asset(), {}).alt, "Budget caption");
  assert.equal(
    buildManagedImageBlockPayload(asset({ caption: "", placement: "lesson_thumbnail" }), {}).alt,
    "lesson_thumbnail",
  );
});

test("managed block lookup only matches image blocks for the selected media asset", () => {
  const blocks = [
    {
      id: "text-1",
      page_id: "page-1",
      block_type: "text",
      sort_order: 1,
      payload: { aiManagedByAssetId: "asset-1" },
    },
    {
      id: "image-other",
      page_id: "page-1",
      block_type: "image",
      sort_order: 2,
      payload: { aiManagedByAssetId: "asset-2" },
    },
    {
      id: "image-asset",
      page_id: "page-1",
      block_type: "image",
      sort_order: 3,
      payload: { aiManagedByAssetId: "asset-1" },
    },
  ];

  assert.equal(findManagedImageBlock(blocks, "asset-1")?.id, "image-asset");
  assert.equal(findManagedImageBlock(blocks, "missing"), null);
  assert.deepEqual(
    getManagedImageBlockIds(
      [
        { id: "image-asset", payload: { aiManagedByAssetId: "asset-1" } },
        { id: "image-other", payload: { aiManagedByAssetId: "asset-2" } },
        { id: "image-asset-copy", payload: { aiManagedByAssetId: "asset-1" } },
      ],
      "asset-1",
    ),
    ["image-asset", "image-asset-copy"],
  );
});

test("page grouping returns pages keyed by owning lesson", () => {
  const grouped = buildPagesByLessonId([
    { id: "page-1", lesson_id: "lesson-1" },
    { id: "page-2", lesson_id: "lesson-2" },
    { id: "page-3", lesson_id: "lesson-1" },
  ]);

  assert.deepEqual(grouped.get("lesson-1")?.map((page) => page.id), ["page-1", "page-3"]);
  assert.deepEqual(grouped.get("lesson-2")?.map((page) => page.id), ["page-2"]);
});

test("legacy media asset type normalization preserves image types and infers known target types", () => {
  assert.equal(
    normalizeLegacyMediaAssetType({
      asset_type: "thumbnail",
      placement: "lesson_thumbnail",
      lesson_id: "lesson-1",
      metadata: {},
      prompt: "",
      script: "",
    }),
    "thumbnail",
  );
  assert.equal(
    normalizeLegacyMediaAssetType({
      asset_type: "brief",
      placement: "course_cover",
      lesson_id: null,
      metadata: {},
      prompt: "",
      script: "",
    }),
    "cover",
  );
  assert.equal(
    normalizeLegacyMediaAssetType({
      asset_type: "brief",
      placement: "lesson_visual",
      lesson_id: "lesson-1",
      metadata: {},
      prompt: "Create a diagram for this page",
      script: "",
    }),
    "infographic",
  );
});

test("manual media target kind resolution only changes page placement when target page metadata exists", () => {
  assert.equal(
    resolveManualMediaTargetKind({ targetPageId: "page-1", targetKind: "page_cover" }, "infographic", ""),
    "page_block",
  );
  assert.equal(
    resolveManualMediaTargetKind({ targetPageId: "page-1", targetKind: "page_cover" }, "image", "page_block"),
    "page_block",
  );
  assert.equal(
    resolveManualMediaTargetKind({ targetKind: "lesson_thumbnail" }, "infographic", "page_block"),
    "lesson_thumbnail",
  );
});
