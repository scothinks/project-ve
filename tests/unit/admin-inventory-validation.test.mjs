import assert from "node:assert/strict";
import test from "node:test";
import {
  parseInventoryBatchForm,
  parseReallocateInventoryForm,
  parseSetInventoryQuantityForm,
} from "../../lib/admin-inventory-validation.ts";

function formData(entries) {
  const form = new FormData();

  for (const [key, value] of entries) {
    form.set(key, value);
  }

  return form;
}

function hasIssue(result, path, message) {
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((issue) => issue.path === path && issue.message === message),
    `Expected ${path}: ${message}`,
  );
}

test("inventory batch form rejects missing reward and inverted availability window", () => {
  const result = parseInventoryBatchForm(formData([
    ["rewardId", ""],
    ["availableFrom", "2026-05-02T00:00:00Z"],
    ["expiresAt", "2026-05-01T00:00:00Z"],
    ["inventoryText", "CODE-1\nCODE-2"],
  ]));

  hasIssue(result, "expiresAt", "Must be after availableFrom.");
  hasIssue(result, "rewardId", "Required.");
});

test("set inventory quantity form accepts zero allocation and default reason", () => {
  const result = parseSetInventoryQuantityForm(formData([
    ["rewardId", "reward-1"],
    ["totalAvailable", "0"],
  ]));

  assert.equal(result.ok, true);
  assert.equal(result.data.totalAvailable, 0);
  assert.equal(result.data.reason, "Inventory quantity allocation");
});

test("reallocate inventory form validates required campaign endpoints and quantity", () => {
  const result = parseReallocateInventoryForm(formData([
    ["rewardId", "reward-1"],
    ["fromCampaignId", ""],
    ["toCampaignId", ""],
    ["quantity", "-1"],
  ]));

  hasIssue(result, "fromCampaignId", "Required.");
  hasIssue(result, "quantity", "Must be at least 0.");
  hasIssue(result, "toCampaignId", "Required.");
});
