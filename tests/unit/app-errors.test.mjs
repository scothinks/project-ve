import assert from "node:assert/strict";
import test from "node:test";
import {
  DependencyUnavailableError,
  logAppError,
  withLoggedFallback,
} from "../../lib/app-errors.ts";

test("logAppError emits structured context without throwing", () => {
  const originalError = console.error;
  const logs = [];
  console.error = (value) => {
    logs.push(String(value));
  };

  try {
    logAppError(new DependencyUnavailableError("Database unavailable.", new Error("connection refused")), {
      operation: "notifications.unread_count",
      resourceId: "notification-feed",
      userId: "user-123",
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(logs.length, 1);
  assert.deepEqual(JSON.parse(logs[0]), {
    level: "error",
    type: "DependencyUnavailableError",
    code: "DEPENDENCY_UNAVAILABLE",
    status: 503,
    operation: "notifications.unread_count",
    userId: "user-123",
    resourceId: "notification-feed",
    error: {
      message: "connection refused",
      name: "Error",
    },
  });
});

test("withLoggedFallback returns explicit fallback and logs dependency failures", async () => {
  const originalError = console.error;
  const logs = [];
  console.error = (value) => {
    logs.push(String(value));
  };

  try {
    const result = await withLoggedFallback({
      context: { operation: "dashboard.optional_module" },
      fallback: [],
      promise: Promise.reject(new Error("query failed")),
    });

    assert.deepEqual(result, []);
  } finally {
    console.error = originalError;
  }

  assert.equal(JSON.parse(logs[0]).operation, "dashboard.optional_module");
  assert.equal(JSON.parse(logs[0]).code, "DEPENDENCY_UNAVAILABLE");
});
