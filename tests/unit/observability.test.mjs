import assert from "node:assert/strict";
import test from "node:test";
import {
  loadNotificationPageState,
  resolveDashboardXpBalance,
} from "../../lib/observability.ts";

test("dashboard missing live profile resolves to zero XP and logs an invariant", () => {
  const logs = [];
  const xpBalance = resolveDashboardXpBalance({
    isConfigured: true,
    logger(error, context) {
      logs.push({ error, context });
    },
    profile: null,
    userId: "user-123",
  });

  assert.equal(xpBalance, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].error.name, "InvariantViolationError");
  assert.equal(logs[0].context.operation, "dashboard.profile.load");
  assert.equal(logs[0].context.userId, "user-123");
});

test("dashboard uses real profile XP without logging fallback invariants", () => {
  const logs = [];
  const xpBalance = resolveDashboardXpBalance({
    isConfigured: true,
    logger(error, context) {
      logs.push({ error, context });
    },
    profile: { xp_balance_cached: 125 },
    userId: "user-123",
  });

  assert.equal(xpBalance, 125);
  assert.equal(logs.length, 0);
});

test("notification page load failure is observable and not treated as an empty inbox", async () => {
  const logs = [];
  const state = await loadNotificationPageState({
    logger(error, context) {
      logs.push({ error, context });
    },
    notificationsPromise: Promise.resolve([]),
    unreadCountPromise: Promise.reject(new Error("count query failed")),
    userId: "user-123",
  });

  assert.deepEqual(state, {
    notificationLoadFailed: true,
    notifications: [],
    unreadCount: 0,
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].error.message, "count query failed");
  assert.equal(logs[0].context.operation, "notifications.page.load");
  assert.equal(logs[0].context.userId, "user-123");
});

test("notification page keeps valid empty inbox distinct from load failure", async () => {
  const logs = [];
  const state = await loadNotificationPageState({
    logger(error, context) {
      logs.push({ error, context });
    },
    notificationsPromise: Promise.resolve([]),
    unreadCountPromise: Promise.resolve(0),
    userId: "user-123",
  });

  assert.deepEqual(state, {
    notificationLoadFailed: false,
    notifications: [],
    unreadCount: 0,
  });
  assert.equal(logs.length, 0);
});
