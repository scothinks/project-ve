import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("mission list rendering contains no award or referral-token mutation branch", () => {
  const source = readFileSync(new URL("../../lib/supabase-missions.ts", import.meta.url), "utf8");
  const loader = source.slice(
    source.indexOf("export async function getSupabaseMissionSummaries"),
    source.indexOf("export async function submitSupabaseMissionProof"),
  );

  assert.match(loader, /\.rpc\("get_dashboard_mission_state"/);
  assert.equal((loader.match(/\.rpc\(/g) ?? []).length, 1);
  assert.match(loader, /p_deliveries: summaryInputs\.map/);
  assert.doesNotMatch(loader, /award_valid_mission_xp|ensure_contextual_referral_token|syncMissionAwards/);
});

test("contextual referral-link creation remains an authenticated explicit action", () => {
  const source = readFileSync(
    new URL("../../app/api/missions/[id]/referral-link/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /export async function POST/);
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(source, /export async function GET/);
});
