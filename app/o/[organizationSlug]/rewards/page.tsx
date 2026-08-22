import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { OrgBottomNav } from "@/components/organizations/OrgLearnerMobile";
import { XPStore } from "@/components/rewards/XPStore";
import { getOrganizationWorkspaceRewardSnapshot } from "@/features/organizations/application/learner-workspace";
import { withLoggedFallback } from "@/lib/app-errors";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

export default async function OrganizationRewardsPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const rewardSnapshot = await withLoggedFallback({
    context: {
      operation: "org_workspace.reward_store.load",
      resourceId: workspace.organizationId,
      userId: user.id,
    },
    fallback: null,
    promise: getOrganizationWorkspaceRewardSnapshot({ supabase, userId: user.id, workspace }),
  });

  return (
    <main className="mobile-shell min-h-screen bg-[#fffaf0]">
      <AppHeader
        title={`${organizationName} Rewards`}
        backHref={orgHref(workspace)}
        className="bg-[#fffaf0] shadow-none"
        showMenu={false}
      />
      <section className="learner-page pt-6">
        <Link className="text-sm font-black text-[var(--ve-green)]" href="/xp-store">
          Return to Project Ve
        </Link>
      </section>
      <XPStore
        apiPath={`/api/organizations/${workspace.organizationSlug}/rewards`}
        initialSnapshot={rewardSnapshot}
        redeemPathPrefix={`/api/organizations/${workspace.organizationSlug}/rewards`}
        workspaceLabel={workspace.xpAccount.label}
      />
      <OrgBottomNav active="Store" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
