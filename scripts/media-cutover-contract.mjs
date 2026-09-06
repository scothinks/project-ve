export function evaluateMediaInventory(inventory) {
  const versions = Number(inventory?.versions);
  const unverifiedVersions = Number(inventory?.unverifiedVersions);
  const rightsInventoryRecorded = Number.isInteger(versions)
    && versions >= 0
    && Number.isInteger(unverifiedVersions)
    && unverifiedVersions >= 0
    && unverifiedVersions <= versions;

  return {
    inventoryResolved: Array.isArray(inventory?.issues)
      && inventory.issues.length === 0
      && Array.isArray(inventory?.publicBuckets)
      && inventory.publicBuckets.length === 0,
    rightsInventoryRecorded,
  };
}

export function classifyMediaSmoke({
  fixtureReady,
  managementAssertionsPassed,
  deliveryBlockedByProtection,
  allDeliveryChecksPassed,
}) {
  if (!fixtureReady) return "blocked";
  if (!managementAssertionsPassed) return "fail";
  if (deliveryBlockedByProtection) return "blocked";
  return allDeliveryChecksPassed ? "pass" : "fail";
}
