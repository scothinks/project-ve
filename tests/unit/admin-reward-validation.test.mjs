import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBulkPerkRewardPrizesForm,
  parsePerkReleaseBucketForm,
  parseRewardPayloadForm,
} from "../../lib/admin-reward-validation.ts";

function formData(entries) {
  const form = new FormData();

  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else {
      form.set(key, value);
    }
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

test("reward payload form rejects malformed JSON and invalid thumbnail URL", () => {
  const result = parseRewardPayloadForm(formData([
    ["rewardId", "reward-1"],
    ["title", "Airtime"],
    ["costXp", "10"],
    ["status", "published"],
    ["fulfillmentConfig", "{bad json"],
    ["thumbnailUrl", "javascript:alert(1)"],
  ]));

  hasIssue(result, "fulfillmentConfig", "Malformed JSON.");
  hasIssue(result, "thumbnailUrl", "Expected a valid HTTP or HTTPS URL.");
});

test("reward payload form enforces LMS owner scope requirements", () => {
  const organizationResult = parseRewardPayloadForm(formData([
    ["rewardId", "reward-1"],
    ["title", "Tenant reward"],
    ["costXp", "10"],
    ["status", "draft"],
    ["fulfillmentConfig", "{}"],
    ["ownerScope", "organization_owned"],
  ]));

  hasIssue(
    organizationResult,
    "organizationId",
    "Organisation-owned rewards require an organisation.",
  );

  const sponsoredResult = parseRewardPayloadForm(formData([
    ["rewardId", "reward-2"],
    ["title", "Programme reward"],
    ["costXp", "10"],
    ["status", "draft"],
    ["fulfillmentConfig", "{}"],
    ["ownerScope", "programme_sponsored"],
  ]));

  hasIssue(
    sponsoredResult,
    "sponsoredProgrammeId",
    "Programme-sponsored rewards require a programme.",
  );

  const platformResult = parseRewardPayloadForm(formData([
    ["rewardId", "reward-3"],
    ["title", "Shared platform reward"],
    ["costXp", "10"],
    ["status", "draft"],
    ["fulfillmentConfig", "{}"],
    ["ownerScope", "platform_owned"],
    ["sharedWithProgrammes", "on"],
  ]));

  assert.equal(platformResult.ok, true);
  assert.equal(platformResult.data.ownerScope, "platform_owned");
  assert.equal(platformResult.data.sharedWithProgrammes, true);
});

test("bulk perk prize form requires at least one source reward", () => {
  const result = parseBulkPerkRewardPrizesForm(formData([
    ["bundleRewardId", "bundle-1"],
  ]));

  hasIssue(result, "sourceRewardIds", "Must include at least one item.");
});

test("perk release bucket form validates required dates and ordering", () => {
  const result = parsePerkReleaseBucketForm(formData([
    ["bundleRewardId", "bundle-1"],
    ["prizeId", "prize-1"],
    ["startsAt", "2026-06-02T00:00:00Z"],
    ["endsAt", "2026-06-01T00:00:00Z"],
  ]));

  hasIssue(result, "endsAt", "Must be after startsAt.");
});
