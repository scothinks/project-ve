import Link from "next/link";
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
  getAdminOrganizationAdjustmentLearners,
  getAdminOrganizationInvitations,
  getAdminOrganizationMemberships,
  getAdminOrganizationUnitMembers,
  getAdminOrganizationUnits,
  getAdminOrganizations,
  getAdminOrganizationPlanAssignments,
  getAdminOrganizationPlans,
  getAdminOrganizationTemporaryEntitlementGrants,
  getAdminOrganizationXpAccountOverview,
  getAdminCohorts,
  getAdminProgrammes,
  getAdminUsers,
  requireAdminWorkspaceRole,
} from "@/lib/admin";
import {
  ORGANIZATION_ACCENT_LABELS,
  ORGANIZATION_ACCENT_TOKENS,
} from "@/features/organizations/identity";
import { formatAccountingCurrencyAmount } from "@/lib/xp-format";
import {
  saveOrganization,
  saveOrganizationInvitation,
  saveOrganizationMembership,
  saveOrganizationUnit,
  saveOrganizationUnitMembers,
  saveOrganizationPlanAssignment,
  saveOrganizationProfile,
  saveOrganizationTemporaryEntitlementGrant,
  saveOrganizationXpAccountControls,
  saveOrganizationXpAccountPresentation,
  saveOrganizationXpAccountAdjustment,
  revokeOrganizationTemporaryEntitlementGrant,
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
const TEMPORARY_GRANT_TYPES = ["plan_trial", "temporary_plan", "granular_override", "additive_allocation"] as const;
const ACCOUNTING_CURRENCY_OPTIONS = [
  ["NGN", "Nigerian Naira"],
  ["GBP", "British Pound"],
  ["USD", "US Dollar"],
  ["EUR", "Euro"],
  ["KES", "Kenyan Shilling"],
  ["ZAR", "South African Rand"],
  ["GHS", "Ghanaian Cedi"],
  ["CAD", "Canadian Dollar"],
  ["AUD", "Australian Dollar"],
  ["JPY", "Japanese Yen"],
] as const;

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

const TEMPORARY_NUMERIC_ENTITLEMENT_FIELDS = [
  ...INTEGER_OVERRIDE_FIELDS,
  ["ai_monthly_allocation", "AI monthly allocation"],
  ["ai_temporary_allocation", "AI temporary allocation"],
  ["ai_top_up_allocation", "AI top-up allocation"],
  ["ai_warning_threshold", "AI warning threshold"],
  ["ai_hard_limit", "AI hard limit"],
  ["ai_user_rate_limit_per_day", "AI user rate/day"],
  ["ai_organization_concurrency_limit", "AI concurrency limit"],
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

function unitParentName(
  parentUnitId: string | null,
  units: Array<{ id: string; name: string }>,
) {
  if (!parentUnitId) return "Top level";
  return units.find((unit) => unit.id === parentUnitId)?.name ?? parentUnitId;
}

function statusTone(status: string) {
  return status === "published" || status === "active" || status === "verified" || status === "sponsored"
    ? "good"
    : "warning";
}

function temporaryGrantStatus(grant: { starts_at: string; expires_at: string | null; revoked_at: string | null }) {
  const now = Date.now();
  if (grant.revoked_at) return "revoked";
  if (new Date(grant.starts_at).getTime() > now) return "scheduled";
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) return "expired";
  return "active";
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "No expiry";
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase, workspace } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
  ]);
  const [organizations, memberships, invitations, users, programmes, cohorts, units, unitMembers, plans, planAssignments, entitlementOverrides, temporaryEntitlementGrants] = await Promise.all([
    getAdminOrganizations(supabase),
    getAdminOrganizationMemberships(supabase),
    getAdminOrganizationInvitations(supabase),
    getAdminUsers(supabase),
    getAdminProgrammes(supabase),
    getAdminCohorts(supabase),
    getAdminOrganizationUnits(supabase),
    getAdminOrganizationUnitMembers(supabase),
    getAdminOrganizationPlans(supabase),
    getAdminOrganizationPlanAssignments(supabase),
    getAdminOrganizationEntitlementOverrides(supabase),
    getAdminOrganizationTemporaryEntitlementGrants(supabase),
  ]);
  const notice = firstSearchValue((await searchParams)?.notice);
  const assignmentsByOrganization = new Map(
    planAssignments.map((assignment) => [assignment.organization_id, assignment]),
  );
  const overridesByOrganization = new Map(
    entitlementOverrides.map((override) => [override.organization_id, override]),
  );
  const temporaryGrantsByOrganization = new Map<string, typeof temporaryEntitlementGrants>();
  for (const grant of temporaryEntitlementGrants) {
    temporaryGrantsByOrganization.set(grant.organization_id, [
      ...(temporaryGrantsByOrganization.get(grant.organization_id) ?? []),
      grant,
    ]);
  }
  const isPlatformWorkspace = workspace.type === "platform";
  const selectedOrganization = organizations[0] ?? null;
  const [xpAccountOverview, adjustmentLearners] = selectedOrganization
    ? await Promise.all([
        getAdminOrganizationXpAccountOverview(supabase, selectedOrganization.id),
        getAdminOrganizationAdjustmentLearners(supabase, selectedOrganization.id),
      ])
    : [null, []];

  return (
    <>
      <AdminPageHeader
        eyebrow="Organisations"
        title="Organisation workspaces"
        subtitle={isPlatformWorkspace
          ? "Create institution workspaces and manage contextual memberships for P1 LMS delivery."
          : "Manage identity, invitations, and people for the selected organisation workspace."}
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <AdminCard>
            <h2 className="text-base font-black">Organisations</h2>
            <div className="mt-4 overflow-x-auto">
              <AdminTable columns={["Identity", "Plan", "Governance", "Support", "Memberships", "Oversight"]}>
                {organizations.map((organization) => {
                  const assignment = assignmentsByOrganization.get(organization.id);
                  const override = overridesByOrganization.get(organization.id);
                  const activeTemporaryGrantCount = (temporaryGrantsByOrganization.get(organization.id) ?? [])
                    .filter((grant) => temporaryGrantStatus(grant) === "active")
                    .length;

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
                          {activeTemporaryGrantCount > 0 ? (
                            <AdminStatusBadge tone="warning">
                              {activeTemporaryGrantCount} temporary
                            </AdminStatusBadge>
                          ) : null}
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
                      <td className="px-4 py-3">
                        {isPlatformWorkspace ? (
                          <Link
                            className="text-sm font-bold text-[var(--ve-green)] hover:underline"
                            href={`/admin/organizations/${organization.id}`}
                          >
                            Open Oversight
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-[var(--ve-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </AdminTable>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-base font-black">Temporary capability grants</h2>
            <div className="mt-4 overflow-x-auto">
              <AdminTable columns={["Organisation", "Grant", "Window", "Status", "Controls"]}>
                {temporaryEntitlementGrants.map((grant) => {
                  const organization = organizations.find((item) => item.id === grant.organization_id);
                  const state = temporaryGrantStatus(grant);

                  return (
                    <tr key={grant.id}>
                      <td className="min-w-52 px-4 py-3">
                        <p className="font-black">{organization?.name ?? grant.organization_id}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{grant.id}</p>
                      </td>
                      <td className="min-w-72 px-4 py-3">
                        <p className="font-black">{grant.grant_type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                          {grant.sourcePlan?.name ?? grant.source_plan_key ?? "Granular entitlement delta"}
                        </p>
                        {grant.reason ? (
                          <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">{grant.reason}</p>
                        ) : null}
                        <pre className="mt-2 max-h-28 overflow-auto rounded-[8px] border border-[var(--ve-line)] bg-[var(--ve-soft)] p-2 text-[11px] font-semibold text-[var(--ve-muted)]">
                          {JSON.stringify(grant.entitlement_delta, null, 2)}
                        </pre>
                      </td>
                      <td className="min-w-56 px-4 py-3 text-xs font-bold text-[var(--ve-muted)]">
                        <p>Starts {formatDateTime(grant.starts_at)}</p>
                        <p className="mt-1">Ends {formatDateTime(grant.expires_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge tone={state === "active" ? "good" : "warning"}>
                          {state}
                        </AdminStatusBadge>
                      </td>
                      <td className="min-w-44 px-4 py-3">
                        {isPlatformWorkspace && (state === "active" || state === "scheduled") ? (
                          <form action={revokeOrganizationTemporaryEntitlementGrant} className="space-y-2">
                            <input name="grantId" type="hidden" value={grant.id} />
                            <input
                              className={fieldClasses()}
                              name="reason"
                              placeholder="Revocation reason"
                            />
                            <button className={adminButtonClasses("secondary", "w-full")} type="submit">
                              Revoke
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs font-bold text-[var(--ve-muted)]">Read only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </AdminTable>
              {temporaryEntitlementGrants.length === 0 ? (
                <p className="mt-4 text-sm font-semibold text-[var(--ve-muted)]">No temporary grants recorded.</p>
              ) : null}
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

          <AdminCard>
            <h2 className="text-base font-black">Organisation units</h2>
            <div className="mt-4 overflow-x-auto">
              <AdminTable columns={["Unit", "Organisation", "Parent", "Members", "Cohorts", "Status"]}>
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td className="min-w-64 px-4 py-3">
                      <p className="font-black">{unit.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{unit.unit_type}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{unit.id}</p>
                    </td>
                    <td className="min-w-44 px-4 py-3 font-bold">
                      {unit.organization?.name ?? unit.organization_id}
                    </td>
                    <td className="min-w-44 px-4 py-3 text-sm font-bold">
                      {unitParentName(unit.parent_unit_id, units)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-black tabular-nums">
                      {unit.active_member_count ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-black tabular-nums">
                      {unit.cohort_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge tone={statusTone(unit.status)}>{unit.status}</AdminStatusBadge>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {units.map((unit) => {
                const assignableMemberships = memberships.filter(
                  (membership) =>
                    membership.organization_id === unit.organization_id &&
                    (membership.status === "active" || membership.status === "invited"),
                );
                const activeUnitMembers = new Set(
                  unitMembers
                    .filter((member) => member.unit_id === unit.id && member.status === "active")
                    .map((member) => `${member.user_id}:${member.role}`),
                );

                return (
                  <form
                    action={saveOrganizationUnitMembers}
                    className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4"
                    key={`unit-members:${unit.id}`}
                  >
                    <input name="organizationId" type="hidden" value={unit.organization_id} />
                    <input name="unitId" type="hidden" value={unit.id} />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black">{unit.name}</h3>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{unit.unit_type}</p>
                      </div>
                      <button className={adminButtonClasses("secondary", "min-h-9 px-3 text-xs")} type="submit">
                        Save members
                      </button>
                    </div>
                    <div className="mt-3 grid max-h-72 gap-2 overflow-auto pr-1">
                      {assignableMemberships.map((membership) => (
                        <label
                          className="flex items-start gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3 text-xs"
                          key={`${unit.id}:${membership.user_id}:${membership.role}`}
                        >
                          <input
                            className="mt-1 size-4"
                            defaultChecked={activeUnitMembers.has(`${membership.user_id}:${membership.role}`)}
                            name="unitMembers"
                            type="checkbox"
                            value={`${membership.user_id}:${membership.role}`}
                          />
                          <span>
                            <span className="block font-black">
                              {displayUser(membership.profile?.display_name, membership.user_id)}
                            </span>
                            <span className="mt-1 block font-semibold text-[var(--ve-muted)]">
                              {membership.roleDefinition?.label ?? roleLabel(membership.role)}
                            </span>
                          </span>
                        </label>
                      ))}
                      {assignableMemberships.length === 0 ? (
                        <p className="text-xs font-semibold text-[var(--ve-muted)]">
                          Add organisation memberships before assigning unit members.
                        </p>
                      ) : null}
                    </div>
                  </form>
                );
              })}
              {units.length === 0 ? (
                <p className="text-sm font-semibold text-[var(--ve-muted)]">
                  No organisation units have been created.
                </p>
              ) : null}
            </div>
          </AdminCard>
        </div>

        <aside className="space-y-5">
          {xpAccountOverview ? (
            <AdminCard>
              <h2 className="text-base font-black">XP account operations</h2>
              <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">
                {xpAccountOverview.account.name} · {xpAccountOverview.account.status}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="border border-[var(--ve-line)] p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Circulation</p>
                  <p className="mt-1 text-lg font-black">{xpAccountOverview.circulation}</p>
                </div>
                <div className="border border-[var(--ve-line)] p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Issued</p>
                  <p className="mt-1 text-lg font-black">{xpAccountOverview.issuance}</p>
                </div>
                <div className="border border-[var(--ve-line)] p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Redeemed</p>
                  <p className="mt-1 text-lg font-black">{xpAccountOverview.redemptions}</p>
                </div>
                <div className="border border-[var(--ve-line)] p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Adjustments</p>
                  <p className="mt-1 text-lg font-black">{xpAccountOverview.adjustments}</p>
                </div>
              </div>
              <form action={saveOrganizationXpAccountPresentation} className="mt-5 space-y-4">
                <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                <input name="xpAccountId" type="hidden" value={xpAccountOverview.account.id} />
                <label className="block">
                  <span className={labelClasses()}>Singular name</span>
                  <input className={fieldClasses()} defaultValue={xpAccountOverview.account.name} name="displayName" required />
                </label>
                <label className="block">
                  <span className={labelClasses()}>Plural name</span>
                  <input className={fieldClasses()} defaultValue={xpAccountOverview.account.pluralName} name="displayNamePlural" required />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClasses()}>Short label</span>
                    <input className={fieldClasses()} defaultValue={xpAccountOverview.account.shortLabel} name="shortLabel" required />
                  </label>
                  <label className="block">
                    <span className={labelClasses()}>Icon</span>
                    <input className={fieldClasses()} defaultValue={xpAccountOverview.account.icon} name="icon" />
                  </label>
                </div>
                <label className="block">
                  <span className={labelClasses()}>Balance display</span>
                  <select className={fieldClasses()} defaultValue={xpAccountOverview.account.displayFormat} name="displayFormat">
                    <option value="amount_name">Amount + name</option>
                    <option value="amount_short_label">Amount + short label</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClasses()}>Account status</span>
                  <select className={fieldClasses()} defaultValue={xpAccountOverview.account.status} name="status">
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <button className={adminButtonClasses("primary", "w-full")} type="submit">
                  Save XP account
                </button>
              </form>
              <div className="mt-6 border-t border-[var(--ve-line)] pt-5">
                <h3 className="text-sm font-black">Issuance and exposure controls</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  Caps apply to organisation-account earning transactions. Accounting currency is used internally to estimate the value of outstanding Points and exposure. It does not make Points cash-redeemable.
                </p>
                <form action={saveOrganizationXpAccountControls} className="mt-4 space-y-4">
                  <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                  <input name="xpAccountId" type="hidden" value={xpAccountOverview.account.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClasses()}>Accounting currency</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.accountingCurrency ?? ""}
                        list="accounting-currency-options"
                        maxLength={3}
                        name="accountingCurrency"
                        pattern="[A-Za-z]{3}"
                        placeholder="Accounting currency not configured"
                        type="text"
                      />
                      <datalist id="accounting-currency-options">
                        {ACCOUNTING_CURRENCY_OPTIONS.map(([code, name]) => (
                          <option key={code} label={name} value={code} />
                        ))}
                      </datalist>
                    </label>
                    <label className="block">
                      <span className={labelClasses()}>Accounting value per point</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.accountingValuePerUnit}
                        min={0}
                        name="accountingValuePerUnit"
                        required
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClasses()}>Rolling period days</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.issuancePeriodDays}
                        max={366}
                        min={1}
                        name="issuancePeriodDays"
                        required
                        type="number"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClasses()}>Period issuance cap</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.issuanceCapPerPeriod}
                        min={0}
                        name="issuanceCapPerPeriod"
                        required
                        type="number"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClasses()}>Per-user issuance cap</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.issuanceCapPerUser}
                        min={0}
                        name="issuanceCapPerUser"
                        required
                        type="number"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClasses()}>Funded reward budget</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.fundedRewardBudget ?? ""}
                        min={0}
                        name="fundedRewardBudget"
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <label className="block">
                      <span className={labelClasses()}>Exposure warning</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.exposureWarningThreshold ?? ""}
                        min={0}
                        name="exposureWarningThreshold"
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className={labelClasses()}>Exposure hard threshold</span>
                      <input
                        className={fieldClasses()}
                        defaultValue={xpAccountOverview.controls.exposureHardThreshold ?? ""}
                        min={0}
                        name="exposureHardThreshold"
                        step="0.01"
                        type="number"
                      />
                    </label>
                  </div>
                  <div className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-3 text-xs font-semibold text-[var(--ve-muted-strong)]">
                    <p>Issued in current rolling period: {xpAccountOverview.controls.periodIssued}</p>
                    <p className="mt-1">Remaining period capacity: {xpAccountOverview.controls.periodRemaining}</p>
                    <p className="mt-1">
                      Accounting currency: {xpAccountOverview.controls.accountingCurrency ?? "Accounting currency not configured"}
                    </p>
                    <p className="mt-1">
                      Accounting value per point: {formatAccountingCurrencyAmount(
                        xpAccountOverview.controls.accountingValuePerUnit,
                        xpAccountOverview.controls.accountingCurrency,
                      )}
                    </p>
                    <p className="mt-1">
                      Funded reward budget: {formatAccountingCurrencyAmount(
                        xpAccountOverview.controls.fundedRewardBudget,
                        xpAccountOverview.controls.accountingCurrency,
                      )}
                    </p>
                    <p className="mt-1">
                      Exposure warning: {formatAccountingCurrencyAmount(
                        xpAccountOverview.controls.exposureWarningThreshold,
                        xpAccountOverview.controls.accountingCurrency,
                      )}
                    </p>
                    <p className="mt-1">
                      Exposure hard threshold: {formatAccountingCurrencyAmount(
                        xpAccountOverview.controls.exposureHardThreshold,
                        xpAccountOverview.controls.accountingCurrency,
                      )}
                    </p>
                    <p className="mt-1">
                      Estimated unredeemed liability: {formatAccountingCurrencyAmount(
                        xpAccountOverview.exposure.estimatedUnredeemedLiability,
                        xpAccountOverview.controls.accountingCurrency,
                      )}
                    </p>
                    {xpAccountOverview.exposure.warning ? <p className="mt-1 font-black text-[var(--ve-store)]">Exposure warning threshold reached.</p> : null}
                    {xpAccountOverview.exposure.hardBlocked ? <p className="mt-1 font-black text-[var(--foreground)]">New issuance is blocked by the exposure threshold.</p> : null}
                  </div>
                  <button className={adminButtonClasses("primary", "w-full")} type="submit">
                    Save issuance controls
                  </button>
                </form>
                <form action={saveOrganizationXpAccountAdjustment} className="mt-5 space-y-3 border-t border-[var(--ve-line)] pt-5">
                  <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                  <input name="xpAccountId" type="hidden" value={xpAccountOverview.account.id} />
                  <h3 className="text-sm font-black">Adjust learner balance</h3>
                  <select className={fieldClasses()} name="targetUserId" required defaultValue="">
                    <option disabled value="">Select active learner</option>
                    {adjustmentLearners.map((learner) => (
                        <option key={learner.userId} value={learner.userId}>
                          {displayUser(learner.displayName, learner.userId)} - {learner.sourceLabel}
                        </option>
                      ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select className={fieldClasses()} name="direction" defaultValue="earn">
                      <option value="earn">Add points</option>
                      <option value="spend">Remove points</option>
                    </select>
                    <input className={fieldClasses()} min={1} name="amount" placeholder="Amount" required type="number" />
                  </div>
                  <input className={fieldClasses()} maxLength={200} name="reason" placeholder="Reason (optional)" />
                  <button className={adminButtonClasses("secondary", "w-full")} type="submit">Save adjustment</button>
                </form>
              </div>
              <div className="mt-6 grid gap-4 border-t border-[var(--ve-line)] pt-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-black">Issuance by programme</h3>
                  <div className="mt-3 space-y-2">
                    {xpAccountOverview.programmeIssuance.slice(0, 6).map((programme) => (
                      <div className="flex items-center justify-between gap-3 text-xs" key={programme.programmeId}>
                        <span className="truncate font-bold">{programme.programmeName}</span>
                        <span className="font-black">{programme.issued}</span>
                      </div>
                    ))}
                    {xpAccountOverview.programmeIssuance.length === 0 ? <p className="text-xs font-semibold text-[var(--ve-muted)]">No programme issuance yet.</p> : null}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-black">Issuance by learner</h3>
                  <div className="mt-3 space-y-2">
                    {xpAccountOverview.userIssuance.slice(0, 6).map((learner) => (
                      <div className="flex items-center justify-between gap-3 text-xs" key={learner.userId}>
                        <span className="truncate font-bold">{learner.displayName}</span>
                        <span className="font-black">{learner.issued}</span>
                      </div>
                    ))}
                    {xpAccountOverview.userIssuance.length === 0 ? <p className="text-xs font-semibold text-[var(--ve-muted)]">No learner issuance yet.</p> : null}
                  </div>
                </div>
              </div>
              <div className="mt-5 border-t border-[var(--ve-line)] pt-4">
                <h3 className="text-sm font-black">Recent transactions</h3>
                <div className="mt-3 space-y-2">
                  {xpAccountOverview.transactions.slice(0, 8).map((transaction) => (
                    <div className="flex items-center justify-between gap-3 text-xs" key={transaction.id}>
                      <span className="truncate font-bold">{transaction.sourceType}</span>
                      <span className={transaction.direction === "earn" ? "font-black text-[var(--ve-green)]" : "font-black"}>
                        {transaction.direction === "earn" ? "+" : "-"}{transaction.amount}
                      </span>
                    </div>
                  ))}
                  {xpAccountOverview.transactions.length === 0 ? (
                    <p className="text-xs font-semibold text-[var(--ve-muted)]">No transactions yet.</p>
                  ) : null}
                </div>
              </div>
            </AdminCard>
          ) : null}
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
                <input
                  className={fieldClasses()}
                  defaultValue={selectedOrganization?.short_name ?? ""}
                  name="shortName"
                  placeholder="Learner-facing name"
                />
              </label>
              <label className="block">
                <span className={labelClasses()}>Description</span>
                <textarea
                  className={`${fieldClasses()} min-h-28 resize-y`}
                  defaultValue={selectedOrganization?.description ?? ""}
                  name="description"
                />
              </label>
              <label className="block">
                <span className={labelClasses()}>Logo URL</span>
                <input
                  className={fieldClasses()}
                  defaultValue={selectedOrganization?.logo_url ?? ""}
                  name="logoUrl"
                  placeholder="https://..."
                  type="url"
                />
              </label>
              <label className="block">
                <span className={labelClasses()}>Accent</span>
                <select
                  className={fieldClasses()}
                  name="accentToken"
                  defaultValue={selectedOrganization?.accent_token ?? "green"}
                >
                  {ORGANIZATION_ACCENT_TOKENS.map((token) => (
                    <option key={token} value={token}>
                      {ORGANIZATION_ACCENT_LABELS[token]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Support email</span>
                <input
                  className={fieldClasses()}
                  defaultValue={selectedOrganization?.support_email ?? ""}
                  name="supportEmail"
                  type="email"
                />
              </label>
              <label className="block">
                <span className={labelClasses()}>Support phone</span>
                <input
                  className={fieldClasses()}
                  defaultValue={selectedOrganization?.support_phone ?? ""}
                  name="supportPhone"
                />
              </label>
              {isPlatformWorkspace ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClasses()}>Verification</span>
                    <select
                      className={fieldClasses()}
                      name="verificationStatus"
                      defaultValue={selectedOrganization?.verification_status ?? "unverified"}
                    >
                      {VERIFICATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClasses()}>Lifecycle</span>
                    <select
                      className={fieldClasses()}
                      name="lifecycleStatus"
                      defaultValue={selectedOrganization?.lifecycle_status ?? "active"}
                    >
                      {LIFECYCLE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <button className={adminButtonClasses("primary", "w-full")} type="submit">
                Save identity
              </button>
            </form>
          </AdminCard>

          {isPlatformWorkspace ? (
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
          ) : null}

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
            <h2 className="text-base font-black">Create or update unit</h2>
            <form action={saveOrganizationUnit} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelClasses()}>Existing unit</span>
                <select className={fieldClasses()} name="unitId" defaultValue="">
                  <option value="">Create new</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.unit_type})
                    </option>
                  ))}
                </select>
              </label>
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
                <span className={labelClasses()}>Parent unit</span>
                <select className={fieldClasses()} name="parentUnitId" defaultValue="">
                  <option value="">Top level</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.unit_type})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClasses()}>Name</span>
                  <input className={fieldClasses()} name="name" required />
                </label>
                <label className="block">
                  <span className={labelClasses()}>Type</span>
                  <input className={fieldClasses()} name="unitType" placeholder="Department" required />
                </label>
              </div>
              <label className="block">
                <span className={labelClasses()}>Status</span>
                <select className={fieldClasses()} name="status" defaultValue="published">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <button className={adminButtonClasses("primary", "w-full")} type="submit">
                Save unit
              </button>
            </form>
          </AdminCard>

          {isPlatformWorkspace ? (
            <>
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

              <AdminCard>
                <h2 className="text-base font-black">Create temporary grant</h2>
                <form action={saveOrganizationTemporaryEntitlementGrant} className="mt-4 space-y-4">
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
                    <span className={labelClasses()}>Grant type</span>
                    <select className={fieldClasses()} name="grantType" defaultValue="granular_override">
                      {TEMPORARY_GRANT_TYPES.map((grantType) => (
                        <option key={grantType} value={grantType}>
                          {grantType.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClasses()}>Source plan</span>
                    <select className={fieldClasses()} name="sourcePlanKey" defaultValue="">
                      <option value="">No source plan</option>
                      {plans.map((plan) => (
                        <option key={plan.key} value={plan.key}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={labelClasses()}>Starts at</span>
                      <input className={fieldClasses()} name="startsAt" type="datetime-local" />
                    </label>
                    <label className="block">
                      <span className={labelClasses()}>Expires at</span>
                      <input className={fieldClasses()} name="expiresAt" type="datetime-local" />
                    </label>
                  </div>
                  <div>
                    <p className={labelClasses()}>Numeric entitlement delta</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {TEMPORARY_NUMERIC_ENTITLEMENT_FIELDS.map(([key, label]) => (
                        <label className="block" key={key}>
                          <span className="text-xs font-bold text-[var(--ve-muted)]">{label}</span>
                          <input
                            className={fieldClasses()}
                            min="0"
                            name={key}
                            placeholder="No delta"
                            type="number"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className={labelClasses()}>Entitlement delta JSON</span>
                    <textarea
                      className={`${fieldClasses()} min-h-28 resize-y font-mono text-xs`}
                      name="entitlementDeltaJson"
                      placeholder='{"allowed_lesson_block_types":["text","image","video"],"max_storage_bytes":1073741824}'
                    />
                  </label>
                  <label className="block">
                    <span className={labelClasses()}>Reason</span>
                    <textarea
                      className={`${fieldClasses()} min-h-24 resize-y`}
                      name="reason"
                      placeholder="Trial, sponsored capability evaluation, top-up or immediate revocation context"
                    />
                  </label>
                  <button className={adminButtonClasses("primary", "w-full")} type="submit">
                    Save temporary grant
                  </button>
                </form>
              </AdminCard>
            </>
          ) : null}
        </aside>
      </section>
    </>
  );
}
