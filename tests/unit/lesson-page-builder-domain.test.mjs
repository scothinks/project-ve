import assert from "node:assert/strict";
import test from "node:test";
import {
  blockSummary,
  createBuilderSnapshotKey,
  getPayloadRows,
  mapPreviewBlock,
  mergeDraftBlocks,
  reconcileBuilderStateFromSave,
  swapBlockOrder,
  swapPageOrder,
  toPreviewImageAsset,
  updateBlockPayload,
} from "../../features/learning/admin/lesson-page-builder-domain.ts";

function page(overrides = {}) {
  return {
    id: "page-1",
    lesson_id: "lesson-1",
    page_number: 1,
    title: "Page 1",
    subtitle: null,
    page_type: "concept",
    cover_image: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function block(overrides = {}) {
  return {
    id: "block-1",
    page_id: "page-1",
    block_type: "text",
    sort_order: 1,
    payload: {},
    ...overrides,
  };
}

test("builder snapshot key is stable across unsorted input order", () => {
  const pages = [
    page({ id: "page-2", page_number: 2, title: "Second" }),
    page({ id: "page-1", page_number: 1, title: "First" }),
  ];
  const blocks = [
    block({ id: "block-2", page_id: "page-1", sort_order: 2, payload: { body: "Two" } }),
    block({ id: "block-1", page_id: "page-1", sort_order: 1, payload: { body: "One" } }),
  ];

  assert.equal(
    createBuilderSnapshotKey(pages, blocks),
    createBuilderSnapshotKey([...pages].reverse(), [...blocks].reverse()),
  );
});

test("save reconciliation replaces draft page and block ids from server response", () => {
  const reconciled = reconcileBuilderStateFromSave(
    [page({ id: "draft-page-1" })],
    [block({ id: "draft-block-1", page_id: "draft-page-1", isDraft: true })],
    "draft-page-1",
    {
      status: "saved",
      pages: [{ clientId: "draft-page-1", pageId: "page-saved", status: "created" }],
      blocks: [
        {
          clientId: "draft-block-1",
          blockId: "block-saved",
          pageId: "page-saved",
          sortOrder: 3,
          status: "created",
        },
      ],
    },
  );

  assert.equal(reconciled.selectedPageId, "page-saved");
  assert.equal(reconciled.pages[0].id, "page-saved");
  assert.deepEqual(reconciled.blocks[0], {
    id: "block-saved",
    page_id: "page-saved",
    block_type: "text",
    sort_order: 3,
    payload: {},
    isDraft: false,
  });
});

test("draft block merge keeps edited server rows and local-only draft blocks", () => {
  const merged = mergeDraftBlocks(
    [
      block({ id: "server-block", sort_order: 1, payload: { body: "Server" } }),
      block({ id: "unchanged-block", sort_order: 2, payload: { body: "Unchanged" } }),
    ],
    [
      block({ id: "server-block", sort_order: 4, payload: { body: "Draft edit" } }),
      block({ id: "draft-block", sort_order: 5, payload: { body: "Draft only" }, isDraft: true }),
    ],
  );

  assert.deepEqual(
    merged.map((item) => [item.id, item.sort_order, item.payload.body, item.isDraft === true]),
    [
      ["server-block", 4, "Draft edit", false],
      ["unchanged-block", 2, "Unchanged", false],
      ["draft-block", 5, "Draft only", true],
    ],
  );
});

test("page and block reorder swaps only adjacent items in scope", () => {
  assert.deepEqual(
    swapPageOrder(
      [
        page({ id: "page-1", page_number: 1 }),
        page({ id: "page-2", page_number: 2 }),
      ],
      "page-2",
      "up",
    ).map((item) => [item.id, item.page_number]),
    [
      ["page-1", 2],
      ["page-2", 1],
    ],
  );

  assert.deepEqual(
    swapBlockOrder(
      [
        block({ id: "block-1", page_id: "page-1", sort_order: 1 }),
        block({ id: "block-2", page_id: "page-1", sort_order: 2 }),
        block({ id: "block-3", page_id: "page-2", sort_order: 1 }),
      ],
      "block-2",
      "up",
    ).map((item) => [item.id, item.sort_order]),
    [
      ["block-1", 2],
      ["block-2", 1],
      ["block-3", 1],
    ],
  );
});

test("payload helpers normalize editable table rows and nested payload changes", () => {
  assert.deepEqual(getPayloadRows([[" A ", ""], "B, C", []]), [["A", ""], ["B", "C"]]);
  assert.deepEqual(
    updateBlockPayload([block({ payload: { title: "Keep" } })], "block-1", "body", "Changed")[0].payload,
    { title: "Keep", body: "Changed" },
  );
});

test("preview mapping applies expected fallbacks for rich block types", () => {
  assert.deepEqual(
    mapPreviewBlock(block({ block_type: "callout", payload: { variant: "surprise", body: "Read this" } })),
    {
      id: "block-1",
      type: "callout",
      variant: "key_point",
      label: undefined,
      title: undefined,
      body: "Read this",
    },
  );
  assert.deepEqual(
    mapPreviewBlock(block({ block_type: "table", payload: { columns: [" A ", ""], rows: ["One, Two"] } })),
    {
      id: "block-1",
      type: "table",
      title: undefined,
      columns: ["A"],
      rows: [["One", "Two"]],
      caption: undefined,
    },
  );
});

test("image preview and block summary use explicit values with safe fallbacks", () => {
  assert.deepEqual(
    toPreviewImageAsset({ src: "https://example.test/page.png", fit: "contain", positionX: 25 }, "Fallback"),
    {
      src: "https://example.test/page.png",
      alt: "Fallback",
      fit: "contain",
      positionX: 25,
      positionY: 50,
    },
  );
  assert.equal(toPreviewImageAsset({}, "Fallback"), null);
  assert.equal(blockSummary(block({ payload: { heading: "  A short heading  " } })), "A short heading");
});
