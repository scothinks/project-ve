import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const supabaseHome =
  process.env.SUPABASE_CLI_HOME ?? join(tmpdir(), "project-ve-supabase-home");

mkdirSync(supabaseHome, { recursive: true });

const supabaseBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase",
);

const result = spawnSync(supabaseBin, process.argv.slice(2), {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOME: supabaseHome,
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
