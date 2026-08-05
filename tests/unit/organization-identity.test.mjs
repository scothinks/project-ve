import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeOrganizationAccentToken,
  organizationAllowsLearnerEntry,
} from "../../features/organizations/identity.ts";

test("organization accent token normalizer only accepts restrained tokens", () => {
  assert.equal(normalizeOrganizationAccentToken("mission"), "mission");
  assert.equal(normalizeOrganizationAccentToken("store"), "store");
  assert.equal(normalizeOrganizationAccentToken("color: red"), "green");
  assert.equal(normalizeOrganizationAccentToken(null), "green");
});

test("organization learner entry mirrors active lifecycle states", () => {
  assert.equal(organizationAllowsLearnerEntry({ status: "published", lifecycle_status: "active" }), true);
  assert.equal(organizationAllowsLearnerEntry({ status: "draft", lifecycle_status: "trial" }), true);
  assert.equal(organizationAllowsLearnerEntry({ status: "published", lifecycle_status: "suspended" }), false);
  assert.equal(organizationAllowsLearnerEntry({ status: "published", lifecycle_status: "archived" }), false);
  assert.equal(organizationAllowsLearnerEntry({ status: "archived", lifecycle_status: "active" }), false);
});
