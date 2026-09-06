export const hostedEvidenceSchemaVersion = 1;

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

export const hostedThresholds = {
  acknowledgementMs: 2_000,
  dispatchVisibleMs: 5_000,
  maintenanceIntervalMinutes: 5,
  workerMaxDurationSeconds: 300,
};

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

  const ledger = evidence?.migration?.ledger;
  const migrationCompatible = evidence?.migration?.compatible === true
    && Array.isArray(ledger)
    && ledger.includes(recoveryMigration.version);
  checks.push(check(
    "evidence.migration.compatibility",
    migrationCompatible,
    migrationCompatible
      ? `Evidence records a compatible ledger containing ${recoveryMigration.version}.`
      : `Expected migration.compatible=true and a ledger containing ${recoveryMigration.version}.`,
  ));
  checks.push(check(
    "evidence.migration.forward-replay",
    evidence?.migration?.forwardReplay === true,
    evidence?.migration?.forwardReplay === true
      ? "Forward replay against the target snapshot is recorded."
      : "Expected migration.forwardReplay=true after replaying the target snapshot.",
  ));

  checks.push(check(
    "evidence.runtime.after-dispatch",
    evidence?.runtime?.afterDispatchObserved === true,
    evidence?.runtime?.afterDispatchObserved === true
      ? "The deployed request acknowledged before the after() worker dispatch was observed."
      : "Expected runtime.afterDispatchObserved=true on the deployed runtime.",
  ));
  checks.push(check(
    "evidence.runtime.streaming",
    evidence?.runtime?.streamingObserved === true,
    evidence?.runtime?.streamingObserved === true
      ? "The private SSE progress stream was observed on the deployment."
      : "Expected runtime.streamingObserved=true for the private SSE route.",
  ));
  const workerDuration = evidence?.runtime?.workerMaxDurationSeconds;
  checks.push(check(
    "evidence.runtime.worker-duration",
    finitePositive(workerDuration) && workerDuration >= hostedThresholds.workerMaxDurationSeconds,
    finitePositive(workerDuration) && workerDuration >= hostedThresholds.workerMaxDurationSeconds
      ? `The deployed worker supports ${workerDuration} seconds.`
      : `Expected runtime.workerMaxDurationSeconds >= ${hostedThresholds.workerMaxDurationSeconds}; received ${String(workerDuration ?? "missing")}.`,
  ));

  checks.push(check(
    "evidence.timings.origin",
    evidence?.timings?.origin === "request_start",
    evidence?.timings?.origin === "request_start"
      ? "All timing milestones are elapsed from the initiating request start."
      : "Expected timings.origin=\"request_start\" so acknowledgement, dispatch, first-result, and completion values share one clock.",
  ));
  const operationEntries = evidence?.timings?.operations ?? [];
  const suppliedKinds = operationEntries.map((entry) => entry?.kind);
  const unexpectedKinds = suppliedKinds.filter((kind) => !hostedOperationKinds.includes(kind));
  const duplicateKinds = suppliedKinds.filter((kind, index) => suppliedKinds.indexOf(kind) !== index);
  checks.push(check(
    "evidence.timings.operations",
    operationEntries.length === hostedOperationKinds.length
      && unexpectedKinds.length === 0
      && duplicateKinds.length === 0,
    operationEntries.length === hostedOperationKinds.length
      && unexpectedKinds.length === 0
      && duplicateKinds.length === 0
      ? `Timing evidence contains the ${hostedOperationKinds.length} supported operation kinds exactly once.`
      : `Expected exactly: ${hostedOperationKinds.join(", ")}; unexpected: ${[...new Set(unexpectedKinds)].join(", ") || "none"}; duplicates: ${[...new Set(duplicateKinds)].join(", ") || "none"}.`,
  ));
  const operations = new Map(operationEntries.map((entry) => [entry?.kind, entry]));
  for (const kind of hostedOperationKinds) {
    const entry = operations.get(kind);
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

  const interval = evidence?.maintenance?.maxIntervalMinutes;
  checks.push(check(
    "evidence.maintenance.cadence",
    finitePositive(interval) && interval <= hostedThresholds.maintenanceIntervalMinutes,
    finitePositive(interval) && interval <= hostedThresholds.maintenanceIntervalMinutes
      ? `Maintenance runs at most every ${interval} minutes.`
      : `Expected maintenance.maxIntervalMinutes greater than 0 and at most ${hostedThresholds.maintenanceIntervalMinutes}; received ${String(interval ?? "missing")}.`,
  ));
  checks.push(check(
    "evidence.maintenance.invocation",
    evidence?.maintenance?.invocationObserved === true,
    evidence?.maintenance?.invocationObserved === true
      ? "An authenticated maintenance invocation was observed."
      : "Expected maintenance.invocationObserved=true.",
  ));
  const recovery = evidence?.maintenance?.recovery;
  const recoveryCountsValid = finiteNonNegative(recovery?.recoveredImages)
    && finiteNonNegative(recovery?.settledIncomplete)
    && recovery?.deferred === 0;
  checks.push(check(
    "evidence.maintenance.recovery",
    recoveryCountsValid,
    recoveryCountsValid
      ? `Recovery reported ${recovery.recoveredImages} recovered images, ${recovery.settledIncomplete} settled incomplete jobs, and no deferred items.`
      : "Expected non-negative recovery counts and maintenance.recovery.deferred=0.",
    recovery ? { recovery } : {},
  ));

  const tenantMediaFields = ["tenantDenialObserved", "privateDeliveryObserved", "publicDeliveryDenied", "storageReconciled"];
  const missingTenantMedia = missingTrueFields(evidence?.tenantMedia, tenantMediaFields);
  checks.push(check(
    "evidence.tenant-media",
    missingTenantMedia.length === 0,
    missingTenantMedia.length === 0
      ? "Tenant denial, private delivery, public denial, and storage reconciliation are recorded."
      : `Missing tenant/media evidence: ${missingTenantMedia.join(", ")}.`,
  ));

  const reconciliationFields = ["jobs", "credits", "media"];
  const missingReconciliation = missingTrueFields(evidence?.reconciliation, reconciliationFields);
  checks.push(check(
    "evidence.reconciliation",
    missingReconciliation.length === 0,
    missingReconciliation.length === 0
      ? "Job, credit, and media reconciliation are recorded."
      : `Missing reconciliation evidence: ${missingReconciliation.join(", ")}.`,
  ));

  const rollbackFields = ["featureSwitchDisabled", "acceptedHistoryRetained", "legacyReviewAvailable"];
  const missingRollback = missingTrueFields(evidence?.rollback, rollbackFields);
  checks.push(check(
    "evidence.rollback",
    missingRollback.length === 0,
    missingRollback.length === 0
      ? "The feature-switch rollback retained accepted history and legacy review."
      : `Missing rollback evidence: ${missingRollback.join(", ")}.`,
  ));

  return checks;
}
