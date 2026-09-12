import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { gunzipSync } from "node:zlib";

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

test("G0 screenshots, computed styles and build CSS match their exact-source evidence", () => {
  const root = path.join(evidenceRoot, "theme-adoption");
  const manifest = JSON.parse(readFileSync(path.join(root, "g0-captures.json"), "utf8"));
  assert.equal(manifest.captures.length, manifest.summary.captureCount);
  assert.ok(manifest.captures.length > 0);
  function verify(entry) {
    assert.match(entry.path, /^(captures|build-css)\//);
    assert.ok(!entry.path.includes(".."));
    const bytes = readFileSync(path.join(root, entry.path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
    if (entry.contentSha256) assert.equal(createHash("sha256").update(gunzipSync(bytes)).digest("hex"), entry.contentSha256);
  }
  for (const capture of manifest.captures) {
    [capture.before, capture.after, capture.styles].forEach(verify);
    assert.equal(capture.before.sha256, capture.reference.imageSha256);
    assert.equal(capture.after.sha256, capture.candidate.imageSha256);
    assert.equal(capture.styles.contentSha256, capture.reference.stylesSha256);
    assert.equal(capture.styles.contentSha256, capture.candidate.stylesSha256);
    assert.equal(capture.comparison.passed, true);
    assert.equal(capture.comparison.disallowedPixels, 0);
    assert.equal(capture.reference.sourceSha, manifest.builds.find(b => b.label === "before").sourceSha);
    assert.equal(capture.candidate.sourceSha, manifest.builds.find(b => b.label === "after").sourceSha);
  }
  for (const build of manifest.builds) build.css.forEach(verify);
});

test("G6 qualification artifacts retain their recorded bytes and complete G1 comparisons", () => {
  const root = path.join(evidenceRoot, "theme-adoption");
  const manifest = JSON.parse(readFileSync(path.join(root, "g6-artifacts.json"), "utf8"));
  assert.equal(manifest.summary.g1Comparisons, 33);
  assert.equal(manifest.summary.g1Passed, manifest.summary.g1Comparisons);
  assert.equal(manifest.summary.flatPairsFailed, 0);
  assert.ok(manifest.summary.flatPairsPassed > 0, "Flat-background evidence must not be empty");
  assert.equal(new Set(manifest.artifacts.map(entry => entry.path)).size, manifest.artifacts.length);
  for (const entry of manifest.artifacts) {
    assert.ok(entry.path.startsWith("g6/") && !entry.path.includes(".."));
    const bytes = readFileSync(path.join(root, entry.path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
    if (entry.contentSha256) assert.equal(createHash("sha256").update(gunzipSync(bytes)).digest("hex"), entry.contentSha256, entry.path);
  }
  const captures = manifest.artifacts.filter(entry => /^g6\/candidate\/.*\.evidence\.json\.gz$/.test(entry.path));
  assert.equal(captures.length, manifest.summary.candidateCaptures);
  for (const capture of captures) {
    const record = JSON.parse(gunzipSync(readFileSync(path.join(root, capture.path))).toString());
    assert.equal(record.sourceSha256, manifest.candidateSourceSha256);
    assert.equal(record.buildId, manifest.buildId);
  }
});
