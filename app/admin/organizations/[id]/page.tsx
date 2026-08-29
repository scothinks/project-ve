import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminAlertCard,
  AdminNoticeBanner,
  AdminStatusBadge,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import {
  enterOrganizationWorkspace,
  revokeOrganizationTemporaryEntitlementGrant,
  saveOrganizationTemporaryEntitlementGrant,
} from "@/app/admin/organizations/actions";
import { getAdminOrganizationOversight, requirePlatformAdmin } from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

const GRANT_TYPES = [
  { value: "plan_trial", label: "Plan Trial" },
  { value: "temporary_plan", label: "Temporary Plan" },
  { value: "granular_override", label: "Granular Override" },
  { value: "additive_allocation", label: "Additive Allocation" },
] as const;

const GRANT_NUMERIC_FIELDS = [
  ["max_courses", "Max courses"],
  ["max_storage_bytes", "Storage bytes"],
  ["ai_monthly_allocation", "AI monthly allocation"],
] as const;

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-bold outline-none transition focus:border-[var(--admin-primary-container)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]";
}

function grantStatusTone(grant: { revoked_at: string | null; expires_at: string | null; starts_at: string }) {
  const now = Date.now();
  if (grant.revoked_at) return "danger" as const;
  if (new Date(grant.starts_at).getTime() > now) return "warning" as const;
  if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) return "neutral" as const;
  return "good" as const;
}

