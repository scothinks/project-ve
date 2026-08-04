import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CohortEditorForm } from "@/components/admin/CohortEditorForm";
import {
  getAdminCourses,
  getAdminOrganizations,
  getAdminProgrammes,
  getAdminUsers,
  requireAdmin,
} from "@/lib/admin";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewCohortPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase } = await requireAdmin();
  const [courses, organizations, programmes, users] = await Promise.all([
    getAdminCourses(supabase),
    getAdminOrganizations(supabase),
    getAdminProgrammes(supabase),
    getAdminUsers(supabase),
  ]);
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
        users={users}
      />
    </>
  );
}
