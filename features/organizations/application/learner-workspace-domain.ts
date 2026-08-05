import type { LearnerTranscript } from "@/features/completions/learner/data";

export type TranscriptWorkspaceFilter = {
  courseIds: string[];
  organizationId: string;
  programmeIds: string[];
};

export function filterTranscriptForOrganizationWorkspace(
  transcript: LearnerTranscript,
  workspace: TranscriptWorkspaceFilter,
): LearnerTranscript {
  const programmeIds = new Set(workspace.programmeIds);
  const courseIds = new Set(workspace.courseIds);

  return {
    ...transcript,
    courses: transcript.courses.filter(
      (item) => item.organizationId === workspace.organizationId || courseIds.has(item.id),
    ),
    programmes: transcript.programmes.filter(
      (item) => item.organizationId === workspace.organizationId && programmeIds.has(item.id),
    ),
  };
}
