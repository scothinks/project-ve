import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

export type AdminOrganizationActivityDetail = {
  label: string;
  value: string;
};

export type AdminOrganizationActivityChanges = {
  before: JsonRecord;
  after: JsonRecord;
};

export type AdminOrganizationActivityEvent = {
  id: string;
  createdAt: string;
  organizationId: string | null;
  organizationName: string | null;
  actorUserId: string | null;
  actorName: string;
  eventType: string;
  actionLabel: string;
  entityType: string;
  entityId: string;
  objectLabel: string;
  objectHref: string | null;
  summary: string;
  details: AdminOrganizationActivityDetail[];
  changes: AdminOrganizationActivityChanges;
  hasChanges: boolean;
};

export type AdminOrganizationActivityActor = {
  id: string;
  name: string;
};

export type AdminOrganizationActivityFilterOptions = {
  actors: AdminOrganizationActivityActor[];
  entityTypes: string[];
  eventTypes: string[];
};

export type AdminOrganizationActivity = {
  events: AdminOrganizationActivityEvent[];
  filters: AdminOrganizationActivityFilterOptions;
};

export type AdminOrganizationActivityFilters = {
  actorUserId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  entityType?: string | null;
  eventType?: string | null;
  organizationId?: string | null;
  limit?: number;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function parseDetails(value: unknown): AdminOrganizationActivityDetail[] {
  return Array.isArray(value)
    ? value.map((item) => {
      const record = asRecord(item);
      return {
        label: asString(record.label, "Detail"),
        value: asString(record.value, ""),
      };
    }).filter((detail) => detail.value !== "")
    : [];
}

function parseChanges(value: unknown): AdminOrganizationActivityChanges {
  const record = asRecord(value);
  return {
    before: asRecord(record.before),
    after: asRecord(record.after),
  };
}

function parseActors(value: unknown): AdminOrganizationActivityActor[] {
  return Array.isArray(value)
    ? value.map((item) => {
      const record = asRecord(item);
      return {
        id: asString(record.id),
        name: asString(record.name, "Unknown user"),
      };
    }).filter((actor) => actor.id.length > 0)
    : [];
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0).sort()
    : [];
}

function parseEvent(value: unknown): AdminOrganizationActivityEvent {
  const record = asRecord(value);

  return {
    id: asString(record.id),
    createdAt: asString(record.createdAt),
    organizationId: asNullableString(record.organizationId),
    organizationName: asNullableString(record.organizationName),
    actorUserId: asNullableString(record.actorUserId),
    actorName: asString(record.actorName, "System"),
    eventType: asString(record.eventType),
    actionLabel: asString(record.actionLabel),
    entityType: asString(record.entityType),
    entityId: asString(record.entityId),
    objectLabel: asString(record.objectLabel, "Object"),
    objectHref: asNullableString(record.objectHref),
    summary: asString(record.summary),
    details: parseDetails(record.details),
    changes: parseChanges(record.changes),
    hasChanges: asBoolean(record.hasChanges),
  };
}

export async function getAdminOrganizationActivity(
  supabase: SupabaseClient,
  filters: AdminOrganizationActivityFilters = {},
): Promise<AdminOrganizationActivity> {
  const { data, error } = await supabase.rpc("admin_get_organization_activity", {
    p_actor_user_id: filters.actorUserId || null,
    p_date_from: filters.dateFrom || null,
    p_date_to: filters.dateTo || null,
    p_entity_type: filters.entityType || null,
    p_event_type: filters.eventType || null,
    p_limit: filters.limit ?? 200,
    p_organization_id: filters.organizationId || null,
  });

  if (error) {
    throw error;
  }

  const payload = asRecord(data);
  const filterPayload = asRecord(payload.filters);

  return {
    events: Array.isArray(payload.events) ? payload.events.map(parseEvent) : [],
    filters: {
      actors: parseActors(filterPayload.actors),
      entityTypes: parseStringList(filterPayload.entityTypes),
      eventTypes: parseStringList(filterPayload.eventTypes),
    },
  };
}
