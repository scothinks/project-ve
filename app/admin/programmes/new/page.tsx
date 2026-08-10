import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { ProgrammeEditorForm } from "@/components/admin/ProgrammeEditorForm";
import {
  getAdminAssessmentVersionOptions,
  getAdminCourses,
  getAdminMissions,
  getAdminOrganizations,
  getAdminRewards,
  requireAdminWorkspaceRole,
} from "@/lib/admin";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewProgrammePage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase, workspace } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
  ]);
  const [assessmentVersions, courses, missions, organizations, rewards] = await Promise.all([
    getAdminAssessmentVersionOptions(supabase),
    getAdminCourses(supabase, workspace.id),
    getAdminMissions(supabase, workspace.id),
    getAdminOrganizations(supabase),
    getAdminRewards(supabase, { distributionMode: "direct" }, workspace.id),
  ]);
  const notice = firstSearchValue((await searchParams)?.notice);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/programmes"
        backLabel="Programmes"
        eyebrow="Programmes"
        title="Add programme"
        subtitle="Create the organisation container, then attach reusable courses, missions, rewards and assessments."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <ProgrammeEditorForm
        assessmentVersions={assessmentVersions}
        courses={courses}
        missions={missions}
        organizations={organizations}
        rewards={rewards}
      />
    </>
  );
}
