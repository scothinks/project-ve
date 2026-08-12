import assert from "node:assert/strict";
import test from "node:test";
import { buildConfirmedLoginPath } from "../../lib/auth-confirmation.ts";

test("confirmed login path preserves contextual referral parameters", () => {
  assert.equal(
    buildConfirmedLoginPath({
      nextPath: "/o/test-org/learn",
      referralCode: "context_token-123",
      referralKind: "contextual",
    }),
    "/login?confirmed=1&next=%2Fo%2Ftest-org%2Flearn&ref=context_token-123&refKind=contextual",
  );
});

test("confirmed login path preserves public referral without contextual kind", () => {
  assert.equal(
    buildConfirmedLoginPath({
      nextPath: "/dashboard",
      referralCode: " Friend Code! ",
      referralKind: "public",
    }),
    "/login?confirmed=1&next=%2Fdashboard&ref=FriendCode",
  );
});

test("confirmed login path rejects unsafe next paths and sanitizes contextual tokens", () => {
  assert.equal(
    buildConfirmedLoginPath({
      nextPath: "https://example.com/steal",
      referralCode: "ctx token<script>",
      referralKind: "contextual",
    }),
    "/login?confirmed=1&next=%2Fdashboard&ref=ctxtokenscript&refKind=contextual",
  );
});
