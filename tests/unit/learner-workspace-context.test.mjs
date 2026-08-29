import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseOrganizationLearnerWorkspaceContext,
} from "../../features/organizations/application/learner-workspace-context.ts";

const contextPayload = {
  accessSource: "programme_enrolment",
  branding: {
    accentToken: "violet",
    logoUrl: "https://assets.example.test/logo.png",
    name: "Example Organisation",
    shortName: "Example",
  },
  courseDeliveries: [
    {
      courseId: "course-1",
      label: "Example Programme",
      organizationId: "organization-1",
      programmeId: "programme-1",
      scope: "programme",
    },
  ],
  courseIds: ["course-1"],
  membershipRoles: [],
  organizationId: "organization-1",
  organizationSlug: "example-organization",
  programmeIds: ["programme-1"],
  type: "organization",
  xpAccount: {
    balance: 42,
    id: "xp-account-1",
    label: "PTS",
    type: "organization",
  },
};

test("organization workspace context parser maps the focused RPC delivery projection", () => {
  const context = parseOrganizationLearnerWorkspaceContext(contextPayload);

  assert.equal(context?.accessSource, "programme_enrolment");
  assert.deepEqual(context?.courseIds, ["course-1"]);
  assert.deepEqual(context?.courseDeliveryOptions, {
    "course-1": [
      {
        courseId: "course-1",
        label: "Example Programme",
        organizationId: "organization-1",
        programmeId: "programme-1",
        scope: "programme",
      },
    ],
  });
  assert.equal(context?.xpAccount.balance, 42);
  assert.equal("missionIds" in contextPayload, false);
});

test("organization workspace context parser rejects cross-workspace delivery identifiers", () => {
  assert.throws(
    () => parseOrganizationLearnerWorkspaceContext({
      ...contextPayload,
      courseDeliveries: [
        {
          ...contextPayload.courseDeliveries[0],
          organizationId: "another-organization",
        },
      ],
    }),
    /inconsistent course delivery/,
  );
});

test("organization route context uses one focused database operation", () => {
  const source = readFileSync(
    new URL("../../features/organizations/application/learner-workspace.ts", import.meta.url),
    "utf8",
  );
  const resolver = source.slice(
    source.indexOf("export async function resolveOrganizationLearnerWorkspace"),
    source.indexOf("export async function getOrganizationWorkspaceCourseCards"),
  );

  assert.match(resolver, /\.rpc\("get_organization_learner_workspace_context"/);
  assert.equal((resolver.match(/\.rpc\(/g) ?? []).length, 1);
  assert.equal((resolver.match(/\.from\(/g) ?? []).length, 0);
  assert.doesNotMatch(resolver, /mission|assessment|reward/i);
});
