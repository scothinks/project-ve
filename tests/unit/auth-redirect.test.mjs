import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoginHref,
  defaultAuthNextPath,
  getSafeAuthNextPath,
  isOrganizationAuthNextPath,
  shouldRouteAuthNextToPublicAssessment,
} from "../../lib/auth-redirect.ts";

test("auth next path helper accepts internal application paths", () => {
  assert.equal(getSafeAuthNextPath("/org/my"), "/org/my");
  assert.equal(getSafeAuthNextPath("/org/create?from=org"), "/org/create?from=org");
  assert.equal(getSafeAuthNextPath(["/missions", "/dashboard"]), "/missions");
});

test("auth next path helper rejects external or empty destinations", () => {
  assert.equal(getSafeAuthNextPath(null), defaultAuthNextPath);
  assert.equal(getSafeAuthNextPath(""), defaultAuthNextPath);
  assert.equal(getSafeAuthNextPath("https://example.com"), defaultAuthNextPath);
  assert.equal(getSafeAuthNextPath("//example.com/path"), defaultAuthNextPath);
});

test("login href helper encodes intended internal destinations", () => {
  assert.equal(createLoginHref("/org/my"), "/login?next=%2Forg%2Fmy");
});

test("organization auth destinations bypass the public assessment callback gate", () => {
  assert.equal(isOrganizationAuthNextPath("/org/my"), true);
  assert.equal(isOrganizationAuthNextPath("/o/police/learn"), true);
  assert.equal(isOrganizationAuthNextPath("/login?confirmed=1&next=%2Fo%2Fpolice%2Flearn"), true);
  assert.equal(shouldRouteAuthNextToPublicAssessment("/o/police/learn"), false);
  assert.equal(shouldRouteAuthNextToPublicAssessment("/org/my"), false);
});

test("public auth destinations still use the public assessment callback gate", () => {
  assert.equal(isOrganizationAuthNextPath("/dashboard"), false);
  assert.equal(shouldRouteAuthNextToPublicAssessment("/dashboard"), true);
  assert.equal(shouldRouteAuthNextToPublicAssessment("/onboarding/assessment"), false);
});
