import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requiredOption(name, fallback) {
  const value = option(name, fallback);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

const appUrl = new URL(requiredOption("--app-url", process.env.HOSTED_APP_URL));
const repository = requiredOption("--repo", process.env.GITHUB_REPOSITORY ?? "scothinks/project-ve");
const ref = requiredOption("--ref", process.env.GITHUB_REF_NAME);
const expectedSha = requiredOption("--expected-sha", process.env.GITHUB_SHA);
if (appUrl.protocol !== "https:") throw new Error("--app-url must use HTTPS.");
if (!/^[a-f0-9]{40}$/i.test(expectedSha)) throw new Error("--expected-sha must be a full Git commit SHA.");
const evidencePath = option("--evidence", "");
const outputPath = resolve(option("--out", "artifacts/ai-authoring-hosted-qualification.json"));
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const results = [];

function record(id, status, detail, data = {}) {
  results.push({ ...data, id, status, detail });
}

async function timedFetch(url, init = {}) {
  const started = performance.now();
  const response = await fetch(url, { redirect: "manual", ...init });
  return { response, durationMs: Math.round(performance.now() - started) };
}

function applicationHeaders(extra = {}) {
  return {
    ...(bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {}),
    ...extra,
  };
}

async function readJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "project-ve-hosted-qualification",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${url}.`);
  return response.json();
}

async function checkDeploymentIdentity() {
  try {
    const branch = await readJson(
      `https://api.github.com/repos/${repository}/branches/${encodeURIComponent(ref)}`,
    );
    const deployments = await readJson(
      `https://api.github.com/repos/${repository}/deployments?environment=Preview&per_page=100`,
    );
    const deployment = deployments.find((entry) => entry.sha === expectedSha);
    if (!deployment) {
      record("deployment.identity", "blocked", `No Preview deployment is recorded for ${repository}@${ref}.`);
      return;
    }
    const statuses = await readJson(deployment.statuses_url);
    const success = statuses.find((status) => status.state === "success") ?? statuses[0];
    const matched = deployment.sha === expectedSha && branch.commit?.sha === expectedSha;
    record(
      "deployment.identity",
      matched ? "pass" : "fail",
      matched
        ? `GitHub deployment ${deployment.id} matches ${expectedSha}.`
        : `GitHub branch ${ref} is ${branch.commit?.sha ?? "unknown"} and deployment ${deployment.id} is ${deployment.sha}; expected both to be ${expectedSha}.`,
      {
        deploymentId: deployment.id,
        deployedSha: deployment.sha,
        expectedSha,
        immutableUrl: success?.environment_url ?? success?.target_url ?? null,
        branchUrl: appUrl.origin,
      },
    );
  } catch (error) {
    record("deployment.identity", "blocked", error instanceof Error ? error.message : String(error));
  }
}

async function checkRuntime() {
  try {
    const { response, durationMs } = await timedFetch(appUrl, { headers: applicationHeaders() });
    const location = response.headers.get("location") ?? "";
    if (response.status >= 300 && response.status < 400 && location.includes("vercel.com/sso-api")) {
      record(
        "runtime.protection",
        "blocked",
        "Vercel Deployment Protection intercepted the app. Configure the automation bypass secret for this environment.",
        { httpStatus: response.status, durationMs },
      );
      return;
    }
    record(
      "runtime.protection",
      response.status < 500 ? "pass" : "fail",
      `The protected app returned HTTP ${response.status} in ${durationMs} ms.`,
      { httpStatus: response.status, durationMs, vercelId: response.headers.get("x-vercel-id") },
    );
  } catch (error) {
    record("runtime.protection", "blocked", error instanceof Error ? error.message : String(error));
  }
}

async function checkWorkerBoundary() {
  try {
    const workerUrl = new URL("/api/admin/ai/jobs/process", appUrl);
    const { response, durationMs } = await timedFetch(workerUrl, { headers: applicationHeaders() });
    const location = response.headers.get("location") ?? "";
    if (response.status >= 300 && response.status < 400 && location.includes("vercel.com/sso-api")) {
      record(
        "security.worker",
        "blocked",
        "Deployment Protection prevented the worker authorization probe.",
        { httpStatus: response.status, durationMs },
      );
      return;
    }
    record(
      "security.worker",
      response.status === 401 ? "pass" : "fail",
      response.status === 401
        ? `The hosted worker denied an unauthenticated request in ${durationMs} ms.`
        : `The hosted worker returned HTTP ${response.status}; expected 401.`,
      { httpStatus: response.status, durationMs },
    );
  } catch (error) {
    record("security.worker", "blocked", error instanceof Error ? error.message : String(error));
  }
}

