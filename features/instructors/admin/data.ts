import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminInstructorWorkspaceUnit = {
  id: string;
  name: string;
  unitType: string;
  parentUnitId: string | null;
};

export type AdminInstructorWorkspaceCohort = {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  activeMembers: number;
  assignedLearners: number;
  units: Array<{ id: string; name: string; unitType: string }>;
};

export type AdminInstructorWorkspaceLearner = {
  userId: string;
  displayName: string | null;
  cohorts: Array<{ id: string; title: string }>;
  assignedCount: number;
  completedCount: number;
  overdueCount: number;
  averageProgress: number;
  lastActivityAt: string | null;
};

export type AdminInstructorWorkspaceInactiveLearner = {
  userId: string;
  displayName: string | null;
  averageProgress: number;
  lastActivityAt: string | null;
};

export type AdminInstructorWorkspaceOverdueLearner = {
  userId: string;
  displayName: string | null;
  programmeId: string | null;
  courseId: string | null;
  cohortId: string | null;
  dueAt: string | null;
};

export type AdminInstructorWorkspaceMissionEvidence = {
  userId: string;
  displayName: string | null;
  missionId: string;
  missionTitle: string | null;
  awardScope: string;
  organizationId: string;
  programmeId: string | null;
  programmeMissionId: string | null;
  proofType: string;
  value: string;
  status: "submitted" | "approved" | "rejected";
  createdAt: string;
};

export type AdminInstructorWorkspaceIntervention = {
  id: string;
  userId: string;
  displayName: string | null;
  programmeId: string;
  programmeTitle: string | null;
  cohortId: string | null;
  type: "upcoming_due" | "overdue" | "inactive";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  severity: "info" | "warning" | "critical";
  reason: string;
  dueAt: string | null;
  lastActivityAt: string | null;
  triggeredAt: string;
};

export type AdminInstructorWorkspaceReminderTarget = {
  userId: string;
  displayName: string | null;
  reason: string;
};

