import { redirect } from "next/navigation";
import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceTabs } from "@/components/admin/AdminWorkspaceTabs";
import { CatalogPeopleInviteDrawer } from "@/components/admin/CatalogPeopleInviteDrawer";
import { CatalogPeopleInvitationsTable } from "@/components/admin/CatalogPeopleInvitationsTable";
import { CatalogPeopleMembersTable } from "@/components/admin/CatalogPeopleMembersTable";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { getAdminCatalogPeopleWorkspace, requireAdminWorkspaceRole } from "@/lib/admin";

const CATALOG_PEOPLE_ROLES = ["organisation_owner", "organisation_admin"];

const CATALOG_PEOPLE_TABS = [
  { label: "Members", value: "members" },
  { label: "Invitations", value: "invitations" },
];

function normalizeTab(value: string | string[] | undefined) {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "invitations" ? tab : "members";
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCatalogPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, workspace } = await requireAdminWorkspaceRole(CATALOG_PEOPLE_ROLES);

  if (workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID) {
    redirect("/admin");
  }

  const params = (await searchParams) ?? {};
  const activeTab = normalizeTab(params.tab);
  const notice = firstValue(params.notice);
  const { members, invitations } = await getAdminCatalogPeopleWorkspace(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-black tracking-[-0.02em] text-[var(--admin-ink-charcoal)]">
            Catalog Staff
          </h1>
          <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
            Manage who can help run Project VE&rsquo;s own platform catalogue — courses, missions, rewards and
            recommendations that belong to no organisation.
          </p>
        </div>
        <CatalogPeopleInviteDrawer defaultOpen={firstValue(params.invite) === "1"} />
      </div>

      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <AdminWorkspaceTabs activeTab={activeTab} tabs={CATALOG_PEOPLE_TABS} />

      {activeTab === "members" ? <CatalogPeopleMembersTable members={members} /> : null}
      {activeTab === "invitations" ? <CatalogPeopleInvitationsTable invitations={invitations} /> : null}
    </div>
  );
}
