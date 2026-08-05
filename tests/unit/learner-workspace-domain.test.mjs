import assert from "node:assert/strict";
import test from "node:test";
import { filterTranscriptForOrganizationWorkspace } from "../../features/organizations/application/learner-workspace-domain.ts";

function transcriptItem(overrides) {
  return {
    category: null,
    completedAt: null,
    evaluatedAt: null,
    id: "item",
    kind: "course",
    metadata: {},
    missingRequirements: {},
    organizationId: null,
    progressPercent: 0,
    status: "in_progress",
    title: "Item",
    ...overrides,
  };
}

test("organization transcript filter keeps only active workspace records", () => {
  const transcript = {
    generatedAt: "2026-08-05T12:00:00.000Z",
    courses: [
      transcriptItem({ id: "course-org-a", organizationId: "org-a", title: "Org A course" }),
      transcriptItem({ id: "course-programme-a", organizationId: null, title: "Programme platform course" }),
      transcriptItem({ id: "course-org-b", organizationId: "org-b", title: "Org B course" }),
      transcriptItem({ id: "course-public", organizationId: null, title: "Public course" }),
    ],
    programmes: [
      transcriptItem({ id: "programme-a", kind: "programme", organizationId: "org-a", title: "Org A programme" }),
      transcriptItem({ id: "programme-a-unassigned", kind: "programme", organizationId: "org-a", title: "Unassigned Org A programme" }),
      transcriptItem({ id: "programme-b", kind: "programme", organizationId: "org-b", title: "Org B programme" }),
    ],
  };

  const filtered = filterTranscriptForOrganizationWorkspace(transcript, {
    courseIds: ["course-programme-a"],
    organizationId: "org-a",
    programmeIds: ["programme-a"],
  });

  assert.deepEqual(filtered.courses.map((item) => item.id), ["course-org-a", "course-programme-a"]);
  assert.deepEqual(filtered.programmes.map((item) => item.id), ["programme-a"]);
});
