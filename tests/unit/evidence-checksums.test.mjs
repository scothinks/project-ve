import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const evidenceRoot = fileURLToPath(new URL("../../docs/evidence/", import.meta.url));
const sha256Value = /^[a-f0-9]{64}$/i;
const sha256Field = /^(?:[a-z][a-z0-9_]*)?sha256$/i;

// This is an evidence-format contract, not a replacement for secret scanning.
// File paths are data: a path containing "auth" must not become the name of
// a variable assigned a high-entropy digest. Keep the algorithm beside the value.
function checkChecksumFields(value, location, field = "") {
  // Historical change manifests use null for removed files with no remaining bytes.
  if (sha256Field.test(field) && value !== null) {
    assert.equal(typeof value, "string", `${location}: checksum must be a string`);
    assert.match(value, sha256Value, `${location}: invalid SHA-256 checksum`);
  }
  if (typeof value === "string" && sha256Value.test(value)) {
    assert.match(field, sha256Field, `${location}: use an explicit sha256 field`);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => checkChecksumFields(entry, `${location}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      checkChecksumFields(entry, `${location}.${key}`, key);
    }
  }
}

test("all JSON evidence keeps SHA-256 values in explicit algorithm fields", () => {
  const files = readdirSync(evidenceRoot, { recursive: true })
    .filter((file) => file.endsWith(".json"));
  assert.ok(files.length > 0);
  for (const file of files) {
    checkChecksumFields(JSON.parse(readFileSync(path.join(evidenceRoot, file), "utf8")), file);
  }
});

test("guided journey screenshot bytes still match the historical evidence manifest", () => {
  const directory = path.join(evidenceRoot, "ai-course-guided-journey");
  const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.ok(manifest.sourceFiles.length > 0);
  assert.ok(manifest.screenshots.length > 0);
  for (const entries of [manifest.sourceFiles, manifest.screenshots]) {
    assert.equal(new Set(entries.map((entry) => entry.path)).size, entries.length);
    for (const entry of entries) {
      assert.deepEqual(Object.keys(entry).sort(), ["path", "sha256"]);
      assert.equal(typeof entry.path, "string");
      assert.match(entry.sha256, sha256Value);
    }
  }
  for (const entry of manifest.screenshots) {
    assert.equal(path.basename(entry.path), entry.path);
    const digest = createHash("sha256").update(readFileSync(path.join(directory, entry.path))).digest("hex");
    assert.equal(digest, entry.sha256, entry.path);
  }
});

test("explicit checksum fields accept historical snake case while rejecting path-shaped keys", () => {
  const digest = createHash("sha256").update("checksum format fixture").digest("hex");
  for (const field of ["sha256", "sourceSha256", "source_sha256", "globals_css_sha256"]) {
    assert.doesNotThrow(() => checkChecksumFields({ [field]: digest }, "fixture"));
  }
  for (const field of ["hash", "app/auth.ts", "app/globals.css"]) {
    assert.throws(() => checkChecksumFields({ [field]: digest }, "fixture"), /explicit sha256 field/);
  }
  assert.throws(() => checkChecksumFields({ source_sha256: "invalid" }, "fixture"), /invalid SHA-256/);
});
