import Link from "next/link";
import {
  AdminActivityList,
  AdminAlertCard,
  AdminChecklist,
  AdminMetricCard,
  AdminQuickActionButton,
} from "@/components/admin/AdminPrimitives";
import {
  AdminAddBoxIcon,
  AdminCohortsIcon,
  AdminCoursesIcon,
  AdminErrorIcon,
  AdminFlagIcon,
  AdminPeopleIcon,
  AdminPointsIcon,
  AdminProgrammesIcon,
  AdminRewardsIcon,
  AdminRuleIcon,
} from "@/components/admin/AdminIcons";
import type { AdminOrganizationActivityEvent, AdminOrganizationOverview } from "@/lib/admin";

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function activityIconGlyph(event: AdminOrganizationActivityEvent) {
  if (event.entityType === "course" || event.entityType === "lesson") return "📘";
  if (event.entityType === "mission") return "🎯";
  if (event.entityType === "membership" || event.entityType === "learner") return "👤";
  if (event.entityType === "cohort") return "👥";
  return "•";
}

export function OrganizationOverviewView({
  organizationName,
  overview,
}: {
  organizationName: string;
  overview: AdminOrganizationOverview;
}) {
  const onboardingItems = [
    { id: "branding", label: "Configure branding", complete: overview.onboarding.brandingConfigured },
    {
      id: "admins",
      label: "Invite admins",
      complete: overview.onboarding.adminsInvited,
      href: "/admin/people?invite=1",
    },
    {
      id: "learners",
      label: "Import learner roster",
      complete: overview.onboarding.learnersImported,
      href: "/admin/people?invite=1",
    },
    { id: "mission", label: "Publish first mission", complete: overview.onboarding.firstMissionPublished },
  ];
  const onboardingProgress = Math.round(
    (onboardingItems.filter((item) => item.complete).length / onboardingItems.length) * 100,
  );

  const attentionItems: Array<{ id: string; title: string; detail: string; actionLabel: string; actionHref: string; tone: "attention" | "warning" }> = [];

  if (overview.openInterventions.critical > 0) {
    attentionItems.push({
      id: "critical-interventions",
      title: `${overview.openInterventions.critical} critical learner alert${overview.openInterventions.critical === 1 ? "" : "s"}`,
      detail: "Learners are overdue or inactive and need supervisor follow-up.",
      actionLabel: "Review interventions",
      actionHref: "/admin/interventions",
      tone: "attention",
    });
  }

  if (overview.coursesInReview > 0) {
    attentionItems.push({
      id: "courses-in-review",
      title: `${overview.coursesInReview} course${overview.coursesInReview === 1 ? "" : "s"} awaiting review`,
      detail: "Content is in review and needs an editorial decision before it can publish.",
      actionLabel: "Review courses",
      actionHref: "/admin/courses",
      tone: "warning",
    });
  }

  if (overview.pendingRewardClaims > 0) {
    attentionItems.push({
      id: "pending-claims",
      title: `${overview.pendingRewardClaims} reward claim${overview.pendingRewardClaims === 1 ? "" : "s"} pending fulfillment`,
      detail: "Learners are waiting on manual fulfillment for redeemed rewards.",
      actionLabel: "Fulfill now",
      actionHref: "/admin/redemptions",
      tone: "attention",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[32px] font-black tracking-[-0.02em] text-[var(--admin-ink-charcoal)]">Overview</h1>
        <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">
          Manage {organizationName}&rsquo;s operational health and ongoing activities.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--admin-border-warm)] pb-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--admin-on-surface)]">
              <AdminErrorIcon className="text-[var(--admin-secondary)]" />
              Attention Required
            </h2>
            {attentionItems.length > 0 ? (
              <span className="rounded-full bg-[var(--admin-error-container)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--admin-on-error-container)]">
                {attentionItems.length} {attentionItems.length === 1 ? "alert" : "alerts"}
              </span>
            ) : null}
          </div>
          {attentionItems.length > 0 ? (
            <div className="flex flex-col gap-3">
              {attentionItems.map((item) => (
                <AdminAlertCard
                  actionHref={item.actionHref}
                  actionLabel={item.actionLabel}
                  detail={item.detail}
                  icon={<AdminErrorIcon />}
                  key={item.id}
                  title={item.title}
                  tone={item.tone}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
              Nothing needs your attention right now.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--admin-border-warm)] pb-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--admin-on-surface)]">
              <AdminFlagIcon className="text-[var(--admin-primary)]" />
              Onboarding Progress
            </h2>
            <span className="text-2xl font-black text-[var(--admin-primary)]">{onboardingProgress}%</span>
          </div>
          <AdminChecklist items={onboardingItems} progressPercent={onboardingProgress} />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-[var(--admin-on-surface)]">Operational Health</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AdminMetricCard
            helpText={`+${overview.learnerGrowthLastThirtyDays} in 30d`}
            href="/admin/people"
            icon={<AdminPeopleIcon className="text-[18px]" />}
            label="Total Learners"
            value={formatCompactNumber(overview.totalLearners)}
          />
          <AdminMetricCard
            helpText={`Across ${overview.activeCohorts} cohort${overview.activeCohorts === 1 ? "" : "s"}`}
            icon={<AdminProgrammesIcon className="text-[18px]" />}
            label="Active Programmes"
            value={overview.activeProgrammes}
          />
          <AdminMetricCard
            helpText={`Published (${overview.coursesPublishedLastSevenDays} this week)`}
            icon={<AdminCoursesIcon className="text-[18px]" />}
            label="Courses / Missions"
            value={overview.coursesPublished + overview.missionsPublished}
          />
          <AdminMetricCard
            icon={<AdminCohortsIcon className="text-[18px]" />}
            label="Active Cohorts"
            value={overview.activeCohorts}
          />
          <AdminMetricCard
            icon={<AdminPointsIcon className="text-[18px]" />}
            label={overview.points?.label ?? "Points"}
            value={
              overview.points ? (
                <span className="flex flex-col leading-tight">
                  <span>{formatCompactNumber(overview.points.awarded)} <span className="text-sm font-medium text-[var(--admin-on-surface-variant)]">awarded</span></span>
                  <span className="text-lg text-[var(--admin-on-surface-variant)]">{formatCompactNumber(overview.points.spent)} spent</span>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--admin-border-warm)] pb-2">
            <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Recent Activity</h2>
            <Link className="text-sm font-bold text-[var(--admin-primary)] hover:underline" href="/admin/activity">
              View full log
            </Link>
          </div>
          <AdminActivityList
            items={overview.recentActivity.map((event) => ({
              id: event.id,
              icon: activityIconGlyph(event),
              title: event.actionLabel,
              detail: event.summary,
              timeLabel: formatRelativeTime(event.createdAt),
            }))}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-[24px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] p-5 shadow-sm">
          <h2 className="border-b border-[var(--admin-border-warm)] pb-2 text-lg font-bold text-[var(--admin-on-surface)]">
            Workspace Actions
          </h2>
          <AdminQuickActionButton emphasis href="/admin/programmes/new" icon={<AdminAddBoxIcon />} label="New Programme" />
          <AdminQuickActionButton href="/admin/people?invite=1" icon={<AdminPeopleIcon />} label="Invite Learners" />
          <AdminQuickActionButton href="/admin/rewards" icon={<AdminRewardsIcon />} label="Manage Rewards" />
          <AdminQuickActionButton href="/admin/courses" icon={<AdminRuleIcon />} label="Review Courses" />
        </div>
      </div>
    </div>
  );
}
