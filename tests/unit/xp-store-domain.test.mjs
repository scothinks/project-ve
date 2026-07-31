import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPseudoQrSvg,
  claimStateLabels,
  distributionLabels,
  fulfillmentLabels,
  getNativeOutcomeDetails,
  parseText,
  sanitizeFieldValue,
  shouldShowRedemptionMessage,
} from "../../features/rewards/learner/xp-store-domain.ts";

function redemption(overrides = {}) {
  return {
    id: "redemption-1",
    rewardId: "reward-1",
    rewardTitle: "Bonus XP",
    rewardDescription: null,
    rewardThumbnail: {},
    requestedAt: "2026-01-01T00:00:00.000Z",
    fulfilledAt: null,
    xpCost: 20,
    fulfillmentType: "native",
    fulfillmentPayload: {},
    claimData: null,
    claimState: "purchased",
    userMessage: null,
    claimSteps: [],
    fulfillmentConfig: {},
    redemptionExpiresAt: null,
    expiredAt: null,
    ...overrides,
  };
}

test("store labels cover current reward fulfillment, distribution, and claim states", () => {
  assert.equal(fulfillmentLabels.manual, "Details form");
  assert.equal(fulfillmentLabels.voucher_code, "Voucher code");
  assert.equal(fulfillmentLabels.qr_code, "QR pass");
  assert.equal(fulfillmentLabels.external_link, "Partner link");
  assert.equal(fulfillmentLabels.native, "Instant unlock");

  assert.equal(distributionLabels.direct, "Direct reward");
  assert.equal(distributionLabels.perk_bundle, "Surprise perk");

  assert.equal(claimStateLabels.purchased, "Ready");
  assert.equal(claimStateLabels.details_submitted, "Processing");
  assert.equal(claimStateLabels.fulfilled, "Fulfilled");
});

test("redemption message helper hides default fulfillment messages but preserves custom copy", () => {
  assert.equal(
    shouldShowRedemptionMessage(redemption({
      fulfillmentType: "manual",
      claimState: "details_submitted",
      userMessage: "Submitted for processing.",
    })),
    false,
  );
  assert.equal(
    shouldShowRedemptionMessage(redemption({
      fulfillmentType: "voucher_code",
      userMessage: "Your voucher code is ready.",
    })),
    false,
  );
  assert.equal(
    shouldShowRedemptionMessage(redemption({
      fulfillmentType: "native",
      userMessage: "Use this before midnight.",
    })),
    true,
  );
  assert.equal(shouldShowRedemptionMessage(redemption({ userMessage: null })), false);
});

test("native outcome copy distinguishes XP awards from boost unlocks", () => {
  assert.deepEqual(
    getNativeOutcomeDetails(redemption({ fulfillmentPayload: { amount: 25 } })),
    {
      eyebrow: "XP Unlocked",
      emphasis: "+25 XP",
      description: "25 XP has been added to your balance.",
    },
  );
  assert.deepEqual(
    getNativeOutcomeDetails(redemption({
      rewardTitle: "Double XP",
      fulfillmentPayload: { multiplier: 2, durationHours: 1, uses: 3 },
    })),
    {
      eyebrow: "Boost Unlocked",
      emphasis: "2x XP",
      description: "2x XP boost is now active for 1 hour and 3 uses.",
    },
  );
});

test("text parsing and claim field sanitation normalize learner-entered data", () => {
  assert.equal(parseText("Open reward"), "Open reward");
  assert.equal(parseText(123), "");
  assert.equal(sanitizeFieldValue(" USER@EXAMPLE.COM ", "email"), "user@example.com");
  assert.equal(sanitizeFieldValue("Hello<script>", "text"), "Helloscript");
  assert.equal(sanitizeFieldValue("x".repeat(600), "text").length, 500);
  assert.equal(sanitizeFieldValue("x".repeat(2100), "textarea").length, 2000);
});

test("pseudo QR SVG output is deterministic and encoded as a data URL", () => {
  const first = buildPseudoQrSvg("PASS-123");
  const second = buildPseudoQrSvg("PASS-123");
  const third = buildPseudoQrSvg("PASS-456");

  assert.equal(first, second);
  assert.notEqual(first, third);
  assert.match(first, /^data:image\/svg\+xml;utf8,/);
  assert.match(decodeURIComponent(first), /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});
