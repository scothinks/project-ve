import assert from "node:assert/strict";
import test from "node:test";
import {
  containsRichTextHtml,
  sanitizeRichTextHtml,
} from "../../lib/rich-text.ts";

test("rich text sanitization preserves supported lesson markup", () => {
  const sanitized = sanitizeRichTextHtml(
    '<h2>Heading</h2><p>Read <strong>carefully</strong>.</p><a href="https://example.com">Source</a>',
  );

  assert.equal(
    sanitized,
    '<h2>Heading</h2><p>Read <strong>carefully</strong>.</p><a href="https://example.com">Source</a>',
  );
  assert.equal(containsRichTextHtml(sanitized), true);
});

test("rich text sanitization removes executable markup and unsafe links", () => {
  const sanitized = sanitizeRichTextHtml(
    '<p>Safe</p><script>alert(1)</script><iframe src="https://example.com"></iframe><a href="javascript:alert(2)">Link</a>',
  );

  assert.equal(sanitized, "<p>Safe</p><a>Link</a>");
  assert.equal(sanitized.includes("javascript:"), false);
  assert.equal(sanitized.includes("<script"), false);
  assert.equal(sanitized.includes("<iframe"), false);
});
