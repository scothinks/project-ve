import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMediaSmoke,
  evaluateMediaInventory,
} from "../../scripts/media-cutover-contract.mjs";

test("retained unverified legacy rights remain visible without failing privacy cutover", () => {
  assert.deepEqual(evaluateMediaInventory({
    issues: [],
    publicBuckets: [],
    versions: 16,
    unverifiedVersions: 16,
  }), {
    inventoryResolved: true,
    rightsInventoryRecorded: true,
  });
});

test("media smoke distinguishes deployment protection from assertion failures", () => {
  const passingManagement = {
    fixtureReady: true,
    managementAssertionsPassed: true,
    allDeliveryChecksPassed: false,
  };

  assert.equal(classifyMediaSmoke({
    ...passingManagement,
    deliveryBlockedByProtection: true,
  }), "blocked");
  assert.equal(classifyMediaSmoke({
    ...passingManagement,
    deliveryBlockedByProtection: false,
  }), "fail");
  assert.equal(classifyMediaSmoke({
    ...passingManagement,
    deliveryBlockedByProtection: false,
    allDeliveryChecksPassed: true,
  }), "pass");
  assert.equal(classifyMediaSmoke({
    ...passingManagement,
    managementAssertionsPassed: false,
    deliveryBlockedByProtection: true,
  }), "fail");
});
