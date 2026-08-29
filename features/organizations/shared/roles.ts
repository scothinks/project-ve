import type { Database } from "@/types/database";

type OrganizationRoleKey = Database["public"]["Enums"]["organization_role_key"];

export const ORGANIZATION_ROLES: OrganizationRoleKey[] = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
  "reviewer",
  "instructor",
  "report_viewer",
  "learner",
];

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRoleKey, string> = {
  organisation_owner: "Organisation Owner",
  organisation_admin: "Organisation Admin",
  programme_manager: "Programme Manager",
  content_editor: "Content Editor",
  reviewer: "Reviewer",
  instructor: "Instructor",
  report_viewer: "Report Viewer",
  learner: "Learner",
};

export const ORGANIZATION_ROLE_DESCRIPTIONS: Record<OrganizationRoleKey, string> = {
  organisation_owner: "Full administrative control over the entire organisation and billing.",
  organisation_admin: "Manage users, units, and organisation-wide settings.",
  programme_manager: "Oversee specific programmes and associated cohorts.",
  content_editor: "Create, edit, and manage learning content within assigned scope.",
  reviewer: "Review and approve content submissions before publishing.",
  instructor: "Deliver courses and interact with learners.",
  report_viewer: "View reporting and supervision dashboards only.",
  learner: "Standard learner access to assigned courses and missions.",
};
