import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  asPilotFollowUps,
  deploymentRefMatches,
  hostedQualificationOverall,
  validateHostedEvidence,
} from "./ai-authoring-release-contract.mjs";

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
let qualifiedAppUrl = appUrl;

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
    const deployments = await readJson(
      `https://api.github.com/repos/${repository}/deployments?environment=Preview&per_page=100`,
    );
    const deployment = deployments.find((entry) => entry.sha === expectedSha && deploymentRefMatches(entry.ref, ref, expectedSha))
      ?? deployments.find((entry) => entry.sha === expectedSha);
    if (!deployment) {
      record("deployment.identity", "blocked", `No Preview deployment is recorded for ${repository}@${expectedSha}.`);
      return;
    }
    const statuses = await readJson(deployment.statuses_url);
    const currentStatus = statuses[0];
    const success = currentStatus?.state === "success" ? currentStatus : null;
    const deployedUrlValue = success?.environment_url ?? success?.target_url;
    if (deployedUrlValue) {
      const deployedUrl = new URL(deployedUrlValue);
      if (deployedUrl.protocol === "https:") qualifiedAppUrl = deployedUrl;
    }
    const matched = deployment.sha === expectedSha
      && deploymentRefMatches(deployment.ref, ref, expectedSha)
      && Boolean(success);
    record(
      "deployment.identity",
      matched ? "pass" : "fail",
      matched
        ? `GitHub Preview deployment ${deployment.id} matches ${ref}@${expectedSha}; runtime probes will use its immutable URL.`
        : `Deployment ${deployment.id} records ref ${deployment.ref ?? "unknown"}, SHA ${deployment.sha}, and status ${currentStatus?.state ?? "missing"}; expected a successful ${ref} or exact-SHA reference at ${expectedSha}.`,
      {
        deploymentId: deployment.id,
        deployedRef: deployment.ref,
        deployedSha: deployment.sha,
        expectedSha,
        immutableUrl: deployedUrlValue ?? null,
        branchUrl: appUrl.origin,
      },
    );
  } catch (error) {
    record("deployment.identity", "blocked", error instanceof Error ? error.message : String(error));
  }
}

async function checkRuntime() {
  try {
    const { response, durationMs } = await timedFetch(qualifiedAppUrl, { headers: applicationHeaders() });
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
      response.status >= 200 && response.status < 400 ? "pass" : "fail",
      `The protected app returned HTTP ${response.status} in ${durationMs} ms.`,
      { httpStatus: response.status, durationMs, vercelId: response.headers.get("x-vercel-id") },
    );
  } catch (error) {
    record("runtime.protection", "blocked", error instanceof Error ? error.message : String(error));
  }
}

async function checkWorkerBoundary() {
  try {
    const workerUrl = new URL("/api/admin/ai/jobs/process", qualifiedAppUrl);
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

function validatePilotEvidence() {
  if (!evidencePath) {
    record(
      "evidence.measurements",
      "follow-up",
      "Optional pilot evidence was not supplied. Before enabling the pilot, record one representative text run, one image run, streaming, reconciliation, and capped output review.",
    );
    return;
  }
  try {
    const evidence = JSON.parse(readFileSync(resolve(evidencePath), "utf8"));
    results.push(...asPilotFollowUps(validateHostedEvidence(evidence, expectedSha)));
  } catch (error) {
    record(
      "evidence.measurements",
      "follow-up",
      `Pilot evidence could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

await checkDeploymentIdentity();
await checkRuntime();
await checkWorkerBoundary();
validatePilotEvidence();

const report = {
  generatedAt: new Date().toISOString(),
  requestedAppUrl: appUrl.origin,
  qualifiedAppUrl: qualifiedAppUrl.origin,
  repository,
  ref,
  expectedSha,
  followUpCount: results.filter((result) => result.status === "follow-up").length,
  overall: hostedQualificationOverall(results),
  results,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

for (const result of results) {
  console.log(`${result.status.toUpperCase()} ${result.id}: ${result.detail}`);
}
console.log(`\nWrote ${outputPath}`);

if (report.overall !== "pass") process.exitCode = 1;
