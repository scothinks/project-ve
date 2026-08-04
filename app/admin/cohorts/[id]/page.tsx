import { notFound } from "next/navigation";
import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CohortEditorForm } from "@/components/admin/CohortEditorForm";
import {
  getAdminCohort,
  getAdminCourses,
  getAdminOrganizations,
  getAdminProgrammes,
  getAdminUsers,
  requireAdmin,
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
  const { supabase } = await requireAdmin();
  const [cohort, courses, organizations, programmes, users] = await Promise.all([
    getAdminCohort(supabase, id),
    getAdminCourses(supabase),
    getAdminOrganizations(supabase),
    getAdminProgrammes(supabase),
    getAdminUsers(supabase),
  ]);
  const notice = firstSearchValue((await searchParams)?.notice);

  if (!cohort) {
    notFound();
  }

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
        users={users}
      />
    </>
  );
}
