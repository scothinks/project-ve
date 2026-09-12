import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
test("economy overview remains a bounded read without full domain repositories or writes", () => {
  const code = source("features/reward-economy/overview.ts");
  assert.equal((code.match(/\.from\(/g) ?? []).length, 5);
  assert.doesNotMatch(code, /\.rpc\(|\.insert\(|\.update\(|\.auth\.|service.role|getAdminRewards|getAdminMissions|select\(["']\*/);
  assert.match(code, /workspaceId/);
  assert.match(code, /source\.not\.is\.null,awarded\.not\.is\.null/);
  assert.doesNotMatch(code, /reward_id\.in|awarded_reward_id\.in/);
  assert.match(code, /eq\("organization_id", organization\)/);
  assert.match(code, /eq\("fulfillment_type", "manual"\)/);
  assert.match(code, /eq\("claim_state", "details_submitted"\)/);
  assert.match(source("app/admin/economy/page.tsx"), /workspace\.id === PLATFORM_CATALOG_WORKSPACE_ID\s*\? workspace\.id/);
});
test("stock context batches names and never loads inventory code payloads", () => {
  const code = source("features/reward-economy/stock.ts");
  assert.equal((code.match(/\.from\(/g) ?? []).length, 6);
  assert.doesNotMatch(code, /\.select\([^)]*payload|\.rpc\(|\.insert\(|\.update\(|\.auth\./);
  assert.match(code, /\.in\("id", rewardIds\)/);
  assert.match(code, /\.in\("id", campaignIds\)/);
});
test("redemption action and campaign filters are applied before the result limit", () => {
  const code = source("features/rewards/admin/data.ts");
  const start = code.indexOf("export async function getAdminRedemptions");
  const end = code.indexOf("export async function getAdminRewardsByIds", start);
  const read = code.slice(start, end);
  assert.ok(read.indexOf("filters.needsAction") < read.indexOf("query.limit(limit)"));
  assert.match(read, /reward_redemptions_reward_id_fkey\(campaign_id\)/);
  assert.match(read, /query\.not\("campaign_reward", "is", null\)/);
  assert.ok(read.indexOf('query.eq("campaign_reward.campaign_id"') < read.indexOf("query.limit(limit)"));
  assert.doesNotMatch(read, /campaignRewards|query\.in\("reward_id"/);
  assert.doesNotMatch(read, /redemptions\.filter/);
});
