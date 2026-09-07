export const hostedEvidenceSchemaVersion = 2;

export const recoveryMigration = {
  file: "20260907020000_ai_authoring_outage_recovery.sql",
  version: "20260907020000",
};

export const operationKindMigrationFile = "20260906230000_ai_image_authoring.sql";

export const hostedOperationKinds = [
  "course_outline",
  "course_draft",
  "lesson_plan",
  "lesson_draft",
  "page",
  "quiz",
  "image",
];

export const hostedTextOperationKinds = hostedOperationKinds.filter((kind) => kind !== "image");

export const hostedThresholds = {
  acknowledgementMs: 2_000,
  dispatchVisibleMs: 5_000,
  workerMaxDurationSeconds: 300,
};

export function deploymentRefMatches(deploymentRef, requestedRef, expectedSha) {
  return deploymentRef === requestedRef || deploymentRef === expectedSha;
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

export function recoveryFunctionMarkers(source) {
  const definition = String(source).toLowerCase().replace(/\s+/g, " ");
  const boundedLimitPatterns = [
    /limit\s+greatest\s*\(\s*1\s*,\s*least\s*\(\s*coalesce\s*\([^,)]+\s*,\s*20\s*\)\s*,\s*20\s*\)\s*\)/,
    /limit\s+least\s*\(\s*20\s*,\s*greatest\s*\(\s*1\s*,\s*coalesce\s*\([^,)]+\s*,\s*20\s*\)\s*\)\s*\)/,
  ];

  return {
    serviceIdentityCheck: definition.includes("private.current_request_is_service_role()"),
    boundedLimit: boundedLimitPatterns.some((pattern) => pattern.test(definition)),
    expiredLeaseBoundary: definition.includes("interval '30 minutes'"),
    skipLocked: definition.includes("for update of jobs skip locked"),
    imageCheckpoint: definition.includes("service_ai_image_checkpoint"),
    courseCheckpoint: definition.includes("service_ai_course_checkpoint"),
    pageCheckpoint: definition.includes("service_ai_page_checkpoint"),
  };
}

function check(id, passed, detail, data = {}) {
  return { id, status: passed ? "pass" : "fail", detail, ...data };
}

function missingTrueFields(value, fields) {
  return fields.filter((field) => value?.[field] !== true);
}

