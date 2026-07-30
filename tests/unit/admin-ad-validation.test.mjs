import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAdBillingSnapshotForm,
  parseAdCampaignForm,
  parseAdCreativeVersionForm,
  parseAdPartnerForm,
} from "../../lib/admin-ad-validation.ts";

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

test("ad partner form keeps CTA domains canonical and requires HTTPS website URLs", () => {
  const result = parseAdPartnerForm(formData([
    ["name", "  Civic Partner  "],
    ["status", "active"],
    ["allowedCtaDomains", "Example.COM, sponsor.test"],
    ["websiteUrl", "http://example.com"],
  ]));

  hasIssue(result, "websiteUrl", "Must use HTTPS.");
});

test("ad campaign form rejects invalid status and inverted campaign windows", () => {
  const result = parseAdCampaignForm(formData([
    ["name", "Campaign"],
    ["partnerId", "partner-1"],
    ["status", "live"],
    ["startsAt", "2026-02-02T00:00:00Z"],
    ["endsAt", "2026-02-01T00:00:00Z"],
  ]));

  hasIssue(result, "endsAt", "Must be after startsAt.");
  hasIssue(result, "status", "Expected one of: draft, active, paused, ended, archived.");
});

test("ad creative version form validates client-facing URL and alt text", () => {
  const result = parseAdCreativeVersionForm(formData([
    ["campaignId", "campaign-1"],
    ["creativeFormat", "native_card"],
    ["name", "Launch card"],
    ["headline", "Learn"],
    ["body", "Start the lesson."],
    ["ctaLabel", "Open"],
    ["ctaUrl", "https://example.com/start"],
    ["imageAlt", "short"],
    ["sponsorLabel", "Sponsor"],
  ]));

  hasIssue(result, "imageAlt", "Must be at least 10 characters.");
});

test("ad billing snapshot form requires a valid ordered period", () => {
  const result = parseAdBillingSnapshotForm(formData([
    ["campaignId", "campaign-1"],
    ["periodStart", "2026-04-01T00:00:00Z"],
    ["periodEnd", "2026-03-01T00:00:00Z"],
  ]));

  hasIssue(result, "periodEnd", "Must be after periodStart.");
});
