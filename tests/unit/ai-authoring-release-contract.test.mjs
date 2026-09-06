import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deploymentRefMatches,
  hostedEvidenceSchemaVersion,
  hostedOperationKinds,
  recoveryFunctionMarkers,
  recoveryMigration,
  validateHostedEvidence,
} from "../../scripts/ai-authoring-release-contract.mjs";

test("deployment identity accepts Vercel branch and exact-SHA references", () => {
  const sha = "0123456789012345678901234567890123456789";
  assert.equal(deploymentRefMatches("main", "main", sha), true);
  assert.equal(deploymentRefMatches(sha, "main", sha), true);
  assert.equal(deploymentRefMatches("another-branch", "main", sha), false);
});

function completeEvidence(sha) {
  return {
    schemaVersion: hostedEvidenceSchemaVersion,
    revision: { sha },
    migration: { compatible: true, forwardReplay: true, ledger: [recoveryMigration.version] },
    runtime: { afterDispatchObserved: true, streamingObserved: true, workerMaxDurationSeconds: 300 },
    timings: {
      origin: "request_start",
      operations: hostedOperationKinds.map((kind) => ({
        kind,
        acknowledgementMs: 100,
        dispatchVisibleMs: 200,
        firstResultMs: 300,
        completionMs: 400,
      })),
    },
    maintenance: {
      maxIntervalMinutes: 5,
      invocationObserved: true,
      recovery: { recoveredImages: 0, settledIncomplete: 0, deferred: 0 },
    },
    tenantMedia: {
      tenantDenialObserved: true,
      privateDeliveryObserved: true,
      publicDeliveryDenied: true,
      storageReconciled: true,
    },
    reconciliation: { jobs: true, credits: true, media: true },
    rollback: { featureSwitchDisabled: true, acceptedHistoryRetained: true, legacyReviewAvailable: true },
  };
}

test("hosted release contract accepts the current migration and complete evidence", () => {
  const migration = readFileSync(`supabase/migrations/${recoveryMigration.file}`, "utf8");
  assert.ok(Object.values(recoveryFunctionMarkers(migration)).every(Boolean));

  const sha = "0123456789012345678901234567890123456789";
  const checks = validateHostedEvidence(completeEvidence(sha), sha);
  assert.ok(checks.length > hostedOperationKinds.length);
  assert.deepEqual(checks.filter((entry) => entry.status !== "pass"), []);
});

test("hosted release contract identifies timing shape and threshold drift", () => {
  const sha = "0123456789012345678901234567890123456789";
  const evidence = completeEvidence(sha);
  evidence.timings.origin = "stage_duration";
  evidence.timings.operations[0].dispatchVisibleMs = 5_001;
  evidence.timings.operations.push({ ...evidence.timings.operations[0], kind: "retired_operation" });

  const failedIds = validateHostedEvidence(evidence, sha)
    .filter((entry) => entry.status === "fail")
    .map((entry) => entry.id);
  assert.deepEqual(failedIds, [
    "evidence.timings.origin",
    "evidence.timings.operations",
    "evidence.timings.course_outline",
  ]);
});