export function validateHostedEvidence(evidence, expectedSha) {
  const checks = [];
  checks.push(check(
    "evidence.schema",
    evidence?.schemaVersion === hostedEvidenceSchemaVersion,
    evidence?.schemaVersion === hostedEvidenceSchemaVersion
      ? `Evidence schema version ${hostedEvidenceSchemaVersion} is supported.`
      : `Expected evidence schemaVersion ${hostedEvidenceSchemaVersion}; received ${String(evidence?.schemaVersion ?? "missing")}.`,
  ));
  checks.push(check(
    "evidence.revision",
    evidence?.revision?.sha === expectedSha,
    evidence?.revision?.sha === expectedSha
      ? `Evidence identifies deployed revision ${expectedSha}.`
      : `Evidence revision is ${String(evidence?.revision?.sha ?? "missing")}; expected ${expectedSha}.`,
  ));

  checks.push(check(
    "evidence.runtime.streaming",
    evidence?.runtime?.streamingObserved === true,
    evidence?.runtime?.streamingObserved === true
      ? "The private SSE progress stream was observed on the deployment."
      : "Expected runtime.streamingObserved=true for the private SSE route.",
  ));
  checks.push(check(
    "evidence.timings.origin",
    evidence?.timings?.origin === "request_start",
    evidence?.timings?.origin === "request_start"
      ? "All timing milestones are elapsed from the initiating request start."
      : "Expected timings.origin=\"request_start\" so acknowledgement, dispatch, first-result, and completion values share one clock.",
  ));
  const operationEntries = Array.isArray(evidence?.timings?.operations)
    ? evidence.timings.operations
    : [];
  const suppliedKinds = operationEntries.map((entry) => entry?.kind);
  const unexpectedKinds = suppliedKinds.filter((kind) => !hostedOperationKinds.includes(kind));
  const duplicateKinds = suppliedKinds.filter((kind, index) => suppliedKinds.indexOf(kind) !== index);
  const textKinds = suppliedKinds.filter((kind) => hostedTextOperationKinds.includes(kind));
  const imageKinds = suppliedKinds.filter((kind) => kind === "image");
  const representativeOperationsValid = operationEntries.length === 2
    && textKinds.length === 1
    && imageKinds.length === 1
    && unexpectedKinds.length === 0
    && duplicateKinds.length === 0;
  checks.push(check(
    "evidence.timings.operations",
    representativeOperationsValid,
    representativeOperationsValid
      ? `Timing evidence contains one representative text operation (${textKinds[0]}) and one image operation.`
      : `Expected exactly one text operation (${hostedTextOperationKinds.join(", ")}) and one image operation; unexpected: ${[...new Set(unexpectedKinds)].join(", ") || "none"}; duplicates: ${[...new Set(duplicateKinds)].join(", ") || "none"}.`,
  ));
  for (const entry of operationEntries) {
    const kind = entry?.kind;
    if (!hostedOperationKinds.includes(kind)) continue;
    const timingValid = entry
      && finiteNonNegative(entry.acknowledgementMs)
      && entry.acknowledgementMs <= hostedThresholds.acknowledgementMs
      && finiteNonNegative(entry.dispatchVisibleMs)
      && entry.dispatchVisibleMs <= hostedThresholds.dispatchVisibleMs
      && finiteNonNegative(entry.firstResultMs)
      && finiteNonNegative(entry.completionMs)
      && entry.dispatchVisibleMs >= entry.acknowledgementMs
      && entry.firstResultMs >= entry.dispatchVisibleMs
      && entry.completionMs >= entry.firstResultMs;
    checks.push(check(
      `evidence.timings.${kind}`,
      Boolean(timingValid),
      timingValid
        ? `${kind} acknowledged in ${entry.acknowledgementMs} ms, became visible in ${entry.dispatchVisibleMs} ms, produced its first result in ${entry.firstResultMs} ms, and completed in ${entry.completionMs} ms.`
        : `${kind} needs elapsed-from-request acknowledgement <= ${hostedThresholds.acknowledgementMs} ms, dispatch visibility <= ${hostedThresholds.dispatchVisibleMs} ms, and ordered first-result/completion measurements.`,
      entry ? { measurements: entry } : {},
    ));
  }

  const reconciliationFields = ["jobs", "credits", "media"];
  const missingReconciliation = missingTrueFields(evidence?.reconciliation, reconciliationFields);
  checks.push(check(
    "evidence.reconciliation",
    missingReconciliation.length === 0,
    missingReconciliation.length === 0
      ? "Job, credit, and media reconciliation are recorded."
      : `Missing reconciliation evidence: ${missingReconciliation.join(", ")}.`,
  ));

  const qualityFields = ["spendingCapApproved", "textOutputReviewed", "imageOutputReviewed"];
  const missingQuality = missingTrueFields(evidence?.qualityReview, qualityFields);
  const spendingCapUsd = evidence?.qualityReview?.spendingCapUsd;
  const actualSpendUsd = evidence?.qualityReview?.actualSpendUsd;
  const spendWithinCap = finitePositive(spendingCapUsd)
    && finiteNonNegative(actualSpendUsd)
    && actualSpendUsd <= spendingCapUsd;
  checks.push(check(
    "evidence.quality-review",
    missingQuality.length === 0 && spendWithinCap,
    missingQuality.length === 0 && spendWithinCap
      ? `Representative text and image outputs were reviewed within the approved $${spendingCapUsd} cap ($${actualSpendUsd} spent).`
      : `Missing quality evidence: ${missingQuality.join(", ") || "none"}; record a positive spending cap and non-negative spend within that cap.`,
  ));

  return checks;
}

export function asPilotFollowUps(checks) {
  return checks.map((result) => result.status === "pass"
    ? result
    : { ...result, status: "follow-up" });
}

export function hostedQualificationOverall(results) {
  if (results.some((result) => result.status === "fail")) return "fail";
  if (results.some((result) => result.status === "blocked")) return "blocked";
  return "pass";
}
