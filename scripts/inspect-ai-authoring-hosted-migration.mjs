import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { recoveryFunctionMarkers, recoveryMigration } from "./ai-authoring-release-contract.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const outputPath = resolve(option("--out", "artifacts/ai-authoring-hosted-migration.json"));
const generatedAt = new Date().toISOString();

function localMigrations() {
  return readdirSync("supabase/migrations")
    .map((name) => /^(\d{14})_.+\.sql$/.exec(name)?.[1])
    .filter(Boolean)
    .sort();
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function managementRequest(path, init = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase Management API returned HTTP ${response.status} for ${path}.`);
  }
  return response.json();
}

const report = {
  generatedAt,
  scope: "Read-only hosted migration ledger and recovery-function boundary",
  status: "blocked",
  ledger: null,
  recoveryFunction: null,
};

try {
  if (!accessToken || !projectRef) {
    throw new Error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.");
  }

  const local = localMigrations();
  const remoteRows = await managementRequest("/database/migrations");
  if (!Array.isArray(remoteRows)) throw new Error("Supabase returned an invalid migration ledger response.");
  const remote = remoteRows.map((row) => String(row.version)).sort();
  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  const missingRemote = local.filter((version) => !remoteSet.has(version));
  const remoteOnly = remote.filter((version) => !localSet.has(version));

  report.ledger = {
    compatible: missingRemote.length === 0 && remoteOnly.length === 0,
    recoveryMigrationPresent: remoteSet.has(recoveryMigration.version),
    localCount: local.length,
    remoteCount: remote.length,
    missingRemote,
    remoteOnly,
    remoteVersions: remote,
  };

  const rows = await managementRequest("/database/query", {
    method: "POST",
    body: JSON.stringify({
      read_only: true,
      query: `select
        pg_get_functiondef('public.service_recover_ai_authoring_jobs(integer)'::regprocedure) as definition,
        has_function_privilege('service_role', 'public.service_recover_ai_authoring_jobs(integer)', 'EXECUTE') as service_role_execute,
        has_function_privilege('anon', 'public.service_recover_ai_authoring_jobs(integer)', 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', 'public.service_recover_ai_authoring_jobs(integer)', 'EXECUTE') as authenticated_execute`,
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.definition) throw new Error("The hosted recovery function definition was not returned.");
  const markers = recoveryFunctionMarkers(row.definition);
  const acl = {
    serviceRoleExecute: row.service_role_execute === true,
    anonExecute: row.anon_execute === true,
    authenticatedExecute: row.authenticated_execute === true,
  };
  report.recoveryFunction = {
    compatible: Object.values(markers).every(Boolean)
      && acl.serviceRoleExecute
      && !acl.anonExecute
      && !acl.authenticatedExecute,
    definitionSha256: hash(row.definition),
    markers,
    acl,
  };
  report.status = report.ledger.compatible
    && report.ledger.recoveryMigrationPresent
    && report.recoveryFunction.compatible
    ? "pass"
    : "fail";
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.status.toUpperCase()} hosted migration audit: ${report.error ?? "ledger and recovery boundary inspected."}`);
console.log(`Wrote ${outputPath}`);
if (report.status !== "pass") process.exitCode = 1;
