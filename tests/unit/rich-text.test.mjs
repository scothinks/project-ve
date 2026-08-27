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

test("rich text sanitization unwraps unsupported tags and keeps escaped text", () => {
  const sanitized = sanitizeRichTextHtml(
    '<p><span onclick="alert(1)">Use <em>care</em></span> & compare 2 < 3.</p>',
  );

  assert.equal(sanitized, "<p>Use <em>care</em> &amp; compare 2 &lt; 3.</p>");
});

test("rich text sanitization preserves safe anchor attributes only", () => {
  const sanitized = sanitizeRichTextHtml(
    '<a href="https://example.com/path?q=1&v=2" target="_blank" rel="noopener noreferrer bad" onclick="alert(1)">Source</a>',
  );

  assert.equal(
    sanitized,
    '<a href="https://example.com/path?q=1&amp;v=2" target="_blank" rel="noopener noreferrer">Source</a>',
  );
});

test("rich text sanitization rejects obfuscated unsafe link protocols", () => {
  const sanitized = sanitizeRichTextHtml(
    '<a href="java&#115;cript:alert(1)">Bad</a><a href="/lessons/demo">Good</a>',
  );

  assert.equal(sanitized, '<a>Bad</a><a href="/lessons/demo">Good</a>');
});
