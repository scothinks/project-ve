import { readFileSync, readdirSync } from "node:fs";
import {
  hostedOperationKinds,
  hostedThresholds,
  operationKindMigrationFile,
  recoveryFunctionMarkers,
  recoveryMigration,
} from "./ai-authoring-release-contract.mjs";

const checks = [];

function record(id, passed, detail) {
  checks.push({ id, status: passed ? "pass" : "fail", detail });
}

function read(path) {
  return readFileSync(path, "utf8");
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

const authoringRoute = read("app/api/admin/ai/authoring/route.ts");
const eventsRoute = read("app/api/admin/ai/authoring/events/route.ts");
const workerRoute = read("app/api/admin/ai/jobs/process/route.ts");
const availability = read("features/ai-generation/authoring/availability.ts");
const environmentExample = read(".env.example");
const vercel = JSON.parse(read("vercel.json"));
const ciWorkflow = read(".github/workflows/ci.yml");

record(
  "ci.push-trigger",
  includesAll(ciWorkflow, [
    "pull_request:",
    "push:",
    "- codex/**",
    "- codex-*",
    "npm run ci",
    "npm run test:remediation:local",
  ]),
  "Pull requests and both slash- and hyphen-prefixed Codex branches run the application and remediation gates.",
);

record(
  "runtime.authoring",
  includesAll(authoringRoute, [
    'import { after, NextResponse } from "next/server"',
    "export const maxDuration = 300",
    "after(async () =>",
    "dispatchAuthoringPage",
  ]),
  "The authoring route acknowledges before an after() dispatch and declares a 300-second window.",
);

record(
  "runtime.stream",
  includesAll(eventsRoute, [
    "export const maxDuration = 60",
    'export const dynamic = "force-dynamic"',
    "new ReadableStream",
    '"Content-Type": "text/event-stream"',
    '"Cache-Control": "private, no-store"',
    '"X-Accel-Buffering": "no"',
  ]),
  "The event route declares a bounded, dynamic, unbuffered private SSE response.",
);

const authCheck = workerRoute.indexOf("if (!isAuthorized(request))");
const adminClient = workerRoute.indexOf("createSupabaseAdminClient()", authCheck);
const recoveryCall = workerRoute.indexOf("service_recover_ai_authoring_jobs", adminClient);
const claimCall = workerRoute.indexOf("processNextAiGenerationJob", recoveryCall);
record(
  "runtime.worker",
  includesAll(workerRoute, [
    "export const maxDuration = 300",
    "export async function GET",
    "export async function POST",
  ])
    && authCheck >= 0
    && adminClient > authCheck
    && recoveryCall > adminClient
    && claimCall > recoveryCall,
  "The worker authenticates before opening the service client, runs recovery before claims, and declares a 300-second window.",
);

const migrationFiles = new Set(readdirSync("supabase/migrations"));
const requiredMigrations = [
  "20260904100000_lesson_draft_publish.sql",
  "20260904110000_lesson_published_read_boundary.sql",
  "20260904120000_atomic_lesson_builder.sql",
  "20260905100000_media_registry.sql",
  "20260905110000_media_placement_authorization.sql",
  "20260905120000_media_workflow_boundaries.sql",
  "20260905130000_media_review_and_release.sql",
  "20260905140000_media_editorial_reuse.sql",
  "20260905150000_media_publication_guard.sql",
  "20260905160000_media_legacy_quota_compatibility.sql",
  "20260905170000_media_library_course_filter.sql",
  "20260905180000_atomic_lesson_duplication.sql",
  "20260906010000_ai_authoring_page_pilot.sql",
  "20260906020000_ai_authoring_application_recovery.sql",
  "20260906030000_ai_authoring_save_boundary.sql",
  "20260906040000_ai_authoring_target_review_guard.sql",
  "20260906050000_ai_authoring_results_list.sql",
  "20260906060000_ai_page_media_placeholders.sql",
  "20260906070000_ai_placeholder_validation.sql",
  "20260906080000_ai_page_assistant.sql",
  "20260906090000_ai_assistance_lifecycle.sql",
  "20260906100000_ai_assistance_application.sql",
  "20260906110000_ai_assistance_boundary_closure.sql",
  "20260906120000_inline_media_editor_discretion.sql",
  "20260906130000_ai_assistance_retry_context.sql",
  "20260906140000_ai_assistance_cover_review.sql",
  "20260906150000_ai_course_authoring_lifecycle.sql",
  "20260906160000_ai_course_atomic_application.sql",
  "20260906170000_ai_course_review_boundary.sql",
  "20260906180000_ai_course_scope_compatibility.sql",
  "20260906190000_ai_course_review_artwork.sql",
  "20260906200000_ai_course_review_locking.sql",
  "20260906210000_ai_course_recovery_consistency.sql",
  "20260906220000_ai_course_teaching_context.sql",
  "20260906230000_ai_image_authoring.sql",
  "20260906231000_ai_image_library.sql",
  "20260906232000_ai_image_job_type.sql",
  "20260906233000_ai_image_recovery_read.sql",
  "20260906234000_ai_image_apply_columns.sql",
  "20260906235000_ai_image_lesson_cover.sql",
  "20260906235500_ai_image_cover_compatibility.sql",
  "20260907010000_ai_legacy_media_mapping.sql",
  "20260907011000_ai_legacy_job_choices.sql",
  "20260907012000_ai_legacy_review_cutover.sql",
  "20260907013000_ai_legacy_mapping_types.sql",
  "20260907014000_ai_legacy_mapping_errors.sql",
  "20260907015000_ai_legacy_rolling_queue.sql",
  "20260907016000_ai_legacy_cancel_accounting.sql",
  "20260907017000_ai_legacy_backfill.sql",
  recoveryMigration.file,
];
const missingMigrations = requiredMigrations.filter((file) => !migrationFiles.has(file));
const recoveryMarkers = migrationFiles.has(recoveryMigration.file)
  ? recoveryFunctionMarkers(read(`supabase/migrations/${recoveryMigration.file}`))
  : {};
const missingRecoveryMarkers = Object.entries(recoveryMarkers)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
const operationKindSource = read(`supabase/migrations/${operationKindMigrationFile}`);
const operationKindConstraint = /add constraint ai_authoring_results_kind_check check\s*\(\s*kind in\s*\(([^)]+)\)\s*\)/i.exec(operationKindSource);
const databaseOperationKinds = operationKindConstraint
  ? [...operationKindConstraint[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
  : [];
const missingOperationKinds = hostedOperationKinds.filter((kind) => !databaseOperationKinds.includes(kind));
const unexpectedOperationKinds = databaseOperationKinds.filter((kind) => !hostedOperationKinds.includes(kind));
record(
  "migration.compatibility",
  missingMigrations.length === 0
    && missingRecoveryMarkers.length === 0
    && missingOperationKinds.length === 0
    && unexpectedOperationKinds.length === 0,
  missingMigrations.length > 0
    ? `Missing migrations: ${missingMigrations.join(", ")}`
    : missingRecoveryMarkers.length > 0
      ? `The local recovery function does not satisfy hosted markers: ${missingRecoveryMarkers.join(", ")}.`
      : missingOperationKinds.length > 0 || unexpectedOperationKinds.length > 0
        ? `Hosted operation kinds differ from the database constraint; missing: ${missingOperationKinds.join(", ") || "none"}; unexpected: ${unexpectedOperationKinds.join(", ") || "none"}.`
        : `${requiredMigrations.length} coordinated migrations are present; hosted checks match all ${databaseOperationKinds.length} database operation kinds and the checked-in recovery function.`,
);

const workerCron = vercel.crons?.find((entry) => entry.path === "/api/admin/ai/jobs/process");
const cronParts = workerCron?.schedule?.trim().split(/\s+/) ?? [];
record(
  "maintenance.declared",
  Boolean(workerCron) && cronParts.length === 5,
  workerCron
    ? `Worker maintenance is declared as ${workerCron.schedule} UTC; cadence must be qualified against the Vercel plan.`
    : "The worker maintenance route is absent from vercel.json.",
);

record(
  "rollback.switch",
  availability.includes('process.env.AI_AUTHORING_PAGE_PILOT_ENABLED === "true"')
    && environmentExample.includes("AI_AUTHORING_PAGE_PILOT_ENABLED=false")
    && read("app/api/admin/ai/legacy-media/route.ts").includes("admin_legacy_ai_media_workspace"),
  "AI Authoring remains opt-in and the legacy review route remains available for rollback.",
);

record(
  "hosted.qualification",
  includesAll(read(".github/workflows/hosted-ai-authoring-qualification.yml"), [
    "workflow_dispatch:",
    "environment: Preview",
    "VERCEL_AUTOMATION_BYPASS_SECRET",
    "SUPABASE_ACCESS_TOKEN",
    "test:release:migration:hosted",
    "qualify-ai-authoring-hosted.mjs",
  ])
    && migrationFiles.has(recoveryMigration.file)
    && includesAll(read("scripts/qualify-ai-authoring-hosted.mjs"), [
      "deployment.identity",
      "runtime.protection",
      "security.worker",
      "evidence.measurements",
    ])
    && includesAll(read("scripts/ai-authoring-release-contract.mjs"), [
      ...hostedOperationKinds,
      recoveryMigration.version,
    ])
    && hostedThresholds.acknowledgementMs === 2_000
    && hostedThresholds.dispatchVisibleMs === 5_000
    && hostedThresholds.maintenanceIntervalMinutes === 5
    && hostedThresholds.workerMaxDurationSeconds === 300,
  "A manual, secret-scoped Preview gate audits the hosted migration boundary, records deployment identity, probes the protected runtime, and validates measured evidence.",
);

record(
  "media.smoke",
  includesAll(read("scripts/media-cutover-verify.mjs"), [
    "service_media_inventory",
    "media_delivery",
    "learning_media_assets",
    "learning-media",
  ]),
  "The hosted media smoke checks the inventory RPC, private delivery route, object presence, and public denial.",
);

const failed = checks.filter((check) => check.status === "fail");
for (const check of checks) {
  console.log(`${check.status === "pass" ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
}
console.log(`\nAI Authoring release readiness: ${checks.length - failed.length}/${checks.length} checks passed.`);

if (failed.length > 0) process.exitCode = 1;
