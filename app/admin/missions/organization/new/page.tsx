import { redirect } from "next/navigation";
import { OrganizationMissionWorkflowForm } from "@/components/admin/OrganizationMissionWorkflowForm";
import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import {
  getAdminCourses,
  getAdminLessons,
  getAdminMissions,
  getAdminMissionTypes,
  requireAdminWorkspaceRole,
} from "@/lib/admin";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";

const ORGANIZATION_MISSION_MANAGER_ROLES = [
  "platform_admin",
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
];

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewOrganizationMissionPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[]; sourceMissionId?: string | string[] }>;
}) {
  const context = await requireAdminWorkspaceRole(ORGANIZATION_MISSION_MANAGER_ROLES);

  if (context.workspace.type !== "organization") {
    redirect("/admin/missions");
  }

  const [courses, lessons, missions, missionTypes, entitlements] = await Promise.all([
    getAdminCourses(context.supabase),
    getAdminLessons(context.supabase),
    getAdminMissions(context.supabase),
    getAdminMissionTypes(context.supabase),
    resolveOrganizationEntitlements(context.supabase, context.workspace.id),
  ]);
  const platformMissions = missions.filter((mission) => mission.catalog_scope === "platform");
  const organizationName =
    context.workspace.organizationIdentity?.shortName
    || context.workspace.organizationIdentity?.name
    || "Organisation";
  const resolvedSearchParams = await searchParams;
  const notice = firstSearchValue(resolvedSearchParams?.notice);
  const initialSourceMissionId = firstSearchValue(resolvedSearchParams?.sourceMissionId) ?? "";

  return (
    <>
      <AdminPageHeader
        backHref="/admin/missions"
        backLabel="Missions"
        eyebrow="Organisation missions"
        title={`${organizationName} mission workflow`}
        subtitle="Create private missions from entitled Project Ve mission types or adapt a platform mission while preserving source provenance."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <OrganizationMissionWorkflowForm
        allowedMissionTypes={entitlements.entitlements.allowedMissionTypes}
        courses={courses}
        initialSourceMissionId={initialSourceMissionId}
        lessons={lessons}
        missionTypes={missionTypes}
        platformMissions={platformMissions}
      />
    </>
  );
}
