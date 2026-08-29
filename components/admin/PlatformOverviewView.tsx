import Link from "next/link";
import { AdminActivityList, AdminAlertCard, AdminMetricCard } from "@/components/admin/AdminPrimitives";
import {
  AdminActivityIcon,
  AdminErrorIcon,
  AdminOverviewIcon,
  AdminPeopleIcon,
  AdminRewardsIcon,
} from "@/components/admin/AdminIcons";
import type { AdminOrganizationActivityEvent, AdminPlatformOverview } from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

function activityIconGlyph(event: AdminOrganizationActivityEvent) {
  if (event.entityType === "course" || event.entityType === "lesson") return "📘";
  if (event.entityType === "mission") return "🎯";
  if (event.entityType === "membership" || event.entityType === "learner") return "👤";
  if (event.entityType === "organization") return "🏢";
  return "•";
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function PlatformOverviewView({ overview }: { overview: AdminPlatformOverview }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[32px] font-black tracking-[-0.02em] text-[var(--admin-ink-charcoal)]">
          Platform Attention Dashboard
        </h1>
        <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
          Here&rsquo;s what needs your attention across the platform ecosystem today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          href="/admin/organizations"
          icon={<AdminOverviewIcon className="text-[18px]" />}
          label="Total Organisations"
          value={overview.totalOrganizations}
        />
        <AdminMetricCard
          href="/admin/users"
          icon={<AdminPeopleIcon className="text-[18px]" />}
          label="Total Users"
          value={overview.totalUsers}
        />
        <AdminMetricCard
          helpText="Overrides in effect"
          href="/admin/organizations"
          icon={<AdminErrorIcon className="text-[18px]" />}
          label="Entitlement Overrides"
          value={overview.activeEntitlementOverrides}
        />
        <AdminMetricCard
          helpText="Expiring within 7 days"
          href="/admin/organizations"
          icon={<AdminErrorIcon className="text-[18px]" />}
          label="Temporary Grants"
          tone={overview.expiringTemporaryGrants.length > 0 ? "warning" : "default"}
          value={overview.expiringTemporaryGrants.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
            <AdminOverviewIcon className="text-[var(--admin-secondary)]" />
            Organisations Pending Verification
          </h2>
          {overview.organizationsPendingVerification.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
              No organisations awaiting verification.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {overview.organizationsPendingVerification.slice(0, 4).map((org) => (
                <AdminAlertCard
                  actionHref={`/admin/organizations/${org.id}`}
                  actionLabel="Review"
                  detail={`@${org.slug}`}
                  icon={<AdminErrorIcon />}
                  key={org.id}
                  title={org.short_name || org.name}
                  tone="warning"
                />
              ))}
              {overview.organizationsPendingVerification.length > 4 ? (
                <Link className="text-sm font-bold text-[var(--admin-primary)] hover:underline" href="/admin/organizations">
                  View all {overview.organizationsPendingVerification.length}
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
            <AdminRewardsIcon className="text-[var(--admin-secondary)]" />
            Expiring Temporary Grants
          </h2>
          {overview.expiringTemporaryGrants.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
              No grants expiring in the next 7 days.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {overview.expiringTemporaryGrants.slice(0, 4).map((grant) => (
                <AdminAlertCard
                  actionHref={`/admin/organizations/${grant.organization_id}`}
                  actionLabel="Manage"
                  detail={`Expires ${formatRewardDate(grant.expires_at)}`}
                  icon={<AdminErrorIcon />}
                  key={grant.id}
                  title={`${grant.organizationName} · ${grant.grant_type.replaceAll("_", " ")}`}
                  tone="warning"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--admin-border-warm)] pb-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--admin-on-surface)]">
              <AdminActivityIcon />
              Cross-Org Activity Feed
            </h2>
            <Link className="text-sm font-bold text-[var(--admin-primary)] hover:underline" href="/admin/activity">
              View full log
            </Link>
          </div>
          <AdminActivityList
            items={overview.recentActivity.map((event) => ({
              id: event.id,
              icon: activityIconGlyph(event),
              title: `${event.organizationName ?? "Platform"} · ${event.actionLabel}`,
              detail: event.summary,
              timeLabel: formatRelativeTime(event.createdAt),
            }))}
          />
        </div>

        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <h2 className="border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
            Operational Queues
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            <AdminAlertCard
              actionHref="/admin/redemptions"
              actionLabel="Process batch"
              detail="Reward redemptions awaiting manual fulfillment."
              icon={<AdminRewardsIcon />}
              title={`${overview.pendingRedemptions} pending redemptions`}
              tone={overview.pendingRedemptions > 0 ? "attention" : "warning"}
            />
            <AdminAlertCard
              actionHref="/admin/proofs"
              actionLabel="Review proofs"
              detail="Mission proof submissions awaiting approval."
              icon={<AdminRewardsIcon />}
              title={`${overview.pendingProofItems} pending proofs`}
              tone={overview.pendingProofItems > 0 ? "attention" : "warning"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
