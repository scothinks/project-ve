import { spawnSync } from "node:child_process";

function parseEnvOutput(output) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

function readLocalSupabaseEnv() {
  const result = spawnSync(
    process.execPath,
    ["scripts/supabase-cli.mjs", "status", "-o", "env"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    return {};
  }

  return parseEnvOutput(result.stdout);
}

const statusEnv = readLocalSupabaseEnv();
const localSupabaseUrl =
  process.env.LOCAL_SUPABASE_URL ?? statusEnv.API_URL ?? "http://127.0.0.1:54321";
const localPublishableKey =
  process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY ??
  statusEnv.PUBLISHABLE_KEY ??
  statusEnv.ANON_KEY;
const localServiceRoleKey =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? statusEnv.SERVICE_ROLE_KEY;

if (!localPublishableKey || !localServiceRoleKey) {
  throw new Error(
    "Local Supabase keys are required. Run `npm run db:start`, or set LOCAL_SUPABASE_PUBLISHABLE_KEY and LOCAL_SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const result = spawnSync("npx", ["playwright", "test"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    APP_MODE: "live",
    PROJECT_VE_LOCAL_E2E: "1",
    NEXT_PUBLIC_SUPABASE_URL: localSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localPublishableKey,
    SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
    FRAUD_HASH_SALT: process.env.FRAUD_HASH_SALT ?? "project-ve-e2e-risk-salt",
    OAUTH_SIGNUP_PROOF_SECRET:
      process.env.OAUTH_SIGNUP_PROOF_SECRET ?? "project-ve-e2e-oauth-proof-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.LOCAL_E2E_TURNSTILE_SITE_KEY ?? "",
    TURNSTILE_SECRET_KEY: process.env.LOCAL_E2E_TURNSTILE_SECRET_KEY ?? "local-e2e-turnstile",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "project-ve-e2e-openai-key",
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
