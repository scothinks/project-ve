import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asPilotFollowUps,
  deploymentRefMatches,
  hostedEvidenceSchemaVersion,
  hostedQualificationOverall,
  recoveryFunctionMarkers,
  recoveryMigration,
  validateHostedEvidence,
  vercelDeploymentUrl,
} from "../../scripts/ai-authoring-release-contract.mjs";

test("deployment identity accepts Vercel branch and exact-SHA references", () => {
  const sha = "0123456789012345678901234567890123456789";
  assert.equal(deploymentRefMatches("main", "main", sha), true);
  assert.equal(deploymentRefMatches(sha, "main", sha), true);
  assert.equal(deploymentRefMatches("another-branch", "main", sha), false);
});

test("deployment identity accepts only immutable Vercel app URLs", () => {
  assert.equal(vercelDeploymentUrl({
    environment_url: "https://project-example.vercel.app/path",
  }), "https://project-example.vercel.app");
  assert.equal(vercelDeploymentUrl({
    environment_url: "",
    target_url: "https://project-fallback.vercel.app",
  }), "https://project-fallback.vercel.app");
  assert.equal(vercelDeploymentUrl({
    environment_url: "https://github.com/example/actions/runs/1",
  }), null);
});

function completeEvidence(sha) {
  return {
    schemaVersion: hostedEvidenceSchemaVersion,
    revision: { sha },
    runtime: { streamingObserved: true },
    timings: {
      origin: "request_start",
      operations: ["course_outline", "image"].map((kind) => ({
        kind,
        acknowledgementMs: 100,
        dispatchVisibleMs: 200,
        firstResultMs: 300,
        completionMs: 400,
      })),
    },
    reconciliation: { jobs: true, credits: true, media: true },
    qualityReview: {
      spendingCapApproved: true,
      spendingCapUsd: 5,
      actualSpendUsd: 1.25,
      textOutputReviewed: true,
      imageOutputReviewed: true,
    },
  };
}

test("hosted release contract accepts the current migration and representative pilot evidence", () => {
  const migration = readFileSync(`supabase/migrations/${recoveryMigration.file}`, "utf8");
  assert.ok(Object.values(recoveryFunctionMarkers(migration)).every(Boolean));

  const sha = "0123456789012345678901234567890123456789";
  const checks = validateHostedEvidence(completeEvidence(sha), sha);
  assert.ok(checks.length >= 7);
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

test("incomplete pilot evidence is advisory to the hosted release gate", () => {
  const sha = "0123456789012345678901234567890123456789";
  const checks = asPilotFollowUps(validateHostedEvidence({}, sha));
  assert.ok(checks.length > 0);
  assert.deepEqual(checks.filter((entry) => entry.status === "fail"), []);
  assert.ok(checks.every((entry) => entry.status === "pass" || entry.status === "follow-up"));
  assert.equal(hostedQualificationOverall([
    { status: "pass" },
    { status: "follow-up" },
  ]), "pass");
  assert.equal(hostedQualificationOverall([{ status: "blocked" }]), "blocked");
  assert.equal(hostedQualificationOverall([{ status: "fail" }]), "fail");
});
