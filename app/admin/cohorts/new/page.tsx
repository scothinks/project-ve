import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CohortEditorForm } from "@/components/admin/CohortEditorForm";
import {
  getAdminCourses,
  getAdminOrganizationLearners,
  getAdminOrganizations,
  getAdminOrganizationUnits,
  getAdminProgrammes,
  requireAdminWorkspaceRole,
} from "@/lib/admin";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewCohortPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
    "instructor",
  ]);
  const [courses, organizations, programmes, units] = await Promise.all([
    getAdminCourses(supabase),
    getAdminOrganizations(supabase),
    getAdminProgrammes(supabase),
    getAdminOrganizationUnits(supabase),
  ]);
  const users = await getAdminOrganizationLearners(supabase, organizations[0]?.id);
  const notice = firstSearchValue((await searchParams)?.notice);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/cohorts"
        backLabel="Cohorts"
        eyebrow="Cohorts"
        title="Add cohort"
        subtitle="Create the organisation audience group and seed the active learner roster."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <CohortEditorForm
        courses={courses}
        organizations={organizations}
        programmes={programmes}
        units={units}
        users={users}
      />
    </>
  );
}
