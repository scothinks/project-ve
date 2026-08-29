import { AdminAlertCard, AdminMetricCard, AdminQuickActionButton } from "@/components/admin/AdminPrimitives";
import {
  AdminAddBoxIcon,
  AdminCoursesIcon,
  AdminErrorIcon,
  AdminPointsIcon,
  AdminRewardsIcon,
  AdminRuleIcon,
} from "@/components/admin/AdminIcons";
import type { AdminCatalogOverview } from "@/lib/admin";

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function CatalogOverviewView({ overview }: { overview: AdminCatalogOverview }) {
  const attentionItems: Array<{ id: string; title: string; detail: string; actionLabel: string; actionHref: string }> = [];

  if (overview.coursesInReview > 0) {
    attentionItems.push({
      id: "courses-in-review",
      title: `${overview.coursesInReview} course${overview.coursesInReview === 1 ? "" : "s"} awaiting review`,
      detail: "Content is in review and needs an editorial decision before it can publish.",
      actionLabel: "Review courses",
      actionHref: "/admin/courses",
    });
  }

  if (overview.pendingRewardClaims > 0) {
    attentionItems.push({
      id: "pending-claims",
      title: `${overview.pendingRewardClaims} reward claim${overview.pendingRewardClaims === 1 ? "" : "s"} pending fulfillment`,
      detail: "Learners are waiting on manual fulfillment for redeemed platform rewards.",
      actionLabel: "Fulfill now",
      actionHref: "/admin/redemptions",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[32px] font-black tracking-[-0.02em] text-[var(--admin-ink-charcoal)]">Overview</h1>
        <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
          Project VE&rsquo;s own platform catalogue — content owned by no organisation, available across the
          platform.
        </p>
      </div>

      {attentionItems.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
            <AdminErrorIcon className="text-[var(--admin-secondary)]" />
            Attention Required
          </h2>
          <div className="flex flex-col gap-3">
            {attentionItems.map((item) => (
              <AdminAlertCard
                actionHref={item.actionHref}
                actionLabel={item.actionLabel}
                detail={item.detail}
                icon={<AdminErrorIcon />}
                key={item.id}
                title={item.title}
              />
            ))}
          </div>
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-bold text-[var(--admin-on-surface)]">Catalogue Health</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AdminMetricCard
            helpText={`Published (${overview.coursesPublishedLastSevenDays} this week)`}
            icon={<AdminCoursesIcon className="text-[18px]" />}
            label="Courses / Missions"
            value={overview.coursesPublished + overview.missionsPublished}
          />
          <AdminMetricCard
            icon={<AdminPointsIcon className="text-[18px]" />}
            label={overview.points?.label ?? "Points"}
            value={
              overview.points ? (
                <span className="flex flex-col leading-tight">
                  <span>
                    {formatCompactNumber(overview.points.awarded)}{" "}
                    <span className="text-sm font-medium text-[var(--admin-on-surface-variant)]">awarded</span>
                  </span>
                  <span className="text-lg text-[var(--admin-on-surface-variant)]">
                    {formatCompactNumber(overview.points.spent)} spent
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
          <AdminMetricCard
            helpText="Pending fulfillment"
            icon={<AdminRewardsIcon className="text-[18px] text-[var(--admin-secondary)]" />}
            label="Reward Claims"
            tone={overview.pendingRewardClaims > 0 ? "attention" : "default"}
            value={overview.pendingRewardClaims}
          />
        </div>
      </section>

      <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
        <h2 className="mb-3 border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
          Workspace Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminQuickActionButton emphasis href="/admin/courses/new" icon={<AdminAddBoxIcon />} label="New Course" />
          <AdminQuickActionButton href="/admin/rewards" icon={<AdminRewardsIcon />} label="Manage Rewards" />
          <AdminQuickActionButton href="/admin/courses" icon={<AdminRuleIcon />} label="Review Courses" />
        </div>
      </div>
    </div>
  );
}
