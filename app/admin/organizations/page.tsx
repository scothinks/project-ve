import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import {
  getAdminOrganizationMemberships,
  getAdminOrganizations,
  getAdminUsers,
  requirePlatformAdmin,
} from "@/lib/admin";
import { saveOrganization, saveOrganizationMembership } from "./actions";

const ORGANIZATION_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
  "reviewer",
  "instructor",
  "report_viewer",
  "learner",
] as const;

const MEMBERSHIP_STATUSES = ["active", "invited", "suspended", "removed"] as const;

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayUser(displayName: string | null | undefined, userId: string) {
  return displayName || userId;
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase } = await requirePlatformAdmin();
  const [organizations, memberships, users] = await Promise.all([
    getAdminOrganizations(supabase),
    getAdminOrganizationMemberships(supabase),
    getAdminUsers(supabase),
  ]);
  const notice = firstSearchValue((await searchParams)?.notice);

  return (
    <>
      <AdminPageHeader
        eyebrow="Organisations"
        title="Organisation workspaces"
        subtitle="Create institution workspaces and manage contextual memberships for P1 LMS delivery."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <AdminCard>
            <h2 className="text-base font-black">Organisations</h2>
            <div className="mt-4 overflow-x-auto">
              <AdminTable columns={["Name", "Slug", "Status", "Memberships"]}>
                {organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td className="min-w-56 px-4 py-3">
                      <p className="font-black">{organization.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{organization.id}</p>
                    </td>
                    <td className="px-4 py-3 font-bold">{organization.slug}</td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge tone={organization.status === "published" ? "good" : "warning"}>
                        {organization.status}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-4 py-3 font-black tabular-nums">
                      {memberships.filter((membership) => membership.organization_id === organization.id).length}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-base font-black">Memberships</h2>
            <div className="mt-4 overflow-x-auto">
              <AdminTable columns={["User", "Organisation", "Role", "Status"]}>
                {memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td className="min-w-56 px-4 py-3">
                      <p className="font-black">{displayUser(membership.profile?.display_name, membership.user_id)}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{membership.user_id}</p>
                    </td>
                    <td className="min-w-48 px-4 py-3 font-bold">
                      {membership.organization?.name ?? membership.organization_id}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {membership.roleDefinition?.label ?? roleLabel(membership.role)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge tone={membership.status === "active" ? "good" : "warning"}>
                        {membership.status}
                      </AdminStatusBadge>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
          </AdminCard>
        </div>

        <aside className="space-y-5">
          <AdminCard>
            <h2 className="text-base font-black">Create or update organisation</h2>
            <form action={saveOrganization} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelClasses()}>Existing organisation</span>
                <select className={fieldClasses()} name="organizationId" defaultValue="">
                  <option value="">Create new</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Name</span>
                <input className={fieldClasses()} name="name" required />
              </label>
              <label className="block">
                <span className={labelClasses()}>Slug</span>
                <input className={fieldClasses()} name="slug" placeholder="generated from name" />
              </label>
              <label className="block">
                <span className={labelClasses()}>Status</span>
                <select className={fieldClasses()} name="status" defaultValue="draft">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <button className={adminButtonClasses("primary", "w-full")} type="submit">
                Save organisation
              </button>
            </form>
          </AdminCard>

          <AdminCard>
            <h2 className="text-base font-black">Add or update membership</h2>
            <form action={saveOrganizationMembership} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelClasses()}>Organisation</span>
                <select className={fieldClasses()} name="organizationId" required>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>User</span>
                <select className={fieldClasses()} name="userId" required>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {displayUser(user.display_name, user.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Role</span>
                <select className={fieldClasses()} name="role" defaultValue="learner">
                  {ORGANIZATION_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Status</span>
                <select className={fieldClasses()} name="status" defaultValue="active">
                  {MEMBERSHIP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <button className={adminButtonClasses("success", "w-full")} type="submit">
                Save membership
              </button>
            </form>
          </AdminCard>
        </aside>
      </section>
    </>
  );
}
