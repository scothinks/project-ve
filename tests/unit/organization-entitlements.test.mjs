import assert from "node:assert/strict";
import test from "node:test";
import {
  organizationEntitlementAllowsInteger,
  parseOrganizationEntitlements,
  STARTER_ORGANIZATION_ENTITLEMENTS,
} from "../../features/organizations/entitlements.ts";

test("organization entitlement parser maps database keys into the typed contract", () => {
  const entitlements = parseOrganizationEntitlements({
    max_courses: 3,
    max_total_lessons: 15,
    allowed_lesson_block_types: ["text", "image", "video"],
    max_storage_bytes: 123456,
    ai_authoring_enabled: true,
    max_active_missions: 8,
    allowed_mission_types: ["course_completed"],
    allowed_mission_reward_modes: ["organization_xp"],
    max_xp_accounts: 2,
    max_active_rewards: 4,
    allowed_reward_fulfillment_types: ["manual_claim_form"],
    max_open_reward_claims: 30,
    max_fulfilled_reward_claims_per_month: 40,
    assessment_capability: "template_adaptation",
    reporting_level: "advanced",
    ai_monthly_allocation: 1000,
    ai_temporary_allocation: 250,
    ai_top_up_allocation: 50,
    ai_warning_threshold: 900,
    ai_hard_limit: 1300,
    ai_user_rate_limit_per_day: 20,
    ai_organization_concurrency_limit: 3,
    allowed_ai_operation_types: ["course_outline"],
    allowed_ai_roles: ["organisation_admin"],
  });

  assert.equal(entitlements.maxCourses, 3);
  assert.equal(entitlements.maxTotalLessons, 15);
  assert.deepEqual(entitlements.allowedLessonBlockTypes, ["text", "image", "video"]);
  assert.equal(entitlements.maxStorageBytes, 123456);
  assert.equal(entitlements.aiAuthoringEnabled, true);
  assert.equal(entitlements.assessmentCapability, "template_adaptation");
  assert.equal(entitlements.reportingLevel, "advanced");
  assert.equal(entitlements.aiMonthlyAllocation, 1000);
  assert.equal(entitlements.aiTemporaryAllocation, 250);
  assert.equal(entitlements.aiTopUpAllocation, 50);
  assert.equal(entitlements.aiHardLimit, 1300);
  assert.deepEqual(entitlements.allowedAiOperationTypes, ["course_outline"]);
  assert.deepEqual(entitlements.allowedAiRoles, ["organisation_admin"]);
});

test("organization entitlement parser falls back to Starter values for invalid shapes", () => {
  const entitlements = parseOrganizationEntitlements({
    max_courses: -1,
    max_total_lessons: "many",
    allowed_lesson_block_types: "text",
    ai_authoring_enabled: "yes",
    assessment_capability: "unsupported",
    reporting_level: "unsupported",
  });

  assert.equal(entitlements.maxCourses, STARTER_ORGANIZATION_ENTITLEMENTS.maxCourses);
  assert.equal(entitlements.maxTotalLessons, STARTER_ORGANIZATION_ENTITLEMENTS.maxTotalLessons);
  assert.deepEqual(entitlements.allowedLessonBlockTypes, STARTER_ORGANIZATION_ENTITLEMENTS.allowedLessonBlockTypes);
  assert.equal(entitlements.aiAuthoringEnabled, STARTER_ORGANIZATION_ENTITLEMENTS.aiAuthoringEnabled);
  assert.equal(entitlements.assessmentCapability, STARTER_ORGANIZATION_ENTITLEMENTS.assessmentCapability);
  assert.equal(entitlements.reportingLevel, STARTER_ORGANIZATION_ENTITLEMENTS.reportingLevel);
});

test("integer entitlement checks compare requested usage against resolved limits", () => {
  const entitlements = parseOrganizationEntitlements({
    ...STARTER_ORGANIZATION_ENTITLEMENTS,
    max_courses: 2,
  });

  assert.equal(organizationEntitlementAllowsInteger(entitlements, "maxCourses", 2), true);
  assert.equal(organizationEntitlementAllowsInteger(entitlements, "maxCourses", 3), false);
  assert.equal(organizationEntitlementAllowsInteger(entitlements, "maxCourses", -1), false);
});
