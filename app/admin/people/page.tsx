import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { AdminWorkspaceTabs } from "@/components/admin/AdminWorkspaceTabs";
import { PeopleInviteDrawer } from "@/components/admin/PeopleInviteDrawer";
import { PeopleInvitationsTable } from "@/components/admin/PeopleInvitationsTable";
import { PeopleMembersTable } from "@/components/admin/PeopleMembersTable";
import { PeopleUnitsPanel } from "@/components/admin/PeopleUnitsPanel";
import {
  ORGANIZATION_ROLE_LABELS,
  getAdminPeopleWorkspace,
  requireAdminWorkspaceRole,
} from "@/lib/admin";

const PEOPLE_TABS = [
  { label: "Members", value: "members" },
  { label: "Invitations", value: "invitations" },
  { label: "Units", value: "units" },
];

function normalizeTab(value: string | string[] | undefined) {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "invitations" || tab === "units" ? tab : "members";
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, workspace } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
  ]);
  const params = (await searchParams) ?? {};
  const activeTab = normalizeTab(params.tab);
  const notice = firstValue(params.notice);
  const query = (firstValue(params.q) ?? "").trim().toLowerCase();
  const roleFilter = firstValue(params.role) ?? "";
  const statusFilter = firstValue(params.status) ?? "";
  const shouldOpenInvite = firstValue(params.invite) === "1";
  const organizationId = workspace.id;

  const { members, invitations, units, invitationTargetOptions } = await getAdminPeopleWorkspace(
    supabase,
    organizationId,
  );

  const filteredMembers = members.filter((member) => {
    const matchesQuery = query
      ? (member.profile?.display_name ?? "").toLowerCase().includes(query)
      : true;
    const matchesRole = roleFilter ? member.role === roleFilter : true;
    const matchesStatus = statusFilter ? member.status === statusFilter : true;
    return matchesQuery && matchesRole && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-black tracking-[-0.02em] text-[var(--admin-ink-charcoal)]">People</h1>
          <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
            Manage organisation members, invitations, and hierarchical units.
          </p>
        </div>
        <PeopleInviteDrawer
          defaultOpen={shouldOpenInvite}
          organizationId={organizationId}
          targetOptions={invitationTargetOptions}
        />
      </div>

      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <AdminWorkspaceTabs activeTab={activeTab} tabs={PEOPLE_TABS} />

      {activeTab === "members" ? (
        <div className="flex flex-col gap-4">
          <form className="flex flex-wrap items-center gap-3" method="get">
            <input name="tab" type="hidden" value="members" />
            <input
              className="min-w-[220px] flex-1 rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-2.5 text-sm font-semibold outline-none transition focus:border-[var(--admin-primary-container)]"
              defaultValue={firstValue(params.q) ?? ""}
              name="q"
              placeholder="Search members by name…"
              type="search"
            />
            <select
              className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-3 py-2.5 text-sm font-semibold outline-none"
              defaultValue={roleFilter}
              name="role"
            >
              <option value="">All roles</option>
              {Object.entries(ORGANIZATION_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-3 py-2.5 text-sm font-semibold outline-none"
              defaultValue={statusFilter}
              name="status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
              <option value="removed">Removed</option>
            </select>
            <button
              className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-2.5 text-sm font-bold text-[var(--admin-on-surface)] transition hover:bg-[var(--admin-surface-container-low)]"
              type="submit"
            >
              Filter
            </button>
          </form>
          <p className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
            Showing {filteredMembers.length} of {members.length} members
          </p>
          <PeopleMembersTable members={filteredMembers} organizationId={organizationId} units={units} />
        </div>
      ) : null}

      {activeTab === "invitations" ? (
        <PeopleInvitationsTable invitations={invitations} organizationId={organizationId} />
      ) : null}

      {activeTab === "units" ? <PeopleUnitsPanel organizationId={organizationId} units={units} /> : null}
    </div>
  );
}
