import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const dbUrl =
  process.env.LOCAL_SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (
  process.env.ALLOW_NONLOCAL_DB_CONCURRENCY_TESTS !== "1" &&
  !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):54322\//.test(dbUrl)
) {
  throw new Error(
    "Refusing to run destructive local AI concurrency fixtures against a non-local database. Set ALLOW_NONLOCAL_DB_CONCURRENCY_TESTS=1 to override.",
  );
}

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const adminUserId = "4b583f53-ae5d-4014-912e-ea7eaee43a5b";
const actorUserId = "5a28de43-2bb3-46f0-8566-9fcc07dbf042";
const organizationId = randomUUID();
const sleepFunctionName = `ve_ai_reservation_sleep_${suffix}`;
const sleepTriggerName = `ve_ai_reservation_sleep_${suffix}`;

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseLastLine(stdout) {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1) ?? "";
}

function failureText(reason) {
  if (reason instanceof Error) {
    return "stderr" in reason && typeof reason.stderr === "string" && reason.stderr
      ? reason.stderr
      : reason.message;
  }

  return String(reason);
}

async function psql(sql, options = {}) {
  const result = await execFileAsync(
    "psql",
    [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      ...options,
    },
  );

  return parseLastLine(result.stdout);
}

function asAuthenticated(userId, sql) {
  return `
    set role authenticated;
    select set_config('request.jwt.claim.sub', ${literal(userId)}, false);
    ${sql}
  `;
}

async function cleanup() {
  await psql(`
    drop trigger if exists ${sleepTriggerName} on public.organization_ai_usage_records;
    drop function if exists public.${sleepFunctionName}();
    delete from public.organizations where id = ${literal(organizationId)}::uuid;
  `);
}

async function setupFixture() {
  await cleanup();

  await psql(`
    insert into public.organizations (id, slug, name, status, created_by)
    values (
      ${literal(organizationId)}::uuid,
      ${literal(`ve-ai-concurrency-${suffix}`)},
      'VE-AI concurrency organisation',
      'published',
      ${literal(adminUserId)}::uuid
    );

    insert into public.organization_memberships (organization_id, user_id, role, status, invited_by)
    values (
      ${literal(organizationId)}::uuid,
      ${literal(actorUserId)}::uuid,
      'organisation_admin',
      'active',
      ${literal(adminUserId)}::uuid
    );

    insert into public.organization_temporary_entitlement_grants (
      organization_id,
      grant_type,
      entitlement_delta,
      starts_at,
      expires_at,
      reason,
      created_by
    )
    values (
      ${literal(organizationId)}::uuid,
      'granular_override',
      '{
        "ai_authoring_enabled": true,
        "ai_monthly_allocation": 100,
        "ai_hard_limit": 100,
        "ai_user_rate_limit_per_day": 10,
        "ai_organization_concurrency_limit": 10,
        "allowed_ai_operation_types": ["ai_planner_new_course"],
        "allowed_ai_roles": ["organisation_admin"]
      }'::jsonb,
      now() - interval '1 minute',
      now() + interval '1 day',
      'VE-AI concurrency fixture',
      ${literal(adminUserId)}::uuid
    );

    create function public.${sleepFunctionName}()
    returns trigger
    language plpgsql
    set search_path = public
    as $$
    begin
      if new.organization_id = ${literal(organizationId)}::uuid
         and new.idempotency_key = ${literal(`ve-ai-concurrency-a-${suffix}`)} then
        perform pg_sleep(0.5);
      end if;

      return new;
    end;
    $$;

    create trigger ${sleepTriggerName}
      before insert on public.organization_ai_usage_records
      for each row execute function public.${sleepFunctionName}();
  `);
}

async function reserve(label) {
  return psql(
    asAuthenticated(
      actorUserId,
      `
        select public.reserve_organization_ai_usage(
          ${literal(organizationId)}::uuid,
          ${literal(actorUserId)}::uuid,
          'ai_course_plan',
          ${literal(`ve-ai-concurrency-${label}-${suffix}`)},
          ${literal(`ve-ai-concurrency-${label}-${suffix}`)},
          'ai_planner_new_course',
          80,
          null,
          null,
          null,
          null,
          null,
          null,
          '{}'::jsonb
        ) ->> 'status';
      `,
    ),
  );
}

async function countReservedRows() {
  return Number(
    await psql(`
      select count(*)::integer
      from public.organization_ai_usage_records
      where organization_id = ${literal(organizationId)}::uuid
        and status = 'reserved';
    `),
  );
}

async function reservedUnits() {
  return Number(
    await psql(`
      select coalesce(sum(reserved_units), 0)::numeric
      from public.organization_ai_usage_records
      where organization_id = ${literal(organizationId)}::uuid
        and status = 'reserved';
    `),
  );
}

try {
  await setupFixture();

  const firstReservation = reserve("a");
  await delay(100);
  const results = await Promise.allSettled([firstReservation, reserve("b")]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1, "exactly one concurrent AI reservation should succeed.");
  assert.equal(rejected.length, 1, "exactly one concurrent AI reservation should be rejected.");
  assert.equal(fulfilled[0].value, "reserved", "the successful AI reservation should remain reserved.");
  assert.match(
    failureText(rejected[0].reason),
    /Organization AI hard limit would be exceeded\./,
    "the rejected AI reservation should fail on the hard budget boundary.",
  );
  assert.equal(await countReservedRows(), 1, "concurrent AI reservation must create one reserved record.");
  assert.equal(await reservedUnits(), 80, "concurrent AI reservation must not exceed the hard cap.");
} finally {
  await cleanup();
}
