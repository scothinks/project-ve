import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

function readAppMode(env) {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      "const mod = await import('./lib/app-mode.ts'); console.log(`${mod.appMode}:${mod.isDemoMode}:${mod.isLiveMode}`);",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "app mode child process failed");
  }

  return result.stdout.trim();
}

test("APP_MODE centrally selects demo mode", () => {
  assert.equal(readAppMode({ APP_MODE: "demo" }), "demo:true:false");
});

test("APP_MODE centrally selects live mode by default", () => {
  assert.equal(readAppMode({ APP_MODE: "" }), "live:false:true");
});

test("APP_MODE rejects unknown values", () => {
  assert.throws(
    () => readAppMode({ APP_MODE: "staging" }),
    /APP_MODE must be either 'demo' or 'live'/,
  );
});
