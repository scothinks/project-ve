import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { CatalogOverviewView } from "@/components/admin/CatalogOverviewView";
import { OrganizationOverviewView } from "@/components/admin/OrganizationOverviewView";
import { PlatformOverviewView } from "@/components/admin/PlatformOverviewView";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import {
  getAdminCatalogOverview,
  getAdminOrganizationOverview,
  getAdminPlatformOverview,
  requireAdmin,
} from "@/lib/admin";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase, workspace } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;

  if (workspace.id === PLATFORM_CATALOG_WORKSPACE_ID) {
    const overview = await getAdminCatalogOverview(supabase);

    return (
      <>
        {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
        <CatalogOverviewView overview={overview} />
      </>
    );
  }

  if (workspace.type === "organization") {
    const overview = await getAdminOrganizationOverview(
      supabase,
      workspace.id,
      workspace.organizationIdentity?.logoUrl ?? null,
      workspace.roles.some((role) =>
        role === "platform_admin" || role === "organisation_owner" || role === "organisation_admin"
      ),
    );

    return (
      <>
        {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
        <OrganizationOverviewView
          organizationName={workspace.organizationIdentity?.name ?? "your organisation"}
          overview={overview}
        />
      </>
    );
  }

  const overview = await getAdminPlatformOverview(supabase);

  return (
    <>
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <PlatformOverviewView overview={overview} />
    </>
  );
}
