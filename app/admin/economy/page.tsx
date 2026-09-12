import { EconomyPageHeader as AdminPageHeader } from "@/components/admin/economy/EconomyPrimitives";
import Link from "next/link";
import { requireAdminWorkspaceRole } from "@/lib/admin";
import { getEconomyOverview } from "@/features/reward-economy/overview";
import { availabilityLabel } from "@/features/reward-economy/vocabulary";
import {
  AdminCard,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import { EconomyCard } from "@/components/admin/economy/EconomyPrimitives";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";

export default async function RewardEconomyPage() {
  const { supabase, workspace } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
  ]);
  const overview = await getEconomyOverview(
    supabase,
    workspace.type === "organization" || workspace.id === PLATFORM_CATALOG_WORKSPACE_ID
      ? workspace.id
      : null,
  );
  const platform =
    workspace.type === "platform" ||
    workspace.id === PLATFORM_CATALOG_WORKSPACE_ID;
  const links = [
    ["Missions", "Tasks that turn learning into action", "/admin/missions"],
    ["Proof review", "Review evidence and explain decisions", "/admin/proofs"],
    ["Rewards", "Offers, eligibility and available stock", "/admin/rewards"],
    ["Perks", "Prize pools and release windows", "/admin/rewards/perks"],
    ["Stock", "Add a quantity or upload a batch", "/admin/inventory/new"],
    ["Redemptions", "Fulfil claims and manage refunds", "/admin/redemptions"],
    ...(platform
      ? [
          [
            "Campaigns",
            "Timing, reporting context and stock",
            "/admin/campaigns",
          ],
        ]
      : []),
  ];
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Learning into action"
        title="Reward economy"
        subtitle="A clear view of what needs your attention, and the tools to keep learning rewarding."
      />
      <section
        aria-label="Economy summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {[
          ["Published missions", overview.missionCount, "/admin/missions"],
          ["Owned rewards & perks", overview.rewardCount, "/admin/rewards"],
          [
            "Proof items to review",
            overview.pendingProofItems,
            "/admin/proofs",
          ],
          [
            "Manual claims ready",
            overview.manualClaims ?? "View queue",
            "/admin/redemptions",
          ],
        ].map(([label, value, href]) => (
          <Link
            className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-5"
            href={String(href)}
            key={String(label)}
          >
            <p className="text-sm text-[var(--ui-text-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </Link>
        ))}
      </section>
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Needs attention</h2>
            <p className="mt-1 text-sm text-[var(--ui-text-muted)]">
              Start with learner decisions and rewards awaiting fulfilment.
            </p>
          </div>
          <Link
            className={adminButtonClasses("primary")}
            href={
              overview.manualClaims ? "/admin/redemptions" : "/admin/proofs"
            }
          >
            Open work queue →
          </Link>
        </div>
        <ul className="mt-5 divide-y divide-[var(--ui-border-subtle)]">
          <li className="py-3">
            <Link
              className="flex justify-between gap-3 text-sm"
              href="/admin/proofs"
            >
              <span>Review submitted proof</span>
              <span>{overview.pendingProofItems} evidence items →</span>
            </Link>
          </li>
          <li className="py-3">
            <Link
              className="flex justify-between gap-3 text-sm"
              href="/admin/redemptions"
            >
              <span>Fulfil manual claims</span>
              <span>{overview.manualClaims ?? "Open queue"} →</span>
            </Link>
          </li>
          {overview.stockAttention.map((reward) => (
            <li className="py-3" key={reward.id}>
              <Link
                className="flex justify-between gap-3 text-sm"
                href={`/admin/rewards/${reward.id}`}
              >
                <span>{reward.title}</span>
                <span>No stock available →</span>
              </Link>
            </li>
          ))}
        </ul>
        {overview.attentionLimited ? (
          <p className="mt-3 text-xs text-[var(--ui-text-muted)]">
            Stock attention shows the latest 1,000 owned rewards. Open the queue
            for the full claim list.
          </p>
        ) : null}
      </AdminCard>
      {overview.campaigns.length ? (
        <section>
          <h2 className="mb-4 text-2xl font-semibold">Enabled campaigns</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {overview.campaigns.map((campaign) => (
              <EconomyCard
                title={campaign.name}
                href={`/admin/campaigns/${campaign.id}`}
                key={campaign.id}
                eyebrow={campaign.budget_label}
              >
                <p>{campaign.description}</p>
                <p>{availabilityLabel(campaign.starts_at, campaign.ends_at)}</p>
              </EconomyCard>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Manage the economy</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(([title, description, href]) => (
            <Link
              className="rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-5 transition hover:border-[var(--ui-action)]"
              href={href}
              key={href}
            >
              <h3 className="font-semibold">{title} →</h3>
              <p className="mt-2 text-sm text-[var(--ui-text-muted)]">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
