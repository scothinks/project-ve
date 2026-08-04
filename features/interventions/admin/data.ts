import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminLmsInterventionType = "upcoming_due" | "overdue" | "inactive";
export type AdminLmsInterventionStatus = "open" | "acknowledged" | "resolved" | "dismissed";
export type AdminLmsInterventionSeverity = "info" | "warning" | "critical";

export type AdminLmsIntervention = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  programmeId: string;
  programmeTitle: string | null;
  cohortId: string | null;
  cohortTitle: string | null;
  userId: string;
  displayName: string | null;
  enrolmentId: string | null;
  type: AdminLmsInterventionType;
  status: AdminLmsInterventionStatus;
  severity: AdminLmsInterventionSeverity;
  reason: string;
  dueAt: string | null;
  lastActivityAt: string | null;
  triggeredAt: string;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
};

export type AdminLmsInterventionFilters = {
  organizationId?: string | null;
  programmeId?: string | null;
  status?: AdminLmsInterventionStatus | null;
  limit?: number;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function interventionType(value: unknown): AdminLmsInterventionType {
  return value === "upcoming_due" || value === "overdue" || value === "inactive"
    ? value
    : "inactive";
}

function interventionStatus(value: unknown): AdminLmsInterventionStatus {
  return value === "acknowledged" || value === "resolved" || value === "dismissed" || value === "open"
    ? value
    : "open";
}

function interventionSeverity(value: unknown): AdminLmsInterventionSeverity {
  return value === "critical" || value === "warning" || value === "info"
    ? value
    : "warning";
}

export function parseAdminLmsInterventions(value: unknown): AdminLmsIntervention[] {
  const root = recordValue(value);
  const items = Array.isArray(root.items) ? root.items : [];

  return items.map((item) => {
    const row = recordValue(item);

    return {
      cohortId: nullableString(row.cohortId),
      cohortTitle: nullableString(row.cohortTitle),
      displayName: nullableString(row.displayName),
      dueAt: nullableString(row.dueAt),
      enrolmentId: nullableString(row.enrolmentId),
      id: stringValue(row.id),
      lastActivityAt: nullableString(row.lastActivityAt),
      metadata: recordValue(row.metadata),
      organizationId: stringValue(row.organizationId),
      organizationName: nullableString(row.organizationName),
      programmeId: stringValue(row.programmeId),
      programmeTitle: nullableString(row.programmeTitle),
      reason: stringValue(row.reason),
      resolvedAt: nullableString(row.resolvedAt),
      severity: interventionSeverity(row.severity),
      status: interventionStatus(row.status),
      triggeredAt: stringValue(row.triggeredAt),
      type: interventionType(row.type),
      userId: stringValue(row.userId),
    };
  }).filter((item) => item.id && item.userId);
}

export async function getAdminLmsInterventions(
  supabase: SupabaseClient<Database>,
  filters: AdminLmsInterventionFilters = {},
): Promise<AdminLmsIntervention[]> {
  const { data, error } = await supabase.rpc("get_lms_intervention_queue", {
    p_limit: filters.limit ?? 100,
    p_organization_id: filters.organizationId || undefined,
    p_programme_id: filters.programmeId || undefined,
    p_status: filters.status || "open",
  });

  if (error) {
    throw error;
  }

  return parseAdminLmsInterventions(data);
}
