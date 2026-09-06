import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

const flags = new Set(process.argv.slice(2));
const mode = flags.has("--close-legacy-buckets") ? "close" : "inventory";
if ([...flags].some(flag => !["--local", "--inventory", "--close-legacy-buckets"].includes(flag))) throw new Error("Usage: node scripts/media-storage-release.mjs [--local] --inventory|--close-legacy-buckets");
let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (flags.has("--local")) {
  const status = spawnSync(process.execPath, ["scripts/supabase-cli.mjs", "status", "-o", "env"], { encoding: "utf8" });
  if (status.status !== 0) throw new Error("Local Supabase is unavailable.");
  const values = Object.fromEntries(status.stdout.split("\n").map(line => line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(match => [match[1], match[2]]));
  url = values.API_URL; key = values.SERVICE_ROLE_KEY;
}
if (!url || !key) throw new Error("Provide the target Supabase URL and service-role key through the environment, or use --local.");
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.rpc(mode === "close" ? "service_close_legacy_media_buckets" : "service_media_inventory");
if (error) throw new Error(error.message);
console.log(JSON.stringify({ target: new URL(url).host, operation: mode, result: data }, null, 2));
