import type { Database, Json } from "@/types/database";

export type OrganizationCourseDeliveryOption = {
  courseId: string;
  label: string;
  organizationId: string;
  programmeId: string | null;
  scope: "organization" | "programme";
};

export type OrganizationLearningDeliveryContext = OrganizationCourseDeliveryOption;

export type LearnerWorkspaceAccessSource =
  | "course_enrolment"
  | "membership"
  | "owner"
  | "programme_enrolment";

export type PublicLearnerWorkspaceContext = {
  accessSource: "public";
  branding: {
    accentToken: "green";
    logoUrl: null;
    name: "Project Ve";
    shortName: "Project Ve";
  };
  membershipRoles: [];
  organizationId: null;
  organizationSlug: null;
  programmeIds: [];
  type: "public";
  xpAccount: {
    balance: number;
    label: "Project Ve XP";
    type: "project_ve";
  };
};

export type OrganizationLearnerWorkspaceContext = {
  accessSource: LearnerWorkspaceAccessSource;
  branding: {
    accentToken: Database["public"]["Enums"]["organization_accent_token"];
    logoUrl: string | null;
    name: string;
    shortName: string | null;
  };
  courseIds: string[];
  courseDeliveryOptions: Record<string, OrganizationCourseDeliveryOption[]>;
  membershipRoles: Database["public"]["Enums"]["organization_role_key"][];
  organizationId: string;
  organizationSlug: string;
  programmeIds: string[];
  type: "organization";
  xpAccount: {
    balance: number;
    id: string;
    label: string;
    type: "organization";
  };
};

export type LearnerWorkspaceContext =
  | OrganizationLearnerWorkspaceContext
  | PublicLearnerWorkspaceContext;

const ACCESS_SOURCES = new Set<LearnerWorkspaceAccessSource>([
  "course_enrolment",
  "membership",
  "owner",
  "programme_enrolment",
]);

const ACCENT_TOKENS = new Set<Database["public"]["Enums"]["organization_accent_token"]>([
  "green",
  "mission",
  "slate",
  "store",
  "violet",
]);

const ORGANIZATION_ROLES = new Set<Database["public"]["Enums"]["organization_role_key"]>([
  "content_editor",
  "instructor",
  "learner",
  "organisation_admin",
  "organisation_owner",
  "programme_manager",
  "report_viewer",
  "reviewer",
]);

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: Json | undefined, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Organization workspace context has an invalid ${field}.`);
  }
  return value;
}

function requireString(value: Json | undefined, field: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Organization workspace context has an invalid ${field}.`);
  }
  return value;
}

function requireNullableString(value: Json | undefined, field: string) {
  if (value !== null && typeof value !== "string") {
    throw new Error(`Organization workspace context has an invalid ${field}.`);
  }
  return value;
}

function requireStringArray(value: Json | undefined, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`Organization workspace context has an invalid ${field}.`);
  }
  return Array.from(new Set(value as string[]));
}

export function parseOrganizationLearnerWorkspaceContext(
  value: Json | null,
): OrganizationLearnerWorkspaceContext | null {
  if (value === null) return null;

  const context = requireRecord(value, "payload");
  const organizationId = requireString(context.organizationId, "organizationId");
  const organizationSlug = requireString(context.organizationSlug, "organizationSlug");
  if (context.type !== "organization") {
    throw new Error("Organization workspace context has an invalid type.");
  }

  const accessSource = requireString(context.accessSource, "accessSource");
  if (!ACCESS_SOURCES.has(accessSource as LearnerWorkspaceAccessSource)) {
    throw new Error("Organization workspace context has an invalid accessSource.");
  }

  const branding = requireRecord(context.branding, "branding");
  const accentToken = requireString(branding.accentToken, "branding.accentToken");
  if (!ACCENT_TOKENS.has(accentToken as Database["public"]["Enums"]["organization_accent_token"])) {
    throw new Error("Organization workspace context has an invalid branding.accentToken.");
  }

  const membershipRoles = requireStringArray(context.membershipRoles, "membershipRoles");
  if (membershipRoles.some((role) => !ORGANIZATION_ROLES.has(
    role as Database["public"]["Enums"]["organization_role_key"],
  ))) {
    throw new Error("Organization workspace context has an invalid membership role.");
  }

  const courseIds = requireStringArray(context.courseIds, "courseIds");
  const courseIdSet = new Set(courseIds);
  const programmeIds = requireStringArray(context.programmeIds, "programmeIds");
  const programmeIdSet = new Set(programmeIds);
  if (!Array.isArray(context.courseDeliveries)) {
    throw new Error("Organization workspace context has invalid courseDeliveries.");
  }

  const courseDeliveryOptions = Object.fromEntries(
    courseIds.map((courseId) => [courseId, [] as OrganizationCourseDeliveryOption[]]),
  );
  for (const rawDelivery of context.courseDeliveries) {
    const delivery = requireRecord(rawDelivery, "course delivery");
    const courseId = requireString(delivery.courseId, "course delivery courseId");
    const deliveryOrganizationId = requireString(
      delivery.organizationId,
      "course delivery organizationId",
    );
    const label = requireString(delivery.label, "course delivery label");
    const programmeId = requireNullableString(
      delivery.programmeId,
      "course delivery programmeId",
    );
    const scope = delivery.scope;

    if (
      !courseIdSet.has(courseId)
      || deliveryOrganizationId !== organizationId
      || (scope !== "organization" && scope !== "programme")
      || (scope === "organization" && programmeId !== null)
      || (scope === "programme" && (programmeId === null || !programmeIdSet.has(programmeId)))
    ) {
      throw new Error("Organization workspace context has an inconsistent course delivery.");
    }

    courseDeliveryOptions[courseId].push({
      courseId,
      label,
      organizationId: deliveryOrganizationId,
      programmeId,
      scope,
    });
  }

  const xpAccount = requireRecord(context.xpAccount, "xpAccount");
  if (
    xpAccount.type !== "organization"
    || typeof xpAccount.balance !== "number"
    || !Number.isFinite(xpAccount.balance)
  ) {
    throw new Error("Organization workspace context has an invalid xpAccount.");
  }

  return {
    accessSource: accessSource as LearnerWorkspaceAccessSource,
    branding: {
      accentToken: accentToken as Database["public"]["Enums"]["organization_accent_token"],
      logoUrl: requireNullableString(branding.logoUrl, "branding.logoUrl"),
      name: requireString(branding.name, "branding.name"),
      shortName: requireNullableString(branding.shortName, "branding.shortName"),
    },
    courseIds,
    courseDeliveryOptions,
    membershipRoles: membershipRoles as Database["public"]["Enums"]["organization_role_key"][],
    organizationId,
    organizationSlug,
    programmeIds,
    type: "organization",
    xpAccount: {
      balance: xpAccount.balance,
      id: requireString(xpAccount.id, "xpAccount.id"),
      label: requireString(xpAccount.label, "xpAccount.label"),
      type: "organization",
    },
  };
}
