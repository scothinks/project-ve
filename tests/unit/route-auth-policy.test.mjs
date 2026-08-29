import assert from "node:assert/strict";
import test from "node:test";
import {
  isProtectedLearnerRoutePath,
  isPublicRoutePath,
  shouldRefreshAuthInMiddleware,
} from "../../lib/route-auth-policy.ts";

test("public and API routes bypass middleware auth refresh", () => {
  for (const pathname of [
    "/",
    "/advertise",
    "/api/missions",
    "/auth/callback",
    "/contact",
    "/invite/example",
    "/privacy",
  ]) {
    assert.equal(shouldRefreshAuthInMiddleware(pathname), false, pathname);
  }
});

test("protected learner and admin routes retain middleware auth refresh", () => {
  for (const pathname of [
    "/admin",
    "/admin/courses",
    "/courses",
    "/dashboard",
    "/lessons/example",
    "/o/example",
    "/profile",
  ]) {
    assert.equal(shouldRefreshAuthInMiddleware(pathname), true, pathname);
  }
});

test("route classification keeps public entry points outside learner protection", () => {
  assert.equal(isPublicRoutePath("/org"), true);
  assert.equal(isPublicRoutePath("/api/rewards"), true);
  assert.equal(isProtectedLearnerRoutePath("/org"), false);
  assert.equal(isProtectedLearnerRoutePath("/o/example/learn"), true);
});
