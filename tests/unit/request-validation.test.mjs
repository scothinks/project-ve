import assert from "node:assert/strict";
import test from "node:test";
import {
  getEnumField,
  getNumberField,
  getStringArrayField,
  readJsonObject,
} from "../../lib/request-validation.ts";

test("readJsonObject rejects malformed JSON with a structured issue", async () => {
  const result = await readJsonObject(
    new Request("https://example.test/api", {
      method: "POST",
      body: "{not-json",
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, [{ path: "body", message: "Malformed JSON." }]);
});

test("readJsonObject rejects non-object JSON bodies", async () => {
  const result = await readJsonObject(
    new Request("https://example.test/api", {
      method: "POST",
      body: JSON.stringify([]),
    }),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, [{ path: "body", message: "Expected a JSON object." }]);
});

test("field helpers reject unexpected enum values", () => {
  const issues = [];
  const value = getEnumField({ eventType: "purchase" }, "eventType", ["impression", "click"], issues);

  assert.equal(value, null);
  assert.deepEqual(issues, [
    { path: "eventType", message: "Expected one of: impression, click." },
  ]);
});

test("field helpers validate string array members", () => {
  const issues = [];
  const value = getStringArrayField({ selectedOptionIds: ["option-1", 42] }, "selectedOptionIds", issues);

  assert.deepEqual(value, ["option-1"]);
  assert.deepEqual(issues, [
    { path: "selectedOptionIds.1", message: "Expected a non-empty string." },
  ]);
});

test("field helpers validate numeric ranges before domain execution", () => {
  const issues = [];
  const value = getNumberField({ sort_order: 0 }, "sort_order", issues, {
    integer: true,
    min: 1,
  });

  assert.equal(value, null);
  assert.deepEqual(issues, [{ path: "sort_order", message: "Must be at least 1." }]);
});