export type AdminInstructorWorkspace = {
  organizationId: string;
  unitId: string | null;
  canAct: boolean;
  readOnly: boolean;
  units: AdminInstructorWorkspaceUnit[];
  cohorts: AdminInstructorWorkspaceCohort[];
  learners: AdminInstructorWorkspaceLearner[];
  inactiveLearners: AdminInstructorWorkspaceInactiveLearner[];
  overdueLearners: AdminInstructorWorkspaceOverdueLearner[];
  missionEvidence: AdminInstructorWorkspaceMissionEvidence[];
  openInterventions: AdminInstructorWorkspaceIntervention[];
  reminderTargets: AdminInstructorWorkspaceReminderTarget[];
  generatedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseUnit(value: unknown): AdminInstructorWorkspaceUnit {
  const record = asRecord(value);

  return {
    id: asString(record.id) ?? "",
    name: asString(record.name) ?? "Unit",
    parentUnitId: asString(record.parentUnitId),
    unitType: asString(record.unitType) ?? "Unit",
  };
}

function parseCohort(value: unknown): AdminInstructorWorkspaceCohort {
  const record = asRecord(value);

  return {
    activeMembers: asNumber(record.activeMembers),
    assignedLearners: asNumber(record.assignedLearners),
    endsAt: asString(record.endsAt),
    id: asString(record.id) ?? "",
    startsAt: asString(record.startsAt),
    status: asString(record.status) ?? "draft",
    title: asString(record.title) ?? "Cohort",
    units: asArray<unknown>(record.units).map((unit) => {
      const unitRecord = asRecord(unit);
      return {
        id: asString(unitRecord.id) ?? "",
        name: asString(unitRecord.name) ?? "Unit",
        unitType: asString(unitRecord.unitType) ?? "Unit",
      };
    }),
  };
}

function parseLearner(value: unknown): AdminInstructorWorkspaceLearner {
  const record = asRecord(value);

  return {
    assignedCount: asNumber(record.assignedCount),
    averageProgress: asNumber(record.averageProgress),
    cohorts: asArray<unknown>(record.cohorts).map((cohort) => {
      const cohortRecord = asRecord(cohort);
      return {
        id: asString(cohortRecord.id) ?? "",
        title: asString(cohortRecord.title) ?? "Cohort",
      };
    }),
    completedCount: asNumber(record.completedCount),
    displayName: asString(record.displayName),
    lastActivityAt: asString(record.lastActivityAt),
    overdueCount: asNumber(record.overdueCount),
    userId: asString(record.userId) ?? "",
  };
}

function parseInactiveLearner(value: unknown): AdminInstructorWorkspaceInactiveLearner {
  const record = asRecord(value);

  return {
    averageProgress: asNumber(record.averageProgress),
    displayName: asString(record.displayName),
    lastActivityAt: asString(record.last_activity_at) ?? asString(record.lastActivityAt),
    userId: asString(record.userId) ?? "",
  };
}

function parseOverdueLearner(value: unknown): AdminInstructorWorkspaceOverdueLearner {
  const record = asRecord(value);

  return {
    cohortId: asString(record.cohortId),
    courseId: asString(record.courseId),
    displayName: asString(record.displayName),
    dueAt: asString(record.dueAt),
    programmeId: asString(record.programmeId),
    userId: asString(record.userId) ?? "",
  };
}

function parseEvidence(value: unknown): AdminInstructorWorkspaceMissionEvidence {
  const record = asRecord(value);
  const status = asString(record.status);

  return {
    awardScope: asString(record.awardScope) ?? "",
    createdAt: asString(record.createdAt) ?? "",
    displayName: asString(record.displayName),
    missionId: asString(record.missionId) ?? "",
    missionTitle: asString(record.missionTitle),
    organizationId: asString(record.organizationId) ?? "",
    programmeId: asString(record.programmeId),
    programmeMissionId: asString(record.programmeMissionId),
    proofType: asString(record.proofType) ?? "text",
    status: status === "approved" || status === "rejected" ? status : "submitted",
    userId: asString(record.userId) ?? "",
    value: asString(record.value) ?? "",
  };
}

function parseIntervention(value: unknown): AdminInstructorWorkspaceIntervention {
  const record = asRecord(value);
  const type = asString(record.type);
  const status = asString(record.status);
  const severity = asString(record.severity);

  return {
    cohortId: asString(record.cohortId),
    displayName: asString(record.displayName),
    dueAt: asString(record.dueAt),
    id: asString(record.id) ?? "",
    lastActivityAt: asString(record.lastActivityAt),
    programmeId: asString(record.programmeId) ?? "",
    programmeTitle: asString(record.programmeTitle),
    reason: asString(record.reason) ?? "",
    severity: severity === "critical" || severity === "info" ? severity : "warning",
    status: status === "acknowledged" || status === "resolved" || status === "dismissed" ? status : "open",
    triggeredAt: asString(record.triggeredAt) ?? "",
    type: type === "upcoming_due" || type === "overdue" ? type : "inactive",
    userId: asString(record.userId) ?? "",
  };
}

function parseReminderTarget(value: unknown): AdminInstructorWorkspaceReminderTarget {
  const record = asRecord(value);

  return {
    displayName: asString(record.displayName),
    reason: asString(record.reason) ?? "reminder",
    userId: asString(record.userId) ?? "",
  };
}

export function parseAdminInstructorWorkspace(value: unknown): AdminInstructorWorkspace {
  const record = asRecord(value);

  return {
    canAct: asBoolean(record.canAct),
    cohorts: asArray<unknown>(record.cohorts).map(parseCohort).filter((cohort) => cohort.id),
    generatedAt: asString(record.generatedAt),
    inactiveLearners: asArray<unknown>(record.inactiveLearners).map(parseInactiveLearner).filter((learner) => learner.userId),
    learners: asArray<unknown>(record.learners).map(parseLearner).filter((learner) => learner.userId),
    missionEvidence: asArray<unknown>(record.missionEvidence).map(parseEvidence).filter((proof) => proof.userId && proof.missionId),
    openInterventions: asArray<unknown>(record.openInterventions).map(parseIntervention).filter((intervention) => intervention.id),
    organizationId: asString(record.organizationId) ?? "",
    overdueLearners: asArray<unknown>(record.overdueLearners).map(parseOverdueLearner).filter((learner) => learner.userId),
    readOnly: asBoolean(record.readOnly),
    reminderTargets: asArray<unknown>(record.reminderTargets).map(parseReminderTarget).filter((target) => target.userId),
    unitId: asString(record.unitId),
    units: asArray<unknown>(record.units).map(parseUnit).filter((unit) => unit.id),
  };
}

export async function getAdminInstructorWorkspace(
  supabase: SupabaseClient<Database>,
  filters: {
    organizationId: string;
    unitId?: string | null;
    limit?: number;
  },
): Promise<AdminInstructorWorkspace> {
  const { data, error } = await supabase.rpc("admin_get_instructor_workspace", {
    p_limit: filters.limit ?? 100,
    p_organization_id: filters.organizationId,
    p_unit_id: filters.unitId || undefined,
  });

  if (error) {
    throw error;
  }

  return parseAdminInstructorWorkspace(data);
}
