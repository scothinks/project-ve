import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { AssessmentIndex } from "@/components/admin/AssessmentWorkspace";
import { getAdminAssessmentVersions, requireAdminWorkspaceRole } from "@/lib/admin";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAssessmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
    "content_editor",
  ]);
  const [{ assessmentCapability, assessments, isPlatformCatalog, selectedOrganizationId }, resolvedSearchParams] = await Promise.all([
    getAdminAssessmentVersions(supabase),
    searchParams,
  ]);
  const notice = firstSearchValue(resolvedSearchParams?.notice);

  return (
    <>
      <AdminPageHeader
        eyebrow="Assessments"
        title="Assessment workspace"
        subtitle="Select Project Ve templates, adapt paid-plan organisation versions, and review programme assessment usage."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <AssessmentIndex
        assessmentCapability={assessmentCapability}
        assessments={assessments}
        isPlatformCatalog={isPlatformCatalog}
        selectedOrganizationId={selectedOrganizationId}
      />
    </>
  );
}
