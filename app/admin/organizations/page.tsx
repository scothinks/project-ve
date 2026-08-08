import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import {
  getAdminOrganizationEntitlementOverrides,
  getAdminOrganizationInvitations,
  getAdminOrganizationMemberships,
  getAdminOrganizations,
  getAdminOrganizationPlanAssignments,
  getAdminOrganizationPlans,
  getAdminCohorts,
  getAdminProgrammes,
  getAdminUsers,
  requirePlatformAdmin,
} from "@/lib/admin";
import {
  ORGANIZATION_ACCENT_LABELS,
  ORGANIZATION_ACCENT_TOKENS,
} from "@/features/organizations/identity";
import {
  saveOrganization,
  saveOrganizationInvitation,
  saveOrganizationMembership,
  saveOrganizationPlanAssignment,
  saveOrganizationProfile,
} from "./actions";

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
const BILLING_STATUSES = ["free", "trial", "active", "past_due", "cancelled", "sponsored"] as const;
const LIFECYCLE_STATUSES = ["trial", "active", "suspended", "archived"] as const;
const VERIFICATION_STATUSES = ["unverified", "verification_pending", "verified", "rejected"] as const;

const INTEGER_OVERRIDE_FIELDS = [
  ["max_courses", "Max courses"],
  ["max_total_lessons", "Max lessons"],
  ["max_storage_bytes", "Storage bytes"],
  ["max_active_missions", "Active missions"],
  ["max_xp_accounts", "XP accounts"],
  ["max_active_rewards", "Active rewards"],
  ["max_open_reward_claims", "Open claims"],
  ["max_fulfilled_reward_claims_per_month", "Fulfilled claims/month"],
] as const;

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

function organizationDisplayName(organization: { name: string; short_name: string | null }) {
  return organization.short_name || organization.name;
}

