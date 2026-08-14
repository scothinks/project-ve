import { notFound } from "next/navigation";
import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CohortEditorForm } from "@/components/admin/CohortEditorForm";
import {
  getAdminCohort,
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

export default async function CohortWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
    "instructor",
  ]);
  const [cohort, courses, organizations, programmes, units] = await Promise.all([
    getAdminCohort(supabase, id),
    getAdminCourses(supabase),
    getAdminOrganizations(supabase),
    getAdminProgrammes(supabase),
    getAdminOrganizationUnits(supabase),
  ]);
  const notice = firstSearchValue((await searchParams)?.notice);

  if (!cohort) {
    notFound();
  }

  const users = await getAdminOrganizationLearners(supabase, cohort.organization_id);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/cohorts"
        backLabel="Cohorts"
        eyebrow={cohort.organization?.name ?? "Cohort"}
        title={cohort.title}
        subtitle="Manage roster membership, course assignments, programme assignments and enrolment state for this cohort."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <CohortEditorForm
        cohort={cohort}
        courses={courses}
        organizations={organizations}
        programmes={programmes}
        units={units}
        users={users}
      />
    </>
  );
}