export default async function AdminOrganizationOversightPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { id } = await params;
  const { supabase } = await requirePlatformAdmin();
  const oversight = await getAdminOrganizationOversight(supabase, id);

  if (!oversight) {
    notFound();
  }

  const notice = Array.isArray((await searchParams)?.notice)
    ? (await searchParams)?.notice?.[0]
    : (await searchParams)?.notice;

  const { organization, entitlementRows, activeTemporaryGrants, recentActivity } = oversight;
  const displayName = organization.short_name || organization.name;

  return (
    <div className="flex flex-col gap-6">
      <Link className="text-sm font-bold text-[var(--admin-primary)] hover:underline" href="/admin/organizations">
        ← Organisations
      </Link>

      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={organization.verification_status === "verified" ? "good" : "warning"}>
              {organization.verification_status.replaceAll("_", " ")}
            </AdminStatusBadge>
            <AdminStatusBadge tone={organization.status === "published" ? "good" : "warning"}>
              {organization.status}
            </AdminStatusBadge>
          </div>
          <h1 className="mt-2 text-[32px] font-black tracking-[-0.02em] text-[var(--admin-ink-charcoal)]">
            {displayName}
          </h1>
          <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">Platform organisation oversight</p>
        </div>
        <form action={enterOrganizationWorkspace}>
          <input name="organizationId" type="hidden" value={organization.id} />
          <button
            className="inline-flex items-center gap-2 rounded-full bg-[var(--admin-primary-container)] px-5 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition hover:brightness-95"
            type="submit"
          >
            Enter Organisation Workspace →
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <h2 className="border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
            Scale Metrics
          </h2>
          <p className="mt-3 text-[28px] font-black text-[var(--admin-ink-charcoal)]">{oversight.totalMembers}</p>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            Total Members
          </p>
          <div className="mt-3 flex gap-6">
            <div>
              <p className="text-lg font-black text-[var(--admin-primary)]">{oversight.activeMembers}</p>
              <p className="text-xs font-bold text-[var(--admin-on-surface-variant)]">Active</p>
            </div>
            <div>
              <p className="text-lg font-black text-[var(--admin-secondary)]">{oversight.inactiveMembers}</p>
              <p className="text-xs font-bold text-[var(--admin-on-surface-variant)]">Inactive</p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--admin-border-warm)] pb-2">
            <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Effective Entitlements</h2>
            {oversight.planName ? (
              <span className="rounded-full bg-[color:color-mix(in_srgb,var(--admin-primary-container)_14%,transparent)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--admin-primary)]">
                {oversight.planName}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {entitlementRows.map((row) => (
              <div className="flex items-center justify-between" key={row.key}>
                <div>
                  <p className="text-sm font-bold text-[var(--admin-on-surface)]">{row.label}</p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Plan default: {row.planDefault !== null ? row.formatted(row.planDefault) : "—"}
                    {row.hasOverride ? " · Override" : ""}
                    {row.hasTemporaryGrant ? " · Temp grant" : ""}
                  </p>
                </div>
                <p className="text-lg font-black text-[var(--admin-ink-charcoal)]">
                  {row.effective !== null ? row.formatted(row.effective) : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <h2 className="border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
            Active Temporary Grants
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {activeTemporaryGrants.length === 0 ? (
              <p className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">No active temporary grants.</p>
            ) : (
              activeTemporaryGrants.map((grant) => (
                <div className="rounded-[14px] border border-[var(--admin-border-warm)] p-3" key={grant.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--admin-on-surface)]">
                      {grant.grant_type.replaceAll("_", " ")}
                    </p>
                    <AdminStatusBadge tone={grantStatusTone(grant)}>Active</AdminStatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    {grant.expires_at ? `Expires ${formatRewardDate(grant.expires_at)}` : "No expiry"}
                  </p>
                  <form action={revokeOrganizationTemporaryEntitlementGrant} className="mt-2 flex items-center gap-2">
                    <input name="grantId" type="hidden" value={grant.id} />
                    <input className={fieldClasses()} name="reason" placeholder="Revocation reason" />
                    <button
                      className="shrink-0 rounded-[10px] border border-[var(--admin-error)] px-3 py-2 text-xs font-bold text-[var(--admin-error)] transition hover:bg-[var(--admin-error)] hover:text-white"
                      type="submit"
                    >
                      Revoke
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold text-[var(--admin-primary)]">
              + Create Temporary Grant
            </summary>
            <form action={saveOrganizationTemporaryEntitlementGrant} className="mt-3 flex flex-col gap-3">
              <input name="organizationId" type="hidden" value={organization.id} />
              <label>
                <span className={labelClasses()}>Grant type</span>
                <select className={fieldClasses()} name="grantType">
                  {GRANT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GRANT_NUMERIC_FIELDS.map(([key, label]) => (
                  <label key={key}>
                    <span className={labelClasses()}>{label}</span>
                    <input className={fieldClasses()} name={key} type="number" />
                  </label>
                ))}
              </div>
              <label>
                <span className={labelClasses()}>Expires at</span>
                <input className={fieldClasses()} name="expiresAt" type="datetime-local" />
              </label>
              <label>
                <span className={labelClasses()}>Reason (required, logged to audit trail)</span>
                <textarea className={fieldClasses()} name="reason" required rows={2} />
              </label>
              <button className={adminButtonClasses("primary", "self-start")} type="submit">
                Authorize Grant
              </button>
            </form>
          </details>
        </div>

        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--admin-border-warm)] pb-2">
            <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Recent Platform Activity</h2>
            <Link
              className="text-sm font-bold text-[var(--admin-primary)] hover:underline"
              href={`/admin/activity?organizationId=${organization.id}`}
            >
              View full log
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">No recent activity.</p>
            ) : (
              recentActivity.map((event) => (
                <div className="text-sm" key={event.id}>
                  <p className="font-bold text-[var(--admin-on-surface)]">{event.actionLabel}</p>
                  <p className="text-[var(--admin-on-surface-variant)]">{event.summary}</p>
                  <p className="text-xs text-[var(--admin-outline)]">{formatRewardDate(event.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {oversight.activeMembers === 0 ? (
        <AdminAlertCard
          detail="This organisation has no active members yet. Enter its workspace to invite an owner."
          title="No active members"
          tone="warning"
        />
      ) : null}
    </div>
  );
}
