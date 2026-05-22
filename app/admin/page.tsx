import Link from "next/link";
import {
  AdminCard,
  AdminPageHeader,
  AdminStatCard,
} from "@/components/admin/AdminPrimitives";
import { getAdminOverview, requireAdmin } from "@/lib/admin";
import { formatXpAmount } from "@/lib/xp-format";

const priorityLinks = [
  {
    href: "/admin/recommendations",
    title: "Configure recommendations",
    text: "Choose the courses and lessons learners see first on the home screen.",
  },
  {
    href: "/admin/redemptions",
    title: "Review redemptions",
    text: "Monitor purchases, manual fulfillment, refunds, and partner-facing claim data.",
  },
  {
    href: "/admin/proofs",
    title: "Review mission proofs",
    text: "Approve or reject proof-based missions and trigger valid XP awards.",
  },
  {
    href: "/admin/xp-ledger",
    title: "Audit XP ledger",
    text: "Inspect XP movement across quizzes, missions, rewards, refunds, and native perks.",
  },
];

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();
  const overview = await getAdminOverview(supabase);

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Admin overview"
        subtitle="A value-operations console for rewards, missions, user activity, and XP movement."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AdminStatCard label="Users" value={overview.totalUsers.toLocaleString()} />
        <AdminStatCard label="Rewards" value={overview.totalRewards.toLocaleString()} tone="store" />
        <AdminStatCard label="Missions" value={overview.totalMissions.toLocaleString()} tone="mission" />
        <AdminStatCard label="Campaigns" value={overview.totalCampaigns.toLocaleString()} />
        <AdminStatCard
          label="Pending redemptions"
          value={overview.pendingRedemptions.toLocaleString()}
          tone={overview.pendingRedemptions > 0 ? "risk" : "default"}
        />
        <AdminStatCard
          label="Proof items pending"
          value={overview.pendingProofItems.toLocaleString()}
          tone={overview.pendingProofItems > 0 ? "mission" : "default"}
        />
        <AdminStatCard
          label="XP earned today"
          value={formatXpAmount(overview.xpEarnedToday)}
          tone="store"
        />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {priorityLinks.map((link) => (
          <Link href={link.href} key={link.href}>
            <AdminCard className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
              <h2 className="text-lg font-black">{link.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">{link.text}</p>
            </AdminCard>
          </Link>
        ))}
      </section>
    </>
  );
}
