import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCmsStoragePath,
  MAX_UPLOAD_BYTES,
  validateImageUpload,
} from "../../lib/admin-media-upload.ts";

const onePixelPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
]);

test("CMS image upload validator accepts PNG bytes and reads dimensions", () => {
  const result = validateImageUpload({
    bytes: onePixelPng,
    fileName: "fixture.png",
    mimeType: "image/png",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    extension: "png",
    height: 1,
    mimeType: "image/png",
    size: onePixelPng.byteLength,
    width: 1,
  });
});

test("CMS image upload validator rejects unsupported and mismatched files", () => {
  assert.deepEqual(validateImageUpload({
    bytes: new Uint8Array([0x47, 0x49, 0x46]),
    fileName: "fixture.gif",
    mimeType: "image/gif",
  }), {
    ok: false,
    error: "Upload a PNG, JPEG, or WebP image.",
  });

  assert.deepEqual(validateImageUpload({
    bytes: onePixelPng,
    fileName: "fixture.jpg",
    mimeType: "image/jpeg",
  }), {
    ok: false,
    error: "Upload a PNG, JPEG, or WebP image.",
  });
});

test("CMS image upload validator rejects empty and oversized files", () => {
  assert.deepEqual(validateImageUpload({
    bytes: new Uint8Array(),
    fileName: "empty.png",
    mimeType: "image/png",
  }), {
    ok: false,
    error: "Choose a non-empty image file.",
  });

  const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1);
  oversized.set(onePixelPng);

  assert.deepEqual(validateImageUpload({
    bytes: oversized,
    fileName: "large.png",
    mimeType: "image/png",
  }), {
    ok: false,
    error: "Image uploads must be 10 MB or smaller.",
  });
});

test("CMS storage path generation removes user-controlled path segments", () => {
  assert.equal(
    buildCmsStoragePath({
      contextId: "../course:private",
      extension: "png",
      now: new Date("2026-08-02T12:00:00.000Z"),
      uploadId: "upload/unsafe",
    }),
    "cms/course-private/2026/08/upload-unsafe.png",
  );
});
