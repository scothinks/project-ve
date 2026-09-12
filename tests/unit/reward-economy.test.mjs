import assert from "node:assert/strict";
import test from "node:test";
import { availabilityLabel, configuredPrizeShares, missionRule, repeatabilityLabel, storefrontChecklist } from "../../features/reward-economy/vocabulary.ts";
const now = Date.parse("2026-09-12T12:00:00Z");
const live = { status: "published", is_enabled: true, visibility_mode: "store", starts_at: null, ends_at: null, offer_expires_at: null, total_available: 2, campaign: { status: "active", starts_at: null, ends_at: null } };
test("store visibility retains precedence when several conditions fail", () => {
  assert.equal(storefrontChecklist(live, now).state, "live");
  for (const [change, state] of [
    [{ status: "draft", visibility_mode: "hidden", total_available: 0 }, "disabled"],
    [{ is_enabled: false }, "disabled"],
    [{ visibility_mode: "hidden", campaign: null }, "hidden"],
    [{ visibility_mode: "system_only" }, "system only"],
    [{ visibility_mode: "campaign_only" }, "campaign only"],
    [{ campaign: null, total_available: 0 }, "campaign off"],
    [{ starts_at: "2026-10-01T00:00:00Z", total_available: 0 }, "scheduled"],
    [{ ends_at: "2026-09-12T12:00:00Z", total_available: 0 }, "ended"],
    [{ offer_expires_at: "2026-09-11T00:00:00Z" }, "ended"],
    [{ campaign: { status: "active", starts_at: null, ends_at: "2026-09-11T00:00:00Z" } }, "ended"],
    [{ total_available: 0 }, "sold out"],
  ]) assert.equal(storefrontChecklist({ ...live, ...change }, now).state, state);
  assert.equal(storefrontChecklist({ ...live, visibility_mode: "system_only" }, now).checks[1].neutral, true);
});
test("enabled zero-weight prizes retain the RPC minimum; disabled prizes do not compete", () => {
  const shares = configuredPrizeShares([{ id: "a", weight: 0, is_enabled: true }, { id: "b", weight: 3, is_enabled: true }, { id: "c", weight: 90, is_enabled: false }]);
  assert.equal(shares.get("a"), 25); assert.equal(shares.get("b"), 75); assert.equal(shares.get("c"), 0);
  assert.equal(configuredPrizeShares([{ id: "off", weight: 4, is_enabled: false }]).get("off"), 0);
  assert.equal(configuredPrizeShares([]).size, 0);
});
test("mission sentences retain time constraints and scope of repetition", () => {
  assert.equal(missionRule("lesson_count_completed", { count: 3, withinDays: 7 }), "Complete 3 lessons within 7 days.");
  assert.match(missionRule("referral_friend_completed_lessons", { requiredFriendLessonCount: 2, minimumAccountAgeHours: 24 }), /2 lessons after their account is 24 hours old/);
  assert.equal(repeatabilityLabel("per_referral"), "For each qualifying referral");
  assert.equal(availabilityLabel(null, null, now), "Always on · no end date");
  assert.match(availabilityLabel(null, "2026-09-12T12:00:00Z", now), /^Ended/);
  assert.match(availabilityLabel("2026-10-01T00:00:00Z", null, now), /not available yet/);
});

test("batch repair identifies duplicates and retains only unique new entries for another dry run", async () => {
  const { describeBatchRepair } = await import("../../features/reward-economy/batch-repair.ts");
  const { randomUUID } = await import("node:crypto");
  const fresh = randomUUID(), used = randomUUID(), another = randomUUID();
  const result = describeBatchRepair([fresh, used, fresh, "", another], new Set([used]));
  assert.deepEqual(result.retained, [fresh, another]);
  assert.deepEqual(result.issues, ["Entry 2: already uploaded for this reward.", "Entry 3: repeats an earlier entry."]);
  assert.ok(result.issues.every(issue => !issue.includes(fresh) && !issue.includes(used)));
});