function statusTone(status: string) {
  return status === "published" || status === "active" || status === "verified" || status === "sponsored"
    ? "good"
    : "warning";
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase } = await requirePlatformAdmin();
  const [organizations, memberships, invitations, users, programmes, cohorts, plans, planAssignments, entitlementOverrides] = await Promise.all([
    getAdminOrganizations(supabase),
    getAdminOrganizationMemberships(supabase),
    getAdminOrganizationInvitations(supabase),
    getAdminUsers(supabase),
    getAdminProgrammes(supabase),
    getAdminCohorts(supabase),
    getAdminOrganizationPlans(supabase),
    getAdminOrganizationPlanAssignments(supabase),
    getAdminOrganizationEntitlementOverrides(supabase),
  ]);
  const notice = firstSearchValue((await searchParams)?.notice);
  const assignmentsByOrganization = new Map(
    planAssignments.map((assignment) => [assignment.organization_id, assignment]),
  );
  const overridesByOrganization = new Map(
    entitlementOverrides.map((override) => [override.organization_id, override]),
  );

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
              <AdminTable columns={["Identity", "Plan", "Governance", "Support", "Memberships"]}>
                {organizations.map((organization) => {
                  const assignment = assignmentsByOrganization.get(organization.id);
                  const override = overridesByOrganization.get(organization.id);

                  return (
                    <tr key={organization.id}>
                      <td className="min-w-64 px-4 py-3">
                        <div className="flex items-start gap-3">
                          {organization.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt=""
                              className="h-10 w-10 rounded-[8px] border border-[var(--ve-line)] object-cover"
                              src={organization.logo_url}
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--ve-line)] bg-[var(--ve-soft)] text-xs font-black text-[var(--ve-muted)]">
                              {organizationDisplayName(organization).slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-black">{organizationDisplayName(organization)}</p>
                            {organization.short_name ? (
                              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{organization.name}</p>
                            ) : null}
                            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{organization.slug}</p>
                            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{organization.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="min-w-44 px-4 py-3">
                        <p className="font-black">{assignment?.plan?.name ?? assignment?.plan_key ?? "Starter"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AdminStatusBadge tone={statusTone(assignment?.billing_status ?? "free")}>
                            {assignment?.billing_status ?? "free"}
                          </AdminStatusBadge>
                          {override ? <AdminStatusBadge tone="warning">override</AdminStatusBadge> : null}
                        </div>
                      </td>
                      <td className="min-w-48 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <AdminStatusBadge tone={organization.status === "published" ? "good" : "warning"}>
                            {organization.status}
                          </AdminStatusBadge>
                          <AdminStatusBadge tone={statusTone(organization.verification_status)}>
                            {organization.verification_status}
                          </AdminStatusBadge>
                          <AdminStatusBadge tone={statusTone(organization.lifecycle_status)}>
                            {organization.lifecycle_status}
                          </AdminStatusBadge>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                          {ORGANIZATION_ACCENT_LABELS[organization.accent_token]}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                          Created by {organization.creation_source.replaceAll("_", " ")}
                        </p>
                      </td>
                      <td className="min-w-48 px-4 py-3">
                        <p className="text-sm font-bold">{organization.support_email ?? "No support email"}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                          {organization.support_phone ?? "No support phone"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-black tabular-nums">
                        {memberships.filter((membership) => membership.organization_id === organization.id).length}
                      </td>
                    </tr>
                  );
                })}
              </AdminTable>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-base font-black">Invitations</h2>
            <div className="mt-4 overflow-x-auto">
              <AdminTable columns={["Invitee", "Organisation", "Target", "Role", "Status"]}>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td className="min-w-56 px-4 py-3">
                      <p className="font-black">
                        {invitation.profile?.display_name ?? invitation.email ?? invitation.invited_user_id ?? "Email invite"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{invitation.id}</p>
                    </td>
                    <td className="min-w-44 px-4 py-3 font-bold">
                      {invitation.organization?.name ?? invitation.organization_id}
                    </td>
                    <td className="min-w-44 px-4 py-3">
                      <p className="font-bold">{invitation.target_type}</p>
                      {invitation.target_id ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{invitation.target_id}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-bold">{roleLabel(invitation.role)}</td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge tone={invitation.status === "accepted" ? "good" : "warning"}>
                        {invitation.status}
                      </AdminStatusBadge>
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
            <h2 className="text-base font-black">Identity and lifecycle</h2>
            <form action={saveOrganizationProfile} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelClasses()}>Organisation</span>
                <select className={fieldClasses()} name="organizationId" required>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organizationDisplayName(organization)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Short name</span>
                <input className={fieldClasses()} name="shortName" placeholder="Learner-facing name" />
              </label>
              <label className="block">
                <span className={labelClasses()}>Description</span>
                <textarea className={`${fieldClasses()} min-h-28 resize-y`} name="description" />
              </label>
              <label className="block">
                <span className={labelClasses()}>Logo URL</span>
                <input className={fieldClasses()} name="logoUrl" placeholder="https://..." type="url" />
              </label>
              <label className="block">
                <span className={labelClasses()}>Accent</span>
                <select className={fieldClasses()} name="accentToken" defaultValue="green">
                  {ORGANIZATION_ACCENT_TOKENS.map((token) => (
                    <option key={token} value={token}>
                      {ORGANIZATION_ACCENT_LABELS[token]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Support email</span>
                <input className={fieldClasses()} name="supportEmail" type="email" />
              </label>
              <label className="block">
                <span className={labelClasses()}>Support phone</span>
                <input className={fieldClasses()} name="supportPhone" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClasses()}>Verification</span>
                  <select className={fieldClasses()} name="verificationStatus" defaultValue="unverified">
                    {VERIFICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClasses()}>Lifecycle</span>
                  <select className={fieldClasses()} name="lifecycleStatus" defaultValue="active">
                    {LIFECYCLE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className={adminButtonClasses("primary", "w-full")} type="submit">
                Save identity
              </button>
            </form>
          </AdminCard>

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
            <h2 className="text-base font-black">Invite learner or staff</h2>
            <form action={saveOrganizationInvitation} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelClasses()}>Organisation</span>
                <select className={fieldClasses()} name="organizationId" required>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organizationDisplayName(organization)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Target</span>
                <select className={fieldClasses()} name="target" defaultValue="organization">
                  <option value="organization">Whole organisation</option>
                  {programmes.map((programme) => (
                    <option key={`programme:${programme.id}`} value={`programme:${programme.id}`}>
                      Programme: {programme.title}
                    </option>
                  ))}
                  {cohorts.map((cohort) => (
                    <option key={`cohort:${cohort.id}`} value={`cohort:${cohort.id}`}>
                      Cohort: {cohort.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Existing user</span>
                <select className={fieldClasses()} name="invitedUserId" defaultValue="">
                  <option value="">Invite by email</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {displayUser(user.display_name, user.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Email</span>
                <input className={fieldClasses()} name="email" placeholder="Optional when existing user is selected" type="email" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
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
                  <span className={labelClasses()}>Expires in days</span>
                  <input className={fieldClasses()} defaultValue="14" max="90" min="1" name="expiresInDays" type="number" />
                </label>
              </div>
              <button className={adminButtonClasses("success", "w-full")} type="submit">
                Create invitation
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

          <AdminCard>
            <h2 className="text-base font-black">Assign plan</h2>
            <form action={saveOrganizationPlanAssignment} className="mt-4 space-y-4">
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
                <span className={labelClasses()}>Plan</span>
                <select className={fieldClasses()} name="planKey" required>
                  {plans.map((plan) => (
                    <option key={plan.key} value={plan.key}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Billing status</span>
                <select className={fieldClasses()} name="billingStatus" defaultValue="free">
                  {BILLING_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className={labelClasses()}>Pilot entitlement overrides</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {INTEGER_OVERRIDE_FIELDS.map(([key, label]) => (
                    <label className="block" key={key}>
                      <span className="text-xs font-bold text-[var(--ve-muted)]">{label}</span>
                      <input
                        className={fieldClasses()}
                        min="0"
                        name={key}
                        placeholder="Use plan default"
                        type="number"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className={labelClasses()}>Override reason</span>
                <textarea
                  className={`${fieldClasses()} min-h-24 resize-y`}
                  name="overrideReason"
                  placeholder="Pilot, sponsored customer, or temporary commercial approval"
                />
              </label>
              <button className={adminButtonClasses("primary", "w-full")} type="submit">
                Save plan assignment
              </button>
            </form>
          </AdminCard>
        </aside>
      </section>
    </>
  );
}
