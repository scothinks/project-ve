import { spawn, spawnSync } from "node:child_process";

function parseEnvOutput(output) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

let statusEnv = {};
if (!process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY || !process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY) {
  const result = spawnSync(
    process.execPath,
    ["scripts/supabase-cli.mjs", "status", "-o", "env"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    console.error(result.stderr || "Could not read local Supabase status.");
    process.exit(result.status ?? 1);
  }

  statusEnv = parseEnvOutput(result.stdout);
}
const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL ?? statusEnv.API_URL ?? "http://127.0.0.1:54321";
const localPublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY ?? statusEnv.PUBLISHABLE_KEY ?? statusEnv.ANON_KEY;
const localServiceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? statusEnv.SERVICE_ROLE_KEY;

if (!localPublishableKey || !localServiceRoleKey) {
  console.error("Local Supabase keys are required. Run npm run db:start first.");
  process.exit(1);
}

const child = spawn("npm", ["run", "dev", "--", "-p", "3100"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    APP_MODE: "live",
    NEXT_PUBLIC_SUPABASE_URL: localSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: localPublishableKey,
    SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    FRAUD_HASH_SALT: process.env.FRAUD_HASH_SALT,
    OAUTH_SIGNUP_PROOF_SECRET: process.env.OAUTH_SIGNUP_PROOF_SECRET,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
