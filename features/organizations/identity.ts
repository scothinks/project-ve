export const ORGANIZATION_ACCENT_TOKENS = [
  "green",
  "mission",
  "store",
  "violet",
  "slate",
] as const;

export type OrganizationAccentToken = typeof ORGANIZATION_ACCENT_TOKENS[number];

export const ORGANIZATION_ACCENT_LABELS: Record<OrganizationAccentToken, string> = {
  green: "Project VE green",
  mission: "Mission teal",
  store: "Reward amber",
  violet: "Learning violet",
  slate: "Neutral slate",
};

export function normalizeOrganizationAccentToken(value: FormDataEntryValue | null): OrganizationAccentToken {
  const token = String(value ?? "green");
  return ORGANIZATION_ACCENT_TOKENS.includes(token as OrganizationAccentToken)
    ? token as OrganizationAccentToken
    : "green";
}

export function organizationAllowsLearnerEntry(
  organization: {
    lifecycle_status: string;
    status: string;
  },
) {
  return organization.status !== "archived"
    && (organization.lifecycle_status === "trial" || organization.lifecycle_status === "active");
}