const requiredOperations = [
  "course_outline",
  "course_draft",
  "lesson_plan",
  "lesson_draft",
  "page",
  "quiz",
  "image",
];

function positiveNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function validateEvidence() {
  if (!evidencePath) {
    record(
      "evidence.measurements",
      "blocked",
      "No hosted evidence file was supplied. Record migration, runtime, timing, tenant/media, reconciliation, and rollback results.",
    );
    return;
  }
  try {
    const evidence = JSON.parse(readFileSync(resolve(evidencePath), "utf8"));
    const operations = new Map((evidence.timings?.operations ?? []).map((entry) => [entry.kind, entry]));
    const timingsValid = requiredOperations.every((kind) => {
      const entry = operations.get(kind);
      return entry
        && positiveNumber(entry.acknowledgementMs)
        && entry.acknowledgementMs <= 2_000
        && positiveNumber(entry.dispatchVisibleMs)
        && entry.dispatchVisibleMs <= 5_000
        && positiveNumber(entry.firstResultMs)
        && positiveNumber(entry.completionMs)
        && entry.dispatchVisibleMs >= entry.acknowledgementMs
        && entry.firstResultMs >= entry.dispatchVisibleMs
        && entry.completionMs >= entry.firstResultMs;
    });
    const migrationValid = evidence.revision?.sha === expectedSha
      && evidence.migration?.compatible === true
      && evidence.migration?.forwardReplay === true
      && Array.isArray(evidence.migration?.ledger)
      && evidence.migration.ledger.includes("20260907020000");
    const runtimeValid = evidence.runtime?.afterDispatchObserved === true
      && evidence.runtime?.streamingObserved === true
      && evidence.runtime?.workerMaxDurationSeconds >= 300;
    const maintenanceValid = positiveNumber(evidence.maintenance?.maxIntervalMinutes)
      && evidence.maintenance.maxIntervalMinutes <= 5
      && evidence.maintenance?.invocationObserved === true
      && positiveNumber(evidence.maintenance?.recovery?.recoveredImages)
      && positiveNumber(evidence.maintenance?.recovery?.settledIncomplete)
      && evidence.maintenance?.recovery?.deferred === 0;
    const tenantMediaValid = evidence.tenantMedia?.tenantDenialObserved === true
      && evidence.tenantMedia?.privateDeliveryObserved === true
      && evidence.tenantMedia?.publicDeliveryDenied === true
      && evidence.tenantMedia?.storageReconciled === true;
    const reconciliationValid = evidence.reconciliation?.jobs === true
      && evidence.reconciliation?.credits === true
      && evidence.reconciliation?.media === true;
    const rollbackValid = evidence.rollback?.featureSwitchDisabled === true
      && evidence.rollback?.acceptedHistoryRetained === true
      && evidence.rollback?.legacyReviewAvailable === true;

    const sections = {
      migration: migrationValid,
      runtime: runtimeValid,
      timings: timingsValid,
      maintenance: maintenanceValid,
      tenantMedia: tenantMediaValid,
      reconciliation: reconciliationValid,
      rollback: rollbackValid,
    };
    const failedSections = Object.entries(sections).filter(([, passed]) => !passed).map(([name]) => name);
    record(
      "evidence.measurements",
      failedSections.length === 0 ? "pass" : "fail",
      failedSections.length === 0
        ? "Hosted evidence covers the qualified revision and all required release sections."
        : `Hosted evidence is incomplete or outside thresholds: ${failedSections.join(", ")}.`,
      { sections },
    );
  } catch (error) {
    record("evidence.measurements", "fail", error instanceof Error ? error.message : String(error));
  }
}

await checkDeploymentIdentity();
await checkRuntime();
await checkWorkerBoundary();
validateEvidence();

const report = {
  generatedAt: new Date().toISOString(),
  appUrl: appUrl.origin,
  repository,
  ref,
  expectedSha,
  overall: results.every((result) => result.status === "pass") ? "pass" : "blocked",
  results,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

for (const result of results) {
  console.log(`${result.status.toUpperCase()} ${result.id}: ${result.detail}`);
}
console.log(`\nWrote ${outputPath}`);

if (report.overall !== "pass") process.exitCode = 1;
