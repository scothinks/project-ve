import { CreateCourseForm } from "@/components/admin/CreateCourseForm";
import { getAdminCourseCategories, getAdminCourses, requireAdmin } from "@/lib/admin";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";

export default async function NewCoursePage() {
  const { supabase, workspace } = await requireAdmin();
  const [categories, courses] = await Promise.all([
    getAdminCourseCategories(supabase),
    getAdminCourses(supabase),
  ]);
  // The platform-catalog pseudo-workspace has no backing organisation row to
  // resolve entitlements for — Project VE's own catalogue is unrestricted.
  const organizationEntitlements = workspace.type === "organization" && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID
    ? (await resolveOrganizationEntitlements(supabase, workspace.id)).entitlements
    : null;
  const aiGenerationAvailable = organizationEntitlements?.aiAuthoringEnabled ?? true;
  const nextSortOrder =
    courses.reduce((highest, course) => Math.max(highest, course.sort_order), 0) + 1;

  return (
    <CreateCourseForm
      aiGenerationAvailable={aiGenerationAvailable}
      categories={categories}
      mediaLibraryAssets={[]}
      nextSortOrder={nextSortOrder}
    />
  );
}
