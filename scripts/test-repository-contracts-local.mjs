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

  if (result.status !== 0) return {};
  return parseEnvOutput(result.stdout);
}

function getLocalSupabaseConnection() {
  const statusEnv = readLocalSupabaseEnv();
  const url = process.env.LOCAL_SUPABASE_URL ?? statusEnv.API_URL ?? "http://127.0.0.1:54321";
  const publishableKey =
    process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY ?? statusEnv.PUBLISHABLE_KEY ?? statusEnv.ANON_KEY;
  const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? statusEnv.SERVICE_ROLE_KEY;

  if (!publishableKey || !serviceRoleKey) {
    throw new Error(
      "Local Supabase keys are required. Run `npm run db:start`, or set LOCAL_SUPABASE_PUBLISHABLE_KEY and LOCAL_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { url, publishableKey, serviceRoleKey };
}

const localSupabaseConnection = getLocalSupabaseConnection();

function runContract(name, env, file) {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--loader",
      "./tests/support/next-test-loader.mjs",
      "--test",
      file,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error(`${name} repository contract failed.`);
  }
}

runContract(
  "demo",
  {
    APP_MODE: "demo",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
  "tests/integration/repository-contracts.demo.mjs",
);

runContract(
  "live",
  {
    APP_MODE: "live",
    NEXT_PUBLIC_SUPABASE_URL: localSupabaseConnection.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localSupabaseConnection.publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: localSupabaseConnection.serviceRoleKey,
  },
  "tests/integration/repository-contracts.live.mjs",
);
