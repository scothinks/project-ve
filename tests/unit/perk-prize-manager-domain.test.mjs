import assert from "node:assert/strict";
import test from "node:test";
import {
  canSavePrizeDetails,
  describePrize,
  getAddPrizeHelperCopy,
  getFocusedPrizeNotice,
  getNativeXpDefaultTitle,
  getPerkPrizeThumbnailDefaults,
  getXpBoostDefaultTitle,
  prizeTypeLabel,
  toDateInputValue,
} from "../../features/rewards/admin/perk-prize-manager-domain.ts";

function prize(overrides = {}) {
  return {
    id: "prize-1",
    prize_type: "reward",
    source_reward_id: "reward-1",
    source_reward: { title: "Cinema Ticket" },
    title: null,
    config: {},
    thumbnail: null,
    assigned_available: 0,
    ...overrides,
  };
}

test("date input values normalize valid ISO timestamps and reject empty or invalid values", () => {
  assert.equal(toDateInputValue("2026-07-31T09:45:30.000Z"), "2026-07-31T09:45");
  assert.equal(toDateInputValue(null), "");
  assert.equal(toDateInputValue("not-a-date"), "");
});

test("prize labels describe each supported perk outcome type", () => {
  assert.equal(describePrize(prize()), "Cinema Ticket");
  assert.equal(describePrize(prize({ source_reward: null })), "reward-1");
  assert.equal(describePrize(prize({ prize_type: "native_xp", config: { amount: 15 } })), "15 XP bonus");
  assert.equal(describePrize(prize({ prize_type: "xp_boost", config: { multiplier: 2.5 } })), "2.5x XP boost");

  assert.equal(prizeTypeLabel("reward"), "Real reward");
  assert.equal(prizeTypeLabel("native_xp"), "Bonus XP");
  assert.equal(prizeTypeLabel("xp_boost"), "XP boost");
});

test("default prize titles use configured values when positive", () => {
  assert.equal(getNativeXpDefaultTitle(10), "+10 XP");
  assert.equal(getNativeXpDefaultTitle(0), "Bonus XP");
  assert.equal(getXpBoostDefaultTitle(3), "3x XP Boost");
  assert.equal(getXpBoostDefaultTitle(0), "XP Boost");
});

test("thumbnail defaults preserve tabler icons and legacy icon aliases", () => {
  assert.deepEqual(
    getPerkPrizeThumbnailDefaults(prize({
      thumbnail: { color: "#fff6ed", iconSet: "tabler", iconName: "gift" },
    })),
    { color: "#fff6ed", iconName: "gift", legacyIcon: "" },
  );
  assert.deepEqual(
    getPerkPrizeThumbnailDefaults(prize({
      thumbnail: { color: "#f4fbf7", icon: "COIN" },
    })),
    { color: "#f4fbf7", iconName: "coins", legacyIcon: "" },
  );
});

test("reward prize details are locked until stock is assigned", () => {
  assert.equal(canSavePrizeDetails(prize({ prize_type: "reward", assigned_available: 0 })), false);
  assert.equal(canSavePrizeDetails(prize({ prize_type: "reward", assigned_available: 2 })), true);
  assert.equal(canSavePrizeDetails(prize({ prize_type: "native_xp", assigned_available: 0 })), true);
});

test("focused prize notices only show for the edited prize and known notice codes", () => {
  assert.equal(getFocusedPrizeNotice("prize-1", "prize-saved", "prize-1"), "Prize changes saved.");
  assert.equal(getFocusedPrizeNotice("prize-1", "prize-enabled", "prize-1"), "Prize enabled.");
  assert.equal(getFocusedPrizeNotice("prize-1", "prize-disabled", "prize-1"), "Prize disabled.");
  assert.equal(getFocusedPrizeNotice("prize-2", "prize-saved", "prize-1"), "");
  assert.equal(getFocusedPrizeNotice("prize-1", "unknown", "prize-1"), "");
});

test("add prize helper copy is scoped to the selected outcome type", () => {
  assert.match(getAddPrizeHelperCopy("reward"), /assign stock/i);
  assert.match(getAddPrizeHelperCopy("native_xp"), /XP outcome/i);
  assert.match(getAddPrizeHelperCopy("xp_boost"), /temporary XP boost/i);
});
